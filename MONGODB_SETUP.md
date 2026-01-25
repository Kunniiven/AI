# MongoDB 设置指南

本文档将帮助你快速配置 MongoDB 数据库以用于 AI Chat 应用。

## 选项 1: MongoDB Atlas (云服务 - 推荐)

**优点**: 免费、无需本地安装、自动备份、全球访问

### 步骤：

1. **注册账户**
   - 访问 https://www.mongodb.com/cloud/atlas
   - 点击 "Try Free" 注册免费账户

2. **创建集群**
   - 登录后选择 "Build a Database"
   - 选择 **FREE** (M0) 共享集群
   - 选择云服务商和地区（推荐选择距离你最近的区域）
   - 点击 "Create Cluster"

3. **配置数据库访问**
   - 进入 "Database Access"
   - 点击 "Add New Database User"
   - 设置用户名和密码（记住这些信息！）
   - 选择权限: "Read and write to any database"
   - 点击 "Add User"

4. **配置网络访问**
   - 进入 "Network Access"
   - 点击 "Add IP Address"
   - 选择 "Allow Access from Anywhere" (0.0.0.0/0)
   - 点击 "Confirm"

5. **获取连接字符串**
   - 回到 "Database" 页面
   - 点击 "Connect" 按钮
   - 选择 "Connect your application"
   - 复制连接字符串，格式如下：
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```

6. **配置应用**
   - 打开 `.env` 文件
   - 替换 `<username>` 和 `<password>` 为你创建的数据库用户凭据
   - 添加数据库名称 `/aigui`：
     ```env
     MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.xxxxx.mongodb.net/aigui?retryWrites=true&w=majority
     ```

## 选项 2: 本地 MongoDB

### Windows 安装

1. **下载 MongoDB**
   - 访问 https://www.mongodb.com/try/download/community
   - 下载 Windows 版本的 .msi 安装包

2. **安装**
   - 运行安装程序
   - 选择 "Complete" 完整安装
   - 勾选 "Install MongoDB as a Service"
   - 勾选 "Install MongoDB Compass" (图形化管理工具)

3. **启动服务**
   ```powershell
   # 以管理员身份运行 PowerShell
   net start MongoDB
   ```

4. **配置环境变量**
   - 打开 `.env` 文件
   - 添加：
     ```env
     MONGODB_URI=mongodb://localhost:27017/aigui
     ```

### macOS 安装

1. **使用 Homebrew 安装**
   ```bash
   # 安装 MongoDB
   brew tap mongodb/brew
   brew install mongodb-community
   
   # 启动服务
   brew services start mongodb-community
   ```

2. **配置环境变量**
   ```env
   MONGODB_URI=mongodb://localhost:27017/aigui
   ```

### Linux 安装

1. **Ubuntu/Debian**
   ```bash
   # 导入公钥
   wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
   
   # 创建列表文件
   echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
   
   # 安装
   sudo apt-get update
   sudo apt-get install -y mongodb-org
   
   # 启动服务
   sudo systemctl start mongod
   sudo systemctl enable mongod
   ```

2. **配置环境变量**
   ```env
   MONGODB_URI=mongodb://localhost:27017/aigui
   ```

## 验证连接

1. **启动应用**
   ```bash
   npm start
   ```

2. **检查终端输出**
   应该看到：
   ```
   ? MongoDB connected successfully
   Server running on http://localhost:3000
   ```

3. **如果看到连接错误**
   - 检查 MongoDB 服务是否运行
   - 检查 `.env` 中的连接字符串是否正确
   - 对于 Atlas: 检查 IP 白名单和用户凭据

## MongoDB Compass (可选)

MongoDB Compass 是官方的图形化数据库管理工具。

1. **下载**: https://www.mongodb.com/try/download/compass

2. **连接数据库**
   - 打开 Compass
   - 粘贴你的连接字符串
   - 点击 "Connect"

3. **查看数据**
   - 展开 `aigui` 数据库
   - 点击 `chats` 集合查看聊天记录

## 数据库结构

应用会自动创建以下结构：

- **数据库名**: `aigui`
- **集合名**: `chats`
- **文档结构**:
  ```javascript
  {
    id: String,              // 唯一标识
    title: String,           // 聊天标题
    messages: [              // 消息数组
      {
        role: String,        // "user" 或 "assistant"
        content: Mixed,      // 文本或多媒体内容
        timestamp: String,   // ISO 时间戳
        attachments: Array,  // 附件 (可选)
        reasoningSummary: String  // 推理摘要 (可选)
      }
    ],
    createdAt: String,       // 创建时间
    updatedAt: String,       // 更新时间
    lastResponseId: String,  // 续写 ID (可选)
    lastModel: String,       // 最后使用的模型
    systemPrompt: String     // 系统提示词
  }
  ```

## 故障排除

### 连接超时
- **Atlas**: 检查网络访问设置，确保 IP 地址在白名单中
- **本地**: 确保防火墙没有阻止 27017 端口

### 认证失败
- 检查用户名和密码是否正确
- 确保用户有读写权限

### 服务未运行
```bash
# Windows
net start MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

## 数据备份

### MongoDB Atlas
- 自动备份功能（免费版有限制）
- 可在控制面板中配置备份策略

### 本地 MongoDB
```bash
# 导出数据
mongodump --db aigui --out ./backup

# 导入数据
mongorestore --db aigui ./backup/aigui
```

## 性能优化

应用已自动为 `id` 字段创建索引：
```javascript
{ id: 1 }  // 唯一索引
```

如果需要额外优化，可以考虑为以下字段创建索引：
- `updatedAt`: 用于排序查询
- `createdAt`: 用于时间范围查询

---

**需要帮助？** 访问 [MongoDB 官方文档](https://docs.mongodb.com/)
