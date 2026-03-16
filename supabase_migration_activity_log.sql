-- 完整建表脚本（含修行动态字段）
-- 在 Supabase SQL Editor 执行这段 SQL

-- 1. players 表（若已存在则跳过）
CREATE TABLE IF NOT EXISTS players (
  id                   uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secondme_identifier  text        NOT NULL DEFAULT '',
  secondme_name        text        NOT NULL DEFAULT '',
  secondme_bio         text        NOT NULL DEFAULT '',
  secondme_avatar      text        NOT NULL DEFAULT '',
  name                 text,
  gender               text,
  birthday             text,
  personality          text,
  training_style       text,
  avatar_url           text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- 2. game_states 表（含修行动态）
CREATE TABLE IF NOT EXISTS game_states (
  user_id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  level                    integer     NOT NULL DEFAULT 0,
  exp                      integer     NOT NULL DEFAULT 0,
  incense_coin             integer     NOT NULL DEFAULT 0,
  merit                    integer     NOT NULL DEFAULT 0,
  day                      integer     NOT NULL DEFAULT 0,
  last_login_date          text        NOT NULL DEFAULT '',
  daily_login_done         boolean     NOT NULL DEFAULT false,
  daily_task_done          boolean     NOT NULL DEFAULT false,
  encounter_count          integer     NOT NULL DEFAULT 0,
  current_temple_id        integer     NOT NULL DEFAULT 0,
  temple_items_collected   integer[]   NOT NULL DEFAULT '{}',
  s_grade_items            text[]      NOT NULL DEFAULT '{}',
  agent_logs_generated_day text        NOT NULL DEFAULT '',
  activity_log             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  next_log_id              integer     NOT NULL DEFAULT 1,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- 若 game_states 已存在但缺少新列，用以下语句补充：
ALTER TABLE game_states
  ADD COLUMN IF NOT EXISTS activity_log  jsonb    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_log_id   integer  NOT NULL DEFAULT 1;

-- 3. activity_logs 表（若已存在则跳过）
CREATE TABLE IF NOT EXISTS activity_logs (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT '',
  description text        NOT NULL DEFAULT '',
  coins_delta integer     NOT NULL DEFAULT 0,
  exp_delta   integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
