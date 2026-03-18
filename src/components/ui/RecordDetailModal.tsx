import { useEffect } from 'react'
import type { AccountRecord, DeductItem } from '@/types'

interface Props {
  record: AccountRecord | null
  onClose: () => void
}

const fmt = (n: number) => Number(n).toLocaleString('ja-JP')

const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${y}年${Number(m)}月`
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

interface DeductListProps {
  salary: number
  deduct: number
  items: DeductItem[]
  net: number
  color: string
}

function DeductList({ salary, deduct, items, net, color }: DeductListProps) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex justify-between items-center px-3 py-1.5 rounded-lg text-sm"
        style={{ background: 'var(--subtle)' }}
      >
        <span style={{ color: 'var(--muted)' }}>給料</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>{fmt(salary)} 円</span>
      </div>

      {items.length > 0
        ? items.map((item, i) => (
          <div
            key={i}
            className="flex justify-between items-center px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--subtle)' }}
          >
            <span style={{ color: 'var(--muted)' }}>{item.label}</span>
            <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>−{fmt(item.amount)} 円</span>
          </div>
        ))
        : deduct > 0 && (
          <div
            className="flex justify-between items-center px-3 py-1.5 rounded-lg text-sm"
            style={{ background: 'var(--subtle)' }}
          >
            <span style={{ color: 'var(--muted)' }}>控除合計</span>
            <span className="font-mono font-semibold" style={{ color: 'var(--text)' }}>−{fmt(deduct)} 円</span>
          </div>
        )
      }

      <div
        className="flex justify-between items-center px-3 py-2 rounded-lg text-sm font-bold"
        style={{ background: 'var(--border)' }}
      >
        <span style={{ color: 'var(--text)' }}>実質給料</span>
        <span className="font-mono" style={{ color }}>{fmt(net)} 円</span>
      </div>
    </div>
  )
}

export default function RecordDetailModal({ record, onClose }: Props) {
  useEffect(() => {
    if (!record) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [record, onClose])

  if (!record) return null

  const ratioS = (record.ratio_shota * 100).toFixed(1)
  const ratioM = (record.ratio_miyu * 100).toFixed(1)

  const sectionTitle = 'text-[10px] font-bold uppercase tracking-[.1em] pb-2 mb-3'
  const sectionTitleStyle = { color: 'var(--muted)', borderBottom: '1px solid var(--border)' }
  const cardStyle = { background: 'var(--subtle)', border: '1px solid var(--border)' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-5"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] max-h-[90vh] flex flex-col rounded-2xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>
              {fmtMonth(record.month)} の詳細
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>共有口座管理</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:opacity-70"
            style={{ background: 'var(--subtle)', color: 'var(--muted)' }}
            aria-label="閉じる"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* ボディ */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* 振込金額 */}
          <section>
            <div className={sectionTitle} style={sectionTitleStyle}>振込金額</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'SHOTA', value: record.trans_shota, color: 'var(--shota)' },
                { label: 'MIYU', value: record.trans_miyu, color: 'var(--miyu)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3" style={cardStyle}>
                  <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>
                    {label}
                  </div>
                  <div className="text-[15px] font-bold font-mono" style={{ color }}>
                    {fmt(value)}{' '}
                    <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>円</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 按分比率 */}
          <section>
            <div className={sectionTitle} style={sectionTitleStyle}>按分比率</div>
            <div className="rounded-xl p-3" style={cardStyle}>
              <div className="flex justify-between text-[11px] font-bold mb-2">
                <span style={{ color: 'var(--shota)' }}>SHOTA {ratioS}%</span>
                <span style={{ color: 'var(--miyu)' }}>MIYU {ratioM}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--miyu-bg)' }}>
                <div className="h-full rounded-full" style={{ width: `${ratioS}%`, background: 'var(--shota)' }} />
              </div>
            </div>
          </section>

          {/* 給料・控除 SHOTA */}
          <section>
            <div className={sectionTitle} style={sectionTitleStyle}>給料・控除（SHOTA）</div>
            <DeductList
              salary={record.salary_shota}
              deduct={record.shota_deduct}
              items={record.shota_deduct_items}
              net={record.net_shota}
              color="var(--shota)"
            />
          </section>

          {/* 給料・控除 MIYU */}
          <section>
            <div className={sectionTitle} style={sectionTitleStyle}>給料・控除（MIYU）</div>
            <DeductList
              salary={record.salary_miyu}
              deduct={record.miyu_deduct}
              items={record.miyu_deduct_items}
              net={record.net_miyu}
              color="var(--miyu)"
            />
          </section>

          {/* 口座情報 */}
          <section>
            <div className={sectionTitle} style={sectionTitleStyle}>口座情報</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '確定時の口座残高', value: record.current_balance, color: 'var(--text)' },
                { label: '目標残高', value: record.target_balance, color: 'var(--success)' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-3" style={cardStyle}>
                  <div className="text-[10px] font-bold tracking-wide mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
                  <div className="text-[15px] font-bold font-mono" style={{ color }}>
                    {fmt(value)}{' '}
                    <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>円</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {record.confirmed_at && (
            <div className="text-[11px] text-right" style={{ color: 'var(--muted)' }}>
              確定日時：{fmtDateTime(record.confirmed_at)}
            </div>
          )}
        </div>

        {/* フッター */}
        <div
          className="px-6 py-4 flex justify-end flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
            style={{ background: 'var(--subtle)', color: 'var(--text)' }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
