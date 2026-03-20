/**
 * useFriendChat — 好友系统 + 实时私聊
 *
 * 功能：
 *  - 好友申请 / 接受 / 拒绝
 *  - 好友列表 & 待处理请求 & 我发出的结缘申请
 *  - 1v1 实时聊天（Supabase Realtime 监听 direct_messages INSERT）
 *  - 定时轮询好友状态变化（30s 间隔）
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchFriends,
  fetchPendingRequests,
  fetchSentRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendshipBetween,
  fetchDirectMessages,
  sendDirectMessage,
  fetchPlayersByIds,
  type FriendshipRow,
  type DirectMessage,
} from "@/lib/supabaseGame";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── 好友信息（含名字头像） ──────────────────────────────────
export interface FriendInfo {
  odataId: number; // friendship row id
  odataFriendshipRow: FriendshipRow; // raw row
  odataPeerId: string;
  name: string;
  avatar: string;
  /** 最新一条消息（用于列表预览） */
  lastMsg?: string;
  /** 未读计数 */
  unread: number;
}

/** 我发出的结缘申请（附带对方档案） */
export interface SentRequestInfo {
  friendshipRow: FriendshipRow;
  peerId: string;
  name: string;
  avatar: string;
}

export function useFriendChat(myUserId: string | null) {
  // ── 好友列表 ──
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendshipRow[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequestInfo[]>([]);

  // ── 正在聊天的对象 ──
  const [activeChatPeerId, setActiveChatPeerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Realtime Channel
  const channelRef = useRef<RealtimeChannel | null>(null);

  // ── 刷新好友列表 + 结缘申请 ──
  const refreshFriends = useCallback(async () => {
    if (!myUserId) return;
    const [rows, pending, sent] = await Promise.all([
      fetchFriends(myUserId),
      fetchPendingRequests(myUserId),
      fetchSentRequests(myUserId),
    ]);
    setPendingRequests(pending);

    // 拿好友的 peerId
    const peerIds = rows.map(r => r.requester === myUserId ? r.addressee : r.requester);
    // 拿发出申请对方的 peerId
    const sentPeerIds = sent.map(r => r.addressee);
    // 合并去重一次性获取所有档案
    const allIds = [...new Set([...peerIds, ...sentPeerIds])];
    const profiles = await fetchPlayersByIds(allIds);

    const infos: FriendInfo[] = rows.map(r => {
      const peerId = r.requester === myUserId ? r.addressee : r.requester;
      const p = profiles[peerId];
      return {
        odataId: r.id,
        odataFriendshipRow: r,
        odataPeerId: peerId,
        name: p?.name ?? "小僧",
        avatar: p?.avatar ?? "",
        unread: 0,
      };
    });
    setFriends(infos);

    // 构建发出的申请列表
    const sentInfos: SentRequestInfo[] = sent.map(r => {
      const p = profiles[r.addressee];
      return {
        friendshipRow: r,
        peerId: r.addressee,
        name: p?.name ?? "小僧",
        avatar: p?.avatar ?? "",
      };
    });
    setSentRequests(sentInfos);
  }, [myUserId]);

  // 初始加载
  useEffect(() => { refreshFriends(); }, [refreshFriends]);

  // ── 定时轮询好友状态变化（30s）──
  useEffect(() => {
    if (!myUserId) return;
    const interval = setInterval(refreshFriends, 30_000);
    return () => clearInterval(interval);
  }, [myUserId, refreshFriends]);

  // ── 好友操作 ──
  const requestFriend = useCallback(async (peerId: string) => {
    if (!myUserId) return { ok: false, msg: "未登录" };
    const result = await sendFriendRequest(myUserId, peerId);
    if (result.ok) refreshFriends();
    return result;
  }, [myUserId, refreshFriends]);

  const acceptRequest = useCallback(async (friendshipId: number) => {
    await acceptFriendRequest(friendshipId);
    refreshFriends();
  }, [refreshFriends]);

  const rejectRequest = useCallback(async (friendshipId: number) => {
    await rejectFriendRequest(friendshipId);
    refreshFriends();
  }, [refreshFriends]);

  const checkFriendship = useCallback(async (peerId: string) => {
    if (!myUserId) return null;
    return getFriendshipBetween(myUserId, peerId);
  }, [myUserId]);

  // ── 打开聊天 ──
  const openChat = useCallback(async (peerId: string) => {
    if (!myUserId) return;
    setActiveChatPeerId(peerId);
    // 加载历史
    const history = await fetchDirectMessages(myUserId, peerId);
    setMessages(history);
  }, [myUserId]);

  const closeChat = useCallback(() => {
    setActiveChatPeerId(null);
    setMessages([]);
  }, []);

  // ── 发送消息 ──
  const send = useCallback(async (content: string) => {
    if (!myUserId || !activeChatPeerId || isSending) return;
    setIsSending(true);
    const msg = await sendDirectMessage(myUserId, activeChatPeerId, content);
    if (msg) {
      setMessages(prev => [...prev, msg]);
    }
    setIsSending(false);
  }, [myUserId, activeChatPeerId, isSending]);

  // ── Realtime 监听 direct_messages INSERT ──
  useEffect(() => {
    if (!supabase || !myUserId) return;

    const channel = supabase
      .channel("dm-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${myUserId}`,
        },
        (payload) => {
          const newMsg = payload.new as DirectMessage;
          // 如果正在和发送者聊天 → 直接追加
          if (newMsg.sender_id === activeChatPeerId) {
            setMessages(prev => [...prev, newMsg]);
          } else {
            // 不在聊天 → 增加未读计数
            setFriends(prev =>
              prev.map(f =>
                f.odataPeerId === newMsg.sender_id
                  ? { ...f, unread: f.unread + 1, lastMsg: newMsg.content }
                  : f
              )
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase!.removeChannel(channel);
      channelRef.current = null;
    };
  }, [myUserId, activeChatPeerId]);

  return {
    friends,
    pendingRequests,
    sentRequests,
    refreshFriends,
    requestFriend,
    acceptRequest,
    rejectRequest,
    checkFriendship,
    activeChatPeerId,
    openChat,
    closeChat,
    messages,
    send,
    isSending,
  };
}
