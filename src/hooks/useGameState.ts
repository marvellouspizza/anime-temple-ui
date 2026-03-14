/**
 * useGameState — 寺庙修行游戏核心逻辑
 *
 * 经验公式 (来自总体逻辑.md):
 *   base_exp = 13, growth_rate = 1.5
 *   exp_to_next_level(lv) = floor(13 * lv^1.5)
 *
 * 5天闭环：登录+任务+香火操作 → 累积至等级12
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

// ── 核心参数 ──────────────────────────────────────────────────
const BASE_EXP = 13;
const GROWTH_RATE = 1.5;
export const TOTAL_TEMPLES = 12;
const MAX_DAYS = 5;

/** 每日登录香火钱奖励（天1~5） */
const LOGIN_COIN_REWARDS = [10, 12, 14, 16, 18];
/** 每日登录直接经验奖励 */
const LOGIN_EXP_REWARD = 100;

/** 每日结缘任务香火钱奖励（天1~5） */
const TASK_COIN_REWARDS = [20, 22, 24, 26, 28];
/** 每日结缘任务直接经验（随机范围） */
const TASK_EXP_MIN = 80;
const TASK_EXP_MAX = 120;

/** 特殊事件（信物）触发概率 */
const SPECIAL_EVENT_CHANCE = 0.3;
const SPECIAL_COIN_BONUS = 5;
const SPECIAL_EXP_BONUS = 50;

/** 香火操作：消耗香火钱 → 获得经验（来自总体逻辑.md Python示例） */
export const INCENSE_ACTIONS = {
  点香: { cost: 1, exp: 5 },
  供奉: { cost: 5, exp: 30 },
  添香: { cost: 10, exp: 70 },
} as const;

export type IncenseAction = keyof typeof INCENSE_ACTIONS;

// ── 经验公式 ──────────────────────────────────────────────────
/** 升到下一等级所需经验 */
export function expRequired(level: number): number {
  return Math.floor(BASE_EXP * Math.pow(level, GROWTH_RATE));
}

// 等级1~12所需经验预计算（供显示）
export const EXP_TABLE = Array.from({ length: TOTAL_TEMPLES }, (_, i) =>
  expRequired(i + 1)
);

// ── 12座寺庙 ──────────────────────────────────────────────────
export interface Temple {
  id: number;
  name: string;
  location: string;   // 八字描述
  desc: string;       // 始建于描述
  level: string;      // 修行境界
  unlockLevel: number;
  incenseStatus: string; // 香火状态
  zenQuote: string;      // 禅语
  isSpecial?: boolean;   // 特典寺庙
}

