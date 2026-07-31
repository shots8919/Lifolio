import { describe, it, expect } from 'vitest'
import type { AccountRecord } from '@/types'
import {
  toMonthlySeries,
  delta,
  prevMonth,
  sameMonthLastYear,
  findByMonth,
  summarize,
  buildAiSummaryInput,
} from './financeAnalytics'

// account_records の最小ファクトリ（分析に使う数値のみ指定、他は既定）
function rec(p: Partial<AccountRecord> & { month: string }): AccountRecord {
  return {
    month: p.month,
    target_balance: p.target_balance ?? 0,
    current_balance: p.current_balance ?? 0,
    salary_shota: p.salary_shota ?? 0,
    salary_miyu: p.salary_miyu ?? 0,
    shota_deduct: p.shota_deduct ?? 0,
    miyu_deduct: p.miyu_deduct ?? 0,
    shota_deduct_items: p.shota_deduct_items ?? [],
    miyu_deduct_items: p.miyu_deduct_items ?? [],
    net_shota: p.net_shota ?? 0,
    net_miyu: p.net_miyu ?? 0,
    ratio_shota: p.ratio_shota ?? 0,
    ratio_miyu: p.ratio_miyu ?? 0,
    trans_shota: p.trans_shota ?? 0,
    trans_miyu: p.trans_miyu ?? 0,
    confirmed_at: p.confirmed_at ?? '2026-01-01T00:00:00Z',
  }
}

describe('toMonthlySeries', () => {
  it('月昇順に並べ替え、合計と目標到達率を算出する', () => {
    const series = toMonthlySeries([
      rec({ month: '2026-02', salary_shota: 300000, salary_miyu: 210000, trans_shota: 60000, trans_miyu: 40000, target_balance: 500000, current_balance: 250000 }),
      rec({ month: '2026-01', salary_shota: 300000, salary_miyu: 200000, trans_shota: 50000, trans_miyu: 50000, target_balance: 400000, current_balance: 400000 }),
    ])
    expect(series.map(p => p.month)).toEqual(['2026-01', '2026-02'])
    expect(series[0].salaryTotal).toBe(500000)
    expect(series[0].transTotal).toBe(100000)
    expect(series[0].achievementPct).toBe(100) // 400000/400000
    expect(series[1].salaryTotal).toBe(510000)
    expect(series[1].achievementPct).toBe(50)  // 250000/500000
  })

  it('target<=0 の月は到達率0（0除算しない）', () => {
    const series = toMonthlySeries([rec({ month: '2026-01', target_balance: 0, current_balance: 123456 })])
    expect(series[0].achievementPct).toBe(0)
  })

  it('元配列を破壊しない', () => {
    const input = [rec({ month: '2026-02' }), rec({ month: '2026-01' })]
    toMonthlySeries(input)
    expect(input.map(r => r.month)).toEqual(['2026-02', '2026-01'])
  })
})

describe('delta', () => {
  it('増減額と増減率を返す', () => {
    expect(delta(120, 100)).toEqual({ abs: 20, pct: 20 })
    expect(delta(80, 100)).toEqual({ abs: -20, pct: -20 })
  })
  it('前値0のとき pct は null', () => {
    expect(delta(100, 0)).toEqual({ abs: 100, pct: null })
  })
})

describe('prevMonth / sameMonthLastYear', () => {
  it('前月（年跨ぎ対応）', () => {
    expect(prevMonth('2026-03')).toBe('2026-02')
    expect(prevMonth('2026-01')).toBe('2025-12')
  })
  it('前年同月', () => {
    expect(sameMonthLastYear('2026-03')).toBe('2025-03')
    expect(sameMonthLastYear('2026-01')).toBe('2025-01')
  })
})

describe('findByMonth', () => {
  it('該当月を返し、無ければ null', () => {
    const series = toMonthlySeries([rec({ month: '2026-01' }), rec({ month: '2026-02' })])
    expect(findByMonth(series, '2026-02')?.month).toBe('2026-02')
    expect(findByMonth(series, '2025-12')).toBeNull()
  })
})

describe('summarize', () => {
  it('最新月・前月点・前年同月点・総額・平均を返す', () => {
    const s = summarize([
      rec({ month: '2025-03', salary_shota: 100000, salary_miyu: 100000, trans_shota: 10000, trans_miyu: 10000 }),
      rec({ month: '2026-02', salary_shota: 300000, salary_miyu: 200000, trans_shota: 30000, trans_miyu: 20000 }),
      rec({ month: '2026-03', salary_shota: 320000, salary_miyu: 210000, trans_shota: 35000, trans_miyu: 25000 }),
    ])
    expect(s.count).toBe(3)
    expect(s.latest?.month).toBe('2026-03')
    expect(s.prevPoint?.month).toBe('2026-02')
    expect(s.yoyPoint?.month).toBe('2025-03') // latestの前年同月
    // 総振込 = (10000+10000)+(30000+20000)+(35000+25000) = 130000
    expect(s.totalTransferred).toBe(130000)
    // 平均給料合計 = (200000+500000+530000)/3 = 410000
    expect(s.avgSalaryTotal).toBe(410000)
  })

  it('前年同月が無ければ yoyPoint は null', () => {
    const s = summarize([
      rec({ month: '2026-02' }),
      rec({ month: '2026-03' }),
    ])
    expect(s.yoyPoint).toBeNull()
    expect(s.prevPoint?.month).toBe('2026-02')
  })

  it('空データでも安全（latest/prev/yoy は null）', () => {
    const s = summarize([])
    expect(s).toEqual({ count: 0, latest: null, prevPoint: null, yoyPoint: null, totalTransferred: 0, avgSalaryTotal: 0 })
  })
})

describe('buildAiSummaryInput', () => {
  it('最新月・前月・前年・直近系列を含む入力を作る', () => {
    const input = buildAiSummaryInput([
      rec({ month: '2025-03', salary_shota: 100000, salary_miyu: 100000, trans_shota: 10000, trans_miyu: 10000, target_balance: 100000, current_balance: 50000 }),
      rec({ month: '2026-02', salary_shota: 300000, salary_miyu: 200000, trans_shota: 30000, trans_miyu: 20000 }),
      rec({ month: '2026-03', salary_shota: 320000, salary_miyu: 210000, trans_shota: 35000, trans_miyu: 25000, target_balance: 120000, current_balance: 90000 }),
    ])
    expect(input).not.toBeNull()
    expect(input!.latestMonth).toBe('2026-03')
    expect(input!.count).toBe(3)
    expect(input!.latest.salaryTotal).toBe(530000)
    expect(input!.latest.achievementPct).toBe(75) // 90000/120000
    expect(input!.prev?.salaryTotal).toBe(500000)
    expect(input!.yoy).not.toBeNull() // 2025-03 が前年同月として存在
    expect(input!.recent).toHaveLength(3)
    expect(input!.recent[input!.recent.length - 1].month).toBe('2026-03')
  })

  it('データが無ければ null', () => {
    expect(buildAiSummaryInput([])).toBeNull()
  })
})
