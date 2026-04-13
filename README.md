# Face Recognition Attendance Management System

Production-style monorepo with:

- `client` -> React + Tailwind + Framer Motion
- `server` -> Node.js + Express + MongoDB + JWT
- `face-api` -> Python Flask + OpenCV based face recognition service

## Features

- Student and teacher signup/login with role-based access
- JWT authentication with bcrypt password hashing
- Multi-image face registration during student signup
- Live webcam attendance scan from teacher dashboard
- Student attendance history and percentage
- Teacher analytics, search, exports, and student management
- Theme toggle with localStorage persistence
- CSV export and PDF export from the dashboard
- GPS payload support for attendance scans
- English/Hindi preference field in onboarding

## Project Structure

```text
client/
server/
face-api/
```

## Setup

### 1. Client

```bash
cd client
npm install
copy .env.example .env
npm run dev
```

Default URL: `http://127.0.0.1:5173`

### 2. Server

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

Default URL: `http://127.0.0.1:4000`

Required:

- MongoDB running locally or a cloud URI in `MONGODB_URI`
- `FACE_API_URL` should point to the Flask face service

### 3. Face API

```bash
cd face-api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python app.py
```

Default URL: `http://127.0.0.1:5001`

## Main API Surface

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/students`
- `POST /api/students`
- `DELETE /api/students/:id`
- `GET /api/students/me/profile`
- `POST /api/attendance/scan`
- `GET /api/attendance`
- `GET /api/attendance/teacher-summary`
- `GET /api/attendance/export/csv`
- `POST /api/face-recognition/register`
- `POST /api/face-recognition/recognize`

## Notes

- Student signup expects at least 5 captured face samples for better matching.
- Face recognition quality depends on clean samples, lighting, and camera quality.
- This repo now contains the requested architecture, but you still need to install `client` and `server` dependencies and provide MongoDB to run everything end-to-end.