export const TWELVE_TEMPLES: Temple[] = [
  { id: 1,  name: "拉萨 · 雪寺",    location: "雪域高原 · 幽冥雪峰", desc: "始建于吐蕃王朝盛世，红色塔楼映照雪峰，薄雾缭绕，松柏掩映。",               level: "初入雪域", unlockLevel: 1,  incenseStatus: "旺盛 ★★★",  zenQuote: "雪落无声心自静，松柏掩映禅意远，冰清雪冷亦修心。" },
  { id: 2,  name: "银涛 · 海风寺",   location: "碧海潮声 · 棕榈林间", desc: "热带群岛，寺院临海而建，海风拂动彩色屋檐，椰林摇曳。",                     level: "热带初修", unlockLevel: 2,  incenseStatus: "清风 ★★★",  zenQuote: "潮起潮落随缘行，海风轻拂心自在，波光映塔意悠然。" },
  { id: 3,  name: "云栖 · 竹影寺",   location: "江南竹影 · 水雾禅境", desc: "始建于明朝嘉靖年间，竹林环绕，石桥流水，寺院朱门映水。",                   level: "江南初修", unlockLevel: 3,  incenseStatus: "素雅 ★★★",  zenQuote: "竹影摇风风亦静，石桥流水映心境，幽幽庭院修真意。" },
  { id: 4,  name: "烈焰 · 神灯寺",   location: "火焰祭坛 · 烈阳神殿", desc: "始建于古印度王朝，塔尖燃烧红色光芒，浮雕神像炯炯生辉。",                   level: "烈火修行", unlockLevel: 4,  incenseStatus: "炽盛 ★★★★", zenQuote: "火光燃心明照万物，烈焰映塔光影舞，心随火焰净如初。" },
  { id: 5,  name: "金光 · 灵塔寺",   location: "金塔辉煌 · 彩宝闪耀", desc: "始建于蒲甘王朝，金色宝塔耸立，阳光折射彩光，庭院繁花掩映。",               level: "金塔修行", unlockLevel: 5,  incenseStatus: "辉煌 ★★★★", zenQuote: "金塔高耸光照心，宝石闪烁映朝晖，禅意悠远入灵台。" },
  { id: 6,  name: "星影 · 月殿寺",   location: "穹顶星辉 · 沙漠风殿", desc: "始建于沙漠绿洲，蓝色穹顶映星光，马赛克花纹精美，庭院喷泉轻响。",           level: "北非修行", unlockLevel: 6,  incenseStatus: "静雅 ★★★",  zenQuote: "星月无边心怀广，穹顶映光静观天，夜色如梦意长存。" },
  { id: 7,  name: "清迈 · 森林寺",   location: "热带林间 · 佛塔飞檐", desc: "始建于素可泰王朝，佛塔金色闪耀，屋檐彩绘精美，丛林环绕。",                 level: "热林修行", unlockLevel: 7,  incenseStatus: "翠绿 ★★★",  zenQuote: "林深处静心自凉，晨雾轻拂塔影动，禅意清幽入心田。" },
  { id: 8,  name: "峇里岛 · 海风寺", location: "海风椰影 · 宝塔彩檐", desc: "始建于巴厘岛，寺庙临海，彩色飞檐随风摇曳，波光映塔。",                     level: "岛屿修行", unlockLevel: 8,  incenseStatus: "柔风 ★★★",  zenQuote: "海风轻拂心悠然，椰林摇曳映塔光，波光粼粼禅意深。" },
  { id: 9,  name: "京都 · 山寺",     location: "山间清幽 · 红叶古寺", desc: "始建于平安时代，红色鸟居映山间枫叶，石阶通幽，竹林掩映。",                 level: "山林修行", unlockLevel: 9,  incenseStatus: "清幽 ★★★",  zenQuote: "山间红叶映古寺，石阶通幽心自宁，竹影轻摇入禅境。" },
  { id: 10, name: "云光 · 灵洁寺",   location: "云海仙境 · 光影圣殿", desc: "始建于虚空之巅，寺院漂浮于白云之上，阳光穿过穹顶投下彩色光柱。",           level: "初入净土", unlockLevel: 12, incenseStatus: "清雅 ★★★",  zenQuote: "云海之上心净如空，光影流转映塔楼，禅意无边入虚空。", isSpecial: true },
  { id: 11, name: "雪羽 · 苍穹寺",   location: "冰雪圣殿 · 苍穹凌空", desc: "始建于白银盛世，高塔耸入天际，雪羽轻落，风铃随风轻响。",                   level: "初入净土", unlockLevel: 13, incenseStatus: "清雅 ★★",   zenQuote: "雪落苍穹心随天高，风铃轻响映塔影，寂静无声入禅意。", isSpecial: true },
  { id: 12, name: "暗月 · 幽冢寺",   location: "幽冢暗殿 · 月影森罗", desc: "始建于暗影时代，塔楼扭曲阴影交错，幽光笼罩庭院，寒雾低沉。",               level: "幽影修行", unlockLevel: 14, incenseStatus: "幽暗 ★★",   zenQuote: "幽冥暗影心静自明，寒雾低沉映塔影，寂寥深远入禅境。", isSpecial: true },
];

// ── 活动日志 ──────────────────────────────────────────────────
export interface ActivityEntry {
  id: number;
  time: string;
  icon: string;
  action: string;
  desc: string;
}

// ── 游戏状态 ──────────────────────────────────────────────────
export interface GameState {
  level: number;           // 1–12
  exp: number;             // 当前等级已积累经验
  incenseCoin: number;     // 香火钱
  merit: number;           // 功德值（展示用）
  day: number;             // 当前游戏天数 1–5（0=未开始）
  lastLoginDate: string;   // YYYY-MM-DD，最后一次登录日期
  dailyLoginDone: boolean; // 今日登录奖励已领取
  dailyTaskDone: boolean;  // 今日结缘任务已完成
  activityLog: ActivityEntry[];
  encounterCount: number;  // 累计结缘次数
  nextLogId: number;
}

