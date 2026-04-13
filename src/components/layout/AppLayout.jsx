import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Menu, Bell, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700/50 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden btn-ghost p-2 -ml-1">
            <Menu size={18} />
          </button>

          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input className="input pl-9 py-2 text-sm h-9" placeholder="Search students, records..." />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button className="btn-ghost p-2 relative">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-surface-200 dark:border-surface-700">
              <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-400 flex items-center justify-center text-xs font-semibold">
                {user?.avatar}
              </div>
              <span className="text-sm font-medium text-surface-700 dark:text-surface-300 hidden sm:block">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
