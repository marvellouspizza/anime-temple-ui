/**
 * FriendChatPanel — 好友列表 + 结缘申请 + 私聊面板
 *
 * 风格与 SecondMeChat 一致：毛玻璃寺庙面板
 * 三层视图：Tab 切换（我的道友 / 结缘申请） ↔ 聊天对话
 */
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clock,
  Heart,
  MessageCircle,
  Send,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { FriendInfo, SentRequestInfo } from "@/hooks/useFriendChat";
import type { FriendshipRow, DirectMessage } from "@/lib/supabaseGame";

// ── 类型 ─────────────────────────────────────────────────────

interface FriendChatPanelProps {
  /** 当前登录用户 id */
  myUserId: string;
  /** 当前登录用户头像 */
  myAvatar: string;

  friends: FriendInfo[];
  pendingRequests: FriendshipRow[];
  pendingProfiles: Record<string, { name: string; avatar: string }>;
  sentRequests: SentRequestInfo[];

  activeChatPeerId: string | null;
  messages: DirectMessage[];
  isSending: boolean;

  onOpenChat: (peerId: string) => void;
  onCloseChat: () => void;
  onSend: (content: string) => void;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onClose: () => void;
}

// ── 小时间标签 ───────────────────────────────────────────────
function TimeLabel({ iso }: { iso: string }) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return <span className="text-[9px] text-foreground/30">{h}:{m}</span>;
}

// ── 主组件 ───────────────────────────────────────────────────

