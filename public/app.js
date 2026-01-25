if (typeof marked !== "undefined") {
  marked.setOptions({ gfm: true, breaks: true });
}
let mathTimer = null;

function scheduleMathRender() {
  if (mathTimer) clearTimeout(mathTimer);
  mathTimer = setTimeout(() => {
    try {
      renderMathInMessages();
    } catch (e) {
      console.error("KaTeX render error:", e);
    }
  }, 80);
}

// ======================
// State
// ======================
let currentChatId = null;
let chats = [];
let isLoading = false;

let selectedModel = localStorage.getItem("defaultModel") || "gpt-4o-mini";
let attachments = [];

let systemPrompt = "";
let temperature = 0.7;
let maxTokens = 2000;
let topP = 1.0;
let reasoningEffort = "medium";
let verbosity = 1;
let showReasoningSummary = false;

// ======================
// DOM
// ======================
const modelSelect = document.getElementById("modelSelect");

const newChatBtn = document.getElementById("newChatBtn");
const chatList = document.getElementById("chatList");

const messagesContainer = document.getElementById("messagesContainer");
let jumpToBottomBtn = document.getElementById("jumpToBottomBtn");
const messagesInner = document.getElementById("messagesInner");
const emptyState = document.getElementById("emptyState");
const chatTitleEl = document.getElementById("chatTitle");

const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

const fileInput = document.getElementById("fileInput");
const attachmentsPreview = document.getElementById("attachmentsPreview");

// Ensure jump-to-bottom button exists even if HTML doesn't include it
function ensureJumpToBottomBtn() {
  if (jumpToBottomBtn || !document.body) return;
  const btn = document.createElement("button");
  btn.id = "jumpToBottomBtn";
  btn.type = "button";
  btn.className =
    "hidden fixed right-4 bottom-28 z-40 px-3 py-2 rounded-full bg-slate-900 text-white text-sm shadow-lg hover:bg-slate-800";
  btn.textContent = "⬇ 回到底部";
  document.body.appendChild(btn);
  jumpToBottomBtn = btn;
}

// Mobile Sidebar
const mobileSidebarBtn = document.getElementById("mobileSidebarBtn");
const mobileSidebarOverlay = document.getElementById("mobileSidebarOverlay");
const closeMobileSidebarBtn = document.getElementById("closeMobileSidebarBtn");
const newChatBtnMobile = document.getElementById("newChatBtnMobile");
const chatListMobile = document.getElementById("chatListMobile");

// Settings
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const closeSettingsBtn2 = document.getElementById("closeSettingsBtn2");

const systemPromptInput = document.getElementById("systemPrompt");
const temperatureInput = document.getElementById("temperature");
const tempValueSpan = document.getElementById("tempValue");
const maxTokensInput = document.getElementById("maxTokens");
const maxTokensValueSpan = document.getElementById("maxTokensValue");
const topPInput = document.getElementById("topP");
const topPValueSpan = document.getElementById("topPValue");
const reasoningEffortSelect = document.getElementById("reasoningEffort");
const verbosityInput = document.getElementById("verbosity");
const verbosityValueSpan = document.getElementById("verbosityValue");
const showReasoningSummaryInput = document.getElementById(
  "showReasoningSummary",
);

// ======================
// Init
// ======================
async function init() {
  injectReasoningMarkdownStyles();
  setupEventListeners();

  await checkApiStatus();
  await loadModels();
  await loadChats();

  enableChat();
  autosizeTextarea(messageInput);
}

