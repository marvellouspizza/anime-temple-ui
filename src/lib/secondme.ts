/**
 * SecondMe / MindVerse API 服务层
 * Base URL: https://api.mindverse.com/gate/lab
 *
 * 认证方式：OAuth2 授权码流程
 * Token 格式：Bearer lba_at_xxx
 */

const BASE_URL = "https://api.mindverse.com/gate/lab";
const CLIENT_ID = import.meta.env.VITE_SECONDME_CLIENT_ID as string;
const CLIENT_SECRET = import.meta.env.VITE_SECONDME_CLIENT_SECRET as string;
const REDIRECT_URI = import.meta.env.VITE_SECONDME_REDIRECT_URI as string;

const STORAGE_KEY = "secondme_access_token";
const SESSION_KEY = "secondme_session_id";

// ── Token 本地存储 ────────────────────────────────────────────

export function saveToken(token: string) {
  localStorage.setItem(STORAGE_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function saveSessionId(id: string) {
  localStorage.setItem(SESSION_KEY, id);
}

export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

// ── OAuth2 授权码流程 ─────────────────────────────────────────

/** 构造 OAuth2 授权页 URL 并跳转 */
export function redirectToOAuth() {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state: Math.random().toString(36).substring(7),
  });
  window.location.href = `https://go.second.me/oauth/?${params.toString()}`;
}

/** 用授权码换取 Access Token */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/oauth/token/code`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`获取 Token 失败：${res.status}`);
  }
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || "获取 Token 失败");
  const token: string = json.data.accessToken;
  if (!token) throw new Error("响应中未找到 accessToken");
  saveToken(token);
  return token;
}

// ── API 请求封装 ──────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) throw new Error("未登录，请先完成 SecondMe 授权");
  return { Authorization: `Bearer ${token}` };
}

// ── 用户信息 ──────────────────────────────────────────────────

export interface SecondMeUser {
  userId: string;  // SecondMe 平台唯一用户标识，稳定不变
  name: string;
  email: string;
  avatar: string;
  bio: string;
  selfIntroduction?: string;
  route?: string;
}

export async function fetchUserInfo(): Promise<SecondMeUser> {
  const res = await fetch(`${BASE_URL}/api/secondme/user/info`, {
    headers: authHeaders(),
  });
  if (res.status === 401) {
    clearToken();
    throw new Error("身份凭证已过期，请重新授权");
  }
  if (!res.ok) throw new Error(`获取分身信息失败：${res.status}`);
  const json = await res.json();
  if (json.code !== 0) throw new Error(json.message || "API 错误");
  const d = json.data;
  return {
    userId: String(d.userId ?? ""),
    name: d.name ?? "",
    email: d.email ?? "",
    avatar: d.avatar ?? "",
    bio: d.bio ?? "",
    selfIntroduction: d.selfIntroduction,
    route: d.route,
  };
}

// ── SSE 流式聊天 ──────────────────────────────────────────────

export interface ChatChunk {
  type: "session" | "content" | "done" | "error";
  content?: string;
  sessionId?: string;
}

/**
 * 流式聊天（SSE）
 * @param message 用户消息
 * @param onChunk 每个 chunk 的回调
 * @param signal AbortSignal
 * @param systemPrompt 系统提示词，仅在新会话首次有效
 */
export async function streamChat(
  message: string,
  onChunk: (chunk: ChatChunk) => void,
  signal?: AbortSignal,
  systemPrompt?: string,
): Promise<void> {
  const sessionId = getSessionId();
  
  const body: Record<string, any> = { message };
  if (sessionId) {
    body.sessionId = sessionId;
  }
  if (!sessionId && systemPrompt) {
    body.systemPrompt = systemPrompt;
  }

  const res = await fetch(`${BASE_URL}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (res.status === 401) {
    clearToken();
    throw new Error("Token 已过期，请重新授权");
  }
  if (!res.ok) throw new Error(`聊天请求失败：${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("响应流为空");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // SSE event 行：event: session
      if (trimmed.startsWith("event: session")) continue;

      // SSE data 行
      if (trimmed.startsWith("data: ")) {
        const raw = trimmed.slice(6);
        if (raw === "[DONE]") {
          onChunk({ type: "done" });
          continue;
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed.sessionId) {
            saveSessionId(parsed.sessionId);
            onChunk({ type: "session", sessionId: parsed.sessionId });
          } else if (parsed.choices?.[0]?.delta?.content !== undefined) {
            onChunk({ type: "content", content: parsed.choices[0].delta.content });
          }
        } catch {
          // 忽略无法解析的行
        }
      }
    }
  }
}
