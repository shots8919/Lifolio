import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const logout = useAuthStore(s => s.logout)
  const [accountOpen, setAccountOpen] = useState(true)

  const handleLogout = () => {
    if (window.confirm('ログアウトしますか？')) {
      logout()
      navigate('/login', { replace: true })
    }
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
      isActive
        ? 'bg-white/10 text-white font-medium'
        : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
    }`

  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
      isActive
        ? 'text-white font-medium bg-white/10'
        : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
    }`

  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-[220px] flex-shrink-0 flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{ background: 'var(--nav-bg)' }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-5 gap-3 flex-shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--shota)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 14l3-5 3 3 3-6 4 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--nav-txt)' }}>
          Lifo<span style={{ color: '#60a5fa' }}>lio</span>
        </span>
      </div>

      <div className="h-px flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {/* Home */}
        <NavLink to="/" end className={linkClass} onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 7.5L8 2l6 5.5V14a1 1 0 01-1 1h-3v-4H6v4H3a1 1 0 01-1-1V7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          ホーム
        </NavLink>

        {/* 共有口座管理 */}
        <div>
          <button
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors text-[#9ca3af] hover:text-white hover:bg-white/5"
            onClick={() => setAccountOpen(o => !o)}
          >
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="4" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.4" />
                <path d="M4.5 10.5h2M10.5 10.5h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              共有口座管理
            </span>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={`transition-transform duration-200 ${accountOpen ? 'rotate-180' : ''}`}
            >
              <path d="M3.5 5l3.5 4 3.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>

          {accountOpen && (
            <div
              className="ml-5 mt-0.5 border-l pl-3 space-y-0.5 pb-1"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <NavLink to="/account/calculate" className={subLinkClass} onClick={onClose}>
                振込額計算
              </NavLink>
              <NavLink to="/account/data" className={subLinkClass} onClick={onClose}>
                データ照会
              </NavLink>
            </div>
          )}
        </div>

        {/* 献立管理（準備中） */}
        <button
          disabled
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] opacity-40 cursor-not-allowed text-[#9ca3af]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 2v4a3 3 0 006 0V2M8 8v6M5 14h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          献立管理
          <span
            className="ml-auto text-[10px] rounded px-1.5 py-0.5"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
          >
            準備中
          </span>
        </button>
      </nav>

      {/* Logout */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors text-[#9ca3af] hover:text-white hover:bg-white/5"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10.5 11l3-3-3-3M13.5 8H6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6.5 13H3a1 1 0 01-1-1V4a1 1 0 011-1h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          ログアウト
        </button>
      </div>
    </aside>
  )
}
