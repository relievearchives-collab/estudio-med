import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useMemo } from 'react'

marked.setOptions({ gfm: true, breaks: true })

export function htmlDeMarkdown(md: string, enLinea = false) {
  const html = enLinea ? (marked.parseInline(md) as string) : (marked.parse(md) as string)
  return DOMPurify.sanitize(html)
}

export function Markdown({ texto, className = '', enLinea = false }: { texto: string; className?: string; enLinea?: boolean }) {
  const html = useMemo(() => htmlDeMarkdown(texto, enLinea), [texto, enLinea])
  const Tag = enLinea ? 'span' : 'div'
  return <Tag className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
