import { useState } from 'react'
import { MOCK_ATTENDANCE } from '../data/mockData'
import { Filter, Download, Search, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'

const STATUS_CONFIG = {
  present:  { badge: 'badge-green',  icon: CheckCircle2, label: 'Present'  },
  absent:   { badge: 'badge-red',    icon: XCircle,      label: 'Absent'   },
  late:     { badge: 'badge-yellow', icon: Clock,        label: 'Late'     },
  'half-day':{ badge: 'badge-blue',  icon: AlertCircle,  label: 'Half Day' },
}

export default function RecordsPage() {
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [dateFilter, setDate] = useState('2025-04-04')

  const filtered = MOCK_ATTENDANCE.filter(r => {
    if (search && !r.studentName.toLowerCase().includes(search.toLowerCase()) && !r.rollNo.toLowerCase().includes(search.toLowerCase())) return false
    if (status && r.status !== status) return false
    if (dateFilter && r.date !== dateFilter) return false
    return true
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Attendance Records</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">{filtered.length} records found</p>
        </div>
        <button className="btn-ghost flex items-center gap-2 text-sm"><Download size={15} /> Export</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = filtered.filter(r => r.status === key).length
          const Icon = cfg.icon
          return (
            <button key={key} onClick={() => setStatus(s => s === key ? '' : key)}
              className={`card p-3 text-left transition-all hover:shadow-md ${status === key ? 'ring-2 ring-brand-500' : ''}`}>
              <Icon size={16} className={`mb-2 ${key==='present'?'text-emerald-500':key==='absent'?'text-red-500':key==='late'?'text-amber-500':'text-blue-500'}`} />
              <p className="text-xl font-semibold text-surface-900 dark:text-white">{count}</p>
              <p className="text-xs text-surface-500">{cfg.label}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input className="input pl-9" placeholder="Search student..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <input type="date" className="input w-auto" value={dateFilter} onChange={e => setDate(e.target.value)} />
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 dark:border-surface-700/50 bg-surface-50 dark:bg-surface-800/50">
                {['Student', 'Roll No', 'Date', 'Entry', 'Exit', 'Status', 'Method'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-surface-500 dark:text-surface-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
              {filtered.map(r => {
                const cfg = STATUS_CONFIG[r.status]
                return (
                  <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 flex items-center justify-center text-xs font-semibold">
                          {r.studentName.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <span className="font-medium text-surface-900 dark:text-white">{r.studentName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-surface-500">{r.rollNo}</td>
                    <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{r.date}</td>
                    <td className="px-4 py-3 font-mono text-xs text-surface-700 dark:text-surface-300">{r.entryTime || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-surface-700 dark:text-surface-300">{r.exitTime || '—'}</td>
                    <td className="px-4 py-3"><span className={cfg.badge}>{cfg.label}</span></td>
                    <td className="px-4 py-3 text-xs text-surface-500">{r.method ? '🤖 Face AI' : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12 text-surface-400">No records found</div>}
        </div>
      </div>
    </div>
  )
}
