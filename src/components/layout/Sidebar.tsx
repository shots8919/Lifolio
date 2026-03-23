import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import NekoIcon from '@/components/ui/NekoIcon'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const logout = useAuthStore(s => s.logout)
  const [accountOpen, setAccountOpen] = useState(true)
  const [mealOpen, setMealOpen] = useState(true)

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
        : 'text-[var(--nav-muted)] hover:text-white hover:bg-white/5'
    }`

  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
      isActive
        ? 'text-white font-medium bg-white/10'
        : 'text-[var(--nav-muted)] hover:text-white hover:bg-white/5'
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
          <NekoIcon size={18} />
        </div>
        <span className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--nav-txt)' }}>
          Lifo<span style={{ color: 'var(--accent)' }}>lio</span>
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
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors text-[var(--nav-muted)] hover:text-white hover:bg-white/5"
            onClick={() => setAccountOpen(o => !o)}
          >
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                {/* 財布本体 */}
                <rect x="1.5" y="4.5" width="13" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M1.5 7.5h13" stroke="currentColor" strokeWidth="1.4" />
                {/* コインポケット */}
                <rect x="9.5" y="9" width="3.5" height="3" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="11.25" cy="10.5" r="0.7" fill="currentColor" />
                {/* ストラップ */}
                <path d="M4.5 4.5V3.5A2 2 0 0 1 6.5 1.5h3A2 2 0 0 1 11.5 3.5V4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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

        {/* 献立管理 */}
        <div>
          <button
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors text-[var(--nav-muted)] hover:text-white hover:bg-white/5"
            onClick={() => setMealOpen(o => !o)}
          >
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                {/* カレンダー */}
                <rect x="1.5" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M1.5 6h10" stroke="currentColor" strokeWidth="1.4" />
                <path d="M4.5 1.5v2M8.5 1.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="4.5" cy="8.5" r="0.8" fill="currentColor" />
                <circle cx="7" cy="8.5" r="0.8" fill="currentColor" />
                <circle cx="4.5" cy="11" r="0.8" fill="currentColor" />
                {/* フォーク */}
                <path d="M14 3v3M12.5 3v2a1.5 1.5 0 0 0 3 0V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M14 6v7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              献立管理
            </span>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={`transition-transform duration-200 ${mealOpen ? 'rotate-180' : ''}`}
            >
              <path d="M3.5 5l3.5 4 3.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>

          {mealOpen && (
            <div
              className="ml-5 mt-0.5 border-l pl-3 space-y-0.5 pb-1"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <NavLink to="/meal/plan" className={subLinkClass} onClick={onClose}>
                献立計画
              </NavLink>
              <NavLink to="/meal/recipes" className={subLinkClass} onClick={onClose}>
                レシピ
              </NavLink>
              <NavLink to="/meal/preferences" className={subLinkClass} onClick={onClose}>
                好み設定
              </NavLink>
            </div>
          )}
        </div>
      </nav>

      {/* 設定 + ログアウト */}
      <div className="p-3 flex-shrink-0 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <NavLink
          to="/settings"
          className={linkClass}
          onClick={onClose}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6.96 4.14 L7.04 2.58 L8.96 2.58 L9.04 4.14 L10 4.54 L10.83 5.17 L12.21 4.46 L13.17 6.12 L11.86 6.96 L12 8 L11.86 9.04 L13.17 9.88 L12.21 11.54 L10.83 10.83 L10 11.46 L9.04 11.86 L8.96 13.42 L7.04 13.42 L6.96 11.86 L6 11.46 L5.17 10.83 L3.79 11.54 L2.83 9.88 L4.14 9.04 L4 8 L4.14 6.96 L2.83 6.12 L3.79 4.46 L5.17 5.17 L6 4.54 Z"
              stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          設定
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors text-[var(--nav-muted)] hover:text-white hover:bg-white/5"
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

