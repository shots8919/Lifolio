import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AccountRecord } from '@/types'
import { toMonthlySeries, summarize, delta, type Delta, type MonthlyPoint } from './financeAnalytics'
import { GroupedBarChart, LineChart, type ChartSeries } from './analytics/MiniCharts'

// ─── フォーマッタ ───────────────────────────────────────────────
const fmt = (n: number) => Number(n).toLocaleString('ja-JP')
const fmtMonthFull = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${y}年${Number(m)}月`
}
const fmtMonthShort = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${y.slice(2)}/${Number(m)}`
}

const CARD: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)' }
const SHOTA = 'var(--shota)'
const MIYU = 'var(--miyu)'

// ─── 小物 ───────────────────────────────────────────────────────
function DeltaChip({ d }: { d: Delta }) {
  if (d.abs === 0) return <span className="text-[10px]" style={{ color: 'var(--muted)' }}>前月比 ±0</span>
  const up = d.abs > 0
  const pct = d.pct === null ? '' : ` (${up ? '+' : ''}${d.pct.toFixed(1)}%)`
  return (
    <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>
      前月比 {up ? '▲' : '▼'} {fmt(Math.abs(d.abs))}{pct}
    </span>
  )
}

function Kpi({ label, value, unit = '円', foot }: { label: string; value: string; unit?: string; foot?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--subtle)' }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="text-lg font-bold font-mono leading-tight mt-1" style={{ color: 'var(--text)' }}>
        {value}<span className="text-xs font-sans font-normal ml-0.5" style={{ color: 'var(--muted)' }}>{unit}</span>
      </div>
      {foot && <div className="mt-1">{foot}</div>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={CARD}>
      <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── ページ ─────────────────────────────────────────────────────
export default function AnalysisPage() {
  const [records, setRecords] = useState<AccountRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('account_records').select('*').order('month')
      setRecords((data as AccountRecord[] | null) ?? [])
      setLoading(false)
    })()
  }, [])

  const series = toMonthlySeries(records)
  const s = summarize(records)
  const chartSlice = series.slice(-12)            // 直近12ヶ月をグラフ表示
  const labels = chartSlice.map(p => fmtMonthShort(p.month))

  const barSeries = (pick: (p: MonthlyPoint) => [number, number]): ChartSeries[] => [
    { label: 'SHOTA', color: SHOTA, values: chartSlice.map(p => pick(p)[0]) },
    { label: 'MIYU', color: MIYU, values: chartSlice.map(p => pick(p)[1]) },
  ]

  const header = (
    <div className="mb-2">
      <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>家計分析</h1>
      <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>共有口座管理 › 家計分析</p>
    </div>
  )

  if (loading) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl py-16 text-center text-sm" style={{ ...CARD, color: 'var(--muted)' }}>読み込み中...</div>
      </div>
    )
  }

  if (s.count === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl py-16 text-center" style={CARD}>
          <div className="text-sm" style={{ color: 'var(--muted)' }}>分析できる確定データがまだありません</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>「振込額計算」で月次を確定すると、ここに推移が表示されます</div>
        </div>
      </div>
    )
  }

  const latest = s.latest!
  const prev = s.prevPoint

  return (
    <div className="space-y-4">
      {header}

      {/* KPI（最新月） */}
      <div className="rounded-xl" style={CARD}>
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            最新月サマリー <span className="font-normal" style={{ color: 'var(--muted)' }}>— {fmtMonthFull(latest.month)}</span>
          </span>
          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{s.count}ヶ月分の記録</span>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="給料合計" value={fmt(latest.salaryTotal)}
            foot={prev && <DeltaChip d={delta(latest.salaryTotal, prev.salaryTotal)} />} />
          <Kpi label="振込合計" value={fmt(latest.transTotal)}
            foot={prev && <DeltaChip d={delta(latest.transTotal, prev.transTotal)} />} />
          <Kpi label="目標到達率" value={latest.achievementPct.toFixed(1)} unit="%"
            foot={<span className="text-[10px]" style={{ color: 'var(--muted)' }}>現在 {fmt(latest.currentBalance)} / 目標 {fmt(latest.targetBalance)}</span>} />
          <Kpi label="累計振込額" value={fmt(s.totalTransferred)}
            foot={<span className="text-[10px]" style={{ color: 'var(--muted)' }}>全{s.count}ヶ月 合計</span>} />
        </div>
      </div>

      {/* チャート */}
      <ChartCard title="給料推移（SHOTA / MIYU）">
        <GroupedBarChart labels={labels} series={barSeries(p => [p.salaryShota, p.salaryMiyu])} />
      </ChartCard>

      <ChartCard title="振込額推移（SHOTA / MIYU）">
        <GroupedBarChart labels={labels} series={barSeries(p => [p.transShota, p.transMiyu])} />
      </ChartCard>

      <ChartCard title="残高推移（目標 / 現在）">
        <LineChart labels={labels} series={[
          { label: '目標残高', color: 'var(--muted)', values: chartSlice.map(p => p.targetBalance) },
          { label: '現在残高', color: SHOTA, values: chartSlice.map(p => p.currentBalance) },
        ]} />
      </ChartCard>

      {/* 月次比較テーブル */}
      <div className="rounded-xl overflow-hidden" style={CARD}>
        <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>月次比較</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--subtle)', borderBottom: '1px solid var(--border)' }}>
                {['年月', '給料合計', '控除合計', '手取り合計', '振込合計', '目標到達率', '振込 前月比'].map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-[11px] font-semibold text-left uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((p, i, arr) => {
                // 直前月（配列は降順なので次の要素が過去）
                const older = arr[i + 1]
                const d = older ? delta(p.transTotal, older.transTotal) : null
                const num = 'px-4 py-2.5 text-sm font-mono text-right whitespace-nowrap'
                return (
                  <tr key={p.month} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : undefined }}>
                    <td className="px-4 py-2.5 text-sm whitespace-nowrap" style={{ color: 'var(--text)' }}>{fmtMonthFull(p.month)}</td>
                    <td className={num} style={{ color: 'var(--text)' }}>{fmt(p.salaryTotal)}</td>
                    <td className={num} style={{ color: 'var(--muted)' }}>{fmt(p.deductTotal)}</td>
                    <td className={num} style={{ color: 'var(--muted)' }}>{fmt(p.netTotal)}</td>
                    <td className={num} style={{ color: 'var(--text)', fontWeight: 600 }}>{fmt(p.transTotal)}</td>
                    <td className={num} style={{ color: 'var(--muted)' }}>{p.achievementPct.toFixed(1)}%</td>
                    <td className={num} style={{ color: 'var(--muted)' }}>
                      {d ? `${d.abs > 0 ? '▲' : d.abs < 0 ? '▼' : '±'}${fmt(Math.abs(d.abs))}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 注記（要件: 数値の提示のみ・支出は未記録） */}
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        ※ 本分析は確定済みの共有口座記録（給料・控除・振込額・目標/現在残高）のみを対象とした数値の可視化です。
        日々の支出（食費など）は記録していないため対象外です。AIによる自然言語の要約は今後追加予定です。
      </p>
    </div>
  )
}
