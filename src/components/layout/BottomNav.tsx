import { useLocation, useNavigate } from 'react-router-dom'

// ─── アイコン ─────────────────────────────────────────────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12L12 4l9 8"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M5 10.5V20a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1V10.5"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0}
      />
    </svg>
  )
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="2" y="6" width="20" height="13" rx="2.5"
        stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
      />
      <path d="M2 10.5h20" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 15.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect
        x="14.5" y="13.5" width="5.5" height="3" rx="1"
        stroke="currentColor" strokeWidth="1.3"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.35 : 0}
      />
    </svg>
  )
}

function MealIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* フォーク */}
      <path d="M7 3v4M5 4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 7v14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      {/* ナイフ */}
      <path
        d="M17 3c0 0-3 2.5-3 6v12"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* 皿 */}
      <path
        d="M4 13.5a8 8 0 0016 0"
        stroke="currentColor" strokeWidth="1.7"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}
      />
    </svg>
  )
}

function ChoresIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* ほうき本体 */}
      <path d="M6 4l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* ほうき先 */}
      <path
        d="M18 16c0 0-2 1.5-4 1.5s-4 .5-4 2.5c0 1.5 2 2.5 5 2.5s5-1 5-3c0-1.5-1-3-2-3.5z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
      />
    </svg>
  )
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle
        cx="12" cy="12" r="3.5"
        stroke="currentColor" strokeWidth="1.8"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0}
      />
      <path
        d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M19.07 4.93l-1.77 1.77M6.7 17.3l-1.77 1.77"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      />
    </svg>
  )
}

// ─── ボトムナビゲーション ────────────────────────────────────────────────────

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const homeActive     = pathname === '/'
  const accountActive  = pathname.startsWith('/account')
  const mealActive     = pathname.startsWith('/meal')
  const settingsActive = pathname.startsWith('/settings')

  const itemBase =
    'flex-1 flex flex-col items-center justify-center gap-0.5 select-none transition-transform active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-[var(--shota)] focus-visible:ring-inset'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      aria-label="メインナビゲーション"
    >
      <div className="flex h-14">

        {/* ホーム */}
        <button
          onClick={() => navigate('/')}
          className={itemBase}
          style={{ color: homeActive ? 'var(--shota)' : 'var(--muted)' }}
          aria-label="ホーム"
          aria-current={homeActive ? 'page' : undefined}
        >
          <HomeIcon active={homeActive} />
          <span className="text-[10px] font-medium leading-none tracking-tight">ホーム</span>
        </button>

        {/* 共有口座 */}
        <button
          onClick={() => navigate('/account/calculate')}
          className={itemBase}
          style={{ color: accountActive ? 'var(--shota)' : 'var(--muted)' }}
          aria-label="共有口座管理"
          aria-current={accountActive ? 'page' : undefined}
        >
          <AccountIcon active={accountActive} />
          <span className="text-[10px] font-medium leading-none tracking-tight">共有口座</span>
        </button>

        {/* 献立 */}
        <button
          onClick={() => navigate('/meal/plan')}
          className={itemBase}
          style={{ color: mealActive ? 'var(--shota)' : 'var(--muted)' }}
          aria-label="献立管理"
          aria-current={mealActive ? 'page' : undefined}
        >
          <MealIcon active={mealActive} />
          <span className="text-[10px] font-medium leading-none tracking-tight">献立</span>
        </button>

        {/* 家事（準備中） */}
        <button
          disabled
          className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-not-allowed select-none"
          style={{ color: 'var(--border)' }}
          aria-label="家事管理（準備中）"
          aria-disabled="true"
        >
          <ChoresIcon />
          <span className="text-[10px] font-medium leading-none tracking-tight">家事</span>
          <span
            className="text-[8px] leading-none px-1.5 py-px rounded-full"
            style={{ background: 'var(--subtle)', color: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            準備中
          </span>
        </button>

        {/* 設定 */}
        <button
          onClick={() => navigate('/settings')}
          className={itemBase}
          style={{ color: settingsActive ? 'var(--shota)' : 'var(--muted)' }}
          aria-label="設定"
          aria-current={settingsActive ? 'page' : undefined}
        >
          <SettingsIcon active={settingsActive} />
          <span className="text-[10px] font-medium leading-none tracking-tight">設定</span>
        </button>

      </div>
    </nav>
  )
}
