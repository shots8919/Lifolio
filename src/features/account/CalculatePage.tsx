import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { DeductItem } from '@/types'

// ─── ローカル型定義 ───────────────────────────────────
interface OtherItem { desc: string; amount: string }
interface PersonState {
  rentCheck: boolean; rent: string
  transCheck: boolean; trans: string
  otherCheck: boolean; others: OtherItem[]
}
interface SettingsState {
  targetBalance: string
  shota: PersonState
  miyu: PersonState
}
interface FormState {
  month: string
  salaryShota: string
  salaryMiyu: string
  currentBalance: string
}
interface CalcResult {
  topUp: number; target: number; currentBal: number
  salaryShota: number; salaryMiyu: number
  shotaDeduct: number; miyuDeduct: number
  shotaDeductItems: DeductItem[]; miyuDeductItems: DeductItem[]
  netShota: number; netMiyu: number
  ratioShota: number; ratioMiyu: number
  transShota: number; transMiyu: number
}

// ─── ヘルパー ─────────────────────────────────────────
const getCurrentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const fmt = (n: number) => Number(n).toLocaleString('ja-JP')
const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${y}年${Number(m)}月`
}
const defaultPerson = (): PersonState => ({
  rentCheck: false, rent: '',
  transCheck: false, trans: '',
  otherCheck: false, others: [],
})
const defaultSettings = (): SettingsState => ({
  targetBalance: '', shota: defaultPerson(), miyu: defaultPerson(),
})

// ─── コンポーネント ───────────────────────────────────
export default function CalculatePage() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'shota' | 'miyu'>('shota')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [form, setForm] = useState<FormState>({
    month: getCurrentMonth(), salaryShota: '', salaryMiyu: '', currentBalance: '',
  })
  const [result, setResult] = useState<CalcResult | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState({ message: '', show: false })

  useEffect(() => { loadSettings() }, [])

  const showToast = (message: string) => {
    setToast({ message, show: true })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2600)
  }

  // ─── Supabase 設定 読み込み ────────────────────────
  const loadSettings = async () => {
    const { data } = await supabase
      .from('account_settings')
      .select('value')
      .eq('key', 'user_settings')
      .single()
    if (!data?.value) return
    const s = data.value as Record<string, unknown>
    const parsePerson = (p: Record<string, unknown>): PersonState => ({
      rentCheck: Boolean(p.rentCheck),
      rent: p.rent ? String(p.rent) : '',
      transCheck: Boolean(p.transCheck),
      trans: p.trans ? String(p.trans) : '',
      otherCheck: Boolean(p.otherCheck),
      others: Array.isArray(p.others)
        ? (p.others as Array<Record<string, unknown>>).map(o => ({ desc: String(o.desc ?? ''), amount: String(o.amount ?? '') }))
        : [],
    })
    setSettings({
      targetBalance: s.targetBalance ? String(s.targetBalance) : '',
      shota: parsePerson((s.shota ?? {}) as Record<string, unknown>),
      miyu: parsePerson((s.miyu ?? {}) as Record<string, unknown>),
    })
  }

  // ─── Supabase 設定 保存 ────────────────────────────
  const saveSettings = async () => {
    setSettingsSaving(true)
    const toNum = (v: string) => Number(v) || 0
    const serializePerson = (p: PersonState) => ({
      rentCheck: p.rentCheck, rent: toNum(p.rent),
      transCheck: p.transCheck, trans: toNum(p.trans),
      otherCheck: p.otherCheck,
      others: p.others.map(o => ({ desc: o.desc, amount: toNum(o.amount) })),
    })
    const value = {
      targetBalance: toNum(settings.targetBalance),
      shota: serializePerson(settings.shota),
      miyu: serializePerson(settings.miyu),
    }
    const { error } = await supabase.from('account_settings').upsert({ key: 'user_settings', value })
    showToast(error ? '設定の保存に失敗しました' : '設定を保存しました')
    setSettingsSaving(false)
  }

  // ─── 控除計算 ───────────────────────────────────────
  const calcDeductDetail = (person: 'shota' | 'miyu') => {
    const p = settings[person]
    const items: DeductItem[] = []
    if (p.rentCheck) { const a = Number(p.rent) || 0; if (a) items.push({ label: '家賃補助', amount: a }) }
    if (p.transCheck) { const a = Number(p.trans) || 0; if (a) items.push({ label: '交通費', amount: a }) }
    if (p.otherCheck) {
      p.others.forEach(o => {
        const a = Number(o.amount) || 0
        if (a) items.push({ label: o.desc || 'その他', amount: a })
      })
    }
    return { total: items.reduce((s, i) => s + i.amount, 0), items }
  }

  // ─── 計算実行 ───────────────────────────────────────
  const calculate = () => {
    const target = Number(settings.targetBalance)
    const salaryShota = Number(form.salaryShota)
    const salaryMiyu = Number(form.salaryMiyu)
    const currentBal = Number(form.currentBalance)

    if (!target) { showToast('設定で目標残高を入力してください'); return }
    if (!salaryShota || !salaryMiyu) { showToast('二人の給料を入力してください'); return }
    if (!form.month) { showToast('対象年月を選択してください'); return }

    const shotaDetail = calcDeductDetail('shota')
    const miyuDetail = calcDeductDetail('miyu')
    const netShota = salaryShota - shotaDetail.total
    const netMiyu = salaryMiyu - miyuDetail.total

    if (netShota <= 0 || netMiyu <= 0) { showToast('控除後の給料が0以下になっています'); return }

    const total = netShota + netMiyu
    const ratioShota = netShota / total
    const ratioMiyu = netMiyu / total
    const topUp = target - currentBal

    if (topUp <= 0) { showToast(`口座残高が目標を ${fmt(-topUp)} 円上回っています — 振込不要`); return }

    const transShota = Math.round(topUp * ratioShota)
    const transMiyu = topUp - transShota

    setResult({
      topUp, target, currentBal,
      salaryShota, salaryMiyu,
      shotaDeduct: shotaDetail.total, miyuDeduct: miyuDetail.total,
      shotaDeductItems: shotaDetail.items, miyuDeductItems: miyuDetail.items,
      netShota, netMiyu, ratioShota, ratioMiyu, transShota, transMiyu,
    })
  }

  // ─── 確定・保存 ─────────────────────────────────────
  const confirmResult = async () => {
    if (!result) return
    setConfirming(true)
    try {
      const { data: existing } = await supabase
        .from('account_records').select('id').eq('month', form.month).single()
      if (existing) {
        if (!window.confirm(`${fmtMonth(form.month)} の記録が既にあります。上書きしますか？`)) { setConfirming(false); return }
        await supabase.from('account_records').delete().eq('month', form.month)
      }
      const { error } = await supabase.from('account_records').insert({
        month: form.month,
        target_balance: result.target, current_balance: result.currentBal,
        salary_shota: result.salaryShota, salary_miyu: result.salaryMiyu,
        shota_deduct: result.shotaDeduct, miyu_deduct: result.miyuDeduct,
        shota_deduct_items: result.shotaDeductItems, miyu_deduct_items: result.miyuDeductItems,
        net_shota: result.netShota, net_miyu: result.netMiyu,
        ratio_shota: result.ratioShota, ratio_miyu: result.ratioMiyu,
        trans_shota: result.transShota, trans_miyu: result.transMiyu,
        confirmed_at: new Date().toISOString(),
      })
      if (error) { showToast('保存に失敗しました'); return }
      showToast(`${fmtMonth(form.month)} を確定しました`)
      setResult(null)
      setForm(f => ({ ...f, salaryShota: '', salaryMiyu: '', currentBalance: '', month: getCurrentMonth() }))
    } finally {
      setConfirming(false)
    }
  }

  // ─── 設定パネルのヘルパー ───────────────────────────
  const updatePerson = <K extends keyof PersonState>(person: 'shota' | 'miyu', field: K, value: PersonState[K]) =>
    setSettings(s => ({ ...s, [person]: { ...s[person], [field]: value } }))

  const addOther = (person: 'shota' | 'miyu') =>
    setSettings(s => ({ ...s, [person]: { ...s[person], others: [...s[person].others, { desc: '', amount: '' }] } }))

  const updateOther = (person: 'shota' | 'miyu', idx: number, field: 'desc' | 'amount', value: string) =>
    setSettings(s => ({
      ...s, [person]: {
        ...s[person],
        others: s[person].others.map((o, i) => i === idx ? { ...o, [field]: value } : o),
      },
    }))

  const removeOther = (person: 'shota' | 'miyu', idx: number) =>
    setSettings(s => ({ ...s, [person]: { ...s[person], others: s[person].others.filter((_, i) => i !== idx) } }))

  const pc = {
    shota: { text: 'var(--shota)', bg: 'var(--shota-bg)', bd: 'var(--shota-bd)' },
    miyu: { text: 'var(--miyu)', bg: 'var(--miyu-bg)', bd: 'var(--miyu-bd)' },
  }

  // ─── 共通スタイル ───────────────────────────────────
  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)' }
  const inputStyle = (disabled?: boolean) => ({
    border: '1px solid var(--border)',
    color: disabled ? 'var(--muted)' : 'var(--text)',
    background: disabled ? 'var(--subtle)' : 'var(--surface)',
  })

  // ─── JSX ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>振込額計算</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>共有口座管理 › 振込額計算</p>
      </div>

      {/* ── 設定カード ─────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left"
          onClick={() => setSettingsOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>設定</span>
            {settings.targetBalance && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--subtle)', color: 'var(--muted)' }}>
                目標 ¥{fmt(Number(settings.targetBalance))}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {settingsOpen && (
              <button
                onClick={e => { e.stopPropagation(); void saveSettings() }}
                disabled={settingsSaving}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity disabled:opacity-50"
                style={{ background: 'var(--shota)' }}
              >
                {settingsSaving ? '保存中...' : '保存'}
              </button>
            )}
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              className={`transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}
            >
              <path d="M4 6l4 4 4-4" stroke="var(--muted)" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        </button>

        {settingsOpen && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {/* 目標残高 */}
            <div className="px-5 pt-4 pb-3">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>目標残高（円）</label>
              <input
                type="number" min="0" step="1000" placeholder="100,000"
                value={settings.targetBalance}
                onChange={e => setSettings(s => ({ ...s, targetBalance: e.target.value }))}
                className="mt-1.5 h-9 px-3 rounded-lg text-sm outline-none block"
                style={{ ...inputStyle(), minWidth: 180 }}
              />
            </div>

            {/* 人物タブ */}
            <div className="flex" style={{ borderTop: '1px solid var(--border)' }}>
              {(['shota', 'miyu'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setActiveTab(p)}
                  className="flex-1 py-3 text-sm font-semibold transition-colors relative"
                  style={{
                    color: activeTab === p ? pc[p].text : 'var(--muted)',
                    background: activeTab === p ? pc[p].bg : 'transparent',
                    borderBottom: activeTab === p ? `2px solid ${pc[p].text}` : '2px solid transparent',
                  }}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>

            {/* 人物別設定 */}
            {(['shota', 'miyu'] as const).map(p =>
              activeTab === p && (
                <div key={p} className="px-5 py-4 space-y-3">
                  {/* 家賃補助 */}
                  {[
                    { key: 'rent' as const, checkKey: 'rentCheck' as const, label: '家賃補助' },
                    { key: 'trans' as const, checkKey: 'transCheck' as const, label: '交通費' },
                  ].map(row => (
                    <div key={row.key} className="flex items-center gap-3">
                      <input type="checkbox" id={`${p}-${row.key}`}
                        checked={settings[p][row.checkKey]}
                        onChange={e => updatePerson(p, row.checkKey, e.target.checked)}
                        className="rounded accent-[var(--shota)]"
                      />
                      <label htmlFor={`${p}-${row.key}`} className="text-sm flex-1" style={{ color: 'var(--text)' }}>
                        {row.label}
                      </label>
                      <input
                        type="number" min="0" step="1000" placeholder="金額（円）"
                        value={settings[p][row.key]}
                        onChange={e => updatePerson(p, row.key, e.target.value)}
                        disabled={!settings[p][row.checkKey]}
                        className="h-9 px-3 rounded-lg text-sm outline-none"
                        style={{ ...inputStyle(!settings[p][row.checkKey]), width: 160 }}
                      />
                    </div>
                  ))}

                  {/* その他免除 */}
                  <div>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" id={`${p}-other`}
                        checked={settings[p].otherCheck}
                        onChange={e => updatePerson(p, 'otherCheck', e.target.checked)}
                        className="rounded accent-[var(--shota)]"
                      />
                      <label htmlFor={`${p}-other`} className="text-sm flex-1" style={{ color: 'var(--text)' }}>その他免除</label>
                      <button
                        onClick={() => addOther(p)}
                        disabled={!settings[p].otherCheck}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-40"
                        style={{ background: 'var(--subtle)', color: 'var(--text)' }}
                      >
                        + 追加
                      </button>
                    </div>
                    {settings[p].others.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {settings[p].others.map((o, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="text" placeholder="免除内容"
                              value={o.desc}
                              onChange={e => updateOther(p, i, 'desc', e.target.value)}
                              disabled={!settings[p].otherCheck}
                              className="flex-1 h-8 px-2.5 rounded-lg text-sm outline-none"
                              style={inputStyle(!settings[p].otherCheck)}
                            />
                            <input
                              type="number" min="0" step="1000" placeholder="金額（円）"
                              value={o.amount}
                              onChange={e => updateOther(p, i, 'amount', e.target.value)}
                              disabled={!settings[p].otherCheck}
                              className="h-8 px-2.5 rounded-lg text-sm outline-none"
                              style={{ ...inputStyle(!settings[p].otherCheck), width: 120 }}
                            />
                            <button
                              onClick={() => removeOther(p, i)}
                              disabled={!settings[p].otherCheck}
                              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-40"
                              style={{ background: 'var(--subtle)', color: 'var(--muted)' }}
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ── 入力フォームカード ───────────────────────── */}
      <div className="rounded-xl" style={cardStyle}>
        <div className="flex items-center px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>今月の入力</span>
        </div>
        <div className="p-5 space-y-5">
          {/* 対象年月 */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>対象年月</label>
            <input
              type="month" value={form.month}
              onChange={e => setForm(f => ({ ...f, month: e.target.value }))}
              className="mt-1.5 h-9 px-3 rounded-lg text-sm outline-none block"
              style={inputStyle()}
            />
          </div>

          {/* 給料入力（2カラム） */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['shota', 'miyu'] as const).map((p, i) => (
              <div
                key={p}
                className="p-4"
                style={{ borderBottom: i === 0 ? '1px solid var(--border)' : undefined }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: pc[p].text }} />
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: pc[p].text }}>{p}</span>
                </div>
                <label className="text-xs" style={{ color: 'var(--muted)' }}>給料（円）</label>
                <input
                  type="number" min="0" step="1000" placeholder="金額（円）"
                  value={form[p === 'shota' ? 'salaryShota' : 'salaryMiyu']}
                  onChange={e => setForm(f => ({ ...f, [p === 'shota' ? 'salaryShota' : 'salaryMiyu']: e.target.value }))}
                  className="mt-1.5 w-full h-9 px-3 rounded-lg text-sm outline-none font-mono"
                  style={inputStyle()}
                />
              </div>
            ))}
          </div>

          {/* 現在残高 */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>現在の口座残高（円）</label>
            <input
              type="number" min="0" step="1000" placeholder="金額（円）"
              value={form.currentBalance}
              onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))}
              className="mt-1.5 h-9 px-3 rounded-lg text-sm outline-none font-mono block"
              style={{ ...inputStyle(), minWidth: 200 }}
            />
          </div>

          <button
            onClick={calculate}
            className="w-full sm:w-auto px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--shota)' }}
          >
            計算する
          </button>
        </div>
      </div>

      {/* ── 計算結果カード ───────────────────────────── */}
      {result && (
        <div className="rounded-xl" style={cardStyle}>
          <div className="flex items-center px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              計算結果 — {fmtMonth(form.month)}
            </span>
          </div>

          <div className="p-5 space-y-5">
            {/* ステータス3ボックス */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '需追金額', value: result.topUp, color: 'var(--danger)' },
                { label: '目標残高', value: result.target, color: undefined },
                { label: '現在残高', value: result.currentBal, color: undefined },
              ].map((s, i) => (
                <div key={i} className="rounded-xl p-3 text-center" style={{ background: 'var(--subtle)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
                    {s.label}
                  </div>
                  <div className="text-lg font-bold font-mono leading-tight" style={{ color: s.color ?? 'var(--text)' }}>
                    {fmt(s.value)}
                    <span className="text-xs font-sans font-normal ml-0.5" style={{ color: 'var(--muted)' }}>円</span>
                  </div>
                </div>
              ))}
            </div>

            {/* 比率バー */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span style={{ color: 'var(--shota)' }}>SHOTA {(result.ratioShota * 100).toFixed(1)}%</span>
                <span style={{ color: 'var(--miyu)' }}>MIYU {(result.ratioMiyu * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--miyu-bg)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(result.ratioShota * 100).toFixed(1)}%`, background: 'var(--shota)' }}
                />
              </div>
            </div>

            {/* 振込額カード */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['shota', 'miyu'] as const).map(p => {
                const items = p === 'shota' ? result.shotaDeductItems : result.miyuDeductItems
                const deduct = p === 'shota' ? result.shotaDeduct : result.miyuDeduct
                const salary = p === 'shota' ? result.salaryShota : result.salaryMiyu
                const net = p === 'shota' ? result.netShota : result.netMiyu
                const trans = p === 'shota' ? result.transShota : result.transMiyu
                return (
                  <div key={p} className="rounded-xl p-4" style={{ background: pc[p].bg, border: `1px solid ${pc[p].bd}` }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: pc[p].text }} />
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: pc[p].text }}>{p}</span>
                    </div>
                    <div className="text-2xl font-bold font-mono leading-tight" style={{ color: pc[p].text }}>
                      {fmt(trans)}
                      <span className="text-sm font-sans font-normal ml-0.5" style={{ color: 'var(--muted)' }}>円</span>
                    </div>
                    <div className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                      給料 {fmt(salary)}{deduct > 0 && ` − 控除 ${fmt(deduct)} = 実質 ${fmt(net)}`} 円
                    </div>
                    {items.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {items.map((item, i) => (
                          <div key={i} className="text-xs flex justify-between" style={{ color: 'var(--muted)' }}>
                            <span>{item.label}</span>
                            <span className="font-mono">−{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ボタン */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void confirmResult()}
                disabled={confirming}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--success)' }}
              >
                {confirming ? '保存中...' : '確定する'}
              </button>
              <button
                onClick={() => setResult(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'var(--subtle)', color: 'var(--text)' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-lg z-50 pointer-events-none transition-all duration-300 ${
          toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        style={{ background: '#1f2937' }}
      >
        {toast.message}
      </div>
    </div>
  )
}
