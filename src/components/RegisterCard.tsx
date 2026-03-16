/**
 * RegisterCard — 初始注册卡片
 * 玩家首次进入游戏时填写：性别、昵称、头像、生日、性格、修行方式
 */
import { useState, useRef } from "react";
import type { Gender, Personality, PlayerProfile, TrainingStyle } from "@/hooks/useGameState";
import { TRAINING_WEIGHTS } from "@/hooks/useGameState";
import pManImg from "@/assets/p-man.png";
import pWomanImg from "@/assets/p-woman.png";
import pManAvatar from "@/assets/p-man_头像.png";
import pWomanAvatar from "@/assets/p-woman_头像.png";

interface Props {
  onRegister: (profile: PlayerProfile) => void;
}

const PERSONALITIES: { value: Personality; label: string; desc: string; emoji: string }[] = [
  { value: "沉稳", label: "沉稳", desc: "心如止水，稳重厚实", emoji: "🌊" },
  { value: "好奇", label: "好奇", desc: "探索未知，心怀好奇", emoji: "🔍" },
  { value: "活泼", label: "活泼", desc: "热情开朗，广结善缘", emoji: "☀️" },
  { value: "内向", label: "内向", desc: "独处静思，深沉内敛", emoji: "🌙" },
  { value: "刻苦", label: "刻苦", desc: "勤勉刻苦，精进不息", emoji: "🔥" },
];

const TRAINING_STYLES: { value: TrainingStyle; label: string; desc: string; emoji: string }[] = [
  { value: "打坐派", label: "打坐派", desc: "以坐禅冥想为主，心境空灵", emoji: "🧘" },
  { value: "阅读派", label: "阅读派", desc: "研读佛法经典，以文悟道", emoji: "📖" },
  { value: "观景派", label: "观景派", desc: "游览山水庭院，以景修心", emoji: "🌿" },
  { value: "助人派", label: "助人派", desc: "广结道友善缘，普度众生", emoji: "🤝" },
  { value: "祈福派", label: "祈福派", desc: "虔诚上香供奉，为众生祈福", emoji: "🕯️" },
];

const DEFAULT_AVATARS = [
  { url: pManAvatar, label: "男" },
  { url: pWomanAvatar, label: "女" },
];

