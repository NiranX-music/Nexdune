import { useState } from "react"
import { Check, Copy } from "lucide-react"
import katex from "katex"
import "katex/dist/katex.min.css"

/* Markdown renderer with full KaTeX LaTeX math support.
 *
 * Supports:
 * - Fenced code blocks with language badge and copy button
 * - Display math blocks: \[ ... \] and $$ ... $$
 * - Inline math expressions: \( ... \) and $ ... $
 * - Standard Markdown: headings, lists, quotes, hr, bold, italic, code, links
 *
 * Safe: text nodes escape HTML by construction. Math expressions are rendered
 * via KaTeX's renderToString which generates sanitized MathML/HTML.
 */

function MathSpan({ tex, display }: { tex: string; display: boolean }) {
  try {
    const html = katex.renderToString(tex.trim(), {
      displayMode: display,
      throwOnError: false,
      output: "htmlAndMathml",
      strict: false,
    })
    return display ? (
      <div className="md-math-display" dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
      <span className="md-math-inline" dangerouslySetInnerHTML={{ __html: html }} />
    )
  } catch {
    return display ? (
      <pre className="md-math-error">{tex}</pre>
    ) : (
      <code className="md-math-error">{tex}</code>
    )
  }
}

type Segment =
  | { kind: "code"; lang: string; body: string }
  | { kind: "math"; body: string }
  | { kind: "text"; body: string }

/** Split source on fenced code blocks and display math blocks first. */
function segments(source: string): Segment[] {
  const out: Segment[] = []
  // Matches ```code``` OR \[math\] OR $$math$$
  const fence = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)|\\\[([\s\S]*?)(?:\\\]|$)|(?:\$\$)([\s\S]*?)(?:\$\$|$)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = fence.exec(source)) !== null) {
    if (match.index > last) {
      out.push({ kind: "text", body: source.slice(last, match.index) })
    }
    if (match[0].startsWith("```")) {
      out.push({ kind: "code", lang: match[1]?.trim() || "", body: (match[2] || "").replace(/\n$/, "") })
    } else if (match[0].startsWith("\\[")) {
      out.push({ kind: "math", body: match[3]?.trim() || "" })
    } else {
      out.push({ kind: "math", body: match[4]?.trim() || "" })
    }
    last = fence.lastIndex
  }
  if (last < source.length) {
    out.push({ kind: "text", body: source.slice(last) })
  }
  return out
}

/** Inline math marks: \(...\) and $...$ */
function inlineWithMath(text: string, key = "i"): React.ReactNode[] {
  const pattern = /\\\(([\s\S]*?)\\\)|\$([^$\n]+?)\$/g
  const nodes: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(...inlineMarks(text.slice(last, match.index), `${key}-t${index++}`))
    }
    const mathContent = match[1] ?? match[2]
    nodes.push(<MathSpan key={`${key}-m${index++}`} tex={mathContent} display={false} />)
    last = pattern.lastIndex
  }
  if (last < text.length) {
    nodes.push(...inlineMarks(text.slice(last), `${key}-t${index++}`))
  }
  return nodes
}

/** Standard inline marks (code, bold, italic, links). */
function inlineMarks(text: string, key = "i"): React.ReactNode[] {
  const pattern = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\]\([^)\s]+\))/
  const nodes: React.ReactNode[] = []
  let rest = text
  let index = 0
  for (let match = pattern.exec(rest); match; match = pattern.exec(rest)) {
    if (match.index > 0) nodes.push(rest.slice(0, match.index))
    const token = match[0]
    const id = `${key}-${index++}`
    if (token.startsWith("`")) nodes.push(<code key={id}>{token.slice(1, -1)}</code>)
    else if (token.startsWith("**")) nodes.push(<strong key={id}>{token.slice(2, -2)}</strong>)
    else if (token.startsWith("*")) nodes.push(<em key={id}>{token.slice(1, -1)}</em>)
    else {
      const cut = token.indexOf("](")
      const label = token.slice(1, cut)
      const href = token.slice(cut + 2, -1)
      const safe = /^(https?:|mailto:)/i.test(href)
      nodes.push(safe
        ? <a key={id} href={href} target="_blank" rel="noreferrer noopener">{label}</a>
        : <span key={id}>{label}</span>)
    }
    rest = rest.slice(match.index + token.length)
  }
  if (rest) nodes.push(rest)
  return nodes
}

function CodeBlock({ lang, body }: { lang: string; body: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch { /* ignored */ }
  }
  return (
    <figure className="md-code">
      <figcaption>
        <span>{lang || "text"}</span>
        <button type="button" onClick={() => void copy()} aria-label="Copy code">
          {copied ? <Check /> : <Copy />}
        </button>
      </figcaption>
      <pre><code>{body}</code></pre>
    </figure>
  )
}

/** One text segment: block structure, then inline marks inside each block. */
function blocks(source: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const lines = source.split("\n")
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let quote: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    out.push(<p key={`${key}-p${out.length}`}>{inlineWithMath(paragraph.join(" "), `${key}-p${out.length}`)}</p>)
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    const items = list.items.map((item, at) => <li key={at}>{inlineWithMath(item, `${key}-li${at}`)}</li>)
    out.push(list.ordered ? <ol key={`${key}-l${out.length}`}>{items}</ol>
                          : <ul key={`${key}-l${out.length}`}>{items}</ul>)
    list = null
  }
  const flushQuote = () => {
    if (!quote.length) return
    out.push(<blockquote key={`${key}-q${out.length}`}>{inlineWithMath(quote.join(" "), `${key}-q${out.length}`)}</blockquote>)
    quote = []
  }
  const flushAll = () => { flushParagraph(); flushList(); flushQuote() }

  for (const line of lines) {
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const quoted = /^>\s?(.*)$/.exec(line)

    if (!line.trim()) { flushAll(); continue }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) { flushAll(); out.push(<hr key={`${key}-hr${out.length}`} />); continue }
    if (heading) {
      flushAll()
      const level = heading[1].length
      const Tag = (["h2", "h3", "h4", "h5"][level - 1] || "h5") as "h2"
      out.push(<Tag key={`${key}-h${out.length}`}>{inlineWithMath(heading[2], `${key}-h${out.length}`)}</Tag>)
      continue
    }
    if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); continue }
    if (bullet || numbered) {
      flushParagraph(); flushQuote()
      const ordered = Boolean(numbered)
      const item = (numbered || bullet)![1]
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] } }
      list.items.push(item)
      continue
    }
    flushList(); flushQuote()
    paragraph.push(line.trim())
  }
  flushAll()
  return out
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      {segments(text).map((segment, at) => {
        if (segment.kind === "code") {
          return <CodeBlock key={at} lang={segment.lang} body={segment.body} />
        }
        if (segment.kind === "math") {
          return <MathSpan key={at} tex={segment.body} display={true} />
        }
        return <div key={at}>{blocks(segment.body, `s${at}`)}</div>
      })}
    </div>
  )
}
