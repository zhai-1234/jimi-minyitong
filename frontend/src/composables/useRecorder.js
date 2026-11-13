import { onBeforeUnmount, ref } from 'vue'

/**
 * 浏览器录音（MediaRecorder）。录音结束后返回 File（webm/ogg/mp4 取决于浏览器支持），
 * 供 /audio-to-text 接口识别。
 */
export function useRecorder() {
  const recording = ref(false)
  const seconds = ref(0)
  const error = ref('')

  let recorder = null
  let stream = null
  let chunks = []
  let timer = null

  function pickMimeType() {
    if (typeof MediaRecorder === 'undefined') return ''
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ]
    return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || ''
  }

  function extensionOf(mimeType) {
    if (mimeType.includes('ogg')) return 'ogg'
    if (mimeType.includes('mp4')) return 'm4a'
    return 'webm'
  }

  async function start() {
    error.value = ''
    if (!navigator.mediaDevices?.getUserMedia) {
      error.value = '当前浏览器不支持录音（需要 HTTPS 或 localhost）'
      return false
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      error.value = e.name === 'NotAllowedError' ? '麦克风权限被拒绝' : `无法访问麦克风：${e.message}`
      return false
    }
    const mimeType = pickMimeType()
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    chunks = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.start()
    recording.value = true
    seconds.value = 0
    timer = setInterval(() => {
      seconds.value += 1
      // 单次录音上限 60 秒，避免误触与超长音频
      if (seconds.value >= 60) stop()
    }, 1000)
    return true
  }

  function stop() {
    return new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') {
        resolve(null)
        return
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunks, { type: mimeType })
        const ext = extensionOf(mimeType)
        resolve(new File([blob], `voice-${Date.now()}.${ext}`, { type: mimeType }))
      }
      recorder.stop()
      recording.value = false
      clearInterval(timer)
      timer = null
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    })
  }

  onBeforeUnmount(() => {
    clearInterval(timer)
    if (recorder?.state === 'recording') recorder.stop()
    stream?.getTracks().forEach((t) => t.stop())
  })

  return { recording, seconds, error, start, stop }
}
