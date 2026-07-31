// ============================================================================
// financeAnalytics.ts ── 家計AI分析の集計ロジック（読取専用・純粋関数）
//
// account_records（確定済みの月次記録）だけを入力に、推移・月次比較・目標到達を
// 算出する。DBへの書込や推測・自動修正は一切行わない（要件: 読取専用の数値提示）。
// ⚠ 保護対象の振込計算(transferCalc)には依存しない。ここは派生的な「分析」レイヤ。
// ============================================================================
import type { AccountRecord } from '@/types'

/** 1ヶ月分の派生指標（グラフ・比較で使う正規化済みの点） */
export interface MonthlyPoint {
  month: string // 'YYYY-MM'
  salaryShota: number
  salaryMiyu: number
  salaryTotal: number
  deductShota: number
  deductMiyu: number
  deductTotal: number
  netShota: number
  netMiyu: number
  netTotal: number
  transShota: number
  transMiyu: number
  transTotal: number
  targetBalance: number
  currentBalance: number
  /** 目標到達率(%) = current/target*100。target<=0 は 0 とする */
  achievementPct: number
}

/** account_records を月昇順の MonthlyPoint 列に正規化する */
export function toMonthlySeries(records: AccountRecord[]): MonthlyPoint[] {
  return records
    .filter(r => !!r.month)
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(r => {
      const salaryTotal = r.salary_shota + r.salary_miyu
      const deductTotal = r.shota_deduct + r.miyu_deduct
      const netTotal = r.net_shota + r.net_miyu
      const transTotal = r.trans_shota + r.trans_miyu
      const achievementPct = r.target_balance > 0 ? (r.current_balance / r.target_balance) * 100 : 0
      return {
        month: r.month,
        salaryShota: r.salary_shota,
        salaryMiyu: r.salary_miyu,
        salaryTotal,
        deductShota: r.shota_deduct,
        deductMiyu: r.miyu_deduct,
        deductTotal,
        netShota: r.net_shota,
        netMiyu: r.net_miyu,
        netTotal,
        transShota: r.trans_shota,
        transMiyu: r.trans_miyu,
        transTotal,
        targetBalance: r.target_balance,
        currentBalance: r.current_balance,
        achievementPct,
      }
    })
}

/** 前月比・前年同月比などの差分。pct は前値が0のとき null（比率算出不能） */
export interface Delta {
  abs: number
  pct: number | null
}

export function delta(current: number, previous: number): Delta {
  const abs = current - previous
  const pct = previous !== 0 ? (abs / previous) * 100 : null
  return { abs, pct }
}

/** 'YYYY-MM' の前月を返す（月をまたぐ・年跨ぎ対応） */
export function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 }
  return `${d.y}-${String(d.m).padStart(2, '0')}`
}

/** 'YYYY-MM' の前年同月を返す */
export function sameMonthLastYear(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${y - 1}-${String(m).padStart(2, '0')}`
}

export function findByMonth(series: MonthlyPoint[], month: string): MonthlyPoint | null {
  return series.find(p => p.month === month) ?? null
}

/** ダッシュボード用の要約 */
export interface FinanceSummary {
  count: number
  latest: MonthlyPoint | null
  /** latest の直前の実データ点（歴史上の1つ前。月が飛んでいても直近の記録） */
  prevPoint: MonthlyPoint | null
  /** latest と同じ月の前年（存在すれば） */
  yoyPoint: MonthlyPoint | null
  /** 全期間の振込総額 */
  totalTransferred: number
  /** 給料合計の平均 */
  avgSalaryTotal: number
}

export function summarize(records: AccountRecord[]): FinanceSummary {
  const series = toMonthlySeries(records)
  const count = series.length
  const latest = count > 0 ? series[count - 1] : null
  const prevPoint = count > 1 ? series[count - 2] : null
  const yoyPoint = latest ? findByMonth(series, sameMonthLastYear(latest.month)) : null
  const totalTransferred = series.reduce((s, p) => s + p.transTotal, 0)
  const avgSalaryTotal = count > 0 ? Math.round(series.reduce((s, p) => s + p.salaryTotal, 0) / count) : 0
  return { count, latest, prevPoint, yoyPoint, totalTransferred, avgSalaryTotal }
}
