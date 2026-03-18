-- ===== Lifolio Supabase スキーマ =====
-- Supabase ダッシュボード > SQL Editor で実行してください

-- 1. アプリ設定テーブル（認証ハッシュ保存用）
create table if not exists app_settings (
  key   text primary key,
  value text not null
);

alter table app_settings enable row level security;
create policy "allow_anon_select" on app_settings for select using (true);

-- 初期パスワード: REMOVED
-- ※ ハッシュ = REMOVED
insert into app_settings (key, value)
values ('auth_hash', 'REMOVED')
on conflict (key) do nothing;


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
