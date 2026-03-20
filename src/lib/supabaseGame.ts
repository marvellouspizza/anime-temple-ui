/**
 * supabaseGame.ts
 *
 * Supabase 游戏数据 CRUD 层。
 * 不从 useGameState 导入类型（防止循环依赖），使用内联接口。
 */
import { supabase } from "./supabase";

// ── 内联类型（与 useGameState 中的类型保持同步） ─────────────

interface GameStateLike {
  level: number;
  exp: number;
  incenseCoin: number;
  merit: number;
  day: number;
  lastLoginDate: string;
  dailyLoginDone: boolean;
  dailyTaskDone: boolean;
  encounterCount: number;
  currentTempleId: number;
  templeItemsCollected: number[];
  sGradeItems: string[];
  agentLogsGeneratedDay: string;
  activityLog: object[];
  nextLogId: number;
}

// ── 模块级 access token 缓存（用于 beforeunload keepalive 保存）─
let _cachedToken: string | null = null;
export function updateCachedToken(token: string | null) {
  _cachedToken = token;
}

/**
 * 在页面卸载前（beforeunload）调用，使用 keepalive fetch 强制写入。
 * 普通的 async upsertGameState 在组件卸载时会被中断，此函数可靠完成请求。
 */
export function flushStateBeforeUnload(userId: string, state: GameStateLike): void {
  const supabaseUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL;
  const supabaseKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey || !_cachedToken) return;

  const body = JSON.stringify({
    user_id: userId,
    level: state.level,
    exp: state.exp,
    incense_coin: state.incenseCoin,
    merit: state.merit,
    day: state.day,
    last_login_date: state.lastLoginDate,
    daily_login_done: state.dailyLoginDone,
    daily_task_done: state.dailyTaskDone,
    encounter_count: state.encounterCount,
    current_temple_id: state.currentTempleId,
    temple_items_collected: state.templeItemsCollected,
    s_grade_items: state.sGradeItems,
    agent_logs_generated_day: state.agentLogsGeneratedDay,
    activity_log: state.activityLog,
    next_log_id: state.nextLogId,
    updated_at: new Date().toISOString(),
  });

  fetch(`${supabaseUrl}/rest/v1/game_states`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": supabaseKey,
      "Authorization": `Bearer ${_cachedToken}`,
      "Prefer": "resolution=merge-duplicates,return=minimal",
    },
    body,
    keepalive: true,
  }).catch(() => {/* 页面卸载时静默忽略错误 */});
}

export interface PlayerProfileLike {
  name: string;
  gender: string;
  birthday: string;
  personality: string;
  trainingStyle: string;
  avatarUrl: string;
}

export interface CloudGameState {
  level: number;
  exp: number;
  incense_coin: number;
  merit: number;
  day: number;
  last_login_date: string;
  daily_login_done: boolean;
  daily_task_done: boolean;
  encounter_count: number;
  current_temple_id: number;
  temple_items_collected: number[];
  s_grade_items: string[];
  agent_logs_generated_day: string;
  activity_log: object[];
  next_log_id: number;
}

// ── Players 表 ────────────────────────────────────────────────

/**
 * 创建或更新玩家的 Second Me 关联信息（登录时调用）
 */
export async function upsertPlayerSecondMe(
  userId: string,
  playerUUID: string,
  smName: string,
  smBio: string,
  smAvatar: string
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("players").upsert(
    {
      id: userId,
      secondme_identifier: playerUUID,
      secondme_name: smName,
      secondme_bio: smBio,
      secondme_avatar: smAvatar,
    },
    { onConflict: "id" }
  );
  if (error) console.error("[Supabase] players upsert error:", error.message);
}

/**
 * 保存玩家角色档案（完成注册卡后调用）
 * 使用 .update() 而非 .upsert()，避免在 players 行不存在时
 * 因缺少 secondme_identifier 而违反 NOT NULL 约束
 */
