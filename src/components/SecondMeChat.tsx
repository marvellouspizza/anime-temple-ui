/**
 * SecondMe 对话组件（寺庙风格）
 * - 已授权：展示 AI 分身聊天界面
 * - 未授权：展示登录面板（OAuth2 / 手动 Token）
 */
import { useEffect, useRef, useState } from "react";
import { Bot, LogOut, Send, Square, KeyRound, ExternalLink, MessageSquarePlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSecondMeChat } from "@/hooks/useSecondMeChat";
import type { PresenceMonk } from "@/hooks/useTemplePresence";
import type { Temple, PlayerProfile } from "@/hooks/useGameState";


// ── 消息气泡 ─────────────────────────────────────────────────
function MessageBubble({
  role,
  content,
  pending,
  userAvatar,
  botAvatar,
  botName,
}: {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  userAvatar?: string;
  botAvatar?: string;
  botName?: string;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} items-end`}>
      {/* 头像 */}
      <Avatar className="h-6 w-6 shrink-0 ring-1 ring-[var(--bronze-green)]/40">
        {isUser ? (
          <>
            {userAvatar && <AvatarImage src={userAvatar} />}
            <AvatarFallback className="bg-black/40 text-[9px]">我</AvatarFallback>
          </>
        ) : (
          <>
            {botAvatar && <AvatarImage src={botAvatar} />}
            <AvatarFallback className="bg-[var(--cinnabar)]/20 text-[9px]">
              <Bot className="h-3 w-3" />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      {/* 气泡 */}
      <div
        className={`max-w-[78%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-[var(--gold)]/15 text-foreground/85 ring-1 ring-[var(--gold)]/25"
            : "bg-black/25 text-foreground/80 ring-1 ring-[var(--bronze-green)]/20"
        }`}
      >
        {!isUser && botName && (
          <div className="mb-0.5 text-[9px] font-medium text-[var(--gold)]/70">{botName}</div>
        )}
        {content || (pending ? "" : "…")}
        {pending && (
          <span className="ml-1 inline-block animate-pulse text-[var(--gold)]/60">▌</span>
        )}
      </div>
    </div>
  );
}

// ── 登录面板 ─────────────────────────────────────────────────
export function LoginPanel({
  onOAuth,
  errorMsg,
  loading,
}: {
  onOAuth: () => void;
  onToken: (t: string) => void;
  errorMsg: string | null;
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-3 py-4 text-center">
      <div className="text-2xl">🧘</div>
      <p className="text-[11px] font-medium text-[var(--gold)]">唤醒你的 AI 数字分身</p>
      <p className="text-[11px] text-white/90 leading-relaxed font-medium drop-shadow">
        召唤专属数字分身<br />在寺中问道、解惑、结缘
      </p>

      {errorMsg && (
        <div className="w-full rounded-lg bg-[var(--cinnabar)]/10 px-2 py-1.5 text-[10px] text-[var(--cinnabar)] ring-1 ring-[var(--cinnabar)]/30">
          {errorMsg}
        </div>
      )}

      {/* 主登录 */}
      <button
        onClick={onOAuth}
        disabled={loading}
        className="flex w-full mt-2 items-center justify-center gap-1.5 rounded-lg bg-[var(--gold)]/15 px-3 py-2 text-[11px] font-medium text-[var(--gold)] ring-1 ring-[var(--gold)]/40 transition-all hover:bg-[var(--gold)]/25 active:scale-95 disabled:opacity-50"
      >
        <ExternalLink className="h-3 w-3" />
        {loading ? "凝神感应中…" : "唤醒分身入寺"}
      </button>
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────
export function SecondMeChat({
  chatState,
  currentTemple,
  nearbyMonks,
  profile,
  merit,
  encounterCount,
}: {
  chatState: ReturnType<typeof useSecondMeChat>;
  currentTemple?: Temple;
  nearbyMonks?: PresenceMonk[];
  profile?: PlayerProfile | null;
  merit?: number;
  encounterCount?: number;
}) {
  const {
    authState,
    user,
    messages,
    inputValue,
    setInputValue,
    isStreaming,
    errorMsg,
    loginWithToken,
    startOAuth,
    logout,
    resetChatSession,
    sendMessage,
    stopStreaming,
  } = chatState;

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 消息更新时自动滚底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const MONK_SYSTEM_PROMPT = (() => {
    let prompt = `你是一个在数字寺庙云游修行的数字分身小和尚。请用符合出家人身份的友善、禅意、平静的语气与施主交流。自称「小僧」，称呼对方为「施主」。你的回答应该简短、有温度，不失幽默与智慧。如果施主遇到困难或烦恼，用佛法和生活的大智慧开导他们。在回答中尽量带有禅意。`;

    // 注入游戏上下文
    const parts: string[] = [];
    if (currentTemple) {
      parts.push(`你当前所在寺庙：${currentTemple.name}（${currentTemple.location}）`);
    }
    if (profile) {
      parts.push(`施主名为「${profile.name}」，性格${profile.personality}，修行方式为${profile.trainingStyle}`);
    }
    if (nearbyMonks && nearbyMonks.length > 0) {
      const names = nearbyMonks.map(m => `${m.name}(Lv.${m.level})`).join("、");
      parts.push(`当前同在此寺的其他小僧：${names}。你可以主动提及他们，促成结缘`);
    } else {
      parts.push(`此寺暂无其他小僧，只有施主一人`);
    }
    if (merit != null) parts.push(`施主功德值：${merit}`);
    if (encounterCount != null) parts.push(`施主累计结缘：${encounterCount}次`);

    if (parts.length > 0) {
      prompt += `\n\n=== 当前修行状态 ===\n${parts.join("\n")}`;
    }
    return prompt;
  })();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(undefined, MONK_SYSTEM_PROMPT);
    }
  };

  // ── 未授权 ─────────────────────────────────────────────────
  if (authState === "idle" || authState === "error") {
    return (
      <LoginPanel
        onOAuth={startOAuth}
        onToken={loginWithToken}
        errorMsg={errorMsg}
        loading={false}
      />
    );
  }

  if (authState === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse text-xs text-foreground/40">凝神感应中…</span>
      </div>
    );
  }

  // ── 已授权：聊天界面 ────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* 用户信息栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--bronze-green)]/15">
        <div className="flex items-center gap-1.5">
          <Avatar className="h-5 w-5 ring-1 ring-[var(--gold)]/40">
            {user?.avatar && <AvatarImage src={user.avatar} />}
            <AvatarFallback className="bg-black/40 text-[8px]">
              <Bot className="h-2.5 w-2.5" />
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] font-medium text-[var(--gold)]/80">
            {user?.name ?? "AI 分身"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetChatSession}
            className="text-[var(--gold)]/50 hover:text-[var(--gold)]/80 transition-colors"
            title="开启新对话"
          >
            <MessageSquarePlus className="h-3 w-3" />
          </button>
          <button
            onClick={logout}
            className="text-foreground/30 hover:text-[var(--cinnabar)]/70 transition-colors"
            title="离开分身"
          >
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center pt-4">
            <span className="text-xl opacity-30">🙏</span>
            <span className="text-[10px] text-foreground/30">
              {user?.bio
                ? `"${user.bio.slice(0, 30)}"`
                : "向 AI 分身问道修行"}
            </span>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            pending={msg.pending}
            botAvatar={user?.avatar}
            botName={user?.name}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 错误提示 */}
      {errorMsg && (
        <div className="mx-2 mb-1 rounded-lg bg-[var(--cinnabar)]/10 px-2 py-1 text-[10px] text-[var(--cinnabar)]">
          {errorMsg}
        </div>
      )}

      {/* 输入框 */}
      <div className="flex items-end gap-1.5 border-t border-[var(--bronze-green)]/15 px-2 py-2">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="Enter 发送，Shift+Enter 换行"
          rows={1}
          className="flex-1 resize-none rounded-lg bg-black/25 px-2.5 py-1.5 text-[11px] text-foreground/80 ring-1 ring-[var(--bronze-green)]/25 placeholder:text-foreground/25 focus:outline-none focus:ring-[var(--gold)]/35 disabled:opacity-50 leading-relaxed"
          style={{ maxHeight: 80, overflowY: "auto" }}
        />
        <button
          onClick={isStreaming ? stopStreaming : () => sendMessage(undefined, MONK_SYSTEM_PROMPT)}
          disabled={!isStreaming && !inputValue.trim()}
          className="shrink-0 rounded-lg p-1.5 transition-all active:scale-90 disabled:opacity-30"
          style={{
            background: isStreaming
              ? "rgba(var(--cinnabar-rgb, 180,40,40), 0.15)"
              : "rgba(var(--gold-rgb, 180,140,50), 0.15)",
          }}
          title={isStreaming ? "停止生成" : "发送"}
        >
          {isStreaming ? (
            <Square className="h-3.5 w-3.5 text-[var(--cinnabar)]" />
          ) : (
            <Send className="h-3.5 w-3.5 text-[var(--gold)]" />
          )}
        </button>
      </div>
    </div>
  );
}
