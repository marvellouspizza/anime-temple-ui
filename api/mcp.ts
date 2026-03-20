import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolveUserId(authHeader?: string): Promise<string> {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing Authorization header");
  }
  const token = authHeader.split(" ")[1];
  const res = await fetch(
    "https://api.mindverse.com/gate/lab/api/secondme/user/info",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Invalid or expired token");
  const json = (await res.json()) as { code: number; data?: { userId?: string }; message?: string };
  if (json.code !== 0) throw new Error(json.message || "Auth failed");
  const userId = json.data?.userId;
  if (!userId) throw new Error("userId not found");
  return String(userId);
}

const tools = [
  {
    name: "check_temple_status",
    description: "查看玩家当前的功德值、香火钱、等级和所在寺庙状态",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "knock_wooden_fish",
    description: "代替玩家敲木鱼，积攒功德值",
    inputSchema: {
      type: "object" as const,
      properties: {
        count: {
          type: "number",
          description: "敲击次数（1-100）",
          minimum: 1,
          maximum: 100,
        },
      },
      required: ["count"],
    },
  },
  {
    name: "write_practice_diary",
    description: "将一段有禅意的感悟或活动记录写入玩家的修行日志",
    inputSchema: {
      type: "object" as const,
      properties: {
        log_content: { type: "string", description: "日志内容" },
        log_type: {
          type: "string",
          description: "日志类型",
          enum: ["zen", "auto", "event"],
        },
      },
      required: ["log_content", "log_type"],
    },
  },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Session-Id");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let userId: string;
  try {
    userId = await resolveUserId(req.headers.authorization);
  } catch (err: unknown) {
    return res.status(401).json({ error: err instanceof Error ? err.message : "Unauthorized" });
  }

  const server = new Server(
    { name: "anime-temple-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // players.id IS the secondme userId (see upsertPlayerSecondMe)
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!player) {
      return {
        content: [{ type: "text" as const, text: "未找到您的修行档案，请先在游戏中完成注册。" }],
        isError: true,
      };
    }

    try {
      if (name === "check_temple_status") {
        const { data: state } = await supabase
          .from("game_states")
          .select("level, incense_coin, merit, current_temple_id, exp")
          .eq("user_id", userId)
          .maybeSingle();
        const output = state
          ? `等级：${state.level}，香火钱：${state.incense_coin}，功德：${state.merit}，当前寺庙 ID：${state.current_temple_id}，经验：${state.exp}`
          : "暂无修行记录，您还未开始修行旅程。";
        return { content: [{ type: "text" as const, text: output }] };
      }

      if (name === "knock_wooden_fish") {
        const count = Math.min(Math.max(Number(args?.count) || 1, 1), 100);
        const { data: state } = await supabase
          .from("game_states")
          .select("merit")
          .eq("user_id", userId)
          .maybeSingle();
        if (!state) throw new Error("修行记录未初始化，请先进入游戏");
        const newMerit = state.merit + count;
        await supabase
          .from("game_states")
          .update({ merit: newMerit })
          .eq("user_id", userId);
        return {
          content: [{ type: "text" as const, text: `叩拜木鱼 ${count} 次，功德 +${count}。当前总功德：${newMerit}` }],
        };
      }

      if (name === "write_practice_diary") {
        const description = String(args?.log_content ?? "");
        const type = String(args?.log_type ?? "zen");
        await supabase.from("activity_logs").insert({
          user_id: userId,
          type,
          description,
          coins_delta: 0,
          exp_delta: 0,
        });
        return {
          content: [{ type: "text" as const, text: "禅意感悟已记入修行日志，愿此心得长存。" }],
        };
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      };
    }
  });

  // Stateless StreamableHTTP transport — Vercel serverless compatible
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req as never, res as never, req.body);
}