// ======================
// Reasoning summary formatting helpers
// ======================
// Add spacing between markdown blocks inside reasoning summary (without touching global UI)
function injectReasoningMarkdownStyles() {
  if (document.getElementById("reasoningMarkdownStyle")) return;
  const style = document.createElement("style");
  style.id = "reasoningMarkdownStyle";
  style.textContent = `
    .reasoning-markdown > * + * { margin-top: .75rem; }
    .reasoning-markdown p { margin: 0; }
    .reasoning-markdown ul, .reasoning-markdown ol { padding-left: 1.25rem; }
    .reasoning-markdown pre { margin: 0; }
    .reasoning-markdown blockquote { margin: 0; padding-left: .75rem; border-left: 3px solid rgba(148,163,184,.6); }
  `;
  document.head.appendChild(style);
}

// Heuristic: ensure section titles/headings inside reasoning summary start on a new line.
// This helps when the model outputs "...sentence**Title**" without a newline.
function normalizeReasoningMarkdown(text) {
  let t = (text ?? "").toString();
  if (!t) return t;
  t = t.replace(/\r\n/g, "\n");

  // Ensure markdown headings start on a new paragraph
  t = t.replace(/([^\n])\s*(#{1,6}\s+)/g, "$1\n\n$2");

  // If a bold "section title" follows punctuation/quotes without newline, split it
  t = t.replace(/([。！？.!?"'”’）\)])\s*(\*\*[^*\n]{6,80}\*\*)/g, "$1\n\n$2");

  // Collapse excessive blank lines
  t = t.replace(/\n{3,}/g, "\n\n");
  return t;
}

// Check API status
async function checkApiStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();

    if (!data.hasApiKey) {
      showNotification("后端未配置 OPENAI_API_KEY（请设置 .env）", "error");
      disableChat();
    }
  } catch (error) {
    console.error("Failed to check API status:", error);
    showNotification("无法连接到服务器", "error");
    disableChat();
  }
}

// Load models
async function loadModels() {
  try {
    const response = await fetch("/api/models");
    if (!response.ok) return;

    const models = await response.json();
    modelSelect.innerHTML = "";

    models.forEach((m) => {
      const option = document.createElement("option");
      option.value = m.id;
      option.textContent = m.name || m.id;
      modelSelect.appendChild(option);
    });

    const found = models.find((m) => m.id === selectedModel);
    if (!found && models.length > 0) selectedModel = models[0].id;

    modelSelect.value = selectedModel;
    modelSelect.disabled = false;

    localStorage.setItem("defaultModel", selectedModel);
  } catch (error) {
    console.error("Failed to load models:", error);
  }
}

// Load chats
async function loadChats() {
  try {
    const response = await fetch("/api/chats");
    chats = await response.json();

    renderChatList();

    if (chats.length > 0 && !currentChatId) {
      selectChat(chats[0].id);
    } else if (chats.length === 0) {
      setChatTitle("新对话");
    }
  } catch (error) {
    console.error("Failed to load chats:", error);
  }
}

// ======================
// UI
// ======================
function setChatTitle(title) {
  chatTitleEl.textContent = title || "新对话";
}

function disableChat() {
  messageInput.disabled = true;
  sendBtn.disabled = true;
  modelSelect.disabled = true;
}

function enableChat() {
  messageInput.disabled = false;
  sendBtn.disabled = false;
  modelSelect.disabled = false;
}

function showNotification(message, type = "info") {
  const colors = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-slate-900",
  };

  const notification = document.createElement("div");
  notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-4 py-2 rounded-xl shadow-lg z-50 text-sm`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity .3s";
    setTimeout(() => notification.remove(), 300);
  }, 2500);
}

let autoScrollEnabled = true;

function isNearBottom(threshold = 80) {
  if (!messagesContainer) return true;
  const { scrollTop, clientHeight, scrollHeight } = messagesContainer;
  return scrollTop + clientHeight >= scrollHeight - threshold;
}

function scrollToBottom(force = false) {
  if (!messagesContainer) return;

  if (force || autoScrollEnabled) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    jumpToBottomBtn?.classList.add("hidden");
  } else {
    jumpToBottomBtn?.classList.remove("hidden");
  }
}

function autosizeTextarea(el) {
  if (!el) return;
  const resize = () => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };
  el.addEventListener("input", resize);
  resize();
}

// ======================
// Chat List
// ======================
function renderChatList() {
  const renderInto = (container) => {
    if (!container) return;
    container.innerHTML = "";

    if (chats.length === 0) {
      container.innerHTML =
        '<div class="text-sm text-slate-500 text-center py-6">暂无聊天记录</div>';
      return;
    }

    chats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = `p-3 rounded-xl cursor-pointer border ${
        chat.id === currentChatId
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white hover:bg-slate-50 border-slate-200"
      }`;

      item.onclick = () => {
        selectChat(chat.id);
        closeMobileSidebar();
      };

      item.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate ${
              chat.id === currentChatId ? "text-white" : "text-slate-900"
            }">${escapeHtml(chat.title)}</div>
            <div class="text-xs mt-1 ${
              chat.id === currentChatId ? "text-white/70" : "text-slate-500"
            }">${formatDate(chat.updatedAt)}</div>
          </div>
          <button class="p-1 rounded-lg ${
            chat.id === currentChatId
              ? "hover:bg-white/10"
              : "hover:bg-slate-100"
          }" title="删除"
            onclick="event.stopPropagation(); deleteChat('${chat.id}')">
            <svg class="w-4 h-4 ${
              chat.id === currentChatId ? "text-white/80" : "text-slate-400"
            }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  };

  renderInto(chatList);
  renderInto(chatListMobile);
}

async function createNewChat() {
  try {
    const response = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新对话" }),
    });

    const newChat = await response.json();
    chats.unshift(newChat);
    selectChat(newChat.id);
    renderChatList();

    messageInput.focus();
  } catch (error) {
    console.error("Failed to create chat:", error);
    showNotification("创建对话失败", "error");
  }
}

async function deleteChat(chatId) {
  if (!confirm("确定要删除这个对话吗？")) return;

  try {
    await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    chats = chats.filter((c) => c.id !== chatId);

    if (currentChatId === chatId) {
      currentChatId = null;
      messagesInner.innerHTML = "";
      messagesInner.appendChild(emptyState);
      emptyState.style.display = "block";
      setChatTitle("新对话");
      if (chats.length > 0) selectChat(chats[0].id);
    }

    renderChatList();
    showNotification("已删除", "success");
  } catch (error) {
    console.error("Failed to delete chat:", error);
    showNotification("删除失败", "error");
  }
}

function selectChat(chatId) {
  currentChatId = chatId;
  const chat = chats.find((c) => c.id === chatId);
  if (!chat) return;

  setChatTitle(chat.title || "新对话");
  renderMessages(chat.messages || []);
  renderChatList();
}

// ======================
// Messages
// ======================
function renderMessages(messages) {
  messagesInner.innerHTML = "";

  if (!messages || messages.length === 0) {
    emptyState.style.display = "block";
    messagesInner.appendChild(emptyState);
    return;
  }

  emptyState.style.display = "none";

  messages.forEach((m) => {
    messagesInner.appendChild(buildMessageBubble(m));
  });

  scheduleMathRender();
  enhanceCodeBlocks(messagesInner);
  scrollToBottom();
}

function buildMessageBubble(message) {
  const isUser = message.role === "user";

  const wrap = document.createElement("div");
  wrap.className = `flex ${isUser ? "justify-end" : "justify-start"}`;

  const box = document.createElement("div");
  box.className = "max-w-[90%] md:max-w-[80%]";

  const bubble = document.createElement("div");
  bubble.className = isUser
    ? "bg-slate-900 text-white rounded-2xl px-4 py-3"
    : "bg-white border border-slate-200 text-slate-900 rounded-2xl px-4 py-3 shadow-sm";

  // content
  let html = "";
  let reasoningHtml = "";
  if (Array.isArray(message.content)) {
    // 支持 input_text / input_image（来自 Responses）
    for (const part of message.content) {
      if (part.type === "input_text" || part.type === "text") {
        html += `<div class="whitespace-pre-wrap break-words text-sm md:text-base mb-2">${escapeHtml(part.text || "")}</div>`;
      }
      if (part.type === "input_image") {
        html += `<img src="${escapeHtml(part.image_url)}" class="max-w-full rounded-xl mb-2" alt="image" />`;
      }
      if (part.type === "image_url") {
        const url = part.image_url?.url || "";
        html += `<img src="${escapeHtml(url)}" class="max-w-full rounded-xl mb-2" alt="image" />`;
      }
    }
  } else {
    html = `<div class="markdown-content text-sm md:text-base whitespace-pre-wrap break-words">${formatMarkdownWithMath(
      message.content || "",
    )}</div>`;
  }

  // reasoning summary (show above answer, ChatGPT-like)
  if (!isUser && message.reasoningSummary) {
    reasoningHtml = `
      <details class="mb-3">
        <summary class="text-xs text-slate-500 cursor-pointer select-none">思考摘要</summary>
        <div class="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2">
          <div class="reasoning-markdown markdown-content break-words">${formatMarkdownWithMath(
            normalizeReasoningMarkdown(message.reasoningSummary),
          )}</div>
        </div>
      </details>
    `;
  }

  // attachments (避免重复展示图片：如果 content 已包含 input_image，就只展示非图片附件)
  const contentHasImage =
    Array.isArray(message.content) &&
    message.content.some(
      (p) => p.type === "input_image" || p.type === "image_url",
    );

  if (message.attachments && message.attachments.length > 0) {
    const files = message.attachments.filter((a) => {
      if (contentHasImage && a.mimetype?.startsWith("image/")) return false;
      return true;
    });

    if (files.length > 0) {
      html += `<div class="mt-2 space-y-1">`;
      for (const att of files) {
        if (att.mimetype?.startsWith("image/")) {
          html += `<img src="${escapeHtml(att.url)}" class="max-w-xs rounded-xl border border-slate-200" alt="${escapeHtml(
            att.originalname,
          )}" />`;
        } else {
          html += `<div class="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 inline-flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
            </svg>
            <span class="truncate max-w-[220px]">${escapeHtml(att.originalname)}</span>
          </div>`;
        }
      }
      html += `</div>`;
    }
  }

  bubble.innerHTML = `${reasoningHtml}${html}`;
  box.appendChild(bubble);

  const meta = document.createElement("div");
  meta.className = `text-[11px] mt-1 ${isUser ? "text-right text-slate-500" : "text-left text-slate-500"}`;
  meta.textContent = formatTime(message.timestamp || new Date().toISOString());
  box.appendChild(meta);

  wrap.appendChild(box);
  return wrap;
}

