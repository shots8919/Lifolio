import { useState } from 'react'
import { useMealStore } from '@/stores/mealStore'
import { importRecipeFromUrl, GeminiError } from '@/lib/gemini'
import {
  RECIPE_GENRES,
  RECIPE_TYPES,
  type MealRecipe,
  type RecipeGenre,
  type RecipeType,
  type RecipeDifficulty,
} from '@/types/meal'

interface FormValues {
  name: string
  genre: RecipeGenre
  type: RecipeType
  difficulty: RecipeDifficulty
  duration_min: string
  ingredients: string
  steps: string
  memo: string
  source_url: string
  is_favorite: boolean
}

function defaultForm(recipe?: MealRecipe): FormValues {
  return {
    name:        recipe?.name ?? '',
    genre:       recipe?.genre ?? '和食',
    type:        recipe?.type ?? '主菜',
    difficulty:  recipe?.difficulty ?? 1,
    duration_min: recipe?.duration_min != null ? String(recipe.duration_min) : '',
    ingredients: recipe?.ingredients ?? '',
    steps:       recipe?.steps ?? '',
    memo:        recipe?.memo ?? '',
    source_url:  recipe?.source_url ?? '',
    is_favorite: recipe?.is_favorite ?? false,
  }
}

const DIFFICULTY_LABELS: { value: RecipeDifficulty; label: string }[] = [
  { value: 1, label: '⭐ 簡単' },
  { value: 2, label: '⭐⭐ 普通' },
  { value: 3, label: '⭐⭐⭐ 難しい' },
]

interface RecipeFormModalProps {
  recipe?: MealRecipe
  onClose: () => void
}

export default function RecipeFormModal({ recipe, onClose }: RecipeFormModalProps) {
  const geminiApiKey = useMealStore(s => s.geminiApiKey)
  const geminiModelName = useMealStore(s => s.geminiModelName)
  const addRecipe    = useMealStore(s => s.addRecipe)
  const updateRecipe = useMealStore(s => s.updateRecipe)

  const [form, setForm] = useState<FormValues>(defaultForm(recipe))
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [saveError, setSaveError] = useState('')

  const set = (patch: Partial<FormValues>) => setForm(f => ({ ...f, ...patch }))

  const handleUrlImport = async () => {
    if (!form.source_url.trim()) return
    if (!geminiApiKey) {
      setImportError('設定画面でGemini APIキーを登録してください')
      return
    }
    setImporting(true)
    setImportError('')
    try {
      const imported = await importRecipeFromUrl(geminiApiKey, form.source_url.trim(), geminiModelName)
      set({
        name:        imported.name,
        genre:       (RECIPE_GENRES.includes(imported.genre as RecipeGenre) ? imported.genre : 'その他') as RecipeGenre,
        type:        (RECIPE_TYPES.includes(imported.type as RecipeType) ? imported.type : 'その他') as RecipeType,
        difficulty:  ([1, 2, 3].includes(imported.difficulty) ? imported.difficulty : 1) as RecipeDifficulty,
        duration_min: imported.duration_min != null ? String(imported.duration_min) : '',
        ingredients: imported.ingredients,
        steps:       imported.steps,
        memo:        imported.memo,
      })
    } catch (err) {
      setImportError(err instanceof GeminiError ? err.message : 'レシピの取得に失敗しました')
    } finally {
      setImporting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        name:        form.name.trim(),
        genre:       form.genre,
        type:        form.type,
        difficulty:  form.difficulty,
        duration_min: form.duration_min ? Number(form.duration_min) : null,
        ingredients: form.ingredients.trim(),
        steps:       form.steps.trim(),
        memo:        form.memo.trim(),
        source_url:  form.source_url.trim() || null,
        is_favorite: form.is_favorite,
      }
      if (recipe?.id) {
        await updateRecipe(recipe.id, payload)
      } else {
        await addRecipe(payload)
      }
      onClose()
    } catch {
      setSaveError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    color: 'var(--text)',
    background: 'var(--surface)',
  }
  const labelStyle: React.CSSProperties = { color: 'var(--muted)' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* ヘッダー */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
            {recipe ? 'レシピを編集' : 'レシピを追加'}
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-lg transition-colors hover:bg-black/5"
            style={{ color: 'var(--muted)' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* URL取込 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              レシピURL（省略可）
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://cookpad.com/recipe/..."
                value={form.source_url}
                onChange={e => set({ source_url: e.target.value })}
                className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
                style={inputStyle}
                disabled={importing}
              />
              <button
                type="button"
                onClick={handleUrlImport}
                disabled={importing || !form.source_url.trim()}
                className="px-3 h-9 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
                style={{ background: 'var(--shota)' }}
              >
                {importing ? '取込中...' : 'AIで取込'}
              </button>
            </div>
            {importError && (
              <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{importError}</p>
            )}
          </div>

          {/* 料理名 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
              料理名 <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set({ name: e.target.value })}
              required
              className="w-full h-9 px-3 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>

          {/* ジャンル・種類 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>ジャンル</label>
              <select
                value={form.genre}
                onChange={e => set({ genre: e.target.value as RecipeGenre })}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={inputStyle}
              >
                {RECIPE_GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>種類</label>
              <select
                value={form.type}
                onChange={e => set({ type: e.target.value as RecipeType })}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={inputStyle}
              >
                {RECIPE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 難易度・時間 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>難易度</label>
              <select
                value={form.difficulty}
                onChange={e => set({ difficulty: Number(e.target.value) as RecipeDifficulty })}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={inputStyle}
              >
                {DIFFICULTY_LABELS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={labelStyle}>
                調理時間（分）
              </label>
              <input
                type="number"
                min={1}
                placeholder="30"
                value={form.duration_min}
                onChange={e => set({ duration_min: e.target.value })}
                className="w-full h-9 px-3 rounded-lg text-sm outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* 材料 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>材料</label>
            <textarea
              rows={3}
              placeholder="豚肉 200g&#10;じゃがいも 3個&#10;..."
              value={form.ingredients}
              onChange={e => set({ ingredients: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
              style={inputStyle}
            />
          </div>

          {/* 手順 */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>調理手順</label>
            <textarea
              rows={4}
              placeholder="1. 野菜を切る&#10;2. 油で炒める&#10;..."
              value={form.steps}
              onChange={e => set({ steps: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
              style={inputStyle}
            />
          </div>

          {/* メモ */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={labelStyle}>メモ・ポイント</label>
            <textarea
              rows={2}
              value={form.memo}
              onChange={e => set({ memo: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-y"
              style={inputStyle}
            />
          </div>

          {/* お気に入り */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_favorite}
              onChange={e => set({ is_favorite: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>⭐ お気に入りに追加</span>
          </label>

          {saveError && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{saveError}</p>
          )}

          {/* ボタン */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 h-10 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--shota)' }}
            >
              {saving ? '保存中...' : (recipe ? '更新する' : '追加する')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 h-10 rounded-xl text-sm transition-colors hover:bg-black/5"
              style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
