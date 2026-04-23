import base64
import json
import os
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("FACE_DATA_DIR", str(BASE_DIR / "data"))).resolve()
ENCODINGS_FILE = DATA_DIR / "face_profiles.json"
MONGODB_URI = os.getenv("MONGODB_URI", "")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "face-attendance")
DATA_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
CORS(app)

FACE_DETECTOR = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
EYE_DETECTOR = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye_tree_eyeglasses.xml")
SMILE_DETECTOR = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_smile.xml")

mongo_client = MongoClient(MONGODB_URI) if MONGODB_URI else None
mongo_collection = (
    mongo_client[MONGO_DB_NAME]["faceprofiles"]
    if mongo_client is not None
    else None
)


def read_profiles():
    if mongo_collection is not None:
        state = mongo_collection.find_one({"key": "primary"})
        if state:
            return state.get("profiles", [])
        if ENCODINGS_FILE.exists():
            with open(ENCODINGS_FILE, "r", encoding="utf-8") as handle:
                profiles = json.load(handle)
            write_profiles(profiles)
            return profiles
        return []
    if not ENCODINGS_FILE.exists():
        return []
    with open(ENCODINGS_FILE, "r", encoding="utf-8") as handle:
        return json.load(handle)


def write_profiles(profiles):
    if mongo_collection is not None:
        mongo_collection.update_one(
            {"key": "primary"},
            {"$set": {"key": "primary", "profiles": profiles}},
            upsert=True,
        )
        return
    with open(ENCODINGS_FILE, "w", encoding="utf-8") as handle:
        json.dump(profiles, handle, indent=2)


def decode_image(image_string):
    if image_string.startswith("data:image"):
        image_string = image_string.split(",", 1)[1]
    image_bytes = base64.b64decode(image_string)
    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode image.")
    return image


