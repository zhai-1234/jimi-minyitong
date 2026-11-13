/**
 * API 门面：演示模式（VITE_DEMO_MODE=true）下使用本地预置数据，
 * 否则直连 Dify Service API。业务代码统一从这里引入，不直接依赖具体实现。
 */
import * as dify from './dify'
import * as demo from './demo'

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const impl = isDemoMode ? demo : dify

export const isConfigured = impl.isConfigured
export const streamChatMessage = impl.streamChatMessage
export const stopChatMessage = impl.stopChatMessage
export const getAppParameters = impl.getAppParameters
export const getConversations = impl.getConversations
export const getChatHistory = impl.getChatHistory
export const deleteConversation = impl.deleteConversation
export const renameConversation = impl.renameConversation
export const feedbackMessage = impl.feedbackMessage
export const getSuggestedQuestions = impl.getSuggestedQuestions
export const textToAudio = impl.textToAudio
export const audioToText = impl.audioToText
export const uploadFile = impl.uploadFile
