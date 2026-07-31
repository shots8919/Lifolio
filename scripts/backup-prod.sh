#!/usr/bin/env bash
#
# backup-prod.sh ── Lifolio 本番Supabaseの論理バックアップ（読み取りのみ）
#
# 本番DBを一切変更しない。SELECT/ダンプのみを行う。
# 接続文字列は環境変数 SUPABASE_DB_URL、または gitignore 済みファイル .backup-db-url で渡す。
#
#   方法A（ファイル・推奨）: .backup-db-url に Session Pooler URI を1行入れておく → そのまま実行
#   方法B（環境変数）:        export SUPABASE_DB_URL='postgresql://...'; bash scripts/backup-prod.sh
#
# 生成物: ./backups/<UTC timestamp>/ に schema.sql / data.sql / full.dump / MANIFEST.txt
#
set -euo pipefail

# ─── 接続文字列の取得（環境変数 > .backup-db-url ファイル） ───────────
if [[ -z "${SUPABASE_DB_URL:-}" && -f ".backup-db-url" ]]; then
  SUPABASE_DB_URL="$(tr -d '\r\n' < .backup-db-url)"
fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: 接続文字列がありません。.backup-db-url を作るか SUPABASE_DB_URL を設定してください。" >&2
  echo "  Supabase Dashboard → Connect → Session pooler の URI を使ってください（IPv4対応・ポート5432）。" >&2
  exit 1
fi

# ─── pg_dump / psql の解決（インストール済みの最新バージョンを優先） ──
pick_newest() {  # $1=バイナリ名 → 最新versionのフルパスを stdout
  local bin="$1" p
  p="$(ls -1 /usr/lib/postgresql/*/bin/"$bin" 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$p" ]]; then echo "$p"; elif command -v "$bin" >/dev/null 2>&1; then command -v "$bin"; fi
}
PG_DUMP="$(pick_newest pg_dump)"
PSQL="$(pick_newest psql)"

if [[ -z "${PG_DUMP:-}" ]]; then
  echo "ERROR: pg_dump が見つかりません。postgresql-client-17 をインストールしてください。" >&2
  exit 1
fi

DUMP_VER="$("$PG_DUMP" --version | awk '{print $NF}')"
echo "  使用 pg_dump: $PG_DUMP ($DUMP_VER)"

# ─── 出力先 ───────────────────────────────────────────────────
TS="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT_DIR="backups/${TS}"
mkdir -p "${OUT_DIR}"

echo "▶ Lifolio 本番バックアップ（読み取りのみ）"
echo "  出力先: ${OUT_DIR}"
# パスワードは絶対に表示しない（'@' 以降のホスト部分のみ表示）
echo "  接続先: …@${SUPABASE_DB_URL##*@}"

# ─── スキーマ（DDL） ─────────────────────────────────────────
echo "① スキーマをダンプ中..."
"$PG_DUMP" "${SUPABASE_DB_URL}" \
  --schema-only --no-owner --no-privileges \
  --schema=public \
  -f "${OUT_DIR}/schema.sql"

# ─── データ（INSERT） ────────────────────────────────────────
echo "② データをダンプ中..."
"$PG_DUMP" "${SUPABASE_DB_URL}" \
  --data-only --no-owner --no-privileges \
  --schema=public --column-inserts \
  -f "${OUT_DIR}/data.sql"

# ─── フル（カスタム形式・復元推奨） ──────────────────────────
echo "③ フルダンプ（カスタム形式）を作成中..."
"$PG_DUMP" "${SUPABASE_DB_URL}" \
  --format=custom --no-owner --no-privileges \
  --schema=public \
  -f "${OUT_DIR}/full.dump"

# ─── 行数サマリ（読み取りのみ） ──────────────────────────────
echo "④ 主要テーブルの件数を記録中..."
ROW_COUNTS="(psql未導入のため件数省略)"
if [[ -n "${PSQL:-}" ]]; then
  ROW_COUNTS="$("$PSQL" "${SUPABASE_DB_URL}" -At -c "
    select table_name || '=' || (xpath('/row/c/text()',
      query_to_xml(format('select count(*) c from public.%I', table_name), false, true, '')))[1]::text
    from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE'
    order by table_name;" 2>/dev/null || echo '(件数取得に失敗)')"
fi

# ─── マニフェスト（ホスト部分のみ・パスワードは残さない） ─────
{
  echo "Lifolio backup manifest"
  echo "timestamp_utc: ${TS}"
  echo "host: ${SUPABASE_DB_URL##*@}"
  echo "tool: pg_dump ${DUMP_VER}"
  echo "files: schema.sql, data.sql, full.dump"
  echo "--- row counts (public) ---"
  echo "${ROW_COUNTS}"
} > "${OUT_DIR}/MANIFEST.txt"

echo "✅ 完了: ${OUT_DIR}"
echo "   復元検証を忘れずに（S0 Runbook §3）。full.dump は 'pg_restore' で復元できます。"
echo "${ROW_COUNTS}"
