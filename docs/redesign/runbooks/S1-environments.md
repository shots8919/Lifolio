# S1 Runbook ── 環境分離 & Docker（Local / Development / Production）

> 目的: 「開発=本番 同一」を解消し、安全に実験できる **Local** と **Development** を用意する。
> 本ステップは**本番を変更しない**（本番はそのまま。新たにLocal/Devを増やすだけ）。
> 前提: S0（バックアップ）完了済み。

---

## 環境戦略

| 環境 | 実体 | 用途 | 変更の入り方 |
|---|---|---|---|
| **Local** | Supabase CLI (Docker) | 個人の開発・破壊的実験 | `supabase db reset` でmigrations+seedから毎回再構築 |
| **Development** | 専用 Supabase プロジェクト | 結合確認・CIの適用先 | migrationsをCIで適用 |
| **Production** | 現行 Supabase プロジェクト | 本番 | Devで検証済みmigrationのみ、手動承認で適用 |

**マイグレーションの流れ**: `Local` で作成 → `Development` で検証 → 承認 → `Production`。
一方向。逆流（本番で直接変更）は禁止。

---

## 追加済みファイル（このリポジトリ）
```
supabase/
├─ schema.sql                       # 既存（歴史的リファレンス。変更しない）
├─ migrations/0001_initial_schema.sql  # 現行スキーマの忠実なベースライン（新規・正）
└─ seed.sql                         # ローカル専用ダミーデータ（本番と無関係）
.env.example                        # 環境変数テンプレート
docker-compose.dev.yml              # Web開発サーバのコンテナ実行（任意）
```
> 以降、スキーマ変更は `supabase/migrations/000X_*.sql` を**追加**していく（`schema.sql` は触らない）。

---

## セットアップ手順（Ubuntu 22.04）

### 1. Supabase CLI と Docker
```bash
# Docker（未導入なら）
# https://docs.docker.com/engine/install/ubuntu/

# Supabase CLI
npm i -g supabase   # もしくは公式バイナリ
supabase --version
```

### 2. プロジェクト初期化（config.toml を生成）
```bash
# リポジトリ直下で
supabase init      # supabase/config.toml を生成（既存の migrations/seed はそのまま使われる）
```
> `supabase init` は `supabase/` にファイルがあっても migrations/seed を上書きしない。

### 3. ローカルスタック起動
```bash
supabase start     # 初回はイメージDL。完了後 URL/anon key/service_role key を表示
supabase status    # 値を後から確認
```
表示された **API URL** と **anon key** を `.env.local` に記入:
```bash
cp .env.example .env.local
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を supabase status の値に更新
```

### 4. スキーマ+seed をローカルDBへ適用
```bash
supabase db reset  # migrations/0001 を流し、seed.sql を投入（Localのみ・破壊的）
```

### 5. Web を起動して疎通確認
```bash
# ネイティブ:
npm install && npm run dev
# もしくは Docker:
docker compose -f docker-compose.dev.yml up
```
ローカルログイン: **ユーザー名 `dev` / パスワード `dev1234`**（seedで投入済み）。

---

## Development / Production の紐付け（本番は読取・適用のみ）
```bash
# Dev プロジェクトを作成（Supabaseダッシュボード）後:
supabase link --project-ref <dev-project-ref>
supabase db push        # migrations を Dev に適用

# 本番へは、Devで検証済みの状態を、計画メンテ枠で:
supabase link --project-ref <prod-project-ref>
supabase db push        # ⚠ 事前にS0バックアップ・変更内容レビュー・承認を経てから
```
> 現時点では **Local と Dev の構築まで**が目標。本番へのpushはS4（認証+RLS）以降で、承認フローに乗せて実施する。

---

## 完了条件（Doneの定義）
- [ ] `supabase start` でローカルスタックが起動する
- [ ] `supabase db reset` で 0001 マイグレーション + seed が適用される
- [ ] `.env.local` 経由で Web がローカルSupabaseに接続し、`dev/dev1234` でログインできる
- [ ] Dev用 Supabase プロジェクトを作成し `supabase db push` で 0001 を適用できる
- [ ] 本番には一切 push していない（変更していない）

完了したら **S2（計算ロジックのテスト凍結）** へ。
