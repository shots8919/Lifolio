import { useState, useEffect, useCallback } from 'react'
import { useMealStore } from '@/stores/mealStore'
import AiProposalPanel from './AiProposalPanel'
import type { MealPlan, MealSlotType, MealRecipe } from '@/types/meal'

const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土']

// ─── 日付ユーティリティ ─────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getWeekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(monday, i)))
}

// ─── 献立スロット編集モーダル ────────────────────────────────────

interface SlotEditModalProps {
  date: string
  mealType: MealSlotType
  current: MealPlan | null
  recipes: MealRecipe[]
  onClose: () => void
  onSave: (plan: Omit<MealPlan, 'id' | 'created_at' | 'recipe'>) => Promise<void>
  onDelete: () => Promise<void>
}

function SlotEditModal({ date, mealType, current, recipes, onClose, onSave, onDelete }: SlotEditModalProps) {
  const [mode, setMode] = useState<'recipe' | 'free'>(current?.recipe_id ? 'recipe' : 'free')
  const [recipeId, setRecipeId] = useState(current?.recipe_id ?? '')
  const [freeText, setFreeText] = useState(current?.free_text ?? current?.recipe?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const slotLabel = mealType === 'dinner' ? '夜' : '昼'
  const d = new Date(date + 'T00:00:00')
  const dateLabel = `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_JP[d.getDay()]}) ${slotLabel}`

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    color: 'var(--text)',
    background: 'var(--surface)',
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (mode === 'recipe') {
        if (!recipeId) return
        await onSave({ date, meal_type: mealType, recipe_id: recipeId, free_text: null, ai_proposal: false })
      } else {
        if (!freeText.trim()) return
        await onSave({ date, meal_type: mealType, recipe_id: null, free_text: freeText.trim(), ai_proposal: false })
      }
      onClose()
    } catch {
      /* noop */
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('この献立を削除しますか？')) return
    setDeleting(true)
    try {
      await onDelete()
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{dateLabel}</h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-lg hover:bg-black/5" style={{ color: 'var(--muted)' }}>×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* 入力モード切替 */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            {(['recipe', 'free'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex-1 h-8 text-xs font-medium transition-colors"
                style={{
                  background: mode === m ? 'var(--shota)' : 'var(--surface)',
                  color: mode === m ? 'white' : 'var(--muted)',
                }}
              >
                {m === 'recipe' ? 'レシピから選ぶ' : '自由入力'}
              </button>
            ))}
          </div>

          {mode === 'recipe' ? (
            <select
              value={recipeId}
              onChange={e => setRecipeId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none"
              style={inputStyle}
            >
              <option value="">レシピを選択...</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>{r.name}（{r.genre}・{r.type}）</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="料理名を入力..."
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              autoFocus
              className="w-full h-10 px-3 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || (mode === 'recipe' ? !recipeId : !freeText.trim())}
              className="flex-1 h-10 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--shota)' }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {current && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="h-10 px-3 rounded-xl text-sm transition-opacity hover:opacity-80"
                style={{ color: 'var(--danger)', border: '1px solid var(--border)' }}
              >
                削除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 単一の献立スロット ─────────────────────────────────────────

interface MealSlotProps {
  plan: MealPlan | null
  date: string
  mealType: MealSlotType
  onEdit: (date: string, mealType: MealSlotType) => void
}

function MealSlot({ plan, date, mealType, onEdit }: MealSlotProps) {
  const isLunch = mealType === 'lunch'
  const name = plan?.recipe?.name ?? plan?.free_text ?? null

  if (!name) {
    return (
      <button
        onClick={() => onEdit(date, mealType)}
        className="w-full text-center rounded-lg border-dashed border transition-colors hover:bg-black/5 active:bg-black/10"
        style={{
          borderColor: 'var(--border)',
          color: 'var(--muted)',
          minHeight: 32,
          padding: '4px 2px',
          fontSize: 13,
        }}
      >
        <span className="text-[10px] block" style={{ color: isLunch ? 'var(--shota)' : 'var(--miyu)', opacity: 0.7 }}>
          {isLunch ? '☀️昼' : '🌙夜'}
        </span>
        <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>
      </button>
    )
  }

  return (
    <button
      onClick={() => onEdit(date, mealType)}
      className="w-full text-left rounded-lg transition-opacity hover:opacity-80 active:opacity-60"
      style={{
        background: plan?.ai_proposal ? 'var(--miyu-bg)' : 'var(--shota-bg)',
        border: `1px solid ${plan?.ai_proposal ? 'var(--miyu-bd)' : 'var(--shota-bd)'}`,
        minHeight: 32,
        padding: '3px 4px',
      }}
    >
      <span className="text-[9px] block" style={{ color: isLunch ? 'var(--shota)' : 'var(--miyu)', opacity: 0.8 }}>
        {isLunch ? '☀️昼' : '🌙夜'}
      </span>
      <span
        className="block text-[11px] font-medium leading-tight"
        style={{
          color: plan?.ai_proposal ? 'var(--miyu)' : 'var(--shota)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {name}
      </span>
    </button>
  )
}

// ─── メインページ ──────────────────────────────────────────────

export default function PlanPage() {
  const weekPlans    = useMealStore(s => s.weekPlans)
  const recipes      = useMealStore(s => s.recipes)
  const loadWeekPlans = useMealStore(s => s.loadWeekPlans)
  const upsertPlan   = useMealStore(s => s.upsertPlan)
  const deletePlan   = useMealStore(s => s.deletePlan)

  const [weekOffset, setWeekOffset] = useState(0)
  const [showAi, setShowAi] = useState(false)
  const [editTarget, setEditTarget] = useState<{ date: string; mealType: MealSlotType } | null>(null)

  const monday = getMonday(addDays(new Date(), weekOffset * 7))
  const weekDates = getWeekDates(monday)
  const sunday = weekDates[6]

  const fmt = (d: string) => {
    const dt = new Date(d + 'T00:00:00')
    return `${dt.getMonth() + 1}/${dt.getDate()}`
  }

  const weekLabel = `${fmt(weekDates[0])}(月) 〜 ${fmt(sunday)}(日)`

  useEffect(() => {
    loadWeekPlans(weekDates[0], sunday)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  const getPlan = useCallback(
    (date: string, mealType: MealSlotType) =>
      weekPlans.find(p => p.date === date && p.meal_type === mealType) ?? null,
    [weekPlans],
  )

  const handleSaveMeal = async (date: string, mealType: MealSlotType, dishName: string) => {
    await upsertPlan({ date, meal_type: mealType, recipe_id: null, free_text: dishName, ai_proposal: true })
  }

  const handleEdit = (date: string, mealType: MealSlotType) => {
    setEditTarget({ date, mealType })
  }

  const handleSaveSlot = async (plan: Omit<MealPlan, 'id' | 'created_at' | 'recipe'>) => {
    await upsertPlan(plan)
  }

  const handleDeleteSlot = async () => {
    if (!editTarget) return
    const plan = getPlan(editTarget.date, editTarget.mealType)
    if (plan?.id) await deletePlan(plan.id)
  }

  const isToday = (dateStr: string) => toIsoDate(new Date()) === dateStr

  return (
    <div className="space-y-4">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>献立計画</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{weekLabel}</p>
        </div>
        <button
          onClick={() => setShowAi(a => !a)}
          className="h-9 px-4 rounded-xl text-sm font-medium transition-all"
          style={{
            background: showAi ? 'var(--miyu)' : 'var(--miyu-bg)',
            color: showAi ? 'white' : 'var(--miyu)',
            border: '1px solid var(--miyu-bd)',
          }}
        >
          ✨ AI提案
        </button>
      </div>

      {/* 週ナビゲーション */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          ‹
        </button>
        <button
          onClick={() => setWeekOffset(0)}
          className="flex-1 h-9 rounded-xl text-xs font-medium transition-colors hover:bg-black/5"
          style={{ border: '1px solid var(--border)', color: weekOffset === 0 ? 'var(--shota)' : 'var(--muted)' }}
        >
          今週
        </button>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-black/5"
          style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          ›
        </button>
      </div>

      {/* AI提案パネル */}
      {showAi && <AiProposalPanel onSaveMeal={handleSaveMeal} />}

      {/* 週間カレンダー（横スクロール対応） */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: '420px' }}>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border)' }}>
              {weekDates.map(date => {
                const d = new Date(date + 'T00:00:00')
                const day = d.getDay()
                return (
                  <div
                    key={date}
                    className="py-2 text-center"
                    style={{
                      background: isToday(date) ? 'var(--shota-bg)' : 'transparent',
                      borderRight: '1px solid var(--border)',
                    }}
                  >
                    <div
                      className="text-[11px] font-bold"
                      style={{ color: isToday(date) ? 'var(--shota)' : day === 0 ? '#ef4444' : day === 6 ? '#3b82f6' : 'var(--muted)' }}
                    >
                      {WEEKDAY_JP[day]}
                    </div>
                    <div
                      className="text-[12px] font-semibold mt-0.5"
                      style={{
                        width: 22, height: 22, lineHeight: '22px',
                        borderRadius: '50%',
                        background: isToday(date) ? 'var(--shota)' : 'transparent',
                        color: isToday(date) ? 'white' : 'var(--text)',
                        margin: '2px auto 0',
                        textAlign: 'center',
                      }}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 献立スロット */}
            <div className="grid grid-cols-7">
              {weekDates.map(date => (
                <div
                  key={date}
                  className="p-1 space-y-1"
                  style={{
                    borderRight: '1px solid var(--border)',
                    background: isToday(date) ? 'var(--shota-bg)' : 'transparent',
                    minHeight: 80,
                  }}
                >
                  {/* 夜スロット */}
                  <MealSlot plan={getPlan(date, 'dinner')} date={date} mealType="dinner" onEdit={handleEdit} />
                  {/* 昼スロット（常時表示） */}
                  <MealSlot plan={getPlan(date, 'lunch')} date={date} mealType="lunch" onEdit={handleEdit} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex gap-4 text-[11px]" style={{ color: 'var(--muted)' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--shota-bg)', border: '1px solid var(--shota-bd)' }} />
          手動入力
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded" style={{ background: 'var(--miyu-bg)', border: '1px solid var(--miyu-bd)' }} />
          AI提案
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-base leading-none">☀️</span> 昼
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-base leading-none">🌙</span> 夜
        </span>
      </div>

      {/* スロット編集モーダル */}
      {editTarget && (
        <SlotEditModal
          date={editTarget.date}
          mealType={editTarget.mealType}
          current={getPlan(editTarget.date, editTarget.mealType)}
          recipes={recipes}
          onClose={() => setEditTarget(null)}
          onSave={handleSaveSlot}
          onDelete={handleDeleteSlot}
        />
      )}
    </div>
  )
}
