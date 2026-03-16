/**
 * useGameState — 寺庙修行游戏核心逻辑
 *
 * 经验公式 (来自总体逻辑.md):
 *   base_exp = 13, growth_rate = 1.5
 *   exp_to_next_level(lv) = floor(13 * lv^1.5)
 *
 * 5天闭环：登录+任务+香火操作 → 累积至等级12
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { streamChat, getToken } from "@/lib/secondme";
import { supabase } from "@/lib/supabase";
import {
  upsertGameState,
  fetchGameState,
  fetchPlayerProfile,
  savePlayerProfile,
  updateCachedToken,
  flushStateBeforeUnload,
} from "@/lib/supabaseGame";

// ── 核心参数 ──────────────────────────────────────────────────
const BASE_EXP = 13;
const GROWTH_RATE = 1.5;
export const TOTAL_TEMPLES = 12;
const MAX_DAYS = 5;
export const MAX_MERIT = 9999;

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

// ── 玩家档案类型 ──────────────────────────────────────────────
export type Personality = "沉稳" | "好奇" | "活泼" | "内向" | "刻苦";
export type TrainingStyle = "打坐派" | "阅读派" | "观景派" | "助人派" | "祈福派";
export type Gender = "男" | "女";

export interface PlayerProfile {
  name: string;
  gender: Gender;
  birthday: string;        // YYYY-MM-DD
  personality: Personality;
  trainingStyle: TrainingStyle;
  avatarUrl: string;
}

// ── AI 修行逻辑常量 ───────────────────────────────────────────
/** S 级信物列表 */
export const S_GRADE_ITEMS = [
  "冰晶法轮✨", "金刚舍利🔮", "玲珑塔✴️",
  "紫金钵盂💫", "梵天宝珠🌟", "三宝神符⭐",
  "苍穹莲台🏵️", "月轮神镜🌕", "般若琉璃珠🔵",
  "雷音鼓⚡",   "慈悲宝冠👑", "无相法器☯️",
];

/** 供奉时 S 级信物掉落概率（每寺庙仅触发一次） */
const S_GRADE_DROP_CHANCE = 0.08;

/** 修行方式 → 行为权重（百分比） */
export const TRAINING_WEIGHTS: Record<TrainingStyle, Record<string, number>> = {
  打坐派: { 打坐: 50, 抄经: 20, 散步: 10, 供奉: 10, 交友: 10 },
  阅读派: { 打坐: 30, 抄经: 50, 散步: 10, 供奉: 10, 交友: 10 },
  观景派: { 打坐: 20, 抄经: 10, 散步: 50, 供奉: 10, 交友: 10 },
  助人派: { 打坐: 20, 抄经: 10, 散步: 20, 供奉: 10, 交友: 40 },
  祈福派: { 打坐: 20, 抄经: 10, 散步: 20, 供奉: 50, 交友:  5 },
};

/** 性格 → 自发交友概率 */
const PERSONALITY_FRIEND_PROB: Record<Personality, number> = {
  沉稳: 0.25,
  好奇: 0.45,
  活泼: 0.65,
  内向: 0.15,
  刻苦: 0.35,
};

/** 寺庙中的 NPC 道友 */
const NPC_MONKS_DATA = [
  { name: "空心小僧", gift: "小卷轴" },
  { name: "悟尘行者", gift: "香火石" },
  { name: "慧光禅子", gift: "金线绳" },
  { name: "无为居士", gift: "竹片符" },
  { name: "明镜禅师", gift: "净水瓶" },
  { name: "云游和尚", gift: "禅豆粒" },
  { name: "普度法师", gift: "莲花印" },
  { name: "静虚居士", gift: "木鱼片" },
];

/** 交友互动类型 */
const FRIEND_INTERACTIONS = ["问候致礼", "互赠禅语", "共同打坐", "一起散步", "分享经文"];

