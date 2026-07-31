# S0 Runbook ── 本番Supabaseのバックアップ（最優先・本番非変更）

> 目的: 実データを保護する安全網を先に確立する。**本ステップは本番DBを一切変更しない（読み取りのみ）**。
> 前提: あなたは本番Supabaseプロジェクトの管理者権限を持つ（Phase4回答）。
> 対象コミット時点のスキーマは `supabase/schema.sql` を参照。

---

## なぜ最初にやるのか
現状、全テーブルのRLSが全許可であり、anon keyは配布JSに露出している（`docs/redesign/04-risks-and-architecture.md` R1/R2）。
以降のどの作業に進むにも、まず「いつでも元に戻せる」状態＝検証済みバックアップが必要。

---

## 0. 事前確認（Supabaseダッシュボード）
1. **プロジェクトのPITR/自動バックアップ状態**を確認
   - `Project Settings → Database → Backups`
   - Pro以上ならPITR（Point-in-Time Recovery）が使えるか確認。無料枠は日次論理バックアップのみのことが多い。
2. **接続文字列**を取得
   - `Project Settings → Database → Connection string → URI`（`postgresql://postgres:[PASSWORD]@db.<ref>.supabase.co:5432/postgres`）
   - ⚠ このURIは**秘密**。リポジトリにコミットしない。環境変数で渡す。

---

## 1. ツール準備（ローカル / Ubuntu 22.04）
```bash
# Supabase CLI（推奨のダンプ手段）
# https://supabase.com/docs/guides/cli
# 例: スタンドアロンバイナリ or npm
npm i -g supabase   # もしくは公式のインストール手順

# PostgreSQLクライアント（pg_dump / psql）
sudo apt-get update && sudo apt-get install -y postgresql-client
```

---

## 2. バックアップ実行
リポジトリ同梱の `scripts/backup-prod.sh` を使う。接続文字列は環境変数で渡す（履歴に残さないため先頭にスペース）。

```bash
# 先頭スペースでシェル履歴に残さない（HISTCONTROL=ignorespace 環境の場合）
 export SUPABASE_DB_URL='postgresql://postgres:****@db.xxxx.supabase.co:5432/postgres'

# 実行（読み取りのみ。出力は ./backups/<timestamp>/ に保存）
bash scripts/backup-prod.sh
```

生成物（例）:
```
backups/2026-06-25T101500Z/
├─ roles.sql        # ロール定義（存在すれば）
├─ schema.sql       # スキーマ（DDL）
├─ data.sql         # データ（INSERT）
├─ full.dump        # pg_dump カスタム形式（復元が速い・推奨）
└─ MANIFEST.txt     # 取得日時・対象・行数サマリ
```

> `backups/` は `.gitignore` 済み（機密データを誤コミットしない）。

### ⚠ トラブルシュート: `Network is unreachable` / IPv6 で繋がらない
Supabaseの**直接接続** `db.<ref>.supabase.co:5432` は **IPv6専用**。WSL2や多くの家庭ネットワークはIPv6が通らず失敗する。
→ **Session Pooler（IPv4対応・ポート5432）** を使う（`pg_dump`はセッションモード必須。トランザクション用の6543は不可）。

- 取得: ダッシュボード上部 **Connect** → **Session pooler**（または Settings → Database → Connection string → Session pooler）。
- 形が変わる: ホスト `aws-0-<region>.pooler.supabase.com`、ユーザー `postgres.<project-ref>`、ポート `5432`。

```bash
 export SUPABASE_DB_URL='postgresql://postgres.<ref>:[PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres'
bash scripts/backup-prod.sh
```

> 接続文字列は**ダッシュボードからそのままコピー**する（region等の組み立てミスを避ける）。
> パスワードをどこか（チャット等）に露出したら、バックアップ後に **DBパスワードをリセット**すること。

---

## 3. バックアップの検証（重要 ── 取っただけで安心しない）
「復元できて初めてバックアップ」。**別環境**へ復元して行数を突き合わせる。

```bash
# ローカルSupabase（S1で構築）or 使い捨てPostgresへ復元
# 例: ローカルの空DBへ
psql "$LOCAL_DB_URL" -f backups/<ts>/schema.sql
psql "$LOCAL_DB_URL" -f backups/<ts>/data.sql

# 主要テーブルの件数を本番と比較（本番は読み取りのみ）
psql "$SUPABASE_DB_URL" -c "select 'account_records' t, count(*) from account_records
  union all select 'meal_plans', count(*) from meal_plans
  union all select 'meal_recipes', count(*) from meal_recipes;"
```
本番と復元先で件数が一致すればOK。

---

## 4. 保管
- 復元検証が済んだダンプを**オフライン/別ストレージ**にも1部退避（3-2-1原則の一歩）。
- `account_records`（確定済み家計データ）は特に重要。最低このテーブルは無傷を確認。

---

## 完了条件（Doneの定義）
- [ ] 本番のPITR/自動バックアップ状況を把握した
- [ ] `scripts/backup-prod.sh` で schema/data/full.dump を取得した
- [ ] 別環境へ復元し、`account_records` 等の件数一致を確認した
- [ ] ダンプを安全な場所に保管した

ここまで完了したら **S1（環境分離 / Docker）** へ進む。
