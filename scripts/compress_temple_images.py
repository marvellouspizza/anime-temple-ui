#!/usr/bin/env python3
"""
压缩寺庙概览图片：PNG → WebP（quality=82，最长边限制 1200px）
输出目录：src/assets/寺庙_compressed/
"""

import os
import sys
from pathlib import Path
from PIL import Image

SRC_DIR  = Path(__file__).parent.parent / "src" / "assets" / "寺庙"
OUT_DIR  = Path(__file__).parent.parent / "src" / "assets" / "寺庙_compressed"
MAX_SIDE = 1200   # 最长边像素上限
QUALITY  = 82     # WebP 质量（0-100）

OUT_DIR.mkdir(parents=True, exist_ok=True)

pngs = sorted(SRC_DIR.glob("*.png"))
if not pngs:
    print("未找到 PNG 文件，请检查路径：", SRC_DIR)
    sys.exit(1)

print(f"共发现 {len(pngs)} 张图片，开始压缩...\n")

for src in pngs:
    dst = OUT_DIR / (src.stem + ".webp")
    img = Image.open(src)

    # 等比缩放
    w, h = img.size
    if max(w, h) > MAX_SIDE:
        scale = MAX_SIDE / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    img.save(dst, "WEBP", quality=QUALITY, method=6)

    src_kb = src.stat().st_size / 1024
    dst_kb = dst.stat().st_size / 1024
    ratio  = (1 - dst_kb / src_kb) * 100
    print(f"  {src.name}")
    print(f"    {src_kb:>8.0f} KB  →  {dst_kb:>6.0f} KB  (节省 {ratio:.1f}%)")

print(f"\n✓ 已保存至 {OUT_DIR}")
