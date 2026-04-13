import { CheckCircle2, GraduationCap, LayoutDashboard, Settings2, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import api from '../lib/api'
import { DashboardLayout } from '../components/DashboardLayout'
import { useTheme } from '../context/ThemeContext'

const sidebar = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/teachers', label: 'Teacher Control', icon: Users },
  { to: '/admin/students', label: 'Student Control', icon: GraduationCap },
  { to: '/admin/configuration', label: 'Configuration', icon: Settings2 },
]

const defaultConfig = {
  studentAttendanceWindow: { start: '09:00', end: '17:00' },
  teacherAttendanceWindow: { start: '09:00', end: '17:00' },
  geoFence: {
    name: 'Dexter Global School, Mandsaur',
    latitude: 24.069724,
    longitude: 75.077568,
    radiusMeters: 200,
  },
}

export function AdminDashboard() {
  const location = useLocation()
  const { alertsEnabled } = useTheme()
  const [overview, setOverview] = useState(null)
  const [teacherSummary, setTeacherSummary] = useState(null)
  const [students, setStudents] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [config, setConfig] = useState(defaultConfig)
  const [creatingTeacher, setCreatingTeacher] = useState(false)
  const [creatingStudent, setCreatingStudent] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [correctingId, setCorrectingId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [teacherForm, setTeacherForm] = useState({
    name: '',
    email: '',
    password: '',
    department: 'General',
  })
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    password: '',
    department: 'General',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
  })

  useEffect(() => {
    loadOverview()
    loadStudents()
    loadConfig()
  }, [])

  useEffect(() => {
    loadTeacherSummary()
  }, [selectedDate, selectedTeacher])

  async function loadOverview() {
    try {
      const { data } = await api.get('/api/admin/overview')
      setOverview(data)
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to load admin overview')
    }
  }

  async function loadTeacherSummary() {
    try {
      const { data } = await api.get('/api/admin/teacher-attendance', {
        params: {
          date: selectedDate,
          teacherId: selectedTeacher || undefined,
        },
      })
      setTeacherSummary(data)
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to load teacher attendance')
    }
  }

  async function loadStudents() {
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        api.get('/api/students'),
        api.get('/api/attendance'),
      ])
      setStudents(studentsRes.data.students || [])
      setAttendanceRecords(attendanceRes.data.records || [])
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to load student control data')
    }
  }

  async function loadConfig() {
    try {
      const { data } = await api.get('/api/admin/config')
      setConfig(data.config || defaultConfig)
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to load system configuration')
    }
  }

  async function createTeacher(event) {
    event.preventDefault()
    try {
      setCreatingTeacher(true)
      const { data } = await api.post('/api/admin/teachers', teacherForm)
      if (alertsEnabled) toast.success(data.message || 'Teacher account created successfully.')
      setTeacherForm({ name: '', email: '', password: '', department: 'General' })
      await Promise.all([loadOverview(), loadTeacherSummary()])
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to create teacher account')
    } finally {
      setCreatingTeacher(false)
    }
  }

  async function createStudent(event) {
    event.preventDefault()
    try {
      setCreatingStudent(true)
      const { data } = await api.post('/api/students', { ...studentForm, faceImages: [] })
      if (alertsEnabled) toast.success(data.message || 'Student account created successfully.')
      setStudentForm({
        name: '',
        email: '',
        password: '',
        department: 'General',
        parentName: '',
        parentEmail: '',
        parentPhone: '',
      })
      await Promise.all([loadStudents(), loadOverview()])
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to create student account')
    } finally {
      setCreatingStudent(false)
    }
  }

  async function deleteStudent(id) {
    try {
      await api.delete(`/api/students/${id}`)
      if (alertsEnabled) toast.success('Student deleted successfully.')
      await Promise.all([loadStudents(), loadOverview()])
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to delete student')
    }
  }

  async function correctStudentAttendance(recordId) {
    try {
      setCorrectingId(recordId)
      const { data } = await api.post(`/api/attendance/${recordId}/override-present`, {
        note: 'Admin corrected a wrongly marked absent record.',
      })
      if (alertsEnabled) toast.success(data.message)
      await Promise.all([loadStudents(), loadOverview()])
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to correct student attendance')
    } finally {
      setCorrectingId('')
    }
  }

  async function correctTeacherAttendance(teacherId, date) {
    try {
      setCorrectingId(`${teacherId}:${date}`)
      const { data } = await api.post('/api/admin/teacher-attendance/override-present', {
        teacherId,
        date,
        note: 'Admin corrected a wrongly marked absent teacher record.',
      })
      if (alertsEnabled) toast.success(data.message)
      await Promise.all([loadTeacherSummary(), loadOverview()])
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to correct teacher attendance')
    } finally {
      setCorrectingId('')
    }
  }

  async function saveConfig(event) {
    event.preventDefault()
    try {
      setSavingConfig(true)
      const { data } = await api.put('/api/admin/config', config)
      setConfig(data.config || defaultConfig)
      if (alertsEnabled) toast.success(data.message || 'System configuration updated successfully.')
    } catch (error) {
      if (alertsEnabled) toast.error(error.response?.data?.message || 'Unable to update system configuration')
    } finally {
      setSavingConfig(false)
    }
  }

  const currentPage = location.pathname.includes('/teachers')
    ? 'teachers'
    : location.pathname.includes('/students')
      ? 'students'
      : location.pathname.includes('/configuration')
        ? 'configuration'
        : 'dashboard'

  const pageMeta = {
    dashboard: {
      title: 'Admin Control Center',
      subtitle: 'Monitor teachers, students, alerts, and attendance corrections from one institution-wide workspace.',
    },
    teachers: {
      title: 'Teacher Control',
      subtitle: 'Create teacher accounts, review teacher attendance, and correct wrongly marked absences.',
    },
    students: {
      title: 'Student Control',
      subtitle: 'Create and manage student accounts, review absent records, and correct student attendance when needed.',
    },
    configuration: {
      title: 'System Configuration',
      subtitle: 'Control attendance windows and geo-fence settings for the full platform.',
    },
  }

  const chartData = [
    { name: 'Present', value: teacherSummary?.stats?.presentToday || 0 },
    { name: 'Late', value: teacherSummary?.stats?.lateToday || 0 },
    { name: 'Absent', value: teacherSummary?.stats?.absentToday || 0 },
  ]

  const absentStudentRecords = useMemo(
    () => attendanceRecords.filter((record) => record.status === 'absent').slice(0, 10),
    [attendanceRecords],
  )

  return (
    <DashboardLayout sidebar={sidebar} title={pageMeta[currentPage].title} subtitle={pageMeta[currentPage].subtitle}>
      {currentPage === 'dashboard' ? (
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-5">
            {[
              ['Total teachers', overview?.stats?.totalTeachers || 0],
              ['Total students', overview?.stats?.totalStudents || 0],
              ['Present today', overview?.stats?.presentToday || 0],
              ['Absent today', overview?.stats?.absentToday || 0],
              ['Late %', `${overview?.stats?.latePercentage || 0}%`],
            ].map(([label, value]) => (
              <div key={label} className="card-panel p-5">
                <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-3 text-3xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="card-panel h-80 p-5">
              <p className="text-lg font-semibold">Teacher attendance overview</p>
              <div className="mt-5 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-panel p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-cyan-500" size={18} />
                <p className="text-lg font-semibold">Admin alerts</p>
              </div>
              <div className="mt-4 space-y-3">
                {(overview?.alerts || []).map((alert) => (
                  <div key={alert} className="rounded-[1.25rem] border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-500">
                    {alert}
                  </div>
                ))}
                {!overview?.alerts?.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No admin alerts for today.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'teachers' ? (
        <div className="grid gap-6">
          <form onSubmit={createTeacher} className="card-panel p-5">
            <p className="text-lg font-semibold">Create teacher account</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Only the admin can create teacher accounts from here. Self-signup is disabled.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input className="field" placeholder="Teacher name" value={teacherForm.name} onChange={(event) => setTeacherForm((current) => ({ ...current, name: event.target.value }))} required />
              <input className="field" placeholder="Teacher email" type="email" value={teacherForm.email} onChange={(event) => setTeacherForm((current) => ({ ...current, email: event.target.value }))} required />
              <input className="field" placeholder="Temporary password" type="password" value={teacherForm.password} onChange={(event) => setTeacherForm((current) => ({ ...current, password: event.target.value }))} required />
              <input className="field" placeholder="Department" value={teacherForm.department} onChange={(event) => setTeacherForm((current) => ({ ...current, department: event.target.value }))} />
            </div>
            <div className="mt-4">
              <button className="action-primary" disabled={creatingTeacher}>{creatingTeacher ? 'Creating teacher...' : 'Add teacher account'}</button>
            </div>
          </form>

          <div className="card-panel p-5">
            <div className="flex flex-wrap items-center gap-3">
              <input type="date" className="field px-4 py-3" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              <select className="field px-4 py-3" value={selectedTeacher} onChange={(event) => setSelectedTeacher(event.target.value)}>
                <option value="">All teachers</option>
                {(teacherSummary?.teachers || []).map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left">Teacher</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-left">Remark</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(teacherSummary?.presentRecords || []).map((record) => (
                    <tr key={record.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-4 py-3">
                        <p className="font-medium">{record.teacher?.name || record.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{record.teacher?.email}</p>
                      </td>
                      <td className="px-4 py-3">Present</td>
                      <td className="px-4 py-3">{record.time}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs ${record.late ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>{record.remark}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">Already present</td>
                    </tr>
                  ))}
                  {(teacherSummary?.absentTeachers || []).map((teacher) => (
                    <tr key={`absent-${teacher.teacherId || teacher.id}`} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-4 py-3">
                        <p className="font-medium">{teacher.teacher?.name || teacher.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{teacher.teacher?.email || teacher.email}</p>
                      </td>
                      <td className="px-4 py-3">Absent</td>
                      <td className="px-4 py-3">{teacher.time || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-500">{teacher.remark || 'Absent'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="action-secondary"
                          onClick={() => correctTeacherAttendance(teacher.teacherId || teacher.id, teacher.date || selectedDate)}
                          disabled={correctingId === `${teacher.teacherId || teacher.id}:${teacher.date || selectedDate}`}
                        >
                          {correctingId === `${teacher.teacherId || teacher.id}:${teacher.date || selectedDate}` ? 'Correcting...' : 'Mark Present'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'students' ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <form onSubmit={createStudent} className="card-panel p-5">
              <p className="text-lg font-semibold">Create student account</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Admin can create student accounts directly from this panel.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input className="field" placeholder="Student name" value={studentForm.name} onChange={(event) => setStudentForm((current) => ({ ...current, name: event.target.value }))} required />
                <input className="field" placeholder="Student email" type="email" value={studentForm.email} onChange={(event) => setStudentForm((current) => ({ ...current, email: event.target.value }))} required />
                <input className="field" placeholder="Temporary password" type="password" value={studentForm.password} onChange={(event) => setStudentForm((current) => ({ ...current, password: event.target.value }))} required />
                <input className="field" placeholder="Department" value={studentForm.department} onChange={(event) => setStudentForm((current) => ({ ...current, department: event.target.value }))} />
                <input className="field" placeholder="Parent name" value={studentForm.parentName} onChange={(event) => setStudentForm((current) => ({ ...current, parentName: event.target.value }))} />
                <input className="field" placeholder="Parent email" type="email" value={studentForm.parentEmail} onChange={(event) => setStudentForm((current) => ({ ...current, parentEmail: event.target.value }))} />
                <input className="field md:col-span-2" placeholder="Parent phone" value={studentForm.parentPhone} onChange={(event) => setStudentForm((current) => ({ ...current, parentPhone: event.target.value }))} />
              </div>
              <div className="mt-4">
                <button className="action-primary" disabled={creatingStudent}>{creatingStudent ? 'Creating student...' : 'Add student account'}</button>
              </div>
            </form>

            <div className="card-panel p-5">
              <p className="text-lg font-semibold">Student list</p>
              <div className="mt-4 space-y-3">
                {students.map((student) => (
                  <div key={student.id} className="flex flex-col gap-3 rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{student.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{student.email} · {student.department}</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Attendance: {student.attendancePercentage}%</p>
                    </div>
                    <button onClick={() => deleteStudent(student.id)} className="inline-flex items-center gap-2 text-rose-500">
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card-panel p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold">Student absent correction</p>
              <span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-500">{absentStudentRecords.length} absent records</span>
            </div>
            <div className="mt-4 space-y-3">
              {absentStudentRecords.map((record) => (
                <div key={record.id} className="rounded-[1.25rem] border border-slate-200 p-4 dark:border-slate-800">
                  <p className="font-medium">{record.student?.name || 'Unknown student'}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.date} at {record.time} · {record.absentReason || 'Absent record'}</p>
                  <button
                    onClick={() => correctStudentAttendance(record.id)}
                    className="action-secondary mt-3"
                    disabled={correctingId === record.id}
                  >
                    {correctingId === record.id ? 'Correcting...' : 'Mark Present'}
                  </button>
                </div>
              ))}
              {!absentStudentRecords.length ? <p className="text-sm text-slate-500 dark:text-slate-400">No absent student records are waiting for correction.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {currentPage === 'configuration' ? (
        <form onSubmit={saveConfig} className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="card-panel p-5">
            <p className="text-lg font-semibold">Attendance windows</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Student start time</span>
                <input type="time" className="field" value={config.studentAttendanceWindow?.start || '09:00'} onChange={(event) => setConfig((current) => ({ ...current, studentAttendanceWindow: { ...current.studentAttendanceWindow, start: event.target.value } }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Student end time</span>
                <input type="time" className="field" value={config.studentAttendanceWindow?.end || '17:00'} onChange={(event) => setConfig((current) => ({ ...current, studentAttendanceWindow: { ...current.studentAttendanceWindow, end: event.target.value } }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Teacher start time</span>
                <input type="time" className="field" value={config.teacherAttendanceWindow?.start || '09:00'} onChange={(event) => setConfig((current) => ({ ...current, teacherAttendanceWindow: { ...current.teacherAttendanceWindow, start: event.target.value } }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Teacher end time</span>
                <input type="time" className="field" value={config.teacherAttendanceWindow?.end || '17:00'} onChange={(event) => setConfig((current) => ({ ...current, teacherAttendanceWindow: { ...current.teacherAttendanceWindow, end: event.target.value } }))} />
              </label>
            </div>
          </div>

          <div className="card-panel p-5">
            <p className="text-lg font-semibold">Geo-fence</p>
            <div className="mt-4 grid gap-4">
              <input className="field" placeholder="Campus name" value={config.geoFence?.name || ''} onChange={(event) => setConfig((current) => ({ ...current, geoFence: { ...current.geoFence, name: event.target.value } }))} />
              <div className="grid gap-4 md:grid-cols-2">
                <input className="field" placeholder="Latitude" type="number" step="0.000001" value={config.geoFence?.latitude ?? ''} onChange={(event) => setConfig((current) => ({ ...current, geoFence: { ...current.geoFence, latitude: Number(event.target.value) } }))} />
                <input className="field" placeholder="Longitude" type="number" step="0.000001" value={config.geoFence?.longitude ?? ''} onChange={(event) => setConfig((current) => ({ ...current, geoFence: { ...current.geoFence, longitude: Number(event.target.value) } }))} />
              </div>
              <input className="field" placeholder="Radius meters" type="number" value={config.geoFence?.radiusMeters ?? 200} onChange={(event) => setConfig((current) => ({ ...current, geoFence: { ...current.geoFence, radiusMeters: Number(event.target.value) } }))} />
            </div>
            <div className="mt-5 rounded-[1.25rem] bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              This configuration is live. Student attendance windows, teacher attendance windows, and campus geo-fence all use these saved values.
            </div>
            <div className="mt-4">
              <button className="action-primary" disabled={savingConfig}>
                {savingConfig ? 'Saving configuration...' : 'Save configuration'}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </DashboardLayout>
  )
}
