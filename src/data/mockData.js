export const MOCK_USERS = [
  { id: 'u1', name: 'Rahul Sharma', email: 'admin@mit.edu', role: 'admin', avatar: 'RS', department: 'Administration' },
  { id: 'u2', name: 'Priya Verma', email: 'teacher@mit.edu', role: 'teacher', avatar: 'PV', department: 'Computer Science' },
  { id: 'u3', name: 'Arjun Patel', email: 'student@mit.edu', role: 'student', avatar: 'AP', department: 'B.Tech CSE', rollNo: 'CS21001' },
]

export const MOCK_STUDENTS = [
  { id: 's1', name: 'Arjun Patel',    rollNo: 'CS21001', department: 'B.Tech CSE', semester: '6th', email: 'arjun@mit.edu',   phone: '9876543210', faceRegistered: true,  avatar: 'AP', attendancePercent: 92 },
  { id: 's2', name: 'Sneha Gupta',    rollNo: 'CS21002', department: 'B.Tech CSE', semester: '6th', email: 'sneha@mit.edu',   phone: '9876543211', faceRegistered: true,  avatar: 'SG', attendancePercent: 87 },
  { id: 's3', name: 'Rohit Kumar',    rollNo: 'CS21003', department: 'B.Tech CSE', semester: '6th', email: 'rohit@mit.edu',   phone: '9876543212', faceRegistered: true,  avatar: 'RK', attendancePercent: 74 },
  { id: 's4', name: 'Ananya Singh',   rollNo: 'CS21004', department: 'B.Tech CSE', semester: '6th', email: 'ananya@mit.edu',  phone: '9876543213', faceRegistered: false, avatar: 'AS', attendancePercent: 95 },
  { id: 's5', name: 'Vikram Yadav',   rollNo: 'CS21005', department: 'B.Tech CSE', semester: '6th', email: 'vikram@mit.edu',  phone: '9876543214', faceRegistered: true,  avatar: 'VY', attendancePercent: 68 },
  { id: 's6', name: 'Pooja Mishra',   rollNo: 'CS21006', department: 'B.Tech CSE', semester: '6th', email: 'pooja@mit.edu',   phone: '9876543215', faceRegistered: true,  avatar: 'PM', attendancePercent: 81 },
  { id: 's7', name: 'Amit Joshi',     rollNo: 'CS21007', department: 'B.Tech CSE', semester: '6th', email: 'amit@mit.edu',    phone: '9876543216', faceRegistered: false, avatar: 'AJ', attendancePercent: 89 },
  { id: 's8', name: 'Divya Chauhan',  rollNo: 'CS21008', department: 'B.Tech CSE', semester: '6th', email: 'divya@mit.edu',   phone: '9876543217', faceRegistered: true,  avatar: 'DC', attendancePercent: 93 },
]

export const MOCK_ATTENDANCE = [
  { id: 'a1', studentId: 's1', studentName: 'Arjun Patel',   rollNo: 'CS21001', date: '2025-04-04', entryTime: '09:02', exitTime: '17:00', status: 'present', method: 'face', department: 'B.Tech CSE' },
  { id: 'a2', studentId: 's2', studentName: 'Sneha Gupta',   rollNo: 'CS21002', date: '2025-04-04', entryTime: '09:15', exitTime: '17:00', status: 'late',    method: 'face', department: 'B.Tech CSE' },
  { id: 'a3', studentId: 's3', studentName: 'Rohit Kumar',   rollNo: 'CS21003', date: '2025-04-04', entryTime: null,    exitTime: null,    status: 'absent',  method: null,   department: 'B.Tech CSE' },
  { id: 'a4', studentId: 's4', studentName: 'Ananya Singh',  rollNo: 'CS21004', date: '2025-04-04', entryTime: '08:55', exitTime: '17:00', status: 'present', method: 'face', department: 'B.Tech CSE' },
  { id: 'a5', studentId: 's5', studentName: 'Vikram Yadav',  rollNo: 'CS21005', date: '2025-04-04', entryTime: null,    exitTime: null,    status: 'absent',  method: null,   department: 'B.Tech CSE' },
  { id: 'a6', studentId: 's6', studentName: 'Pooja Mishra',  rollNo: 'CS21006', date: '2025-04-04', entryTime: '09:01', exitTime: '13:00', status: 'half-day',method: 'face', department: 'B.Tech CSE' },
  { id: 'a7', studentId: 's7', studentName: 'Amit Joshi',    rollNo: 'CS21007', date: '2025-04-04', entryTime: '09:05', exitTime: '17:00', status: 'present', method: 'face', department: 'B.Tech CSE' },
  { id: 'a8', studentId: 's8', studentName: 'Divya Chauhan', rollNo: 'CS21008', date: '2025-04-04', entryTime: '08:58', exitTime: '17:00', status: 'present', method: 'face', department: 'B.Tech CSE' },
]

export const WEEKLY_STATS = [
  { day: 'Mon', present: 45, absent: 8, late: 3 },
  { day: 'Tue', present: 42, absent: 11, late: 3 },
  { day: 'Wed', present: 48, absent: 5, late: 3 },
  { day: 'Thu', present: 38, absent: 15, late: 3 },
  { day: 'Fri', present: 44, absent: 9, late: 3 },
  { day: 'Sat', present: 30, absent: 23, late: 3 },
]

export const MONTHLY_TREND = [
  { month: 'Jan', rate: 82 }, { month: 'Feb', rate: 85 }, { month: 'Mar', rate: 79 },
  { month: 'Apr', rate: 88 }, { month: 'May', rate: 91 }, { month: 'Jun', rate: 87 },
  { month: 'Jul', rate: 84 }, { month: 'Aug', rate: 86 }, { month: 'Sep', rate: 90 },
  { month: 'Oct', rate: 93 }, { month: 'Nov', rate: 89 }, { month: 'Dec', rate: 88 },
]

export const DEPARTMENTS = ['B.Tech CSE', 'B.Tech ECE', 'B.Tech ME', 'BCA', 'MBA']
export const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

export const AUDIT_LOGS = [
  { id: 'l1', action: 'Face Recognition', user: 'Arjun Patel',  time: '09:02 AM', ip: '192.168.1.10', status: 'success' },
  { id: 'l2', action: 'Face Recognition', user: 'Sneha Gupta',  time: '09:15 AM', ip: '192.168.1.11', status: 'late' },
  { id: 'l3', action: 'Login',            user: 'Priya Verma',  time: '08:45 AM', ip: '192.168.1.5',  status: 'success' },
  { id: 'l4', action: 'Export Report',    user: 'Rahul Sharma', time: '10:30 AM', ip: '192.168.1.2',  status: 'success' },
  { id: 'l5', action: 'Spoof Attempt',    user: 'Unknown',      time: '11:02 AM', ip: '192.168.1.99', status: 'blocked' },
]
