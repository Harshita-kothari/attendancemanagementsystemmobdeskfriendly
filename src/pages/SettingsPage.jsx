import { useState } from 'react'
import { Save, Bell, Shield, Clock, Camera, Mail } from 'lucide-react'

export default function SettingsPage() {
  const [lateThreshold, setLateThreshold] = useState('09:00')
  const [confidence, setConfidence]       = useState(75)
  const [emailAlerts, setEmailAlerts]     = useState(true)
  const [antiSpoof, setAntiSpoof]         = useState(true)
  const [halfDayHours, setHalfDayHours]   = useState(4)
  const [saved, setSaved]                 = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const Toggle = ({ value, onChange }) => (
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-brand-600' : 'bg-surface-200 dark:bg-surface-700'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Settings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">Configure system preferences and thresholds</p>
      </div>

      {[{
        icon: Camera, title: 'Face Recognition',
        rows: [
          { label: 'Confidence Threshold', sub: 'Minimum match confidence for auto-marking',
            control: <div className="flex items-center gap-3"><input type="range" min={50} max={99} value={confidence} onChange={e=>setConfidence(+e.target.value)} className="w-32" /><span className="text-sm font-mono text-brand-600 w-10">{confidence}%</span></div>
          },
          { label: 'Anti-Spoofing Detection', sub: 'Block photo/video spoof attempts',
            control: <Toggle value={antiSpoof} onChange={setAntiSpoof} />
          },
        ]
      }, {
        icon: Clock, title: 'Attendance Rules',
        rows: [
          { label: 'Late Arrival Threshold', sub: 'Mark as "Late" if entry is after this time',
            control: <input type="time" className="input w-32 text-sm" value={lateThreshold} onChange={e=>setLateThreshold(e.target.value)} />
          },
          { label: 'Half-Day Threshold (hours)', sub: 'Mark half-day if present less than N hours',
            control: <input type="number" min={1} max={8} className="input w-20 text-sm" value={halfDayHours} onChange={e=>setHalfDayHours(e.target.value)} />
          },
        ]
      }, {
        icon: Bell, title: 'Notifications',
        rows: [
          { label: 'Email Absence Alerts', sub: 'Send email when student is absent',
            control: <Toggle value={emailAlerts} onChange={setEmailAlerts} />
          },
        ]
      }].map(section => (
        <div key={section.title} className="card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-100 dark:border-surface-700/50">
            <section.icon size={16} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">{section.title}</h3>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-700/50">
            {section.rows.map(row => (
              <div key={row.label} className="flex items-center justify-between px-5 py-4 gap-6">
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-white">{row.label}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{row.sub}</p>
                </div>
                {row.control}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button onClick={handleSave} className="btn-primary flex items-center gap-2 text-sm px-6">
        <Save size={15} /> {saved ? 'Saved!' : 'Save Changes'}
      </button>
    </div>
  )
}
