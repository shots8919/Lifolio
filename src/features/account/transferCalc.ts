// ============================================================================
// transferCalc.ts ── 共有口座の振込額計算（保護対象ロジックの純粋関数版）
//
// CalculatePage.tsx の calcDeductDetail / calculate から「数式部分のみ」を
// 忠実に抽出したもの（1:1）。UIバリデーション（目標/給料/対象月の未入力チェック）や
// トースト表示はコンポーネント側に残す。
//
// ⚠ 変更禁止: 手取り→比率→按分の式、端数処理（transMiyu = topUp - transShota で
//    端数をmiyu側に吸収）、ガードの順序は現行と完全に一致させること。
//    仕様の言語化は docs/redesign/02-business-logic-spec.md §B を参照。
// ============================================================================
import type { DeductItem } from '@/types'

/** 1人分の控除設定（CalculatePage の PersonState と互換。金額は文字列/数値どちらも可） */
export interface PersonDeductInput {
  rentCheck: boolean
  rent: string | number
  transCheck: boolean
  trans: string | number
  otherCheck: boolean
  others: { desc: string; amount: string | number }[]
}

export interface TransferCalcInput {
  targetBalance: number
  currentBalance: number
  salaryShota: number
  salaryMiyu: number
  shota: PersonDeductInput
  miyu: PersonDeductInput
}

/** 計算成功時の結果（CalculatePage の CalcResult と同一形状） */
export interface TransferCalcResult {
  topUp: number
  target: number
  currentBal: number
  salaryShota: number
  salaryMiyu: number
  shotaDeduct: number
  miyuDeduct: number
  shotaDeductItems: DeductItem[]
  miyuDeductItems: DeductItem[]
  netShota: number
  netMiyu: number
  ratioShota: number
  ratioMiyu: number
  transShota: number
  transMiyu: number
}

/**
 * 計算結果。ok=false は現行 calculate() の早期return（トースト表示ケース）に対応。
 * - nonPositiveNet: 控除後の給料が0以下
 * - noTopUp:        目標を上回っており振込不要（overage = 上回り額 = -topUp）
 */
export type TransferCalcOutcome =
  | { ok: true; result: TransferCalcResult }
  | { ok: false; reason: 'nonPositiveNet' }
  | { ok: false; reason: 'noTopUp'; overage: number }

/**
 * 1人分の控除内訳を算出（現行 calcDeductDetail と1:1）。
 * チェックONかつ金額>0 の項目のみ採用。順序は 家賃補助 → 交通費 → その他。
 */
export function calcDeductDetail(p: PersonDeductInput): { total: number; items: DeductItem[] } {
  const items: DeductItem[] = []
  if (p.rentCheck) {
    const a = Number(p.rent) || 0
    if (a) items.push({ label: '家賃補助', amount: a })
  }
  if (p.transCheck) {
    const a = Number(p.trans) || 0
    if (a) items.push({ label: '交通費', amount: a })
  }
  if (p.otherCheck) {
    p.others.forEach(o => {
      const a = Number(o.amount) || 0
      if (a) items.push({ label: o.desc || 'その他', amount: a })
    })
  }
  return { total: items.reduce((s, i) => s + i.amount, 0), items }
}

/**
 * 振込額を算出（現行 calculate() の数式部分と1:1）。
 * 前提: 目標残高・給料・対象月の未入力チェックは呼び出し側で済ませていること。
 */
export function calculateTransfer(input: TransferCalcInput): TransferCalcOutcome {
  const { targetBalance: target, currentBalance: currentBal, salaryShota, salaryMiyu } = input

  const shotaDetail = calcDeductDetail(input.shota)
  const miyuDetail = calcDeductDetail(input.miyu)
  const netShota = salaryShota - shotaDetail.total
  const netMiyu = salaryMiyu - miyuDetail.total

  if (netShota <= 0 || netMiyu <= 0) {
    return { ok: false, reason: 'nonPositiveNet' }
  }

  const total = netShota + netMiyu
  const ratioShota = netShota / total
  const ratioMiyu = netMiyu / total
  const topUp = target - currentBal

  if (topUp <= 0) {
    // overage = 目標を上回っている額（正の値）。topUp===0 の -0 を避けて 0 に正規化。
    return { ok: false, reason: 'noTopUp', overage: topUp < 0 ? -topUp : 0 }
  }

  const transShota = Math.round(topUp * ratioShota)
  const transMiyu = topUp - transShota // 端数はmiyu側で吸収（合計=topUpを保証）

  return {
    ok: true,
    result: {
      topUp,
      target,
      currentBal,
      salaryShota,
      salaryMiyu,
      shotaDeduct: shotaDetail.total,
      miyuDeduct: miyuDetail.total,
      shotaDeductItems: shotaDetail.items,
      miyuDeductItems: miyuDetail.items,
      netShota,
      netMiyu,
      ratioShota,
      ratioMiyu,
      transShota,
      transMiyu,
    },
  }
}
