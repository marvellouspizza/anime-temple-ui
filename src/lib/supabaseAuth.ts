/**
 * supabaseAuth.ts
 *
 * Second Me → Supabase 账号桥接层。
 *
 * 策略：
 *   - 以 SecondMe 平台的 userId（稳定唯一）派生 Supabase 账号
 *   - email = `sm{userId}@temple.game`（伪邮箱，不会与真实邮箱冲突）
 *   - password = `{APP_SALT}{userId}`（确定性，跨设备/跨浏览器一致）
 *   - 无论 localStorage 是否清除，只要重新 SecondMe 授权，都能恢复同一账号
 */
import { supabase } from "./supabase";
import type { SecondMeUser } from "./secondme";

const APP_SALT = "AnygTemp2024Sl";

function makeEmail(smUserId: string): string {
  return `sm${smUserId}@temple.game`;
}

function makePassword(smUserId: string): string {
  return `Tp${APP_SALT}${smUserId}`;
}

/**
 * 确保 Supabase 会话存在，返回 user.id。
 * 若 Supabase 未配置，返回 null（修行数据仅本地保存）。
 */
export async function ensureSupabaseSession(
  smUser: SecondMeUser
): Promise<string | null> {
  if (!supabase) return null;

  const smUserId = smUser.userId;
  if (!smUserId) {
    console.warn("[Auth] SecondMe userId 为空，跳过云端同步");
    return null;
  }

  const email = makeEmail(smUserId);
  const password = makePassword(smUserId);

  try {
    // 1. 已有有效 session 且是同一账号 → 直接返回
    const {
      data: { session },
    } = await supabase.auth.getSession();
    console.log("[Auth] 现有 session:", session?.user?.email ?? "无");
    if (session?.user) {
      if (session.user.email === email) {
        console.log("[Auth] 复用现有 session, uid =", session.user.id);
        return session.user.id;
      }
      // 不是同一账号，登出后重新登录
      await supabase.auth.signOut();
    }

    // 2. 尝试静默登录（账号已存在）
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (!signInError && signInData.user) {
      console.log("[Auth] 密码登录成功, uid =", signInData.user.id);
      return signInData.user.id;
    }
    console.warn("[Auth] 密码登录失败:", signInError?.message);

    // 3. 首次进入：注册新账号
    const { data: signUpData, error: signUpError } =
      await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            secondme_user_id: smUserId,
            secondme_name: smUser.name,
          },
        },
      });

    if (signUpError) {
      console.error("[Auth] 账号创建失败:", signUpError.message);
      return null;
    }

    // 若需要邮件确认（未关闭），再尝试一次登录
    if (!signUpData.session) {
      const { data: retryData, error: retryError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (!retryError && retryData.user) {
        return retryData.user.id;
      }
      console.warn(
        "[Auth] 请在后台 Auth → Settings 中关闭 Enable email confirmations"
      );
      return null;
    }

    return signUpData.user?.id ?? null;
  } catch (e) {
    console.error("[Auth] 会话异常:", e);
    return null;
  }
}

/** 退出（清除 session） */
export async function supabaseSignOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
