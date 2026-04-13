import { useState } from 'react'
import { MOCK_ATTENDANCE, MOCK_STUDENTS, DEPARTMENTS } from '../data/mockData'
import { FileDown, FileText, Table2, Filter, Calendar, Loader2, CheckCircle2 } from 'lucide-react'

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('2025-04-01')
  const [dateTo, setDateTo]     = useState('2025-04-04')
  const [dept, setDept]         = useState('')
  const [format, setFormat]     = useState('pdf')
  const [exporting, setExporting] = useState(false)
  const [done, setDone]           = useState(false)

  const handleExport = async () => {
    setExporting(true)
    setDone(false)
    await new Promise(r => setTimeout(r, 1800))

    if (format === 'excel') {
      // Build CSV
      const rows = [['Roll No','Name','Department','Date','Entry','Exit','Status']]
      MOCK_ATTENDANCE.forEach(r => rows.push([r.rollNo, r.studentName, r.department, r.date, r.entryTime||'', r.exitTime||'', r.status]))
      const csv = rows.map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = 'attendance_report.csv'; a.click()
      URL.revokeObjectURL(url)
    } else {
      // Simple HTML-based print PDF
      const rows = MOCK_ATTENDANCE.map(r =>
        `<tr><td>${r.rollNo}</td><td>${r.studentName}</td><td>${r.department}</td><td>${r.date}</td><td>${r.entryTime||'—'}</td><td>${r.exitTime||'—'}</td><td>${r.status}</td></tr>`
      ).join('')
      const html = `<!DOCTYPE html><html><head><title>Attendance Report</title>
      <style>body{font-family:sans-serif;padding:24px}h2{margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px 10px;text-align:left}th{background:#f0f4f8;font-weight:600}</style></head>
      <body><h2>Attendance Report — ${dateFrom} to ${dateTo}</h2>
      <table><thead><tr><th>Roll No</th><th>Name</th><th>Department</th><th>Date</th><th>Entry</th><th>Exit</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`
      const win = window.open('', '_blank')
      win.document.write(html)
      win.document.close()
      win.print()
    }

    setExporting(false)
    setDone(true)
    setTimeout(() => setDone(false), 3000)
  }

  const stats = {
    total:   MOCK_ATTENDANCE.length,
    present: MOCK_ATTENDANCE.filter(r=>r.status==='present').length,
    absent:  MOCK_ATTENDANCE.filter(r=>r.status==='absent').length,
    late:    MOCK_ATTENDANCE.filter(r=>r.status==='late').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Reports</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">Generate and download attendance reports</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Export configuration */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white flex items-center gap-2">
              <Filter size={15} /> Report Filters
            </h3>

            <div>
              <label className="text-xs font-medium text-surface-500 block mb-1.5">Date From</label>
              <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500 block mb-1.5">Date To</label>
              <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500 block mb-1.5">Department</label>
              <select className="input" value={dept} onChange={e => setDept(e.target.value)}>
                <option value="">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-surface-500 block mb-2">Export Format</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'pdf',   icon: FileText,  label: 'PDF' },
                  { val: 'excel', icon: Table2,    label: 'Excel/CSV' },
                ].map(f => (
                  <button key={f.val} onClick={() => setFormat(f.val)}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      format === f.val
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                        : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300'
                    }`}>
                    <f.icon size={15} /> {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleExport} disabled={exporting}
              className="btn-primary w-full flex items-center justify-center gap-2 h-11">
              {exporting ? <><Loader2 size={16} className="animate-spin" /> Generating...</>
               : done    ? <><CheckCircle2 size={16} /> Downloaded!</>
               : <><FileDown size={16} /> Export Report</>}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: stats.total,   color: 'text-surface-900 dark:text-white' },
              { label: 'Present', value: stats.present, color: 'text-emerald-600' },
              { label: 'Absent',  value: stats.absent,  color: 'text-red-500' },
              { label: 'Late',    value: stats.late,    color: 'text-amber-500' },
            ].map(s => (
              <div key={s.label} className="card p-3 text-center">
                <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-surface-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Table preview */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Preview</h3>
              <span className="text-xs text-surface-400">{MOCK_ATTENDANCE.length} records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800/50 border-b border-surface-100 dark:border-surface-700/50">
                    {['Roll No','Name','Date','Entry','Exit','Status'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-surface-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                  {MOCK_ATTENDANCE.map(r => (
                    <tr key={r.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                      <td className="px-4 py-2.5 font-mono text-xs text-surface-500">{r.rollNo}</td>
                      <td className="px-4 py-2.5 font-medium text-surface-900 dark:text-white">{r.studentName}</td>
                      <td className="px-4 py-2.5 text-surface-500">{r.date}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-surface-600 dark:text-surface-300">{r.entryTime || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-surface-600 dark:text-surface-300">{r.exitTime || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={
                          r.status === 'present' ? 'badge-green' :
                          r.status === 'absent'  ? 'badge-red'   :
                          r.status === 'late'    ? 'badge-yellow' : 'badge-blue'
                        }>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
