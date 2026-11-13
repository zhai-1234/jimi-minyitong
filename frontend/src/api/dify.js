/**
 * Dify 服务 API 客户端
 *
 * 所有请求走 VITE_DIFY_API_BASE（开发环境经 Vite 代理转发到 Dify 服务器，
 * 生产环境建议由 Nginx 反向代理），避免浏览器直连导致的跨域问题。
 */

const API_BASE = import.meta.env.VITE_DIFY_API_BASE || '/v1'
const API_KEY = import.meta.env.VITE_DIFY_API_KEY || ''

export const isConfigured = () => API_KEY.startsWith('app-')

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${API_KEY}`,
    ...extra
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
    signal
  })
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`
    try {
      const err = await resp.json()
      if (err.message) detail = err.message
    } catch { /* 保留状态码信息 */ }
    throw new Error(detail)
  }
  return resp.json()
}

/**
 * 发起对话请求并以 SSE 流式接收回答。
 *
 * @param {Object} options
 * @param {string} options.query 用户输入
 * @param {string} [options.conversationId] 会话 ID，空字符串表示新会话
 * @param {string} options.user 用户标识
 * @param {Array}  [options.files] 上传的文件列表
 * @param {AbortSignal} [options.signal] 中断信号
 * @param {(delta: string) => void} [options.onDelta] 收到回答增量
 * @param {(data: Object) => void} [options.onReplace] 回答被内容审核整体替换
 * @param {(data: Object) => void} [options.onEnd] 流结束，携带引用来源等元数据
 * @param {(taskId: string) => void} [options.onTask] 收到 task_id（用于停止生成）
 * @param {(data: Object) => void} [options.onTts] 收到 TTS 音频事件（data.audio 为 base64）
 * @returns {Promise<{messageId: string, conversationId: string}>}
 */
export async function streamChatMessage({
  query,
  conversationId = '',
  user,
  files = [],
  signal,
  onDelta,
  onReplace,
  onEnd,
  onTask,
  onTts
}) {
  const resp = await fetch(`${API_BASE}/chat-messages`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: 'streaming',
      conversation_id: conversationId,
      files,
      user
    }),
    signal
  })

  if (!resp.ok || !resp.body) {
    let detail = `HTTP ${resp.status}`
    try {
      const err = await resp.json()
      if (err.message) detail = err.message
    } catch { /* 保留状态码信息 */ }
    throw new Error(detail)
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let messageId = ''
  let resultConversationId = conversationId

  const handleEvent = (eventName, data) => {
    switch (eventName) {
      case 'message':
        if (data.task_id && onTask) onTask(data.task_id)
        if (data.message_id) messageId = data.message_id
        if (data.conversation_id) resultConversationId = data.conversation_id
        if (data.answer && onDelta) onDelta(data.answer)
        break
      case 'message_replace':
        if (onReplace) onReplace(data.answer || '')
        break
      case 'message_end':
        if (onEnd) onEnd(data.metadata || {})
        break
      case 'tts_message':
      case 'tts_message_end':
        // 应用开启 text_to_speech 后，流式响应会附带合成语音（base64）
        if (data.audio && onTts) onTts(data)
        break
      case 'error':
        throw new Error(data.message || 'Dify 服务返回错误')
      default:
        // ping / workflow 等事件暂不处理
        break
    }
  }

  // SSE 以空行分隔事件，事件内为若干 "key: value" 行
  const dispatch = (raw) => {
    let eventFromLine = ''
    const dataLines = []
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) eventFromLine = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (!dataLines.length) return
    let data
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      return
    }
    // Dify 新版 SSE 将事件名放在 data.event 中，旧版放在 event: 行，两者都兼容
    const eventName = eventFromLine || data.event || 'message'
    handleEvent(eventName, data)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      dispatch(raw)
    }
  }

  return { messageId, conversationId: resultConversationId }
}

/** 停止服务端继续生成 */
export function stopChatMessage(taskId, user) {
  return request(`/chat-messages/${taskId}/stop`, {
    method: 'POST',
    body: { user }
  }).catch(() => {})
}