/** 修行行为描述模板 */
const ACTION_DESCS: Record<string, string[]> = {
  打坐: [
    "静坐庭院古柏之下，合目调息，万籁俱寂，心境如镜。",
    "禅堂端坐，呼吸绵长深远，念念归一，渐入定境。",
    "晨光初照，独坐石台，鸟鸣声中默念心经，清净无垠。",
    "古树浓荫之下冥想，落叶无声，心境豁然，尘念皆消。",
    "面对山水打坐，天地之气充盈，身心合一，妙不可言。",
  ],
  抄经: [
    "研墨执笔，逐字抄录《心经》，禅意随墨迹流淌。",
    "晨课时分，端坐案前，虔诚临摹古帖，字字沉静。",
    "细读《金刚经》，字句间禅意深远，颇有感悟。",
    "借窗外月色抄录经文，笔尖沙沙作响，如与古圣对话。",
    "诵《楞严经》，觉每字每句皆含妙义，悟性日进。",
  ],
  散步: [
    "漫步寺庙回廊，青砖石板踏出悠扬足音，心旷神怡。",
    "徜徉庭院，檐角飞燕，廊下落花，一派幽雅禅境。",
    "雨后游廊闲步，翠竹摇风，泥土气息清新，心情舒阔。",
    "穿行竹林小径，风过竹影相伴，步履从容。",
    "驻足眺望远山，暮霭斜阳，天际彩云如画，思绪飘远。",
  ],
  供奉: [
    "虔诚拈香供奉，香烟袅袅升腾，心中默念祈愿。",
    "双手合十，于供台前恭敬奉上香火，誓愿护众生安宁。",
    "三支清香，恭立佛前，烟雾绕绕，心生莫名宁静。",
    "供奉鲜花香火，庄严佛像前心生敬畏，杂念皆息。",
    "点燃祈愿香，轻声诵经，梵音与香雾交织，心澄如水。",
  ],
  交友: [
    "与道友偶遇，互施合十礼，分享近日修行心得。",
    "结识新道友，同游庭院，互赠吉祥小物，笑声朗朗。",
    "与道友闲谈间共赏落日，互换禅语，心意相通。",
    "道友邀共读手抄经卷，席地而坐，禅趣盎然。",
    "偶遇同修之友，相约共坐禅定，心领神会，相视一笑。",
  ],
};

// ── 工具函数 ─────────────────────────────────────────────────
function pickWeighted(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [key, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return key;
  }
  return Object.keys(weights)[0];
}

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isBirthdayToday(birthday: string): boolean {
  if (!birthday) return false;
  const today = new Date();
  const bday = new Date(birthday);
  return today.getMonth() === bday.getMonth() && today.getDate() === bday.getDate();
}