def preprocess_face(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = FACE_DETECTOR.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(faces) == 0:
        faces = FACE_DETECTOR.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(50, 50))
    if len(faces) == 0:
        height, width = gray.shape[:2]
        crop_size = int(min(height, width) * 0.82)
        center_x, center_y = width // 2, height // 2
        half = crop_size // 2
        start_x = max(0, center_x - half)
        start_y = max(0, center_y - half)
        end_x = min(width, start_x + crop_size)
        end_y = min(height, start_y + crop_size)
        face = gray[start_y:end_y, start_x:end_x]
        if face.size == 0:
            face = gray
    else:
        x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
        face = gray[y : y + h, x : x + w]

    face = cv2.resize(face, (200, 200))
    face = cv2.GaussianBlur(face, (3, 3), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    face = clahe.apply(face)
    face = cv2.normalize(face, None, 0, 255, cv2.NORM_MINMAX)
    return face


def vectorize(face):
    hist = cv2.calcHist([face], [0], None, [64], [0, 256]).flatten()
    hist = hist / (np.linalg.norm(hist) + 1e-6)
    downsampled = cv2.resize(face, (32, 32)).flatten().astype("float32") / 255.0
    return np.concatenate([hist, downsampled]).tolist()


def similarity(face_a, face_b):
    vec_a = np.array(face_a, dtype="float32")
    vec_b = np.array(face_b, dtype="float32")
    hist_len = 64
    pixel_a = vec_a[hist_len:]
    pixel_b = vec_b[hist_len:]
    if pixel_a.size == 0 or pixel_b.size == 0:
        return 0.0
    mse = float(np.mean(np.square(pixel_a - pixel_b)))
    rmse = float(np.sqrt(mse))
    return max(0.0, min(1.0, 1.0 - rmse))


def profile_best_score(candidate_vector, saved_vectors):
    if not saved_vectors:
        return 0.0
    return max(similarity(candidate_vector, saved_vector) for saved_vector in saved_vectors)


def profile_match_stats(vectors, saved_vectors):
    pair_scores = []
    candidate_best_scores = []
    for candidate in vectors:
        candidate_scores = [similarity(candidate, saved_vector) for saved_vector in saved_vectors]
        if candidate_scores:
            pair_scores.extend(candidate_scores)
            candidate_best_scores.append(max(candidate_scores))

    if not candidate_best_scores:
        return {
            "best_score": 0.0,
            "average_best_score": 0.0,
            "strong_match_count": 0,
        }

    strong_match_count = sum(1 for score in candidate_best_scores if score >= 0.86)
    return {
        "best_score": max(candidate_best_scores),
        "average_best_score": float(sum(candidate_best_scores) / len(candidate_best_scores)),
        "strong_match_count": strong_match_count,
    }


def find_face_owner(vectors, profiles, exclude_user_id=None, exclude_email=""):
    best_profile = None
    best_stats = {
        "best_score": 0.0,
        "average_best_score": 0.0,
        "strong_match_count": 0,
    }
    for profile in profiles:
        if profile.get("userId") == exclude_user_id:
            continue
        if exclude_email and profile.get("email", "").lower() == exclude_email:
            continue
        profile_vectors = profile.get("vectors", [])
        stats = profile_match_stats(vectors, profile_vectors)
        is_better = (
            stats["strong_match_count"] > best_stats["strong_match_count"]
            or (
                stats["strong_match_count"] == best_stats["strong_match_count"]
                and stats["average_best_score"] > best_stats["average_best_score"]
            )
            or (
                stats["strong_match_count"] == best_stats["strong_match_count"]
                and abs(stats["average_best_score"] - best_stats["average_best_score"]) < 1e-6
                and stats["best_score"] > best_stats["best_score"]
            )
        )
        if is_better:
            best_profile = profile
            best_stats = stats
    return best_profile, best_stats


def build_profile_response(profile, score):
    return {
        "matched": True,
        "userId": profile["userId"],
        "name": profile["name"],
        "email": profile.get("email", ""),
        "role": profile.get("role", ""),
        "confidence": round(score, 2),
    }


def analyze_engagement(face):
    upper_region = face[:80, :]
    center_region = face[60:145, 45:155]
    lower_region = face[140:, :]

    eye_detail = cv2.Laplacian(upper_region, cv2.CV_64F).var()
    focus_detail = cv2.Laplacian(center_region, cv2.CV_64F).var()
    mouth_brightness = float(np.mean(lower_region))
    face_brightness = float(np.mean(face))
    contrast = float(np.std(face))

    eyes = EYE_DETECTOR.detectMultiScale(
        upper_region,
        scaleFactor=1.08,
        minNeighbors=5,
        minSize=(18, 18),
    )
    smiles = SMILE_DETECTOR.detectMultiScale(
        lower_region,
        scaleFactor=1.12,
        minNeighbors=8,
        minSize=(25, 12),
    )

    eye_count = min(len(eyes), 2)
    smile_count = min(len(smiles), 1)
    smile_boost = 30 if smile_count else 0
    eye_boost = eye_count * 12

    attention_score = int(
        np.clip(
            18
            + eye_boost
            + smile_boost
            + (eye_detail / 5.2)
            + (focus_detail / 7.4)
            + (contrast * 0.48)
            + ((face_brightness - 105) * 0.18)
            - abs(mouth_brightness - face_brightness) * 0.12,
            22,
            98,
        )
    )

    if smile_count and attention_score >= 60:
        state = "attentive"
        attention_score = max(attention_score, 78)
    elif attention_score >= 72:
        state = "attentive"
    elif attention_score >= 48:
        state = "bored"
    else:
        state = "sleepy"

    return {
        "state": state,
        "engagementScore": attention_score,
        "signals": {
            "eyesDetected": int(eye_count),
            "smileDetected": bool(smile_count),
            "eyeDetail": round(float(eye_detail), 2),
            "focusDetail": round(float(focus_detail), 2),
            "brightness": round(face_brightness, 2),
            "contrast": round(contrast, 2),
        },
    }


@app.get("/health")
def health():
    profiles = read_profiles()
    return jsonify({"status": "ok", "profiles": len(profiles)})


@app.post("/register-face")
def register_face():
    payload = request.get_json(force=True)
    user_id = payload.get("userId")
    name = payload.get("name", "")
    email = payload.get("email", "")
    role = str(payload.get("role", "")).lower()
    images = payload.get("images", [])
    if not user_id or not images:
        return jsonify({"message": "userId and images are required."}), 400

    vectors = []
    for image in images:
        try:
            face = preprocess_face(decode_image(image))
            vectors.append(vectorize(face))
        except ValueError:
            continue

    if not vectors:
        return jsonify({"message": "No valid face samples found in uploaded images."}), 400

    existing_profiles = read_profiles()
    owner_profile, owner_stats = find_face_owner(vectors, existing_profiles, user_id, email.lower())
    minimum_strong_matches = max(1, min(2, len(vectors)))
    duplicate_detected = (
        owner_profile is not None
        and (
            owner_stats["best_score"] >= 0.84
            or owner_stats["average_best_score"] >= 0.8
            or (
                owner_stats["average_best_score"] >= 0.76
                and owner_stats["strong_match_count"] >= minimum_strong_matches
            )
        )
    )
    if duplicate_detected:
        return (
            jsonify(
                {
                    "message": "This face is already registered to another account.",
                    "ownerUserId": owner_profile.get("userId"),
                    "ownerEmail": owner_profile.get("email", ""),
                    "ownerName": owner_profile.get("name", ""),
                    "ownerRole": owner_profile.get("role", ""),
                    "confidence": round(owner_stats["average_best_score"], 2),
                }
            ),
            409,
        )

    profiles = [
        profile
        for profile in existing_profiles
        if profile.get("userId") != user_id and profile.get("email", "").lower() != email.lower()
    ]
    profiles.append(
        {
            "userId": user_id,
            "name": name,
            "email": email,
            "role": role,
            "vectors": vectors,
        }
    )
    write_profiles(profiles)
    return jsonify({"success": True, "samples": len(vectors)})


@app.post("/recognize-face")
def recognize_face():
    payload = request.get_json(force=True)
    image = payload.get("image")
    expected_user_id = payload.get("expectedUserId")
    expected_email = str(payload.get("expectedEmail", "")).lower()
    strict_expected = bool(payload.get("strictExpected"))
    if not image:
        return jsonify({"matched": False, "message": "Image is required."}), 400

    try:
        face = preprocess_face(decode_image(image))
    except ValueError as error:
        return jsonify({"matched": False, "message": str(error)}), 400

    candidate = vectorize(face)
    profiles = read_profiles()
    best_profile = None
    best_score = 0.0

    if expected_user_id or expected_email:
        expected_profile = next(
            (
                profile
                for profile in profiles
                if profile.get("userId") == expected_user_id
                or (expected_email and profile.get("email", "").lower() == expected_email)
            ),
            None,
        )
        if expected_profile:
            expected_score = profile_best_score(candidate, expected_profile.get("vectors", []))

            for profile in profiles:
                score = profile_best_score(candidate, profile.get("vectors", []))
                if score > best_score:
                    best_score = score
                    best_profile = profile

            if strict_expected:
                stronger_owner_found = (
                    best_profile is not None
                    and best_profile.get("userId") != expected_profile.get("userId")
                    and best_score >= 0.84
                    and best_score > expected_score + 0.04
                )

                if stronger_owner_found:
                    return jsonify(
                        {
                            "matched": False,
                            "confidence": round(expected_score, 2),
                            "message": "This face belongs to another registered account.",
                            "ownerUserId": best_profile.get("userId"),
                            "ownerEmail": best_profile.get("email", ""),
                            "ownerName": best_profile.get("name", ""),
                            "ownerRole": best_profile.get("role", ""),
                            "ownerConfidence": round(best_score, 2),
                        }
                    )

                if expected_score >= 0.84 and (
                    best_profile is None
                    or best_profile.get("userId") == expected_profile.get("userId")
                    or expected_score >= best_score - 0.02
                ):
                    return jsonify(build_profile_response(expected_profile, expected_score))

                return jsonify(
                    {
                        "matched": False,
                        "confidence": round(expected_score, 2),
                        "message": "Face verification failed for this account.",
                    }
                )
            if expected_score >= 0.86 and (
                best_profile is None
                or best_profile.get("userId") == expected_profile.get("userId")
                or expected_score >= best_score - 0.02
            ):
                return jsonify(build_profile_response(expected_profile, expected_score))

    if best_profile is None:
        for profile in profiles:
            score = profile_best_score(candidate, profile.get("vectors", []))
            if score > best_score:
                best_score = score
                best_profile = profile

    if best_profile is None or best_score < 0.84:
        return jsonify({"matched": False, "confidence": round(best_score, 2), "message": "Unknown face"})

    return jsonify(build_profile_response(best_profile, best_score))


@app.post("/analyze-engagement")
def analyze_engagement_route():
    payload = request.get_json(force=True)
    image = payload.get("image")
    if not image:
        return jsonify({"message": "Image is required."}), 400

    try:
        face = preprocess_face(decode_image(image))
    except ValueError as error:
        return jsonify({"message": str(error)}), 400

    return jsonify(analyze_engagement(face))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
