import { ref } from 'vue'
import { textToAudio } from '@/api'
import { toPlainText } from '@/utils/markdown'

/**
 * 回答朗读：优先用流式响应里的 TTS 音频（tts_message 事件），
 * 其次请求 /text-to-audio，服务端不可用时退回浏览器 SpeechSynthesis。
 * 同一时间只允许一条消息朗读。
 */

const playingKey = ref('')

let audioEl = null
let objectUrl = ''

function releaseAudio() {
  if (audioEl) {
    audioEl.pause()
    audioEl.onended = null
    audioEl.onerror = null
    audioEl.src = ''
    audioEl = null
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function stopTts() {
  releaseAudio()
  playingKey.value = ''
}

function playUrl(src, key) {
  audioEl = new Audio(src)
  audioEl.onended = () => {
    if (playingKey.value === key) playingKey.value = ''
  }
  audioEl.onerror = () => {
    if (playingKey.value === key) playingKey.value = ''
  }
  audioEl.play().catch(() => {
    if (playingKey.value === key) playingKey.value = ''
  })
}

function speakWithBrowser(text, key) {
  if (!('speechSynthesis' in window)) {
    playingKey.value = ''
    return
  }
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'zh-CN'
  utter.rate = 1
  utter.onend = () => {
    if (playingKey.value === key) playingKey.value = ''
  }
  utter.onerror = () => {
    if (playingKey.value === key) playingKey.value = ''
  }
  window.speechSynthesis.speak(utter)
}

export function useTts() {
  async function toggleSpeak(message, user) {
    if (playingKey.value === message.key) {
      stopTts()
      return
    }
    stopTts()
    playingKey.value = message.key

    const key = message.key
    const plain = toPlainText(message.content)
    if (!plain) {
      playingKey.value = ''
      return
    }

    // 1. 流式 TTS 音频
    if (message.ttsAudio) {
      playUrl(`data:audio/mpeg;base64,${message.ttsAudio}`, key)
      return
    }

    // 2. 主动请求 TTS 接口
    try {
      const { base64, blob, mime } = await textToAudio({
        messageId: message.messageId,
        text: plain,
        user
      })
      if (base64) {
        playUrl(`data:${mime};base64,${base64}`, key)
      } else if (blob) {
        objectUrl = URL.createObjectURL(blob)
        playUrl(objectUrl, key)
      }
    } catch (e) {
      console.warn('[tts] 服务端语音合成不可用，改用浏览器朗读:', e.message)
      if (playingKey.value === key) speakWithBrowser(plain, key)
    }
  }

  return { playingKey, toggleSpeak, stopTts }
}
