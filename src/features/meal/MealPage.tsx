import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMealStore } from '@/stores/mealStore'
import PlanPage from './plan/PlanPage'
import RecipesPage from './recipes/RecipesPage'
import PreferencesPage from './preferences/PreferencesPage'

type Tab = 'plan' | 'recipes' | 'preferences'

const TABS: { value: Tab; label: string; path: string }[] = [
  { value: 'plan',        label: '献立計画',  path: '/meal/plan' },
  { value: 'recipes',     label: 'レシピ',    path: '/meal/recipes' },
  { value: 'preferences', label: '好み設定',  path: '/meal/preferences' },
]

export default function MealPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const initMeal  = useMealStore(s => s.initMeal)
  const loading   = useMealStore(s => s.loading)

  useEffect(() => {
    initMeal()
  }, [initMeal])

  const currentTab: Tab =
    location.pathname.includes('recipes')
      ? 'recipes'
      : location.pathname.includes('preferences')
        ? 'preferences'
        : 'plan'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--miyu)', borderTopColor: 'transparent' }}
        />
        <span className="ml-3 text-sm" style={{ color: 'var(--muted)' }}>読み込み中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>献立管理</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
          AI付き週間献立計画・レシピ・好み管理
        </p>
      </div>

      {/* タブ */}
      <div
        className="flex rounded-xl overflow-hidden"
        style={{ background: 'var(--subtle)', padding: '3px', gap: '2px' }}
      >
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => navigate(tab.path)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: currentTab === tab.value ? 'var(--surface)' : 'transparent',
              color: currentTab === tab.value ? 'var(--text)' : 'var(--muted)',
              boxShadow: currentTab === tab.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      {currentTab === 'plan'        && <PlanPage />}
      {currentTab === 'recipes'     && <RecipesPage />}
      {currentTab === 'preferences' && <PreferencesPage />}
    </div>
  )
}
