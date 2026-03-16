/*
  设计宣言（本文件）
  - 背景：动漫风格中国寺庙（严格对称 + 一点透视）
  - 叠加：游戏 HUD（毛玻璃 + 金边 + 回纹）
  - 交互：按钮/图标有明显的悬浮反馈
*/

import bgTemple from "@/assets/bg-temple.mp4";
import bgTempleImg from "@/assets/bg-temple.png";
import startBgImg from "@/assets/1111.png";
import pWoman from "@/assets/p-woman.png";
import pMan from "@/assets/p-man.png";
import incenseImg from "@/assets/点香.png";
import gongfengImg from "@/assets/供奉.png";
import tianxiangImg from "@/assets/添香.png";

// 寺庙图片（压缩版 WebP，eager 预加载，通过名称匹配查找）
const _templeImageModules = import.meta.glob<string>("../assets/寺庙_compressed/*.webp", {
  eager: true,
  import: "default",
});
function getTempleImage(name: string): string {
  for (const [path, src] of Object.entries(_templeImageModules)) {
    if (path.includes(name)) return src;
  }
  return bgTempleImg;
}

// 寺庙视频（eager 预加载）
const _templeVideoModules = import.meta.glob<string>("../assets/寺庙视频/*.mp4", {
  eager: true,
  import: "default",
});
function getTempleVideo(name: string): string | null {
  for (const [path, src] of Object.entries(_templeVideoModules)) {
    if (path.includes(name)) return src;
  }
  return null;
}
import { useEffect, useRef, useState } from "react";
import { DraggableCard } from "@/components/DraggableCard";
import { RegisterCard } from "@/components/RegisterCard";
import { motion, AnimatePresence } from "framer-motion";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

import {
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Landmark,
  Lock,
  MessageCircle,
  Moon,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Settings,
  SkipBack,
  SkipForward,
  Sparkles,
  Store,
  Sun,
  Swords,
  Trophy,
  Unlock,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useGameState, TWELVE_TEMPLES, INCENSE_ACTIONS } from "@/hooks/useGameState";
import { useSecondMeChat } from "@/hooks/useSecondMeChat";
import { SecondMeChat, LoginPanel } from "@/components/SecondMeChat";
import { useTemplePresence } from "@/hooks/useTemplePresence";
import type { PresenceMonk } from "@/hooks/useTemplePresence";



