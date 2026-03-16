-- ================================================================
-- 好友系统 + 私聊消息 迁移脚本
-- 在 Supabase SQL Editor 中执行
-- ================================================================

-- 1. friendships 表 ——————————————————————————————————

CREATE TABLE IF NOT EXISTS public.friendships (
  id          bigserial   PRIMARY KEY,
  requester   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending',   -- pending / accepted / rejected
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_no_self CHECK (requester <> addressee),
  CONSTRAINT friendships_unique UNIQUE (requester, addressee)
);

-- 索引：按 addressee 快速查 pending 请求
CREATE INDEX IF NOT EXISTS idx_friendships_addressee
  ON public.friendships (addressee, status);

-- RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- 查看：只能看到与自己相关的记录
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships_select_own') THEN
    CREATE POLICY friendships_select_own ON public.friendships
      FOR SELECT TO authenticated
      USING (auth.uid() = requester OR auth.uid() = addressee);
  END IF;
END $$;

-- 插入：只允许自己作为 requester
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships_insert_own') THEN
    CREATE POLICY friendships_insert_own ON public.friendships
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = requester);
  END IF;
END $$;

-- 更新：只有 addressee 能接受 / 拒绝
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships_update_addressee') THEN
    CREATE POLICY friendships_update_addressee ON public.friendships
      FOR UPDATE TO authenticated
      USING (auth.uid() = addressee);
  END IF;
END $$;


-- 2. direct_messages 表 ——————————————————————————————

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id          bigserial   PRIMARY KEY,
  sender_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 索引：按对话对加速查询
CREATE INDEX IF NOT EXISTS idx_dm_conversation
  ON public.direct_messages (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

-- RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- 查看：只能看到自己收发的消息
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='direct_messages' AND policyname='dm_select_own') THEN
    CREATE POLICY dm_select_own ON public.direct_messages
      FOR SELECT TO authenticated
      USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
  END IF;
END $$;

-- 插入：只允许自己作为 sender
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='direct_messages' AND policyname='dm_insert_own') THEN
    CREATE POLICY dm_insert_own ON public.direct_messages
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;


-- 3. Realtime 发布配置 ——————————————————————————————
-- 让前端通过 Supabase Realtime 监听 direct_messages 的 INSERT
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
