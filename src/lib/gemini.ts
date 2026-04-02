import type { MealPreference, MealPlan, MealRecipe, AiProposal, AiProposedMeal, ChatMessage, ShoppingItem } from '@/types/meal'

// Groq API（OpenAI互換）エンドポイント
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// デフォルトモデル: llama-3.3-70b-versatile（無料・高性能）
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export class GeminiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiError'
  }
}

// ─── 内部ヘルパー ──────────────────────────────────────────────

interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callGroq(
  apiKey: string,
  messages: GroqMessage[],
  modelName?: string | null,
): Promise<string> {
  const model = modelName?.trim() || DEFAULT_MODEL
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.8,
      max_tokens: 8192,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: { message?: string } })?.error?.message
    throw new GeminiError(msg ?? `APIリクエストが失敗しました (${res.status})`)
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content ?? ''
}

function extractJson<T>(text: string): T {
  // ```json ... ``` ブロックを優先して検索
  const blockMatch = text.match(/```json\s*([\s\S]*?)```/)
  const jsonStr = blockMatch ? blockMatch[1].trim() : (() => {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    return start !== -1 && end !== -1 ? text.slice(start, end + 1) : null
  })()

  if (!jsonStr) {
    throw new GeminiError(`AIからの応答をJSONとして解析できませんでした\n---応答内容---\n${text.slice(0, 300)}`)
  }

  // JSON文字列値の中にある生の制御文字（改行など）をエスケープ
  const sanitized = jsonStr.replace(/"((?:[^"\\]|\\.)*)"/gs, (_m, inner: string) => {
    return '"' + inner
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      + '"'
  })

  try {
    return JSON.parse(sanitized) as T
  } catch (e) {
    throw new GeminiError(`JSON解析失敗: ${(e as Error).message}\n---応答内容---\n${text.slice(0, 300)}`)
  }
}

// ─── プロンプト構築 ────────────────────────────────────────────

function buildPreferencesText(preferences: MealPreference[]): string {
  const format = (person: 'shota' | 'miyu', type: 'love' | 'dislike'): string => {
    const items = preferences.filter(p => p.person === person && p.type === type)
    if (items.length === 0) return 'なし'
    const byCategory: Record<string, string[]> = {}
    items.forEach(p => {
      if (!byCategory[p.category]) byCategory[p.category] = []
      byCategory[p.category].push(p.name)
    })
    return Object.entries(byCategory)
      .map(([cat, names]) => `${cat}: ${names.join(', ')}`)
      .join(' / ')
  }

  return `【Shotaの好み】
大好物: ${format('shota', 'love')}
苦手: ${format('shota', 'dislike')}

【Miyuの好み】
大好物: ${format('miyu', 'love')}
苦手: ${format('miyu', 'dislike')}`
}

function buildRecentPlansText(recentPlans: MealPlan[]): string {
  if (recentPlans.length === 0) return '記録なし'
  return recentPlans
    .map(p => {
      const name = p.recipe?.name ?? p.free_text ?? '不明'
      const slot = p.meal_type === 'dinner' ? '夜' : '昼'
      return `${p.date}(${slot}): ${name}`
    })
    .join(', ')
}

function buildRecipesText(recipes: MealRecipe[]): string {
  if (recipes.length === 0) return 'なし'
  return recipes.slice(0, 15)
    .map(r => `${r.name}(${r.genre})`)
    .join(', ')
}

function buildSystemPrompt(
  preferences: MealPreference[],
  recentPlans: MealPlan[],
  recipes: MealRecipe[],
  requiredRecipes: MealRecipe[],
): string {
  const requiredText = requiredRecipes.length > 0
    ? `\n【必ず含めるレシピ（AIが日付を割り当てる）】${requiredRecipes.map(r => r.name).join('、')}`
    : ''

  return `献立提案AI。ShotaとMiyu夫婦の昼食・夕食を提案する。

${buildPreferencesText(preferences)}

【参考レシピ】${buildRecipesText(recipes)}${requiredText}

【直近の献立（重複禁止）】${buildRecentPlansText(recentPlans)}

食材ルール:
- 必ず一般的なスーパーマーケットで購入できる食材のみ使用すること
- 特殊な輸入食材・専門店食材は使わない

献立ルール:
- 苦手食材NG、直近と重複NG
- 好物は全体の30%以下を目安とし、ジャンルをバランスよくバラけさせる
- 【夕食 dinner】1日につき以下の3品を必ず提案する:
  1. dish_role="main": 主食・主菜セット（例: 白米＋鶏の唐揚げ）
  2. dish_role="side": 副菜（例: ほうれん草のごま和え）
  3. dish_role="soup": 汁物（例: 豚汁）
- 【昼食 lunch】1日につき1品(dish_role="single")。パスタ・丼・炒飯・麺類など10〜20分の簡単一品
- 各料理の調理手順（steps）を詳しく記載する
必ず下記JSON形式のみで回答。
\`\`\`json
{
  "summary": "概要（1〜2文）",
  "meals": [
    {
      "date": "YYYY-MM-DD",
      "meal_type": "dinner または lunch",
      "dish_role": "main または side または soup または single",
      "dish_name": "料理名",
      "genre": "和食",
      "type": "主菜",
      "ingredients": "食材（カンマ区切り）",
      "steps": "1. ～\\n2. ～",
      "duration_min": 30,
      "difficulty": 2,
      "note": "ポイント"
    }
  ]
}
\`\`\``
}

