-- ============================================================================
-- seed.sql ── ローカル開発専用のダミーデータ（本番とは無関係）
-- `supabase db reset` 実行時に自動投入される。
-- ⚠ ここに本番の実データを絶対に書かないこと。
-- ============================================================================

-- アプリは sha256("username:password") の16進小文字を app_settings.auth_hash と照合する。
-- Postgres の pgcrypto で同じ値を生成する（ローカルログイン: dev / dev1234）。
create extension if not exists pgcrypto;

insert into app_settings (key, value) values
  ('auth_hash', encode(digest('dev:dev1234', 'sha256'), 'hex'))
on conflict (key) do update set value = excluded.value;

-- 共有口座の設定（控除・目標残高）。アプリの user_settings jsonb 形状に一致させる。
insert into account_settings (key, value) values
  ('user_settings', '{
    "targetBalance": 100000,
    "shota": { "rentCheck": true, "rent": 20000, "transCheck": false, "trans": 0, "otherCheck": false, "others": [] },
    "miyu":  { "rentCheck": false, "rent": 0, "transCheck": true, "trans": 8000, "otherCheck": false, "others": [] }
  }'::jsonb)
on conflict (key) do update set value = excluded.value;

-- サンプルレシピ（献立UIの動作確認用）
insert into meal_recipes (name, genre, type, difficulty, duration_min, ingredients, steps, is_favorite) values
  ('鶏の唐揚げ', '和食', '主菜', 2, 30, '鶏もも肉, 醤油, 酒, にんにく, 片栗粉', '1. 下味をつける\n2. 片栗粉をまぶす\n3. 揚げる', true),
  ('ほうれん草のごま和え', '和食', '副菜', 1, 10, 'ほうれん草, すりごま, 醤油, 砂糖', '1. 茹でる\n2. 和える', false),
  ('豚汁', '和食', 'スープ・汁物', 1, 20, '豚バラ, 大根, 人参, ごぼう, 味噌', '1. 具を炒める\n2. 煮る\n3. 味噌を溶く', false)
on conflict do nothing;

-- サンプルの好み
insert into meal_preferences (person, type, category, name) values
  ('shota', 'love', '肉類', '鶏肉'),
  ('miyu', 'dislike', '魚介類', 'パクチー')
on conflict do nothing;
