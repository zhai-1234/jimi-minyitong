import { defineStore } from 'pinia'
import {
  isConfigured,
  streamChatMessage,
  stopChatMessage,
  getAppParameters,
  getConversations,
  getChatHistory,
  deleteConversation,
  renameConversation,
  feedbackMessage,
  getSuggestedQuestions
} from '@/api'
import { saveTurn } from '@/api/backend'

const USER_KEY = 'jimi_user_id'

/** 每个浏览器一个稳定用户标识，Dify 以 user 维度隔离会话 */
function resolveUserId() {
  let id = localStorage.getItem(USER_KEY)
  if (!id) {
    id = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    localStorage.setItem(USER_KEY, id)
  }
  return id
}

/** 前端消息结构 */
function createMessage(fields) {
  return {
    key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: '',
    streaming: false,
    error: '',
    // assistant 消息专属
    messageId: '',
    sources: [],
    feedback: null,
    files: [], // user 消息的附件（已上传文件）
    ttsAudio: '', // assistant 消息流式返回的 TTS 音频（base64）
    ...fields
  }
}

/** 依据 MIME / 扩展名推导 Dify 文件类型（document / image / audio / video） */
function fileType(mimeType = '', extension = '') {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  const ext = (extension || '').toLowerCase()
  const normalized = ext && !ext.startsWith('.') ? `.${ext}` : ext
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(normalized)) return 'image'
  if (['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm'].includes(normalized)) return 'audio'
  if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(normalized)) return 'video'
  return 'document'
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    configured: isConfigured(),
    userId: resolveUserId(),
    parameters: null, // 开场白、预设建议问题
    conversations: [],
    currentConversationId: '',
    messages: [],
    isStreaming: false,
    suggestedQuestions: [], // 最近一条回答后的推荐追问
    loadingHistory: false
  }),

  getters: {
    currentConversation: (state) =>
      state.conversations.find((c) => c.id === state.currentConversationId) || null
  },

  actions: {
    /** 应用启动：拉取应用参数与会话列表，展示开场白 */
    async init() {
      if (!this.configured) return
      try {
        const [params, convs] = await Promise.all([
          getAppParameters(this.userId),
          getConversations(this.userId)
        ])
        this.parameters = params
        this.conversations = convs.data || []
      } catch (e) {
        console.error('[chat] 初始化失败:', e.message)
      }
      this.startNewConversation()
    },

    startNewConversation() {
      this.currentConversationId = ''
      this.suggestedQuestions = []
      this.messages = []
      const opening = this.parameters?.opening_statement
      if (opening) {
        this.messages.push(
          createMessage({ role: 'assistant', content: opening, preset: true })
        )
      }
    },

    async selectConversation(conversationId) {
      if (this.isStreaming) this.stopGenerating()
      this.currentConversationId = conversationId
      this.suggestedQuestions = []
      this.messages = []
      this.loadingHistory = true
      try {
        const data = await getChatHistory(conversationId, this.userId)
        const items = (data.data || []).slice().reverse()
        this.messages = items.flatMap((m) => {
          const list = [createMessage({ role: 'user', content: m.query })]
          list.push(
            createMessage({
              role: 'assistant',
              content: m.answer,
              messageId: m.id,
              feedback: m.feedback?.rating || null,
              sources: m.retriever_resources || []
            })
          )
          return list
        })
      } catch (e) {
        console.error('[chat] 加载历史失败:', e.message)
      } finally {
        this.loadingHistory = false
      }
    },

    async sendMessage(query, attachments = []) {
      const text = query.trim()
      if ((!text && !attachments.length) || this.isStreaming || !this.configured) return

      this.suggestedQuestions = []
      this.messages.push(createMessage({ role: 'user', content: text, files: attachments }))
      this.messages.push(createMessage({ role: 'assistant', streaming: true }))
      // 必须通过响应式代理更新消息对象，直接改 raw 对象不会触发视图更新
      const reply = this.messages[this.messages.length - 1]
      this.isStreaming = true

      const controller = new AbortController()
      this._abortController = controller
      this._stopTaskId = ''

      // Dify 要求 files 为 [{ type, transfer_method: 'local_file', upload_file_id, ... }]
      const files = attachments.map((f) => ({
        type: f.type || fileType(f.mime_type, f.extension),
        transfer_method: 'local_file',
        upload_file_id: f.id
      }))

      try {
        const { messageId, conversationId } = await streamChatMessage({
          query: text,
          conversationId: this.currentConversationId,
          user: this.userId,
          files,
          signal: controller.signal,
          onTask: (id) => { this._stopTaskId = id },
          onDelta: (delta) => { reply.content += delta },
          onReplace: (answer) => { reply.content = answer },
          onTts: (data) => { reply.ttsAudio += data.audio },
          onEnd: (metadata) => {
            reply.sources = metadata.retriever_resources || []
          }
        })
        reply.messageId = messageId
        this.currentConversationId = conversationId
        await this._refreshSuggested(messageId)
        // 可选：异步落库，不阻塞对话
        saveTurn({
          userId: this.userId,
          sessionId: conversationId,
          question: text,
          answer: reply.content
        })
      } catch (e) {
        if (e.name === 'AbortError') {
          reply.content += '\n\n（已停止生成）'
        } else {
          console.error('[chat] 发送失败:', e.message)
          reply.error = e.message
        }
      } finally {
        reply.streaming = false
        this.isStreaming = false
        this._abortController = null
        this._stopTaskId = ''
        this._refreshConversations()
      }
    },

    /** 记录流事件中的会话 ID（由 api 层回调写入） */
    setCurrentConversationId(id) {
      if (!this.currentConversationId && id) this.currentConversationId = id
    },

    stopGenerating() {
      if (this._stopTaskId) stopChatMessage(this._stopTaskId, this.userId)
      this._abortController?.abort()
    },

    async toggleFeedback(message, rating) {
      if (!message.messageId) return
      const next = message.feedback === rating ? null : rating
      try {
        await feedbackMessage(message.messageId, next, this.userId)
        message.feedback = next
      } catch (e) {
        console.error('[chat] 反馈失败:', e.message)
      }
    },

    async removeConversation(conversationId) {
      try {
        await deleteConversation(conversationId, this.userId)
        this.conversations = this.conversations.filter((c) => c.id !== conversationId)
        if (this.currentConversationId === conversationId) this.startNewConversation()
      } catch (e) {
        console.error('[chat] 删除会话失败:', e.message)
      }
    },

    async doRenameConversation(conversationId, name) {
      try {
        await renameConversation(conversationId, name, this.userId)
        const target = this.conversations.find((c) => c.id === conversationId)
        if (target) target.name = name
      } catch (e) {
        console.error('[chat] 重命名失败:', e.message)
      }
    },

    async _refreshSuggested(messageId) {
      if (!messageId) return
      try {
        this.suggestedQuestions = await getSuggestedQuestions(messageId, this.userId)
      } catch { /* 推荐追问失败不影响主流程 */ }
    },

    async _refreshConversations() {
      try {
        const convs = await getConversations(this.userId)
        this.conversations = convs.data || []
      } catch { /* 列表刷新失败不影响主流程 */ }
    }
  }
})
