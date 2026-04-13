import { WEEKLY_STATS, MONTHLY_TREND, MOCK_STUDENTS } from '../data/mockData'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Users, Award } from 'lucide-react'

const DEPT_DATA = [
  { dept: 'CSE', avg: 87, students: 56 },
  { dept: 'ECE', avg: 82, students: 48 },
  { dept: 'ME',  avg: 79, students: 42 },
  { dept: 'BCA', avg: 91, students: 35 },
  { dept: 'MBA', avg: 85, students: 28 },
]

const RADAR_DATA = [
  { subject: 'Mon', value: 88 }, { subject: 'Tue', value: 82 },
  { subject: 'Wed', value: 95 }, { subject: 'Thu', value: 76 },
  { subject: 'Fri', value: 89 }, { subject: 'Sat', value: 65 },
]

export default function AnalyticsPage() {
  const avg = Math.round(MONTHLY_TREND.reduce((s,m) => s + m.rate, 0) / MONTHLY_TREND.length)
  const best = MONTHLY_TREND.reduce((a,b) => a.rate > b.rate ? a : b)
  const worst = MONTHLY_TREND.reduce((a,b) => a.rate < b.rate ? a : b)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">Academic Year 2024–25 · All Departments</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Avg Attendance', value: `${avg}%`, icon: TrendingUp, color: 'text-brand-600', bg: 'bg-brand-50 dark:bg-brand-900/20' },
          { label: 'Best Month',     value: `${best.month} ${best.rate}%`, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: 'Lowest Month',   value: `${worst.month} ${worst.rate}%`, icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Total Students', value: MOCK_STUDENTS.length, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        ].map(k => (
          <div key={k.label} className="stat-card animate-slide-up">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.bg}`}>
              <k.icon size={18} className={k.color} />
            </div>
            <p className="text-2xl font-semibold text-surface-900 dark:text-white mt-3">{k.value}</p>
            <p className="text-sm text-surface-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Area chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Monthly Trend (Area)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={MONTHLY_TREND}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3480f7" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#3480f7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis domain={[60,100]} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
            <Area type="monotone" dataKey="rate" stroke="#3480f7" strokeWidth={2.5} fill="url(#grad)" name="Attendance %" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Department comparison */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Department-wise Attendance</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={DEPT_DATA} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} horizontal={false} />
              <XAxis type="number" domain={[60,100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="dept" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} />
              <Bar dataKey="avg" fill="#3480f7" radius={[0,6,6,0]} name="Avg %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day of week radar */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Day-wise Pattern</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={RADAR_DATA} cx="50%" cy="50%" outerRadius={70}>
              <PolarGrid stroke="#e4e7f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Radar dataKey="value" stroke="#3480f7" fill="#3480f7" fillOpacity={0.15} strokeWidth={2} />
              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly stacked bar */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Weekly Stacked Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={WEEKLY_STATS} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.4} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="present" stackId="a" fill="#3480f7" radius={[0,0,0,0]} name="Present" />
            <Bar dataKey="late"    stackId="a" fill="#fbbf24" name="Late" />
            <Bar dataKey="absent"  stackId="a" fill="#fca5a5" radius={[4,4,0,0]} name="Absent" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Attendance distribution */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-4">Student Attendance Distribution</h3>
        <div className="grid grid-cols-4 gap-3">
          {[['≥ 90%', MOCK_STUDENTS.filter(s=>s.attendancePercent>=90).length, '#22c55e'],
            ['75–89%', MOCK_STUDENTS.filter(s=>s.attendancePercent>=75 && s.attendancePercent<90).length, '#3480f7'],
            ['60–74%', MOCK_STUDENTS.filter(s=>s.attendancePercent>=60 && s.attendancePercent<75).length, '#f59e0b'],
            ['< 60%',  MOCK_STUDENTS.filter(s=>s.attendancePercent<60).length, '#ef4444'],
          ].map(([label, count, color]) => (
            <div key={label} className="card p-4 text-center">
              <div className="text-2xl font-semibold" style={{ color }}>{count}</div>
              <div className="text-xs text-surface-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