/** 根据玩家档案生成当天 AI 修行日志 */
function generateAgentLogs(
  profile: PlayerProfile,
  templeName: string,
  templeId: number,
  templeItemsCollected: number[],
  startLogId: number,
  nearbyPlayerNames?: string[],
): {
  entries: ActivityEntry[];
  incenseCoinDelta: number;
  meritDelta: number;
  newSGradeItems: string[];
  newTempleItemIds: number[];
  hasFriendEncounter: boolean;
} {
  const weights = TRAINING_WEIGHTS[profile.trainingStyle];
  const friendProb = PERSONALITY_FRIEND_PROB[profile.personality];
  const count = 144; // 生成一整天的动态（每10分钟一条，最大支持24小时）

  let baseTime = new Date();
  const todayDate = baseTime.getDate();
  const times: string[] = [];
  for (let i = 0; i < count; i++) {
    const minsToAdd = 10; // 固定10分钟显示一次动态
    const nextTime = new Date(baseTime.getTime() + minsToAdd * 60000);
    if (nextTime.getDate() !== todayDate) {
      break; 
    }
    baseTime = nextTime;
    times.push(`${String(baseTime.getHours()).padStart(2, "0")}:${String(baseTime.getMinutes()).padStart(2, "0")}`);
  }

  const entries: ActivityEntry[] = [];
  let coinDelta = 0;
  let meritDelta = 0;
  let hasFriendEncounter = false;
  const newSGradeItems: string[] = [];
  const newTempleItemIds = [...templeItemsCollected];
  let logId = startLogId;
  const todayStr = getToday();

  const STATE_DESCS = [
    "空气很新鲜啊~",
    "渐入佳境，心境澄明。",
    "周遭一片静谧，神清气爽。",
    "不觉时光流逝，怡然自得。",
    "微风拂过，带来阵阵禅意。",
    "沉浸其中，物我两忘。",
    "专注当下，颇有领悟。"
  ];

  let prevAction = "";

  for (const time of times) {
    let action = pickWeighted(weights);

    // 无真实玩家在场时，交友直接改为打坐（不使用 NPC）
    if (action === "交友" && (!nearbyPlayerNames || nearbyPlayerNames.length === 0)) {
      action = "打坐";
    }
    // 交友需通过性格概率检查，否则改为打坐
    if (action === "交友" && Math.random() > friendProb) {
      action = "打坐";
    }

    let icon: string;
    let desc: string;
    let effectText = "";

    switch (action) {
      case "打坐":
        icon = "🧘";
        desc = randItem(ACTION_DESCS.打坐);
        break;
      case "抄经":
        icon = "📖";
        desc = randItem(ACTION_DESCS.抄经);
        break;
      case "散步":
        icon = "🌿";
        desc = randItem(ACTION_DESCS.散步);
        break;
      case "供奉": {
        icon = "🕯️";
        desc = randItem(ACTION_DESCS.供奉);
        const supplyMerit = 3 + Math.floor(Math.random() * 8);
        meritDelta += supplyMerit;
        effectText = `功德 +${supplyMerit}`;

        // S 级信物掉落检查（每寺庙仅触发一次）
        if (!newTempleItemIds.includes(templeId) && Math.random() < S_GRADE_DROP_CHANCE) {
          const item = randItem(S_GRADE_ITEMS);
          newSGradeItems.push(item);
          newTempleItemIds.push(templeId);
          desc += `✦ 供奉感应，获得 S 级信物：${item}！`;
        }
        break;
      }
      case "交友": {
        // 此处必有真实玩家在场（无人时已在上方 fallback 为打坐）
        icon = "🤝";
        hasFriendEncounter = true;
        const monkName = randItem(nearbyPlayerNames!);
        const interaction = randItem(FRIEND_INTERACTIONS);
        const baseDesc = randItem(ACTION_DESCS.交友);
        const friendCoins = 1 + Math.floor(Math.random() * 5);
        const friendMerit = 1 + Math.floor(Math.random() * 3);
        coinDelta += friendCoins;
        meritDelta += friendMerit;
        desc = `${baseDesc} 与道友「${monkName}」${interaction}。`;
        effectText = `香火钱 +${friendCoins}，功德 +${friendMerit}`;
        break;
      }
      default:
        icon = "🏯";
        desc = "在寺庙中修行。";
    }

    if (action === prevAction) {
      desc += `（${randItem(STATE_DESCS)}）`;
    }
    prevAction = action;

    const fullDesc = effectText ? `${desc}（${effectText}）` : desc;
    entries.push({ id: logId++, time, date: todayStr, icon, action, desc: fullDesc });
  }

  return { entries, incenseCoinDelta: coinDelta, meritDelta, newSGradeItems, newTempleItemIds, hasFriendEncounter };
}

// ── 经验公式 ──────────────────────────────────────────────────
/** 升到下一等级所需经验 */
export function expRequired(level: number): number {
  if (level === 0) return 100; // 0级升1级需要100经验（恰好等于首次签到经验）
  return Math.floor(BASE_EXP * Math.pow(level, GROWTH_RATE));
}

// 等级1~12所需经验预计算（供显示）
export const EXP_TABLE = Array.from({ length: TOTAL_TEMPLES + 1 }, (_, i) =>
  expRequired(i)
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
  date?: string;
  icon: string;
  action: string;
  desc: string;
}

export interface ScheduledLog extends ActivityEntry {
  triggerTimeStr: string;
  coinDelta: number;
  meritDelta: number;
  newSGradeItem?: string;
  templeId?: number;
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
  scheduledLogs: ScheduledLog[];
  encounterCount: number;  // 累计结缘次数
  nextLogId: number;
  // ── 新增：玩家档案 ──
  profile: PlayerProfile | null;
  currentTempleId: number;       // 当前所在寺庙 (0 表示未解锁任何寺庙)
  templeItemsCollected: number[]; // 已触发 S 级信物的寺庙 ID
  sGradeItems: string[];          // 已收集的 S 级信物名称
  agentLogsGeneratedDay: string;  // 已生成 AI 日志的日期，避免重复生成
  pendingUnlockedTemples: Temple[]; // 待展示的解锁寺庙弹窗列表
  pendingReward: { title: string; lines: string[] } | null; // 待展示的奖励弹窗
}