// ======================
// Streaming send
// ======================
// ======================
// Streaming send
// ======================
async function sendMessage(content) {
  if ((!content.trim() && attachments.length === 0) || isLoading) return;

  // create chat if needed
  if (!currentChatId) await createNewChat();

  const chat = chats.find((c) => c.id === currentChatId);
  if (!chat) return;

  // optimistic user message
  const attachmentsToSend = attachments.length > 0 ? [...attachments] : [];

  const userMessage = {
    role: "user",
    content: content,
    timestamp: new Date().toISOString(),
    attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
  };
  chat.messages.push(userMessage);

  // ✅ Clear composer attachments immediately (avoid next message re-sending files)
  attachments = [];
  renderAttachments();
  if (fileInput) fileInput.value = "";

  // ✅ 立刻把用户消息渲染出来（不需要全量 renderMessages）
  emptyState.style.display = "none";
  const userBubble = buildMessageBubble(userMessage);
  messagesInner.appendChild(userBubble);
  renderMathInElementSafe(userBubble);
  autoScrollEnabled = true;
  scrollToBottom(true);

  // lock UI
  isLoading = true;
  messageInput.disabled = true;
  sendBtn.disabled = true;

  // stream placeholder assistant bubble
  const placeholder = createStreamingAssistantBubble();
  messagesInner.appendChild(placeholder.wrap);
  scrollToBottom(true);

  try {
    const payload = {
      message: content,
      chatId: currentChatId,
      model: modelSelect.value || selectedModel,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,

      systemPrompt: systemPrompt || undefined,
      temperature,
      maxTokens,
      topP,
      reasoningEffort,
      verbosity,

      showReasoningSummary,
      stream: true, // ✅ enable streaming
    };

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "发送失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let assistantText = "";
    let reasoningText = "";

    let gotFinal = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const block of parts) {
        const lines = block.split("\n").filter(Boolean);

        const dataLines = lines
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.replace(/^data:\s*/, ""));

        if (dataLines.length === 0) continue;

        const raw = dataLines.join("\n").trim();
        if (!raw || raw === "[DONE]") continue;

        let evt;
        try {
          evt = JSON.parse(raw);
        } catch {
          continue;
        }

        if (evt.type === "meta") {
          // Show thinking feedback immediately
          placeholder.setThinking?.(true, "思考中…");
        }

        if (evt.type === "delta") {
          assistantText += evt.delta || "";
          // First token => stop "thinking"
          if (assistantText.trim().length > 0) placeholder.setThinking?.(false);

          // ✅ 边输出边渲染（节流）
          scheduleLiveRender(placeholder, () => assistantText, 120);
        }

        if (evt.type === "reasoning_delta") {
          reasoningText += evt.delta || "";
          placeholder.thinkingWrap.classList.remove("hidden");

          // Render reasoning summary as markdown + math (throttled)
          placeholder.__latestReasoning = reasoningText;
          if (!placeholder.__reasoningTimer) {
            placeholder.__reasoningTimer = setTimeout(() => {
              placeholder.__reasoningTimer = null;
              const rt = placeholder.__latestReasoning || "";
              placeholder.thinkingEl.innerHTML = `<div class="reasoning-markdown markdown-content break-words">${formatMarkdownWithMath(
                normalizeReasoningMarkdown(rt),
              )}</div>`;
              renderMathInElementSafe(placeholder.thinkingEl);
              enhanceCodeBlocks(placeholder.thinkingEl);
              scrollToBottom();
            }, 140);
          } else {
            scrollToBottom();
          }
        }

        if (evt.type === "final") {
          gotFinal = true;
          placeholder.setThinking?.(false);

          if (evt.partial) {
            showNotification(
              `连接中断：已显示部分结果${evt.error ? "（" + evt.error + "）" : ""}`,
              "error",
            );
          }

          const updatedChat = evt.chat;
          const idx = chats.findIndex((c) => c.id === updatedChat.id);
          if (idx >= 0) chats[idx] = updatedChat;
          else chats.unshift(updatedChat);

          currentChatId = updatedChat.id;
          setChatTitle(updatedChat.title || "新对话");

          renderChatList();
          renderMessages(updatedChat.messages || []);

          attachments = [];
          renderAttachments();
        }

        if (evt.type === "error") {
          // Backend streaming failure (we may still have partial text)
          showNotification(evt.error || "流式输出失败", "error");
        }
      }
    }

    if (!gotFinal) {
      if (assistantText && assistantText.trim()) {
        showNotification("连接中断：已显示部分内容，可点击重试继续", "error");
      } else {
        showNotification("生成中断（未收到最终结果），可以重试", "error");
      }
    }
  } catch (error) {
    console.error("sendMessage error:", error);
    showNotification(error.message || "发送失败，请重试", "error");
  } finally {
    isLoading = false;
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function createStreamingAssistantBubble() {
  const wrap = document.createElement("div");
  wrap.className = "flex justify-start";

  const box = document.createElement("div");
  box.className = "max-w-[90%] md:max-w-[80%]";

  const bubble = document.createElement("div");
  bubble.className =
    "bg-white border border-slate-200 text-slate-900 rounded-2xl px-4 py-3 shadow-sm";

  // Thinking indicator (ChatGPT-like feedback)
  const statusEl = document.createElement("div");
  statusEl.className = "flex items-center gap-2 text-xs text-slate-500 mb-2";
  statusEl.innerHTML = `
    <svg class="w-3.5 h-3.5 animate-spin text-slate-400" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
      <path class="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8v2a6 6 0 00-6 6H4z"></path>
    </svg>
    <span class="thinking-label">思考中…</span>
  `;

  const thinkingWrap = document.createElement("details");
  thinkingWrap.className = "mb-3 hidden";
  thinkingWrap.open = true;
  thinkingWrap.innerHTML = `<summary class="text-xs text-slate-500 cursor-pointer select-none">思考摘要</summary>`;

  const thinkingEl = document.createElement("div");
  thinkingEl.className =
    "mt-2 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-2";
  thinkingWrap.appendChild(thinkingEl);

  const textEl = document.createElement("div");
  textEl.className = "text-sm md:text-base break-words";
  textEl.innerHTML = "";

  // Order: status -> reasoning -> answer
  bubble.appendChild(statusEl);
  bubble.appendChild(thinkingWrap);
  bubble.appendChild(textEl);

  box.appendChild(bubble);

  const meta = document.createElement("div");
  meta.className = "text-[11px] text-left text-slate-500 mt-1";
  meta.textContent = formatTime(new Date().toISOString());
  box.appendChild(meta);

  wrap.appendChild(box);

  const setThinking = (on, label = "思考中…") => {
    statusEl.classList.toggle("hidden", !on);
    const span = statusEl.querySelector(".thinking-label");
    if (span && label) span.textContent = label;
  };

  // Show thinking by default when placeholder is created
  setThinking(true);

  return { wrap, textEl, thinkingWrap, thinkingEl, setThinking };
}

// ======================
// Attachments
// ======================
async function handleFileSelect(e) {
  const files = Array.from(e.target.files || []);
  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      attachments.push(data.file);
    } catch (error) {
      console.error("File upload error:", error);
      showNotification(`文件上传失败: ${file.name}`, "error");
    }
  }

  renderAttachments();
  fileInput.value = "";
}

