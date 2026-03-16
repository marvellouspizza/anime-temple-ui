/**
 * 上传寺庙壁纸原图到 Supabase Storage
 *
 * 前置条件：
 *   - 从 Supabase 控制台 Project Settings › API 拿到 service_role key
 *
 * 使用方法：
 *   SUPABASE_SERVICE_KEY=<service_role_key> node scripts/upload_temple_wallpapers.js
 *
 *   也可配合 .env 里已有的 VITE_SUPABASE_URL：
 *   VITE_SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=<key> node scripts/upload_temple_wallpapers.js
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 读取环境变量（也支持直接读 .env 文件） ────────────────────────────────
function loadEnv() {
  try {
    const envText = readFileSync(join(__dirname, "../.env"), "utf-8");
    for (const line of envText.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* .env 不存在则跳过 */ }
}
loadEnv();

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "\n❌ 缺少环境变量！请确保设置：\n" +
    "   VITE_SUPABASE_URL   （已在 .env 中配置）\n" +
    "   SUPABASE_SERVICE_KEY（从 Supabase 控制台 Project Settings › API 获取）\n\n" +
    "示例：\n" +
    "   SUPABASE_SERVICE_KEY=eyJ... node scripts/upload_temple_wallpapers.js\n"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET  = "temple-wallpapers";
const IMG_DIR = join(__dirname, "../src/assets/寺庙");

// 寺庙名称 → ID 映射（与 useGameState.ts 中 TWELVE_TEMPLES 保持一致）
const TEMPLE_NAME_TO_ID = {
  "拉萨 · 雪寺":    1,
  "银涛 · 海风寺":  2,
  "云栖 · 竹影寺":  3,
  "烈焰 · 神灯寺":  4,
  "金光 · 灵塔寺":  5,
  "星影 · 月殿寺":  6,
  "清迈 · 森林寺":  7,
  "峇里岛 · 海风寺": 8,
  "京都 · 山寺":    9,
  "云光 · 灵洁寺":  10,
  "雪羽 · 苍穹寺":  11,
  "暗月 · 幽冢寺":  12,
};

async function main() {
  // 1. 创建公开 bucket（已存在则跳过）
  const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 50 * 1024 * 1024, // 50 MB
    allowedMimeTypes: ["image/png"],
  });
  if (bucketErr && !bucketErr.message.toLowerCase().includes("already exists")) {
    throw new Error(`创建 bucket 失败: ${bucketErr.message}`);
  }
  console.log(`✓ bucket "${BUCKET}" 已就绪\n`);

  // 2. 上传所有 PNG，使用 ASCII 安全的 temple-{id}.png 作为存储 key
  const files = readdirSync(IMG_DIR).filter((f) => f.endsWith(".png"));
  if (files.length === 0) {
    console.warn("⚠️  src/assets/寺庙/ 下未找到 PNG 文件");
    return;
  }

  let success = 0;
  for (const file of files) {
    const baseName = file.replace(/\.png$/, "");
    const templeId = TEMPLE_NAME_TO_ID[baseName];
    if (!templeId) {
      console.warn(`⚠️  未找到寺庙 ID 映射，跳过: ${file}`);
      continue;
    }
    const storageKey = `temple-${templeId}.png`;
    const data = readFileSync(join(IMG_DIR, file));
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, data, { contentType: "image/png", upsert: true });

    if (error) {
      console.error(`✗ ${file} (${storageKey})  →  ${error.message}`);
    } else {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storageKey}`;
      console.log(`✓ ${file} → ${storageKey}\n   ${publicUrl}`);
      success++;
    }
  }

  console.log(`\n完成！成功上传 ${success} / ${files.length} 张图片`);
  console.log(`公共访问前缀: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
