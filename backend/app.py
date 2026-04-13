from datetime import date, datetime, timedelta
from statistics import mean

from flask import Flask, jsonify, request
from flask_cors import CORS

from face_attendance import FaceAttendanceService

app = Flask(__name__)
CORS(app, origins=["*"])

attendance_service = FaceAttendanceService()


def build_dashboard_summary():
    students = attendance_service.list_students()
    records = attendance_service.list_attendance()
    today = date.today().isoformat()
    today_records = [record for record in records if record.get("date") == today]
    recent_records = records[:6]

    attendance_by_date = {}
    for offset in range(6, -1, -1):
        day = (date.today() - timedelta(days=offset)).isoformat()
        attendance_by_date[day] = 0
    for record in records:
        record_date = record.get("date")
        if record_date in attendance_by_date:
            attendance_by_date[record_date] += 1

    departments = {}
    for student in students:
        department = student.get("department") or "General"
        departments[department] = departments.get(department, 0) + 1

    confidence_scores = [record.get("confidence", 0) for record in records if isinstance(record.get("confidence"), (int, float))]
    weekly_average = round(mean(attendance_by_date.values()), 1) if attendance_by_date else 0

    return {
        "stats": {
            "total_students": len(students),
            "today_attendance": len(today_records),
            "attendance_rate": round((len(today_records) / len(students)) * 100, 1) if students else 0,
            "avg_confidence": round(mean(confidence_scores) * 100, 1) if confidence_scores else 0,
            "weekly_average": weekly_average,
        },
        "trend": [
            {
                "date": day,
                "count": count,
            }
            for day, count in attendance_by_date.items()
        ],
        "departments": [
            {
                "name": department,
                "count": count,
            }
            for department, count in sorted(departments.items(), key=lambda item: item[1], reverse=True)
        ],
        "recent_activity": recent_records,
        "system": {
            "last_sync": datetime.utcnow().isoformat(),
            "storage_mode": "Local JSON + OpenCV",
            "recognition_engine": "LBPH + Haar Cascade",
            "health": "healthy",
        },
    }


@app.route("/health", methods=["GET"])
def health():
    summary = build_dashboard_summary()
    return jsonify(
        {
            "status": "ok",
            "message": "Face attendance backend is running.",
            "students": summary["stats"]["total_students"],
            "today_attendance": summary["stats"]["today_attendance"],
        }
    )


@app.route("/dashboard-summary", methods=["GET"])
def dashboard_summary():
    return jsonify(build_dashboard_summary())


@app.route("/register-student", methods=["POST"])
def register_student():
    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip()
    department = request.form.get("department", "").strip()
    image_file = request.files.get("image")

    if not name:
        return jsonify({"error": "Student name is required."}), 400
    if not image_file:
        return jsonify({"error": "Student image is required."}), 400

    try:
        student = attendance_service.register_student(name, email, department, image_file.read())
        return jsonify(
            {
                "success": True,
                "student": student,
                "message": "Student registered successfully.",
            }
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/students/<student_id>", methods=["DELETE"])
def delete_student(student_id):
    deleted = attendance_service.delete_student(student_id)
    if not deleted:
        return jsonify({"error": "Student not found."}), 404
    return jsonify({"success": True, "message": "Student removed successfully."})


@app.route("/mark-attendance", methods=["POST"])
def mark_attendance():
    payload = request.get_json(force=True)
    image_base64 = payload.get("image_base64")
    if not image_base64:
        return jsonify({"error": "Image base64 is required."}), 400

    try:
        image_bgr = attendance_service.decode_base64_image(image_base64)
        attendance_service.get_face_image(image_bgr)
    except ValueError as exc:
        return jsonify({"matched": False, "error": str(exc), "confidence": 0.0}), 200
    except Exception as exc:
        return jsonify({"matched": False, "error": str(exc), "confidence": 0.0}), 500

    student, confidence = attendance_service.find_best_match(image_bgr)
    similarity = round(float(confidence or 0.0), 2)
    if not student:
        return jsonify({"matched": False, "message": "Unknown face.", "confidence": similarity}), 200

    attendance_record, created = attendance_service.mark_attendance(student, confidence)
    return (
        jsonify(
            {
                "matched": True,
                "student": {
                    "id": student["id"],
                    "name": student["name"],
                    "email": student.get("email", ""),
                    "department": student.get("department", ""),
                },
                "attendance": attendance_record,
                "duplicate": not created,
                "confidence": similarity,
            }
        ),
        200,
    )


@app.route("/get-attendance", methods=["GET"])
def get_attendance():
    date_filter = request.args.get("date")
    records = attendance_service.list_attendance(date_filter)
    return jsonify({"records": records, "count": len(records)})


@app.route("/get-students", methods=["GET"])
def get_students():
    students = attendance_service.list_students()
    return jsonify({"students": students, "count": len(students)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