// ─── 公開API ───────────────────────────────────────────────────

export interface GenerateProposalParams {
  days: number
  startDate: string
  theme: string
  ingredients: string
  requiredRecipes: MealRecipe[]   // 必ず使うレシピ
  preferences: MealPreference[]
  recentPlans: MealPlan[]
  recipes: MealRecipe[]
  modelName?: string | null
}

/** 献立の初回提案を生成する */
export async function generateMealProposal(
  apiKey: string,
  params: GenerateProposalParams,
): Promise<AiProposal> {
  const systemPrompt = buildSystemPrompt(params.preferences, params.recentPlans, params.recipes, params.requiredRecipes)
  const userMessage = `以下の条件で献立を提案してください。
日数: ${params.days}日分
開始日: ${params.startDate}
テーマ・希望: ${params.theme || 'なし'}
冷蔵庫の残り食材: ${params.ingredients || 'なし（考慮不要）'}`

  const text = await callGroq(
    apiKey,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    params.modelName,
  )
  const result = extractJson<AiProposal>(text)
  // _localId付与（フロント側の変更/削除管理用）
  result.meals = result.meals.map((m, i) => ({ ...m, _localId: `${m.date}-${m.meal_type}-${m.dish_role}-${i}` }))
  return result
}

/** 会話履歴を継続して提案を修正する */
export async function continueMealChat(
  apiKey: string,
  history: ChatMessage[],
  userMessage: string,
  params: Pick<GenerateProposalParams, 'preferences' | 'recentPlans' | 'recipes' | 'requiredRecipes' | 'modelName'>,
): Promise<AiProposal> {
  const systemPrompt = buildSystemPrompt(params.preferences, params.recentPlans, params.recipes, params.requiredRecipes)

  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({
      role: (msg.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: msg.text,
    })),
    { role: 'user', content: userMessage },
  ]

  const text = await callGroq(apiKey, messages, params.modelName)
  const result = extractJson<AiProposal>(text)
  result.meals = result.meals.map((m, i) => ({ ...m, _localId: `${m.date}-${m.meal_type}-${m.dish_role}-${i}` }))
  return result
}

/** 確定した献立から買い物リストをAI生成する */
export async function generateShoppingList(
  apiKey: string,
  meals: AiProposedMeal[],
  modelName?: string | null,
): Promise<ShoppingItem[]> {
  const mealText = meals.map(m =>
    `・${m.dish_name}（材料: ${m.ingredients || '不明'}）`
  ).join('\n')

  const text = await callGroq(
    apiKey,
    [
      {
        role: 'system',
        content: '料理レシピから買い物リストを生成するアシスタントです。重複食材をまとめ、カテゴリ分けしてJSON形式のみで返してください。',
      },
      {
        role: 'user',
        content: `以下の料理を作るための買い物リストを生成してください。食材を重複なくまとめ、スーパーで買えるものだけにしてください。\n\n${mealText}\n\n必ず以下のJSON形式のみで回答してください:\n\`\`\`json\n[\n  { "item": "食材名", "amount": "量", "category": "肉類 or 魚介類 or 野菜 or 穀物・缶詰 or 調味料 or 乳製品・卵 or その他" }\n]\n\`\`\``,
      },
    ],
    modelName,
  )

  // レスポンスは配列JSONなので対応
  const sanitized = text.match(/```json\s*([\s\S]*?)```/) 
    ? text.match(/```json\s*([\s\S]*?)```/)![1].trim()
    : text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)
  
  try {
    return JSON.parse(sanitized) as ShoppingItem[]
  } catch {
    return []
  }
}

export interface ImportedRecipe {
  name: string
  genre: string
  type: string
  difficulty: number
  duration_min: number | null
  ingredients: string
  steps: string
  memo: string
}

/** URLからレシピ情報を取得する */
export async function importRecipeFromUrl(
  apiKey: string,
  url: string,
  modelName?: string | null,
): Promise<ImportedRecipe> {
  const userMessage = `次のURLのレシピページから料理情報を抽出してJSON形式で返してください。
URL: ${url}

必ず以下のJSON形式で回答してください：
\`\`\`json
{
  "name": "料理名",
  "genre": "和食 or 洋食 or 中華 or アジア or その他",
  "type": "主菜 or 副菜 or スープ・汁物 or ご飯もの or その他",
  "difficulty": 1,
  "duration_min": null,
  "ingredients": "材料一覧（改行区切り）",
  "steps": "調理手順（ステップごとに改行）",
  "memo": "備考・ポイント"
}
\`\`\``

  const text = await callGroq(
    apiKey,
    [
      { role: 'system', content: 'レシピ情報を抽出するアシスタントです。求められた形式のJSONのみを返してください。' },
      { role: 'user', content: userMessage },
    ],
    modelName,
  )
  return extractJson<ImportedRecipe>(text)
}
