<template>
  <aside class="sidebar" :class="{ open: props.open }">
    <button type="button" class="new-chat" @click="onNewChat">
      ＋ 新的对话
    </button>

    <div class="conv-list">
      <div v-if="!store.conversations.length" class="empty">暂无历史会话</div>
      <div
        v-for="c in store.conversations"
        :key="c.id"
        class="conv-item"
        :class="{ active: c.id === store.currentConversationId }"
        @click="store.selectConversation(c.id)"
      >
        <span class="conv-name" :title="c.name">{{ c.name }}</span>
        <span class="conv-ops" @click.stop>
          <button type="button" title="重命名" @click="onRename(c)">✏️</button>
          <button type="button" title="删除" @click="onDelete(c)">🗑️</button>
        </span>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { useChatStore } from '@/stores/chatStore'
// 按需引入：只使用 MessageBox，避免全量打包 Element Plus
import { ElMessageBox } from 'element-plus'
import 'element-plus/es/components/message-box/style/css'

const props = defineProps({
  open: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const store = useChatStore()

function onNewChat() {
  store.startNewConversation()
  emit('select')
}

async function onRename(conv) {
  try {
    const { value } = await ElMessageBox.prompt('新的会话名称', '重命名', {
      inputValue: conv.name,
      inputValidator: (v) => (v && v.trim() ? true : '名称不能为空')
    })
    await store.doRenameConversation(conv.id, value.trim())
  } catch { /* 用户取消 */ }
}

async function onDelete(conv) {
  try {
    await ElMessageBox.confirm(`确定删除会话「${conv.name}」吗？`, '删除会话', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await store.removeConversation(conv.id)
  } catch { /* 用户取消 */ }
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #f7f9fa;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  padding: 12px 10px;
  gap: 10px;
}

.new-chat {
  border: 1px dashed #aab7c4;
  background: #fff;
  color: #2c3e50;
  border-radius: 10px;
  padding: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.new-chat:hover {
  border-color: #3498db;
  color: #3498db;
}

.conv-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty {
  color: #b2bec3;
  font-size: 13px;
  text-align: center;
  padding: 16px 0;
}

.conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #566573;
}

.conv-item:hover {
  background: #edf1f5;
}

.conv-item.active {
  background: #e1effa;
  color: #21618c;
  font-weight: 600;
}

.conv-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-ops {
  flex-shrink: 0;
  display: none;
  gap: 2px;
}

.conv-item:hover .conv-ops {
  display: inline-flex;
}

.conv-ops button {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
  opacity: 0.65;
}

.conv-ops button:hover {
  opacity: 1;
}

/* 移动端：抽屉式 */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 60px;
    bottom: 0;
    left: 0;
    z-index: 20;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.08);
  }

  .sidebar.open {
    transform: translateX(0);
  }
}
</style>
