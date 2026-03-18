interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header
      className="h-14 flex items-center gap-3 px-4 lg:hidden flex-shrink-0"
      style={{ background: 'var(--nav-bg)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <button
        onClick={onMenuClick}
        className="w-8 h-8 flex items-center justify-center rounded-md transition-colors text-[#9ca3af] hover:text-white hover:bg-white/10"
        aria-label="メニューを開く"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <span className="text-[15px] font-bold tracking-tight" style={{ color: '#e8eaed' }}>
        Lifo<span style={{ color: '#60a5fa' }}>lio</span>
      </span>
    </header>
  )
}
