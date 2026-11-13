<template>
  <div class="chat-input">
    <!-- 推荐追问 -->
    <div v-if="store.suggestedQuestions.length && !store.isStreaming" class="suggest-row">
      <button
        v-for="q in store.suggestedQuestions"
        :key="q"
        type="button"
        class="chip"
        @click="send(q)"
      >
        {{ q }}
      </button>
    </div>

    <!-- 待发送附件 -->
    <div v-if="attachments.length" class="attach-row">
      <div
        v-for="f in attachments"
        :key="f.uid"
        class="attach-item"
        :class="{ failed: f.status === 'error' }"
      >
        <span class="attach-icon">{{ fileIcon(f) }}</span>
        <span class="attach-name" :title="f.name">{{ f.name }}</span>
        <span v-if="f.status === 'uploading'" class="attach-progress">{{ Math.round(f.progress * 100) }}%</span>
        <span v-else-if="f.status === 'error'" class="attach-error" :title="f.errorMsg">上传失败</span>
        <span v-else class="attach-ok">✓</span>
        <button type="button" class="attach-remove" title="移除" @click="removeAttachment(f)">×</button>
      </div>
    </div>

    <!-- 录音状态与语音错误 -->
    <div v-if="recording" class="record-tip">
      <span class="record-dot"></span>
      正在录音 {{ seconds }}s，再点一次结束（最长 60 秒）
    </div>
    <div v-else-if="voiceError" class="voice-error">{{ voiceError }}</div>

    <div class="input-box">
      <textarea
        ref="textareaRef"
        v-model="draft"
        class="textarea"
        rows="1"
        :placeholder="store.isStreaming ? '回答生成中…' : '输入您的问题，Enter 发送，Shift + Enter 换行'"
        :disabled="!store.configured"
        @keydown.enter.exact.prevent="onEnter"
        @compositionstart="composing = true"
        @compositionend="composing = false"
        @input="autoResize"
      ></textarea>

      <div class="tools">
        <!-- 文件上传 -->
        <button
          v-if="canUpload"
          type="button"
          class="tool-btn"
          title="上传文件"
          :disabled="store.isStreaming || attachments.length >= maxFiles"
          @click="fileInputRef.click()"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <input
          ref="fileInputRef"
          type="file"
          class="hidden-input"
          :multiple="maxFiles > 1"
          :accept="acceptAttr"
          @change="onFilesPicked"
        />

        <!-- 语音输入 -->
        <button
          v-if="canVoice"
          type="button"
          class="tool-btn"
          :class="{ recording }"
          :title="recording ? '结束录音' : '语音输入'"
          :disabled="store.isStreaming || transcribing"
          @click="toggleRecord"
        >
          <svg v-if="!transcribing" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/>
          </svg>
          <span v-else class="spinner"></span>
        </button>

        <button
          v-if="!store.isStreaming"
          type="button"
          class="send-btn"
          :disabled="(!draft.trim() && !hasReadyAttachment) || !store.configured || uploading"
          title="发送"
          @click="send()"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3.4 20.4 20.9 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87l.01 6.53Z"/>
          </svg>
        </button>
        <button
          v-else
          type="button"
          class="send-btn stop"
          title="停止生成"
          @click="store.stopGenerating()"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { uploadFile, audioToText } from '@/api'
import { useRecorder } from '@/composables/useRecorder'
import { prepareAudioForDify } from '@/utils/audio'

const store = useChatStore()
const draft = ref('')
const textareaRef = ref(null)
const composing = ref(false) // 中文输入法组词期间不触发发送
const attachments = ref([])
const fileInputRef = ref(null)
const transcribing = ref(false)
const voiceError = ref('')

const { recording, seconds, error: recorderError, start: startRecord, stop: stopRecord } = useRecorder()

/** 文件上传配置（来自 /parameters 的 file_upload） */
const uploadConfig = computed(() => store.parameters?.file_upload || {})
const canUpload = computed(() => uploadConfig.value.enabled === true)
const maxFiles = computed(() => uploadConfig.value.number_limits || 3)
const sizeLimitMb = computed(() => uploadConfig.value.fileUploadConfig?.file_size_limit || 15)
const allowedTypes = computed(() => uploadConfig.value.allowed_file_types || ['document'])
const allowedExtensions = computed(() =>
  (uploadConfig.value.allowed_file_extensions || []).map((e) => e.toLowerCase())
)

