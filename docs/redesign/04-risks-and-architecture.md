# Lifolio 2.0 再設計 ── リスク / 技術的負債 / アーキテクチャ候補

> 解析を踏まえた評価と提案。最終推奨は Phase4（逆質問）の回答により確定する。

---

## 1. リスク一覧（重大度順）

| # | 重大度 | リスク | 内容 |
|---|---|---|---|
| R1 | 🔴致命 | **データアクセス無防備** | 全テーブル RLS 全許可。anon key は配布JSに露出。URLとanon keyを知る第三者が家計・口座データを read/write/delete 可能 |
| R2 | 🔴致命 | **認証がUI上の飾り** | 認証はクライアント側ハッシュ比較＋localStorageフラグのみ。データ層は誰でも素通り |
| R3 | 🔴高 | **開発=本番 同一DB** | 開発操作が本番データへ直撃。マイグレーション事故・誤削除の保護壁が無い |
| R4 | 🔴高 | **AIキー平文露出** | Groqキーが `app_settings` に平文・anon可読・ブラウザから直送信。キー漏洩→課金悪用 |
| R5 | 🟠中 | **破壊的自動削除** | `deleteOld`(献立1ヶ月超)・ai_proposals(1件)・shopping(5件) が黙って物理削除。履歴保存要件と衝突 |
| R6 | 🟠中 | **AI出力の脆いパース** | `extractJson` の正規表現サニタイズはLLM出力次第で破綻。構造化出力前提でない |
| R7 | 🟠中 | **バックアップ不在** | 自動バックアップ・PITR設定の記述なし。喪失時の復旧手段が不明 |
| R8 | 🟡低 | **テスト/監視ゼロ** | 回帰検知不可。Flutter移行時に計算ロジック移植の正しさを保証する基盤が無い |

---

## 2. 技術的負債一覧

| 区分 | 負債 |
|---|---|
| 命名 | `lib/gemini.ts` の実体は Groq。`geminiApiKey`/`geminiModelName` も誤称 |
| 構造 | account系がAPI層化されておらずPageが直接 supabase 呼出（mealは整理済みで非対称） |
| データモデル | `"shota"/"miyu"` 文字列ハードコードが全層に散在。ユーザー/世帯テーブル不在 |
| データモデル | jsonb非正規化（ai_proposals.meals, shopping_lists.items）で集計・再利用が困難 |
| 型 | Supabase型自動生成なし。手書き型とDBの乖離リスク |
| 機能欠落 | 支出/家計簿トランザクションのデータモデルが無い（AI数値分析の土台が無い） |
| 運用 | env分離・seed・ローカル起動手順（Docker等）が無い |

---

## 3. 改善提案（優先度順サマリ）

1. **環境分離 + バックアップ**（最優先・データ保護の前提）: Local / Dev / Prod の3環境、本番のPITR/日次ダンプ確立。
2. **認証 → Supabase Auth、RLSをユーザー/世帯単位に厳格化**（R1/R2解消、認証移行と一体で）。
3. **Agent Server 新設**: AIキーをサーバ保管、Claude Agent SDK で提案→承認→実行を統制。クライアントからキーを排除。
4. **データモデル拡張**: 世帯(household)・ユーザー概念の導入、AI履歴テーブル、（必要なら）支出簿テーブルの新設。**`account_records` は後方互換で温存**。
5. **計算ロジックの純粋関数化 + テスト**: Flutter移植前に振込計算をテストで固定（リグレッション防止）。
6. **Docker化**: 開発体験と環境再現性。

---

## 4. アーキテクチャ候補（最低3案）

### 案A: 段階的・薄いBFF（推奨ベースライン）
```
Flutter / 現React  →  Agent Server(BFF, Node/TS or Python)  →  Supabase
                          ├ Claude Agent SDK (AIオーケストレーション)
                          └ Supabase Service Role (RLS越しの統制された書込)
```
- クライアントは Agent Server 経由でのみ DB/AI にアクセス。anon keyの直アクセスを段階的に廃止。
- AI書込は「提案を返す」だけ。確定APIは別エンドポイントで人間承認を必須化。
- **長所**: 既存ロジックを保ちつつ最小改修でセキュリティを根本改善。移行が漸進的。
- **短所**: サーバ運用が新たに発生。

