// ============================================================================
// Supabase Edge Function: finance-summary
//
// クライアントから受け取った「account_records の集計値(input)」を Gemini に渡し、
// 日本語の要約テキストを返す。Gemini APIキーはサーバの Secret(GEMINI_API_KEY) に
// 保管し、クライアントには一切露出させない（合意アーキテクチャ: キーはサーバ側）。
//
// このFunctionはDBに触れない（純粋な「数値→文章」変換）。読取専用方針を維持し、
// AIには「与えられた数値の事実のみ説明・助言や推測はしない」と指示する。
//
// デプロイ手順は docs/redesign/runbooks/S5-ai-summary.md を参照。
// 実行環境は Deno（フロントの tsc/eslint 対象外）。
// ============================================================================

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

function buildPrompt(input: unknown): string {
  return [
    'あなたは家計データの要約アシスタントです。',
    '次のJSONは、夫婦の共有口座の月次記録（account_records）から算出した数値です。金額はすべて円。',
    'これらの数値の事実だけに基づき、日本語で3〜4文の簡潔な要約を書いてください。',
    '',
    'ルール:',
    '- 与えられた数値の事実のみを述べる。推測・助言・将来予測・改善提案はしない。',
    '- 最新月(latest)の給料合計・振込合計・目標到達率(achievementPct)に触れ、前月(prev)があれば前月比の増減にも触れる。',
    '- 箇条書きではなく短い文章で。主観的な良し悪しの評価は避け、中立に述べる。',
    '- 最後に一文、「※ 日々の支出（食費など）は記録していないため、この分析は給料・控除・振込・目標残高に限ります。」と添える。',
    '',
    'データ:',
    JSON.stringify(input, null, 2),
  ].join('\n')
}

// @ts-ignore Deno はEdge Function実行環境で提供される
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // @ts-ignore Deno.env は実行環境で提供される
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return json({ error: 'GEMINI_API_KEY が未設定です（supabase secrets set GEMINI_API_KEY=...）' }, 500)
  }
  // @ts-ignore
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'

  let input: unknown
  try {
    const body = await req.json()
    input = body?.input ?? body
  } catch {
    return json({ error: 'リクエストボディが不正なJSONです' }, 400)
  }
  if (!input) return json({ error: 'input がありません' }, 400)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(input) }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
        }),
      },
    )

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300)
      return json({ error: `Gemini API エラー (${res.status})`, detail }, 502)
    }

    const data = await res.json()
    const parts = data?.candidates?.[0]?.content?.parts ?? []
    const summary = parts.map((p: { text?: string }) => p?.text ?? '').join('').trim()
    if (!summary) return json({ error: 'Gemini から空の応答が返りました' }, 502)

    return json({ summary })
  } catch (e) {
    return json({ error: `リクエスト失敗: ${(e as Error).message}` }, 500)
  }
})
