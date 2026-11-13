import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({
  gfm: true,
  breaks: true
})

/** Markdown 转 HTML，并做 XSS 过滤 */
export function renderMarkdown(text) {
  if (!text) return ''
  return DOMPurify.sanitize(marked.parse(text))
}

/** 转成纯文本（用于语音朗读），去掉 Markdown 标记与引用角标 */
export function toPlainText(text) {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[citation:\d+\]/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>]/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/**
 * 把回答中的 [citation:N] 标记替换为可点击角标。
 * 返回 { html, citations }，citations 为出现的序号（1 起）。
 */
export function renderWithCitations(text) {
  if (!text) return { html: '', citations: [] }
  const citations = []
  // 不预先转义：否则 Markdown 的 > 引用块会变成字面 &gt;；
  // 模型输出的 HTML 由最后的 DOMPurify 统一清洗。
  const withMarks = text.replace(/\[citation:(\d+)\]/g, (_, n) => {
    const idx = Number(n)
    if (!citations.includes(idx)) citations.push(idx)
    return `<sup class="citation-ref" data-citation="${idx}" title="查看来源 ${idx}">[${idx}]</sup>`
  })
  return { html: DOMPurify.sanitize(marked.parse(withMarks), { ADD_ATTR: ['data-citation'] }), citations }
}