/** 获取应用参数（开场白、建议问题等） */
export function getAppParameters(user) {
  return request(`/parameters?user=${encodeURIComponent(user)}`)
}

/** 分页获取会话列表 */
export function getConversations(user, { limit = 30, lastId } = {}) {
  const params = new URLSearchParams({ user, limit: String(limit) })
  if (lastId) params.set('last_id', lastId)
  return request(`/conversations?${params}`)
}

/** 获取某会话的聊天历史（服务端按时间倒序返回，调用方自行反转） */
export function getChatHistory(conversationId, user, { limit = 30, firstId } = {}) {
  const params = new URLSearchParams({ conversation_id: conversationId, user, limit: String(limit) })
  if (firstId) params.set('first_id', firstId)
  return request(`/messages?${params}`)
}

/** 删除会话 */
export function deleteConversation(conversationId, user) {
  return request(`/conversations/${conversationId}`, { method: 'DELETE', body: { user } })
}

/** 会话重命名 */
export function renameConversation(conversationId, name, user) {
  return request(`/conversations/${conversationId}/name`, {
    method: 'POST',
    body: { name, auto_generate: false, user }
  })
}

/** 消息点赞 / 点踩（rating: 'like' | 'dislike' | null 取消） */
export function feedbackMessage(messageId, rating, user) {
  return request(`/messages/${messageId}/feedbacks`, {
    method: 'POST',
    body: { rating, user }
  })
}

/** 获取某条回答后的推荐追问 */
export async function getSuggestedQuestions(messageId, user) {
  const data = await request(`/messages/${messageId}/suggested?user=${encodeURIComponent(user)}`)
  return data.data || []
}

/**
 * 文字转语音（TTS）。
 * 优先按 message_id 请求，其次按 text。返回 { base64, mime } 或 { blob, mime }。
 */
export async function textToAudio({ messageId, text, user }) {
  const body = { user }
  if (messageId) body.message_id = messageId
  else body.text = text
  const resp = await fetch(`${API_BASE}/text-to-audio`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  })
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`
    try {
      const err = await resp.json()
      if (err.message) detail = err.message
    } catch { /* 保留状态码信息 */ }
    throw new Error(detail)
  }
  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('json')) {
    const data = await resp.json()
    const item = data?.data?.[0] || data
    if (item?.audio) return { base64: item.audio, mime: item.mime_type || 'audio/mpeg' }
    if (data?.audio) return { base64: data.audio, mime: data.mime_type || 'audio/mpeg' }
    throw new Error('TTS 接口未返回音频')
  }
  const blob = await resp.blob()
  return { blob, mime: contentType || blob.type || 'audio/mpeg' }
}

/** 语音转文字（STT）：上传音频文件，返回识别文本 */
export async function audioToText(file, user) {
  const form = new FormData()
  form.append('file', file)
  form.append('user', user)
  const resp = await fetch(`${API_BASE}/audio-to-text`, {
    method: 'POST',
    headers: headers(), // 不手动设置 Content-Type，交给浏览器带 boundary
    body: form
  })
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`
    try {
      const err = await resp.json()
      if (err.message) detail = err.message
    } catch { /* 保留状态码信息 */ }
    throw new Error(detail)
  }
  const data = await resp.json()
  return data.text || ''
}

/**
 * 上传文件到 Dify。返回 { id, name, mime_type, extension, size }。
 * onProgress 为上传进度回调（0~1）。
 */
export function uploadFile(file, user, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('user', user)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/files/upload`)
    xhr.setRequestHeader('Authorization', `Bearer ${API_KEY}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          reject(new Error('上传响应解析失败'))
        }
      } else {
        let detail = `HTTP ${xhr.status}`
        try {
          const err = JSON.parse(xhr.responseText)
          if (err.message) detail = err.message
        } catch { /* 保留状态码信息 */ }
        reject(new Error(detail))
      }
    }
    xhr.onerror = () => reject(new Error('网络错误，上传失败'))
    xhr.send(form)
  })
}
