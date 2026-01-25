const express = require("express");
const cors = require("cors");
const fs = require("fs").promises; // 依然需要 fs 处理上传的临时文件
const path = require("path");
const { HttpsProxyAgent } = require("https-proxy-agent");
const multer = require("multer");
const mongoose = require("mongoose"); // ✅ 新增：引入 mongoose
require("dotenv").config();

const OpenAI = require("openai");

const app = express();
// ✅ 重要：云端部署必须监听 0.0.0.0，否则可能外网访问不了
const PORT = process.env.PORT || 3000;

// ========== Database Connection ==========
// ✅ 新增：连接 MongoDB
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.warn("⚠️ 警告: 未配置 MONGODB_URI，数据将无法保存！");
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch((err) => console.error("❌ MongoDB Connection Error:", err));
}

// ✅ 新增：定义聊天记录的数据结构 (Schema)
const MessageSchema = new mongoose.Schema({
  role: String,
  content: mongoose.Schema.Types.Mixed, // 支持字符串或数组(多模态)
  reasoningSummary: String,
  timestamp: String,
  partial: Boolean,
  error: String,
  attachments: Array,
});

const ChatSchema = new mongoose.Schema({
  id: { type: String, unique: true }, // 保持你原有的 ID 逻辑
  title: String,
  messages: [MessageSchema],
  createdAt: String,
  updatedAt: String,
  lastResponseId: String,
  lastModel: String,
  systemPrompt: String,
});

const Chat = mongoose.model("Chat", ChatSchema);

// ========== Middleware ==========
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// ========== Multer Upload (保持不变) ==========
// 注意：Render 上这些上传的文件重启后还是会消失。
// 如果要永久保存图片，需要接入 AWS S3 或类似服务，目前先保持现状。
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

// ========== OpenAI Client (保持不变) ==========
let openai = null;
function buildOpenAIClient(apiKey) {
  const config = { apiKey };
  if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    config.httpAgent = new HttpsProxyAgent(proxyUrl);
  }
  return new OpenAI(config);
}
if (process.env.OPENAI_API_KEY) {
  openai = buildOpenAIClient(process.env.OPENAI_API_KEY);
}
const storeEnabled = process.env.OPENAI_STORE === "1";

// ========== Helpers (保持不变) ==========
function formatModelName(modelId) {
  /* ...省略，保持原样... */ return modelId;
}
function modelSupportsVision(model) {
  const m = (model || "").toLowerCase();
  return m.includes("4o") || m.includes("vision");
}
function isReasoningModel(model) {
  const m = (model || "").toLowerCase();
  return m.startsWith("gpt-5") || m.includes("o1") || m.includes("o3");
}
function supportsNativeVerbosity(model) {
  return (model || "").toLowerCase().startsWith("gpt-5");
}
function normalizeVerbosity(v) {
  /* ...省略... */ return null;
}

function normalizeToInputParts(content) {
  if (Array.isArray(content)) return content;
  return [{ type: "input_text", text: (content ?? "").toString() }];
}

// 辅助函数：处理图片转 Base64 (Render 无法持久存储文件，建议图片尽可能转 Base64 存入 DB 或者忽略丢失风险)
async function localImageToDataURL(att) {
  // 这里简单处理：如果文件存在，转 Base64；如果文件被 Render 删了，可能报错
  // 生产环境应该把图片上传到 S3
  try {
    const rel = (att.url || "").replace(/^\/+/, "");
    const absPath = path.join(__dirname, rel);
    const buf = await fs.readFile(absPath);
    const base64 = buf.toString("base64");
    const mime = att.mimetype || "image/png";
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    console.error("Image read error:", e);
    return null;
  }
}

function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ========== API Routes (逻辑已修改为数据库操作) ==========

app.get("/api/status", (req, res) => {
  res.json({
    hasApiKey: openai !== null,
    ready: openai !== null,
    storeEnabled,
  });
});

app.get("/api/models", async (req, res) => {
  // ...保持原样，省略以节省空间...
  // 这里代码和你原来的一样
  if (!openai) return res.status(400).json({ error: "No API Key" });
  try {
    const response = await openai.models.list();
    const models = response.data.map((m) => ({ id: m.id, name: m.id }));
    res.json(models);
  } catch {
    res.json([{ id: "gpt-4o-mini", name: "GPT-4o Mini" }]);
  }
});

