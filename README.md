# AI Chat - OpenAI 聊天应用

一个现代化的 OpenAI 聊天应用，采用玻璃态 (Glassmorphism) 设计风格，提供优雅的用户界面和流畅的交互体验。

## ? 特性

- ? **现代设计** - 采用玻璃态设计，渐变背景动画
- ? **多对话管理** - 创建、切换和删除多个聊天会话
- ? **MongoDB 存储** - 使用 MongoDB 数据库持久化存储所有聊天记录
- ? **安全配置** - 后端存储 API 密钥，前端不暴露
- ? **响应式设计** - 完美适配桌面和移动设备
- ? **无障碍支持** - 支持键盘导航和动画偏好设置

## ? 快速开始

### 前置要求

- Node.js 14+ 
- MongoDB 4.4+ (本地安装或 MongoDB Atlas 云服务)
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

# 编辑 .env 文件，添加你的配置
# OPENAI_API_KEY=sk-your-api-key-here
# MONGODB_URI=mongodb://localhost:27017/aigui
```

**MongoDB 配置选项：**
- **本地 MongoDB**: `mongodb://localhost:27017/aigui`
- **MongoDB Atlas**: `mongodb+srv://username:password@cluster.mongodb.net/aigui?retryWrites=true&w=majority`

**如何安装本地 MongoDB：**
- Windows: 访问 [MongoDB 下载页](https://www.mongodb.com/try/download/community)
- macOS: `brew install mongodb-community`
- Linux: 参考 [MongoDB 官方文档](https://docs.mongodb.com/manual/installation/)

**使用 MongoDB Atlas (云服务，推荐)：**
1. 访问 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 创建免费集群
3. 获取连接字符串
4. 添加到 `.env` 文件的 `MONGODB_URI`

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
├── uploads/            # 文件上传目录 (自动生成)
├── server.js           # 后端服务器
├── .env                # 环境变量配置
├── .env.example        # 环境变量模板
├── package.json        # 项目依赖
└── README.md          # 项目文档
```

**数据存储**: 使用 MongoDB 数据库
- 数据库名: `aigui`
- 集合名: `chats`

## ?? 技术栈

### 后端
- **Node.js** - 运行时环境
- **Express** - Web 框架
- **MongoDB** - NoSQL 数据库
- **Mongoose** - MongoDB ODM (对象文档映射)
- **OpenAI SDK** - OpenAI API 客户端
- **dotenv** - 环境变量管理
- **Multer** - 文件上传处理

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

# MongoDB 连接字符串
MONGODB_URI=mongodb://localhost:27017/aigui

# OpenAI Store (启用聊天历史续写功能)
OPENAI_STORE=1

# 服务器端口 (可选，默认 3000)
PORT=3000

# 代理配置 (可选)
# HTTP_PROXY=http://127.0.0.1:7897
# HTTPS_PROXY=http://127.0.0.1:7897
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

### MongoDB 连接失败
```bash
# 确保 MongoDB 服务正在运行
# Windows (以管理员身份运行):
net start MongoDB

# macOS/Linux:
sudo systemctl start mongod
# 或
brew services start mongodb-community

# 检查连接字符串是否正确
# 本地: mongodb://localhost:27017/aigui
# Atlas: mongodb+srv://...
```

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
- 确认 MongoDB 服务正在运行
- 检查是否已运行 `npm install`
- 查看终端是否有错误信息

### 数据迁移
如果你之前使用的是 `chats.json` 文件存储，需要迁移数据：
```bash
# 可以使用 MongoDB Compass 或命令行工具导入数据
# 或者联系开发者获取迁移脚本
```

## ? 许可证

MIT License

## ? 致谢

- [OpenAI](https://openai.com/) - 提供强大的 AI 能力
- [MongoDB](https://www.mongodb.com/) - 灵活的 NoSQL 数据库
- [Tailwind CSS](https://tailwindcss.com/) - 优秀的 CSS 框架
- [Google Fonts](https://fonts.google.com/) - 免费字体资源

---

**提示**: 首次使用请确保已配置 OpenAI API Key 和 MongoDB 连接，否则无法正常使用。