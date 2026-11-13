/**
 * 录音格式适配：Dify /audio-to-text 只接受 mp3 / m4a / wav / amr / mpga。
 * Chrome 的 MediaRecorder 产出 audio/webm，需要用 Web Audio 解码后重新编码为 16kHz 单声道 WAV。
 */

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}

/** Float32 单声道样本 → WAV Blob（16-bit PCM） */
function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // 单声道
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}

/**
 * 把浏览器录音转为 Dify 可接受的格式。
 * - mp4/m4a：直接改扩展名为 .m4a 透传
 * - 其他（webm/ogg）：解码后重采样为 16kHz 单声道 WAV
 */
export async function prepareAudioForDify(file) {
  const type = file.type || ''
  if (type.includes('mp4') || type.includes('m4a') || type.includes('aac')) {
    return new File([file], file.name.replace(/\.[^.]+$/, '.m4a'), { type: 'audio/mp4' })
  }

  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let decoded
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer())
  } finally {
    ctx.close?.()
  }

  const targetRate = 16000
  const length = Math.ceil(decoded.duration * targetRate)
  const offline = new OfflineAudioContext(1, length, targetRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  const wav = encodeWav(rendered.getChannelData(0), targetRate)
  return new File([wav], file.name.replace(/\.[^.]+$/, '.wav'), { type: 'audio/wav' })
}