function renderAttachments() {
  if (!attachmentsPreview) return;

  if (attachments.length === 0) {
    attachmentsPreview.classList.add("hidden");
    attachmentsPreview.innerHTML = "";
    return;
  }

  attachmentsPreview.classList.remove("hidden");
  attachmentsPreview.innerHTML = attachments
    .map(
      (att, index) => `
    <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
      ${
        att.mimetype?.startsWith("image/")
          ? `<img src="${att.url}" class="w-10 h-10 object-cover rounded-lg border border-slate-200" />`
          : `<div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
              <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
            </div>`
      }
      <div class="text-sm text-slate-700 truncate max-w-[220px]">${escapeHtml(att.originalname)}</div>
      <button class="ml-1 text-red-600 hover:text-red-700" onclick="removeAttachment(${index})">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `,
    )
    .join("");
}

window.removeAttachment = function (index) {
  attachments.splice(index, 1);
  renderAttachments();
};

// ======================
// Settings Modal
// ======================
function openSettings() {
  settingsModal.classList.remove("hidden");
  settingsModal.classList.add("flex");
}

function closeSettings() {
  settingsModal.classList.add("hidden");
  settingsModal.classList.remove("flex");
}

// ======================
// Events
// ======================
function setupEventListeners() {
  ensureJumpToBottomBtn();

  // Smart autoscroll like ChatGPT (allow user to scroll up during streaming)
  let lastScrollTop = 0;
  const onScroll = () => {
    if (!messagesContainer) return;
    const st = messagesContainer.scrollTop;
    const scrollingUp = st < lastScrollTop - 3;

    if (scrollingUp) {
      autoScrollEnabled = false;
    } else if (isNearBottom(140)) {
      autoScrollEnabled = true;
    }

    lastScrollTop = st;

    if (autoScrollEnabled) jumpToBottomBtn?.classList.add("hidden");
    else jumpToBottomBtn?.classList.remove("hidden");
  };

  if (messagesContainer) {
    messagesContainer.addEventListener("scroll", onScroll, { passive: true });
    // Initialize state
    onScroll();
  }

  if (jumpToBottomBtn) {
    jumpToBottomBtn.addEventListener("click", () => {
      autoScrollEnabled = true;
      scrollToBottom(true);
    });
  }

  // new chat

  // new chat
  newChatBtn?.addEventListener("click", createNewChat);
  newChatBtnMobile?.addEventListener("click", () => {
    createNewChat();
    closeMobileSidebar();
  });

  // mobile sidebar
  mobileSidebarBtn?.addEventListener("click", openMobileSidebar);
  closeMobileSidebarBtn?.addEventListener("click", closeMobileSidebar);
  mobileSidebarOverlay?.addEventListener("click", (e) => {
    if (e.target === mobileSidebarOverlay) closeMobileSidebar();
  });

  // settings
  settingsBtn?.addEventListener("click", openSettings);
  closeSettingsBtn?.addEventListener("click", closeSettings);
  closeSettingsBtn2?.addEventListener("click", closeSettings);
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });

  // model change
  modelSelect?.addEventListener("change", (e) => {
    selectedModel = e.target.value;
    localStorage.setItem("defaultModel", selectedModel);
  });

  // message form
  messageForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const content = messageInput.value;
    if (content.trim() || attachments.length > 0) {
      sendMessage(content);
      messageInput.value = "";
      messageInput.dispatchEvent(new Event("input"));
    }
  });

  // enter send / shift+enter newline
  messageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      messageForm.dispatchEvent(new Event("submit"));
    }
  });

  // file upload
  fileInput?.addEventListener("change", handleFileSelect);

  // settings values
  systemPromptInput?.addEventListener("input", (e) => {
    systemPrompt = e.target.value;
  });

  temperatureInput?.addEventListener("input", (e) => {
    temperature = parseFloat(e.target.value);
    tempValueSpan.textContent = temperature.toFixed(1);
  });

  maxTokensInput?.addEventListener("input", (e) => {
    maxTokens = parseInt(e.target.value);
    maxTokensValueSpan.textContent = maxTokens;
  });

  topPInput?.addEventListener("input", (e) => {
    topP = parseFloat(e.target.value);
    topPValueSpan.textContent = topP.toFixed(2);
  });

  reasoningEffortSelect?.addEventListener("change", (e) => {
    reasoningEffort = e.target.value;
  });

  verbosityInput?.addEventListener("input", (e) => {
    verbosity = parseInt(e.target.value);
    verbosityValueSpan.textContent = verbosity;
  });

  showReasoningSummaryInput?.addEventListener("change", (e) => {
    showReasoningSummary = !!e.target.checked;
  });
}