// 从 songs 目录加载真实音乐文件（Vite glob）
const _songModules = import.meta.glob<string>("/src/assets/songs/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

// 文件名 → 五字中文曲名 / 艺术家
const SONG_META: Record<string, { title: string; artist: string }> = {
  "1996":                                    { title: "千禧梵音曲", artist: "岁月禅声" },
  "serce polska - Nunu":                     { title: "波兰心弦吟", artist: "Nunu" },
  "森林摇篮曲":                              { title: "森林摇篮曲", artist: "自然禅音" },
  "用于风景、冥想、瑜伽、禅宗的平静钢琴音乐": { title: "静心钢琴曲", artist: "禅意山水" },
};

function parseSongName(path: string): { title: string; artist: string } {
  const filename = path.split("/").pop()?.replace(/\.mp3$/i, "") ?? "";
  if (SONG_META[filename]) return SONG_META[filename];
  const dashIdx = filename.lastIndexOf(" - ");
  if (dashIdx !== -1) {
    return { title: filename.slice(0, dashIdx), artist: filename.slice(dashIdx + 3) };
  }
  return { title: filename.slice(0, 5), artist: "禅境" };
}

const TRACKS: { url: string; title: string; artist: string }[] =
  Object.keys(_songModules).sort().map((path) => ({
    url: _songModules[path],
    ...parseSongName(path),
  }));



function formatMerit(v: number): string {
  if (v < 10000) return v.toLocaleString("zh-CN");
  const wan = v / 10000;
  return `${wan.toFixed(1).replace(/\.0$/, "")}万`;
}

interface HomeProps {
  targetSection?: string;
}

function comingSoon(label: string) {
  toast.message(`${label}：敬请期待`, { description: "本界面为 UI Demo，用于视觉与交互演示。" });
}

export default function Home({ targetSection }: HomeProps) {
  void targetSection;

  const [nowStr, setNowStr] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowStr(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    }, 10000);
    return () => clearInterval(t);
  }, []);

  // 主题切换
  const { theme, setTheme } = useTheme();

  // 布局解锁
  const [isLayoutUnlocked, setIsLayoutUnlocked] = useState(false);

  // 香火动画
  const [flashState, setFlashState] = useState<{ src: string; key: number } | null>(null);

  // 强制 SecondMe 会话
  const chatState = useSecondMeChat();
  const supabaseUserId = chatState.supabaseUserId;

  // 游戏核心状态
  const { state, expPercent, todayLoginAvailable, doLogin, doMorningTask, useIncenseCoin, resetGame, doRegister, setCurrentTempleId, acknowledgeUnlock, acknowledgeReward, isCloudLoading, setNearbyPlayerNames } = useGameState(supabaseUserId);

  // 寺庙概览
  const [showTempleOverview, setShowTempleOverview] = useState(false);
  const [selectedTempleId, setSelectedTempleId] = useState<number | null>(null);

  // 到此修行 — 神龛视频切换
  const [immersiveTempleId, setImmersiveTempleId] = useState<number | null>(null);

  // 今日修行面板
  const [showDailyPanel, setShowDailyPanel] = useState(false);

  // 其他僧人
  const [showMonksPanel, setShowMonksPanel] = useState(false);
  const [selectedMonkId, setSelectedMonkId] = useState<string | null>(null);

  // 成就面板
  const [showAchievement, setShowAchievement] = useState(false);
  const [achieveTab, setAchieveTab] = useState<"temples" | "zen" | "encounter" | "relics">("temples");

  // 隐藏控制
  const [hideOtherMonks, setHideOtherMonks] = useState(false);
  const [hideCharacter, setHideCharacter] = useState(false);

  // Realtime Presence — 同寺庙在线玩家
  const currentTemple = TWELVE_TEMPLES.find(t => t.id === (immersiveTempleId ?? state.currentTempleId)) ?? TWELVE_TEMPLES[0];
  const presenceSelf = supabaseUserId && state.profile ? {
    userId: supabaseUserId,
    name: state.profile.name,
    avatarUrl: state.profile.avatarUrl,
    level: state.level,
    merit: state.merit,
    currentTempleId: immersiveTempleId ?? state.currentTempleId,
    personality: state.profile.personality,
    trainingStyle: state.profile.trainingStyle,
  } : null;
  const { nearbyMonks } = useTemplePresence(presenceSelf);

  // 同步在线玩家名到 useGameState（供 AI 日志交友使用）
  useEffect(() => {
    setNearbyPlayerNames(nearbyMonks.map(m => m.name));
  }, [nearbyMonks, setNearbyPlayerNames]);

  // AI 自动结缘：当检测到附近有其他玩家时自动触发
  const autoEncounterFiredRef = useRef(false);
  useEffect(() => {
    if (
      nearbyMonks.length > 0 &&
      !state.dailyTaskDone &&
      state.dailyLoginDone &&
      !autoEncounterFiredRef.current
    ) {
      autoEncounterFiredRef.current = true;
      doMorningTask();
    }
    // 新的一天重置标记
    if (!state.dailyLoginDone) {
      autoEncounterFiredRef.current = false;
    }
  }, [nearbyMonks, state.dailyTaskDone, state.dailyLoginDone, doMorningTask]);

  // 实时动态
  const [liveTab, setLiveTab] = useState<"activity" | "chat">("activity");
  const [liveH, setLiveH] = useState(480);

  // 角色左右拖拽
  const shrineRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLImageElement>(null);
  const [charX, setCharX] = useState<number | null>(null);
  const drag = useRef({ active: false, startMouseX: 0, startCharX: 0 });

  // 云端数据加载完毕后同步神龛背景（云端进度可能高于本地）
  useEffect(() => {
    if (!isCloudLoading && state.currentTempleId > 0) {
      setImmersiveTempleId(prev => (prev === null ? state.currentTempleId : prev));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCloudLoading]);

  // 神龛高度同步 → 实时动态面板
  useEffect(() => {
    const el = shrineRef.current;
    if (!el) return;
    const updateH = () => { const h = el.offsetHeight; if (h > 0) setLiveH(h); };
    const ro = new ResizeObserver(updateH);
    ro.observe(el);
    updateH();
    return () => ro.disconnect();
  }, []);

  // ── 音乐播放器 ──────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingPlayRef = useRef(false); // 歌曲自然结束后跳轨时继续播放
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  }

  function prevTrack() {
    const audio = audioRef.current;
    const wasPlaying = isPlaying;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    pendingPlayRef.current = wasPlaying;
    setTrackIdx(i => (i - 1 + TRACKS.length) % TRACKS.length);
    setProgress(0);
    if (!wasPlaying) setIsPlaying(false);
  }

  function nextTrack() {
    const audio = audioRef.current;
    const wasPlaying = isPlaying;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    pendingPlayRef.current = wasPlaying;
    setTrackIdx(i => (i + 1) % TRACKS.length);
    setProgress(0);
    if (!wasPlaying) setIsPlaying(false);
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(m => !m);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio * 100);
  }
  // ────────────────────────────────────────────────────────

  function onCharMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    drag.current = {
      active: true,
      startMouseX: e.clientX,
      startCharX: charRef.current?.offsetLeft ?? 0,
    };
  }

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!drag.current.active) return;
      const shrineWidth = shrineRef.current?.offsetWidth ?? 0;
      const charWidth = charRef.current?.offsetWidth ?? 0;
      const delta = e.clientX - drag.current.startMouseX;
      const next = drag.current.startCharX + delta;
      setCharX(Math.max(0, Math.min(next, shrineWidth - charWidth)));
    }
    function onMouseUp() {
      drag.current.active = false;
      document.body.classList.remove("cursor-pressed");
    }
    function onMouseDown() {
      document.body.classList.add("cursor-pressed");
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  // 初始化：加载第一首、注册事件、尝试自动播放
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || TRACKS.length === 0) return;
    audio.volume = 0.35;
    audio.src = TRACKS[0].url;
    audio.load();
    const onTimeUpdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnded = () => {
      // 自然结束 → 跳下一首并继续播
      pendingPlayRef.current = true;
      setProgress(0);
      setTrackIdx(prev => (prev + 1) % TRACKS.length);
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    // 尝试自动播放，被拦截则等待首次点击
    audio.play().then(() => setIsPlaying(true)).catch(() => {
      window.addEventListener("click", () => {
        audioRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
      }, { once: true });
    });
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换曲目时更新 src；若是自然跳轨则自动继续播
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !TRACKS[trackIdx]?.url) return;
    audio.src = TRACKS[trackIdx].url;
    audio.load();
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [trackIdx]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const visibleLogs = state.activityLog.filter((en: any) => {
    if (!en.date) return true;
    if (en.date < todayStr) return true;
    if (en.date > todayStr) return false;
    return en.time <= nowStr;
  });

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      {/* 感应修行记录遮罩 - 防止老玩家首屏闪现注册卡 */}
      {chatState.authState === "authed" && isCloudLoading && (
        <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
          <div className="text-4xl animate-spin">☸️</div>
          <p className="mt-4 text-sm text-[var(--gold)] font-title">梵音感应，正在唤醒修行记录…</p>
        </div>
      )}

      {/* 首次注册卡片：必须有 supabaseUserId（否则保存不了档案） */}
      {chatState.authState === "authed" && chatState.supabaseUserId && !state.profile && !isCloudLoading && <RegisterCard onRegister={doRegister} />}

      {/* 云端连接失败：有认证但无 supabaseUserId */}
      {chatState.authState === "authed" && !chatState.supabaseUserId && !isCloudLoading && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <div className="relative z-10 temple-panel rounded-3xl p-8 text-center max-w-[400px]">
            <div className="text-4xl mb-4">🔗</div>
            <div className="font-title text-2xl text-[var(--gold-deep)] mb-3">云端连接失败</div>
            <p className="text-sm text-foreground/60 mb-6">修行数据无法同步，请检查网络后重试</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-deep)] text-white font-title text-sm shadow-lg hover:brightness-110 transition"
            >
              刷新重试
            </button>
          </div>
        </div>
      )}

      {/* 强制 SecondMe 登录全屏遮罩 */}
      {chatState.authState !== "authed" && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 backdrop-blur-md">
          <div className="w-[400px] h-[360px] temple-panel rounded-3xl overflow-hidden p-6 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60 pointer-events-none" />
            <div className="relative z-10 h-full flex flex-col items-center justify-center">
              <div className="font-title text-3xl text-[var(--gold)] drop-shadow-md mb-8 tracking-widest font-bold">
                入寺须唤起 SecondMe
              </div>
              <div className="w-full bg-black/40 rounded-2xl p-4 ring-1 ring-[var(--gold)]/20 shadow-[0_0_15px_rgba(200,160,80,0.1)]">
                {chatState.authState === "loading" ? (
                  <div className="flex h-[180px] flex-col items-center justify-center">
                    <div className="text-4xl animate-spin mb-4">☸️</div>
                    <span className="animate-pulse text-sm font-medium text-[var(--gold)]">验证灵根中…</span>
                  </div>
                ) : (
                  <div className="h-[180px]">
                    <LoginPanel
                      onOAuth={chatState.startOAuth}
                      onToken={chatState.loginWithToken}
                      errorMsg={chatState.errorMsg}
                      loading={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 氛围叠加：光晕 */}
      <div className="absolute inset-0 temple-noise" />

      {/* 香火动画覆盖层 */}
      {flashState && (
        <div key={flashState.key} className="pointer-events-none absolute inset-0 z-[200] flex items-center justify-center">
          <img src={flashState.src} alt="" className="action-flash h-64 w-auto object-contain" />
        </div>
      )}

      {/* UI Overlay */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-5 py-5">
        {/* ── 解锁布局按钮（顶部中央浮动）── */}
        <div className="absolute left-1/2 top-3 z-50 -translate-x-1/2">
          <button
            onClick={() => {
              const next = !isLayoutUnlocked;
              setIsLayoutUnlocked(next);
              if (next) {
                toast.message("布局已解锁", { description: "拖拽卡片移动位置，右下角拖动可缩放，松手自动保存" });
              } else {
                toast.success("布局已锁定");
              }
            }}
            className="temple-pill flex items-center gap-2 px-4 py-1.5 text-sm font-medium transition-all hover:ring-1 hover:ring-[var(--gold)]/60 active:scale-95"
          >
            {isLayoutUnlocked ? (
              <>
                <Unlock className="h-3.5 w-3.5 text-[var(--cinnabar)]" />
                <span className="text-[var(--cinnabar)]">锁定布局</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-[var(--bronze-green)]" />
                <span className="text-foreground/70">解锁布局</span>
              </>
            )}
          </button>
        </div>

        {/* 顶部行：左侧 HUD + 右侧入口 */}
        <div className="flex items-start justify-between">
        <DraggableCard id="hud" isUnlocked={isLayoutUnlocked}>
        <header className="temple-panel relative flex items-center gap-3 rounded-2xl px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Avatar className="h-9 w-9 ring-2 ring-[var(--bronze-green)]/60">
                <AvatarImage
                  src={state.profile?.avatarUrl ?? "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&w=256&q=60"}
                  alt="玩家头像"
                />
                <AvatarFallback className="bg-black/30">{state.profile?.name?.[0] ?? "僧"}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full border border-[var(--bronze-green)]/60 bg-black/45 text-[10px] font-semibold">
                {state.level}
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-title text-lg leading-none text-[var(--cinnabar)]">
                  {state.profile?.name ?? "小僧"}
                </span>
                <span className="text-[10px] text-foreground/60">Lv.{state.level}</span>
                {state.profile && (
                  <span className="text-[9px] text-foreground/40">{state.profile.personality} · {state.profile.trainingStyle}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Progress
                  value={expPercent}
                  className="h-1.5 w-[110px] bg-foreground/10"
                />
                <span className="text-[10px] text-foreground/60">{expPercent}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="temple-pill flex items-center gap-1.5 px-2 py-1">
              <Sparkles className="h-3 w-3 text-[var(--gold)]" />
              <span className="text-xs text-foreground/70">功德值</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">{formatMerit(state.merit)}</span>
            </div>
            <div className="temple-pill flex items-center gap-1.5 px-2 py-1">
              <Flame className="h-3 w-3 text-[var(--cinnabar)]" />
              <span className="text-xs text-foreground/70">香火钱</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">{state.incenseCoin}</span>
            </div>
            {todayLoginAvailable && (
              <button
                className="temple-pill flex items-center gap-1 px-2 py-1 animate-pulse hover:animate-none"
                onClick={doLogin}
                aria-label="领取今日香火"
              >
                <CalendarCheck className="h-3 w-3 text-[var(--gold)]" />
                <span className="text-[10px] text-[var(--gold)] font-medium">签到</span>
              </button>
            )}
            <button
              className="temple-icon-btn h-8 w-8"
              onClick={() => setTheme(theme === "dark" ? "warm" : "dark")}
              aria-label="切换主题"
              title={theme === "dark" ? "切换暖棕禅香主题" : "切换禅意深色主题"}
            >
              {theme === "dark"
                ? <Sun className="h-4 w-4 text-[var(--bronze-green)]" />
                : <Moon className="h-4 w-4 text-[var(--bronze-green)]" />
              }
            </button>
            <button
              className="temple-icon-btn h-8 w-8"
              onClick={() => comingSoon("设置")}
              aria-label="设置"
            >
              <Settings className="h-4 w-4 text-[var(--bronze-green)]" />
            </button>
          </div>
        </header>
        </DraggableCard>

          {/* 右上角：音乐播放器 + 藏经阁 */}
          <DraggableCard id="top-right" isUnlocked={isLayoutUnlocked}>
          <div className="flex items-center gap-2">
            {/* 音乐播放器 */}
            <div className="temple-panel flex items-center gap-2.5 rounded-2xl px-3 py-2">
              <Music2 className="h-3.5 w-3.5 shrink-0 text-[var(--bronze-green)]" />
              <div className="flex w-[108px] flex-col gap-1.5">
                <div className="flex items-baseline gap-1 overflow-hidden">
                  <span className="font-title truncate text-sm leading-none text-[var(--cinnabar)]">
                    {TRACKS[trackIdx].title}
                  </span>
                  <span className="shrink-0 text-[9px] text-foreground/50">{TRACKS[trackIdx].artist}</span>
                </div>
                {/* 进度条 */}
                <div
                  className="relative h-1 w-full cursor-pointer rounded-full bg-foreground/15"
                  onClick={handleSeek}
                >
                  <div
                    className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              {/* 控制按钮 */}
              <div className="flex items-center gap-0.5">
                <button
                  className="grid h-6 w-6 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground"
                  onClick={prevTrack}
                  aria-label="上一曲"
                >
                  <SkipBack className="h-3 w-3" />
                </button>
                <button
                  className="temple-icon-btn h-7 w-7"
                  onClick={togglePlay}
                  aria-label={isPlaying ? "暂停" : "播放"}
                >
                  {isPlaying
                    ? <Pause className="h-3.5 w-3.5 text-foreground" />
                    : <Play className="h-3.5 w-3.5 text-foreground" />
                  }
                </button>
                <button
                  className="grid h-6 w-6 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground"
                  onClick={nextTrack}
                  aria-label="下一曲"
                >
                  <SkipForward className="h-3 w-3" />
                </button>
                <button
                  className="grid h-6 w-6 place-items-center rounded-full text-foreground/50 transition-colors hover:text-foreground"
                  onClick={toggleMute}
                  aria-label={isMuted ? "取消静音" : "静音"}
                >
                  {isMuted
                    ? <VolumeX className="h-3 w-3" />
                    : <Volume2 className="h-3 w-3" />
                  }
                </button>
              </div>
            </div>
            <button
              className="temple-panel group flex items-center gap-2 rounded-2xl px-3 py-2 text-left"
              onClick={() => comingSoon("藏经阁")}
            >
              <Store className="h-3.5 w-3.5 text-[var(--cinnabar)] transition-transform group-hover:translate-x-0.5" />
              <div>
                <div className="font-title text-base leading-none text-[var(--gold)]">藏经阁</div>
                <div className="mt-0.5 text-[10px] text-foreground/60">商店 · 法器与供品</div>
              </div>
            </button>
          </div>
          </DraggableCard>
        </div>

        {/* 主舞台：神龛之窗 + 两侧图标 */}
        <main className="relative flex flex-1 items-center justify-center">
          {/* Left Sidebar */}
          <nav className="absolute left-0 top-1/2 -translate-y-1/2">
            <DraggableCard id="left-nav" isUnlocked={isLayoutUnlocked}>
            <div className="temple-panel flex flex-col items-center gap-3 rounded-3xl p-3">
              {([
                { label: "寺庙概览", icon: <Landmark     className="h-5 w-5" />, onClick: () => setShowTempleOverview(true) },
                { label: "其他僧人", icon: <Users        className="h-5 w-5" />, onClick: () => { setSelectedMonkId(null); setShowMonksPanel(true); } },
                { label: "今日修行", icon: <CalendarCheck className="h-5 w-5" />, onClick: () => setShowDailyPanel(true) },
                { label: "成就",     icon: <Trophy       className="h-5 w-5" />, onClick: () => { setShowAchievement(true); setAchieveTab("temples"); } },
              ] as const).map(({ label, icon, onClick }) => (
                <button
                  key={label}
                  className="temple-icon-btn h-16 w-16"
                  onClick={onClick}
                  aria-label={label}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[var(--gold)]">{icon}</span>
                    <span className="text-[10px] leading-none tracking-wide text-[var(--gold)]">{label}</span>
                  </div>
                </button>
              ))}
            </div>
            </DraggableCard>
          </nav>

          {/* 神龛之窗 */}
          <DraggableCard id="shrine" isUnlocked={isLayoutUnlocked} resizable>
          <div ref={shrineRef} className="temple-shrine-frame">
            <AnimatePresence>
              {state.level === 0 ? (
                <motion.div
                  key="dreamy-white"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="absolute inset-0 overflow-hidden bg-center bg-cover"
                  style={{ backgroundImage: `url(${startBgImg})` }}
                >
                </motion.div>
              ) : (
                <motion.video
                  key={immersiveTempleId ?? 'zero'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  src={immersiveTempleId !== null && immersiveTempleId !== 0
                    ? (getTempleVideo(TWELVE_TEMPLES.find(t => t.id === immersiveTempleId)?.name ?? '') ?? bgTemple)
                    : bgTemple}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              )}
            </AnimatePresence>
            {/* 角色立绘 — 调整大小改 h-[72%]，位置改 bottom-0 left-[30%] */}
            {!hideCharacter && (
            <img
              ref={charRef}
              src={state.profile?.gender === "男" ? pMan : pWoman}
              alt="角色"
              onMouseDown={onCharMouseDown}
              className={`pointer-events-auto absolute bottom-0 h-[72%] w-auto cursor-grab object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)] select-none active:cursor-grabbing${charX === null ? " left-[30%]" : ""}`}
              style={charX !== null ? { left: charX } : undefined}
            />
            )}
            {/* 同寺庙在线玩家头像 */}
            {!hideOtherMonks && nearbyMonks.map((monk, idx) => (
              <div
                key={monk.id}
                className="pointer-events-auto absolute flex flex-col items-center gap-1 cursor-pointer transition-transform hover:scale-110 drop-shadow-md"
                style={{ bottom: "35%", right: `${15 + idx * 20}%` }}
                onClick={() => {
                  setSelectedMonkId(monk.id);
                  setShowMonksPanel(true);
                }}
              >
                <Avatar className="h-12 w-12 ring-2 ring-[var(--bronze-green)]/60 bg-black/40">
                  <AvatarImage src={monk.avatarUrl} alt={monk.name} />
                  <AvatarFallback className="text-white text-sm">{monk.avatarFallback}</AvatarFallback>
                </Avatar>
                <div className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white/90 whitespace-nowrap">
                  {monk.name}
                </div>
              </div>
            ))}
            {/* 神龛右上角工具栏：隐藏小僧 / 隐藏角色 */}
            <div className="pointer-events-auto absolute top-3 right-3 flex gap-1.5">
              <button
                onClick={() => setHideOtherMonks(h => !h)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition-all"
                title={hideOtherMonks ? "显示其他小僧" : "隐藏其他小僧"}
              >
                {hideOtherMonks ? <EyeOff className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setHideCharacter(h => !h)}
                className="grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/60 hover:text-white hover:bg-black/60 transition-all"
                title={hideCharacter ? "显示角色" : "隐藏角色"}
              >
                {hideCharacter ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          </DraggableCard>

          {/* 右侧：实时动态 */}
          <aside className="absolute right-0 top-1/2 -translate-y-1/2">
            <DraggableCard id="live-panel" isUnlocked={isLayoutUnlocked} resizable>
            <div className="temple-panel relative w-56 flex flex-col rounded-2xl overflow-hidden" style={{ height: liveH }}>
              {/* 标题行 */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <span className="font-title text-base text-[var(--gold)]">实时动态</span>
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--cinnabar)] animate-pulse" />
              </div>
              {/* 标签栏 */}
              <div className="flex gap-1 px-2 pb-2">
                {(["activity", "chat"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setLiveTab(tab)}
                    className={`flex-1 rounded-lg py-1 text-xs font-medium transition-colors ${
                      liveTab === tab
                        ? "bg-[var(--gold)]/20 text-[var(--gold)] ring-1 ring-[var(--gold)]/40"
                        : "text-foreground/50 hover:text-foreground/80"
                    }`}
                  >
                    {tab === "activity" ? "修行动态" : "聊天"}
                  </button>
                ))}
              </div>
              {/* 分割线 */}
              <div className="mx-3 h-px bg-[var(--bronze-green)]/20" />
              {/* 描述区 */}
              {liveTab === "chat" && (
                <p className="px-3 pt-2 pb-1 text-[10px] text-foreground/40 leading-relaxed">
                  您可以发消息与您的 AI 小僧聊天
                </p>
              )}
              {/* 内容区 */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {liveTab === "activity" ? (
                  visibleLogs.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center pt-8">
                      <span className="text-2xl opacity-30">🏯</span>
                      <span className="text-xs text-foreground/30">尚未开始修行<br/>签到后动态将显示于此</span>
                    </div>
                  ) : (
                    <div>
                      {visibleLogs.map((entry, i) => (
                        <div key={entry.id} className="flex gap-2.5">
                          <div className="flex flex-col items-center" style={{ minWidth: 22 }}>
                            <div className="text-base leading-none mt-0.5 shrink-0">{entry.icon}</div>
                            {i < visibleLogs.length - 1 && (
                              <div className="mt-1.5 flex-1 w-px bg-[var(--bronze-green)]/20" style={{ minHeight: 14 }} />
                            )}
                          </div>
                          <div className="pb-3 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-[10px] text-foreground/40 tabular-nums shrink-0">{entry.time}</span>
                              <span className="text-xs font-medium text-foreground/85 leading-snug">{entry.action}</span>
                            </div>
                            <p className="text-[10px] text-foreground/50 mt-0.5 leading-relaxed">{entry.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <SecondMeChat
                    chatState={chatState}
                    currentTemple={currentTemple}
                    nearbyMonks={nearbyMonks}
                    profile={state.profile}
                    merit={state.merit}
                    encounterCount={state.encounterCount}
                  />
                )}
              </div>
            </div>
            </DraggableCard>
          </aside>

        </main>

        {/* Bottom Bar */}
        <footer className="grid grid-cols-12 gap-4">
          {/* Core Buttons */}
          <section className="col-span-6 flex h-[150px] items-center justify-center hidden">
            <div className="temple-panel w-full rounded-2xl px-4 py-4">
              <div className="mb-3 text-center">
                <div className="font-title text-3xl text-[var(--cinnabar)]">今日修行</div>
                <div className="text-xs text-foreground/60">选择一项核心行动</div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <button
                  className="temple-ornate-btn"
                  onClick={() => comingSoon("虔诚祈福")}
                >
                  虔诚祈福
                </button>
                <button
                  className="temple-ornate-btn"
                  onClick={() => comingSoon("在线求签")}
                >
                  在线求签
                </button>
                <button
                  className="temple-ornate-btn"
                  onClick={() => comingSoon("静心打坐")}
                >
                  静心打坐
                </button>
                <button
                  className="temple-ornate-btn"
                  onClick={() => comingSoon("功德投币")}
                >
                  功德投币
                </button>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <DraggableCard id="quick-actions" isUnlocked={isLayoutUnlocked}>
          <section className="temple-panel relative w-fit overflow-hidden rounded-2xl px-4 py-3">
            <div className="flex gap-3 justify-center items-end">
              {/* 点香 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex flex-col items-center gap-1.5 group" onClick={() => { useIncenseCoin("点香"); setFlashState({ src: incenseImg, key: Date.now() }); }} aria-label="点香">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--cinnabar)]/10 ring-1 ring-[var(--cinnabar)]/30 transition-all group-hover:bg-[var(--cinnabar)]/20 group-hover:ring-[var(--cinnabar)]/60 group-active:scale-95">
                      <Flame className="h-5 w-5 text-[var(--cinnabar)]" />
                    </div>
                    <span className="text-[9px] text-foreground/55 leading-none">点香</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">点香 · 消耗 {INCENSE_ACTIONS.点香.cost} 香火钱，经验 +{INCENSE_ACTIONS.点香.exp}</p></TooltipContent>
              </Tooltip>

              {/* 供奉 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex flex-col items-center gap-1.5 group" onClick={() => { useIncenseCoin("供奉"); setFlashState({ src: gongfengImg, key: Date.now() }); }} aria-label="供奉">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--gold)]/10 ring-1 ring-[var(--gold)]/30 transition-all group-hover:bg-[var(--gold)]/20 group-hover:ring-[var(--gold)]/60 group-active:scale-95">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12 Q5 4 12 4 Q19 4 19 12" /><line x1="3" y1="12" x2="21" y2="12" />
                        <path d="M5.5 12 Q4.5 17 7 19.5 Q12 21 17 19.5 Q19.5 17 18.5 12" />
                        <path d="M5.5 14 L3 14 L3 17.5 L5.5 17.5" /><path d="M18.5 14 L21 14 L21 17.5 L18.5 17.5" />
                        <line x1="9" y1="20.5" x2="8" y2="23" /><line x1="15" y1="20.5" x2="16" y2="23" />
                      </svg>
                    </div>
                    <span className="text-[9px] text-foreground/55 leading-none">供奉</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">供奉 · 消耗 {INCENSE_ACTIONS.供奉.cost} 香火钱，经验 +{INCENSE_ACTIONS.供奉.exp}</p></TooltipContent>
              </Tooltip>

              {/* 添香 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex flex-col items-center gap-1.5 group" onClick={() => { useIncenseCoin("添香"); setFlashState({ src: tianxiangImg, key: Date.now() }); }} aria-label="添香">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--bronze-green)]/10 ring-1 ring-[var(--bronze-green)]/30 transition-all group-hover:bg-[var(--bronze-green)]/20 group-hover:ring-[var(--bronze-green)]/60 group-active:scale-95">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--bronze-green)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M8 8 Q7.5 6 8 4" /><path d="M12 7 Q11.5 5 12 3" /><path d="M16 8 Q15.5 6 16 4" />
                        <line x1="8" y1="8" x2="8" y2="18" /><line x1="12" y1="7" x2="12" y2="18" /><line x1="16" y1="8" x2="16" y2="18" />
                        <rect x="5" y="18" width="14" height="3" rx="1" />
                      </svg>
                    </div>
                    <span className="text-[9px] text-foreground/55 leading-none">添香</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">添香 · 消耗 {INCENSE_ACTIONS.添香.cost} 香火钱，经验 +{INCENSE_ACTIONS.添香.exp}</p></TooltipContent>
              </Tooltip>

              {/* 签到 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="flex flex-col items-center gap-1.5 group" onClick={doLogin} aria-label="每日签到">
                    <div className={`grid h-11 w-11 place-items-center rounded-full transition-all group-active:scale-95 ${
                      todayLoginAvailable
                        ? "bg-[var(--cinnabar)]/10 ring-1 ring-[var(--cinnabar)]/50 group-hover:bg-[var(--cinnabar)]/20 group-hover:ring-[var(--cinnabar)]/80"
                        : "bg-foreground/5 ring-1 ring-foreground/15"
                    }`}>
                      <CalendarCheck className={`h-5 w-5 ${todayLoginAvailable ? "text-[var(--cinnabar)]" : "text-foreground/30"}`} />
                    </div>
                    <span className={`text-[9px] leading-none ${todayLoginAvailable ? "text-[var(--cinnabar)]" : "text-foreground/30"}`}>签到</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p className="text-xs">{todayLoginAvailable ? `领取第 ${state.day + 1} 天香火` : "今日已签到"}</p></TooltipContent>
              </Tooltip>
            </div>
          </section>
          </DraggableCard>
        </footer>
      </div>

      {/* 背景音乐 */}
      <audio ref={audioRef} />

      {/* 寺庙概览 — 12座寺庙 */}
      {showTempleOverview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowTempleOverview(false); setSelectedTempleId(null); } }}
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

          <div className="relative z-10 w-[900px] max-w-[96vw] temple-panel rounded-3xl overflow-hidden select-none">

            {selectedTempleId !== null ? (() => {
              // ── 单寺庙详情视图 ─────────────────────────
              const temple = TWELVE_TEMPLES.find(t => t.id === selectedTempleId)!;
              const isUnlocked = state.level >= temple.unlockLevel;
              const templeImg = getTempleImage(temple.name);
              return (
                <>
                  <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                    <img src={templeImg} alt={temple.name} className="absolute inset-0 w-full h-full object-cover object-center" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <button className="absolute top-3 left-4 grid h-7 w-7 place-items-center rounded-full bg-black/40 text-white/60 hover:text-white transition-colors"
                      onClick={() => setSelectedTempleId(null)} aria-label="返回">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button className="absolute top-3 right-4 text-white/60 hover:text-white transition-colors text-2xl leading-none px-1"
                      onClick={() => { setShowTempleOverview(false); setSelectedTempleId(null); }} aria-label="关闭">×</button>
                    {temple.isSpecial && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--gold)]/20 ring-1 ring-[var(--gold)]/50 text-[11px] text-[var(--gold)] tracking-widest">
                        ✦ 特典寺庙 ✦
                      </div>
                    )}
                    <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-title text-4xl leading-none text-[var(--gold)] drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">{temple.name}</div>
                        <div className="mt-1.5 text-sm text-white/70 tracking-widest">{temple.location}</div>
                      </div>
                      <div className="temple-pill flex flex-col items-center gap-0.5 px-4 py-2 shrink-0">
                        <span className="text-[10px] text-foreground/50 tracking-wider">{temple.level}</span>
                        <span className="font-title text-xl text-[var(--gold)] leading-none">Lv. {temple.unlockLevel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <p className="text-xs text-foreground/65 mb-4 leading-relaxed">{temple.desc}</p>
                    {isUnlocked ? (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {[
                          { label: "修行境界", value: temple.level },
                          { label: "解锁等级", value: `Lv. ${temple.unlockLevel}` },
                          { label: "香火状态", value: temple.incenseStatus },
                        ].map(({ label, value }) => (
                          <div key={label} className="temple-pill flex flex-col items-center gap-0.5 py-2.5">
                            <span className="text-[10px] text-foreground/50 tracking-wider">{label}</span>
                            <span className="font-title text-sm text-[var(--gold)] leading-none text-center">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="temple-pill flex items-center gap-3 px-4 py-3 mb-4">
                        <Lock className="h-4 w-4 text-foreground/30 shrink-0" />
                        <div>
                          <div className="text-xs text-foreground/50">此寺庙尚未解锁</div>
                          <div className="text-[10px] text-foreground/35 mt-0.5">需达到等级 {temple.unlockLevel}（当前 Lv.{state.level}）</div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <button className="temple-ornate-btn px-4 py-1.5 text-xs" onClick={() => setSelectedTempleId(null)}>返回列表</button>
                      <div className="flex gap-2">
                        {isUnlocked && (
                          <button
                            className="temple-ornate-btn px-4 py-1.5 text-xs bg-[var(--cinnabar)]/20 ring-1 ring-[var(--cinnabar)]/50 text-white hover:bg-[var(--cinnabar)]/30"
                            onClick={() => { setImmersiveTempleId(temple.id); setCurrentTempleId(temple.id); setShowTempleOverview(false); setSelectedTempleId(null); }}
                          >✦ 到此修行</button>
                        )}
                        <button className="temple-ornate-btn px-4 py-1.5 text-xs" onClick={() => { setShowTempleOverview(false); setSelectedTempleId(null); }}>关闭</button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })() : (
              // ── 12座寺庙列表视图 ──────────────────────
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--bronze-green)]/30">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-[var(--cinnabar)]" />
                    <span className="font-title text-xl text-[var(--gold)]">十二座寺庙</span>
                    <span className="temple-pill px-2.5 py-0.5 text-xs text-[var(--gold)]">
                      已解锁 {TWELVE_TEMPLES.filter(t => state.level >= t.unlockLevel).length} / {TWELVE_TEMPLES.length}
                    </span>
                  </div>
                  <button className="text-foreground/40 hover:text-foreground transition-colors text-2xl leading-none px-1"
                    onClick={() => setShowTempleOverview(false)} aria-label="关闭">×</button>
                </div>

                <div className="px-6 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-foreground/50">修行进度</span>
                    <span className="text-xs text-foreground/50">{TWELVE_TEMPLES.filter(t => state.level >= t.unlockLevel).length} / {TWELVE_TEMPLES.length} 座已解锁</span>
                  </div>
                  <Progress value={(TWELVE_TEMPLES.filter(t => state.level >= t.unlockLevel).length / TWELVE_TEMPLES.length) * 100} className="h-1.5 bg-foreground/10" />
                </div>

                <div className="px-5 pb-6 pt-3 grid grid-cols-4 gap-3 max-h-[500px] overflow-y-auto">
                  {TWELVE_TEMPLES.map(temple => {
                    const isUnlocked = state.level >= temple.unlockLevel;
                    const img = getTempleImage(temple.name);
                    return (
                      <button
                        key={temple.id}
                        className={`relative rounded-2xl overflow-hidden transition-all group p-0 block aspect-square ${
                          isUnlocked
                            ? "hover:ring-2 hover:ring-[var(--gold)]/60 cursor-pointer"
                            : "opacity-45 cursor-default"
                        }`}
                        onClick={() => isUnlocked && setSelectedTempleId(temple.id)}
                        disabled={!isUnlocked}
                        aria-label={isUnlocked ? `查看${temple.name}` : `${temple.name} - 未解锁`}
                      >
                        {isUnlocked ? (
                          <img src={img} alt={temple.name}
                            className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="absolute inset-0 bg-foreground/10 flex items-center justify-center">
                            <Lock className="h-5 w-5 text-foreground/25" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25" />
                        <div className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] grid place-items-center rounded-full bg-black/55 text-[9px] text-white/70 px-1 font-title">
                          {temple.id}
                        </div>
                        {temple.isSpecial && isUnlocked && (
                          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-[var(--gold)]/25 ring-1 ring-[var(--gold)]/50 text-[8px] text-[var(--gold)] leading-none">特典</div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 px-2 pb-2 text-left">
                          <div className={`font-title text-[11px] leading-tight truncate ${isUnlocked ? "text-[var(--gold)]" : "text-white/30"}`}>
                            {isUnlocked ? temple.name : "???"}
                          </div>
                          <div className="text-[9px] text-white/50 leading-none mt-0.5 truncate">
                            {isUnlocked ? temple.level : `Lv.${temple.unlockLevel} 解锁`}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 其他僧人面板 */}
      {showMonksPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowMonksPanel(false); setSelectedMonkId(null); } }}
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

          <div className="relative z-10 w-[520px] max-w-[94vw] temple-panel rounded-3xl overflow-hidden select-none">
            {/* 标题栏 */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--bronze-green)]/30">
              {selectedMonkId && (
                <button
                  className="-ml-1 mr-0.5 grid h-7 w-7 place-items-center rounded-full text-foreground/40 hover:text-[var(--gold)] transition-colors"
                  onClick={() => setSelectedMonkId(null)}
                  aria-label="返回"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <Users className="h-4 w-4 text-[var(--cinnabar)] shrink-0" />
              <span className="font-title text-xl text-[var(--gold)] flex-1">
                {selectedMonkId
                  ? (nearbyMonks.find(m => m.id === selectedMonkId)?.name ?? "") + " · 修行日志"
                  : "今日在寺僧人"}
              </span>
              <button
                className="text-foreground/40 hover:text-foreground transition-colors text-2xl leading-none"
                onClick={() => { setShowMonksPanel(false); setSelectedMonkId(null); }}
                aria-label="关闭"
              >×</button>
            </div>

            {selectedMonkId ? (
              (() => {
                const monk = nearbyMonks.find(m => m.id === selectedMonkId);
                if (!monk) return (
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <span className="text-2xl opacity-30">🏯</span>
                    <span className="text-xs text-foreground/40">该小僧已离开此寺</span>
                    <button className="temple-ornate-btn px-4 py-1.5 text-xs mt-2" onClick={() => setSelectedMonkId(null)}>返回列表</button>
                  </div>
                );
                return (
                  <div>
                    {/* 档案头 */}
                    <div className="flex items-center gap-4 px-6 pt-5 pb-4">
                      <Avatar className="h-16 w-16 ring-2 ring-[var(--gold)]/60 shrink-0">
                        <AvatarImage src={monk.avatarUrl} alt={monk.name} />
                        <AvatarFallback className="bg-black/30 text-lg font-title">{monk.avatarFallback}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-title text-2xl text-[var(--cinnabar)]">{monk.name}</span>
                          <span className="text-xs text-foreground/55">Lv.{monk.level} · {monk.title}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--bronze-green)]/20 text-[var(--bronze-green)] ring-1 ring-[var(--bronze-green)]/30">
                            {monk.status}
                          </span>
                          <span className="text-[11px] text-foreground/45">{monk.statusDesc}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-[var(--gold)]" />
                          <span className="text-[11px] text-foreground/55">功德 {formatMerit(monk.merit)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mx-6 h-px bg-[var(--bronze-green)]/20" />

                    {/* 修行状态 */}
                    <div className="px-6 pt-4 pb-2">
                      <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="h-3.5 w-3.5 text-[var(--gold)]" />
                        <span className="font-title text-sm text-[var(--gold)]">修行信息</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="temple-pill flex flex-col items-center gap-0.5 py-2.5">
                          <span className="text-[10px] text-foreground/50">性格</span>
                          <span className="font-title text-sm text-[var(--gold)]">{monk.personality || "未知"}</span>
                        </div>
                        <div className="temple-pill flex flex-col items-center gap-0.5 py-2.5">
                          <span className="text-[10px] text-foreground/50">修行方式</span>
                          <span className="font-title text-sm text-[var(--gold)]">{monk.trainingStyle || "未知"}</span>
                        </div>
                      </div>
                    </div>

                    {/* 互动按钮 */}
                    <div className="mx-6 h-px bg-[var(--bronze-green)]/20" />
                    <div className="flex gap-2 justify-end px-6 py-4">
                      <button
                        className="temple-ornate-btn flex items-center gap-1.5 px-4 py-2 text-sm"
                        onClick={() => comingSoon("打招呼")}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        打招呼
                      </button>
                      <button
                        className="temple-ornate-btn flex items-center gap-1.5 px-4 py-2 text-sm"
                        onClick={() => comingSoon("观摩修行")}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        观摩修行
                      </button>
                      <button
                        className="temple-ornate-btn flex items-center gap-1.5 px-4 py-2 text-sm"
                        onClick={() => comingSoon("切磋佛法")}
                      >
                        <Swords className="h-3.5 w-3.5" />
                        切磋佛法
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* 僧人列表 */
              <div className="px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-foreground/45">今日 · {currentTemple.name}</span>
                  <span className="temple-pill px-3 py-0.5 text-xs text-[var(--gold)]">{nearbyMonks.length} 位僧侣在场</span>
                </div>
                {nearbyMonks.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <span className="text-2xl opacity-30">🏯</span>
                    <span className="text-xs text-foreground/35">此寺暂无其他小僧<br/>待有缘人到来……</span>
                  </div>
                ) : (
                <div className="space-y-3">
                  {nearbyMonks.map(monk => (
                    <button
                      key={monk.id}
                      className="w-full temple-pill flex items-center gap-4 px-4 py-3 text-left hover:ring-1 hover:ring-[var(--gold)]/50 transition-all group"
                      onClick={() => setSelectedMonkId(monk.id)}
                    >
                      <Avatar className="h-12 w-12 ring-2 ring-[var(--bronze-green)]/40 group-hover:ring-[var(--gold)]/60 transition-[box-shadow] shrink-0">
                        <AvatarImage src={monk.avatarUrl} alt={monk.name} />
                        <AvatarFallback className="bg-black/30 font-title">{monk.avatarFallback}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-title text-lg text-[var(--cinnabar)]">{monk.name}</span>
                          <span className="text-[11px] text-foreground/50">Lv.{monk.level} · {monk.title}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[var(--bronze-green)]/15 text-[var(--bronze-green)] ring-1 ring-[var(--bronze-green)]/25">
                            {monk.status}
                          </span>
                          <span className="text-[11px] text-foreground/40">{monk.statusDesc}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-foreground/25 group-hover:text-[var(--gold)] transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 成就面板 */}
      {showAchievement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAchievement(false); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div className="relative z-10 w-[700px] max-w-[94vw] temple-panel rounded-3xl overflow-hidden select-none">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--bronze-green)]/30">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[var(--gold)]" />
                <span className="font-title text-xl text-[var(--gold)]">修行成就</span>
              </div>
              <button
                className="text-foreground/40 hover:text-foreground transition-colors text-2xl leading-none px-1"
                onClick={() => setShowAchievement(false)}
                aria-label="关闭"
              >×</button>
            </div>

            {/* 顶部统计摘要 */}
            {(() => {
              const unlockedTemples = TWELVE_TEMPLES.filter(t => state.level >= t.unlockLevel);
              return (
                <div className="grid grid-cols-4 gap-3 px-6 pt-4 pb-3">
                  {[
                    { icon: <Landmark className="h-4 w-4 text-[var(--cinnabar)]" />, label: "修行寺庙", value: unlockedTemples.length, unit: "座" },
                    { icon: <BookOpen className="h-4 w-4 text-[var(--gold)]" />, label: "获得禅语", value: unlockedTemples.length, unit: "则" },
                    { icon: <Heart className="h-4 w-4 text-[#e08080]" />, label: "结缘次数", value: state.encounterCount, unit: "次" },
                    { icon: <Sparkles className="h-4 w-4 text-[var(--gold)]" />, label: "S级信物", value: (state.sGradeItems ?? []).length, unit: "件" },
                  ].map(({ icon, label, value, unit }) => (
                    <div key={label} className="temple-pill flex items-center gap-2 px-3 py-3">
                      {icon}
                      <div>
                        <div className="text-[9px] text-foreground/50 tracking-wider">{label}</div>
                        <div className="font-title text-xl leading-none text-[var(--gold)]">{value}<span className="text-xs ml-0.5 text-foreground/60">{unit}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 标签栏 */}
            <div className="flex gap-1.5 px-6 pb-3">
              {([
                { key: "temples",  label: "修行寺庙", icon: <Landmark className="h-3.5 w-3.5" /> },
                { key: "zen",      label: "禅语集",   icon: <BookOpen className="h-3.5 w-3.5" /> },
                { key: "encounter",label: "结缘记录", icon: <Heart    className="h-3.5 w-3.5" /> },
                { key: "relics",   label: "信物",     icon: <Sparkles className="h-3.5 w-3.5" /> },
              ] as const).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setAchieveTab(key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    achieveTab === key
                      ? "bg-[var(--gold)]/20 text-[var(--gold)] ring-1 ring-[var(--gold)]/40"
                      : "text-foreground/50 hover:text-foreground/80"
                  }`}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            <div className="h-px mx-6 bg-[var(--bronze-green)]/20" />

            {/* 内容区 */}
            <div className="px-6 py-4 max-h-[340px] overflow-y-auto">

              {/* ── 修行寺庙 ── */}
              {achieveTab === "temples" && (() => {
                const unlockedTemples = TWELVE_TEMPLES.filter(t => state.level >= t.unlockLevel);
                const lockedTemples   = TWELVE_TEMPLES.filter(t => state.level < t.unlockLevel);
                return (
                  <div className="space-y-4">
                    {unlockedTemples.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {unlockedTemples.map(t => {
                          const img = getTempleImage(t.name);
                          return (
                            <div key={t.id} className="temple-pill overflow-hidden rounded-2xl">
                              <div className="relative w-full aspect-square overflow-hidden">
                                <img src={img} alt={t.name} className="w-full h-full object-cover object-center" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                                {t.isSpecial && (
                                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-[var(--gold)]/25 ring-1 ring-[var(--gold)]/50 text-[9px] text-[var(--gold)] leading-none">特典</div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2">
                                  <span className="font-title text-xs text-[var(--gold)] drop-shadow leading-none block mb-0.5">{t.name}</span>
                                  <span className="text-[9px] text-white/50 block">{t.level}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {lockedTemples.length > 0 && (
                      <div>
                        <div className="mb-2 text-[10px] text-foreground/35 tracking-wider pl-0.5">— 尚待解锁 —</div>
                        <div className="grid grid-cols-4 gap-2">
                          {lockedTemples.map(t => (
                            <div key={t.id} className="temple-pill flex flex-col items-center gap-1 py-3 opacity-40">
                              <Lock className="h-4 w-4 text-foreground/30" />
                              <span className="text-[9px] text-foreground/35">Lv.{t.unlockLevel}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── 禅语集 ── */}
              {achieveTab === "zen" && (() => {
                const unlockedTemples = TWELVE_TEMPLES.filter(t => state.level >= t.unlockLevel);
                const lockedCount     = TWELVE_TEMPLES.filter(t => state.level < t.unlockLevel).length;
                return (
                  <div className="space-y-3">
                    {unlockedTemples.map(t => {
                      const img = getTempleImage(t.name);
                      return (
                        <div key={t.id} className="temple-pill flex gap-3 overflow-hidden">
                          <div className="relative shrink-0 w-16 overflow-hidden rounded-xl" style={{ aspectRatio: "1/1" }}>
                            <img src={img} alt={t.name} className="w-full h-full object-cover object-center" />
                            <div className="absolute inset-0 bg-black/30" />
                          </div>
                          <div className="flex-1 min-w-0 py-2 pr-3">
                            <div className="flex items-baseline gap-1.5 mb-1.5">
                              <span className="font-title text-sm text-[var(--gold)] leading-none">{t.name}</span>
                              {t.isSpecial && <span className="text-[9px] text-[var(--gold)]/60">特典</span>}
                            </div>
                            <div className="flex items-start gap-1.5">
                              <BookOpen className="h-3 w-3 mt-0.5 shrink-0 text-[var(--gold)]/50" />
                              <p className="text-xs text-foreground/80 leading-relaxed">{t.zenQuote}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {lockedCount > 0 && (
                      <div className="temple-pill flex items-center gap-2 px-4 py-3 opacity-50">
                        <Lock className="h-3.5 w-3.5 text-foreground/30 shrink-0" />
                        <span className="text-xs text-foreground/45">还有 {lockedCount} 则禅语等待解锁……</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── 结缘记录 ── */}
              {achieveTab === "encounter" && (
                <div className="space-y-4">
                  <div className="temple-pill flex items-center justify-center gap-4 py-5">
                    <Heart className="h-8 w-8 text-[#e08080]" />
                    <div className="text-center">
                      <div className="font-title text-5xl leading-none text-[var(--gold)]">{state.encounterCount}</div>
                      <div className="mt-1 text-xs text-foreground/50">累计与陌生小僧结缘次数</div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-[var(--bronze-green)]" />
                      <span className="text-xs font-medium text-foreground/70">修行日志中的结缘记录</span>
                    </div>
                    <div className="space-y-2">
                      {state.activityLog
                        .filter(e => e.icon === "🤝" || e.action === "自发交友" || e.action.includes("交友") || e.action === "结缘一位道友")
                        .slice(0, 5)
                        .map((enc, i) => (
                        <div key={i} className="temple-pill flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="grid h-7 w-7 place-items-center rounded-full bg-[var(--gold)]/10 ring-1 ring-[var(--gold)]/20">
                              <span className="text-sm">{enc.icon}</span>
                            </div>
                            <div>
                              <div className="text-sm text-foreground/85">{enc.action}</div>
                              <div className="text-[10px] text-foreground/40 truncate max-w-[200px]">{enc.desc}</div>
                            </div>
                          </div>
                          <span className="text-[10px] text-foreground/40 shrink-0">{enc.time}</span>
                        </div>
                      ))}
                      {state.activityLog.filter(e => e.icon === "🤝" || e.action.includes("交友") || e.action === "结缘一位道友").length === 0 && (
                        <div className="temple-pill flex items-center gap-2 px-4 py-4 opacity-50">
                          <Users className="h-3.5 w-3.5 text-foreground/30 shrink-0" />
                          <span className="text-xs text-foreground/45">暂无结缘记录，签到后 AI 会自动与道友相遇</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── S 级信物 ── */}
              {achieveTab === "relics" && (
                <div>
                  {(state.sGradeItems ?? []).length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-10 opacity-60">
                      <Sparkles className="h-10 w-10 text-foreground/20" />
                      <div className="text-center">
                        <div className="text-sm text-foreground/50">尚未获得 S 级信物</div>
                        <div className="text-[10px] text-foreground/35 mt-1">在寺庙虔诚供奉，有缘者可得珍贵信物</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {(state.sGradeItems ?? []).map((item, i) => (
                        <div key={i} className="temple-pill flex flex-col items-center gap-2 py-4 px-3">
                          <span className="text-3xl">{item.slice(-2)}</span>
                          <span className="text-[11px] text-[var(--gold)] font-title text-center leading-tight">
                            {item.replace(/[\u{1F000}-\u{1FFFF}]|[\u2600-\u27BF]|[\u{1F300}-\u{1F9FF}]/gu, "").trim() || item}
                          </span>
                          <span className="text-[9px] text-foreground/40">S 级信物</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-[var(--bronze-green)]/20 flex justify-end">
              <button
                className="temple-ornate-btn px-5 py-2 text-sm"
                onClick={() => setShowAchievement(false)}
              >关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 今日修行面板 */}
      {showDailyPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDailyPanel(false); }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-[480px] max-w-[94vw] temple-panel rounded-3xl overflow-hidden select-none">

            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--bronze-green)]/30">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-[var(--gold)]" />
                <span className="font-title text-xl text-[var(--gold)]">今日修行</span>
                {state.day > 0 && (
                  <span className="temple-pill px-2 py-0.5 text-[10px] text-foreground/60">第 {state.day} / 5 天</span>
                )}
              </div>
              <button className="text-foreground/40 hover:text-foreground transition-colors text-2xl leading-none px-1"
                onClick={() => setShowDailyPanel(false)} aria-label="关闭">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 玩家档案摘要 */}
              {state.profile && (
                <div className="temple-pill flex items-center gap-3 px-4 py-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden ring-1 ring-[var(--gold)]/40 shrink-0">
                    <img src={state.profile.avatarUrl} alt="头像"
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/bottts/svg?seed=fallback"; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-title text-base text-[var(--cinnabar)]">{state.profile.name}</span>
                      <span className="text-[10px] text-foreground/50">{state.profile.gender} · Lv.{state.level}</span>
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--bronze-green)]/20 text-[var(--bronze-green)]">{state.profile.personality}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--gold)]/15 text-[var(--gold)]">{state.profile.trainingStyle}</span>
                      {state.profile.birthday && (
                        <span className="text-[9px] text-foreground/35">🎂 {state.profile.birthday.slice(5).replace("-", "/")}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* 5天进度 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-foreground/60">五日修行进度</span>
                  <span className="text-xs text-foreground/50">{state.day} / 5 天</span>
                </div>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5].map(d => (
                    <div key={d} className={`flex-1 h-2 rounded-full transition-colors ${d <= state.day ? "bg-[var(--gold)]" : "bg-foreground/15"}`} />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  {[1,2,3,4,5].map(d => (
                    <span key={d} className={`text-[9px] ${d <= state.day ? "text-[var(--gold)]" : "text-foreground/30"}`}>天{d}</span>
                  ))}
                </div>
              </div>

              <div className="h-px bg-[var(--bronze-green)]/20" />

              {/* 每日签到 */}
              <div className="temple-pill flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${state.dailyLoginDone ? "bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/30" : "bg-[var(--cinnabar)]/15 ring-1 ring-[var(--cinnabar)]/40"}`}>
                    <CalendarCheck className={`h-4 w-4 ${state.dailyLoginDone ? "text-[var(--gold)]" : "text-[var(--cinnabar)]"}`} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground/85">每日签到</div>
                    <div className="text-[10px] text-foreground/50 mt-0.5">
                      {state.dailyLoginDone ? "今日已签到 · 领取香火钱 + 经验" : `签到领取：香火钱 +${[10,12,14,16,18][Math.min(state.day, 4)]}，经验 +100`}
                    </div>
                  </div>
                </div>
                <button
                  className={`temple-ornate-btn px-4 py-1.5 text-sm ${state.dailyLoginDone ? "opacity-50 cursor-default" : ""}`}
                  onClick={doLogin} disabled={state.dailyLoginDone}
                >{state.dailyLoginDone ? "已领取" : "领取"}</button>
              </div>

              {/* 结缘任务（仅展示，AI 自动完成） */}
              <div className="temple-pill flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${
                    state.dailyTaskDone ? "bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/30"
                    : "bg-foreground/10 ring-1 ring-foreground/15"
                  }`}>
                    <Users className={`h-4 w-4 ${state.dailyTaskDone ? "text-[var(--gold)]" : "text-foreground/30"}`} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground/85">结缘一位道友</div>
                    <div className="text-[10px] text-foreground/50 mt-0.5">
                      {state.dailyTaskDone ? "今日已结缘 · 修行圆满" : "AI 遇到道友时将自动结缘"}
                    </div>
                  </div>
                </div>
                <button
                  className="temple-ornate-btn px-4 py-1.5 text-sm opacity-50 cursor-default"
                  disabled
                >{state.dailyTaskDone ? "已完成" : "等待中"}</button>
              </div>

              <div className="h-px bg-[var(--bronze-green)]/20" />

              {/* 统计 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "香火钱", value: state.incenseCoin, icon: <Flame className="h-3.5 w-3.5 text-[var(--cinnabar)]" /> },
                  { label: "功德值", value: state.merit, icon: <Sparkles className="h-3.5 w-3.5 text-[var(--gold)]" /> },
                  { label: "结缘次数", value: state.encounterCount, icon: <Heart className="h-3.5 w-3.5 text-[#e08080]" /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="temple-pill flex flex-col items-center gap-1.5 py-3">
                    {icon}
                    <div className="font-title text-xl leading-none text-[var(--gold)]">{value.toLocaleString("zh-CN")}</div>
                    <div className="text-[10px] text-foreground/50">{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-1">
                <button
                  className="flex items-center gap-1 text-[10px] text-foreground/25 hover:text-foreground/50 transition-colors"
                  onClick={() => { resetGame(); setShowDailyPanel(false); }}
                >
                  <RotateCcw className="h-2.5 w-2.5" />重置修行
                </button>
                <button className="temple-ornate-btn px-5 py-2 text-sm" onClick={() => setShowDailyPanel(false)}>关闭</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 奖励弹窗 */}
      <AnimatePresence>
        {state.pendingReward && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="temple-panel flex flex-col items-center w-[340px] rounded-2xl overflow-hidden shadow-[0_0_60px_-15px_rgba(255,215,0,0.25)]"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="w-full px-7 pt-6 pb-2 text-center">
                <div className="text-2xl mb-1">🌟</div>
                <div className="font-title text-xl font-bold text-[var(--gold)] tracking-wide">{state.pendingReward.title}</div>
              </div>
              <div className="px-7 pt-3 pb-2 w-full space-y-2">
                {state.pendingReward.lines.map((line, i) => (
                  <div key={i} className="text-sm text-foreground/80 leading-relaxed text-center">{line}</div>
                ))}
              </div>
              <div className="px-7 pt-4 pb-6">
                <button
                  className="temple-ornate-btn px-8 py-2.5 text-[var(--gold)] border border-[var(--gold)]/50 hover:bg-[var(--gold)]/10 transition-all font-medium"
                  onClick={acknowledgeReward}
                >
                  知道了
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 寺庙解锁弹窗 */}
      <AnimatePresence>
        {state.pendingUnlockedTemples && state.pendingUnlockedTemples.length > 0 && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="temple-panel flex flex-col items-center w-[400px] overflow-hidden rounded-2xl relative shadow-[0_0_80px_-15px_rgba(255,215,0,0.3)]"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              {(() => {
                const templeToUnlock = state.pendingUnlockedTemples[0];
                return (
                  <>
                    <div className="relative w-full h-56">
                      <img 
                        src={getTempleImage(templeToUnlock.name)} 
                        alt={templeToUnlock.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      {/* 标题叠在图片底部 */}
                      <div className="absolute bottom-0 left-0 right-0 p-5 text-center">
                        <div className="text-xs text-white/70 mb-1 tracking-widest">解锁修行第 {templeToUnlock.unlockLevel} 站</div>
                        <div
                          className="font-title text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#FFF8CC] to-[#FFD700] tracking-wide"
                          style={{ textShadow: 'none', filter: 'drop-shadow(0 2px 8px rgba(255,215,0,0.6))' }}
                        >
                          {templeToUnlock.name}
                        </div>
                      </div>
                    </div>
                    <div className="px-7 pt-4 pb-6 flex flex-col items-center gap-4 text-center">
                      <div className="text-sm text-foreground/75 leading-relaxed px-2">
                        {templeToUnlock.desc}
                      </div>
                      <button 
                        className="temple-ornate-btn px-8 py-2.5 text-[var(--gold)] border border-[var(--gold)]/50 hover:bg-[var(--gold)]/10 transition-all font-medium"
                        onClick={() => {
                          setCurrentTempleId(templeToUnlock.id);
                          setImmersiveTempleId(templeToUnlock.id);
                          acknowledgeUnlock(templeToUnlock.id);
                        }}
                      >
                        到此修行
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
