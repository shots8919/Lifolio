import { create } from 'zustand'
import type { MealPreference, MealRecipe, MealPlan, SavedAiProposal, AiProposal } from '@/types/meal'
import { preferencesApi, recipesApi, plansApi, geminiKeyApi, aiProposalApi } from '@/lib/mealApi'

interface MealState {
  preferences: MealPreference[]
  recipes: MealRecipe[]
  weekPlans: MealPlan[]      // 現在表示中の週のプラン
  recentPlans: MealPlan[]    // 直近2週間（AI提案用）
  geminiApiKey: string | null
  geminiModelName: string | null
  savedProposal: SavedAiProposal | null  // Supabaseに保存した最新AI提案
  initialized: boolean
  loading: boolean

  /** 初回ロード: 好み・レシピ・直近プラン・APIキーを取得し古いプランを削除 */
  initMeal: () => Promise<void>
  /** 指定期間のプランを取得して weekPlans にセット */
  loadWeekPlans: (from: string, to: string) => Promise<void>

  addPreference: (pref: Omit<MealPreference, 'id' | 'created_at'>) => Promise<void>
  deletePreference: (id: string) => Promise<void>

  addRecipe: (recipe: Omit<MealRecipe, 'id' | 'created_at'>) => Promise<void>
  updateRecipe: (id: string, recipe: Partial<Omit<MealRecipe, 'id' | 'created_at'>>) => Promise<void>
  deleteRecipe: (id: string) => Promise<void>

  upsertPlan: (plan: Omit<MealPlan, 'id' | 'created_at' | 'recipe'>) => Promise<void>
  deletePlan: (id: string) => Promise<void>

  saveGeminiKey: (key: string) => Promise<void>
  saveGeminiModelName: (modelName: string) => Promise<void>
  saveAiProposal: (proposal: AiProposal) => Promise<void>
}

export const useMealStore = create<MealState>()((set, get) => ({
  preferences: [],
  recipes: [],
  weekPlans: [],
  recentPlans: [],
  geminiApiKey: null,
  geminiModelName: null,
  savedProposal: null,
  initialized: false,
  loading: false,

  initMeal: async () => {
    if (get().initialized) return
    set({ loading: true })
    try {
      const [preferences, recipes, recentPlans, geminiApiKey, geminiModelName, savedProposal] = await Promise.all([
        preferencesApi.getAll(),
        recipesApi.getAll(),
        plansApi.getRecent(14),
        geminiKeyApi.get(),
        geminiKeyApi.getModelName(),
        aiProposalApi.getLatest(),
      ])
      await plansApi.deleteOld()
      set({ preferences, recipes, recentPlans, geminiApiKey, geminiModelName, savedProposal, initialized: true })
    } finally {
      set({ loading: false })
    }
  },

  loadWeekPlans: async (from, to) => {
    const weekPlans = await plansApi.getRange(from, to)
    set({ weekPlans })
  },

  addPreference: async (pref) => {
    const added = await preferencesApi.add(pref)
    set(s => ({ preferences: [...s.preferences, added] }))
  },

  deletePreference: async (id) => {
    await preferencesApi.delete(id)
    set(s => ({ preferences: s.preferences.filter(p => p.id !== id) }))
  },

  addRecipe: async (recipe) => {
    const added = await recipesApi.add(recipe)
    set(s => ({ recipes: [added, ...s.recipes] }))
  },

  updateRecipe: async (id, recipe) => {
    const updated = await recipesApi.update(id, recipe)
    set(s => ({ recipes: s.recipes.map(r => r.id === id ? updated : r) }))
  },

  deleteRecipe: async (id) => {
    await recipesApi.delete(id)
    set(s => ({ recipes: s.recipes.filter(r => r.id !== id) }))
  },

  upsertPlan: async (plan) => {
    const saved = await plansApi.upsert(plan)
    set(s => {
      const filtered = s.weekPlans.filter(
        p => !(p.date === saved.date && p.meal_type === saved.meal_type),
      )
      return {
        weekPlans: [...filtered, saved].sort((a, b) => a.date.localeCompare(b.date)),
        recentPlans: [...s.recentPlans.filter(
          p => !(p.date === saved.date && p.meal_type === saved.meal_type),
        ), saved].sort((a, b) => a.date.localeCompare(b.date)),
      }
    })
  },

  deletePlan: async (id) => {
    await plansApi.delete(id)
    set(s => ({
      weekPlans: s.weekPlans.filter(p => p.id !== id),
      recentPlans: s.recentPlans.filter(p => p.id !== id),
    }))
  },

  saveGeminiKey: async (key) => {
    await geminiKeyApi.save(key)
    set({ geminiApiKey: key })
  },

  saveGeminiModelName: async (modelName) => {
    await geminiKeyApi.saveModelName(modelName)
    set({ geminiModelName: modelName })
  },

  saveAiProposal: async (proposal) => {
    const saved = await aiProposalApi.save({
      summary: proposal.summary,
      meals: proposal.meals,
      shopping_list: proposal.shopping_list,
    })
    set({ savedProposal: saved })
  },
}))
