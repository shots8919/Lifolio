export interface DeductItem {
  label: string
  amount: number
}

export interface AccountRecord {
  id?: string
  created_at?: string
  month: string
  target_balance: number
  current_balance: number
  salary_shota: number
  salary_miyu: number
  shota_deduct: number
  miyu_deduct: number
  shota_deduct_items: DeductItem[]
  miyu_deduct_items: DeductItem[]
  net_shota: number
  net_miyu: number
  ratio_shota: number
  ratio_miyu: number
  trans_shota: number
  trans_miyu: number
  confirmed_at: string
}
