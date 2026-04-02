// ─── 好み管理 ────────────────────────────────────────────────────
export type PreferencePerson = 'shota' | 'miyu'
export type PreferenceType = 'love' | 'dislike'

export const PREFERENCE_CATEGORIES = [
  '肉類', '魚介類', '野菜', 'きのこ', '穀物・麺', '乳製品・卵', '調味料・香辛料', 'その他',
] as const
export type PreferenceCategory = typeof PREFERENCE_CATEGORIES[number]

export interface MealPreference {
  id: string
  created_at: string
  person: PreferencePerson
  type: PreferenceType
  category: PreferenceCategory
  name: string
}

// ─── レシピ管理 ─────────────────────────────────────────────────
export const RECIPE_GENRES = ['和食', '洋食', '中華', 'アジア', 'その他'] as const
export type RecipeGenre = typeof RECIPE_GENRES[number]

export const RECIPE_TYPES = ['主菜', '副菜', 'スープ・汁物', 'ご飯もの', 'その他'] as const
export type RecipeType = typeof RECIPE_TYPES[number]

export type RecipeDifficulty = 1 | 2 | 3

export interface MealRecipe {
  id: string
  created_at: string
  name: string
  genre: RecipeGenre
  type: RecipeType
  difficulty: RecipeDifficulty
  duration_min: number | null
  ingredients: string
  steps: string
  memo: string
  source_url: string | null
  is_favorite: boolean
}

// ─── 献立計画 ────────────────────────────────────────────────────
export type MealSlotType = 'lunch' | 'dinner'

/** 夕食の品目役割: main=主食・主菜, side=副菜, soup=汁物, single=昼食1品 */
export type DishRole = 'single' | 'main' | 'side' | 'soup'

export const DISH_ROLE_LABELS: Record<DishRole, string> = {
  single: '一品料理',
  main: '主食・主菜',
  side: '副菜',
  soup: '汁物',
}

export interface MealPlan {
  id: string
  created_at: string
  date: string         // 'YYYY-MM-DD'
  meal_type: MealSlotType
  dish_role: DishRole
  recipe_id: string | null
  free_text: string | null
  ai_proposal: boolean
  recipe?: MealRecipe  // Supabaseのjoin結果
}

// ─── AI提案 ──────────────────────────────────────────────────────
export interface AiProposedMeal {
  date: string
  meal_type: MealSlotType
  dish_role: DishRole
  dish_name: string
  genre: string
  type: string
  ingredients: string
  steps?: string
  duration_min: number | null
  difficulty: number | null
  note: string
  /** 提案フロントエンド内でのみ使用するID */
  _localId?: string
  /** ユーザーがレシピから変更した場合のrecipe_id（フロントエンドのみ） */
  _recipeId?: string
}

export interface AiProposal {
  summary: string
  meals: AiProposedMeal[]
}

export interface SavedAiProposal {
  id: string
  created_at: string
  summary: string
  meals: AiProposedMeal[]
  shopping_list: ShoppingItem[]
}

export interface ShoppingItem {
  item: string
  amount: string
  category: string
}

export interface SavedShoppingList {
  id: string
  created_at: string
  date_from: string
  date_to: string
  items: ShoppingItem[]
}

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
  proposal?: AiProposal
}
