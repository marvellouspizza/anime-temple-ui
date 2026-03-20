import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getSecondMeUserId } from "./auth.js";
import { supabaseAdmin } from "./supabase.js";

dotenv.config();

const app = express();
app.use(cors());

// 工具配置
const tools = [
  {
    name: "check_temple_status",
    description: "查看玩家当前的功德值、香火钱和当前解锁的寺庙状态",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "knock_wooden_fish",
    description: "代敲木鱼积攒功德",
    inputSchema: {
      type: "object",
      properties: { count: { type: "number", description: "敲击次数", minimum: 1, maximum: 100 } },
      required: ["count"]
    }
  },
  {
    name: "write_practice_diary",
    description: "记录修行日志，描述一段有禅意的顿悟或当前状态",
    inputSchema: {
      type: "object",
      properties: {
        log_content: { type: "string", description: "带禅意的日志内容" },
        log_type: { type: "string", description: "日志类型，例如 'zen', 'auto', 'event'", enum: ["zen", "auto", "event"] }
      },
      required: ["log_content", "log_type"]
    }
  }
];

// 每个连接建立时记录 userId 和 transport
const connections = new Map<string, { userId: string; transport: SSEServerTransport }>();

app.get("/mcp/sse", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    // 获取真正的 SecondMe 用户 ID
    const userId = await getSecondMeUserId(authHeader);
    
    // 初始化 SSE
    const transport = new SSEServerTransport("/mcp/messages", res);
    
    // 为每个连麦客户端创建专属的 MCP Server 实例，并与 userId 绑定
    const server = new Server(
      { name: "anime-temple-mcp", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // ===== 获取玩家内建 ID (绑定逻辑) =====
      const { data: player } = await supabaseAdmin
        .from('players')
        .select('id')
        .eq('secondme_user_id', userId)
        .single();
        
      if (!player) {
         return { content: [{ type: "text", text: "未找到玩家记录，请先在游戏中创建角色。" }], isError: true };
      }
      const playerId = player.id;
      
      // ===== 工具处理 =====
      try {
        if (name === "check_temple_status") {
          const { data: state } = await supabaseAdmin.from('game_states').select('*').eq('player_id', playerId).single();
          return { content: [{ type: "text", text: JSON.stringify(state || { merit: 0, money: 0, level: 1 }) }] };
        }
        
        if (name === "knock_wooden_fish") {
          const count = Number(args?.count) || 1;
          const { data: state } = await supabaseAdmin.from('game_states').select('*').eq('player_id', playerId).single();
          if (!state) throw new Error("游戏状态未初始化");
          
          const newMerit = state.merit + count;
          await supabaseAdmin.from('game_states').update({ merit: newMerit }).eq('player_id', playerId);
          return { content: [{ type: "text", text: `成功敲击木鱼 ${count} 次！当前总功德：${newMerit}` }] };
        }
        
        if (name === "write_practice_diary") {
          const content = String(args?.log_content);
          const logType = String(args?.log_type);
          await supabaseAdmin.from('activity_logs').insert({
            player_id: playerId,
            log_type: logType,
            content: content
          });
          return { content: [{ type: "text", text: "已成功将禅意感悟记入修行日志中。" }] };
        }
        
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    });

    await server.connect(transport);
    connections.set(transport.sessionId, { userId, transport });
    
    // 清理连接
    req.on("close", () => connections.delete(transport.sessionId));
  } catch (err: any) {
    console.error("SSE Setup Auth Error:", err.message);
    res.status(401).send(err.message);
  }
});

app.post("/mcp/messages", express.json(), async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const conn = connections.get(sessionId);
  if (!conn) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  await conn.transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Anime Temple MCP Server running on port ${PORT}`);
});
