<template>
  <div class="message-item" :class="[`role-${message.role}`, { preset: message.preset }]">
    <div class="avatar" :class="message.role">
      {{ message.role === 'user' ? '我' : '基' }}
    </div>
    <div class="bubble-wrap">
      <div class="bubble">
        <!-- 生成失败时的错误提示 -->
        <div v-if="message.error" class="msg-error">
          ⚠️ 回答生成失败：{{ message.error }}
        </div>

        <div
          v-else
          ref="bodyRef"
          class="md-body"
          v-html="renderedHtml"
          @click="onBodyClick"
        ></div>
        <span v-if="message.streaming" class="cursor" aria-hidden="true"></span>
      </div>

      <!-- 用户上传的附件 -->
      <div v-if="message.files && message.files.length" class="user-files">
        <span v-for="(f, i) in message.files" :key="i" class="user-file">📎 {{ f.name }}</span>
      </div>

      <!-- 引用政策来源 -->
      <div v-if="message.sources.length && !message.streaming" class="sources">
        <button class="sources-toggle" type="button" @click="showSources = !showSources">
          📎 引用政策来源（{{ message.sources.length }}）
          <span class="arrow" :class="{ open: showSources }">▾</span>
        </button>
        <p v-if="!citationCount" class="source-note">
          说明：以下为回答所依据的检索文档与片段（文档级归属，非逐句溯源）。
        </p>
        <ul v-show="showSources" class="source-list">
          <li
            v-for="(s, i) in message.sources"
            :key="i"
            :id="`src-${message.key}-${i + 1}`"
            :class="{ highlighted: highlighted === i + 1 }"
          >
            <div class="source-head">
              <span class="doc-name">
                <span v-if="citationCount" class="src-index">{{ i + 1 }}</span>
                {{ s.document_name }}
              </span>
              <span class="meta">{{ s.dataset_name }} · 命中 {{ Math.round((s.score || 0) * 100) }}%</span>
            </div>
            <p class="snippet">{{ s.content }}</p>
          </li>
        </ul>
      </div>

      <!-- 操作：朗读 / 点赞 / 点踩 -->
      <div
        v-if="message.role === 'assistant' && !message.streaming && !message.preset && message.messageId"
        class="actions"
      >
        <button
          type="button"
          class="icon-btn speak-btn"
          :class="{ active: playingKey === message.key }"
          :title="playingKey === message.key ? '停止朗读' : '朗读回答'"
          @click="toggleSpeak(message, store.userId)"
        >
          <svg v-if="playingKey !== message.key" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12Zm-2.5-8.8v2.06a7 7 0 0 1 0 13.48v2.06A9 9 0 0 0 14 3.2Z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
          <span class="speak-label">{{ playingKey === message.key ? '停止' : '朗读' }}</span>
        </button>
        <button
          type="button"
          class="icon-btn"
          :class="{ active: message.feedback === 'like' }"
          title="有帮助"
          @click="store.toggleFeedback(message, 'like')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M2 20h3V9H2v11Zm19.7-9.3c0-1-.8-1.8-1.8-1.8h-5.6l.9-4.1v-.3c0-.4-.2-.8-.4-1.1L13.7 2 7.6 8.2c-.4.3-.6.8-.6 1.3v8.6c0 1 .8 1.8 1.8 1.8h8.1c.7 0 1.4-.5 1.7-1.1l2.9-6.8c.1-.2.2-.5.2-.7v-1.6Z"/>
          </svg>
        </button>
        <button
          type="button"
          class="icon-btn"
          :class="{ active: message.feedback === 'dislike' }"
          title="没帮助"
          @click="store.toggleFeedback(message, 'dislike')"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M22 4h-3v11h3V4ZM2.3 13.3c0 1 .8 1.8 1.8 1.8h5.6l-.9 4.1v.3c0 .4.2.8.4 1.1l1.1 1.2 6.1-6.2c.4-.3.6-.8.6-1.3V5.7c0-1-.8-1.8-1.8-1.8H7.1c-.7 0-1.4.5-1.7 1.1L2.5 11.8c-.1.2-.2.5-.2.7v.8Z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { renderWithCitations } from '@/utils/markdown'
import { useChatStore } from '@/stores/chatStore'
import { useTts } from '@/composables/useTts'

const props = defineProps({
  message: { type: Object, required: true }
})

const store = useChatStore()
const showSources = ref(false)
const highlighted = ref(0)
const citationCount = ref(0)
const { playingKey, toggleSpeak } = useTts()

const rendered = computed(() => renderWithCitations(props.message.content))
const renderedHtml = computed(() => rendered.value.html)

// 记录回答中出现的引用角标数量，用于来源面板展示与联动
watch(
  rendered,
  (r) => {
    citationCount.value = r.citations.length
  },
  { immediate: true }
)

