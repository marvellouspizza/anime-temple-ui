import os
import re

file_path = 'src/components/SecondMeChat.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

replacement = """// ── 登录面板 ─────────────────────────────────────────────────
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
      <div className="text-2xl">☸️</div>
      <p className="text-[11px] font-medium text-[var(--gold)]">唤醒你的 AI 数字分身</p>
      <p className="text-[10px] text-foreground/40 leading-relaxed">
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

"""

new_text = re.sub(r'// ── 登录面板 ──.*?(?=// ── 主组件 ──)', replacement, text, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("done")
