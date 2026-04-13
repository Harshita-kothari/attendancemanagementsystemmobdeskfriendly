import { motion } from 'framer-motion'
import { Bell, Clock3, LogOut, MoonStar, SunMedium } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function DashboardLayout({ sidebar, title, subtitle, children }) {
  const { logout, user } = useAuth()
  const { theme, setTheme, alertsEnabled, setAlertsEnabled } = useTheme()
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  function toggleAlerts() {
    const nextValue = !alertsEnabled
    setAlertsEnabled(nextValue)
    toast.success(nextValue ? 'Alerts enabled' : 'Alerts muted')
  }

  const stagger = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  }

  const rise = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
  }

  return (
    <div className="min-h-screen bg-app text-slate-900 dark:text-white">
      <div className="app-shell-glow" />
      <motion.div
        className="mx-auto flex max-w-7xl gap-6 px-4 py-6 lg:px-8"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.aside variants={rise} className="hidden w-72 shrink-0 rounded-[2rem] border border-white/10 bg-slate-950/75 p-5 text-white shadow-2xl shadow-slate-950/40 lg:block">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Face Attendance</p>
            <h1 className="mt-3 font-display text-3xl font-semibold">VisionOS</h1>
            <p className="mt-3 text-sm text-slate-300">Smart attendance, analytics, exports, and live face recognition.</p>
          </div>
          <div className="mt-8 space-y-2">
            {sidebar.map((item) => (
              <motion.div key={item.to} whileHover={{ x: 6 }} transition={{ duration: 0.18 }}>
                <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                    isActive ? 'bg-white text-slate-950 shadow-lg shadow-cyan-500/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                </NavLink>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Signed in as</p>
            <p className="mt-2 text-lg font-semibold">{user?.name}</p>
            <p className="text-sm text-slate-300">{user?.role}</p>
          </div>
        </motion.aside>

        <div className="flex-1">
          <motion.header variants={rise} className="glass-panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Operations dashboard</p>
              <h2 className="mt-2 text-3xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-950">
                <Clock3 size={16} />
                {time}
              </div>
              <button
                onClick={toggleAlerts}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <Bell size={16} />
                {alertsEnabled ? 'Alerts on' : 'Alerts off'}
              </button>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
              >
                {theme === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
                {theme === 'dark' ? 'Light' : 'Dark'}
              </button>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </motion.header>
          <motion.div variants={rise} className="mt-6">{children}</motion.div>
        </div>
      </motion.div>
    </div>
  )
}