// Mobile sidebar helpers
function openMobileSidebar() {
  if (!mobileSidebarOverlay) return;
  mobileSidebarOverlay.classList.remove("hidden");
}

function closeMobileSidebar() {
  if (!mobileSidebarOverlay) return;
  mobileSidebarOverlay.classList.add("hidden");
}

// ======================
// Utils
// ======================
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// markdown (lightweight)
// markdown -> html (safe) + keep math intact for KaTeX
function formatMarkdownWithMath(text) {
  const raw = (text ?? "").toString();

  if (typeof marked === "undefined") {
    return escapeHtml(raw).replace(/\n/g, "<br/>");
  }

  // 1) Protect math blocks before marked parsing
  const mathStore = [];
  const pushMath = (m) => {
    const id = mathStore.length;
    mathStore.push(m);
    return `@@MATH_${id}@@`;
  };

  let protectedText = raw;

  // block math $$...$$ (multi-line)
  protectedText = protectedText.replace(/\$\$([\s\S]+?)\$\$/g, (m) =>
    pushMath(m),
  );

  // display \[...\]
  protectedText = protectedText.replace(/\\\[([\s\S]+?)\\\]/g, (m) =>
    pushMath(m),
  );

  // inline \( ... \)
  protectedText = protectedText.replace(/\\\(([\s\S]+?)\\\)/g, (m) =>
    pushMath(m),
  );

  // inline $...$ (single-line)
  protectedText = protectedText.replace(
    /(^|[^\\$])\$(?!\$)([^$\n]+?)\$(?!\$)/g,
    (m, prefix, inner) => `${prefix}${pushMath(`$${inner}$`)}`,
  );

  // 2) marked parse
  // ⚠️ 不要在这里反复 setOptions（多次调用也可能导致异常行为）
  let html = marked.parse(protectedText);

  // 3) sanitize
  if (typeof DOMPurify !== "undefined") {
    html = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }

  // 4) restore math placeholders in ONE pass (✅避免 replaceAll 循环炸栈)
  html = html.replace(/@@MATH_(\d+)@@/g, (_, idx) => {
    const i = Number(idx);
    return escapeHtml(mathStore[i] ?? "");
  });

  return html;
}

