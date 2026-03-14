/**
 * DraggableCard – 可拖拽/可缩放的卡片包装器
 * 依赖 framer-motion（项目已安装）
 * - 解锁模式下：金色边框高亮 + 顶部拖拽手柄 + 右下角缩放角标
 * - 拖拽/缩放结束后自动保存至 localStorage，并弹出 toast 提示
 */

import { motion, useMotionValue } from "framer-motion";
import { GripHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface DraggableCardProps {
  id: string;
  isUnlocked: boolean;
  resizable?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function DraggableCard({
  id,
  isUnlocked,
  resizable = false,
  className = "",
  style,
  children,
}: DraggableCardProps) {
  // ── 位置 (transform offset) ─────────────────────────────
  const initPos = readLS<{ x: number; y: number }>(`card-pos-${id}`, { x: 0, y: 0 });
  const x = useMotionValue(initPos.x);
  const y = useMotionValue(initPos.y);

  // ── 大小 ────────────────────────────────────────────────
  const initSize = readLS<{ w: number; h: number } | null>(`card-size-${id}`, null);
  const [size, setSize] = useState(initSize);
  const sizeRef = useRef(size);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  // ── 防重复 toast ────────────────────────────────────────
  const toasted = useRef(false);
  function fireToast(msg: string) {
    if (toasted.current) return;
    toasted.current = true;
    toast.success(msg, { duration: 1200 });
    setTimeout(() => {
      toasted.current = false;
    }, 1500);
  }

  // ── 保存位置 ─────────────────────────────────────────────
  function savePos() {
    localStorage.setItem(`card-pos-${id}`, JSON.stringify({ x: x.get(), y: y.get() }));
    fireToast("位置已保存");
  }

  // ── 缩放 ─────────────────────────────────────────────────
  const cardRef = useRef<HTMLDivElement>(null);
  const rDrag = useRef({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 });

  useEffect(() => {
    if (!resizable) return;

    function onMove(e: MouseEvent) {
      if (!rDrag.current.active) return;
      const newW = Math.max(160, rDrag.current.startW + (e.clientX - rDrag.current.startX));
      const newH = Math.max(80, rDrag.current.startH + (e.clientY - rDrag.current.startY));
      setSize({ w: newW, h: newH });
    }

    function onUp() {
      if (!rDrag.current.active) return;
      rDrag.current.active = false;
      const s = sizeRef.current;
      if (s) {
        localStorage.setItem(`card-size-${id}`, JSON.stringify(s));
        fireToast("大小已保存");
      }
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, resizable]);

  // ── 渲染 ─────────────────────────────────────────────────
  const unlockOutline = isUnlocked
    ? "outline outline-2 outline-[var(--gold)]/60 outline-offset-[3px]"
    : "";

  return (
    <motion.div
      ref={cardRef}
      drag={isUnlocked}
      dragMomentum={false}
      dragElastic={0}
      style={{
        x,
        y,
        ...(size ? { width: size.w, height: size.h } : {}),
        ...style,
      }}
      onDragEnd={savePos}
      className={`relative ${unlockOutline} ${className}`}
    >
      {/* 顶部拖拽把手 */}
      {isUnlocked && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex justify-center py-0.5">
          <GripHorizontal className="h-3.5 w-3.5 text-[var(--gold)]/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
        </div>
      )}

      {children}

      {/* 右下角缩放手柄 */}
      {isUnlocked && resizable && (
        <div
          className="absolute bottom-0 right-0 z-[60] h-5 w-5 cursor-se-resize rounded-bl-sm opacity-75 hover:opacity-100 transition-opacity"
          style={{
            background: "var(--gold)",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = cardRef.current?.getBoundingClientRect();
            rDrag.current = {
              active: true,
              startX: e.clientX,
              startY: e.clientY,
              startW: rect?.width ?? 300,
              startH: rect?.height ?? 200,
            };
          }}
        />
      )}
    </motion.div>
  );
}