function onBodyClick(e) {
  const el = e.target.closest('[data-citation]')
  if (!el) return
  const idx = Number(el.dataset.citation)
  showSources.value = true
  highlighted.value = idx
  const target = document.getElementById(`src-${props.message.key}-${idx}`)
  if (target) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  setTimeout(() => { highlighted.value = 0 }, 1600)
}
</script>

<style scoped>
.message-item {
  display: flex;
  gap: 10px;
  padding: 8px 0;
}

.message-item.role-user {
  flex-direction: row-reverse;
}

.avatar {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  user-select: none;
}

.avatar.assistant {
  background: linear-gradient(135deg, #2c3e50, #3498db);
}

.avatar.user {
  background: #7f8c8d;
}

.bubble-wrap {
  max-width: min(78%, 680px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.role-user .bubble-wrap {
  align-items: flex-end;
}

.bubble {
  position: relative;
  padding: 10px 14px;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  word-break: break-word;
}

.role-user .bubble {
  background: #2c3e50;
  color: #fff;
}

/* 流式输出光标 */
.cursor {
  position: absolute;
  right: -2px;
  bottom: 6px;
  width: 7px;
  height: 16px;
  background: #3498db;
  border-radius: 2px;
  animation: blink 0.9s steps(1) infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.msg-error {
  color: #c0392b;
  font-size: 13px;
}

/* 用户附件 */
.user-files {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.user-file {
  font-size: 12px;
  color: #566573;
  background: #f0f2f5;
  border-radius: 6px;
  padding: 2px 8px;
}

/* 引用来源 */
.sources {
  margin-top: 6px;
  width: 100%;
}

.sources-toggle {
  border: none;
  background: none;
  padding: 2px 0;
  font-size: 12px;
  color: #7f8c8d;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sources-toggle:hover {
  color: #3498db;
}

.source-note {
  margin: 2px 0 0;
  font-size: 11px;
  color: #b2bec3;
}

.arrow {
  transition: transform 0.2s;
  display: inline-block;
}

.arrow.open {
  transform: rotate(180deg);
}

.source-list {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-list li {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fafbfc;
  transition: background 0.25s, border-color 0.25s;
}

.source-list li.highlighted {
  border-color: #3498db;
  background: #eaf4fc;
}

.source-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
}

.src-index {
  display: inline-block;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  text-align: center;
  border-radius: 4px;
  background: #e1effa;
  color: #21618c;
  font-size: 11px;
  margin-right: 4px;
}

.doc-name {
  font-weight: 600;
  color: #2c3e50;
}

.meta {
  color: #95a5a6;
  flex-shrink: 0;
}

.snippet {
  margin: 4px 0 0;
  font-size: 12px;
  color: #606c76;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 操作按钮 */
.actions {
  margin-top: 4px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.icon-btn {
  border: none;
  background: none;
  padding: 4px;
  border-radius: 6px;
  color: #b2bec3;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  line-height: 0;
}

.icon-btn:hover {
  background: #f0f2f5;
  color: #7f8c8d;
}

.icon-btn.active {
  color: #3498db;
}

.speak-btn .speak-label {
  font-size: 11px;
  line-height: 1;
}
</style>

<style>
/* Markdown 正文样式（v-html 内容无法被 scoped 命中，放全局但限定在 .md-body 内） */
.md-body {
  font-size: 14px;
  line-height: 1.7;
}

.md-body p {
  margin: 0 0 8px;
}

.md-body p:last-child {
  margin-bottom: 0;
}

.md-body h1,
.md-body h2,
.md-body h3,
.md-body h4 {
  margin: 12px 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #2c3e50;
}

.md-body ul,
.md-body ol {
  margin: 4px 0 8px;
  padding-left: 20px;
}

.md-body li {
  margin: 2px 0;
}

.md-body strong {
  color: #1a5276;
}

.md-body blockquote {
  margin: 8px 0;
  padding: 4px 12px;
  border-left: 3px solid #aed6f1;
  background: #f8fbfe;
  color: #566573;
}

.md-body table {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.md-body th,
.md-body td {
  border: 1px solid #d5dbdb;
  padding: 5px 10px;
}

.md-body th {
  background: #f4f6f7;
}

.md-body code {
  background: #f0f2f5;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 13px;
}

.md-body pre {
  background: #f0f2f5;
  padding: 10px;
  border-radius: 8px;
  overflow-x: auto;
}

.md-body pre code {
  background: none;
  padding: 0;
}

.md-body a {
  color: #3498db;
}

/* 引用角标 */
.md-body .citation-ref {
  color: #21618c;
  background: #e1effa;
  border-radius: 4px;
  padding: 0 3px;
  font-size: 10px;
  cursor: pointer;
  vertical-align: super;
}

.md-body .citation-ref:hover {
  background: #c8e1f5;
}
</style>
