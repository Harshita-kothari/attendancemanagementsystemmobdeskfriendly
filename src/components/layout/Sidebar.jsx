import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import {
  LayoutDashboard, Camera, Users, ClipboardList,
  BarChart3, FileDown, Shield, Bell, Settings,
  LogOut, Sun, Moon, Scan, X, Menu
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const NAV = {
  admin: [
    { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/attendance', icon: Camera,           label: 'Live Attendance' },
    { to: '/students',   icon: Users,            label: 'Students' },
    { to: '/records',    icon: ClipboardList,    label: 'Records' },
    { to: '/analytics',  icon: BarChart3,        label: 'Analytics' },
    { to: '/reports',    icon: FileDown,         label: 'Reports' },
    { to: '/audit',      icon: Shield,           label: 'Audit Logs' },
    { to: '/settings',   icon: Settings,         label: 'Settings' },
  ],
  teacher: [
    { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/attendance', icon: Camera,           label: 'Live Attendance' },
    { to: '/students',   icon: Users,            label: 'Students' },
    { to: '/records',    icon: ClipboardList,    label: 'Records' },
    { to: '/reports',    icon: FileDown,         label: 'Reports' },
  ],
  student: [
    { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/records',    icon: ClipboardList,    label: 'My Attendance' },
    { to: '/reports',    icon: FileDown,         label: 'My Reports' },
  ],
}

export default function Sidebar({ mobileOpen, onClose }) {
  const { user, logout } = useAuth()
  const { dark, toggle } = useTheme()
  const navigate = useNavigate()
  const links = NAV[user?.role] || []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-100 dark:border-surface-700/50">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-600/30">
          <Scan size={18} className="text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm text-surface-900 dark:text-white leading-none">FaceAttend</p>
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">Smart Attendance</p>
        </div>
        <button onClick={onClose} className="ml-auto lg:hidden btn-ghost p-1.5">
          <X size={16} />
        </button>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-b border-surface-100 dark:border-surface-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-400 flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {user?.avatar}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-surface-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-surface-100 dark:border-surface-700/50 space-y-0.5">
        <button onClick={toggle} className="sidebar-link w-full">
          {dark ? <Sun size={17} /> : <Moon size={17} />}
          <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
        <button onClick={handleLogout} className="sidebar-link w-full text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
          <LogOut size={17} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-60 h-screen sticky top-0 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700/50 flex-shrink-0">
        {content}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-surface-900 shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
