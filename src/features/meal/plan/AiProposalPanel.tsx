import { useState, useRef, useEffect } from 'react'
import { useMealStore } from '@/stores/mealStore'
import { generateMealProposal, continueMealChat, generateShoppingList, GeminiError } from '@/lib/gemini'
import type { AiProposedMeal, ChatMessage, MealRecipe, ShoppingItem, DishRole } from '@/types/meal'
import { DISH_ROLE_LABELS } from '@/types/meal'

const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土']

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_JP[d.getDay()]})`
}

function todayIsoString(): string {
  return new Date().toISOString().split('T')[0]
}

const DIFFICULTY_LABEL = ['', '★ 簡単', '★★ 普通', '★★★ 本格']

const DISH_ROLE_COLORS: Record<DishRole, { bg: string; border: string; text: string }> = {
  main:   { bg: 'var(--miyu-bg)',   border: 'var(--miyu-bd)',   text: 'var(--miyu)' },
  side:   { bg: 'var(--shota-bg)',  border: 'var(--shota-bd)',  text: 'var(--shota)' },
  soup:   { bg: '#fef3c7',          border: '#fde68a',          text: '#d97706' },
  single: { bg: 'var(--shota-bg)',  border: 'var(--shota-bd)',  text: 'var(--shota)' },
}

// ─── 食事カード ─────────────────────────────────────────────────────────────

interface MealCardProps {
  meal: AiProposedMeal
  recipes: MealRecipe[]
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (updated: Partial<AiProposedMeal>) => void
  onDelete: () => void
}

function MealCard({ meal, recipes, isEditing, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: MealCardProps) {
  const [showSteps, setShowSteps] = useState(false)
  const [editMode, setEditMode] = useState<'free' | 'recipe'>('free')
  const [editText, setEditText] = useState(meal.dish_name)
  const [editRecipeId, setEditRecipeId] = useState(meal._recipeId ?? '')

  const colors = DISH_ROLE_COLORS[meal.dish_role]
  const isLunch = meal.meal_type === 'lunch'

  const inputStyle: React.CSSProperties = { border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }

  const handleSave = () => {
    if (editMode === 'recipe' && editRecipeId) {
      const r = recipes.find(r => r.id === editRecipeId)
      onSaveEdit({
        dish_name: r?.name ?? editText,
        _recipeId: editRecipeId,
        ingredients: r?.ingredients ?? meal.ingredients,
        steps: r?.steps ?? meal.steps,
      })
    } else if (editText.trim()) {
      onSaveEdit({ dish_name: editText.trim(), _recipeId: undefined })
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: colors.bg }}>
        <div className="flex items-center gap-2">
          <span className="text-base">{isLunch ? '☀️' : '🌙'}</span>
          <span className="text-[11px] font-bold" style={{ color: colors.text }}>
            {DISH_ROLE_LABELS[meal.dish_role]}
          </span>
          {meal.genre && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ background: colors.text }}>
              {meal.genre}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={isEditing ? onCancelEdit : onStartEdit}
            className="h-6 px-2 rounded-lg text-[10px] font-medium transition-opacity hover:opacity-80"
            style={{ border: `1px solid ${colors.border}`, color: colors.text }}
          >
            {isEditing ? 'キャンセル' : '変更'}
          </button>
          <button
            onClick={onDelete}
            className="h-6 w-6 flex items-center justify-center rounded-lg text-[12px] transition-opacity hover:opacity-80"
            style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
          >
            ×
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="px-3 pt-2.5 pb-3">
        <p className="font-bold text-[15px] leading-snug mb-1.5" style={{ color: 'var(--text)' }}>
          {meal.dish_name}
          {meal._recipeId && (
            <span
              className="ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--shota-bg)', color: 'var(--shota)', border: '1px solid var(--shota-bd)' }}
            >
              レシピあり
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-2 text-[11px]" style={{ color: 'var(--muted)' }}>
          {meal.difficulty != null && <span>{DIFFICULTY_LABEL[meal.difficulty] ?? ''}</span>}
          {meal.duration_min && <span>🕐 {meal.duration_min}分</span>}
        </div>

        {meal.ingredients && (
          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text)' }}>材料: </span>
            {meal.ingredients}
          </p>
        )}

        {meal.note && (
          <p className="text-[11px] mt-1 italic" style={{ color: 'var(--muted)' }}>💡 {meal.note}</p>
        )}

        {meal.steps && (
          <div className="mt-2">
            <button
              onClick={() => setShowSteps(s => !s)}
              className="flex items-center gap-1 text-[11px] font-medium transition-opacity hover:opacity-70"
              style={{ color: colors.text }}
            >
              <span style={{ display: 'inline-block', transform: showSteps ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                ▶
              </span>
              {showSteps ? 'レシピを閉じる' : 'レシピを見る'}
            </button>
            {showSteps && (
              <div
                className="mt-2 p-3 rounded-xl text-[12px] leading-relaxed whitespace-pre-line"
                style={{ background: 'var(--subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                {meal.steps}
              </div>
            )}
          </div>
        )}

        {/* インライン編集フォーム */}
        {isEditing && (
          <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['free', 'recipe'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setEditMode(m)}
                  className="flex-1 h-7 text-[11px] font-medium transition-colors"
                  style={{
                    background: editMode === m ? 'var(--shota)' : 'var(--surface)',
                    color: editMode === m ? 'white' : 'var(--muted)',
                  }}
                >
                  {m === 'recipe' ? 'レシピから選ぶ' : '自由入力'}
                </button>
              ))}
            </div>
            {editMode === 'free' ? (
              <input
                type="text"
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                autoFocus
                className="w-full h-9 px-3 rounded-xl text-sm outline-none"
                style={inputStyle}
              />
            ) : (
              <select
                value={editRecipeId}
                onChange={e => setEditRecipeId(e.target.value)}
                className="w-full h-9 px-3 rounded-xl text-sm outline-none"
                style={inputStyle}
              >
                <option value="">レシピを選択...</option>
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}（{r.genre}・{r.type}）</option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={editMode === 'recipe' ? !editRecipeId : !editText.trim()}
                className="flex-1 h-8 rounded-xl text-xs font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: 'var(--shota)' }}
              >
                保存
              </button>
              <button
                onClick={onCancelEdit}
                className="h-8 px-3 rounded-xl text-xs transition-opacity hover:opacity-80"
                style={{ border: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 買い物リスト ────────────────────────────────────────────────────────────

function ShoppingListSection({ list }: { list: ShoppingItem[] }) {
  const [open, setOpen] = useState(true)
  const grouped: Record<string, ShoppingItem[]> = {}
  list.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  })
  const text = Object.entries(grouped)
    .map(([cat, items]) => `【${cat}】\n` + items.map(i => `・${i.item} ${i.amount}`).join('\n'))
    .join('\n\n')

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--subtle)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          🛒 買い物リスト{' '}
          <span className="font-normal" style={{ color: 'var(--muted)' }}>({list.length}品目)</span>
        </span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="p-4 space-y-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[11px] font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                {cat}
              </p>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm" style={{ color: 'var(--text)' }}>
                    <span>・{item.item}</span>
                    <span style={{ color: 'var(--muted)' }}>{item.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <button
            onClick={() => navigator.clipboard.writeText(text)}
            className="w-full h-9 rounded-xl text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            📋 テキストをコピー
          </button>
        </div>
      )}
    </div>
  )
}

// ─── メインパネル ─────────────────────────────────────────────────────────────

export default function AiProposalPanel() {
  const geminiApiKey     = useMealStore(s => s.geminiApiKey)
  const geminiModelName  = useMealStore(s => s.geminiModelName)
  const preferences      = useMealStore(s => s.preferences)
  const recipes          = useMealStore(s => s.recipes)
  const recentPlans      = useMealStore(s => s.recentPlans)
  const savedProposal    = useMealStore(s => s.savedProposal)
  const saveAiProposal   = useMealStore(s => s.saveAiProposal)
  const saveShoppingList = useMealStore(s => s.saveShoppingList)
  const upsertPlan       = useMealStore(s => s.upsertPlan)

  // ── フォーム ──
  const [days, setDays]               = useState(5)
  const [startDate, setStartDate]     = useState(todayIsoString)
  const [theme, setTheme]             = useState('')
  const [ingredients, setIngredients] = useState('')
  const [requiredRecipes, setRequiredRecipes]     = useState<MealRecipe[]>([])
  const [reqRecipeSelectId, setReqRecipeSelectId] = useState('')

  // ── 提案 ──
  const [hasProposal, setHasProposal]         = useState(false)
  const [meals, setMeals]                     = useState<AiProposedMeal[]>([])
  const [proposalSummary, setProposalSummary] = useState('')
  const [editingId, setEditingId]             = useState<string | null>(null)

  // ── チャット ──
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput]     = useState('')
  const [showChat, setShowChat]       = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── ローディング/エラー ──
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // ── 確定フロー ──
  const [confirming, setConfirming]     = useState(false)
  const [confirmed, setConfirmed]       = useState(false)
  const [shoppingList, setShoppingList] = useState<ShoppingItem[] | null>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const mealsByDate = meals.reduce<Record<string, AiProposedMeal[]>>((acc, m) => {
    if (!acc[m.date]) acc[m.date] = []
    acc[m.date].push(m)
    return acc
  }, {})
  const sortedDates = Object.keys(mealsByDate).sort()

  const DINNER_ORDER: DishRole[] = ['main', 'side', 'soup']

  const applyProposal = (result: { summary: string; meals: AiProposedMeal[] }) => {
    setMeals(result.meals)
    setProposalSummary(result.summary)
    setHasProposal(true)
    setConfirmed(false)
    setShoppingList(null)
    setEditingId(null)
  }

  const handleGenerate = async () => {
    if (!geminiApiKey) { setError('設定画面でGroq APIキーを登録してください'); return }
    setLoading(true); setError(''); setChatHistory([])
    try {
      const result = await generateMealProposal(geminiApiKey, {
        days, startDate, theme, ingredients,
        requiredRecipes, preferences, recentPlans, recipes,
        modelName: geminiModelName,
      })
      applyProposal(result)
      setChatHistory([
        { role: 'user', text: `${days}日分（${startDate}〜）の献立を提案してください。テーマ: ${theme || 'なし'}` },
        { role: 'model', text: result.summary },
      ])
    } catch (err) {
      setError(err instanceof GeminiError ? err.message : `AIの応答に失敗しました: ${(err as Error).message ?? String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !geminiApiKey || loading) return
    const userText = chatInput.trim()
    setChatInput(''); setLoading(true); setError('')
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: userText }]
    setChatHistory(newHistory)
    try {
      const result = await continueMealChat(geminiApiKey, newHistory, userText, {
        preferences, recentPlans, recipes, requiredRecipes, modelName: geminiModelName,
      })
      applyProposal(result)
      setChatHistory(h => [...h, { role: 'model', text: result.summary }])
    } catch (err) {
      setError(err instanceof GeminiError ? err.message : `AIの応答に失敗しました: ${(err as Error).message ?? String(err)}`)
      setChatHistory(h => h.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleEditMeal = (localId: string, updated: Partial<AiProposedMeal>) => {
    setMeals(prev => prev.map(m => m._localId === localId ? { ...m, ...updated } : m))
    setEditingId(null)
  }

  const handleDeleteMeal = (localId: string) => {
    setMeals(prev => prev.filter(m => m._localId !== localId))
    if (editingId === localId) setEditingId(null)
  }

  const handleConfirm = async () => {
    if (!geminiApiKey || meals.length === 0) return
    setConfirming(true); setError('')
    try {
      // 1. 全料理をDBに保存
      for (const meal of meals) {
        await upsertPlan({
          date: meal.date,
          meal_type: meal.meal_type,
          dish_role: meal.dish_role,
          recipe_id: meal._recipeId ?? null,
          free_text: meal._recipeId ? null : meal.dish_name,
          ai_proposal: true,
        })
      }
      // 2. 買い物リストをAI生成
      const items = await generateShoppingList(geminiApiKey, meals, geminiModelName)
      setShoppingList(items)
      // 3. 買い物リストをDBに保存
      if (items.length > 0 && sortedDates.length > 0) {
        await saveShoppingList({
          date_from: sortedDates[0],
          date_to: sortedDates[sortedDates.length - 1],
          items,
        })
      }
      // 4. 提案をDBに保存（復元用）
      await saveAiProposal({ summary: proposalSummary, meals }, items)
      setConfirmed(true)
    } catch (err) {
      setError(`確定処理に失敗しました: ${(err as Error).message ?? String(err)}`)
    } finally {
      setConfirming(false)
    }
  }

  const handleRestoreSaved = () => {
    if (!savedProposal) return
    applyProposal({
      summary: savedProposal.summary,
      meals: savedProposal.meals.map((m, i) => ({ ...m, _localId: m._localId ?? `saved-${i}` })),
    })
    if (savedProposal.shopping_list?.length > 0) setShoppingList(savedProposal.shopping_list)
    setChatHistory([])
  }

  const handleReset = () => {
    setHasProposal(false)
    setMeals([])
    setProposalSummary('')
    setChatHistory([])
    setError('')
    setEditingId(null)
    setConfirmed(false)
    setShoppingList(null)
    setShowChat(false)
  }

  const addRequiredRecipe = () => {
    if (!reqRecipeSelectId) return
    const r = recipes.find(r => r.id === reqRecipeSelectId)
    if (r && !requiredRecipes.find(rr => rr.id === r.id)) {
      setRequiredRecipes(prev => [...prev, r])
    }
    setReqRecipeSelectId('')
  }

  const removeRequiredRecipe = (id: string) => {
    setRequiredRecipes(prev => prev.filter(r => r.id !== id))
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    color: 'var(--text)',
    background: 'var(--surface)',
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--miyu-bd)' }}>
      {/* ヘッダー */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--miyu-bg)', borderBottom: '1px solid var(--miyu-bd)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-sm font-bold" style={{ color: 'var(--miyu)' }}>AI 献立提案</span>
        </div>
        {confirmed && (
          <span className="text-[11px] px-2 py-1 rounded-full font-medium text-white" style={{ background: 'var(--shota)' }}>
            ✓ 確定済み
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* 保存済み提案バナー */}
        {!hasProposal && savedProposal && (
          <div
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: 'var(--shota-bg)', border: '1px solid var(--shota-bd)' }}
          >
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--shota)' }}>前回の保存済み提案があります</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                {new Date(savedProposal.created_at).toLocaleDateString('ja-JP')} 保存 ・ {savedProposal.meals.length}食分
              </p>
            </div>
            <button
              onClick={handleRestoreSaved}
              className="h-8 px-3 rounded-xl text-xs font-semibold text-white"
              style={{ background: 'var(--shota)' }}
            >
              復元
            </button>
          </div>
        )}

        {/* ── 入力フォーム ── */}
        {!hasProposal && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>何日分</label>
                <select
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <option key={d} value={d}>{d}日分</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>テーマ・希望（省略可）</label>
              <input
                type="text"
                placeholder="例: 和食多め、簡単なもの中心"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>冷蔵庫の残り食材（省略可）</label>
              <input
                type="text"
                placeholder="例: 鶏肉、キャベツ、卵"
                value={ingredients}
                onChange={e => setIngredients(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                style={inputStyle}
              />
            </div>

            {/* レシピ指定 */}
            {recipes.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                  使うレシピを指定（省略可・最大{days}個）
                </label>
                <div className="flex gap-2">
                  <select
                    value={reqRecipeSelectId}
                    onChange={e => setReqRecipeSelectId(e.target.value)}
                    className="flex-1 h-9 px-2 rounded-xl text-sm outline-none"
                    style={inputStyle}
                  >
                    <option value="">レシピを選択...</option>
                    {recipes
                      .filter(r => !requiredRecipes.find(rr => rr.id === r.id))
                      .map(r => (
                        <option key={r.id} value={r.id}>{r.name}（{r.genre}）</option>
                      ))}
                  </select>
                  <button
                    onClick={addRequiredRecipe}
                    disabled={!reqRecipeSelectId || requiredRecipes.length >= days}
                    className="h-9 px-3 rounded-xl text-xs font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
                    style={{ background: 'var(--shota)' }}
                  >
                    追加
                  </button>
                </div>
                {requiredRecipes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {requiredRecipes.map(r => (
                      <span
                        key={r.id}
                        className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full"
                        style={{ background: 'var(--shota-bg)', border: '1px solid var(--shota-bd)', color: 'var(--shota)' }}
                      >
                        {r.name}
                        <button onClick={() => removeRequiredRecipe(r.id)} className="transition-opacity hover:opacity-70">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full h-11 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--miyu)' }}
            >
              {loading ? 'AIが考えています...' : '✨ 献立を提案する'}
            </button>
          </div>
        )}

        {/* ローディング */}
        {loading && !hasProposal && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div
              className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--miyu)', borderTopColor: 'transparent' }}
            />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>AIが献立を考えています...</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="p-3 rounded-xl text-xs" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        {/* ── 提案結果 ── */}
        {hasProposal && (
          <div className="space-y-4">
            {/* サマリー */}
            <div
              className="p-3 rounded-xl text-sm leading-relaxed"
              style={{ background: 'var(--miyu-bg)', border: '1px solid var(--miyu-bd)', color: 'var(--text)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--miyu)' }}>📋 </span>
              {proposalSummary}
            </div>

            {/* 日付ごとグループ */}
            {sortedDates.map(date => {
              const dayMeals = mealsByDate[date] ?? []
              const lunches = dayMeals.filter(m => m.meal_type === 'lunch')
              const dinners = dayMeals
                .filter(m => m.meal_type === 'dinner')
                .sort((a, b) => DINNER_ORDER.indexOf(a.dish_role) - DINNER_ORDER.indexOf(b.dish_role))

              return (
                <div key={date} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>{formatDate(date)}</span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{lunches.length + dinners.length}品</span>
                  </div>

                  {[...lunches, ...dinners].map(meal => (
                    <MealCard
                      key={meal._localId ?? `${meal.date}-${meal.meal_type}-${meal.dish_role}`}
                      meal={meal}
                      recipes={recipes}
                      isEditing={editingId === meal._localId}
                      onStartEdit={() => setEditingId(meal._localId ?? null)}
                      onCancelEdit={() => setEditingId(null)}
                      onSaveEdit={updated => {
                        if (meal._localId) handleEditMeal(meal._localId, updated)
                      }}
                      onDelete={() => {
                        if (meal._localId) handleDeleteMeal(meal._localId)
                      }}
                    />
                  ))}
                </div>
              )
            })}

            {/* 確定ボタン */}
            {!confirmed && (
              <button
                onClick={handleConfirm}
                disabled={confirming || meals.length === 0}
                className="w-full h-12 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--shota)' }}
              >
                {confirming ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: 'white', borderTopColor: 'transparent' }}
                    />
                    処理中...
                  </span>
                ) : `✅ 確定して買い物リストを作成（${meals.length}品）`}
              </button>
            )}

            {/* 確定済みメッセージ */}
            {confirmed && (
              <div
                className="p-3 rounded-xl text-sm text-center font-medium"
                style={{ background: 'var(--shota-bg)', color: 'var(--shota)', border: '1px solid var(--shota-bd)' }}
              >
                ✅ 献立を確定し、カレンダーに保存しました
              </div>
            )}

            {/* 買い物リスト */}
            {shoppingList && shoppingList.length > 0 && (
              <ShoppingListSection list={shoppingList} />
            )}
            {shoppingList?.length === 0 && confirmed && (
              <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
                ※ 買い物リストが空でした
              </p>
            )}

            {/* チャット微修正 */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <button
                onClick={() => setShowChat(c => !c)}
                className="w-full flex items-center justify-between px-4 py-3"
                style={{ background: 'var(--subtle)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>💬 AIに調整を依頼</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>{showChat ? '▲' : '▼'}</span>
              </button>
              {showChat && (
                <div className="p-3 space-y-2">
                  {chatHistory.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {chatHistory.map((msg, i) => (
                        <div
                          key={i}
                          className={`text-xs px-3 py-2 rounded-xl ${msg.role === 'user' ? 'ml-6' : 'mr-6'}`}
                          style={{
                            background: msg.role === 'user' ? 'var(--shota-bg)' : 'var(--miyu-bg)',
                            color: 'var(--text)',
                            border: `1px solid ${msg.role === 'user' ? 'var(--shota-bd)' : 'var(--miyu-bd)'}`,
                          }}
                        >
                          <span className="font-semibold" style={{ color: msg.role === 'user' ? 'var(--shota)' : 'var(--miyu)' }}>
                            {msg.role === 'user' ? '👤 ' : '🤖 '}
                          </span>
                          {msg.text}
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                  {loading && (
                    <div className="flex items-center gap-2 py-1">
                      <div
                        className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                        style={{ borderColor: 'var(--miyu)', borderTopColor: 'transparent' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>考えています...</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="例: 月曜の夜をパスタに変えて"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleChat() }}
                      disabled={loading}
                      className="flex-1 h-10 px-3 rounded-xl text-sm outline-none"
                      style={inputStyle}
                    />
                    <button
                      onClick={handleChat}
                      disabled={loading || !chatInput.trim()}
                      className="h-10 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ background: 'var(--miyu)' }}
                    >
                      送信
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleReset}
              className="w-full text-xs py-1 transition-opacity hover:opacity-70"
              style={{ color: 'var(--muted)' }}
            >
              ← 最初からやり直す
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
