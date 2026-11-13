/**
 * 演示模式（VITE_DEMO_MODE=true）：不连接 Dify，用预置知识生成流式回答。
 * 目的：让仓库在 GitHub Pages 或本地无 Dify 环境下也能预览与体验完整交互。
 * 所有回答均为演示文本，界面上有「演示模式」标识，不代表真实政策答复。
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const randomId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const SOURCES = {
  dibao: {
    dataset_name: '社会救助政策知识库（演示）',
    document_name: '广东省最低生活保障制度实施办法',
    content: '申请低保应以家庭为单位，同时符合户籍、收入、财产等条件；共同生活家庭成员包括配偶、父母和未成年子女、不能独立生活的成年子女等。',
    score: 0.86
  },
  dibaoGuide: {
    dataset_name: '社会救助政策知识库（演示）',
    document_name: '办理指南（最低生活保障·特困·临时救助）',
    content: '携带户口簿、身份证等原件向户籍所在地乡镇人民政府（街道办事处）提出申请，也可委托村（居）委会代为申请；材料不全应一次性告知补正。',
    score: 0.81
  },
  tekun: {
    dataset_name: '社会救助政策知识库（演示）',
    document_name: '特困人员救助供养',
    content: '特困人员救助供养对象为无劳动能力、无生活来源且无法定赡养、抚养、扶养义务人或者其法定义务人无履行义务能力的老年人、残疾人和未成年人。',
    score: 0.84
  },
  linshi: {
    dataset_name: '社会救助政策知识库（演示）',
    document_name: '临时救助',
    content: '临时救助分为急难型救助和支出型救助，用于解决突发性、紧迫性、临时性基本生活困难，可向户籍地或居住地镇街申请。',
    score: 0.79
  },
  yiliao: {
    dataset_name: '社会救助政策知识库（演示）',
    document_name: '南海区分层分类社会救助帮扶惠民清单（2025）',
    content: '医疗救助对特困人员、低保对象等困难群众经基本医保、大病保险支付后的合规医疗费用给予救助，具体比例按身份类别确定。',
    score: 0.77
  },
  zhufang: {
    dataset_name: '社会救助政策知识库（演示）',
    document_name: '南海区分层分类社会救助帮扶惠民清单（2025）',
    content: '住房救助通过公租房保障、租赁补贴、危房改造等方式，帮助符合条件的住房困难家庭改善居住条件。',
    score: 0.75
  }
}

function withMeta(source, position) {
  return {
    position,
    dataset_id: 'demo-dataset',
    dataset_name: source.dataset_name,
    document_id: `demo-doc-${position}`,
    document_name: source.document_name,
    segment_id: `demo-seg-${position}`,
    score: source.score,
    content: source.content
  }
}

const ANSWERS = [
  {
    test: /特困|三无|五保/,
    answer:
      '特困人员救助供养面向无劳动能力、无生活来源，且无法定义务人或义务人无履行能力的老年人、残疾人和未成年人[citation:1]。\n\n**申请要点**\n1. 向户籍所在地镇（街道）提出申请，行动不便的可委托村（居）委会代办[citation:2]。\n2. 需提供身份证、户口簿及经济状况核对授权材料。\n3. 供养方式可选择分散供养或集中供养。\n\n> 演示模式：以上内容为预置示例，实际办理请以当地民政部门口径为准。',
    sources: [SOURCES.tekun, SOURCES.dibaoGuide]
  },
  {
    test: /临时|急难|突发|突然/,
    answer:
      '临时救助用于解决突发性、紧迫性、临时性的基本生活困难，分为**急难型**和**支出型**两类[citation:1]。\n\n- 急难型：火灾、交通事故等突发变故，可先救助后补材料。\n- 支出型：因医疗、教育等刚性支出导致基本生活困难。\n- 受理渠道：户籍地或居住地镇（街道）民政窗口[citation:2]。\n\n> 演示模式：以上内容为预置示例。',
    sources: [SOURCES.linshi, SOURCES.dibaoGuide]
  },
  {
    test: /医疗|看病|住院|报销/,
    answer:
      '医疗救助面向特困人员、低保对象等困难群众，对经基本医保、大病保险支付后的合规医疗费用按身份类别给予救助[citation:1]。\n\n**办理提示**\n1. 先按规定参加基本医疗保险并完成报销；\n2. 携带诊断证明、费用票据、身份证明向镇（街道）申请；\n3. 具体比例与限额以当年政策为准。\n\n> 演示模式：以上内容为预置示例。',
    sources: [SOURCES.yiliao, SOURCES.dibaoGuide]
  },
  {
    test: /住房|公租房|租房|危房/,
    answer:
      '住房救助主要通过**公租房保障、租赁补贴、危房改造**等方式，帮助符合条件的住房困难家庭改善居住条件[citation:1]。\n\n申请一般需满足户籍、家庭收入、住房面积等条件，向镇（街道）或住建部门提交申请。\n\n> 演示模式：以上内容为预置示例。',
    sources: [SOURCES.zhufang, SOURCES.dibaoGuide]
  },
  {
    test: /就业|培训|公益性岗位/,
    answer:
      '就业救助面向有劳动能力的困难群众，常见措施包括职业介绍、职业技能培训、公益性岗位安置和就业补贴。\n\n建议先到镇（街道）人社服务窗口做就业困难人员认定，再匹配岗位与培训资源。\n\n> 演示模式：本条没有检索到专门文档，仅作示例回答。',
    sources: [SOURCES.dibaoGuide]
  },
  {
    test: /低保|最低生活|困难家庭|咋弄|怎么申请|条件/,
    answer:
      '申请低保应以家庭为单位，同时符合户籍、收入、财产等条件[citation:1]。\n\n**主要条件**\n1. **户籍**：申请人或共同生活家庭成员具有本地户籍。\n2. **收入**：申请前 6 个月家庭人均月收入低于当地低保标准。\n3. **财产**：金融资产、不动产、机动车辆、商事登记等符合规定。\n4. **家庭成员**：包括配偶、父母和未成年子女、不能独立生活的成年子女等[citation:1]。\n\n**办理渠道**：携户口簿、身份证等原件向户籍所在地镇（街道）提出申请，也可委托村（居）委会代办[citation:2]。\n\n> 演示模式：以上内容为预置示例，具体标准以当地公布为准，可拨打 12345 咨询。',
    sources: [SOURCES.dibao, SOURCES.dibaoGuide]
  }
]

const REFUSAL =
  '这个问题不属于社会救助政策范围，我无法提供准确答复。您可以咨询低保、特困、临时救助、医疗/教育/住房/就业救助等政策，或拨打 12345 政务服务热线。\n\n> 演示模式：以上为示例拒答。'

const DEMO_SUGGESTIONS = {
  default: ['申请低保需要哪些材料？', '临时救助可以线上申请吗？', '特困人员供养标准是多少？']
}

// —— 内存中的会话数据（刷新页面后重置）——
const conversations = new Map()
let seeded = false

function seed() {
  if (seeded) return
  seeded = true
  const id = 'demo-conv-1'
  const ts = Math.floor(Date.now() / 1000)
  conversations.set(id, {
    id,
    name: '咨询低保申请条件',
    created_at: ts - 3600,
    updated_at: ts - 3500,
    messages: [
      {
        id: 'demo-msg-seed-1',
        query: '申请低保需要满足哪些条件？',
        answer: ANSWERS[5].answer,
        retriever_resources: ANSWERS[5].sources.map((s, i) => withMeta(s, i + 1)),
        feedback: null,
        created_at: ts - 3500
      }
    ]
  })
}

function pickAnswer(query) {
  const hit = ANSWERS.find((a) => a.test.test(query))
  if (hit) return { answer: hit.answer, sources: hit.sources }
  return { answer: REFUSAL, sources: [] }
}

export function isConfigured() {
  return true
}

export async function getAppParameters() {
  seed()
  return {
    opening_statement: '你好，我是基米民易通演示助手，请问需要什么帮助~（当前为演示模式，回答为预置示例）',
    suggested_questions: ['申请低保需要什么条件？', '临时救助怎么申请？', '特困人员救助供养包括哪些内容？', '医疗救助如何报销？'],
    suggested_questions_after_answer: { enabled: true },
    speech_to_text: { enabled: false },
    text_to_speech: { enabled: true },
    retriever_resource: { enabled: true },
    file_upload: {
      enabled: true,
      allowed_file_types: ['document', 'image'],
      allowed_file_extensions: ['.jpg', '.jpeg', '.png', '.webp'],
      allowed_file_upload_methods: ['local_file'],
      number_limits: 3,
      fileUploadConfig: { file_size_limit: 15, image_file_size_limit: 10 }
    }
  }
}

export async function getConversations() {
  seed()
  const list = [...conversations.values()]
    .sort((a, b) => b.updated_at - a.updated_at)
    .map(({ id, name, created_at, updated_at }) => ({ id, name, created_at, updated_at }))
  return { data: list, has_more: false }
}

export async function getChatHistory(conversationId) {
  seed()
  const conv = conversations.get(conversationId)
  if (!conv) return { data: [], has_more: false }
  const data = conv.messages
    .slice()
    .sort((a, b) => b.created_at - a.created_at)
    .map((m) => ({
      id: m.id,
      query: m.query,
      answer: m.answer,
      retriever_resources: m.retriever_resources,
      feedback: m.feedback ? { rating: m.feedback } : null,
      created_at: m.created_at
    }))
  return { data, has_more: false }
}

export async function deleteConversation(conversationId) {
  conversations.delete(conversationId)
  return { result: 'success' }
}

export async function renameConversation(conversationId, name) {
  const conv = conversations.get(conversationId)
  if (conv) conv.name = name
  return { result: 'success' }
}

export async function feedbackMessage(messageId, rating) {
  for (const conv of conversations.values()) {
    const msg = conv.messages.find((m) => m.id === messageId)
    if (msg) msg.feedback = rating
  }
  return { result: 'success' }
}

const suggestionMap = new Map()

export async function getSuggestedQuestions(messageId) {
  return suggestionMap.get(messageId) || DEMO_SUGGESTIONS.default
}

export function stopChatMessage() {
  return Promise.resolve()
}

export async function streamChatMessage({
  query,
  conversationId = '',
  files = [],
  signal,
  onDelta,
  onEnd,
  onTask
}) {
  seed()
  const messageId = randomId('demo-msg')
  const taskId = randomId('demo-task')
  onTask?.(taskId)

  const convId = conversationId || randomId('demo-conv')
  const now = Math.floor(Date.now() / 1000)
  if (!conversations.has(convId)) {
    conversations.set(convId, {
      id: convId,
      name: query.slice(0, 14) || '新的对话',
      created_at: now,
      updated_at: now,
      messages: []
    })
  }
  const conv = conversations.get(convId)

  const picked = pickAnswer(query)
  let answer = picked.answer
  const fileNote = files.length
    ? `\n\n（演示模式：已收到 ${files.length} 个附件，真实环境会由工作流解析文件内容。）`
    : ''
  answer += fileNote

  const chunks = answer.match(/[\s\S]{1,6}/g) || []
  for (const chunk of chunks) {
    if (signal?.aborted) {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    }
    onDelta?.(chunk)
    await sleep(18 + Math.random() * 22)
  }

  const retrieverResources = picked.sources.map((s, i) => withMeta(s, i + 1))
  conv.messages.push({
    id: messageId,
    query,
    answer,
    retriever_resources: retrieverResources,
    feedback: null,
    created_at: now
  })
  conv.updated_at = now
  if (conv.name === '新的对话') conv.name = query.slice(0, 14)

  suggestionMap.set(
    messageId,
    /低保/.test(query)
      ? ['收入条件具体怎么算？', '财产条件包括哪些？', '去哪里申请低保？']
      : DEMO_SUGGESTIONS.default
  )

  onEnd?.({ retriever_resources: retrieverResources })
  return { messageId, conversationId: convId }
}

/**
 * 演示模式不支持真实语音合成/识别：抛错后前端会自动回退到浏览器朗读；
 * 录音入口在演示模式下隐藏（parameters.speech_to_text.enabled=false）。
 */
export function textToAudio() {
  return Promise.reject(new Error('演示模式未连接 TTS 服务'))
}

export function audioToText() {
  return Promise.reject(new Error('演示模式不支持语音识别'))
}

export function uploadFile(file, user, onProgress) {
  return new Promise((resolve) => {
    let p = 0
    const timer = setInterval(() => {
      p = Math.min(1, p + 0.2 + Math.random() * 0.15)
      onProgress?.(p)
      if (p >= 1) {
        clearInterval(timer)
        const name = file.name || 'demo.txt'
        const dot = name.lastIndexOf('.')
        resolve({
          id: randomId('demo-file'),
          name,
          size: file.size || 0,
          extension: dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'txt',
          mime_type: file.type || 'text/plain'
        })
      }
    }, 120)
  })
}
