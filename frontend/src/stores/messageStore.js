import { defineStore } from 'pinia'
import axios from 'axios'

// 配置axios基础路径
const api = axios.create({
  baseURL: 'http://localhost:8081/api',
  timeout: 10000
})

// 为了更好的开发体验，即使API调用失败，也能在前端正常使用
// 这个标志可以在调试时控制是否尝试连接后端
const ENABLE_BACKEND = true

export const useMessageStore = defineStore('message', {
  state: () => ({
    messages: [],
    userId: localStorage.getItem('userId') || `user_${Date.now()}`
  }),
  
  actions: {
    async initialize() {
      // 保存userId到localStorage
      localStorage.setItem('userId', this.userId)
      // 从本地存储加载消息
      this.loadFromLocalStorage()
      // 从后端同步消息 - syncWithBackend内部已处理错误
      await this.syncWithBackend()
    },
    
    async addMessage(message) {
      this.messages.push(message)
      this.saveToLocalStorage()
      
      // 仅在启用后端时尝试保存到后端
      if (ENABLE_BACKEND) {
        try {
          // 构建完整的消息对象，确保包含所有必要字段
          const messageToSend = {
            userId: this.userId,
            content: message.content,
            type: message.type,
            response: message.response || '', // 确保总是有response字段
            // 注意：createTime和updateTime会在后端生成
          }
          
          console.log('Sending message to backend:', messageToSend)
          // 将/api/messages修改为/api/chat-messages
          const response = await api.post('/chat-messages', messageToSend)
          console.log('Message saved to backend successfully:', response.data)
        } catch (error) {
          console.error('Error saving message to backend:', error.message)
          if (error.response) {
            // 服务器返回错误响应
            console.error('Response data:', error.response.data)
            console.error('Response status:', error.response.status)
          } else if (error.request) {
            // 请求已发出但没有收到响应
            console.error('No response received:', error.request)
          } else {
            // 设置请求时发生错误
            console.error('Error setting up request:', error.message)
          }
          // 错误不影响前端显示，继续运行
        }
      } else {
        console.log('Backend storage disabled, message saved locally only')
      }
    },
    
    // 保留updateMessageWithResponse方法以保持兼容性，但简化实现
    async updateMessageWithResponse(messageId, response) {
      // 由于采用了独立的消息结构，此方法不再需要执行任何操作
      // 保留是为了向后兼容，避免修改调用处的代码
      console.log('updateMessageWithResponse called but is now deprecated')
    },
    
    clearMessages() {
      this.messages = []
      this.saveToLocalStorage()
    },
    
    saveToLocalStorage() {
      try {
        localStorage.setItem('chatMessages', JSON.stringify(this.messages))
      } catch (error) {
        console.error('Error saving messages to localStorage:', error)
      }
    },
    
    loadFromLocalStorage() {
      try {
        const messages = localStorage.getItem('chatMessages')
        if (messages) {
          this.messages = JSON.parse(messages)
        }
      } catch (error) {
        console.error('Error loading messages from localStorage:', error)
      }
    },
    
    async syncWithBackend() {
      // 仅在启用后端时尝试同步
      if (!ENABLE_BACKEND) {
        console.log('Backend sync disabled to prevent errors')
        return
      }
      
      try {
        console.log('Attempting to sync messages with backend')
        // 在实际应用中，这里应该实现完整的同步逻辑
        // 目前为了避免错误，我们暂时跳过实际同步
        console.log('Sync logic skipped for now')
      } catch (error) {
        console.error('Error syncing messages with backend:', error)
      }
    },
    
    // 新方法：获取数据库内容（用于调试）
    async getDatabaseContents() {
      // 仅在启用后端时尝试获取数据库内容
      if (!ENABLE_BACKEND) {
        console.log('Backend access disabled, returning mock data')
        // 返回前端存储的消息作为模拟数据
        return this.messages
      }
      
      try {
        console.log('Attempting to get database contents')
        const response = await api.get('/messages')
        console.log('Database contents:', response.data)
        return response.data
      } catch (error) {
        console.error('Error fetching database contents:', error)
        // 返回前端存储的消息作为后备数据，保证功能正常
        console.log('Falling back to local messages')
        return this.messages
      }
    }
  },
  
  getters: {
    messageCount: (state) => state.messages.length,
    
    userMessages: (state) => {
      // 获取所有用户消息
      const userMsgs = state.messages.filter(msg => msg.type === 'user');
      // 获取所有AI消息
      const aiMsgs = state.messages.filter(msg => msg.type === 'ai');
      
      // 为每个用户消息关联对应的AI回复（按照时间顺序配对）
      return userMsgs.map((userMsg, index) => {
        // 查找时间上最接近的AI回复
        // 在实际应用中，可能需要更精确的关联逻辑
        // 这里简单地按照索引配对用户消息和AI消息
        const matchingAiMsg = aiMsgs[index];
        
        // 返回关联了回复的用户消息
        return {
          ...userMsg,
          response: matchingAiMsg ? matchingAiMsg.content : ''
        };
      });
    },
    
    aiMessages: (state) => state.messages.filter(msg => msg.type === 'ai')
  }
})