// ============================================================================
// MiniCharts.tsx ── 家計分析用の軽量SVGチャート（依存追加なし・ライト前提）
//
// dataviz 方針: 細いマーク / データ端4px丸め / 控えめグリッド・軸 / 2系列は凡例＋
// ホバーで直接値 / 単一軸（デュアル軸禁止）。色は既存の --shota/--miyu（色覚検証済み
// ΔE 18.7）を系列色に使い、識別は色だけに依存しない（凡例＋ホバー値）。
// ============================================================================
import { useState } from 'react'

const W = 600
const H = 260
const PAD = { top: 16, right: 14, bottom: 30, left: 58 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const BASE_Y = PAD.top + PLOT_H

export interface ChartSeries {
  label: string
  color: string
  values: number[]
}

// ─── フォーマッタ ───────────────────────────────────────────────
const fmtYen = (n: number) => `${n.toLocaleString('ja-JP')} 円`
const fmtAxis = (n: number) => {
  if (Math.abs(n) >= 10000) {
    const man = n / 10000
    return `${Number.isInteger(man) ? man : Math.round(man * 10) / 10}万`
  }
  return n.toLocaleString('ja-JP')
}

function niceMax(v: number): number {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * pow
}

/** ベースラインに接地し上端だけ丸める棒のパス */
function barPath(x: number, top: number, w: number, h: number, r = 4): string {
  const rr = Math.max(0, Math.min(r, w / 2, h))
  const b = top + h
  return `M${x},${b} L${x},${top + rr} Q${x},${top} ${x + rr},${top} `
    + `L${x + w - rr},${top} Q${x + w},${top} ${x + w},${top + rr} L${x + w},${b} Z`
}

function Legend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: 'var(--muted)' }}>
      {series.map(s => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

function GridAndYAxis({ max }: { max: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max)
  return (
    <g>
      {ticks.map((t, i) => {
        const y = BASE_Y - (t / max) * PLOT_H
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="var(--border)" strokeWidth={1} opacity={i === 0 ? 0.9 : 0.5} />
            <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
              {fmtAxis(t)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ─── グループ棒グラフ ───────────────────────────────────────────
interface ChartProps {
  labels: string[]      // x軸（月など、整形済み）
  series: ChartSeries[] // 1〜2系列
  emptyText?: string
}

export function GroupedBarChart({ labels, series, emptyText = 'データがありません' }: ChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const n = labels.length
  if (n === 0) return <ChartEmpty text={emptyText} />

  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)))
  const groupW = PLOT_W / n
  const innerPad = Math.min(10, groupW * 0.18)
  const barsW = groupW - innerPad * 2
  const barW = Math.max(3, (barsW - (series.length - 1) * 2) / series.length)
  const active = hover ?? n - 1

  return (
    <div>
      <Legend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 6 }}
        role="img" aria-label={`棒グラフ: ${series.map(s => s.label).join('・')}`}>
        <GridAndYAxis max={max} />
        {labels.map((lab, gi) => {
          const gx = PAD.left + gi * groupW
          const isActive = gi === active
          return (
            <g key={gi}>
              {/* ホバー用ヒット領域 */}
              <rect x={gx} y={PAD.top} width={groupW} height={PLOT_H} fill="transparent"
                onMouseEnter={() => setHover(gi)} onMouseLeave={() => setHover(null)} />
              {series.map((s, si) => {
                const v = s.values[gi] ?? 0
                const h = (v / max) * PLOT_H
                const x = gx + innerPad + si * (barW + 2)
                return (
                  <path key={si} d={barPath(x, BASE_Y - h, barW, h)} fill={s.color}
                    opacity={hover === null || isActive ? 1 : 0.35} pointerEvents="none" />
                )
              })}
              <text x={gx + groupW / 2} y={H - 10} textAnchor="middle" fontSize={10}
                fill={isActive ? 'var(--text)' : 'var(--muted)'} fontWeight={isActive ? 600 : 400}
                pointerEvents="none">
                {lab}
              </text>
            </g>
          )
        })}
      </svg>
      <ValueReadout label={labels[active]} series={series} index={active} isHover={hover !== null} />
    </div>
  )
}

// ─── 折れ線グラフ ───────────────────────────────────────────────
export function LineChart({ labels, series, emptyText = 'データがありません' }: ChartProps) {
  const [hover, setHover] = useState<number | null>(null)
  const n = labels.length
  if (n === 0) return <ChartEmpty text={emptyText} />

  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)))
  const stepX = n > 1 ? PLOT_W / (n - 1) : 0
  const xAt = (i: number) => PAD.left + (n > 1 ? i * stepX : PLOT_W / 2)
  const yAt = (v: number) => BASE_Y - (v / max) * PLOT_H
  const active = hover ?? n - 1

  return (
    <div>
      <Legend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 6 }}
        role="img" aria-label={`折れ線グラフ: ${series.map(s => s.label).join('・')}`}>
        <GridAndYAxis max={max} />
        {/* アクティブ位置のクロスヘア */}
        <line x1={xAt(active)} y1={PAD.top} x2={xAt(active)} y2={BASE_Y}
          stroke="var(--border)" strokeWidth={1} opacity={0.9} />
        {series.map((s, si) => (
          <g key={si}>
            <polyline
              points={s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')}
              fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(v)} r={i === active ? 4.5 : 3}
                fill="var(--surface)" stroke={s.color} strokeWidth={2} pointerEvents="none" />
            ))}
          </g>
        ))}
        {/* x軸ラベル＋ホバーヒット */}
        {labels.map((lab, i) => (
          <g key={i}>
            <rect x={xAt(i) - stepX / 2 || PAD.left} y={PAD.top} width={stepX || PLOT_W} height={PLOT_H}
              fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            <text x={xAt(i)} y={H - 10} textAnchor="middle" fontSize={10}
              fill={i === active ? 'var(--text)' : 'var(--muted)'} fontWeight={i === active ? 600 : 400}
              pointerEvents="none">
              {lab}
            </text>
          </g>
        ))}
      </svg>
      <ValueReadout label={labels[active]} series={series} index={active} isHover={hover !== null} />
    </div>
  )
}

// ─── 共有パーツ ─────────────────────────────────────────────────
function ValueReadout({ label, series, index, isHover }: {
  label: string; series: ChartSeries[]; index: number; isHover: boolean
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--muted)' }}>
      <span className="font-semibold" style={{ color: 'var(--text)' }}>
        {label}{!isHover && <span className="font-normal">（最新）</span>}
      </span>
      {series.map(s => (
        <span key={s.label} className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />
          {s.label} <span className="font-mono" style={{ color: 'var(--text)' }}>{fmtYen(s.values[index] ?? 0)}</span>
        </span>
      ))}
    </div>
  )
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>{text}</div>
  )
}
