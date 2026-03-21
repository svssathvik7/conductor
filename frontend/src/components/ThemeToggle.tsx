import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme')
      if (stored) return stored === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <button
      onClick={() => setDark(d => !d)}
      className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none"
      style={{ backgroundColor: dark ? 'var(--accent)' : 'var(--border)' }}
      aria-label="Toggle theme"
    >
      <span
        className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center text-xs transition-transform duration-300"
        style={{ transform: dark ? 'translateX(28px)' : 'translateX(0)' }}
      >
        {dark ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
      </span>
    </button>
  )
}
