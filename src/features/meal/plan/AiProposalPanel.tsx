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

const DIFFICULTY_STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐']

interface ProposedMealCardProps {
  meal: AiProposedMeal
  onSave: (meal: AiProposedMeal) => void
  saving: boolean
}

function ProposedMealCard({ meal, onSave, saving }: ProposedMealCardProps) {
  return (
    <div
      className="rounded-xl p-3 space-y-1.5"
      style={{ background: 'var(--subtle)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>
              {formatDate(meal.date)} {meal.meal_type === 'dinner' ? '夜' : '昼'}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--miyu-bg)', color: 'var(--miyu)', border: '1px solid var(--miyu-bd)' }}
            >
              {meal.genre}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{meal.type}</span>
          </div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{meal.dish_name}</p>
          <div className="flex gap-2 mt-0.5">
            {meal.difficulty && (
              <span className="text-[11px]">{DIFFICULTY_STARS[meal.difficulty]}</span>
            )}
            {meal.duration_min && (
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>🕐 {meal.duration_min}分</span>
            )}
          </div>
          {meal.ingredients && (
            <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
              材料: {meal.ingredients}
            </p>
          )}
          {meal.note && (
            <p className="text-[11px] mt-0.5 italic" style={{ color: 'var(--muted)' }}>
              💡 {meal.note}
            </p>
          )}
        </div>
        <button
          onClick={() => onSave(meal)}
          disabled={saving}
          className="flex-shrink-0 h-7 px-2.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--miyu)' }}
        >
          保存
        </button>
      </div>
    </div>
  )
}

interface ShoppingListModalProps {
  list: AiProposal['shopping_list']
  onClose: () => void
}

function ShoppingListModal({ list, onClose }: ShoppingListModalProps) {
  const grouped: Record<string, typeof list> = {}
  list.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(item)
  })

  const text = Object.entries(grouped)
    .map(([cat, items]) =>
      `【${cat}】\n` + items.map(i => `・${i.item} ${i.amount}`).join('\n'),
    )
    .join('\n\n')

  const handleCopy = () => navigator.clipboard.writeText(text)

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
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>🛒 買い物リスト</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="h-7 px-3 text-xs rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--subtle)', color: 'var(--text)' }}
            >
              コピー
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-lg hover:bg-black/5"
              style={{ color: 'var(--muted)' }}
            >
              ×
            </button>
          </div>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[11px] font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
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
        </div>
      </div>
    </div>
  )
}

interface AiProposalPanelProps {
  onSaveMeal: (date: string, mealType: MealSlotType, dishName: string) => Promise<void>
}

