import { useState, useCallback, useRef, useEffect } from "react";
import {
  streamChat,
  fetchUserInfo,
  getToken,
  clearToken,
  clearSession,
  saveToken,
  exchangeCodeForToken,
  redirectToOAuth,
  type SecondMeUser,
} from "@/lib/secondme";
import {
  ensureSupabaseSession,
  supabaseSignOut,
} from "@/lib/supabaseAuth";
import { upsertPlayerSecondMe } from "@/lib/supabaseGame";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

export type AuthState = "idle" | "loading" | "authed" | "error";

// ── 检测 URL query 中是否有 OAuth2 code ─────────────────────
export function extractOAuthCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("code");
}

export function useSecondMeChat() {
  const [authState, setAuthState] = useState<AuthState>(() =>
    getToken() ? "loading" : "idle"
  );
  const [user, setUser] = useState<SecondMeUser | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** Second Me 登录成功后，静默创建/恢复修行档案 */
  const syncSupabaseAuth = useCallback(async (smUser: SecondMeUser) => {
    let uid: string | null = null;
    try {
      uid = await ensureSupabaseSession(smUser);
    } catch (e) {
      console.warn("[Auth] Supabase 会话建立失败，1s 后重试:", e);
      try {
        await new Promise(r => setTimeout(r, 1000));
        uid = await ensureSupabaseSession(smUser);
      } catch (e2) {
        console.error("[Auth] Supabase 会话重试失败:", e2);
      }
    }
    console.log("[Auth] supabaseUserId =", uid);
    // 先确保 players 行存在，再设置 userId 触发 useGameState 加载
    if (uid) {
      try {
        await upsertPlayerSecondMe(
          uid,
          smUser.userId,
          smUser.name,
          smUser.bio,
          smUser.avatar
        );
        console.log("[Auth] upsertPlayerSecondMe 成功");
      } catch (e) {
        console.error("[Auth] upsertPlayerSecondMe 失败:", e);
      }
    } else {
      console.warn("[Auth] 未能获取 supabaseUserId，云端同步不可用");
    }
    setSupabaseUserId(uid);
  }, []);

  // ── 手动 Token 登录（开发者模式）─────────────────────────
  const loginWithToken = useCallback(async (token: string) => {
    setAuthState("loading");
    setErrorMsg(null);
    saveToken(token.trim());
    try {
      const info = await fetchUserInfo();
      setUser(info);
      await syncSupabaseAuth(info);
      setAuthState("authed");
    } catch (e) {
      setErrorMsg((e as Error).message);
      clearToken();
      setAuthState("error");
    }
  }, [syncSupabaseAuth]);

  // ── OAuth2 跳转 ───────────────────────────────────────────
  const startOAuth = useCallback(() => {
    redirectToOAuth();
  }, []);

  // ── OAuth2 回调处理（传入 URL 中的 code）────────────────
  const handleOAuthCallback = useCallback(async (code: string) => {
    setAuthState("loading");
    setErrorMsg(null);
    try {
      await exchangeCodeForToken(code);
      const info = await fetchUserInfo();
      setUser(info);
      await syncSupabaseAuth(info);
      setAuthState("authed");
    } catch (e) {
      setErrorMsg((e as Error).message);
      clearToken();
      setAuthState("error");
    }
  }, [syncSupabaseAuth]);

  // ── 加载用户信息（已有 token 时自动调用）────────────────
  const loadUserInfo = useCallback(async () => {
    if (!getToken()) return;
    setAuthState("loading");
    try {
      const info = await fetchUserInfo();
      setUser(info);
      await syncSupabaseAuth(info);
      setAuthState("authed");
    } catch (e) {
      setErrorMsg((e as Error).message);
      clearToken();
      setAuthState("idle");
    }
  }, [syncSupabaseAuth]);

  // ── 登出 ─────────────────────────────────────────────────
  const logout = useCallback(() => {
    abortRef.current?.abort();
    clearToken();
    setUser(null);
    setSupabaseUserId(null);
    setMessages([]);
    setInputValue("");
    setAuthState("idle");
    setErrorMsg(null);
    supabaseSignOut().catch(console.error);
  }, []);

  // ── 重置会话（清空上下文记忆） ───────────────────────────
  const resetChatSession = useCallback(() => {
    abortRef.current?.abort();
    clearSession();
    setMessages([]);
    setInputValue("");
    setErrorMsg(null);
  }, []);

  // ── 发送消息 ─────────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string, systemPrompt?: string) => {
    const msg = (text ?? inputValue).trim();
    if (!msg || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: msg,
    };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputValue("");
    setIsStreaming(true);
    setErrorMsg(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamChat(
        msg,
        (chunk) => {
          if (chunk.type === "content") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + (chunk.content ?? ""), pending: true }
                  : m
              )
            );
          } else if (chunk.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, pending: false } : m
              )
            );
          }
        },
        ctrl.signal,
        systemPrompt,
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      const errText = (e as Error).message;
      setErrorMsg(errText);
      if (errText.includes("过期") || errText.includes("授权")) {
        setAuthState("idle");
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: m.content || "⚠️ 请求中断", pending: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [inputValue, isStreaming]);

  // ── 中止当前流 ───────────────────────────────────────────
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── 首次加载自动恢复与回调处理 ──────────────────────────
  useEffect(() => {
    loadUserInfo();
    const code = extractOAuthCode();
    if (code) {
      handleOAuthCallback(code);
      // 清除 hash 中的 code
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [loadUserInfo, handleOAuthCallback]);

  return {
    authState,
    user,
    supabaseUserId,
    messages,
    inputValue,
    setInputValue,
    isStreaming,
    errorMsg,
    loginWithToken,
    startOAuth,
    handleOAuthCallback,
    loadUserInfo,
    logout,
    resetChatSession,
    sendMessage,
    stopStreaming,
  };
}
