-- ================================================================
-- 获取指定玩家公开摘要（等级 + 功德）
-- 在 Supabase SQL Editor 中执行
-- ================================================================

-- 查询任意玩家的公开档案（含等级、功德）
-- SECURITY DEFINER 绕过 game_states 的 RLS
CREATE OR REPLACE FUNCTION public.get_peer_profile(p_peer uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'name',           COALESCE(pl.name, pl.secondme_name, '小僧'),
    'avatar_url',     COALESCE(pl.avatar_url, pl.secondme_avatar, ''),
    'gender',         COALESCE(pl.gender, ''),
    'personality',    COALESCE(pl.personality, ''),
    'training_style', COALESCE(pl.training_style, ''),
    'birthday',       COALESCE(pl.birthday, ''),
    'level',          COALESCE(gs.level, 0),
    'merit',          COALESCE(gs.merit, 0)
  )
  INTO result
  FROM public.players pl
  LEFT JOIN public.game_states gs ON gs.user_id = pl.id
  WHERE pl.id = p_peer;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_peer_profile(uuid) TO authenticated;