### 案B: Supabase-Native（Edge Functions中心、専用サーバなし）
```
Flutter / React  →  Supabase (Auth + RLS + Edge Functions + pgvector)
                        └ Edge Function から Claude API 呼出
```
- Agent Server を立てず、Supabase Edge Functions にAI処理と承認ロジックを載せる。
- **長所**: インフラ最小。Supabase一本で完結。コスト低。
- **短所**: 複数Agentオーケストレーションや長時間処理に制約。Agent SDKの柔軟性は案Aに劣る。

### 案C: フルAgentプラットフォーム（目標形・将来）
```
Flutter  →  API Gateway  →  Agent Server
                              ├ Life Assistant（窓口/オーケストレーション）
                              ├ Finance / Recipe / Shopping / Planner Agents
                              └ 共有ツール層(Supabase, 外部: マルエツ特売, YouTube)
            Supabase(Auth/DB/Storage/pgvector) + AI履歴/ベクトル記憶
```
- ブリーフの理想構成。マルチエージェント + 記憶 + 外部連携。
- **長所**: 拡張性最大。「夫婦向けAIライフマネジメント基盤」の完成形。
- **短所**: 初期構築コスト大。要件が固まる前に作ると過剰設計。

---

## 5. 推奨案

### Phase4で確定した前提（2026-06-25）
- 家計AI分析 = `account_records`（給料/控除/振込額）の**推移分析に限定**。支出簿は当面追加しない。
  - ⚠ 食費推移は account_records から算出不可（食費金額データ無し）。対象は給料/控除/振込/目標到達/月次比較。
- 本番Supabase = **実データあり＋管理者権限あり** → S0バックアップが最優先。本番直接変更は禁止。
- 認証 = Supabase Auth、**各自アカウント＋同一世帯(household)** モデル。RLSは household_id / user_id 単位。
- Agent Server = **TypeScript / Node**（Claude Agent SDK）。

**案A をベースに、案C へ段階進化**（Strangler Fig 戦略）。
- まず案Aで「セキュリティ根治 + AIキー退避 + 環境分離」を確立し、現行機能を壊さず土台を作る。
- Agent を Life Assistant 1体から始め、Finance/Recipe/Shopping/Planner を**機能要求が固まった順に**案Cへ育てる。
- Flutter移行は土台（Agent Server API）が安定してから着手（API契約が先、UIは後）。

> 最終確定は Phase4 の回答（特にデータ分離方針・支出データの有無・サーバ言語）に依存。

---

## 6. 段階的移行計画（ドラフト ─ Phase5で確定）

| Stage | 目的 | 主な作業 | 本番への影響 |
|---|---|---|---|
| S0 | **保護** | 本番スキーマ/データのバックアップ、PITR確認、リポジトリへ現状schema固定 | 読取のみ |
| S1 | **環境分離** | Supabase Local(Docker) + Dev プロジェクト構築、seedデータ整備 | なし |
| S2 | **ロジック保全** | 振込計算を純粋関数+テスト化（現挙動を凍結） | なし |
| S3 | **Agent Server最小** | BFF新設、AIキー退避、Groq/Claude呼出をサーバへ移設 | なし（並行運用） |
| S4 | **認証+RLS** | Supabase Auth導入、世帯/ユーザーモデル、RLS厳格化（認証と一体） | 計画メンテ枠で実施 |
| S5 | **データモデル拡張** | AI履歴・タスク・（必要なら支出簿）テーブル追加（後方互換） | 追加のみ |
| S6 | **UIモダナイズ/Flutter** | API契約安定後にFlutter着手。Web版は並行維持 | なし |
| S7 | **マルチAgent化** | Finance/Recipe/Shopping/Planner を順次導入 | 追加のみ |

各Stageは「開発環境で回帰確認 → 承認 → 本番反映」を必須とする。
