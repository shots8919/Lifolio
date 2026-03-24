-- ===== Lifolio Supabase スキーマ =====
-- Supabase ダッシュボード > SQL Editor で実行してください

-- 1. アプリ設定テーブル（認証ハッシュ保存用）
create table if not exists app_settings (
  key   text primary key,
  value text not null
);

alter table app_settings enable row level security;
create policy "allow_anon_select" on app_settings for select using (true);
create policy "allow_anon_insert" on app_settings for insert with check (true);
create policy "allow_anon_update" on app_settings for update using (true) with check (true);

-- ※ 初期データは手動でSupabaseのSQL Editorから登録してください:
-- insert into app_settings (key, value)
-- values ('auth_hash', sha256('ユーザー名:パスワード')の結果)
-- on conflict (key) do nothing;


-- 2. 共有口座ユーザー設定テーブル（控除設定・目標残高）
create table if not exists account_settings (
  key   text primary key,
  value jsonb not null
);

alter table account_settings enable row level security;
create policy "allow_anon_all_account_settings" on account_settings
  using (true) with check (true);


-- 3. 共有口座履歴テーブル
create table if not exists account_records (
  id                 uuid        primary key default gen_random_uuid(),
  created_at         timestamptz default now(),
  month              text        not null unique,
  target_balance     integer     not null,
  current_balance    integer     not null,
  salary_shota       integer     not null,
  salary_miyu        integer     not null,
  shota_deduct       integer     not null default 0,
  miyu_deduct        integer     not null default 0,
  shota_deduct_items jsonb       not null default '[]',
  miyu_deduct_items  jsonb       not null default '[]',
  net_shota          integer     not null,
  net_miyu           integer     not null,
  ratio_shota        numeric(6,4) not null,
  ratio_miyu         numeric(6,4) not null,
  trans_shota        integer     not null,
  trans_miyu         integer     not null,
  confirmed_at       timestamptz default now()
);

alter table account_records enable row level security;
create policy "allow_anon_all_account_records" on account_records
  using (true) with check (true);


-- ===== 献立管理 =====

-- 4. 好み管理テーブル（ShotaとMiyuそれぞれの大好物・苦手食材）
create table if not exists meal_preferences (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  person     text        not null check (person in ('shota', 'miyu')),
  type       text        not null check (type in ('love', 'dislike')),
  category   text        not null,
  name       text        not null
);

alter table meal_preferences enable row level security;
create policy "allow_anon_all_meal_preferences" on meal_preferences
  using (true) with check (true);


-- 5. レシピテーブル
create table if not exists meal_recipes (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  name         text        not null,
  genre        text        not null, -- 和食/洋食/中華/アジア/その他
  type         text        not null, -- 主菜/副菜/スープ・汁物/ご飯もの/その他
  difficulty   integer     not null default 1 check (difficulty in (1, 2, 3)),
  duration_min integer,
  ingredients  text        not null default '',
  steps        text        not null default '',
  memo         text        not null default '',
  source_url   text,
  is_favorite  boolean     not null default false
);

alter table meal_recipes enable row level security;
create policy "allow_anon_all_meal_recipes" on meal_recipes
  using (true) with check (true);


-- 6. 献立計画テーブル（日付×食事種別でユニーク）
create table if not exists meal_plans (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  date        date        not null,
  meal_type   text        not null check (meal_type in ('lunch', 'dinner')),
  recipe_id   uuid        references meal_recipes(id) on delete set null,
  free_text   text,
  ai_proposal boolean     not null default false,
  unique (date, meal_type)
);

alter table meal_plans enable row level security;
create policy "allow_anon_all_meal_plans" on meal_plans
  using (true) with check (true);


-- 7. AI提案保存テーブル（最新1件を保持）
create table if not exists ai_proposals (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  summary       text        not null default '',
  meals         jsonb       not null default '[]',
  shopping_list jsonb       not null default '[]'
);

alter table ai_proposals enable row level security;
create policy "allow_anon_all_ai_proposals" on ai_proposals
  using (true) with check (true);