const INITIAL_STATE: GameState = {
  level: 15, // DEV: 解锁全部寺庙
  exp: 0,
  incenseCoin: 99,
  merit: 99000,
  day: 0,
  lastLoginDate: "",
  dailyLoginDone: false,
  dailyTaskDone: false,
  activityLog: [],
  encounterCount: 0,
  nextLogId: 1,
};

const STORAGE_KEY = "anime-temple-game-v2"; // v2: dev unlock all

function loadState(): GameState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...INITIAL_STATE, ...JSON.parse(saved) };
    }
  } catch {
    // 读取失败则用初始值
  }
  return { ...INITIAL_STATE };
}

function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储失败忽略
  }
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function makeEntry(id: number, icon: string, action: string, desc: string): ActivityEntry {
  return { id, time: nowTime(), icon, action, desc };
}

// ── Hook ─────────────────────────────────────────────────────
export function useGameState() {
  const [state, setState] = useState<GameState>(loadState);

  // 状态变更后持久化
  useEffect(() => {
    saveState(state);
  }, [state]);

  // 始终指向最新 state，供 useIncenseCoin 在 setState 外读取当前香火钱
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  /** 内部：处理连续升级 */
  const processLevelUps = useCallback((s: GameState): GameState => {
    let result = { ...s };
    while (result.level < TOTAL_TEMPLES) {
      const needed = expRequired(result.level);
      if (result.exp >= needed) {
        result.exp -= needed;
        result.level += 1;
        result.merit += 200;
        const temple = TWELVE_TEMPLES[result.level - 1];
        toast.success(`✨ 升至等级 ${result.level}！`, {
          description: `解锁新寺庙：${temple.name}`,
        });
      } else {
        break;
      }
    }
    // 满级后经验归零显示满
    if (result.level >= TOTAL_TEMPLES) {
      result.exp = Math.min(result.exp, expRequired(TOTAL_TEMPLES));
    }
    return result;
  }, []);

  /**
   * 每日登录：领取香火钱 + 经验
   * 每个自然日只能领一次，最多第5天
   */
  const doLogin = useCallback(() => {
    const today = getToday();
    setState(prev => {
      if (prev.lastLoginDate === today && prev.dailyLoginDone) {
        toast.info("今日香火已领取", { description: "明日再来，功德常伴" });
        return prev;
      }
      const isNewDay = prev.lastLoginDate !== today;
      const newDay = isNewDay ? Math.min(prev.day + 1, MAX_DAYS) : prev.day;
      const dayIdx = Math.max(0, newDay - 1);
      const coins = LOGIN_COIN_REWARDS[dayIdx] ?? LOGIN_COIN_REWARDS[MAX_DAYS - 1];
      const directExp = LOGIN_EXP_REWARD;

      const logId = prev.nextLogId;
      const entry = makeEntry(
        logId,
        "🏯",
        `第 ${newDay} 天 · 到达寺庙`,
        `登录奖励：香火钱 +${coins}，经验 +${directExp}`
      );

      let ns: GameState = {
        ...prev,
        day: newDay,
        lastLoginDate: today,
        dailyLoginDone: true,
        dailyTaskDone: isNewDay ? false : prev.dailyTaskDone,
        incenseCoin: prev.incenseCoin + coins,
        exp: prev.exp + directExp,
        merit: prev.merit + 50,
        activityLog: [entry, ...prev.activityLog].slice(0, 30),
        nextLogId: logId + 1,
      };
      ns = processLevelUps(ns);

      toast.success(`第 ${newDay} 天 · 香火已领取`, {
        description: `香火钱 +${coins} · 经验 +${directExp}`,
      });
      return ns;
    });
  }, [processLevelUps]);

  /**
   * 结缘修行任务：每日一次，获经验+香火钱
   * 30% 概率触发特殊事件（道友信物）
   */
  const doMorningTask = useCallback(() => {
    setState(prev => {
      if (prev.day === 0) {
        toast.info("请先领取今日香火", { description: "登录后即可开始修行" });
        return prev;
      }
      if (prev.dailyTaskDone) {
        toast.info("今日结缘任务已完成", { description: "明日再与道友结缘" });
        return prev;
      }
      const dayIdx = Math.max(0, prev.day - 1);
      const taskCoins = TASK_COIN_REWARDS[dayIdx] ?? TASK_COIN_REWARDS[MAX_DAYS - 1];
      const taskExp = TASK_EXP_MIN + Math.floor(Math.random() * (TASK_EXP_MAX - TASK_EXP_MIN + 1));

      const entries: ActivityEntry[] = [];
      let totalCoins = taskCoins;
      let totalExp = taskExp;
      let logId = prev.nextLogId;

      // 主任务日志
      entries.push(makeEntry(logId++, "🙏", "结缘一位道友", `完成修行任务，经验 +${taskExp}，香火钱 +${taskCoins}`));

      // 特殊事件：信物赠送
      const hasSpecial = Math.random() < SPECIAL_EVENT_CHANCE;
      if (hasSpecial) {
        totalCoins += SPECIAL_COIN_BONUS;
        totalExp += SPECIAL_EXP_BONUS;
        entries.unshift(
          makeEntry(logId++, "🎁", "道友赠送信物", `特殊事件！额外经验 +${SPECIAL_EXP_BONUS}，香火钱 +${SPECIAL_COIN_BONUS}`)
        );
      }

      let ns: GameState = {
        ...prev,
        dailyTaskDone: true,
        incenseCoin: prev.incenseCoin + totalCoins,
        exp: prev.exp + totalExp,
        merit: prev.merit + 100,
        encounterCount: prev.encounterCount + 1,
        activityLog: [...entries, ...prev.activityLog].slice(0, 30),
        nextLogId: logId,
      };
      ns = processLevelUps(ns);

      toast.success("结缘圆满！", {
        description: hasSpecial
          ? `经验 +${totalExp}（含信物）· 香火钱 +${totalCoins}`
          : `经验 +${taskExp} · 香火钱 +${taskCoins}`,
      });
      return ns;
    });
  }, [processLevelUps]);

  /**
   * 香火操作：点香 / 供奉 / 添香
   * 消耗香火钱，获得经验值
   */
  const useIncenseCoin = useCallback((action: IncenseAction) => {
    const { cost, exp } = INCENSE_ACTIONS[action];
    // 在 setState 外读取当前状态，避免 StrictMode 双调用导致 toast 触发两次
    if (stateRef.current.incenseCoin < cost) {
      toast.error("香火钱不足", { description: `${action}需要 ${cost} 香火钱` });
      return;
    }
    setState(prev => {
      if (prev.incenseCoin < cost) return prev; // 二次保险
      const icons: Record<IncenseAction, string> = { 点香: "🕯️", 供奉: "🏮", 添香: "🌸" };
      const logId = prev.nextLogId;
      const entry = makeEntry(logId, icons[action], action, `消耗香火钱 ${cost}，经验 +${exp}`);
      let ns: GameState = {
        ...prev,
        incenseCoin: prev.incenseCoin - cost,
        exp: prev.exp + exp,
        merit: prev.merit + Math.max(1, Math.floor(exp / 5)),
        activityLog: [entry, ...prev.activityLog].slice(0, 30),
        nextLogId: logId + 1,
      };
      ns = processLevelUps(ns);
      return ns;
    });
    toast.success(`${action}祈愿`, {
      description: React.createElement(
        'span', { className: 'exp-highlight' },
        `经验 +${exp}`
      )
    });
  }, [processLevelUps]);

  /** 重置游戏（调试用） */
  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ ...INITIAL_STATE });
    toast.success("修行已重置", { description: "一切归零，重新修行" });
  }, []);

  // ── 计算属性 ─────────────────────────────────────────────────
  const isMaxLevel = state.level >= TOTAL_TEMPLES;
  const needed = expRequired(isMaxLevel ? TOTAL_TEMPLES : state.level);
  const expPercent = isMaxLevel
    ? 100
    : Math.min(99, Math.floor((state.exp / needed) * 100));

  const todayLoginAvailable = !state.dailyLoginDone;
  const todayTaskAvailable = state.dailyLoginDone && !state.dailyTaskDone;

  return {
    state,
    expPercent,
    expNeeded: needed,
    isMaxLevel,
    todayLoginAvailable,
    todayTaskAvailable,
    doLogin,
    doMorningTask,
    useIncenseCoin,
    resetGame,
  };
}
