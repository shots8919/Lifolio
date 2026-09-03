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

## セットアップ手順（WSL2 / Ubuntu 22.04）

### 1. Supabase CLI ── ✅ 実施済み（2026-09-03 / v2.116.0）
`npm i -g supabase` は現在サポート外。公式リリースの tarball を**ユーザー領域**へ展開する（sudo不要）。

```bash
ver=$(curl -s https://api.github.com/repos/supabase/cli/releases/latest \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['tag_name'])")
curl -sL -o /tmp/supabase.tar.gz \
  "https://github.com/supabase/cli/releases/download/${ver}/supabase_linux_amd64.tar.gz"
mkdir -p ~/.local/bin && tar xzf /tmp/supabase.tar.gz -C ~/.local/bin supabase
supabase --version
```
> `~/.profile` が `~/.local/bin` を PATH に追加する（**次回ログインから**有効）。
> 同じセッションで使うなら `export PATH="$HOME/.local/bin:$PATH"`。

### 2. Docker ── ⏳ 未実施（`supabase start` に必須）
この環境は **WSL2 / Ubuntu 22.04、sudoはパスワード必要、Docker Desktop 未導入**。
採用方針は **Docker Desktop for Windows + WSL統合**（WSL内でのsudo作業が不要になるため）。

1. Windows側で Docker Desktop を導入 → https://docs.docker.com/desktop/setup/install/windows-install/
2. Docker Desktop → **Settings → Resources → WSL integration** → 使用中のディストリを ON
3. WSLのターミナルを開き直して確認: `docker --version` と `docker ps`

> ⚠ `supabase functions deploy` は **Docker不要**（`--use-api` を付ける）。
> Dockerが必要なのは `supabase start` / `supabase db reset` などローカルスタック系のみ。

### 3. プロジェクト初期化 ── ✅ 実施済み（2026-09-03 / commit `9e01784`）
```bash
# リポジトリ直下で
supabase init      # supabase/config.toml を生成（既存の migrations/seed はそのまま使われる）
```
- 生成物: `supabase/config.toml`（`project_id="Lifolio"` / `db.major_version=17` ＝ 本番 PostgreSQL 17.6 と一致）、`supabase/.gitignore`
- 既存の `migrations/` `seed.sql` `functions/` は無変更であることを確認済み。

### 4. ローカルスタック起動
```bash
supabase start     # 初回はイメージDL。完了後 URL/anon key/service_role key を表示
supabase status    # 値を後から確認
```
表示された **API URL** と **anon key** を `.env.local` に記入:
```bash
cp .env.example .env.local
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を supabase status の値に更新
```

### 5. スキーマ+seed をローカルDBへ適用
```bash
supabase db reset  # migrations/0001 を流し、seed.sql を投入（Localのみ・破壊的）
```

### 6. Web を起動して疎通確認
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
- [x] Supabase CLI を導入した（v2.116.0 / `~/.local/bin`）
- [x] `supabase init` で `config.toml` を生成しコミットした
- [ ] Docker Desktop を導入し WSL統合を有効化した（`docker ps` が通る）
- [ ] `supabase start` でローカルスタックが起動する
- [ ] `supabase db reset` で 0001 マイグレーション + seed が適用される
- [ ] `.env.local` 経由で Web がローカルSupabaseに接続し、`dev/dev1234` でログインできる
- [ ] Dev用 Supabase プロジェクトを作成し `supabase db push` で 0001 を適用できる
- [ ] 本番には一切 push していない（変更していない）

完了したら **S2（計算ロジックのテスト凍結）** へ。
