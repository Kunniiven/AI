const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const { HttpsProxyAgent } = require("https-proxy-agent");
const multer = require("multer");
const mongoose = require("mongoose");
require("dotenv").config();

const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// ========== Middleware ==========
app.use(cors());
app.use(express.json({ limit: "10mb" }));
// ========== ✅ Device View Mode (mobile/desktop/auto) ==========

// 简单解析 cookie（不需要额外装 cookie-parser）
function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

function setCookie(res, name, value, maxAgeSeconds = 3600 * 24 * 365) {
  // 注意：不要 HttpOnly，否则前端 JS 读不到（我们要用 JS 做“强制布局”）
  res.setHeader(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`,
  );
}

function isMobileUA(ua) {
  const s = (ua || "").toLowerCase();
  return /android|iphone|ipod|ipad|mobile|windows phone|iemobile|blackberry|opera mini/.test(
    s,
  );
}

// ✅ 自动设置 view cookie：手机=mobile，电脑=desktop
app.use((req, res, next) => {
  // 只处理首页（你也可以扩大到所有 html 请求）
  if (req.method === "GET" && req.path === "/") {
    const view = (getCookie(req, "view") || "auto").toLowerCase();

    if (!view || view === "auto") {
      const ua = req.headers["user-agent"] || "";
      const autoView = isMobileUA(ua) ? "mobile" : "desktop";
      setCookie(res, "view", autoView);
    }
  }
  next();
});

// ✅ 手动切换：/view/mobile  /view/desktop  /view/auto
app.get("/view/:mode", (req, res) => {
  const mode = (req.params.mode || "").toLowerCase();
  if (!["mobile", "desktop", "auto"].includes(mode)) {
    return res.status(400).send("view mode must be mobile / desktop / auto");
  }
  setCookie(res, "view", mode);
  // 切换完回首页
  res.redirect("/");
});

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// ========== Multer Upload ==========
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = path.join(__dirname, "uploads");
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|txt|doc|docx|xls|xlsx|ppt|pptx/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error("不支持的文件类型"));
  },
});

// ========== OpenAI Client ==========
let openai = null;

function buildOpenAIClient(apiKey) {
  const config = { apiKey };

  // Proxy
  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    config.httpAgent = new HttpsProxyAgent(proxyUrl);
    console.log(`Using proxy: ${proxyUrl}`);
  }

  config.timeout = 5 * 60 * 1000; // 5 minutes (streaming friendly)
  config.maxRetries = 2;

  return new OpenAI(config);
}

if (
  process.env.OPENAI_API_KEY &&
  process.env.OPENAI_API_KEY !== "your_openai_api_key_here"
) {
  openai = buildOpenAIClient(process.env.OPENAI_API_KEY);
}

// ✅ 是否开启 store（影响 dashboard logs + previous_response_id 续写）
const storeEnabled = process.env.OPENAI_STORE === "1";

// ========== MongoDB Connection ==========
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/aigui";

mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ========== MongoDB Schema ==========
const messageSchema = new mongoose.Schema({
  role: { type: String, required: true },
  content: mongoose.Schema.Types.Mixed,
  timestamp: { type: String, required: true },
  attachments: [{
    filename: String,
    originalname: String,
    mimetype: String,
    size: Number,
    url: String
  }],
  reasoningSummary: String,
  partial: Boolean,
  error: String
}, { _id: false });

const chatSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  messages: [messageSchema],
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
  lastResponseId: String,
  lastModel: String,
  systemPrompt: { type: String, default: "" }
});

const Chat = mongoose.model("Chat", chatSchema);

// ========== MongoDB Operations ==========
async function initChatsFile() {
  // MongoDB 不需要初始化文件
  console.log("Using MongoDB for chat storage");
}

async function readChats() {
  const chats = await Chat.find({}).sort({ updatedAt: -1 }).lean();
  return { chats };
}

async function writeChats(data) {
  // 这个函数在迁移到 MongoDB 后不再使用
  // 保留以兼容现有代码，但不执行任何操作
}

// ========== Helpers ==========
function formatModelName(modelId) {
  const nameMap = {
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4.1": "GPT-4.1",
    "gpt-4.1-mini": "GPT-4.1 Mini",
    "gpt-4.1-nano": "GPT-4.1 Nano",
    "gpt-5": "GPT-5",
    "gpt-5-mini": "GPT-5 Mini",
    "gpt-5-nano": "GPT-5 Nano",
    o1: "O1 (推理)",
    "o1-mini": "O1 Mini (推理)",
    o3: "O3 (推理)",
    "o3-mini": "O3 Mini (推理)",
    o4: "O4 (推理)",
  };
  return nameMap[modelId] || modelId;
}

function modelSupportsVision(model) {
  const m = (model || "").toLowerCase();
  return (
    m.includes("4o") ||
    m.includes("4.1") ||
    m.startsWith("gpt-5") ||
    m.includes("o1") ||
    m.includes("o3") ||
    m.includes("o4") ||
    m.includes("vision") ||
    m.includes("image")
  );
}

function isReasoningModel(model) {
  const m = (model || "").toLowerCase();
  return (
    m.startsWith("gpt-5") ||
    m.includes("o1") ||
    m.includes("o3") ||
    m.includes("o4")
  );
}

function supportsNativeVerbosity(model) {
  const m = (model || "").toLowerCase();
  return m.startsWith("gpt-5");
}

function normalizeVerbosity(v) {
  // 前端会传 0/1/2
  if (v === 0 || v === "0") return "low";
  if (v === 1 || v === "1") return "medium";
  if (v === 2 || v === "2") return "high";

  const s = (v || "").toString().toLowerCase();
  if (["low", "medium", "high"].includes(s)) return s;

  return null;
}

async function localImageToDataURL(att) {
  const rel = (att.url || "").replace(/^\/+/, "");
  const absPath = path.join(__dirname, rel);

  const buf = await fs.readFile(absPath);
  const base64 = buf.toString("base64");
  const mime = att.mimetype || "image/png";
  return `data:${mime};base64,${base64}`;
}

function normalizeToInputParts(content) {
  if (Array.isArray(content)) return content;
  const text = (content ?? "").toString();
  return [{ type: "input_text", text }];
}

function extractResponsesText(resp) {
  if (resp?.output_text) return resp.output_text;

  const chunks = [];
  for (const item of resp?.output || []) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content) {
        if (part?.type === "output_text" && part?.text) chunks.push(part.text);
      }
    }
  }
  return chunks.join("");
}

// ✅ Reasoning summary（安全替代 raw chain-of-thought）
function extractReasoningSummary(resp) {
  for (const item of resp?.output || []) {
    if (item?.type === "reasoning" && Array.isArray(item.summary)) {
      return item.summary
        .filter((x) => x?.type === "summary_text" && x?.text)
        .map((x) => x.text)
        .join("\n\n");
    }
  }
  return "";
}

function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ========== API Routes ==========
app.get("/api/status", (req, res) => {
  res.json({
    hasApiKey: openai !== null,
    ready: openai !== null,
    storeEnabled,
  });
});

app.get("/api/models", async (req, res) => {
  if (!openai)
    return res.status(400).json({ error: "OpenAI API key not configured" });

  try {
    const response = await openai.models.list();

    const models = (response.data || [])
      .filter((m) => {
        const id = (m.id || "").toLowerCase();
        // ✅ 更稳：尽量只展示支持 Responses 的主流聊天模型
        return (
          id.includes("gpt-4o") ||
          id.includes("gpt-4.1") ||
          id.startsWith("gpt-5") ||
          id.includes("o1") ||
          id.includes("o3") ||
          id.includes("o4") ||
          id.includes("codex") ||
          id.includes("computer-use")
        );
      })
      .sort((a, b) => (b.created || 0) - (a.created || 0))
      .map((m) => ({
        id: m.id,
        name: formatModelName(m.id),
        created: m.created,
      }));

    // fallback
    if (models.length === 0) {
      return res.json([
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
        { id: "o3-mini", name: "O3 Mini (推理)" },
      ]);
    }

    res.json(models);
  } catch (e) {
    res.json([
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
      { id: "o3-mini", name: "O3 Mini (推理)" },
    ]);
  }
});

// Get all chats
app.get("/api/chats", async (req, res) => {
  try {
    const data = await readChats();
    res.json(data.chats);
  } catch {
    res.status(500).json({ error: "Failed to read chats" });
  }
});

// Create new chat
app.post("/api/chats", async (req, res) => {
  try {
    const newChat = new Chat({
      id: Date.now().toString(),
      title: req.body.title || "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastResponseId: null,
      lastModel: null,
      systemPrompt: "",
    });

    await newChat.save();
    res.json(newChat.toObject());
  } catch (error) {
    console.error("Failed to create chat:", error);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

// Delete chat
app.delete("/api/chats/:id", async (req, res) => {
  try {
    await Chat.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// Reset continuation state
app.post("/api/chat/reset/:id", async (req, res) => {
  try {
    const chat = await Chat.findOneAndUpdate(
      { id: req.params.id },
      { 
        lastResponseId: null,
        lastModel: null,
        updatedAt: new Date().toISOString()
      },
      { new: true }
    );
    
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json({ success: true, chat: chat.toObject() });
  } catch (error) {
    console.error("Failed to reset chat:", error);
    res.status(500).json({ error: "Failed to reset chat" });
  }
});

// ========== ✅ Chat: Responses API (supports streaming) ==========
app.post("/api/chat", async (req, res) => {
  const {
    message,
    chatId,
    model,
    attachments,
    systemPrompt,
    temperature,
    maxTokens,
    topP,
    reasoningEffort,
    verbosity,
    showReasoningSummary,
    stream, // ✅ NEW
  } = req.body || {};

  if (!openai)
    return res.status(400).json({ error: "OpenAI API key not configured" });
  if (!message && (!attachments || attachments.length === 0)) {
    return res
      .status(400)
      .json({ error: "Message or attachments are required" });
  }

  const selectedModel = model || "gpt-4o-mini";
  const reasoning = isReasoningModel(selectedModel);

  try {
    let chat = await Chat.findOne({ id: chatId });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // persist system prompt
    if (typeof systemPrompt === "string") {
      chat.systemPrompt = systemPrompt;
    }

    // model changed => reset continuation
    if (chat.lastModel && chat.lastModel !== selectedModel) {
      chat.lastResponseId = null;
    }

    // ---------- build userMessage ----------
    let userMessage = {
      role: "user",
      content: message || "",
      timestamp: new Date().toISOString(),
    };

    // attachments -> input_image
    if (attachments && attachments.length > 0) {
      userMessage.attachments = attachments;

      const hasImage = attachments.some((a) =>
        a?.mimetype?.startsWith("image/"),
      );
      if (hasImage && modelSupportsVision(selectedModel)) {
        const parts = [];
        if (message) parts.push({ type: "input_text", text: message });

        for (const att of attachments) {
          if (att?.mimetype?.startsWith("image/")) {
            let imageUrl = att.url;
            if (imageUrl && !imageUrl.startsWith("http")) {
              imageUrl = await localImageToDataURL(att);
            }
            if (imageUrl) {
              parts.push({
                type: "input_image",
                image_url: imageUrl,
                detail: "auto",
              });
            }
          }
        }

        if (parts.length > 0) userMessage.content = parts;
      }
    }

    chat.messages.push(userMessage);
    await chat.save();

    // ---------- build Responses params ----------
    const maxOut = maxTokens !== undefined ? Number(maxTokens) : 2000;

    // ✅ 最优策略：
    // - storeEnabled=1：使用 previous_response_id 续写，只发本轮 input（省 tokens）
    // - storeEnabled=0：退化为全历史输入（保证上下文不断）
    const inputItem = {
      role: "user",
      content: normalizeToInputParts(userMessage.content),
    };

    let apiInput = [inputItem];
    if (!storeEnabled) {
      apiInput = chat.messages.map((m) => ({
        role: m.role,
        content: normalizeToInputParts(m.content),
      }));
    }

    const apiParams = {
      model: selectedModel,
      input: apiInput,
      max_output_tokens: maxOut,
      store: storeEnabled,
    };

    // ✅ instructions 每轮都带（previous_response_id 不继承）
    if (chat.systemPrompt) apiParams.instructions = chat.systemPrompt;

    // ✅ 非推理模型才允许 temperature/top_p（避免你遇到的报错）
    if (!reasoning) {
      apiParams.temperature =
        temperature !== undefined ? Number(temperature) : 0.7;
      if (topP !== undefined) apiParams.top_p = Number(topP);
    }

    // ✅ 推理模型：reasoning.effort + reasoning.summary
    const effortAllowed = new Set([
      "none",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    if (reasoning) {
      apiParams.reasoning = apiParams.reasoning || {};
      if (effortAllowed.has(reasoningEffort))
        apiParams.reasoning.effort = reasoningEffort;
      if (showReasoningSummary === true) apiParams.reasoning.summary = "auto";
    }

    // ✅ verbosity：GPT-5 原生参数，否则用 instructions 兜底
    const v = normalizeVerbosity(verbosity);
    if (v) {
      if (supportsNativeVerbosity(selectedModel)) {
        apiParams.text = { ...(apiParams.text || {}), verbosity: v };
      } else if (v !== "medium") {
        const hint =
          v === "low" ? "请用简洁的方式回答。" : "请提供详细和全面的回答。";
        apiParams.instructions = (apiParams.instructions || "") + "\n" + hint;
      }
    }

    // ✅ continuation（仅 storeEnabled 才靠谱）
    if (storeEnabled && chat.lastResponseId)
      apiParams.previous_response_id = chat.lastResponseId;

    // ========== STREAMING MODE ==========
    const wantsStream =
      stream === true ||
      (req.headers.accept || "").includes("text/event-stream");

    if (wantsStream) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      // SSE keep-alive ping (avoid proxy idle timeout)
      const pingInterval = setInterval(() => {
        try {
          res.write(`: ping\n\n`);
        } catch {}
      }, 15000);

      const controller = new AbortController();
      req.on("close", () => controller.abort());

      // Stream from OpenAI
      let assistantText = "";
      let reasoningText = "";
      let finalResponseId = null;

      try {
        const streamIterable = await openai.responses.create(
          {
            ...apiParams,
            stream: true,
          },
          {
            signal: controller.signal,
          },
        );

        // 给前端一个 meta
        sseWrite(res, {
          type: "meta",
          model: selectedModel,
          storeEnabled,
        });

        for await (const event of streamIterable) {
          const t = event?.type;

          if (t === "response.output_text.delta") {
            assistantText += event.delta || "";
            sseWrite(res, { type: "delta", delta: event.delta || "" });
          }

          if (t === "response.reasoning_summary_text.delta") {
            reasoningText += event.delta || "";
            sseWrite(res, {
              type: "reasoning_delta",
              delta: event.delta || "",
            });
          }

          if (t === "response.completed") {
            finalResponseId = event?.response?.id || null;
          }

          if (t === "response.failed") {
            sseWrite(res, {
              type: "error",
              error:
                event?.response?.error?.message || "OpenAI response failed",
            });
          }
        }

        // save assistant message
        chat.messages.push({
          role: "assistant",
          content: assistantText,
          reasoningSummary: reasoningText || "",
          timestamp: new Date().toISOString(),
        });

        // update continuation
        chat.lastResponseId = storeEnabled
          ? finalResponseId || chat.lastResponseId
          : null;
        chat.lastModel = selectedModel;

        // auto title
        if (chat.messages.length === 2 && typeof message === "string") {
          chat.title =
            message.substring(0, 30) + (message.length > 30 ? "..." : "");
        }

        chat.updatedAt = new Date().toISOString();
        await chat.save();

        // final payload
        sseWrite(res, {
          type: "final",
          message: assistantText,
          reasoningSummary: reasoningText || "",
          chat: chat.toObject(),
        });

        clearInterval(pingInterval);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      } catch (err) {
        console.error("Streaming error:", err);

        // Persist partial assistant message (if any) so history won't lose it
        if (assistantText || reasoningText) {
          chat.messages.push({
            role: "assistant",
            content: assistantText,
            reasoningSummary: reasoningText || "",
            timestamp: new Date().toISOString(),
            partial: true,
            error: err?.message || "Streaming error",
          });

          // auto title (for new chat)
          if (chat.messages.length === 2 && typeof message === "string") {
            chat.title =
              message.substring(0, 30) + (message.length > 30 ? "..." : "");
          }

          chat.lastModel = selectedModel;
          chat.updatedAt = new Date().toISOString();
          await chat.save();
        }

        // Send a "final" so frontend can finish UI even on interruption
        sseWrite(res, {
          type: "final",
          message: assistantText,
          reasoningSummary: reasoningText || "",
          chat: chat.toObject(),
          partial: true,
          error: err?.message || "Streaming error",
        });

        clearInterval(pingInterval);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    // ========== NON-STREAM MODE ==========
    const response = await openai.responses.create(apiParams);

    const assistantMessage = extractResponsesText(response) || "";
    const reasoningSummary = showReasoningSummary
      ? extractReasoningSummary(response)
      : "";

    chat.messages.push({
      role: "assistant",
      content: assistantMessage,
      reasoningSummary: reasoningSummary || "",
      timestamp: new Date().toISOString(),
    });

    chat.lastResponseId = storeEnabled
      ? response?.id || chat.lastResponseId
      : null;
    chat.lastModel = selectedModel;

    if (chat.messages.length === 2 && typeof message === "string") {
      chat.title =
        message.substring(0, 30) + (message.length > 30 ? "..." : "");
    }

    chat.updatedAt = new Date().toISOString();
    await chat.save();

    res.json({
      message: assistantMessage,
      reasoningSummary: reasoningSummary || "",
      chat: chat.toObject(),
    });
  } catch (error) {
    console.error("OpenAI API Error:", error);
    res
      .status(500)
      .json({ error: error?.message || "Failed to get response from OpenAI" });
  }
});

// Upload
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "没有文件上传" });

    res.json({
      success: true,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
      },
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ error: "文件上传失败" });
  }
});

// Start
initChatsFile().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API Key configured: ${openai !== null}`);
    console.log(`OPENAI_STORE enabled: ${storeEnabled}`);
  });
});
