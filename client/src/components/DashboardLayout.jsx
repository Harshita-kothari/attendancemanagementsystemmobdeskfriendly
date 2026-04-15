import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Clock3, LogOut, Menu, MoonStar, SunMedium, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function DashboardLayout({ sidebar, title, subtitle, children }) {
  const { logout, user } = useAuth()
  const { theme, setTheme, alertsEnabled, setAlertsEnabled } = useTheme()
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
      <AnimatePresence>
        {mobileSidebarOpen ? (
          <motion.div
            className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-y-0 left-0 w-[86vw] max-w-xs overflow-y-auto border-r border-white/10 bg-slate-950/95 p-5 text-white shadow-2xl shadow-slate-950/50"
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -28, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Face Attendance</p>
                  <h1 className="mt-3 font-display text-3xl font-semibold">VisionOS</h1>
                  <p className="mt-3 text-sm text-slate-300">Smart attendance, analytics, exports, and live face recognition.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-2 text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-8 space-y-2">
                {sidebar.map((item) => (
                  <motion.div key={item.to} whileHover={{ x: 4 }} transition={{ duration: 0.18 }}>
                    <NavLink
                      to={item.to}
                      onClick={() => setMobileSidebarOpen(false)}
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
            </motion.div>
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 -z-10"
              onClick={() => setMobileSidebarOpen(false)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

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
          <motion.div variants={rise} className="mb-4 space-y-4 lg:hidden">
            <div className="glass-panel p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] uppercase tracking-[0.32em] text-slate-400">Face Attendance</p>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-200"
                >
                  <Menu size={16} />
                  Menu
                </button>
              </div>
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">VisionOS</h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Smart attendance, analytics, exports, and live recognition.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-right dark:border-slate-800 dark:bg-slate-950/80">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Signed in</p>
                  <p className="mt-1 text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role}</p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.header variants={rise} className="glass-panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Operations dashboard</p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
