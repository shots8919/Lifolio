import { useNavigate } from 'react-router-dom'

const notices = [
  {
    id: 1,
    title: '🎉 Lifolio v1.0.0 リリース',
    body: '家庭管理システム Lifolio の初回リリースです。まずは共有口座管理からご利用ください。',
    date: '2026-03-18',
    tag: 'NEW',
  },
  {
    id: 2,
    title: 'from 作成者',
    body: '遊びで家庭の管理システム作ってみた。無料の範囲で暇な時に機能追加してみようと思うからお楽しみに 🐱',
    date: '2026-03-18',
    tag: 'MSG',
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
        {/* 財布本体 */}
        <rect x="2" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        {/* 財布フラップ */}
        <path d="M2 10h18" stroke="currentColor" strokeWidth="1.5" />
        {/* コインポケット */}
        <rect x="13" y="12.5" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.3" />
        {/* コイン */}
        <circle cx="15.5" cy="14.5" r="1" fill="currentColor" />
        {/* ストラップ */}
        <path d="M6 6V4.5A2.5 2.5 0 0 1 8.5 2h5A2.5 2.5 0 0 1 16 4.5V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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
        {/* カレンダー本体 */}
        <rect x="2" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 8h14" stroke="currentColor" strokeWidth="1.5" />
        {/* ピン */}
        <path d="M6 2v3M12 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* グリッド点 */}
        <circle cx="6" cy="11.5" r="1" fill="currentColor" />
        <circle cx="9" cy="11.5" r="1" fill="currentColor" />
        <circle cx="6" cy="14.5" r="1" fill="currentColor" />
        {/* フォーク */}
        <path d="M18 4v4M16.5 4v2.5a1.5 1.5 0 0 0 3 0V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M18 8v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.tag === 'NEW' && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: '#dbeafe', color: '#1d4ed8' }}
                      >
                        NEW
                      </span>
                    )}
                    {n.tag === 'MSG' && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--miyu-bg)', color: 'var(--miyu)' }}
                      >
                        MSG
                      </span>
                    )}
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{n.title}</span>
                    <span className="text-xs ml-auto" style={{ color: 'var(--muted)' }}>{n.date}</span>
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
              onClick={() => f.ready && navigate(f.href)}
              className={`rounded-xl p-5 transition-all ${f.ready ? 'hover:shadow-md hover:-translate-y-0.5' : 'cursor-not-allowed'}`}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${f.ready ? f.colorBd : 'var(--border)'}`,
                opacity: f.ready ? 1 : 0.55,
                cursor: f.ready ? 'pointer' : 'not-allowed',
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

            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
