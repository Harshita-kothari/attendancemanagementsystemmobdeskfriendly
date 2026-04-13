import base64
import json
import re
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent
FACE_DATA_DIR = BASE_DIR / "face_data"
DATA_DIR = BASE_DIR / "data"
STUDENTS_FILE = DATA_DIR / "students.json"
ATTENDANCE_FILE = DATA_DIR / "attendance.json"

FACE_DATA_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)


def sanitize_filename(name: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip()).strip("_")
    return safe.lower() or "student"


class FaceAttendanceService:
    def __init__(self, mongo_uri: Optional[str] = None):
        self.face_detector = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

    def _read_json(self, path: Path):
        if not path.exists():
            return []
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_json(self, path: Path, data):
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)

    def _load_students(self):
        return self._read_json(STUDENTS_FILE)

    def _save_students(self, students):
        self._write_json(STUDENTS_FILE, students)

    def _load_attendance(self):
        return self._read_json(ATTENDANCE_FILE)

    def _save_attendance(self, records):
        self._write_json(ATTENDANCE_FILE, records)

    def decode_image_bytes(self, image_bytes: bytes):
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        image_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image_bgr is None:
            raise ValueError("Unable to decode uploaded image")
        return image_bgr

    def decode_base64_image(self, image_base64: str):
        if image_base64.startswith("data:image"):
            image_base64 = image_base64.split(",", 1)[1]
        padding = len(image_base64) % 4
        if padding:
            image_base64 += "=" * (4 - padding)
        image_bytes = base64.b64decode(image_base64)
        return self.decode_image_bytes(image_bytes)

    def get_face_image(self, image_bgr):
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        faces = self.face_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(80, 80),
        )

        if len(faces) == 0:
            faces = self.face_detector.detectMultiScale(
                gray,
                scaleFactor=1.05,
                minNeighbors=3,
                minSize=(50, 50),
            )

        if len(faces) == 0:
            resized = cv2.resize(gray, (0, 0), fx=0.75, fy=0.75)
            faces = self.face_detector.detectMultiScale(
                resized,
                scaleFactor=1.05,
                minNeighbors=3,
                minSize=(40, 40),
            )
            if len(faces) > 0:
                x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
                x, y, w, h = int(x / 0.75), int(y / 0.75), int(w / 0.75), int(h / 0.75)
                faces = [(x, y, w, h)]

        if len(faces) == 0:
            raise ValueError("No face detected in image. Use a clear front-facing photo or webcam capture.")

        x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
        face_gray = gray[y : y + h, x : x + w]
        face_resized = cv2.resize(face_gray, (200, 200))
        return self.preprocess_face(face_resized)

    def preprocess_face(self, face_gray):
        face_gray = cv2.resize(face_gray, (200, 200))
        face_gray = cv2.GaussianBlur(face_gray, (3, 3), 0)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(face_gray)
        return cv2.normalize(enhanced, None, 0, 255, cv2.NORM_MINMAX)

    def save_face_image(self, image_gray, name: str) -> str:
        filename = f"{sanitize_filename(name)}_{int(datetime.now().timestamp())}.jpg"
        path = FACE_DATA_DIR / filename
        cv2.imwrite(str(path), image_gray)
        return filename

    def register_student(self, name: str, email: str, department: str, image_bytes: bytes):
        image_bgr = self.decode_image_bytes(image_bytes)
        face_image = self.get_face_image(image_bgr)
        image_filename = self.save_face_image(face_image, name)

        students = self._load_students()
        student_id = uuid.uuid4().hex
        document = {
            "id": student_id,
            "name": name.strip().title(),
            "email": email.strip(),
            "department": department.strip() or "General",
            "image_path": image_filename,
            "created_at": datetime.utcnow().isoformat(),
        }
        students.append(document)
        self._save_students(students)
        return document

    def _build_face_library(self):
        students = self._load_students()
        if not students:
            return []

        library = []
        for student in students:
            image_path = FACE_DATA_DIR / student.get("image_path", "")
            if not image_path.exists():
                continue
            face_image = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
            if face_image is None:
                continue
            face_image = self.preprocess_face(face_image)
            library.append(
                {
                    "student": student,
                    "variants": self._generate_face_variants(face_image),
                }
            )
        return library

    def _generate_face_variants(self, face_image):
        variants = [face_image]
        variants.append(cv2.flip(face_image, 1))
        variants.append(cv2.convertScaleAbs(face_image, alpha=1.05, beta=8))
        variants.append(cv2.convertScaleAbs(face_image, alpha=0.95, beta=-6))
        return variants

    def _face_similarity(self, candidate_face, stored_face):
        candidate = self.preprocess_face(candidate_face)
        stored = self.preprocess_face(stored_face)

        candidate_hist = cv2.calcHist([candidate], [0], None, [64], [0, 256])
        stored_hist = cv2.calcHist([stored], [0], None, [64], [0, 256])
        cv2.normalize(candidate_hist, candidate_hist, 0, 1, cv2.NORM_MINMAX)
        cv2.normalize(stored_hist, stored_hist, 0, 1, cv2.NORM_MINMAX)

        hist_score = float(cv2.compareHist(candidate_hist, stored_hist, cv2.HISTCMP_CORREL))
        hist_score = max(0.0, min(1.0, (hist_score + 1.0) / 2.0))

        diff_score = 1.0 - (float(np.mean(cv2.absdiff(candidate, stored))) / 255.0)
        edges_candidate = cv2.Canny(candidate, 60, 160)
        edges_stored = cv2.Canny(stored, 60, 160)
        edge_score = 1.0 - (float(np.mean(cv2.absdiff(edges_candidate, edges_stored))) / 255.0)

        return (0.45 * hist_score) + (0.35 * diff_score) + (0.20 * edge_score)

    def find_best_match(self, image_bgr, threshold: float = 0.55):
        face_image = self.get_face_image(image_bgr)
        face_library = self._build_face_library()
        if not face_library:
            return None, None

        best_student = None
        best_score = 0.0
        for item in face_library:
            variant_scores = [self._face_similarity(face_image, variant) for variant in item["variants"]]
            score = max(variant_scores) if variant_scores else 0.0
            if score > best_score:
                best_score = score
                best_student = item["student"]

        if best_student is None or best_score < threshold:
            return None, best_score

        return best_student.copy(), best_score

    def mark_attendance(self, student, confidence: float):
        today = date.today().isoformat()
        records = self._load_attendance()
        existing = next(
            (record for record in records if record["student_id"] == student["id"] and record["date"] == today),
            None,
        )
        if existing:
            return existing, False

        record = {
            "record_id": uuid.uuid4().hex,
            "student_id": student["id"],
            "name": student["name"],
            "email": student.get("email", ""),
            "department": student.get("department", "General"),
            "date": today,
            "time": datetime.now().strftime("%H:%M:%S"),
            "timestamp": datetime.utcnow().isoformat(),
            "confidence": round(max(0.0, min(1.0, confidence)), 2),
        }
        records.append(record)
        self._save_attendance(records)
        return record, True

    def list_attendance(self, date_filter: str | None = None):
        records = self._load_attendance()
        if date_filter:
            records = [record for record in records if record.get("date") == date_filter]
        return sorted(records, key=lambda r: r.get("timestamp", ""), reverse=True)

    def list_students(self):
        return self._load_students()

    def delete_student(self, student_id: str):
        students = self._load_students()
        student = next((item for item in students if item.get("id") == student_id), None)
        if student is None:
            return False

        image_path = FACE_DATA_DIR / student.get("image_path", "")
        if image_path.exists():
            image_path.unlink()

        updated_students = [item for item in students if item.get("id") != student_id]
        self._save_students(updated_students)

        records = self._load_attendance()
        updated_records = [record for record in records if record.get("student_id") != student_id]
        self._save_attendance(updated_records)
        return True