export default function AiProposalPanel({ onSaveMeal }: AiProposalPanelProps) {
  const geminiApiKey = useMealStore(s => s.geminiApiKey)
  const geminiModelName = useMealStore(s => s.geminiModelName)
  const preferences  = useMealStore(s => s.preferences)
  const recipes      = useMealStore(s => s.recipes)
  const recentPlans  = useMealStore(s => s.recentPlans)

  // フォーム
  const [days, setDays] = useState(7)
  const [startDate, setStartDate] = useState(todayIsoString)
  const [theme, setTheme] = useState('')
  const [ingredients, setIngredients] = useState('')

  // 提案状態
  const [proposal, setProposal] = useState<AiProposal | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // チャット入力
  const [chatInput, setChatInput] = useState('')
  const [savingMeal, setSavingMeal] = useState<string | null>(null)

  // 買い物リストモーダル
  const [showShopping, setShowShopping] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleGenerate = async () => {
    if (!geminiApiKey) {
      setError('設定画面でGemini APIキーを登録してください')
      return
    }
    setLoading(true)
    setError('')
    setChatHistory([])
    setProposal(null)
    try {
      const result = await generateMealProposal(geminiApiKey, {
        days, startDate, theme, ingredients, preferences, recentPlans, recipes,
        modelName: geminiModelName,
      })
      setProposal(result)
      const userMsg = `${days}日分（${startDate}〜）の献立を提案してください。テーマ: ${theme || 'なし'} 残り食材: ${ingredients || 'なし'}`
      const modelMsg = result.summary
      setChatHistory([
        { role: 'user', text: userMsg },
        { role: 'model', text: modelMsg, proposal: result },
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
    setChatInput('')
    setLoading(true)
    setError('')

    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: userText }]
    setChatHistory(newHistory)

    try {
      const result = await continueMealChat(geminiApiKey, newHistory, userText, {
        preferences, recentPlans, recipes, modelName: geminiModelName,
      })
      setProposal(result)
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
    } finally {
      setSavingMeal(null)
    }
  }

  const handleSaveAll = async () => {
    if (!proposal) return
    for (const meal of proposal.meals) {
      await onSaveMeal(meal.date, meal.meal_type, meal.dish_name)
    }
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    color: 'var(--text)',
    background: 'var(--surface)',
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--miyu-bd)' }}
    >
      {/* パネルヘッダー */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: 'var(--miyu-bg)', borderBottom: '1px solid var(--miyu-bd)' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="var(--miyu)" strokeWidth="1.3" />
          <path d="M5 7C5 5.5 6 4.5 8 4.5S11 5.5 11 7c0 1.2-.7 2-2 2.5V11H7v-1.5C5.7 9 5 8.2 5 7Z" stroke="var(--miyu)" strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="8" cy="12.5" r="0.7" fill="var(--miyu)" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: 'var(--miyu)' }}>AI 献立提案</span>
      </div>

      <div className="p-4 space-y-4">
        {/* 入力フォーム */}
        {chatHistory.length === 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                  何日分
                </label>
                <select
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={inputStyle}
                >
                  {[3, 5, 7, 10, 14].map(d => (
                    <option key={d} value={d}>{d}日分</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                  開始日
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                テーマ・希望（省略可）
              </label>
              <input
                type="text"
                placeholder="例: 和食多め、簡単なもの中心"
                value={theme}
                onChange={e => setTheme(e.target.value)}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
                冷蔵庫の残り食材（省略可）
              </label>
              <input
                type="text"
                placeholder="例: 鶏肉、キャベツ、卵"
                value={ingredients}
                onChange={e => setIngredients(e.target.value)}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--miyu)' }}
            >
              {loading ? '提案中...' : '✨ 献立を提案する'}
            </button>
          </div>
        )}

        {/* エラー */}
        {error && (
          <div
            className="p-3 rounded-lg text-xs"
            style={{ background: '#fef2f2', color: 'var(--danger)', border: '1px solid #fecaca' }}
          >
            {error}
          </div>
        )}

        {/* ローディング */}
        {loading && chatHistory.length === 0 && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--miyu)', borderTopColor: 'transparent' }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>AIが献立を考えています...</span>
          </div>
        )}

        {/* 提案結果 */}
        {proposal && (
          <div className="space-y-3">
            {/* 概要 */}
            <div
              className="p-3 rounded-xl text-xs leading-relaxed"
              style={{ background: 'var(--miyu-bg)', border: '1px solid var(--miyu-bd)', color: 'var(--text)' }}
            >
              {proposal.summary}
            </div>

            {/* 献立カード */}
            <div className="space-y-2">
              {proposal.meals.map((meal, i) => (
                <ProposedMealCard
                  key={i}
                  meal={meal}
                  onSave={handleSaveMeal}
                  saving={savingMeal === `${meal.date}-${meal.meal_type}`}
                />
              ))}
            </div>

            {/* 全保存・買い物リスト */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveAll}
                className="flex-1 h-9 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--miyu)' }}
              >
                全て計画に保存
              </button>
              {proposal.shopping_list.length > 0 && (
                <button
                  onClick={() => setShowShopping(true)}
                  className="flex-1 h-9 rounded-xl text-xs font-semibold transition-opacity hover:opacity-90"
                  style={{ background: 'var(--miyu-bg)', color: 'var(--miyu)', border: '1px solid var(--miyu-bd)' }}
                >
                  🛒 買い物リスト
                </button>
              )}
            </div>

            <button
              onClick={() => { setChatHistory([]); setProposal(null); setError('') }}
              className="w-full text-xs transition-colors hover:opacity-70"
              style={{ color: 'var(--muted)' }}
            >
              ← 最初からやり直す
            </button>
          </div>
        )}

        {/* 会話履歴 */}
        {chatHistory.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
              微修正チャット
            </p>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
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
                  <span className="font-medium" style={{ color: msg.role === 'user' ? 'var(--shota)' : 'var(--miyu)' }}>
                    {msg.role === 'user' ? '👤 ' : '🤖 '}
                  </span>
                  {msg.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* チャット入力 */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="例: 月曜をパスタに変えて"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleChat() }}
                disabled={loading}
                className="flex-1 h-9 px-3 rounded-lg text-xs outline-none"
                style={inputStyle}
              />
              <button
                onClick={handleChat}
                disabled={loading || !chatInput.trim()}
                className="h-9 px-3 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--miyu)' }}
              >
                {loading ? '...' : '送信'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 買い物リストモーダル */}
      {showShopping && proposal && (
        <ShoppingListModal
          list={proposal.shopping_list}
          onClose={() => setShowShopping(false)}
        />
      )}
    </div>
  )
}
