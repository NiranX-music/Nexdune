import { useState, useEffect, useRef } from "react"
import { Check, Copy } from "lucide-react"

/* Markdown renderer with KaTeX LaTeX support.
 *
 * Supports: fenced code, inline code, bold, italic, links, headings,
 * ordered/unordered lists, blockquotes, horizontal rules, and LaTeX
 * math expressions (both display $$ ... $$ and inline $ ... $).
 *
 * Nothing here reaches innerHTML for regular text — every piece of
 * content ends up as a React text node. KaTeX output is injected via
 * dangerouslySetInnerHTML only after rendering through the KaTeX library,
 * which escapes all user content internally.
 */

// ── KaTeX dynamic loader ─────────────────────────────────────────────────────
let katexPromise: Promise<typeof import("katex")> | null = null
function loadKatex() {
  if (!katexPromise) katexPromise = import("katex")
  return katexPromise
}

interface KatexBlockProps { tex: string; display: boolean }
function KatexBlock({ tex, display }: KatexBlockProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadKatex().then(mod => {
      if (cancelled || !ref.current) return
      try {
        mod.default.render(tex, ref.current, {
          displayMode: display,
          throwOnError: false,
          output: "html",
          trust: false,
          strict: "warn",
        })
        setError(null)
      } catch (e) {
        setError(String(e))
      }
    })
    return () => { cancelled = true }
  }, [tex, display])

  if (error) {
    return display
      ? <div className="md-math-error">{tex}</div>
      : <span className="md-math-error">{tex}</span>
  }
  return display
    ? <div className="md-math-display" ref={ref} aria-label={`Math: ${tex}`} />
    : <span className="md-math-inline" ref={ref} aria-label={`Math: ${tex}`} />
}

// ── Segment splitter ─────────────────────────────────────────────────────────
type Segment =
  | { kind: "code";    lang: string; body: string }
  | { kind: "mathblock"; body: string }
  | { kind: "text";   body: string }

/** Split source into fenced code, display math ($$…$$), and plain text. */
function segments(source: string): Segment[] {
  const out: Segment[] = []
  // Match fenced code blocks OR display math blocks
  const fence = /```([^\n`]*)\n?([\s\S]*?)(?:```|$)|\$\$([\s\S]*?)\$\$/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = fence.exec(source)) !== null) {
    if (match.index > last) out.push({ kind: "text", body: source.slice(last, match.index) })
    if (match[0].startsWith("```")) {
      out.push({ kind: "code", lang: match[1].trim(), body: match[2].replace(/\n$/, "") })
    } else {
      out.push({ kind: "mathblock", body: match[3].trim() })
    }
    last = fence.lastIndex
  }
  if (last < source.length) out.push({ kind: "text", body: source.slice(last) })
  return out
}

// ── Inline renderer with LaTeX ────────────────────────────────────────────────
/** Split text on inline math $…$ then apply Markdown inline marks. */
function inlineWithMath(text: string, key = "i"): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Split on inline math: $...$ (non-greedy, no newlines inside)
  const mathRe = /\$([^$\n]+?)\$/g
  let last = 0
  let mi: RegExpExecArray | null
  let idx = 0
  while ((mi = mathRe.exec(text)) !== null) {
    if (mi.index > last) {
      nodes.push(...inline(text.slice(last, mi.index), `${key}-t${idx++}`))
    }
    nodes.push(<KatexBlock key={`${key}-m${idx++}`} tex={mi[1]} display={false} />)
    last = mathRe.lastIndex
  }
  if (last < text.length) nodes.push(...inline(text.slice(last), `${key}-t${idx++}`))
  return nodes
}

/** Inline Markdown marks only (bold, italic, code, links). */
function inline(text: string, key = "i"): React.ReactNode[] {
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

// ── Code block ───────────────────────────────────────────────────────────────
function CodeBlock({ lang, body }: { lang: string; body: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch { /* denied clipboard is not worth an error */ }
  }
  return <figure className="md-code">
    <figcaption>
      <span>{lang || "text"}</span>
      <button type="button" onClick={() => void copy()} aria-label="Copy code">
        {copied ? <Check /> : <Copy />}
      </button>
    </figcaption>
    <pre><code>{body}</code></pre>
  </figure>
}

// ── Block-level renderer ──────────────────────────────────────────────────────
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
    const items = list.items.map((item, at) =>
      <li key={at}>{inlineWithMath(item, `${key}-li${at}`)}</li>)
    out.push(list.ordered
      ? <ol key={`${key}-l${out.length}`}>{items}</ol>
      : <ul key={`${key}-l${out.length}`}>{items}</ul>)
    list = null
  }
  const flushQuote = () => {
    if (!quote.length) return
    out.push(<blockquote key={`${key}-q${out.length}`}>
      {inlineWithMath(quote.join(" "), `${key}-q${out.length}`)}
    </blockquote>)
    quote = []
  }
  const flushAll = () => { flushParagraph(); flushList(); flushQuote() }

  for (const line of lines) {
    const heading  = /^(#{1,4})\s+(.*)$/.exec(line)
    const bullet   = /^\s*[-*+]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const quoted   = /^>\s?(.*)$/.exec(line)

    if (!line.trim()) { flushAll(); continue }
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      flushAll()
      out.push(<hr key={`${key}-hr${out.length}`} />)
      continue
    }
    if (heading) {
      flushAll()
      const level = heading[1].length
      const Tag = (["h2", "h3", "h4", "h5"][level - 1] || "h5") as "h2"
      out.push(<Tag key={`${key}-h${out.length}`}>
        {inlineWithMath(heading[2], `${key}-h${out.length}`)}
      </Tag>)
      continue
    }
    if (quoted)  { flushParagraph(); flushList(); quote.push(quoted[1]); continue }
    if (bullet || numbered) {
      flushParagraph(); flushQuote()
      const ordered = Boolean(numbered)
      const item    = (numbered || bullet)![1]
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

// ── Public component ──────────────────────────────────────────────────────────
export function Markdown({ text }: { text: string }) {
  return <div className="md">
    {segments(text).map((segment, at) => {
      if (segment.kind === "code")      return <CodeBlock key={at} lang={segment.lang} body={segment.body} />
      if (segment.kind === "mathblock") return <KatexBlock key={at} tex={segment.body} display={true} />
      return <div key={at}>{blocks(segment.body, `s${at}`)}</div>
    })}
  </div>
}
