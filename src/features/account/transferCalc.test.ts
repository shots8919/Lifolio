import { describe, it, expect } from 'vitest'
import { calcDeductDetail, calculateTransfer, type PersonDeductInput } from './transferCalc'

// 控除なしの人物
const noDeduct = (): PersonDeductInput => ({
  rentCheck: false, rent: '',
  transCheck: false, trans: '',
  otherCheck: false, others: [],
})

describe('calcDeductDetail', () => {
  it('チェックONかつ金額>0の項目のみを、家賃→交通費→その他の順で採用する', () => {
    const p: PersonDeductInput = {
      rentCheck: true, rent: '20000',
      transCheck: true, trans: '0', // 0は採用しない
      otherCheck: true, others: [
        { desc: '保険', amount: '3000' },
        { desc: '', amount: '0' }, // 0は採用しない
      ],
    }
    const { total, items } = calcDeductDetail(p)
    expect(items).toEqual([
      { label: '家賃補助', amount: 20000 },
      { label: '保険', amount: 3000 },
    ])
    expect(total).toBe(23000)
  })

  it('その他のdesc未入力は「その他」ラベルになる', () => {
    const p: PersonDeductInput = {
      rentCheck: false, rent: '',
      transCheck: false, trans: '',
      otherCheck: true, others: [{ desc: '', amount: '500' }],
    }
    expect(calcDeductDetail(p).items).toEqual([{ label: 'その他', amount: 500 }])
  })

  it('チェックOFFなら金額があっても無視する', () => {
    const p: PersonDeductInput = {
      rentCheck: false, rent: '99999',
      transCheck: false, trans: '99999',
      otherCheck: false, others: [{ desc: 'x', amount: '99999' }],
    }
    expect(calcDeductDetail(p)).toEqual({ total: 0, items: [] })
  })

  it('数値型の金額も受け付ける', () => {
    const p: PersonDeductInput = {
      rentCheck: true, rent: 15000,
      transCheck: false, trans: 0,
      otherCheck: false, others: [],
    }
    expect(calcDeductDetail(p).total).toBe(15000)
  })
})

describe('calculateTransfer', () => {
  it('控除なし: 手取り比率で按分する', () => {
    const out = calculateTransfer({
      targetBalance: 500000, currentBalance: 100000,
      salaryShota: 300000, salaryMiyu: 200000,
      shota: noDeduct(), miyu: noDeduct(),
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    const r = out.result
    expect(r.netShota).toBe(300000)
    expect(r.netMiyu).toBe(200000)
    expect(r.ratioShota).toBeCloseTo(0.6, 10)
    expect(r.ratioMiyu).toBeCloseTo(0.4, 10)
    expect(r.topUp).toBe(400000)
    expect(r.transShota).toBe(240000)
    expect(r.transMiyu).toBe(160000)
    // 端数の有無に関わらず合計は必ず topUp と一致
    expect(r.transShota + r.transMiyu).toBe(r.topUp)
  })

  it('端数はmiyu側で吸収し、合計はtopUpと一致する', () => {
    // 比率0.5/0.5、topUp=100001 → shota=round(50000.5)=50001, miyu=50000
    const out = calculateTransfer({
      targetBalance: 200001, currentBalance: 100000,
      salaryShota: 250000, salaryMiyu: 250000,
      shota: noDeduct(), miyu: noDeduct(),
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.result.topUp).toBe(100001)
    expect(out.result.transShota).toBe(50001)
    expect(out.result.transMiyu).toBe(50000)
    expect(out.result.transShota + out.result.transMiyu).toBe(100001)
  })

  it('控除を反映した手取りで比率を出す', () => {
    const out = calculateTransfer({
      targetBalance: 300000, currentBalance: 0,
      salaryShota: 300000, salaryMiyu: 200000,
      shota: { rentCheck: true, rent: '20000', transCheck: true, trans: '3000', otherCheck: false, others: [] },
      miyu: { rentCheck: false, rent: '', transCheck: true, trans: '8000', otherCheck: false, others: [] },
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.result.shotaDeduct).toBe(23000)
    expect(out.result.miyuDeduct).toBe(8000)
    expect(out.result.netShota).toBe(277000)
    expect(out.result.netMiyu).toBe(192000)
    expect(out.result.transShota + out.result.transMiyu).toBe(out.result.topUp)
  })

  it('控除後の手取りが0以下なら nonPositiveNet', () => {
    const out = calculateTransfer({
      targetBalance: 500000, currentBalance: 0,
      salaryShota: 20000, salaryMiyu: 200000,
      shota: { rentCheck: true, rent: '20000', transCheck: false, trans: '', otherCheck: false, others: [] },
      miyu: noDeduct(),
    })
    expect(out).toEqual({ ok: false, reason: 'nonPositiveNet' })
  })

  it('目標を上回っていれば noTopUp（overageは上回り額）', () => {
    const out = calculateTransfer({
      targetBalance: 100000, currentBalance: 150000,
      salaryShota: 300000, salaryMiyu: 200000,
      shota: noDeduct(), miyu: noDeduct(),
    })
    expect(out).toEqual({ ok: false, reason: 'noTopUp', overage: 50000 })
  })

  it('目標=現在残高（topUp=0）も noTopUp（overage=0）', () => {
    const out = calculateTransfer({
      targetBalance: 100000, currentBalance: 100000,
      salaryShota: 300000, salaryMiyu: 200000,
      shota: noDeduct(), miyu: noDeduct(),
    })
    expect(out).toEqual({ ok: false, reason: 'noTopUp', overage: 0 })
  })

  it('ガード順序: 手取り0以下は topUp条件より優先される', () => {
    // 手取り0以下 かつ topUpも0以下 の場合、nonPositiveNet が返る（現行の評価順）
    const out = calculateTransfer({
      targetBalance: 0, currentBalance: 100000,
      salaryShota: 10000, salaryMiyu: 200000,
      shota: { rentCheck: true, rent: '10000', transCheck: false, trans: '', otherCheck: false, others: [] },
      miyu: noDeduct(),
    })
    expect(out).toEqual({ ok: false, reason: 'nonPositiveNet' })
  })
})