export function FriendChatPanel({
  myUserId,
  myAvatar,
  friends,
  pendingRequests,
  pendingProfiles,
  sentRequests,
  activeChatPeerId,
  messages,
  isSending,
  onOpenChat,
  onCloseChat,
  onSend,
  onAccept,
  onReject,
  onClose,
}: FriendChatPanelProps) {
  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // 有新的 pending 请求时自动跳到结缘申请 tab
  useEffect(() => {
    if (pendingRequests.length > 0 && tab === "friends" && friends.length === 0) {
      setTab("requests");
    }
  }, [pendingRequests.length, tab, friends.length]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  // 当前聊天对象信息
  const chatFriend = friends.find(f => f.odataPeerId === activeChatPeerId);

  // ── 聊天视图 ──
  if (activeChatPeerId && chatFriend) {
    return (
      <div className="flex flex-col h-full">
        {/* 标题栏 */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--bronze-green)]/30">
          <button
            className="grid h-7 w-7 place-items-center rounded-full text-foreground/40 hover:text-[var(--gold)] transition-colors"
            onClick={onCloseChat}
            aria-label="返回"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Avatar className="h-7 w-7 ring-1 ring-[var(--gold)]/40 shrink-0">
            <AvatarImage src={chatFriend.avatar} alt={chatFriend.name} />
            <AvatarFallback className="bg-black/30 text-[10px]">{chatFriend.name[0]}</AvatarFallback>
          </Avatar>
          <span className="font-title text-base text-[var(--gold)] flex-1 truncate">
            {chatFriend.name}
          </span>
          <button
            className="text-foreground/40 hover:text-foreground transition-colors text-xl leading-none"
            onClick={onClose}
            aria-label="关闭"
          >×</button>
        </div>

        {/* 消息区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <MessageCircle className="h-6 w-6 text-foreground/15" />
              <span className="text-[11px] text-foreground/30">快向道友问声好</span>
            </div>
          )}
          {messages.map(msg => {
            const isMe = msg.sender_id === myUserId;
            return (
              <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} items-end`}>
                <Avatar className="h-5 w-5 shrink-0 ring-1 ring-[var(--bronze-green)]/40">
                  {isMe ? (
                    <>
                      {myAvatar && <AvatarImage src={myAvatar} />}
                      <AvatarFallback className="bg-black/40 text-[8px]">我</AvatarFallback>
                    </>
                  ) : (
                    <>
                      {chatFriend.avatar && <AvatarImage src={chatFriend.avatar} />}
                      <AvatarFallback className="bg-black/40 text-[8px]">{chatFriend.name[0]}</AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className={`max-w-[78%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
                  isMe
                    ? "bg-[var(--gold)]/15 text-foreground/85 ring-1 ring-[var(--gold)]/25"
                    : "bg-black/25 text-foreground/80 ring-1 ring-[var(--bronze-green)]/20"
                }`}>
                  {msg.content}
                  <div className={`mt-0.5 ${isMe ? "text-right" : "text-left"}`}>
                    <TimeLabel iso={msg.created_at} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 输入框 */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[var(--bronze-green)]/30">
          <input
            className="flex-1 bg-black/20 rounded-lg px-3 py-1.5 text-[12px] text-foreground placeholder:text-foreground/30 outline-none ring-1 ring-[var(--bronze-green)]/20 focus:ring-[var(--gold)]/50 transition-[box-shadow]"
            placeholder="输入消息…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
            maxLength={500}
          />
          <button
            className="grid h-8 w-8 place-items-center rounded-full bg-[var(--gold)]/20 text-[var(--gold)] hover:bg-[var(--gold)]/30 disabled:opacity-30 transition-all"
            onClick={handleSend}
            disabled={isSending || !input.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const totalRequestsBadge = pendingRequests.length + sentRequests.length;

  // ── Tab 列表视图 ──
  return (
    <div className="flex flex-col h-full">
      {/* 标题栏 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--bronze-green)]/30">
        <Users className="h-4 w-4 text-[var(--cinnabar)] shrink-0" />
        <span className="font-title text-lg text-[var(--gold)] flex-1">道友</span>
        <button
          className="text-foreground/40 hover:text-foreground transition-colors text-xl leading-none"
          onClick={onClose}
          aria-label="关闭"
        >×</button>
      </div>

      {/* Tab 切换条 */}
      <div className="flex border-b border-[var(--bronze-green)]/20">
        <button
          className={`flex-1 py-2 text-center text-[12px] font-title transition-colors relative ${
            tab === "friends"
              ? "text-[var(--gold)]"
              : "text-foreground/40 hover:text-foreground/60"
          }`}
          onClick={() => setTab("friends")}
        >
          <span className="flex items-center justify-center gap-1">
            <Heart className="h-3 w-3" />
            我的道友
            {friends.filter(f => f.unread > 0).length > 0 && (
              <span className="min-w-[14px] h-[14px] grid place-items-center rounded-full bg-[var(--cinnabar)] text-white text-[8px] font-bold">
                {friends.filter(f => f.unread > 0).length}
              </span>
            )}
          </span>
          {tab === "friends" && (
            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--gold)] rounded-full" />
          )}
        </button>
        <button
          className={`flex-1 py-2 text-center text-[12px] font-title transition-colors relative ${
            tab === "requests"
              ? "text-[var(--gold)]"
              : "text-foreground/40 hover:text-foreground/60"
          }`}
          onClick={() => setTab("requests")}
        >
          <span className="flex items-center justify-center gap-1">
            <UserPlus className="h-3 w-3" />
            结缘申请
            {totalRequestsBadge > 0 && (
              <span className="min-w-[14px] h-[14px] grid place-items-center rounded-full bg-[var(--cinnabar)] text-white text-[8px] font-bold">
                {totalRequestsBadge}
              </span>
            )}
            {pendingRequests.length > 0 && (
              <span className="absolute top-1 right-2 h-2 w-2 rounded-full bg-[var(--cinnabar)] animate-pulse" />
            )}
          </span>
          {tab === "requests" && (
            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[var(--gold)] rounded-full" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {tab === "requests" ? (
          /* ════════ 结缘申请页面 ════════ */
          <div className="space-y-4">
            {/* —— 收到的结缘申请 —— */}
            {pendingRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <UserPlus className="h-3 w-3 text-[var(--cinnabar)]" />
                  <span className="text-[10px] font-title text-[var(--cinnabar)]">
                    收到的结缘申请 ({pendingRequests.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingRequests.map(req => {
                    const p = pendingProfiles[req.requester];
                    return (
                      <div key={req.id} className="temple-pill flex items-center gap-3 px-3 py-2.5">
                        <Avatar className="h-9 w-9 ring-1 ring-[var(--bronze-green)]/40 shrink-0">
                          {p?.avatar && <AvatarImage src={p.avatar} />}
                          <AvatarFallback className="bg-black/30 text-[10px]">{(p?.name ?? "僧")[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="font-title text-sm text-foreground/80 truncate block">{p?.name ?? "未知"}</span>
                          <span className="text-[9px] text-foreground/35">
                            {new Date(req.created_at).toLocaleDateString("zh-CN")} 发起结缘
                          </span>
                        </div>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-full bg-[var(--gold)]/20 text-[var(--gold)] hover:bg-[var(--gold)]/30 transition-colors"
                          onClick={() => onAccept(req.id)}
                          title="接受"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-full bg-black/20 text-foreground/40 hover:text-[var(--cinnabar)] transition-colors"
                          onClick={() => onReject(req.id)}
                          title="拒绝"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* —— 我发出的结缘申请 —— */}
            {sentRequests.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="h-3 w-3 text-[var(--bronze-green)]" />
                  <span className="text-[10px] font-title text-[var(--bronze-green)]">
                    我发出的结缘申请 ({sentRequests.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {sentRequests.map(sr => (
                    <div key={sr.friendshipRow.id} className="temple-pill flex items-center gap-3 px-3 py-2.5 opacity-80">
                      <Avatar className="h-9 w-9 ring-1 ring-[var(--bronze-green)]/40 shrink-0">
                        {sr.avatar && <AvatarImage src={sr.avatar} />}
                        <AvatarFallback className="bg-black/30 text-[10px]">{sr.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="font-title text-sm text-foreground/80 truncate block">{sr.name}</span>
                        <span className="text-[9px] text-foreground/35">
                          {new Date(sr.friendshipRow.created_at).toLocaleDateString("zh-CN")} 发出
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--bronze-green)] px-2 py-0.5 rounded-full bg-[var(--bronze-green)]/10 ring-1 ring-[var(--bronze-green)]/20">
                        等待回应
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 空状态 */}
            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <UserPlus className="h-7 w-7 text-foreground/15" />
                <span className="text-xs text-foreground/35">暂无结缘申请<br/>在寺中修行时，AI 分身会自动结缘</span>
              </div>
            )}
          </div>
        ) : (
          /* ════════ 我的道友页面 ════════ */
          <>
            {friends.length === 0 && sentRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Heart className="h-7 w-7 text-foreground/15" />
                <span className="text-xs text-foreground/35">尚无道友<br/>在「附近僧人」中结缘或等待 AI 自动结缘</span>
              </div>
            ) : (
              <div className="space-y-2">
                {/* 已结为道友 */}
                {friends.map(f => (
                  <button
                    key={f.odataId}
                    className="w-full temple-pill flex items-center gap-3 px-3 py-2.5 text-left hover:ring-1 hover:ring-[var(--gold)]/50 transition-all group"
                    onClick={() => onOpenChat(f.odataPeerId)}
                  >
                    <Avatar className="h-10 w-10 ring-1 ring-[var(--bronze-green)]/40 group-hover:ring-[var(--gold)]/60 transition-[box-shadow] shrink-0">
                      {f.avatar && <AvatarImage src={f.avatar} />}
                      <AvatarFallback className="bg-black/30 text-[10px] font-title">{f.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-title text-sm text-foreground/80">{f.name}</span>
                      {f.lastMsg && (
                        <div className="text-[10px] text-foreground/35 truncate mt-0.5">{f.lastMsg}</div>
                      )}
                    </div>
                    {f.unread > 0 && (
                      <span className="min-w-[18px] h-[18px] grid place-items-center rounded-full bg-[var(--cinnabar)] text-white text-[9px] font-bold">
                        {f.unread > 99 ? "99+" : f.unread}
                      </span>
                    )}
                    <MessageCircle className="h-4 w-4 text-foreground/20 group-hover:text-[var(--gold)] transition-colors shrink-0" />
                  </button>
                ))}
                {/* 我发出的结缘申请（等待对方回应） */}
                {sentRequests.map(sr => (
                  <div
                    key={sr.friendshipRow.id}
                    className="temple-pill flex items-center gap-3 px-3 py-2.5 opacity-70"
                  >
                    <Avatar className="h-10 w-10 ring-1 ring-[var(--bronze-green)]/30 shrink-0">
                      {sr.avatar && <AvatarImage src={sr.avatar} />}
                      <AvatarFallback className="bg-black/30 text-[10px] font-title">{sr.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="font-title text-sm text-foreground/70 truncate block">{sr.name}</span>
                      <span className="text-[9px] text-foreground/35">已发出结缘申请</span>
                    </div>
                    <span className="text-[10px] text-[var(--bronze-green)] px-2 py-0.5 rounded-full bg-[var(--bronze-green)]/10 ring-1 ring-[var(--bronze-green)]/20 shrink-0">
                      等待回应
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
