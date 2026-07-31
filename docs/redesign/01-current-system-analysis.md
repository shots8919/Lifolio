# Lifolio 2.0 再設計 ── Phase1: 現行システム解析

> 解析日: 2026-06-25 / 対象コミット: `d677b66`
> 役割: シニアPM / システムアーキテクト / テックリードによる現状分析
> 本書は「現状の事実」のみを記述する。評価・提案は `02-risks-and-architecture.md` に分離。

---

## 1. システム構成図（現状）

```
┌─────────────────────────────────────────────────────────────┐
│ ブラウザ (SPA)  ── GitHub Pages 静的ホスティング (/Lifolio)   │
│                                                               │
│  React 19 + TS strict + Vite + React Router 7 + Zustand 5     │
│  Tailwind CSS 3                                                │
│                                                               │
│   ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐    │
│   │ authStore   │   │ mealStore    │   │ 各Pageが直接     │    │
│   │ (persist)   │   │ (in-memory)  │   │ supabase呼出     │    │
│   └─────────────┘   └──────────────┘   └─────────────────┘    │
│         │                  │                    │             │
│         │            lib/mealApi.ts      lib/supabase.ts      │
│         │            lib/gemini.ts(Groq)                      │
└─────────┼──────────────────┼────────────────────┼────────────┘
          │                  │                    │
          │ (anon key,       │ (anon key)         │ fetch (Bearer apiKey)
          │  client-side)    ▼                    ▼
          │         ┌──────────────────┐   ┌──────────────────┐
          │         │ Supabase         │   │ Groq API         │
          └────────▶│ PostgreSQL+RLS   │   │ llama-3.3-70b     │
                    │ (開発=本番 同一) │   │ (OpenAI互換)      │
                    └──────────────────┘   └──────────────────┘
```

**重要な構造的特徴**
- バックエンドは存在しない。SPAがブラウザから直接 Supabase と Groq を叩く完全クライアントサイド構成。
- Supabase URL / anon key は GitHub Actions の Secrets からビルド時に埋め込まれ、**配布JSバンドルに露出**する。
- AI（Groq）APIキーは `app_settings` テーブルに平文保存され、ブラウザから直接利用。
- CI/CD: `main` への push で GitHub Pages へ自動デプロイ（`.github/workflows/deploy.yml`）。

---

## 2. 画面一覧

| パス | コンポーネント | 役割 | 認証 |
|---|---|---|---|
| `/login` | `LoginPage` | ユーザー名/パスワード認証 | 不要 |
| `/` | `DashboardPage` | ホーム（お知らせ・機能カード） | 要 |
| `/account/calculate` | `CalculatePage` | **振込額計算（中核業務ロジック）** | 要 |
| `/account/data` | `DataPage` | 月次記録の照会・CSV出力・削除 | 要 |
| `/meal/plan` | `MealPage`→`PlanPage` | 週間献立カレンダー + AI提案 | 要 |
| `/meal/recipes` | `MealPage`→`RecipesPage` | レシピCRUD・URL取込 | 要 |
| `/meal/preferences` | `MealPage`→`PreferencesPage` | 好み（大好物/苦手）管理 | 要 |
| `/settings` | `SettingsPage` | AI APIキー/モデル設定・パスワード変更 | 要 |

- ナビゲーション: PC=`Sidebar`、モバイル=`BottomNav`（ホーム/共有口座/献立/家事[準備中]/設定）。
- ルーティングは `basename="/Lifolio"`（GitHub Pages サブパス）。`ProtectedRoute` は **クライアント状態のみ**で判定。

---

## 3. コンポーネント一覧

**レイアウト** (`src/components/layout/`)
- `AppLayout` … 認証後の枠（Header + Sidebar/BottomNav + `<Outlet/>`）
- `Header` / `Sidebar` / `BottomNav` … ナビゲーション

**共通UI** (`src/components/ui/`)
- `NekoIcon` … ロゴ
- `RecordDetailModal` … 月次記録の詳細表示

**機能 (account)**
- `CalculatePage` … 設定パネル + 入力フォーム + 計算結果 + 確定保存
- `DataPage` … 記録テーブル + CSV出力

**機能 (meal)**
- `MealPage` … タブ親（plan/recipes/preferences）+ `initMeal` 起動
- `plan/PlanPage` … 週間カレンダー、`DetailModal`/`SlotEditModal`/`DinnerSlots`/`MealSlot`
- `plan/AiProposalPanel` … AI提案フォーム→提案表示→編集→確定→買い物リスト生成、`MealCard`/`ShoppingListSection`
- `recipes/RecipesPage` + `recipes/RecipeFormModal`
- `preferences/PreferencesPage`

**ページ** (`src/pages/`): `DashboardPage` / `SettingsPage`
**認証** (`src/features/auth/`): `LoginPage`

---

## 4. 状態管理一覧（Zustand）

