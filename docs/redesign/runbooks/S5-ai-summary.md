# S5.1 Runbook ── 家計AI要約（Gemini / Supabase Edge Function）

> 目的: 家計分析ページの「✨ AI要約」を有効化する。
> **APIキーはサーバ（Edge Function の Secret）に置き、クライアントに露出させない。**
> このFunctionは**DBに触れない**（集計値→文章の変換のみ）。本番DBは変更しない。
> 未デプロイでも分析ページは正常動作する（AI要約カードが「未設定」表示になるだけ）。

---

## 構成
```
ブラウザ（分析ページ）
  └─ supabase.functions.invoke('finance-summary', { input: 集計値 })
        └─ Edge Function finance-summary（Deno）
              └─ Gemini API（キーは Secret GEMINI_API_KEY）→ 要約テキスト
```
- 関数コード: `supabase/functions/finance-summary/index.ts`
- クライアント: `src/features/account/AnalysisPage.tsx`（AI要約カード）

---

## 前提
- Supabase CLI（未導入なら）:
  ```bash
  # 公式のインストール手順（npm -g は非推奨）。例（Linux, tarball）:
  # https://supabase.com/docs/guides/cli
  supabase --version
  ```
- Gemini APIキー（無料）: Google AI Studio で取得 → https://aistudio.google.com/app/apikey

---

## デプロイ手順（本番プロジェクト。DBは変更しない）
```bash
cd /home/miyuu/workspaces_vscode/Lifolio

# 1) プロジェクトにリンク（初回のみ）
supabase login
supabase link --project-ref daxobewnunuofkxrkmri

# 2) Gemini キーを Secret として登録（クライアントには出ない）
 supabase secrets set GEMINI_API_KEY='＜Google AI StudioのAPIキー＞'
#   任意でモデル変更: supabase secrets set GEMINI_MODEL='gemini-2.0-flash'

# 3) 関数をデプロイ
supabase functions deploy finance-summary
```

> `supabase functions deploy` は Edge Function（サーバレス）を追加するだけで、
> テーブルやRLSなどDBには一切変更を加えない。無料枠内で動作。

---

## 動作確認
1. アプリの `共有口座管理 › 家計分析` を開く。
2. 「✨ AI要約」の **[AIに要約を依頼]** を押す。
3. 数秒で最新月の要約（給料/振込/目標到達率と前月比＋「日々の支出は未記録」注記）が表示されればOK。

CLIからの単体テスト（任意）:
```bash
curl -i -X POST \
  "https://daxobewnunuofkxrkmri.supabase.co/functions/v1/finance-summary" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>" \
  -H "content-type: application/json" \
  -d '{"input":{"latestMonth":"2026-06","count":6,"totalTransferred":203000,"avgSalaryTotal":528000,"latest":{"salaryTotal":550000,"deductTotal":30000,"netTotal":520000,"transTotal":21000,"targetBalance":120000,"currentBalance":99000,"achievementPct":82.5},"prev":{"salaryTotal":535000,"deductTotal":29000,"netTotal":506000,"transTotal":25000,"targetBalance":120000,"currentBalance":95000,"achievementPct":79.2},"yoy":null,"recent":[]}}'
```

---

## 設計上の約束（要件遵守）
- AIには **「与えられた数値の事実のみ説明。推測・助言・将来予測はしない」** と指示（プロンプト内）。
- Function は集計値だけを受け取り、**DBの読み書きをしない**。
- キーは Secret 管理でクライアント非露出（現行のクライアント側AIキー方式=R4 とは別の安全な方式。将来 S3 で献立AIも同方式へ寄せる）。

## 完了条件
- [ ] `supabase functions deploy finance-summary` 成功
- [ ] `GEMINI_API_KEY` を Secret 設定
- [ ] 分析ページの「AIに要約を依頼」で要約が表示される
- [ ] 本番DB（テーブル/RLS/データ）は無変更のまま
