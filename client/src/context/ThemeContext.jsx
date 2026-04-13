import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('fa_theme') || 'dark')
  const [alertsEnabled, setAlertsEnabled] = useState(() => localStorage.getItem('fa_alerts') !== 'off')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('fa_theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('fa_alerts', alertsEnabled ? 'on' : 'off')
  }, [alertsEnabled])

  return <ThemeContext.Provider value={{ theme, setTheme, alertsEnabled, setAlertsEnabled }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