export async function savePlayerProfile(
  userId: string,
  profile: PlayerProfileLike
): Promise<void> {
  if (!supabase) return;
  const { error, count } = await supabase
    .from("players")
    .update({
      name: profile.name,
      gender: profile.gender,
      birthday: profile.birthday,
      personality: profile.personality,
      training_style: profile.trainingStyle,
      avatar_url: profile.avatarUrl,
    })
    .eq("id", userId);
  if (error) {
    console.error("[Supabase] players profile update error:", error.message);
  } else {
    console.log("[Supabase] savePlayerProfile 成功, count =", count);
  }
}

/**
 * 读取玩家角色档案（登录后检查是否需要显示注册卡）
 */
export async function fetchPlayerProfile(
  userId: string
): Promise<PlayerProfileLike | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("players")
    .select("name, gender, birthday, personality, training_style, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] fetchPlayerProfile error:", error.message);
    return null;
  }
  if (!data || !data.name) return null;

  return {
    name: data.name,
    gender: data.gender ?? "女",
    birthday: data.birthday ?? "",
    personality: data.personality ?? "沉稳",
    trainingStyle: data.training_style ?? "打坐派",
    avatarUrl: data.avatar_url ?? "",
  };
}

// ── Game States 表 ─────────────────────────────────────────────

/**
 * 保存（upsert）游戏核心状态到 Supabase
 */
export async function upsertGameState(
  userId: string,
  state: GameStateLike
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("game_states").upsert(
    {
      user_id: userId,
      level: state.level,
      exp: state.exp,
      incense_coin: state.incenseCoin,
      merit: state.merit,
      day: state.day,
      last_login_date: state.lastLoginDate,
      daily_login_done: state.dailyLoginDone,
      daily_task_done: state.dailyTaskDone,
      encounter_count: state.encounterCount,
      current_temple_id: state.currentTempleId,
      temple_items_collected: state.templeItemsCollected,
      s_grade_items: state.sGradeItems,
      agent_logs_generated_day: state.agentLogsGeneratedDay,
      activity_log: state.activityLog,
      next_log_id: state.nextLogId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    const errorInfo = {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    };
    console.error("[Supabase] game_states upsert error:", JSON.stringify(errorInfo));
    throw new Error(JSON.stringify(errorInfo));
  }
}

/**
 * 从 Supabase 读取游戏状态
 */
export async function fetchGameState(
  userId: string
): Promise<CloudGameState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("game_states")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[Supabase] fetchGameState error:", JSON.stringify({
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    }));
    return null;
  }
  return data as CloudGameState | null;
}

// ── Activity Logs 表 ─────────────────────────────────────────

/**
 * 向 Supabase 插入一条行为日志
 */
export async function insertActivityLog(
  userId: string,
  type: string,
  description: string,
  coinsDelta: number,
  expDelta: number
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("activity_logs").insert({
    user_id: userId,
    type,
    description,
    coins_delta: coinsDelta,
    exp_delta: expDelta,
  });
  if (error)
    console.error("[Supabase] activity_logs insert error:", error.message);
}

// ── 好友系统 ──────────────────────────────────────────────────

export type FriendshipStatus = "pending" | "accepted" | "rejected";

export interface FriendshipRow {
  id: number;
  requester: string;
  addressee: string;
  status: FriendshipStatus;
  created_at: string;
  /** 对方的玩家信息（join 查询填充） */
  peer_name?: string;
  peer_avatar?: string;
}