const canVoice = computed(() => store.parameters?.speech_to_text?.enabled !== false)

const EXT_BY_TYPE = {
  document: '.txt,.md,.pdf,.html,.htm,.xlsx,.xls,.doc,.docx,.csv,.eml,.msg,.pptx,.ppt,.xml,.epub',
  image: '.jpg,.jpeg,.png,.gif,.webp,.svg',
  audio: '.mp3,.wav,.m4a,.aac,.ogg,.webm',
  video: '.mp4,.mov,.avi,.mkv,.webm'
}

// Dify 的 allowed_file_extensions 只约束图片，文档等使用内置扩展名列表
const acceptAttr = computed(() => {
  const exts = []
  for (const type of allowedTypes.value) {
    if (type === 'image' && allowedExtensions.value.length) {
      exts.push(...allowedExtensions.value)
    } else if (EXT_BY_TYPE[type]) {
      exts.push(...EXT_BY_TYPE[type].split(','))
    }
  }
  return [...new Set(exts)].join(',')
})

const MAX_INPUT_HEIGHT = 144 // 约 6 行，超过后显示内部滚动条

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)
  el.style.height = `${next}px`
  // 默认不显示滚动条；内容超过最大高度（多行溢出）时才显示
  el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden'
}

onMounted(() => {
  autoResize()
  window.addEventListener('resize', autoResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', autoResize)
})

function onEnter() {
  if (composing.value) return
  send()
}

const hasReadyAttachment = computed(() => attachments.value.some((f) => f.status === 'done'))
const uploading = computed(() => attachments.value.some((f) => f.status === 'uploading'))

function fileIcon(f) {
  if (f.mime_type?.startsWith('image/')) return '🖼️'
  if (f.mime_type?.startsWith('audio/')) return '🎵'
  if (f.mime_type?.startsWith('video/')) return '🎬'
  return '📄'
}

function describeTypeError(file) {
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
  const byExt = {
    '.txt': 'document', '.md': 'document', '.pdf': 'document', '.html': 'document',
    '.htm': 'document', '.doc': 'document', '.docx': 'document', '.xls': 'document',
    '.xlsx': 'document', '.csv': 'document', '.ppt': 'document', '.pptx': 'document',
    '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image', '.svg': 'image',
    '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.aac': 'audio', '.ogg': 'audio',
    '.mp4': 'video', '.mov': 'video', '.avi': 'video', '.mkv': 'video'
  }
  const type = byExt[ext]
  if (!type) return `不支持的文件格式 ${ext}`
  if (!allowedTypes.value.includes(type)) return `应用不允许上传 ${type} 类型文件`
  if (type === 'image' && allowedExtensions.value.length && !allowedExtensions.value.includes(ext)) {
    return `不支持的图片格式 ${ext}，允许：${allowedExtensions.value.join(' ')}`
  }
  return ''
}

async function onFilesPicked(e) {
  const picked = Array.from(e.target.files || [])
  e.target.value = '' // 允许重复选择同一文件
  for (const file of picked) {
    if (attachments.value.length >= maxFiles.value) {
      voiceError.value = `最多上传 ${maxFiles.value} 个文件`
      break
    }
    if (file.size > sizeLimitMb.value * 1024 * 1024) {
      voiceError.value = `「${file.name}」超过 ${sizeLimitMb.value}MB 上限`
      continue
    }
    const typeErr = describeTypeError(file)
    if (typeErr) {
      voiceError.value = typeErr
      continue
    }
    voiceError.value = ''
    addAndUpload(file)
  }
}

function addAndUpload(file) {
  // 必须用 reactive 包装后再放入列表：直接改原始对象的属性不会触发视图更新
  const item = reactive({
    uid: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    size: file.size,
    progress: 0,
    status: 'uploading',
    errorMsg: '',
    id: '',
    mime_type: file.type,
    extension: '.' + (file.name.split('.').pop() || '').toLowerCase()
  })
  attachments.value.push(item)
  uploadFile(file, store.userId, (p) => {
    item.progress = p
  })
    .then((res) => {
      item.id = res.id
      item.name = res.name || item.name
      item.mime_type = res.mime_type || item.mime_type
      item.extension = res.extension || item.extension
      item.status = 'done'
      item.progress = 1
    })
    .catch((err) => {
      item.status = 'error'
      item.errorMsg = err.message
    })
}

function removeAttachment(item) {
  attachments.value = attachments.value.filter((f) => f.uid !== item.uid)
}

async function toggleRecord() {
  voiceError.value = ''
  if (recording.value) {
    const file = await stopRecord()
    if (!file) return
    transcribing.value = true
    try {
      const wavFile = await prepareAudioForDify(file)
      const text = await audioToText(wavFile, store.userId)
      if (text) {
        draft.value = draft.value ? `${draft.value} ${text}` : text
        await nextTick()
        autoResize()
      } else {
        voiceError.value = '没有识别到语音内容，请重试'
      }
    } catch (err) {
      voiceError.value = `语音识别失败：${err.message}`
    } finally {
      transcribing.value = false
    }
    return
  }
  const ok = await startRecord()
  if (!ok && recorderError.value) voiceError.value = recorderError.value
}

async function send(text) {
  const content = (text ?? draft.value).trim()
  const ready = attachments.value.filter((f) => f.status === 'done')
  if ((!content && !ready.length) || store.isStreaming || !store.configured) return
  if (attachments.value.some((f) => f.status === 'uploading')) return
  const files = ready.map((f) => ({
    id: f.id,
    name: f.name,
    mime_type: f.mime_type,
    extension: f.extension,
    size: f.size
  }))
  draft.value = ''
  attachments.value = []
  voiceError.value = ''
  await nextTick()
  autoResize()
  await store.sendMessage(content, files)
}
</script>

<style scoped>
.chat-input {
  padding: 10px 16px 14px;
}

.suggest-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.chip {
  border: 1px solid #d5dbdb;
  background: #fff;
  color: #566573;
  border-radius: 16px;
  padding: 5px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.chip:hover {
  border-color: #3498db;
  color: #3498db;
  background: #f8fbfe;
}

/* 附件列表 */
.attach-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.attach-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #d5dbdb;
  border-radius: 8px;
  padding: 4px 8px;
  background: #fff;
  font-size: 12px;
  color: #566573;
  max-width: 260px;
}

.attach-item.failed {
  border-color: #e74c3c;
  color: #c0392b;
}

.attach-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 150px;
}

