-- ================================================================
-- send_friend_request RPC 迁移脚本（带互检：双方互发自动成为道友）
-- 在 Supabase SQL Editor 中执行
-- ================================================================
--
-- 处理逻辑：
--   1. 向自己发起 → 拒绝
--   2. 已是好友（任意方向 accepted）→ 拒绝
--   3. 自己已有 pending 申请 → 拒绝
--   4. 【互检】对方已向我发过 pending → 升级为 accepted，返回 "自动结为道友"
--   5. 之前被拒绝过（rejected）→ 重新激活为 pending（避免违反 UNIQUE 约束）
--   6. 正常情况 → INSERT 新 pending 申请
-- ================================================================

-- 先删除旧函数（返回类型不兼容时必须 DROP 后重建）
DROP FUNCTION IF EXISTS public.send_friend_request(uuid);

CREATE OR REPLACE FUNCTION public.send_friend_request(p_addressee uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me       uuid := auth.uid();
  v_existing record;
  v_mutual   record;
BEGIN
  -- 1. 不能向自己发起结缘
  IF v_me = p_addressee THEN
    RETURN json_build_object('ok', false, 'msg', '不能向自己发起结缘');
  END IF;

  -- 2. 检查是否已是好友（任意方向）
  SELECT id INTO v_existing
  FROM public.friendships
  WHERE status = 'accepted'
    AND (
      (requester = v_me AND addressee = p_addressee)
      OR
      (requester = p_addressee AND addressee = v_me)
    )
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object('ok', false, 'msg', '已是道友，无需重复结缘');
  END IF;

  -- 3. 检查自己是否已发过 pending 申请
  SELECT id INTO v_existing
  FROM public.friendships
  WHERE requester = v_me AND addressee = p_addressee AND status = 'pending';

  IF FOUND THEN
    RETURN json_build_object('ok', false, 'msg', '已发起过结缘申请，等待对方回应');
  END IF;

  -- 4. 互检：对方是否已向我发过 pending 申请
  --    若是，直接将对方申请升级为 accepted，双方自动成为道友
  SELECT id INTO v_mutual
  FROM public.friendships
  WHERE requester = p_addressee AND addressee = v_me AND status = 'pending';

  IF FOUND THEN
    UPDATE public.friendships
    SET status = 'accepted', updated_at = now()
    WHERE id = v_mutual.id;

    RETURN json_build_object('ok', true, 'msg', '自动结为道友');
  END IF;

  -- 5. 之前有被拒绝的记录 → 重新激活（不能直接 INSERT，UNIQUE 约束会冲突）
  SELECT id INTO v_existing
  FROM public.friendships
  WHERE requester = v_me AND addressee = p_addressee AND status = 'rejected';

  IF FOUND THEN
    UPDATE public.friendships
    SET status = 'pending', updated_at = now()
    WHERE id = v_existing.id;

    RETURN json_build_object('ok', true, 'msg', '已重新发起结缘申请，等待对方回应');
  END IF;

  -- 6. 正常情况：插入新的 pending 申请
  INSERT INTO public.friendships (requester, addressee, status)
  VALUES (v_me, p_addressee, 'pending');

  RETURN json_build_object('ok', true, 'msg', '结缘申请已发出，等待对方回应');

EXCEPTION
  WHEN unique_violation THEN
    -- 兜底：并发竞争导致 UNIQUE 冲突，申请已存在
    RETURN json_build_object('ok', false, 'msg', '结缘申请已存在，请勿重复发送');
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid) TO authenticated;
