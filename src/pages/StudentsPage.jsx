import { useState } from 'react'
import { MOCK_STUDENTS, DEPARTMENTS, SEMESTERS } from '../data/mockData'
import { Search, Plus, Camera, Check, X, Filter, Download, Upload } from 'lucide-react'

function StudentModal({ student, onClose }) {
  const [tab, setTab] = useState('info')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-md border border-surface-200 dark:border-surface-700 animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100 dark:border-surface-700">
          <h3 className="font-semibold text-surface-900 dark:text-white">Student Details</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-100 dark:border-surface-700">
          {['info', 'face', 'attendance'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium capitalize transition-all ${tab===t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-surface-500 hover:text-surface-700'}`}>
              {t === 'face' ? 'Face ID' : t}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'info' && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 flex items-center justify-center text-2xl font-bold">{student.avatar}</div>
                <div>
                  <h4 className="font-semibold text-surface-900 dark:text-white text-lg">{student.name}</h4>
                  <p className="text-sm text-surface-500">{student.rollNo}</p>
                  <span className={student.faceRegistered ? 'badge-green' : 'badge-red'}>{student.faceRegistered ? 'Face Registered' : 'Face Pending'}</span>
                </div>
              </div>
              {[['Department', student.department], ['Semester', student.semester], ['Email', student.email], ['Phone', student.phone]].map(([k,v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-surface-100 dark:border-surface-800">
                  <span className="text-sm text-surface-500">{k}</span>
                  <span className="text-sm font-medium text-surface-900 dark:text-white">{v}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 'face' && (
            <div className="text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-surface-100 dark:bg-surface-800 mx-auto flex items-center justify-center">
                <Camera size={32} className="text-surface-400" />
              </div>
              {student.faceRegistered ? (
                <div>
                  <p className="text-sm font-medium text-emerald-600 flex items-center justify-center gap-2"><Check size={16} /> Face data registered</p>
                  <p className="text-xs text-surface-400 mt-1">Last updated: Dec 29, 2025</p>
                </div>
              ) : (
                <p className="text-sm text-surface-500">No face data registered</p>
              )}
              <button className="btn-primary w-full flex items-center justify-center gap-2 text-sm">
                <Camera size={16} /> {student.faceRegistered ? 'Re-register Face' : 'Register Face'}
              </button>
            </div>
          )}
          {tab === 'attendance' && (
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-brand-600 mb-1">{student.attendancePercent}%</div>
              <p className="text-sm text-surface-500">Overall Attendance</p>
              <div className="mt-4 h-3 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${student.attendancePercent}%` }} />
              </div>
              <p className="text-xs text-surface-400 mt-2">
                {student.attendancePercent >= 75 ? '✓ Above minimum required' : '⚠ Below 75% threshold'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StudentsPage() {
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('')
  const [faceFilter, setFaceFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const filtered = MOCK_STUDENTS.filter(s => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.rollNo.toLowerCase().includes(search.toLowerCase())) return false
    if (dept && s.department !== dept) return false
    if (faceFilter === 'registered' && !s.faceRegistered) return false
    if (faceFilter === 'pending' && s.faceRegistered) return false
    return true
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Students</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">{MOCK_STUDENTS.length} total · {MOCK_STUDENTS.filter(s=>s.faceRegistered).length} face registered</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost flex items-center gap-2 text-sm"><Upload size={15} /> Import</button>
          <button className="btn-primary flex items-center gap-2 text-sm"><Plus size={15} /> Add Student</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className="input pl-9" placeholder="Search name or roll no..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={dept} onChange={e => setDept(e.target.value)}>
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select className="input w-auto" value={faceFilter} onChange={e => setFaceFilter(e.target.value)}>
          <option value="">All</option>
          <option value="registered">Face Registered</option>
          <option value="pending">Face Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 dark:border-surface-700/50 bg-surface-50 dark:bg-surface-800/50">
                {['Student', 'Roll No', 'Department', 'Face ID', 'Attendance', 'Action'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 flex items-center justify-center text-xs font-semibold flex-shrink-0">{s.avatar}</div>
                      <span className="font-medium text-surface-900 dark:text-white">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-surface-500">{s.rollNo}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{s.department}</td>
                  <td className="px-4 py-3">
                    {s.faceRegistered
                      ? <span className="badge-green flex items-center gap-1 w-fit"><Check size={10} /> Registered</span>
                      : <span className="badge-red w-fit">Pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.attendancePercent}%`, background: s.attendancePercent >= 75 ? '#22c55e' : '#ef4444' }} />
                      </div>
                      <span className={`text-xs font-medium ${s.attendancePercent >= 75 ? 'text-emerald-600' : 'text-red-500'}`}>{s.attendancePercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => setSelected(s)} className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-surface-400">No students found</div>
          )}
        </div>
      </div>

      {selected && <StudentModal student={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