.attach-progress {
  color: #3498db;
}

.attach-ok {
  color: #27ae60;
}

.attach-error {
  color: #c0392b;
}

.attach-remove {
  border: none;
  background: none;
  color: #95a5a6;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.attach-remove:hover {
  color: #c0392b;
}

.record-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c0392b;
  margin-bottom: 8px;
}

.record-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e74c3c;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  50% { opacity: 0.3; }
}

.voice-error {
  font-size: 12px;
  color: #c0392b;
  margin-bottom: 8px;
}

.input-box {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  background: #fff;
  border: 1px solid #d5dbdb;
  border-radius: 14px;
  padding: 8px 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.input-box:focus-within {
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.12);
}

.textarea {
  flex: 1;
  min-height: 24px;
  border: none;
  outline: none;
  resize: none;
  font-size: 15px;
  line-height: 1.6;
  max-height: 144px;
  padding: 2px 0;
  overflow-y: hidden;
  font-family: inherit;
  color: #2c3e50;
  background: transparent;
  scrollbar-width: thin;
  scrollbar-color: #c5ccd3 transparent;
}

.textarea::-webkit-scrollbar {
  width: 6px;
}

.textarea::-webkit-scrollbar-thumb {
  background: #c5ccd3;
  border-radius: 3px;
}

.textarea::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 768px) {
  .textarea {
    /* 避免 iOS 聚焦时自动放大页面 */
    font-size: 16px;
  }
}

.textarea::placeholder {
  color: #b2bec3;
}

.tools {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.tool-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: none;
  color: #7f8c8d;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-btn:hover:not(:disabled) {
  background: #f0f2f5;
  color: #2c3e50;
}

.tool-btn:disabled {
  color: #d5dbdb;
  cursor: not-allowed;
}

.tool-btn.recording {
  color: #e74c3c;
  background: #fdecea;
}

.hidden-input {
  display: none;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #d5dbdb;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: #2c3e50;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.send-btn:hover:not(:disabled) {
  background: #3498db;
}

.send-btn:disabled {
  background: #d5dbdb;
  cursor: not-allowed;
}

.send-btn.stop {
  background: #c0392b;
}

.send-btn.stop:hover {
  background: #e74c3c;
}
</style>