// KaTeX render
function renderMathInMessages() {
  if (typeof renderMathInElement !== "undefined") {
    renderMathInElement(messagesContainer, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    });
  }
}

// ✅ 只渲染某一个元素里的公式（避免全页面扫描）
function renderMathInElementSafe(el) {
  if (!el) return;
  if (typeof renderMathInElement === "undefined") return;

  renderMathInElement(el, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  });
}

// ✅ 流式边输出边渲染：节流（避免每个 token 都渲染炸栈）

function enhanceCodeBlocks(rootEl) {
  if (!rootEl) return;

  // Syntax highlight if highlight.js is available
  const codeBlocks = rootEl.querySelectorAll("pre code");
  codeBlocks.forEach((codeEl) => {
    try {
      if (window.hljs && !codeEl.classList.contains("hljs")) {
        window.hljs.highlightElement(codeEl);
      }
    } catch {}
  });

  // Add copy buttons
  const pres = rootEl.querySelectorAll("pre");
  pres.forEach((pre) => {
    pre.classList.add("relative");
    if (pre.querySelector(".code-copy-btn")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "code-copy-btn absolute top-2 right-2 text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white/90 text-slate-700 hover:bg-slate-50";
    btn.textContent = "复制";

    btn.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.innerText || "";
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "已复制";
        setTimeout(() => (btn.textContent = "复制"), 900);
      } catch {
        btn.textContent = "失败";
        setTimeout(() => (btn.textContent = "复制"), 900);
      }
    });

    pre.appendChild(btn);
  });
}

function scheduleLiveRender(placeholder, getTextFn, delay = 120) {
  if (!placeholder) return;

  // 记录最新文本
  placeholder.__latestText = getTextFn();

  // 已经排队就不重复排
  if (placeholder.__liveTimer) return;

  placeholder.__liveTimer = setTimeout(() => {
    placeholder.__liveTimer = null;

    const t = placeholder.__latestText || "";

    // Markdown 渲染到 HTML
    placeholder.textEl.innerHTML = `<div class="markdown-content">${formatMarkdownWithMath(t)}</div>`;

    // 只在这个气泡里渲染公式（很关键）
    renderMathInElementSafe(placeholder.textEl);
    enhanceCodeBlocks(placeholder.textEl);

    scrollToBottom();
  }, delay);
}

// ======================
// Start
// ======================
init();
