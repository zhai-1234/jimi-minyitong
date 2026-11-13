/**
 * 可选：将问答记录上报到 Spring Boot 后端落库（默认关闭）。
 * 开启方式：.env 中设置 VITE_BACKEND_ENABLED=true
 */

const API_BASE = import.meta.env.VITE_BACKEND_API_BASE || '/api'

export const backendEnabled = import.meta.env.VITE_BACKEND_ENABLED === 'true'

async function postMessage(payload) {
  const resp = await fetch(`${API_BASE}/chat-messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return resp.json()
}

/** 保存一轮问答（用户问题 + 回答），失败不影响对话主流程 */
export async function saveTurn({ userId, sessionId, question, answer }) {
  if (!backendEnabled) return
  try {
    await postMessage({ userId, sessionId, role: 'user', content: question })
    await postMessage({ userId, sessionId, role: 'assistant', content: answer })
  } catch (e) {
    console.warn('[backend] 问答记录上报失败:', e.message)
  }
}
