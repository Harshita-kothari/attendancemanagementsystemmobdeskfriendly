from flask import Flask, jsonify, request
from flask_cors import CORS
import base64
import cv2

from face_attendance import AttendanceSystem

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"])

attendance = AttendanceSystem()


@app.route('/start-attendance', methods=['GET'])
def start_attendance():
    duration = request.args.get('duration', default=30, type=int)
    try:
        attendance.start_session(duration)
        return jsonify({
            'status': 'started',
            'message': f'Attendance session started for {duration} seconds.',
            'running': True,
            'known_faces': len(attendance.known_names),
        })
    except Exception as exc:
        attendance.last_error = str(exc)
        return jsonify({
            'status': 'error',
            'message': 'Unable to start attendance session.',
            'error': str(exc),
            'running': False,
            'known_faces': len(attendance.known_names),
        }), 500


@app.route('/stop-attendance', methods=['GET'])
def stop_attendance():
    attendance.stop_session()
    return jsonify({
        'status': 'stopped',
        'message': 'Attendance session stopped.',
        'running': False,
    })


@app.route('/attendance-status', methods=['GET'])
def attendance_status():
    return jsonify(attendance.get_status())


@app.route('/api/face/recognize', methods=['POST'])
def recognize_face():
    payload = request.get_json(force=True)
    image_base64 = payload.get('image_base64')
    if not image_base64:
        return jsonify({'matched': False, 'confidence': 0.0, 'liveness': 'failed', 'message': 'No image data provided.'}), 400
    try:
        image_bgr = attendance.decode_base64_image(image_base64)
    except ValueError as exc:
        return jsonify({'matched': False, 'confidence': 0.0, 'liveness': 'failed', 'message': str(exc)}), 400

    if not attendance.check_liveness(image_bgr):
        return jsonify({'matched': False, 'confidence': 0.0, 'liveness': 'failed', 'status': 'spoof_detected'})

    rgb_image = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    try:
        face_encoding = attendance.get_face_encoding(rgb_image)
    except ValueError as exc:
        return jsonify({'matched': False, 'confidence': 0.0, 'liveness': 'failed', 'message': str(exc)}), 400

    name, distance = attendance.recognize_name(face_encoding)
    if name != 'Unknown':
        attendance.mark_attendance(name)
        attendance.seen_names.add(name)
        if name not in attendance.recognized_names:
            attendance.recognized_names.append(name)
        return jsonify({
            'matched': True,
            'student': {
                'id': name.replace(' ', '_').lower(),
                'name': name,
                'roll_no': name.replace(' ', '_').upper(),
                'department': 'Known',
                'avatar': ''.join([part[0] for part in name.split()[:2]]).upper(),
            },
            'confidence': round(max(0.0, 1.0 - distance), 2),
            'liveness': 'passed',
            'status': 'present',
        })

    attendance.unknown_count += 1
    return jsonify({'matched': False, 'confidence': round(max(0.0, 1.0 - (distance or 0.0)), 2), 'liveness': 'failed'})


@app.route('/api/face/register-live', methods=['POST'])
def register_live_face():
    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    role = request.form.get('role', 'student').strip()
    department = request.form.get('department', '').strip()
    file = request.files.get('file')

    if not file or not name:
        return jsonify({'detail': 'Name and face image are required.'}), 400

    image_data = file.read()
    encoded = base64.b64encode(image_data).decode('utf-8')
    try:
        image_bgr = attendance.decode_base64_image(encoded)
    except ValueError as exc:
        return jsonify({'detail': str(exc)}), 400

    if not attendance.check_liveness(image_bgr):
        return jsonify({'detail': 'No live face detected in the uploaded image.'}), 400

    rgb_image = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    try:
        attendance.get_face_encoding(rgb_image)
    except ValueError as exc:
        return jsonify({'detail': str(exc)}), 400

    student = attendance.register_new_face(name, image_bgr, email=email, department=department, role=role)
    return jsonify({'student': student, 'confidence': 1.0, 'liveness': 'passed', 'status': 'present'})


@app.route('/api/attendance/mark', methods=['POST'])
def mark_attendance_endpoint():
    payload = request.get_json(force=True)
    student_id = payload.get('student_id')
    status = payload.get('status', 'present')
    if not student_id:
        return jsonify({'message': 'student_id is required'}), 400
    name = student_id.replace('_', ' ').title()
    attendance.mark_attendance(name)
    return jsonify({'message': 'Attendance marked', 'record': {'student_id': student_id, 'status': status}})


@app.route('/api/attendance', methods=['GET'])
def list_attendance():
    return jsonify({'records': attendance.read_attendance_records()})


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'message': 'Backend is ready.'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
