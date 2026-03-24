import type { MealPreference, MealPlan, MealRecipe, AiProposal, ChatMessage } from '@/types/meal'

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
  if (blockMatch) {
    return JSON.parse(blockMatch[1].trim()) as T
  }
  // フォールバック: { } の範囲を探す
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    return JSON.parse(text.slice(start, end + 1)) as T
  }
  throw new GeminiError('AIからの応答をJSONとして解析できませんでした')
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
): string {
  return `献立提案AI。ShotaとMiyu夫婦の昼食・夕食を提案する。

${buildPreferencesText(preferences)}

【参考レシピ】${buildRecipesText(recipes)}

【直近の献立（重複禁止）】${buildRecentPlansText(recentPlans)}

ルール:
- 苦手食材NG、直近と重複NG
- 好物は全体の30%以下を目安にし、残りはバリエーション豊富な料理を提案する（好物ばかりにしない）
- ジャンル（和食・洋食・中華・アジア）をバランスよくばらけさせる
- 【夕食 dinner】必ず主菜（肉・魚・卵など）を1品含めること。さらにもう1品（副菜またはスープ）を推奨する
- 【昼食 lunch】パスタ・丼もの・炒飯・麺類など10〜20分で作れる簡単な一品料理。副菜は不要
- 各料理に詳細な調理手順（steps）を必ず記載する
必ず下記JSON形式のみで回答。
\`\`\`json
{
  "summary": "概要（1〜2文）",
  "meals": [
    {
      "date": "YYYY-MM-DD",
      "meal_type": "dinner または lunch",
      "dish_name": "料理名",
      "genre": "和食",
      "type": "主菜",
      "ingredients": "食材（カンマ区切り）",
      "steps": "1. 〜\n2. 〜\n3. 〜",
      "duration_min": 30,
      "difficulty": 2,
      "note": "ポイント"
    }
  ],
  "shopping_list": [
    { "item": "食材名", "amount": "量", "category": "カテゴリ" }
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
  const systemPrompt = buildSystemPrompt(params.preferences, params.recentPlans, params.recipes)
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
  return extractJson<AiProposal>(text)
}

/** 会話履歴を継続して提案を修正する */
export async function continueMealChat(
  apiKey: string,
  history: ChatMessage[],
  userMessage: string,
  params: Pick<GenerateProposalParams, 'preferences' | 'recentPlans' | 'recipes' | 'modelName'>,
): Promise<AiProposal> {
  const systemPrompt = buildSystemPrompt(params.preferences, params.recentPlans, params.recipes)

  // ChatMessage の role: 'model' を Groq の 'assistant' にマッピング
  const messages: GroqMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({
      role: (msg.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: msg.text,
    })),
    { role: 'user', content: userMessage },
  ]

  const text = await callGroq(apiKey, messages, params.modelName)
  return extractJson<AiProposal>(text)
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
