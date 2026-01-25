# AI Chat - OpenAI 聊天应用

一个现代化的 OpenAI 聊天应用，采用玻璃态 (Glassmorphism) 设计风格，提供优雅的用户界面和流畅的交互体验。

## ? 特性

- ? **现代设计** - 采用玻璃态设计，渐变背景动画
- ? **多对话管理** - 创建、切换和删除多个聊天会话
- ? **持久化存储** - 自动保存所有聊天记录到本地文件
- ? **安全配置** - 后端存储 API 密钥，前端不暴露
- ? **响应式设计** - 完美适配桌面和移动设备
- ? **无障碍支持** - 支持键盘导航和动画偏好设置

## ? 快速开始

### 前置要求

- Node.js 14+ 
- OpenAI API Key ([获取地址](https://platform.openai.com/api-keys))

### 安装步骤

1. **克隆或进入项目目录**
```bash
cd AIGUI
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
# 复制环境变量模板
copy .env.example .env

# 编辑 .env 文件，添加你的 OpenAI API Key
# OPENAI_API_KEY=sk-your-api-key-here
```

4. **启动服务器**
```bash
npm start
```

5. **打开浏览器**
访问 http://localhost:3000

## ? 使用方法

### 首次使用

1. 启动应用后，会自动弹出 API 配置窗口
2. 输入你的 OpenAI API Key
3. 点击"保存"完成配置

### 创建对话

- 点击左侧边栏的 **"+"** 按钮创建新对话
- 或直接在输入框输入消息，系统会自动创建新对话

### 发送消息

- 在底部输入框输入消息
- 按 **Enter** 键或点击"发送"按钮
- 支持 **Shift + Enter** 换行

### 管理对话

- 点击左侧边栏的对话标题切换对话
- 点击对话右侧的删除按钮删除对话
- 对话按更新时间自动排序

## ? 项目结构

```
AIGUI/
├── public/              # 前端文件
│   ├── index.html      # 主页面
│   └── app.js          # 前端逻辑
├── server.js           # 后端服务器
├── chats.json          # 聊天记录存储 (自动生成)
├── .env                # 环境变量配置
├── .env.example        # 环境变量模板
├── package.json        # 项目依赖
└── README.md          # 项目文档
```

## ?? 技术栈

### 后端
- **Node.js** - 运行时环境
- **Express** - Web 框架
- **OpenAI SDK** - OpenAI API 客户端
- **dotenv** - 环境变量管理

### 前端
- **HTML5** - 页面结构
- **Tailwind CSS** - 样式框架
- **Vanilla JavaScript** - 前端逻辑
- **Google Fonts** - Poppins & Open Sans 字体

## ? 设计规范

本项目遵循专业 UI/UX 最佳实践：

- **配色方案**: Trust Blue (#2563EB) + 橙色 CTA (#F97316)
- **字体**: Poppins (标题) + Open Sans (正文)
- **风格**: 玻璃态 + 现代极简
- **动画**: 支持 prefers-reduced-motion
- **响应式**: 移动优先设计

## ? 配置选项

### 环境变量

在 `.env` 文件中配置：

```env
# OpenAI API 密钥
OPENAI_API_KEY=sk-your-api-key-here

# 服务器端口 (可选，默认 3000)
PORT=3000
```

### API 配置

也可以在应用内配置 API Key：
- 点击右上角"配置 API"按钮
- 输入新的 API Key
- 无需重启服务器

## ? API 接口

### 获取状态
```
GET /api/status
```

### 配置 API Key
```
POST /api/config
Body: { "apiKey": "sk-..." }
```

### 获取所有对话
```
GET /api/chats
```

### 创建新对话
```
POST /api/chats
Body: { "title": "New Chat" }
```

### 删除对话
```
DELETE /api/chats/:id
```

### 发送消息
```
POST /api/chat
Body: { "message": "Hello", "chatId": "123" }
```

## ? 故障排除

### 端口被占用
```bash
# 修改 .env 文件中的 PORT 值
PORT=3001
```

### API Key 无效
- 检查 `.env` 文件中的 API Key 是否正确
- 确认 API Key 有足够的额度
- 在 [OpenAI Platform](https://platform.openai.com/api-keys) 检查 Key 状态

### 无法连接服务器
- 确认 Node.js 已正确安装
- 检查是否已运行 `npm install`
- 查看终端是否有错误信息

## ? 许可证

MIT License

## ? 致谢

- [OpenAI](https://openai.com/) - 提供强大的 AI 能力
- [Tailwind CSS](https://tailwindcss.com/) - 优秀的 CSS 框架
- [Google Fonts](https://fonts.google.com/) - 免费字体资源

---

**提示**: 首次使用请确保已配置 OpenAI API Key，否则无法发送消息。