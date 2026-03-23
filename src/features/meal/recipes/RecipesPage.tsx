import { useState } from 'react'
import { useMealStore } from '@/stores/mealStore'
import RecipeFormModal from './RecipeFormModal'
import { RECIPE_GENRES, RECIPE_TYPES, type MealRecipe } from '@/types/meal'

const DIFFICULTY_STARS = ['', '⭐', '⭐⭐', '⭐⭐⭐']

interface RecipeCardProps {
  recipe: MealRecipe
  onEdit: (recipe: MealRecipe) => void
}

function RecipeCard({ recipe, onEdit }: RecipeCardProps) {
  const updateRecipe = useMealStore(s => s.updateRecipe)
  const deleteRecipe = useMealStore(s => s.deleteRecipe)
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleFavoriteToggle = async () => {
    await updateRecipe(recipe.id, { is_favorite: !recipe.is_favorite })
  }

  const handleDelete = async () => {
    if (!window.confirm(`「${recipe.name}」を削除しますか？`)) return
    setDeleting(true)
    try {
      await deleteRecipe(recipe.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: `1px solid ${recipe.is_favorite ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      {/* カードヘッダー */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'var(--shota-bg)', color: 'var(--shota)', border: '1px solid var(--shota-bd)' }}
              >
                {recipe.genre}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: 'var(--subtle)', color: 'var(--muted)' }}
              >
                {recipe.type}
              </span>
            </div>
            <h4 className="font-medium text-sm leading-snug" style={{ color: 'var(--text)' }}>
              {recipe.name}
            </h4>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px]">{DIFFICULTY_STARS[recipe.difficulty]}</span>
              {recipe.duration_min && (
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  🕐 {recipe.duration_min}分
                </span>
              )}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleFavoriteToggle}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5 text-base"
              title={recipe.is_favorite ? 'お気に入り解除' : 'お気に入りに追加'}
            >
              {recipe.is_favorite ? '⭐' : '☆'}
            </button>
            <button
              onClick={() => onEdit(recipe)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-black/5"
              style={{ color: 'var(--muted)' }}
              title="編集"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-50"
              style={{ color: 'var(--danger)' }}
              title="削除"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3.5h10M5 3.5V2.5h4v1M5.5 6v4M8.5 6v4M3 3.5l1 8.5h6l1-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* 詳細展開ボタン */}
        {(recipe.ingredients || recipe.steps || recipe.memo) && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-2 text-xs transition-colors hover:opacity-70"
            style={{ color: 'var(--muted)' }}
          >
            {expanded ? '▲ 閉じる' : '▼ 詳細を見る'}
          </button>
        )}
      </div>

      {/* 詳細展開 */}
      {expanded && (
        <div
          className="px-4 pb-4 space-y-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {recipe.ingredients && (
            <div className="pt-3">
              <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>材料</p>
              <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{recipe.ingredients}</p>
            </div>
          )}
          {recipe.steps && (
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>手順</p>
              <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{recipe.steps}</p>
            </div>
          )}
          {recipe.memo && (
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>メモ</p>
              <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{recipe.memo}</p>
            </div>
          )}
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs truncate hover:underline"
              style={{ color: 'var(--shota)' }}
            >
              🔗 {recipe.source_url}
            </a>
          )}
        </div>
      )}
    </div>
  )
}

export default function RecipesPage() {
  const recipes = useMealStore(s => s.recipes)

  const [editTarget, setEditTarget] = useState<MealRecipe | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterGenre, setFilterGenre] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterFavorite, setFilterFavorite] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = recipes.filter(r => {
    if (filterGenre && r.genre !== filterGenre) return false
    if (filterType && r.type !== filterType) return false
    if (filterFavorite && !r.is_favorite) return false
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const selectStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    color: 'var(--text)',
    background: 'var(--surface)',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>レシピ</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {recipes.length}件登録済み
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="h-9 px-4 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--shota)' }}
        >
          ＋ 追加
        </button>
      </div>

      {/* フィルター / 検索 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="料理名で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 px-3 rounded-lg text-xs outline-none flex-1 min-w-[140px]"
          style={selectStyle}
        />
        <select
          value={filterGenre}
          onChange={e => setFilterGenre(e.target.value)}
          className="h-8 px-2 rounded-lg text-xs outline-none"
          style={selectStyle}
        >
          <option value="">全ジャンル</option>
          {RECIPE_GENRES.map(g => <option key={g}>{g}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="h-8 px-2 rounded-lg text-xs outline-none"
          style={selectStyle}
        >
          <option value="">全種類</option>
          {RECIPE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setFilterFavorite(f => !f)}
          className="h-8 px-3 rounded-lg text-xs font-medium transition-all"
          style={{
            background: filterFavorite ? 'var(--shota-bg)' : 'var(--surface)',
            color: filterFavorite ? 'var(--shota)' : 'var(--muted)',
            border: `1px solid ${filterFavorite ? 'var(--shota-bd)' : 'var(--border)'}`,
          }}
        >
          ⭐ お気に入り
        </button>
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {recipes.length === 0 ? 'レシピがまだ登録されていません' : '条件に一致するレシピがありません'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} onEdit={setEditTarget} />
          ))}
        </div>
      )}

      {/* モーダル */}
      {(showAddModal || editTarget) && (
        <RecipeFormModal
          recipe={editTarget ?? undefined}
          onClose={() => {
            setShowAddModal(false)
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}