/** 发送好友申请 */
export async function sendFriendRequest(
  myId: string,
  peerId: string
): Promise<{ ok: boolean; msg: string }> {
  if (!supabase) return { ok: false, msg: "云同步未启用" };

  // 先查是否已有记录
  const { data: exist } = await supabase
    .from("friendships")
    .select("id, status, requester")
    .or(`and(requester.eq.${myId},addressee.eq.${peerId}),and(requester.eq.${peerId},addressee.eq.${myId})`)
    .maybeSingle();

  if (exist) {
    if (exist.status === "accepted") return { ok: false, msg: "你们已是道友" };
    if (exist.status === "pending" && exist.requester === myId) return { ok: false, msg: "已发送过申请，请等待对方回应" };
    if (exist.status === "pending" && exist.requester === peerId) {
      // 对方先申请了我 → 直接互相成为好友
      await supabase.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", exist.id);
      return { ok: true, msg: "对方也向你发出了申请，已自动结为道友！" };
    }
    // rejected → 允许重新发起
    if (exist.status === "rejected") {
      await supabase.from("friendships").update({ status: "pending", requester: myId, addressee: peerId, updated_at: new Date().toISOString() }).eq("id", exist.id);
      return { ok: true, msg: "已重新发出结缘申请" };
    }
  }

  const { error } = await supabase.from("friendships").insert({ requester: myId, addressee: peerId });
  if (error) return { ok: false, msg: error.message };
  return { ok: true, msg: "结缘申请已送出，等待对方回应" };
}

/** 接受好友申请 */
export async function acceptFriendRequest(friendshipId: number): Promise<void> {
  if (!supabase) return;
  await supabase.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", friendshipId);
}

/** 拒绝好友申请 */
export async function rejectFriendRequest(friendshipId: number): Promise<void> {
  if (!supabase) return;
  await supabase.from("friendships").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", friendshipId);
}

/** 获取我的好友列表（已接受） */
export async function fetchFriends(myId: string): Promise<FriendshipRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester, addressee, status, created_at")
    .or(`requester.eq.${myId},addressee.eq.${myId}`)
    .eq("status", "accepted");
  if (error || !data) return [];
  return data as FriendshipRow[];
}

/** 获取待处理的好友申请（我是 addressee） */
export async function fetchPendingRequests(myId: string): Promise<FriendshipRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester, addressee, status, created_at")
    .eq("addressee", myId)
    .eq("status", "pending");
  if (error || !data) return [];
  return data as FriendshipRow[];
}

/** 获取我发出的待处理结缘申请（我是 requester） */
export async function fetchSentRequests(myId: string): Promise<FriendshipRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester, addressee, status, created_at")
    .eq("requester", myId)
    .eq("status", "pending");
  if (error || !data) return [];
  return data as FriendshipRow[];
}

/** 查询两人之间的好友状态 */
export async function getFriendshipBetween(
  myId: string,
  peerId: string
): Promise<FriendshipRow | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("friendships")
    .select("id, requester, addressee, status, created_at")
    .or(`and(requester.eq.${myId},addressee.eq.${peerId}),and(requester.eq.${peerId},addressee.eq.${myId})`)
    .maybeSingle();
  return (data as FriendshipRow) ?? null;
}

/** 根据 user ids 批量获取玩家名字和头像 */
export async function fetchPlayersByIds(
  ids: string[]
): Promise<Record<string, { name: string; avatar: string }>> {
  if (!supabase || ids.length === 0) return {};
  const { data } = await supabase
    .from("players")
    .select("id, name, avatar_url, secondme_name, secondme_avatar")
    .in("id", ids);
  if (!data) return {};
  const map: Record<string, { name: string; avatar: string }> = {};
  for (const p of data) {
    map[p.id] = {
      name: p.name || p.secondme_name || "小僧",
      avatar: p.avatar_url || p.secondme_avatar || "",
    };
  }
  return map;
}

// ── 私聊消息 ──────────────────────────────────────────────────

export interface DirectMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

/** 发送私聊消息 */
export async function sendDirectMessage(
  senderId: string,
  receiverId: string,
  content: string
): Promise<DirectMessage | null> {
  if (!supabase) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, content: trimmed })
    .select()
    .single();
  if (error) { console.error("[DM] send error:", error.message); return null; }
  return data as DirectMessage;
}

/** 加载与某人的历史消息（最近 50 条） */
export async function fetchDirectMessages(
  myId: string,
  peerId: string,
  limit = 50
): Promise<DirectMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("direct_messages")
    .select("*")
    .or(`and(sender_id.eq.${myId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${myId})`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as DirectMessage[];
}
