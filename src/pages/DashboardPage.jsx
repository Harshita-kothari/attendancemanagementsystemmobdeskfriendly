import { useAuth } from '../context/AuthContext'
import { MOCK_ATTENDANCE, MOCK_STUDENTS, WEEKLY_STATS, MONTHLY_TREND } from '../data/mockData'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, UserCheck, UserX, Clock, TrendingUp, Camera, AlertTriangle, Award } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const today = MOCK_ATTENDANCE
const present = today.filter(a => a.status === 'present').length
const absent  = today.filter(a => a.status === 'absent').length
const late    = today.filter(a => a.status === 'late').length
const halfday = today.filter(a => a.status === 'half-day').length

const PIE_DATA = [
  { name: 'Present', value: present, color: '#22c55e' },
  { name: 'Absent',  value: absent,  color: '#ef4444' },
  { name: 'Late',    value: late,    color: '#f59e0b' },
  { name: 'Half',    value: halfday, color: '#3b82f6' },
]

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="stat-card animate-slide-up">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-surface-900 dark:text-white mt-3">{value}</p>
      <p className="text-sm text-surface-500 dark:text-surface-400">{label}</p>
      {sub && <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const topStudents = MOCK_STUDENTS.filter(s => s.attendancePercent >= 90).slice(0, 4)
  const lowStudents = MOCK_STUDENTS.filter(s => s.attendancePercent < 75)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">Friday, 4 April 2025 · B.Tech CSE — 6th Semester</p>
        </div>
        <button onClick={() => navigate('/attendance')} className="btn-primary flex items-center gap-2 text-sm">
          <Camera size={16} /> Start Attendance
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={UserCheck} label="Present Today" value={present} sub={`${Math.round(present/today.length*100)}% attendance`} color="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" />
        <StatCard icon={UserX}    label="Absent Today"  value={absent}  sub="Alert sent"   color="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" />
        <StatCard icon={Clock}    label="Late Arrivals" value={late}    sub="After 9:00 AM" color="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" />
        <StatCard icon={Users}    label="Total Students" value={MOCK_STUDENTS.length} sub="Registered" color="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Weekly bar */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Weekly Overview</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={WEEKLY_STATS} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-prose-hr, #e4e7f0)" strokeOpacity={0.5} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', fontSize: 12 }} />
              <Bar dataKey="present" fill="#3480f7" radius={[4,4,0,0]} name="Present" />
              <Bar dataKey="absent"  fill="#fca5a5" radius={[4,4,0,0]} name="Absent" />
              <Bar dataKey="late"    fill="#fcd34d" radius={[4,4,0,0]} name="Late" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Today's Distribution</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {PIE_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {PIE_DATA.map(d => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Monthly Attendance Rate (%)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={MONTHLY_TREND}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
            <Line type="monotone" dataKey="rate" stroke="#3480f7" strokeWidth={2.5} dot={{ r: 4, fill: '#3480f7' }} name="Rate %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top performers */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Top Performers</h3>
          </div>
          <div className="space-y-3">
            {topStudents.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-xs font-mono text-surface-400 w-4">{i+1}</span>
                <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">{s.avatar}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{s.name}</p>
                  <p className="text-xs text-surface-400">{s.rollNo}</p>
                </div>
                <span className="badge-green">{s.attendancePercent}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Low attendance alerts */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Low Attendance Alerts</h3>
          </div>
          {lowStudents.length === 0 ? (
            <p className="text-sm text-surface-400 dark:text-surface-500">All students above threshold</p>
          ) : (
            <div className="space-y-3">
              {lowStudents.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center text-xs font-semibold">{s.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-xs text-surface-400">{s.rollNo}</p>
                  </div>
                  <span className="badge-red">{s.attendancePercent}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
