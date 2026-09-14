/**
 * 极简 Markdown 渲染：供知识库文章预览与公开阅读页使用。
 *
 * 只覆盖文章场景常用的子集（标题、加粗、斜体、行内代码、代码块、
 * 链接、列表、引用、分割线、段落），不引入第三方依赖。
 * 输出前先做 HTML 转义，再按白名单拼标签，因此不存在 XSS 注入面。
 */

function escapeHtml(raw: string) {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 行内元素：行内代码 → 加粗 → 斜体 → 链接。顺序固定，避免互相吞掉。 */
function inline(raw: string) {
  let out = escapeHtml(raw)
  out = out.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  return out
}

/** 把 Markdown 文本转成可直接 v-html 的 HTML 片段。 */
export function renderMarkdown(source: string) {
  const lines = (source ?? '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let listTag: '' | 'ul' | 'ol' = ''
  let quoteBuf: string[] = []

  const closeList = () => {
    if (listTag) {
      html.push(`</${listTag}>`)
      listTag = ''
    }
  }
  const closeQuote = () => {
    if (quoteBuf.length) {
      html.push(`<blockquote class="md-quote">${quoteBuf.map((line) => inline(line)).join('<br />')}</blockquote>`)
      quoteBuf = []
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push(`<pre class="md-pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        closeList()
        closeQuote()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      closeList()
      closeQuote()
      const level = heading[1].length
      html.push(`<h${level} class="md-h${level}">${inline(heading[2].trim())}</h${level}>`)
      continue
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      closeList()
      closeQuote()
      html.push('<hr class="md-hr" />')
      continue
    }
    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      closeList()
      quoteBuf.push(quote[1])
      continue
    }
    closeQuote()

    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/)
    if (ordered || unordered) {
      const tag = ordered ? 'ol' : 'ul'
      if (listTag !== tag) {
        closeList()
        html.push(`<${tag} class="md-list">`)
        listTag = tag
      }
      html.push(`<li>${inline((ordered ?? unordered)![1])}</li>`)
      continue
    }
    closeList()

    if (!line.trim()) continue
    html.push(`<p class="md-p">${inline(line.trim())}</p>`)
  }

  if (inCode) {
    html.push(`<pre class="md-pre"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`)
  }
  closeList()
  closeQuote()
  return html.join('\n')
}
