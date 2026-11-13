# 基米民易通 - Web 前端（Vue 3）

「基米民易通」社会救助政策智能问答系统的 Web 前端，基于 Vue 3 原生对话界面直接对接 Dify 服务 API（不再依赖 iframe 嵌入）。

## 功能

- 💬 **流式对话**：调用 Dify `/chat-messages` 接口，SSE 增量渲染，支持中途停止生成
- 🗂️ **会话管理**：会话列表、历史消息加载、重命名、删除、新建对话
- 📎 **政策来源溯源**：展示每条回答引用的知识库文档、命中分数与检索片段（文档级归属，非逐句溯源）；若回答含 `[citation:N]` 角标，可点击联动到对应来源卡片
- 💡 **建议问题**：开场预设问题 + 每轮回答后的追问建议（`/messages/{id}/suggested`），流式结束后展示
- 🔊 **朗读回答**：优先使用流式响应中的 TTS 音频，其次调用 `/text-to-audio`，服务端不可用时回退浏览器语音合成
- 🎤 **语音输入**：浏览器录音（MediaRecorder）→ 页内转 16 kHz WAV → `/audio-to-text`，识别文本填入输入框
- 📁 **文件上传**：按应用参数的 `file_upload` 校验类型/大小/数量，上传到 `/files/upload` 后随消息以 `files` 数组发送，展示上传进度与失败提示
- 👍 **反馈闭环**：回答点赞 / 点踩，回流 Dify 用于效果分析
- 🗄️ **问答落库（可选）**：开启 `VITE_BACKEND_ENABLED` 后，每轮问答异步上报 Spring Boot 服务
- 📱 **响应式布局**：移动端会话栏为抽屉式交互

## 技术栈

Vue 3（`<script setup>`）· Pinia · Vue Router · Element Plus（按需引入）· marked + DOMPurify · Vite（rolldown-vite）

## 快速开始

```bash
npm install
```

1. 复制 `.env.example` 为 `.env`
2. 在 Dify 控制台 → 应用 → **访问 API** 中创建 API 密钥，填入 `VITE_DIFY_API_KEY`
3. 将 `VITE_DIFY_PROXY_TARGET` 指向你的 Dify 服务器地址（默认 `http://localhost`）

```bash
npm run dev
```

> 语音输入需要浏览器麦克风权限：`localhost` 或 HTTPS 环境下可用。音频格式在页内转换，不依赖 ffmpeg。

### 演示模式（无需 Dify）

```bash
npm run dev:demo     # http://localhost:5173，预置回答
npm run build:demo   # 静态产物，可直接部署到 GitHub Pages
```

演示模式使用 `src/api/demo.js` 的预置数据，覆盖流式输出、引用角标、来源面板、建议问题、朗读（浏览器合成）与模拟上传；界面顶部显示「演示模式」。真实环境仍走 `src/api/dify.js`。

## 生产部署

`.env` 中 `VITE_DIFY_API_BASE` 默认为 `/v1`，生产环境请在 Nginx 中将 `/v1` 反向代理到 Dify 服务，避免浏览器跨域与密钥直出：

```nginx
location /v1/ {
    proxy_pass http://127.0.0.1/v1/;
    proxy_set_header Host $host;
    # SSE 必需：关闭缓冲
    proxy_buffering off;
}
```

```bash
npm run build   # 产物输出到 dist/
```

## 目录结构

```
src/
├── api/dify.js              # Dify 服务 API 客户端（SSE 解析、TTS、STT、文件上传）
├── api/backend.js           # 可选：问答记录上报 Spring Boot
├── composables/
│   ├── useTts.js            # 朗读控制（流式 TTS / 接口 / 浏览器合成）
│   └── useRecorder.js       # MediaRecorder 录音
├── stores/chatStore.js      # 会话与消息状态管理（Pinia）
├── utils/
│   ├── markdown.js          # Markdown 渲染 + XSS 过滤 + 引用角标 + 纯文本
│   └── audio.js             # 录音转 16 kHz WAV
├── components/chat/
│   ├── ChatWindow.vue       # 聊天主窗口（布局 / 滚动跟随 / 空状态）
│   ├── ConversationSidebar.vue  # 会话列表
│   ├── MessageItem.vue      # 单条消息（Markdown / 来源 / 朗读 / 反馈）
│   └── ChatInput.vue        # 输入框（附件上传 / 语音输入 / 建议问题 / 停止按钮）
└── views/HomeView.vue       # 首页入口
```
