import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AccountRecord } from '@/types'

const fmt = (n: number) => Number(n).toLocaleString('ja-JP')
const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${y}年${Number(m)}月`
}

export default function DataPage() {
  const [records, setRecords] = useState<AccountRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadRecords()
  }, [])

  const loadRecords = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('account_records')
      .select('*')
      .order('month', { ascending: false })
    if (data) setRecords(data as AccountRecord[])
    setLoading(false)
  }

  const deleteRecord = async (id: string, month: string) => {
    if (!window.confirm(`${fmtMonth(month)} のデータを削除しますか？`)) return
    await supabase.from('account_records').delete().eq('id', id)
    setRecords(r => r.filter(rec => rec.id !== id))
  }

  const exportCSV = () => {
    const headers = [
      '年月', 'SHOTA給料', 'MIYU給料', 'SHOTA控除', 'MIYU控除',
      '目標残高', '現在残高', 'SHOTA振込', 'MIYU振込', '確定日',
    ]
    const rows = records.map(r => [
      r.month, r.salary_shota, r.salary_miyu,
      r.shota_deduct, r.miyu_deduct,
      r.target_balance, r.current_balance,
      r.trans_shota, r.trans_miyu,
      r.confirmed_at?.slice(0, 10) ?? '',
    ])
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lifolio_account_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tdClass = 'px-4 py-3 text-sm whitespace-nowrap'

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>データ照会</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>共有口座管理 › データ照会</p>
        </div>
        {records.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0 transition-colors hover:opacity-80"
            style={{ background: 'var(--subtle)', color: 'var(--text)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5v8M4.5 7L7 9.5 9.5 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 10.5v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            CSV出力
          </button>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>読み込み中...</div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-sm" style={{ color: 'var(--muted)' }}>まだ確定済みのデータはありません</div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>振込額計算で確定するとここに表示されます</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--subtle)', borderBottom: '1px solid var(--border)' }}>
                  {['年月', 'SHOTA給料', 'MIYU給料', 'SHOTA控除', 'MIYU控除', '目標残高', '現在残高', 'SHOTA振込', 'MIYU振込', ''].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-[11px] font-semibold text-left uppercase tracking-wide whitespace-nowrap"
                      style={{ color: 'var(--muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: i < records.length - 1 ? '1px solid var(--border)' : undefined }}
                  >
                    <td className={tdClass} style={{ color: 'var(--text)' }}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--shota)' }} />
                        {fmtMonth(r.month)}
                      </div>
                    </td>
                    <td className={`${tdClass} font-mono text-right`} style={{ color: 'var(--text)' }}>{fmt(r.salary_shota)}</td>
                    <td className={`${tdClass} font-mono text-right`} style={{ color: 'var(--text)' }}>{fmt(r.salary_miyu)}</td>
                    <td className={`${tdClass} font-mono text-right`} style={{ color: 'var(--muted)' }}>{fmt(r.shota_deduct)}</td>
                    <td className={`${tdClass} font-mono text-right`} style={{ color: 'var(--muted)' }}>{fmt(r.miyu_deduct)}</td>
                    <td className={`${tdClass} font-mono text-right`} style={{ color: 'var(--muted)' }}>{fmt(r.target_balance)}</td>
                    <td className={`${tdClass} font-mono text-right`} style={{ color: 'var(--muted)' }}>{fmt(r.current_balance)}</td>
                    <td className={`${tdClass} font-mono text-right font-semibold`} style={{ color: 'var(--shota)' }}>{fmt(r.trans_shota)}</td>
                    <td className={`${tdClass} font-mono text-right font-semibold`} style={{ color: 'var(--miyu)' }}>{fmt(r.trans_miyu)}</td>
                    <td className={tdClass}>
                      <button
                        onClick={() => r.id && void deleteRecord(r.id, r.month)}
                        className="text-xs px-2.5 py-1 rounded-lg transition-colors hover:opacity-70"
                        style={{ background: 'var(--subtle)', color: 'var(--muted)' }}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
