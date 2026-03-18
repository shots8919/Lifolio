import { useNavigate } from 'react-router-dom'

const notices = [
  {
    id: 1,
    title: 'Lifolio へようこそ',
    body: '家庭管理システム Lifolio が起動しました。左メニューから各機能をご利用ください。',
    date: '2026-03-18',
  },
]

const features = [
  {
    id: 'account',
    title: '共有口座管理',
    description: '給料比率に基づいた振込額計算と月次データ照会',
    href: '/account/calculate',
    color: 'var(--shota)',
    colorBg: 'var(--shota-bg)',
    colorBd: 'var(--shota-bd)',
    ready: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="1.5" y="5" width="19" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1.5 9.5h19" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 14h3M14 14h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'meal',
    title: '献立管理',
    description: 'AI提案付きの週間献立計画・レシピ管理',
    href: '#',
    color: 'var(--miyu)',
    colorBg: 'var(--miyu-bg)',
    colorBd: 'var(--miyu-bd)',
    ready: false,
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M7 3v6a4 4 0 008 0V3M11 12v7M8 19h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export default function DashboardPage() {
  const navigate = useNavigate()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>ホーム</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>Lifolio ダッシュボード</p>
      </div>

      {/* お知らせ */}
      <section className="mb-6">
        <h2
          className="text-[11px] font-semibold mb-3 uppercase tracking-widest"
          style={{ color: 'var(--muted)' }}
        >
          お知らせ
        </h2>
        <div className="space-y-2">
          {notices.map(n => (
            <div
              key={n.id}
              className="rounded-xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: 'var(--shota)' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{n.title}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{n.date}</span>
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{n.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 機能カード */}
      <section>
        <h2
          className="text-[11px] font-semibold mb-3 uppercase tracking-widest"
          style={{ color: 'var(--muted)' }}
        >
          機能一覧
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map(f => (
            <div
              key={f.id}
              className="rounded-xl p-5 transition-all"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${f.ready ? f.colorBd : 'var(--border)'}`,
                opacity: f.ready ? 1 : 0.55,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: f.colorBg, color: f.color }}
                >
                  {f.icon}
                </div>
                {!f.ready && (
                  <span
                    className="text-[10px] font-semibold rounded px-2 py-1 flex-shrink-0"
                    style={{ background: 'var(--subtle)', color: 'var(--muted)' }}
                  >
                    準備中
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold mt-3" style={{ color: 'var(--text)' }}>{f.title}</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{f.description}</p>
              {f.ready && (
                <button
                  onClick={() => navigate(f.href)}
                  className="inline-flex items-center gap-1 text-xs font-medium mt-3 transition-opacity hover:opacity-70"
                  style={{ color: f.color }}
                >
                  開く
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6h7M7 3.5L9.5 6 7 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
