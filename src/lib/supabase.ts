/**
 * Supabase 客户端单例
 * 若 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 未配置，supabase 为 null，
 * 所有云同步功能静默跳过，游戏正常以 localStorage 运行。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

if (!supabase) {
  console.warn(
    "[Supabase] 未检测到环境变量 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，云同步已禁用。"
  );
}
