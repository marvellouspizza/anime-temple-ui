/**
 * useTemplePresence — Supabase Realtime Presence
 *
 * 追踪同一寺庙内的在线玩家。
 * 每个玩家 track 自己的位置和档案摘要，
 * 通过 presence.sync / join / leave 事件获得同寺庙其他玩家列表。
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── 类型定义 ─────────────────────────────────────────────────
export interface PresenceMonk {
  /** Supabase user id */
  id: string;
  name: string;
  avatarUrl: string;
  avatarFallback: string;
  level: number;
  title: string;
  status: string;
  statusDesc: string;
  merit: number;
  currentTempleId: number;
  personality: string;
  trainingStyle: string;
}

/** 传入 hook 的玩家自身信息 */
export interface PresenceSelf {
  userId: string;
  name: string;
  avatarUrl: string;
  level: number;
  merit: number;
  currentTempleId: number;
  personality: string;
  trainingStyle: string;
}

// ── 等级 → 称号映射（与 useGameState 中的 TWELVE_TEMPLES 对齐）──
function levelTitle(level: number): string {
  if (level <= 0) return "初来乍到";
  if (level <= 3) return "云游小僧";
  if (level <= 6) return "苦修居士";
  if (level <= 9) return "参禅行者";
  if (level <= 12) return "悟道禅师";
  return "登峰造极";
}

// ── 修行状态随机（给其他玩家展示）──
const STATUS_OPTIONS = [
  { status: "打坐冥想", desc: "禅堂 · 静心修炼中" },
  { status: "诵经修行", desc: "经殿 · 虔心诵读" },
  { status: "品茗悟道", desc: "茶室 · 静观大千" },
  { status: "漫步庭院", desc: "廊道 · 闲庭信步" },
  { status: "云游参悟", desc: "殿前 · 凝神聚气" },
];

function randomStatus() {
  return STATUS_OPTIONS[Math.floor(Math.random() * STATUS_OPTIONS.length)];
}

// ── Hook ─────────────────────────────────────────────────────
export function useTemplePresence(self: PresenceSelf | null) {
  const [nearbyMonks, setNearbyMonks] = useState<PresenceMonk[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfRef = useRef(self);
  selfRef.current = self;

  // 从 presence state 中提取同寺庙的其他玩家
  const syncPresence = useCallback((channel: RealtimeChannel) => {
    const presenceState = channel.presenceState<Record<string, any>>();
    const monks: PresenceMonk[] = [];
    const currentSelf = selfRef.current;

    for (const key of Object.keys(presenceState)) {
      const entries = presenceState[key];
      for (const entry of entries) {
        // 跳过自己
        if (currentSelf && entry.userId === currentSelf.userId) continue;
        // 只展示同寺庙的玩家
        if (currentSelf && entry.currentTempleId !== currentSelf.currentTempleId) continue;

        monks.push({
          id: entry.userId,
          name: entry.name ?? "小僧",
          avatarUrl: entry.avatarUrl ?? "",
          avatarFallback: (entry.name ?? "僧")[0],
          level: entry.level ?? 1,
          title: levelTitle(entry.level ?? 1),
          status: entry.status ?? "修行中",
          statusDesc: entry.statusDesc ?? "",
          merit: entry.merit ?? 0,
          currentTempleId: entry.currentTempleId ?? 0,
          personality: entry.personality ?? "",
          trainingStyle: entry.trainingStyle ?? "",
        });
      }
    }

    setNearbyMonks(monks);
  }, []);

  // 初始化 / 更新 presence channel
  useEffect(() => {
    if (!supabase || !self || !self.userId || self.currentTempleId <= 0) {
      setNearbyMonks([]);
      return;
    }

    const { status, desc } = randomStatus();

    const channel = supabase.channel("temple-presence", {
      config: { presence: { key: self.userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => syncPresence(channel))
      .on("presence", { event: "join" }, () => syncPresence(channel))
      .on("presence", { event: "leave" }, () => syncPresence(channel))
      .subscribe(async (statusEvent) => {
        if (statusEvent === "SUBSCRIBED") {
          await channel.track({
            userId: self.userId,
            name: self.name,
            avatarUrl: self.avatarUrl,
            level: self.level,
            merit: self.merit,
            currentTempleId: self.currentTempleId,
            personality: self.personality,
            trainingStyle: self.trainingStyle,
            status,
            statusDesc: desc,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase!.removeChannel(channel);
      channelRef.current = null;
    };
    // 当用户切换寺庙或关键属性变化时，重建 channel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    self?.userId,
    self?.currentTempleId,
    self?.level,
    self?.name,
    self?.avatarUrl,
    syncPresence,
  ]);

  return { nearbyMonks };
}
