import { supabase } from './supabase'
import type { MealPreference, MealRecipe, MealPlan, SavedAiProposal, SavedShoppingList } from '@/types/meal'

// ─── 好み管理 ────────────────────────────────────────────────────
export const preferencesApi = {
  async getAll(): Promise<MealPreference[]> {
    const { data, error } = await supabase
      .from('meal_preferences')
      .select('*')
      .order('created_at')
    if (error) throw error
    return data ?? []
  },

  async add(
    pref: Omit<MealPreference, 'id' | 'created_at'>,
  ): Promise<MealPreference> {
    const { data, error } = await supabase
      .from('meal_preferences')
      .insert(pref)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('meal_preferences').delete().eq('id', id)
    if (error) throw error
  },
}

// ─── レシピ管理 ─────────────────────────────────────────────────
export const recipesApi = {
  async getAll(): Promise<MealRecipe[]> {
    const { data, error } = await supabase
      .from('meal_recipes')
      .select('*')
      .order('is_favorite', { ascending: false })
      .order('name')
    if (error) throw error
    return data ?? []
  },

  async add(
    recipe: Omit<MealRecipe, 'id' | 'created_at'>,
  ): Promise<MealRecipe> {
    const { data, error } = await supabase
      .from('meal_recipes')
      .insert(recipe)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(
    id: string,
    recipe: Partial<Omit<MealRecipe, 'id' | 'created_at'>>,
  ): Promise<MealRecipe> {
    const { data, error } = await supabase
      .from('meal_recipes')
      .update(recipe)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('meal_recipes').delete().eq('id', id)
    if (error) throw error
  },
}

// ─── 献立計画 ────────────────────────────────────────────────────
export const plansApi = {
  async getRange(from: string, to: string): Promise<MealPlan[]> {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*, recipe:meal_recipes(*)')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('meal_type')
    if (error) throw error
    return (data ?? []) as MealPlan[]
  },

  async getRecent(days: number): Promise<MealPlan[]> {
    const from = new Date()
    from.setDate(from.getDate() - days)
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*, recipe:meal_recipes(*)')
      .gte('date', from.toISOString().split('T')[0])
      .order('date')
    if (error) throw error
    return (data ?? []) as MealPlan[]
  },

  async upsert(
    plan: Omit<MealPlan, 'id' | 'created_at' | 'recipe'>,
  ): Promise<MealPlan> {
    const { data, error } = await supabase
      .from('meal_plans')
      .upsert(plan, { onConflict: 'date,meal_type,dish_role' })
      .select('*, recipe:meal_recipes(*)')
      .single()
    if (error) throw error
    return data as MealPlan
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('meal_plans').delete().eq('id', id)
    if (error) throw error
  },

  /** 1ヶ月以上前の献立を削除（ログイン時に呼び出す） */
  async deleteOld(): Promise<void> {
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - 1)
    const { error } = await supabase
      .from('meal_plans')
      .delete()
      .lt('date', cutoff.toISOString().split('T')[0])
    if (error) throw error
  },
}

// ─── 買い物リスト保存 ──────────────────────────────────────────────
export const shoppingListApi = {
  async getLatest(): Promise<SavedShoppingList | null> {
    const { data } = await supabase
      .from('meal_shopping_lists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data ?? null) as SavedShoppingList | null
  },

  async save(
    list: Omit<SavedShoppingList, 'id' | 'created_at'>,
  ): Promise<SavedShoppingList> {
    const { data, error } = await supabase
      .from('meal_shopping_lists')
      .insert(list)
      .select()
      .single()
    if (error) throw error
    // 古いリストを削除（最新5件まで保持）
    const { data: all } = await supabase
      .from('meal_shopping_lists')
      .select('id')
      .order('created_at', { ascending: false })
    const keepIds = (all ?? []).slice(0, 5).map((r: { id: string }) => r.id)
    if (keepIds.length > 0) {
      await supabase.from('meal_shopping_lists').delete().not('id', 'in', `(${keepIds.map(id => `'${id}'`).join(',')})`)
    }
    return data as SavedShoppingList
  },
}

// ─── AI提案保存 ─────────────────────────────────────────────────
export const aiProposalApi = {
  async getLatest(): Promise<SavedAiProposal | null> {
    const { data } = await supabase
      .from('ai_proposals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return data as SavedAiProposal
  },

  async save(
    proposal: Pick<SavedAiProposal, 'summary' | 'meals' | 'shopping_list'>,
  ): Promise<SavedAiProposal> {
    // 新規挿入
    const { data, error } = await supabase
      .from('ai_proposals')
      .insert(proposal)
      .select()
      .single()
    if (error) throw error
    // 旧提案を削除（最新1件のみ保持）
    await supabase.from('ai_proposals').delete().neq('id', data.id)
    return data as SavedAiProposal
  },
}

// ─── Gemini APIキー ──────────────────────────────────────────────
export const geminiKeyApi = {
  async get(): Promise<string | null> {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single()
    return data?.value ?? null
  },

  async save(key: string): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'gemini_api_key', value: key })
    if (error) throw error
  },
  async getModelName(): Promise<string | null> {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'gemini_model_name')
      .single()
    return data?.value ?? null
  },

  async saveModelName(modelName: string): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'gemini_model_name', value: modelName })
    if (error) throw error
  },}
