import { AUDIT_LOGS } from '../data/mockData'
import { Shield, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react'

const STATUS_CFG = {
  success: { badge: 'badge-green',  icon: CheckCircle2,  label: 'Success' },
  late:    { badge: 'badge-yellow', icon: Clock,         label: 'Late'    },
  blocked: { badge: 'badge-red',    icon: XCircle,       label: 'Blocked' },
}

export default function AuditPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <Shield size={18} className="text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Audit Logs</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">System activity and security events</p>
        </div>
      </div>

      {/* Alert for spoof attempts */}
      <div className="card p-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">1 Spoofing Attempt Detected</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">Today at 11:02 AM from IP 192.168.1.99. Attempt was automatically blocked by anti-spoofing AI.</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-700/50">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Recent Activity</h3>
        </div>
        <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
          {AUDIT_LOGS.map(log => {
            const cfg = STATUS_CFG[log.status] || STATUS_CFG.success
            const Icon = cfg.icon
            return (
              <div key={log.id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/30 transition-colors">
                <Icon size={16} className={
                  log.status==='success'?'text-emerald-500':log.status==='blocked'?'text-red-500':'text-amber-500'
                } />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{log.action}</p>
                  <p className="text-xs text-surface-400">User: {log.user} · IP: {log.ip}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-mono text-surface-500">{log.time}</span>
                  <span className={cfg.badge}>{cfg.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