const INITIAL_STATE: GameState = {
  level: 0,
  exp: 0,
  incenseCoin: 0,
  merit: 0,
  day: 0,
  lastLoginDate: "",
  dailyLoginDone: false,
  dailyTaskDone: false,
  activityLog: [],
  scheduledLogs: [],
  encounterCount: 0,
  nextLogId: 1,
  profile: null,
  currentTempleId: 0,
  templeItemsCollected: [],
  sGradeItems: [],
  agentLogsGeneratedDay: "",
  pendingUnlockedTemples: [],
  pendingReward: null,
};

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function makeEntry(id: number, icon: string, action: string, desc: string): ActivityEntry {
  return { id, time: nowTime(), date: getToday(), icon, action, desc };
}

// ── Hook ─────────────────────────────────────────────────────
export function useGameState(userId: string | null = null) {
  const [state, setState] = useState<GameState>({ ...INITIAL_STATE });

  /** 云端数据是否已加载，防止在加载完成前就显示页面 */
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);

  // 统一管理待执行的防抖同步计时器
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 始终指向最新 state，供 useIncenseCoin 在 setState 外读取当前香火錢
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const persistStateNow = useCallback((nextState: GameState) => {
    stateRef.current = nextState;
    if (!userId || !isCloudLoaded) return;
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    upsertGameState(userId, nextState).catch((error) => {
      console.error("[Supabase] 立即存档失败:", error);
      toast.error("云端存档失败", {
        description: error instanceof Error ? error.message : "请检查 Supabase 表结构、权限配置或网络状态",
      });
    });
  }, [isCloudLoaded, userId]);

  // ── 订阅 Supabase access token，供 beforeunload keepalive 保存使用 ─
  useEffect(() => {
    if (!supabase) return;
    // 初始化时获取一次
    supabase.auth.getSession().then(({ data }) => {
      updateCachedToken(data.session?.access_token ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      updateCachedToken(session?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── 页面隐藏/卸载前强制写入，避免最后一次操作丢失 ─────────────
  useEffect(() => {
    if (!userId || !isCloudLoaded) return;
    const flushPendingState = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      flushStateBeforeUnload(userId, stateRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPendingState();
      }
    };
    window.addEventListener("beforeunload", flushPendingState);
    window.addEventListener("pagehide", flushPendingState);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushPendingState);
      window.removeEventListener("pagehide", flushPendingState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, isCloudLoaded]);

  // 最新的在线玩家名列表（由外部通过 setNearbyPlayerNames 更新）
  const nearbyNamesRef = useRef<string[]>([]);
  const setNearbyPlayerNames = useCallback((names: string[]) => {
    nearbyNamesRef.current = names;
  }, []);

  // ── 首次获到 userId 时，从 Supabase 加载数据────────────────
  useEffect(() => {
    if (!userId) return;

    Promise.all([
      fetchGameState(userId),
      fetchPlayerProfile(userId),
    ]).then(([cloudState, cloudProfile]) => {
      setState(() => {
        const next = { ...INITIAL_STATE };

        // 直接使用 Supabase 数据（localStorage 已移除）
        if (cloudState) {
          next.level = cloudState.level;
          next.exp = cloudState.exp;
          next.incenseCoin = cloudState.incense_coin;
          next.merit = cloudState.merit;
          next.day = cloudState.day;
          next.lastLoginDate = cloudState.last_login_date ?? "";
          next.dailyLoginDone = cloudState.daily_login_done;
          next.dailyTaskDone = cloudState.daily_task_done;
          next.encounterCount = cloudState.encounter_count;
          next.currentTempleId = cloudState.current_temple_id;
          next.templeItemsCollected = cloudState.temple_items_collected ?? [];
          next.sGradeItems = cloudState.s_grade_items ?? [];
          next.agentLogsGeneratedDay = cloudState.agent_logs_generated_day ?? "";
          next.activityLog = (cloudState.activity_log ?? []) as ActivityEntry[];
          next.nextLogId = cloudState.next_log_id ?? 1;
        }

        if (cloudProfile) {
          next.profile = cloudProfile as PlayerProfile;
        }

        stateRef.current = next;

        return next;
      });

      setIsCloudLoaded(true);
    }).catch(e => {
      console.error("[Supabase] 加载游戏数据失败:", e);
      setIsCloudLoaded(true); // 即使失败也要解除加载状态
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── 防抖云端同步（用于功德点击等高频更新）───────────────────
  useEffect(() => {
    if (!userId || !isCloudLoaded) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      upsertGameState(userId, state).catch((error) => {
        console.error("[Supabase] 防抖存档失败:", error);
      });
      syncTimerRef.current = null;
    }, 1000);
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, userId, isCloudLoaded]);

  /** 内部：处理连续升级 */
  const processLevelUps = useCallback((s: GameState): GameState => {
    let result = { ...s };
    result.pendingUnlockedTemples = [...(result.pendingUnlockedTemples || [])];
    while (result.level < TOTAL_TEMPLES) {
      const needed = expRequired(result.level);
      if (result.exp >= needed) {
        result.exp -= needed;
        result.level += 1;
        result.merit += 200;
        const temple = TWELVE_TEMPLES[result.level - 1];
        result.pendingUnlockedTemples.push(temple);
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
   * 每日登录：领取香火钱 + 经验，并自动生成 AI 修行日志
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

      let logId = prev.nextLogId;
      const loginEntry = makeEntry(
        logId++,
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
        activityLog: [loginEntry, ...prev.activityLog].slice(0, 200),
        nextLogId: logId,
      };

      // 生日奖励
      if (prev.profile && isBirthdayToday(prev.profile.birthday)) {
        const bdayCoins = 20;
        const bdayMerit = 100;
        ns.incenseCoin += bdayCoins;
        ns.merit += bdayMerit;
        const bdayEntry = makeEntry(logId++, "🎂", "今日生辰 · 寺庙贺礼", `生日快乐！香火钱 +${bdayCoins}，功德 +${bdayMerit}`);
        ns.activityLog = [bdayEntry, ...ns.activityLog].slice(0, 200);
        ns.nextLogId = logId;
        toast.success("🎂 生辰快乐！", { description: `寺庙赐予生日贺礼：香火钱 +${bdayCoins}，功德 +${bdayMerit}` });
      }

      // 每日 AI 修行日志（新的一天，且有玩家档案）
      if (prev.profile && isNewDay && ns.agentLogsGeneratedDay !== today) {
        const currentTemple = TWELVE_TEMPLES.find(t => t.id === ns.currentTempleId) || TWELVE_TEMPLES[0];
        const agentResult = generateAgentLogs(
          prev.profile,
          currentTemple.name,
          currentTemple.id,
          ns.templeItemsCollected,
          ns.nextLogId,
          nearbyNamesRef.current.length > 0 ? nearbyNamesRef.current : undefined,
        );
        ns.activityLog = [...[...agentResult.entries].reverse(), ...ns.activityLog].slice(0, 200);
        ns.incenseCoin = Math.max(0, ns.incenseCoin + agentResult.incenseCoinDelta);
        ns.merit += agentResult.meritDelta;
        ns.templeItemsCollected = agentResult.newTempleItemIds;
        ns.sGradeItems = [...(ns.sGradeItems ?? []), ...agentResult.newSGradeItems];
        ns.nextLogId += agentResult.entries.length;
        ns.agentLogsGeneratedDay = today;

        if (agentResult.newSGradeItems.length > 0) {
          toast.success("✦ 供奉感应！获得 S 级信物", {
            description: agentResult.newSGradeItems.join("，"),
          });
        }

        // AI 交友日志即为结缘行为，自动完成结缘任务
        if (agentResult.hasFriendEncounter && !ns.dailyTaskDone) {
          const taskDayIdx = Math.max(0, ns.day - 1);
          const taskCoins = TASK_COIN_REWARDS[taskDayIdx] ?? TASK_COIN_REWARDS[MAX_DAYS - 1];
          const taskExp = TASK_EXP_MIN + Math.floor(Math.random() * (TASK_EXP_MAX - TASK_EXP_MIN + 1));
          let totalCoins = taskCoins;
          let totalExp = taskExp;
          const taskEntry = makeEntry(ns.nextLogId++, "🙏", "结缘一位道友", `AI 修行中与道友结缘，经验 +${taskExp}，香火钱 +${taskCoins}`);
          const taskEntries: ActivityEntry[] = [taskEntry];
          const hasSpecial = Math.random() < SPECIAL_EVENT_CHANCE;
          if (hasSpecial) {
            totalCoins += SPECIAL_COIN_BONUS;
            totalExp += SPECIAL_EXP_BONUS;
            taskEntries.unshift(makeEntry(ns.nextLogId++, "🎁", "道友赠送信物", `特殊事件！额外经验 +${SPECIAL_EXP_BONUS}，香火钱 +${SPECIAL_COIN_BONUS}`));
          }
          ns.dailyTaskDone = true;
          ns.encounterCount += 1;
          ns.incenseCoin += totalCoins;
          ns.exp += totalExp;
          ns.merit += 100;
          ns.activityLog = [...taskEntries, ...ns.activityLog].slice(0, 200);
        }
      }

      ns = processLevelUps(ns);

      // 收集奖励信息到弹窗
      const rewardLines: string[] = [
        `🪙 香火钱 +${coins}`,
        `✨ 经验 +${directExp}`,
        `🙏 功德 +50`,
      ];
      if (ns.dailyTaskDone && isNewDay) {
        rewardLines.push(`🤝 AI 已自动结缘道友`);
      }
      if (ns.merit > prev.merit + 50) {
        // 有生日奖励
        rewardLines.push(`🎂 生辰贺礼：香火钱 +20，功德 +100`);
      }
      ns.pendingReward = { title: `第 ${newDay} 天 · 香火已领取`, lines: rewardLines };

      persistStateNow(ns);

      return ns;
    });
  }, [persistStateNow, processLevelUps]);

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
        activityLog: [...entries, ...prev.activityLog].slice(0, 200),
        nextLogId: logId,
      };
      ns = processLevelUps(ns);

      // 收集奖励信息到弹窗
      const rewardLines: string[] = [
        `🪙 香火钱 +${taskCoins}`,
        `✨ 经验 +${taskExp}`,
        `🙏 功德 +100`,
      ];
      if (hasSpecial) {
        rewardLines.push(`🎁 道友赠送信物：经验 +${SPECIAL_EXP_BONUS}，香火钱 +${SPECIAL_COIN_BONUS}`);
      }
      ns.pendingReward = { title: "结缘圆满！", lines: rewardLines };

      persistStateNow(ns);

      return ns;
    });
  }, [persistStateNow, processLevelUps]);

  /**
   * 香火操作：点香 / 供奉 / 添香
   * 消耗香火钱，获得经验值；供奉时有概率掉落 S 级信物（每寺庙仅一次）
   */
  const useIncenseCoin = useCallback((action: IncenseAction) => {
    const { cost, exp } = INCENSE_ACTIONS[action];
    if (stateRef.current.incenseCoin < cost) {
      toast.error("香火钱不足", {
        description: `${action}需要 ${cost} 香火钱`,
        classNames: { description: 'exp-highlight' }
      });
      return;
    }
    setState(prev => {
      if (prev.incenseCoin < cost) return prev;
      const icons: Record<IncenseAction, string> = { 点香: "🕯️", 供奉: "🏮", 添香: "🌸" };
      const logId = prev.nextLogId;

      let descExtra = `消耗香火钱 ${cost}，经验 +${exp}`;
      let newSGradeItems = prev.sGradeItems ?? [];
      let newTempleItems = prev.templeItemsCollected ?? [];

      // 供奉时检查 S 级信物掉落
      if (action === "供奉" && !newTempleItems.includes(prev.currentTempleId) && Math.random() < S_GRADE_DROP_CHANCE) {
        const item = randItem(S_GRADE_ITEMS);
        newSGradeItems = [...newSGradeItems, item];
        newTempleItems = [...newTempleItems, prev.currentTempleId];
        descExtra += ` ✦ 获得 S 级信物：${item}`;
        toast.success("✦ 供奉感应！获得 S 级信物", { description: item });
      }

      const entry = makeEntry(logId, icons[action], action, descExtra);
      let ns: GameState = {
        ...prev,
        incenseCoin: prev.incenseCoin - cost,
        exp: prev.exp + exp,
        merit: prev.merit + Math.max(1, Math.floor(exp / 5)),
        sGradeItems: newSGradeItems,
        templeItemsCollected: newTempleItems,
        activityLog: [entry, ...prev.activityLog].slice(0, 200),
        nextLogId: logId + 1,
      };
      ns = processLevelUps(ns);
      persistStateNow(ns);
      return ns;
    });
    toast.success(`${action}祈愿`, {
      description: `经验 +${exp}`,
      classNames: { description: 'exp-highlight' }
    });
  }, [persistStateNow, processLevelUps]);

  /** 注册玩家档案（首次进入游戏） */
  const doRegister = useCallback((profile: PlayerProfile) => {
    setState(() => {
      const ns: GameState = {
        ...INITIAL_STATE,
        profile,
        incenseCoin: 0,
        merit: 0,
      };
      persistStateNow(ns);
      toast.success(`欢迎，${profile.name}！✨`, {
        description: `性格：${profile.personality} · 修行方式：${profile.trainingStyle}`,
      });
      return ns;
    });
    // 同步档案到云端
    if (userId) {
      savePlayerProfile(userId, profile).catch(console.error);
    }
  }, [persistStateNow, userId]);

  /** 重置游戏（调试用） */
  const resetGame = useCallback(() => {
    const fresh = { ...INITIAL_STATE };
    stateRef.current = fresh;
    setState(fresh);
    // 立即同步到云端，避免重新加载后恢复旧数据
    if (userId) {
      persistStateNow(fresh);
    }
    toast.success("修行已重置", { description: "一切归零，重新修行" });
  }, [persistStateNow, userId]);

  /** 速通：香火钱加满 9999 */
  const speedRun = useCallback(() => {
    setState(prev => {
      const ns = { ...prev, incenseCoin: 9999 };
      persistStateNow(ns);
      return ns;
    });
    toast.success("速通模式", { description: "香火钱已加满 9999" });
  }, [persistStateNow]);

  /** 确认解锁（关闭新寺庙解锁弹窗） */
  const acknowledgeUnlock = useCallback((templeId: number) => {
    setState(prev => ({
      ...prev,
      pendingUnlockedTemples: prev.pendingUnlockedTemples.filter(t => t.id !== templeId)
    }));
  }, []);

  /** 确认奖励（关闭奖励弹窗） */
  const acknowledgeReward = useCallback(() => {
    setState(prev => ({ ...prev, pendingReward: null }));
  }, []);

  // ── 计算属性 ─────────────────────────────────────────────────
  const isMaxLevel = state.level >= TOTAL_TEMPLES;
  const needed = expRequired(isMaxLevel ? TOTAL_TEMPLES : state.level);
  const expPercent = isMaxLevel
    ? 100
    : Math.min(99, Math.floor((state.exp / needed) * 100));

  const todayLoginAvailable = !state.dailyLoginDone;
  const todayTaskAvailable = state.dailyLoginDone && !state.dailyTaskDone;

  const isCloudLoading = !!userId && !isCloudLoaded;

  return {
    state,
    expPercent,
    expNeeded: needed,
    isMaxLevel,
    isCloudLoading,
    todayLoginAvailable,
    todayTaskAvailable,
    doLogin,
    doMorningTask,
    useIncenseCoin,
    doRegister,
    resetGame,
    speedRun,
    acknowledgeUnlock,
    acknowledgeReward,
    setCurrentTempleId: (id: number) => setState(prev => ({ ...prev, currentTempleId: id })),
    setNearbyPlayerNames,
    tapMerit: () => setState(prev => {
      if (prev.merit >= MAX_MERIT) return prev;
      const newMerit = prev.merit + 1;
      if (newMerit === MAX_MERIT) {
        return {
          ...prev,
          merit: newMerit,
          incenseCoin: prev.incenseCoin + 100,
          pendingReward: {
            title: "✦ 功德圆满 ✦",
            lines: [
              "🙏 功德值已达最高境界 9999！",
              "🪙 获得香火钱 +100 作为供奉嘉奖",
            ],
          },
        };
      }
      return { ...prev, merit: newMerit };
    }),
  };
}
