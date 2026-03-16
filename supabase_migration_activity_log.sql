-- 完整建表 + 修复现有表结构脚本（含修行动态字段）
-- 在 Supabase SQL Editor 执行这段 SQL

-- 1. players 表（若已存在则跳过）
CREATE TABLE IF NOT EXISTS public.players (
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
CREATE TABLE IF NOT EXISTS public.game_states (
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

-- 若 game_states 已存在，统一补齐所有需要的列
ALTER TABLE public.game_states
  ADD COLUMN IF NOT EXISTS level                    integer,
  ADD COLUMN IF NOT EXISTS exp                      integer,
  ADD COLUMN IF NOT EXISTS incense_coin             integer,
  ADD COLUMN IF NOT EXISTS merit                    integer,
  ADD COLUMN IF NOT EXISTS day                      integer,
  ADD COLUMN IF NOT EXISTS last_login_date          text,
  ADD COLUMN IF NOT EXISTS daily_login_done         boolean,
  ADD COLUMN IF NOT EXISTS daily_task_done          boolean,
  ADD COLUMN IF NOT EXISTS encounter_count          integer,
  ADD COLUMN IF NOT EXISTS current_temple_id        integer,
  ADD COLUMN IF NOT EXISTS temple_items_collected   integer[],
  ADD COLUMN IF NOT EXISTS s_grade_items            text[],
  ADD COLUMN IF NOT EXISTS agent_logs_generated_day text,
  ADD COLUMN IF NOT EXISTS activity_log             jsonb,
  ADD COLUMN IF NOT EXISTS next_log_id              integer,
  ADD COLUMN IF NOT EXISTS updated_at               timestamptz;

-- 统一补默认值，避免旧表/旧行出现 null
ALTER TABLE public.game_states
  ALTER COLUMN level                    SET DEFAULT 0,
  ALTER COLUMN exp                      SET DEFAULT 0,
  ALTER COLUMN incense_coin             SET DEFAULT 0,
  ALTER COLUMN merit                    SET DEFAULT 0,
  ALTER COLUMN day                      SET DEFAULT 0,
  ALTER COLUMN last_login_date          SET DEFAULT '',
  ALTER COLUMN daily_login_done         SET DEFAULT false,
  ALTER COLUMN daily_task_done          SET DEFAULT false,
  ALTER COLUMN encounter_count          SET DEFAULT 0,
  ALTER COLUMN current_temple_id        SET DEFAULT 0,
  ALTER COLUMN temple_items_collected   SET DEFAULT '{}',
  ALTER COLUMN s_grade_items            SET DEFAULT '{}',
  ALTER COLUMN agent_logs_generated_day SET DEFAULT '',
  ALTER COLUMN activity_log             SET DEFAULT '[]'::jsonb,
  ALTER COLUMN next_log_id              SET DEFAULT 1,
  ALTER COLUMN updated_at               SET DEFAULT now();

UPDATE public.game_states
SET
  level = COALESCE(level, 0),
  exp = COALESCE(exp, 0),
  incense_coin = COALESCE(incense_coin, 0),
  merit = COALESCE(merit, 0),
  day = COALESCE(day, 0),
  last_login_date = COALESCE(last_login_date, ''),
  daily_login_done = COALESCE(daily_login_done, false),
  daily_task_done = COALESCE(daily_task_done, false),
  encounter_count = COALESCE(encounter_count, 0),
  current_temple_id = COALESCE(current_temple_id, 0),
  temple_items_collected = COALESCE(temple_items_collected, '{}'),
  s_grade_items = COALESCE(s_grade_items, '{}'),
  agent_logs_generated_day = COALESCE(agent_logs_generated_day, ''),
  activity_log = COALESCE(activity_log, '[]'::jsonb),
  next_log_id = COALESCE(next_log_id, 1),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.game_states
  ALTER COLUMN user_id                  SET NOT NULL,
  ALTER COLUMN level                    SET NOT NULL,
  ALTER COLUMN exp                      SET NOT NULL,
  ALTER COLUMN incense_coin             SET NOT NULL,
  ALTER COLUMN merit                    SET NOT NULL,
  ALTER COLUMN day                      SET NOT NULL,
  ALTER COLUMN last_login_date          SET NOT NULL,
  ALTER COLUMN daily_login_done         SET NOT NULL,
  ALTER COLUMN daily_task_done          SET NOT NULL,
  ALTER COLUMN encounter_count          SET NOT NULL,
  ALTER COLUMN current_temple_id        SET NOT NULL,
  ALTER COLUMN temple_items_collected   SET NOT NULL,
  ALTER COLUMN s_grade_items            SET NOT NULL,
  ALTER COLUMN agent_logs_generated_day SET NOT NULL,
  ALTER COLUMN activity_log             SET NOT NULL,
  ALTER COLUMN next_log_id              SET NOT NULL,
  ALTER COLUMN updated_at               SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.game_states'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.game_states
      ADD CONSTRAINT game_states_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.game_states'::regclass
      AND conname = 'game_states_user_id_fkey'
  ) THEN
    ALTER TABLE public.game_states
      ADD CONSTRAINT game_states_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. activity_logs 表（若已存在则跳过）
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          bigserial   PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT '',
  description text        NOT NULL DEFAULT '',
  coins_delta integer     NOT NULL DEFAULT 0,
  exp_delta   integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 可选但推荐：为前端用户开启只读自己数据的 RLS 策略
ALTER TABLE public.game_states ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_states'
      AND policyname = 'game_states_select_own'
  ) THEN
    CREATE POLICY game_states_select_own
      ON public.game_states
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_states'
      AND policyname = 'game_states_insert_own'
  ) THEN
    CREATE POLICY game_states_insert_own
      ON public.game_states
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_states'
      AND policyname = 'game_states_update_own'
  ) THEN
    CREATE POLICY game_states_update_own
      ON public.game_states
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