// ✅ 改动：从数据库读取所有对话
app.get("/api/chats", async (req, res) => {
  try {
    const chats = await Chat.find().sort({ updatedAt: -1 }); // 按时间倒序
    res.json(chats);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to read chats" });
  }
});

// ✅ 改动：在数据库创建新对话
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
    await newChat.save(); // 保存到 MongoDB
    res.json(newChat);
  } catch (e) {
    res.status(500).json({ error: "Failed to create chat" });
  }
});

// ✅ 改动：从数据库删除
app.delete("/api/chats/:id", async (req, res) => {
  try {
    await Chat.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

// ✅ 改动：重置对话状态
app.post("/api/chat/reset/:id", async (req, res) => {
  try {
    const chat = await Chat.findOne({ id: req.params.id });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    chat.lastResponseId = null;
    chat.lastModel = null;
    chat.updatedAt = new Date().toISOString();
    await chat.save();

    res.json({ success: true, chat });
  } catch (e) {
    res.status(500).json({ error: "Failed to reset chat" });
  }
});

// ========== Chat Response Logic (关键修改) ==========
app.post("/api/chat", async (req, res) => {
  const { message, chatId, model, attachments, systemPrompt, stream } =
    req.body || {};

  if (!openai) return res.status(400).json({ error: "No API Key" });

  try {
    // ✅ 1. 从数据库查找 Chat
    const chat = await Chat.findOne({ id: chatId });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // 更新基础字段
    if (typeof systemPrompt === "string") chat.systemPrompt = systemPrompt;
    if (chat.lastModel && chat.lastModel !== model) chat.lastResponseId = null;

    // ✅ 2. 构建 User Message
    const userMessage = {
      role: "user",
      content: message || "",
      timestamp: new Date().toISOString(),
      attachments: attachments || [],
    };

    // 处理图片 (Vision)
    if (attachments && attachments.length > 0 && modelSupportsVision(model)) {
      const parts = [];
      if (message) parts.push({ type: "input_text", text: message });
      for (const att of attachments) {
        // 简化处理：尝试读文件转 Base64
        let imageUrl = att.url;
        if (!imageUrl.startsWith("http")) {
          imageUrl = await localImageToDataURL(att);
        }
        if (imageUrl) {
          parts.push({ type: "input_image", image_url: { url: imageUrl } });
        }
      }
      if (parts.length > 0) userMessage.content = parts;
    }

    // ✅ 3. 保存 User Message 到数据库 (防止推流失败导致数据丢失)
    chat.messages.push(userMessage);
    await chat.save();

    // 准备发送给 OpenAI 的数据 (历史记录)
    const apiMessages = chat.messages.map((m) => ({
      role: m.role,
      content: normalizeToInputParts(m.content),
    }));
    // 如果不开 Store，就需要把所有历史都发过去。如果开 Store，逻辑可优化(这里简化为发全部以保证上下文)

    const apiParams = {
      model: model || "gpt-4o-mini",
      messages: apiMessages, // 注意：旧版 SDK 用 messages, 新版 responses API 结构不同，这里假设你用 Chat Completions 或适配 Responses
      // ... 其他参数 ...
      stream: true, // 强制流式方便演示
    };

    // ========== 这里简化了你的 OpenAI 调用逻辑，适配 Mongoose ==========
    // 这里的核心思想是：在收到 OpenAI 回复后，更新 chat 对象并 save()

    // (为了代码简洁，这里假设你已经处理了 Stream 逻辑，重点是最后一步)

    // ... 模拟 OpenAI 流式返回 assistantText ...

    // 假设流式结束：
    // chat.messages.push({ role: "assistant", content: assistantText ... });
    // chat.updatedAt = new Date().toISOString();
    // await chat.save(); // ✅ 关键：保存回复到数据库

    // 由于你的原始代码很长，这里通过文字说明：
    // 请在你原本的 `await writeChats(data)` 的地方，
    // 全部替换为 `await chat.save()`。
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error" });
  }
});

// Upload (保持不变)
app.post("/api/upload", upload.single("file"), async (req, res) => {
  // ... 保持不变 ...
  if (req.file)
    res.json({ success: true, file: { url: `/uploads/${req.file.filename}` } });
});

// ✅ 启动服务
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
