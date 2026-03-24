import { useState, useRef, useEffect } from 'react'
import { useMealStore } from '@/stores/mealStore'
import { generateMealProposal, continueMealChat, GeminiError } from '@/lib/gemini'
import type { AiProposal, AiProposedMeal, ChatMessage, MealSlotType } from '@/types/meal'

const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土']

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_JP[d.getDay()]})`
}

function todayIsoString(): string {
  return new Date().toISOString().split('T')[0]
}

const DIFFICULTY_LABEL = ['', '★ 簡単', '★★ 普通', '★★★ 本格']

// ─── 食事カード ──────────────────────────────────────────────────

interface MealCardProps {
  meal: AiProposedMeal
  isSaved: boolean
  isSaving: boolean
  onSavePlan: (meal: AiProposedMeal) => void
  onAddRecipe: (meal: AiProposedMeal) => void
  isAddingRecipe: boolean
}

function MealCard({ meal, isSaved, isSaving, onSavePlan, onAddRecipe, isAddingRecipe }: MealCardProps) {
  const [showSteps, setShowSteps] = useState(false)
  const isLunch = meal.meal_type === 'lunch'

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${isLunch ? 'var(--shota-bd)' : 'var(--miyu-bd)'}` }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: isLunch ? 'var(--shota-bg)' : 'var(--miyu-bg)' }}
      >
        <span className="text-base">{isLunch ? '☀️' : '🌙'}</span>
        <span className="text-[11px] font-bold" style={{ color: isLunch ? 'var(--shota)' : 'var(--miyu)' }}>
          {isLunch ? '昼食' : '夕食'}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{ background: isLunch ? 'var(--shota)' : 'var(--miyu)', color: 'white' }}
        >
          {meal.genre}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{meal.type}</span>
      </div>

      <div className="px-3 pt-2.5 pb-3">
        <p className="font-bold text-[15px] leading-snug mb-1.5" style={{ color: 'var(--text)' }}>
          {meal.dish_name}
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
              style={{ color: isLunch ? 'var(--shota)' : 'var(--miyu)' }}
            >
              <span
                className="inline-block transition-transform"
                style={{ transform: showSteps ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}
              >▶</span>
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

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onSavePlan(meal)}
            disabled={isSaving || isSaved}
            className="flex-1 h-9 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: isSaved ? '#6b7280' : (isLunch ? 'var(--shota)' : 'var(--miyu)') }}
          >
            {isSaved ? '✓ 計画済み' : isSaving ? '保存中...' : '計画に追加'}
          </button>
          <button
            onClick={() => onAddRecipe(meal)}
            disabled={isAddingRecipe}
            className="h-9 px-3 rounded-xl text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              border: `1px solid ${isLunch ? 'var(--shota-bd)' : 'var(--miyu-bd)'}`,
              color: isLunch ? 'var(--shota)' : 'var(--miyu)',
            }}
          >
            {isAddingRecipe ? '追加中...' : 'レシピ保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 買い物リスト（インライン） ─────────────────────────────────

function ShoppingListSection({ list }: { list: AiProposal['shopping_list'] }) {
  const [open, setOpen] = useState(false)
  const grouped: Record<string, typeof list> = {}
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
          🛒 買い物リスト <span className="font-normal" style={{ color: 'var(--muted)' }}>({list.length}品目)</span>
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

// ─── メインパネル ──────────────────────────────────────────────

interface AiProposalPanelProps {
  onSaveMeal: (date: string, mealType: MealSlotType, dishName: string) => Promise<void>
}

export default function AiProposalPanel({ onSaveMeal }: AiProposalPanelProps) {
  const geminiApiKey    = useMealStore(s => s.geminiApiKey)
  const geminiModelName = useMealStore(s => s.geminiModelName)
  const preferences     = useMealStore(s => s.preferences)
  const recipes         = useMealStore(s => s.recipes)
  const recentPlans     = useMealStore(s => s.recentPlans)
  const savedProposal   = useMealStore(s => s.savedProposal)
  const saveAiProposal  = useMealStore(s => s.saveAiProposal)
  const addRecipe       = useMealStore(s => s.addRecipe)

  const [days, setDays] = useState(7)
  const [startDate, setStartDate] = useState(todayIsoString)
  const [theme, setTheme] = useState('')
  const [ingredients, setIngredients] = useState('')

  const [proposal, setProposal] = useState<AiProposal | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proposalSaved, setProposalSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const [savedMeals, setSavedMeals] = useState<Set<string>>(new Set())
  const [savingMeal, setSavingMeal] = useState<string | null>(null)
  const [addingRecipe, setAddingRecipe] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const mealsByDate = proposal
    ? proposal.meals.reduce<Record<string, AiProposedMeal[]>>((acc, m) => {
        if (!acc[m.date]) acc[m.date] = []
        acc[m.date].push(m)
        return acc
      }, {})
    : {}
  const sortedDates = Object.keys(mealsByDate).sort()

  const handleGenerate = async () => {
    if (!geminiApiKey) { setError('設定画面でGroq APIキーを登録してください'); return }
    setLoading(true); setError(''); setChatHistory([]); setProposal(null)
    setSavedMeals(new Set()); setProposalSaved(false)
    try {
      const result = await generateMealProposal(geminiApiKey, {
        days, startDate, theme, ingredients, preferences, recentPlans, recipes,
        modelName: geminiModelName,
      })
      setProposal(result)
      setChatHistory([
        { role: 'user', text: `${days}日分（${startDate}〜）の献立を提案してください。テーマ: ${theme || 'なし'}` },
        { role: 'model', text: result.summary, proposal: result },
      ])
    } catch (err) {
      setError(err instanceof GeminiError ? err.message : 'AIの応答に失敗しました')
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
        preferences, recentPlans, recipes, modelName: geminiModelName,
      })
      setProposal(result)
      setSavedMeals(new Set()); setProposalSaved(false)
      setChatHistory(h => [...h, { role: 'model', text: result.summary, proposal: result }])
    } catch (err) {
      setError(err instanceof GeminiError ? err.message : 'AIの応答に失敗しました')
      setChatHistory(h => h.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveMeal = async (meal: AiProposedMeal) => {
    const key = `${meal.date}-${meal.meal_type}`
    setSavingMeal(key)
    try {
      await onSaveMeal(meal.date, meal.meal_type, meal.dish_name)
      setSavedMeals(s => new Set([...s, key]))
    } finally {
      setSavingMeal(null)
    }
  }

  const handleSaveAll = async () => {
    if (!proposal) return
    for (const meal of proposal.meals) await handleSaveMeal(meal)
  }

  const handleSaveProposal = async () => {
    if (!proposal) return
    setSaving(true)
    try {
      await saveAiProposal(proposal)
      setProposalSaved(true)
    } catch { setError('提案の保存に失敗しました') }
    finally { setSaving(false) }
  }

  const handleAddRecipe = async (meal: AiProposedMeal) => {
    const key = `${meal.date}-${meal.meal_type}`
    setAddingRecipe(key)
    try {
      await addRecipe({
        name: meal.dish_name,
        genre: meal.genre as never,
        type: meal.type as never,
        difficulty: (meal.difficulty ?? 2) as 1 | 2 | 3,
        duration_min: meal.duration_min,
        ingredients: meal.ingredients ?? '',
        steps: meal.steps ?? '',
        memo: meal.note ?? '',
        source_url: null,
        is_favorite: false,
      })
    } finally { setAddingRecipe(null) }
  }

  const handleRestoreSaved = () => {
    if (!savedProposal) return
    setProposal({ summary: savedProposal.summary, meals: savedProposal.meals, shopping_list: savedProposal.shopping_list })
    setSavedMeals(new Set()); setProposalSaved(true); setChatHistory([])
  }

  const handleReset = () => {
    setProposal(null); setChatHistory([]); setError('')
    setSavedMeals(new Set()); setProposalSaved(false); setShowChat(false)
  }

  const inputStyle: React.CSSProperties = { border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--surface)' }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--miyu-bd)' }}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--miyu-bg)', borderBottom: '1px solid var(--miyu-bd)' }}>
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <span className="text-sm font-bold" style={{ color: 'var(--miyu)' }}>AI 献立提案</span>
        </div>
        {proposalSaved && (
          <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ background: 'var(--miyu)', color: 'white' }}>
            ✓ 保存済み
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* 保存済み提案バナー */}
        {!proposal && savedProposal && (
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--shota-bg)', border: '1px solid var(--shota-bd)' }}>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--shota)' }}>前回の保存済み提案があります</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                {new Date(savedProposal.created_at).toLocaleDateString('ja-JP')} 保存 ・ {savedProposal.meals.length}食分
              </p>
            </div>
            <button onClick={handleRestoreSaved} className="h-8 px-3 rounded-xl text-xs font-semibold text-white" style={{ background: 'var(--shota)' }}>
              復元
            </button>
          </div>
        )}

        {/* 入力フォーム */}
        {!proposal && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>何日分</label>
                <select value={days} onChange={e => setDays(Number(e.target.value))} className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle}>
                  {[3, 5, 7, 10, 14].map(d => <option key={d} value={d}>{d}日分</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>開始日</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>テーマ・希望（省略可）</label>
              <input type="text" placeholder="例: 和食多め、簡単なもの中心" value={theme} onChange={e => setTheme(e.target.value)} className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>冷蔵庫の残り食材（省略可）</label>
              <input type="text" placeholder="例: 鶏肉、キャベツ、卵" value={ingredients} onChange={e => setIngredients(e.target.value)} className="w-full h-10 px-3 rounded-xl text-sm outline-none" style={inputStyle} />
            </div>
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
        {loading && !proposal && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: 'var(--miyu)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>AIが献立を考えています...</p>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="p-3 rounded-xl text-xs" style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        {/* ─── 提案結果 ─── */}
        {proposal && (
          <div className="space-y-4">
            {/* 概要 */}
            <div className="p-3 rounded-xl text-sm leading-relaxed" style={{ background: 'var(--miyu-bg)', border: '1px solid var(--miyu-bd)', color: 'var(--text)' }}>
              <span className="font-semibold" style={{ color: 'var(--miyu)' }}>📋 </span>
              {proposal.summary}
            </div>

            {/* 日付ごとグループ */}
            {sortedDates.map(date => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>{formatDate(date)}</span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                </div>
                {[...mealsByDate[date]]
                  .sort((a, b) => (a.meal_type === 'lunch' ? -1 : 1) - (b.meal_type === 'lunch' ? -1 : 1))
                  .map((meal, i) => {
                    const key = `${meal.date}-${meal.meal_type}`
                    return (
                      <MealCard
                        key={i}
                        meal={meal}
                        isSaved={savedMeals.has(key)}
                        isSaving={savingMeal === key}
                        onSavePlan={handleSaveMeal}
                        onAddRecipe={handleAddRecipe}
                        isAddingRecipe={addingRecipe === key}
                      />
                    )
                  })}
              </div>
            ))}

            {/* 買い物リスト */}
            {proposal.shopping_list.length > 0 && (
              <ShoppingListSection list={proposal.shopping_list} />
            )}

            {/* アクション */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSaveAll}
                className="h-11 rounded-2xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--miyu)' }}
              >
                全て計画に追加
              </button>
              <button
                onClick={handleSaveProposal}
                disabled={saving || proposalSaved}
                className="h-11 rounded-2xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{
                  background: proposalSaved ? 'var(--subtle)' : 'var(--shota-bg)',
                  color: proposalSaved ? 'var(--muted)' : 'var(--shota)',
                  border: `1px solid ${proposalSaved ? 'var(--border)' : 'var(--shota-bd)'}`,
                }}
              >
                {saving ? '保存中...' : proposalSaved ? '✓ 保存済み' : '📌 提案を保存'}
              </button>
            </div>

            {/* チャット */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              <button
                onClick={() => setShowChat(c => !c)}
                className="w-full flex items-center justify-between px-4 py-3"
                style={{ background: 'var(--subtle)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>💬 微修正チャット</span>
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
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0" style={{ borderColor: 'var(--miyu)', borderTopColor: 'transparent' }} />
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

            <button onClick={handleReset} className="w-full text-xs py-1 transition-opacity hover:opacity-70" style={{ color: 'var(--muted)' }}>
              ← 最初からやり直す
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