export function RegisterCard({ onRegister }: Props) {
  const [step, setStep] = useState(0); // 0=性别, 1=档案, 2=性格, 3=修行方式
  const [gender, setGender] = useState<Gender>("女");
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(gender === "男" ? pManAvatar : pWomanAvatar);
  const [personality, setPersonality] = useState<Personality>("沉稳");
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>("打坐派");
  const [customAvatar, setCustomAvatar] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const displayAvatar = customAvatar || avatarUrl;

  function handleGenderChange(g: Gender) {
    setGender(g);
    setAvatarUrl(g === "男" ? pManAvatar : pWomanAvatar);
    setCustomAvatar("");
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) return; // max 5MB
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      setCustomAvatar(result);
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    const finalName = name.trim() || (gender === "男" ? "无名小僧" : "无名小尼");
    onRegister({
      name: finalName,
      gender,
      birthday,
      personality,
      trainingStyle,
      avatarUrl: displayAvatar,
    });
  }

  // 修行方式的权重预览
  const weights = TRAINING_WEIGHTS[trainingStyle];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <div className="relative z-10 w-[520px] max-w-[96vw] temple-panel rounded-3xl overflow-hidden select-none">
        {/* 顶部装饰 */}
        <div className="relative overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60" />
          <div className="px-8 pt-7 pb-5 text-center">
            <div className="font-title text-3xl text-[var(--gold-deep)] drop-shadow">入寺修行</div>
            <div className="mt-1.5 text-xs text-foreground/50 tracking-widest">
              {step === 0 && "选择你的修行化身"}
              {step === 1 && "留下你的信息，以便寺庙记录"}
              {step === 2 && "你的性格将影响与道友的缘分"}
              {step === 3 && "选择你的日常修行方式"}
            </div>
          </div>

          {/* 步骤指示器 */}
          <div className="flex items-center justify-center gap-2 pb-5">
            {[0, 1, 2, 3].map(s => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? "w-8 bg-[var(--gold)]"
                    : s < step
                    ? "w-4 bg-[var(--gold)]/50"
                    : "w-4 bg-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="h-px bg-[var(--bronze-green)]/25" />

        {/* 内容区 */}
        <div className="px-8 py-6 min-h-[280px]">

          {/* Step 0: 性别选择 */}
          {step === 0 && (
            <div className="flex flex-col items-center gap-6">
              <div className="flex gap-6">
                {(["女", "男"] as Gender[]).map(g => (
                  <button
                    key={g}
                    onClick={() => handleGenderChange(g)}
                    className={`flex flex-col items-center gap-3 rounded-2xl px-8 py-5 transition-all ${
                      gender === g
                        ? "bg-[var(--gold)]/15 ring-2 ring-[var(--gold)]/70"
                        : "bg-foreground/5 ring-1 ring-foreground/15 hover:ring-[var(--gold)]/40"
                    }`}
                  >
                    <img
                      src={g === "女" ? pWomanImg : pManImg}
                      alt={g === "女" ? "女" : "男"}
                      className="h-20 w-20 object-contain rounded-xl"
                    />
                    <span className={`font-title text-lg ${gender === g ? "text-[var(--gold-deep)]" : "text-foreground/60"}`}>
                      {g === "女" ? "女" : "男"}
                    </span>
                    <span className="text-[10px] text-foreground/40">
                      {g === "女" ? "女尼 · 静心修行" : "小僧 · 苦修精进"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: 昵称 + 头像 + 生日 */}
          {step === 1 && (
            <div className="space-y-5">
              {/* 头像选择 */}
              <div className="flex items-start gap-5">
                {/* 当前头像预览 */}
                <div className="relative shrink-0">
                  <div className="h-20 w-20 rounded-full overflow-hidden ring-2 ring-[var(--gold)]/50">
                    <img
                      src={displayAvatar}
                      alt="头像预览"
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/bottts/svg?seed=fallback"; }}
                    />
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-[var(--gold)]/20 ring-1 ring-[var(--gold)]/50 text-xs hover:bg-[var(--gold)]/30 transition-colors"
                    title="上传头像"
                  >
                    📷
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </div>

                {/* 默认头像选项 */}
                <div className="flex-1">
                  <div className="text-[10px] text-foreground/50 mb-2 tracking-wider">选择默认头像</div>
                  <div className="flex gap-2">
                    {DEFAULT_AVATARS.map(({ url, label }) => (
                      <button
                        key={label}
                        onClick={() => { setAvatarUrl(url); setCustomAvatar(""); }}
                        className={`h-12 w-12 rounded-full overflow-hidden transition-all ${
                          displayAvatar === url && !customAvatar
                            ? "ring-2 ring-[var(--gold)]"
                            : "ring-1 ring-foreground/20 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={url} alt={label} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 昵称 */}
              <div>
                <label className="text-[11px] text-foreground/60 tracking-wider block mb-1.5">
                  法号 / 昵称 <span className="text-foreground/30">（最多8字，留空则随机）</span>
                </label>
                <input
                  type="text"
                  maxLength={8}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={gender === "男" ? "无名小僧" : "无名小尼"}
                  className="w-full rounded-xl bg-foreground/5 ring-1 ring-foreground/15 px-4 py-2.5 text-sm text-foreground outline-none focus:ring-[var(--gold)]/50 transition-all"
                />
              </div>

              {/* 生日 */}
              <div>
                <label className="text-[11px] text-foreground/60 tracking-wider block mb-1.5">
                  生辰 <span className="text-foreground/30">（每年生日当天有特殊奖励）</span>
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={e => setBirthday(e.target.value)}
                  className="w-full rounded-xl bg-foreground/5 ring-1 ring-foreground/15 px-4 py-2.5 text-sm text-foreground outline-none focus:ring-[var(--gold)]/50 transition-all"
                />
              </div>
            </div>
          )}

          {/* Step 2: 性格选择 */}
          {step === 2 && (
            <div className="space-y-2.5">
              {PERSONALITIES.map(({ value, label, desc, emoji }) => (
                <button
                  key={value}
                  onClick={() => setPersonality(value)}
                  className={`w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all ${
                    personality === value
                      ? "bg-[var(--gold)]/15 ring-2 ring-[var(--gold)]/60"
                      : "bg-foreground/5 ring-1 ring-foreground/15 hover:ring-[var(--gold)]/30"
                  }`}
                >
                  <span className="text-2xl shrink-0">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-title text-base ${personality === value ? "text-[var(--gold)]" : "text-foreground/80"}`}>
                      {label}
                    </div>
                    <div className="text-[10px] text-foreground/50 mt-0.5">{desc}</div>
                  </div>
                  {personality === value && (
                    <div className="shrink-0 h-5 w-5 rounded-full bg-[var(--gold)]/20 ring-1 ring-[var(--gold)]/60 grid place-items-center">
                      <div className="h-2 w-2 rounded-full bg-[var(--gold)]" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Step 3: 修行方式 */}
          {step === 3 && (
            <div className="space-y-2.5">
              {TRAINING_STYLES.map(({ value, label, desc, emoji }) => (
                <button
                  key={value}
                  onClick={() => setTrainingStyle(value)}
                  className={`w-full flex items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all ${
                    trainingStyle === value
                      ? "bg-[var(--gold)]/15 ring-2 ring-[var(--gold)]/60"
                      : "bg-foreground/5 ring-1 ring-foreground/15 hover:ring-[var(--gold)]/30"
                  }`}
                >
                  <span className="text-2xl shrink-0">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-title text-base ${trainingStyle === value ? "text-[var(--gold)]" : "text-foreground/80"}`}>
                      {label}
                    </div>
                    <div className="text-[10px] text-foreground/50 mt-0.5">{desc}</div>
                  </div>
                  {/* 权重小条 */}
                  {trainingStyle === value && (
                    <div className="shrink-0 flex flex-col gap-0.5 text-right min-w-[60px]">
                      {Object.entries(weights).filter(([, w]) => w > 0).map(([k, w]) => (
                        <div key={k} className="flex items-center gap-1 justify-end">
                          <span className="text-[8px] text-foreground/40">{k}</span>
                          <div className="h-1 rounded-full bg-[var(--gold)]/30 overflow-hidden" style={{ width: `${w * 0.5}px` }}>
                            <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: "100%" }} />
                          </div>
                          <span className="text-[8px] text-[var(--gold)]/60 tabular-nums">{w}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="h-px bg-[var(--bronze-green)]/20" />
        <div className="flex items-center justify-between px-8 py-5">
          <button
            className={`text-sm text-foreground/40 hover:text-foreground/70 transition-colors ${step === 0 ? "invisible" : ""}`}
            onClick={() => setStep(s => s - 1)}
          >
            ← 返回
          </button>

          {step < 3 ? (
            <button
              className="temple-ornate-btn px-6 py-2 text-sm"
              onClick={() => setStep(s => s + 1)}
            >
              下一步 →
            </button>
          ) : (
            <button
              className="temple-ornate-btn px-8 py-2 text-sm bg-[var(--gold)]/20 ring-1 ring-[var(--gold)]/50 hover:bg-[var(--gold)]/30"
              onClick={handleSubmit}
            >
              ✦ 开始修行
            </button>
          )}
        </div>

        {/* 底部装饰线 */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-40" />
      </div>
    </div>
  );
}
