-- ================================================================
-- 删除好友（解除结缘）迁移脚本
-- 在 Supabase SQL Editor 中执行
-- ================================================================

-- unfriend RPC（SECURITY DEFINER，绕过 RLS DELETE 限制）
-- 删除 accepted 的好友关系，让双方可重新发起结缘申请
CREATE OR REPLACE FUNCTION public.unfriend(p_peer uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE
    status = 'accepted'
    AND (
      (requester = auth.uid() AND addressee = p_peer)
      OR
      (requester = p_peer    AND addressee = auth.uid())
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unfriend(uuid) TO authenticated;