| Store | 永続化 | 保持データ | 備考 |
|---|---|---|---|
| `authStore` | **persist** (`localStorage: lifolio_auth`) | `isAuthenticated`, `username` | パスワード検証なしで認証状態を保持。リロード耐性のための事実上の唯一の認証ゲート |
| `mealStore` | なし(in-memory) | preferences, recipes, weekPlans, recentPlans, geminiApiKey, geminiModelName, savedProposal, savedShoppingList | `initMeal()` で一括ロード。CRUD後に楽観的更新 |

- **account系には専用Storeが無い**。`CalculatePage`/`DataPage` は `supabase` を直接呼びローカル `useState` で完結。

---

## 5. API層一覧

### 5.1 `lib/supabase.ts`
- `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` のみ。

### 5.2 `lib/mealApi.ts`（献立ドメインのデータアクセス）
| API | 操作 | テーブル | 特記 |
|---|---|---|---|
| `preferencesApi` | getAll/add/delete | meal_preferences | |
| `recipesApi` | getAll/add/update/delete | meal_recipes | お気に入り優先ソート |
| `plansApi` | getRange/getRecent/upsert/delete/**deleteOld** | meal_plans | `deleteOld`=1ヶ月超を物理削除 |
| `shoppingListApi` | getLatest/save | meal_shopping_lists | 最新5件のみ保持（古いものを削除） |
| `aiProposalApi` | getLatest/save | ai_proposals | **最新1件のみ**保持（旧を物理削除） |
| `geminiKeyApi` | get/save/getModelName/saveModelName | app_settings | AIキー・モデル名 |

### 5.3 `lib/gemini.ts`（AI層 ── 実体はGroq）
- `callGroq()` … `https://api.groq.com/openai/v1/chat/completions`、`temperature 0.8`, `max_tokens 8192`。
- `generateMealProposal()` / `continueMealChat()` / `generateShoppingList()` / `importRecipeFromUrl()`。
- `extractJson()` … LLM出力からJSON抽出 + 制御文字サニタイズ（脆い手動パース）。
- ファイル名は `gemini` だが**中身はGroq固定**（命名と実装の不一致）。

### 5.4 account系（API層化されていない）
- `CalculatePage`/`DataPage`/`LoginPage`/`SettingsPage` が `supabase` を直接呼び出し（`account_settings`, `account_records`, `app_settings`）。

---

## 6. DB構造一覧（`supabase/schema.sql`）

| # | テーブル | 主キー | 役割 |
|---|---|---|---|
| 1 | `app_settings` | `key` (text) | 認証ハッシュ・AIキー・モデル名（KVS） |
| 2 | `account_settings` | `key` (text) | 控除設定・目標残高（`key='user_settings'` の jsonb） |
| 3 | `account_records` | `id` (uuid) | **月次の振込計算結果**（中核資産） |
| 4 | `meal_preferences` | `id` (uuid) | 好み（person×type×category×name） |
| 5 | `meal_recipes` | `id` (uuid) | レシピ |
| 6 | `meal_plans` | `id` (uuid) | 献立計画（date×meal_type×dish_role 一意） |
| 7 | `ai_proposals` | `id` (uuid) | AI提案スナップショット（最新1件） |
| 8 | `meal_shopping_lists` | `id` (uuid) | 買い物リスト（最新5件） |

### `account_records` カラム（保護対象）
`month`(unique), `target_balance`, `current_balance`, `salary_shota`, `salary_miyu`,
`shota_deduct`, `miyu_deduct`, `shota_deduct_items`(jsonb), `miyu_deduct_items`(jsonb),
`net_shota`, `net_miyu`, `ratio_shota`(numeric 6,4), `ratio_miyu`, `trans_shota`, `trans_miyu`, `confirmed_at`。

### RLS（全テーブル共通・重大）
- 全テーブルで `using (true) with check (true)`（または anon select/insert/update 全許可）。
- = **anon key を持つ誰でも全データを read/write 可能**。ユーザー単位の分離は存在しない。

---

## 7. リレーション一覧

- `meal_plans.recipe_id → meal_recipes.id` (`on delete set null`)。これが唯一のFK。
- 論理的関連（FK無し・コード上の結合）:
  - `ai_proposals.meals[]` / `meal_shopping_lists.items[]` … jsonbで非正規化保持。
  - `meal_preferences.person` / `account_records.*_shota|*_miyu` … "shota"/"miyu" を**文字列リテラルで全体にハードコード**（ユーザーテーブル不在）。
- `account_settings`・`app_settings` は KVS で他テーブルと関連なし。

---

## 8. 横断的事実（Phase2/3の前提）

- **テスト・型生成・監視・エラートラッキングは一切なし**。
- **環境分離なし**: 開発と本番が同一 Supabase プロジェクト。
- **家計＝支出簿ではない**: `account_records` は「給料・控除・目標残高・振込額」の記録であり、**日々の支出/家計簿トランザクションのテーブルは存在しない**。
- AI献立は既に「提案 → ユーザー編集 → 確定（DB書込）」フローを実装済み（目標の承認フローと方向性が一致）。
- `plansApi.deleteOld()` が `initMeal` 時に毎回1ヶ月超の献立を**物理削除**（破壊的自動処理）。
</invoke>
