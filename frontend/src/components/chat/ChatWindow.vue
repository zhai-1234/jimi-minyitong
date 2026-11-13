<template>
  <div class="chat-page">
    <!-- 未配置 API 密钥时的引导 -->
    <div v-if="!store.configured" class="setup-guide">
      <h2>🔧 需要先配置 Dify API 密钥</h2>
      <ol>
        <li>复制项目根目录下的 <code>.env.example</code> 为 <code>.env</code></li>
        <li>在 Dify 控制台 → 应用 → <strong>访问 API</strong> 中创建 API 密钥（<code>app-</code> 开头）</li>
        <li>将密钥填入 <code>.env</code> 的 <code>VITE_DIFY_API_KEY</code></li>
        <li>确认 <code>VITE_DIFY_PROXY_TARGET</code> 指向你的 Dify 服务器地址，然后重启 <code>npm run dev</code></li>
      </ol>
    </div>

    <template v-else>
      <ConversationSidebar :open="sidebarOpen" @select="sidebarOpen = false" />

      <section class="chat-main">
        <header class="chat-header">
          <button class="header-btn mobile-only" type="button" title="会话列表" @click="sidebarOpen = !sidebarOpen">
            ☰
          </button>
          <div class="title">{{ store.currentConversation?.name || '新的对话' }}</div>
          <span v-if="isDemo" class="demo-badge" title="未连接 Dify，回答为预置示例">演示模式</span>
          <button class="header-btn" type="button" title="新的对话" @click="startNew">＋</button>
        </header>

        <div v-if="sidebarOpen" class="backdrop mobile-only" @click="sidebarOpen = false"></div>

        <div ref="listRef" class="message-list" @scroll="onScroll">
          <!-- 空状态：欢迎页 -->
          <div v-if="!store.messages.length" class="welcome">
            <div class="welcome-icon">🤖</div>
            <h2>基米民易通</h2>
            <p>社会救助政策智能问答，低保、特困、临时救助……有问必答</p>
            <div class="starter-row">
              <button
                v-for="q in starterQuestions"
                :key="q"
                type="button"
                class="starter"
                @click="store.sendMessage(q)"
              >
                {{ q }}
              </button>
            </div>
          </div>

          <template v-for="m in store.messages" :key="m.key">
            <MessageItem :message="m" />
          </template>

          <div v-if="store.loadingHistory" class="history-loading">正在加载历史消息…</div>
        </div>

        <ChatInput />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import ConversationSidebar from './ConversationSidebar.vue'
import MessageItem from './MessageItem.vue'
import ChatInput from './ChatInput.vue'
import { useChatStore } from '@/stores/chatStore'
import { isDemoMode } from '@/api'

const store = useChatStore()
const isDemo = isDemoMode
const sidebarOpen = ref(false)
const listRef = ref(null)
const pinnedToBottom = ref(true)

const starterQuestions = computed(() => store.parameters?.suggested_questions || [])

onMounted(() => {
  store.init()
})

function onScroll() {
  const el = listRef.value
  if (!el) return
  pinnedToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 60
}

// 流式输出期间跟随滚动到底部（用户上翻则暂停跟随）
watch(
  () => store.messages,
  () => {
    if (!pinnedToBottom.value) return
    nextTick(() => {
      const el = listRef.value
      if (el) el.scrollTop = el.scrollHeight
    })
  },
  { deep: true }
)

function startNew() {
  if (store.isStreaming) store.stopGenerating()
  store.startNewConversation()
}
</script>

<style scoped>
.chat-page {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* 配置引导 */
.setup-guide {
  margin: auto;
  max-width: 520px;
  background: #fff;
  border-radius: 12px;
  padding: 28px 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.setup-guide h2 {
  margin-bottom: 12px;
  font-size: 18px;
  color: #2c3e50;
}

.setup-guide ol {
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #566573;
  font-size: 14px;
  line-height: 1.6;
}

.setup-guide code {
  background: #f0f2f5;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: #c0392b;
}

/* 主区域 */
.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f2f4f7;
  position: relative;
}

.chat-header {
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-btn {
  border: none;
  background: none;
  font-size: 18px;
  color: #566573;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
}

.header-btn:hover {
  background: #f0f2f5;
}

.demo-badge {
  flex-shrink: 0;
  font-size: 11px;
  color: #8a6d3b;
  background: #fcf3cf;
  border: 1px solid #f7dc6f;
  border-radius: 6px;
  padding: 2px 6px;
}

.backdrop {
  position: fixed;
  inset: 60px 0 0 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 15;
}

/* 消息列表 */
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 8px;
  scroll-behavior: smooth;
}

.welcome {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #566573;
}

.welcome-icon {
  font-size: 44px;
  margin-bottom: 8px;
}

.welcome h2 {
  margin: 0 0 6px;
  color: #2c3e50;
}

.welcome p {
  margin: 0 0 20px;
  font-size: 14px;
}

.starter-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(420px, 90%);
}

.starter {
  border: 1px solid #d5dbdb;
  background: #fff;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 14px;
  color: #566573;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.starter:hover {
  border-color: #3498db;
  color: #3498db;
  background: #f8fbfe;
}

.history-loading {
  text-align: center;
  color: #95a5a6;
  font-size: 13px;
  padding: 12px 0;
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .mobile-only {
    display: inline-flex;
  }
}
</style>
