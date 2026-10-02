import { useEffect, useMemo, useRef, useState } from "react"
import {
  Activity,
  ArrowUp,
  BrainCircuit,
  CircleStop,
  Clock,
  Cpu,
  Database,
  Search,
  SquarePen,
  History,
  Settings2,
  Sun,
  Moon,
  X,
  Download,
  Copy,
  ChevronDown,
  Code2,
  Gauge,
  Globe,
  HardDrive,
  KeyRound,
  AlertTriangle,
  Layers,
  Link2,
  LoaderCircle,
  MemoryStick,
  MessageSquareText,
  MonitorDot,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  StepForward,
  SlidersHorizontal,
  Timer,
  Trash2,
  Zap,
  ImagePlus,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getHealth, listModels, streamChat, type ChatMessage, type HealthResponse, type StreamChatResult } from "@/lib/api"
import { resendFrom } from "@/lib/chat"
import { activeRequests, supportsCacheSlots, supportsContinuation } from "@/lib/runtime"
import Brio from "./Brio"
import { BrainWorkspace } from "./BrainWorkspace"
import { Brand } from "./components/Brand"
import { Markdown } from "./components/Markdown"
import { NavigationDock, type View } from "./components/NavigationDock"
import { Profiling } from "./Profiling"
import { persistPublicSettings, stored } from "@/lib/storage"
import { appendDelta, continuable, continuation, setFinish } from "@/lib/transcript"
import { cn } from "@/lib/utils"
import { useLocale } from "./i18n"

const message = (role: ChatMessage["role"], content: string, images?: string[]): ChatMessage => {
  let id: string
  try {
    id = crypto.randomUUID()
  } catch {
    id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
    })
  }
  return images?.length ? { id, role, content, images } : { id, role, content }
}

export default function App() {
  const { t, locale, setLocale, locales } = useLocale()

  const servedByEngine =
    typeof window !== "undefined" &&
    window.location.port !== "5173" &&
    window.location.protocol.startsWith("http")
  const defaultBase = servedByEngine ? `${window.location.origin}/v1` : "http://127.0.0.1:8000/v1"
  const [baseUrl, setBaseUrl] = useState(() => {
    const saved = stored(localStorage, "nexdune.baseUrl", defaultBase)
    if (servedByEngine && saved === "http://127.0.0.1:8000/v1" && defaultBase !== saved) return defaultBase
    return saved
  })
  const [apiKey, setApiKey] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState(() => stored(localStorage, "nexdune.model", "olmoe-nexdune"))
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(4096)
  const [thinking, setThinking] = useState(false)
  const [cacheSlot, setCacheSlot] = useState(0)
  const [conversations, setConversations] = useState<Record<number, ChatMessage[]>>({ 0: [] })
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState("")
  const [lastRun, setLastRun] = useState<StreamChatResult | null>(null)
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(false)
  const [tokenCount, setTokenCount] = useState(0)
  const [tokPerSec, setTokPerSec] = useState<number | null>(null)
  const [ttft, setTtft] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState<number>(0)
  const [totalTokens, setTotalTokens] = useState({ prompt: 0, completion: 0 })
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [view, setView] = useState<View>("chat")
  const [settingsPage, setSettingsPage] = useState("general")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [archives, setArchives] = useState<Array<{ id: string; slot: number; messages: ChatMessage[] }>>([])
  const [theme, setTheme] = useState(() => stored(localStorage, "nexdune.theme", "dark"))
  const [copied, setCopied] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => stored(localStorage, "nexdune.sidebarOpen", "true") === "true")
  const [thinkingSidebarOpen, setThinkingSidebarOpen] = useState(false)
  const [selectedReasoning, setSelectedReasoning] = useState<string | null>(null)

  const draftRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<string[]>([])
  const historyDialog = useRef<HTMLDialogElement>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem("nexdune.theme", theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem("nexdune.sidebarOpen", String(sidebarOpen))
    } catch {}
  }, [sidebarOpen])

  useEffect(() => {
    if (historyOpen) historyDialog.current?.showModal()
    else historyDialog.current?.close()
  }, [historyOpen])

  const [error, setError] = useState("")
  const autoConnected = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const probeRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const messages = conversations[cacheSlot] || []
  const kvSlots = Math.max(1, health?.kv_slots || 1)
  const active = activeRequests(health)
  const capacity = health?.scheduler?.capacity || kvSlots
  const failures = health?.scheduler
    ? health.scheduler.rejected + health.scheduler.timed_out + health.scheduler.cancelled
    : 0

  // The latest reasoning in current conversation or selected
  const activeReasoning = useMemo(() => {
    if (selectedReasoning) return selectedReasoning
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].reasoning) return messages[i].reasoning
    }
    return null
  }, [messages, selectedReasoning])

  const updateMessages = (next: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[])) =>
    setConversations((current) => ({
      ...current,
      [cacheSlot]: typeof next === "function" ? next(current[cacheSlot] || []) : next,
    }))

  useEffect(() => {
    persistPublicSettings(localStorage, baseUrl, model)
  }, [baseUrl, model])

  useEffect(() => {
    setConnected(false)
    setHealth(null)
    setHealthError("")
  }, [baseUrl, apiKey])

  useEffect(
    () => () => {
      probeRef.current?.abort()
      abortRef.current?.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    },
    []
  )

  useEffect(() => {
    if (!connected) return
    let disposed = false
    const poll = async () => {
      if (document.visibilityState === "hidden") return
      try {
        const result = await getHealth(baseUrl, apiKey)
        if (!disposed) {
          setHealth(result)
          setHealthError("")
        }
      } catch (cause) {
        if (!disposed) setHealthError(cause instanceof Error ? cause.message : "status.runtimeUnavailable")
      }
    }
    const timer = window.setInterval(() => void poll(), 5000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [apiKey, baseUrl, connected])

  useEffect(() => {
    if (cacheSlot >= kvSlots) setCacheSlot(0)
  }, [cacheSlot, kvSlots])

  useEffect(() => {
    setLastRun(null)
  }, [cacheSlot])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const connect = async () => {
    probeRef.current?.abort()
    const controller = new AbortController()
    probeRef.current = controller
    setConnecting(true)
    setError("")
    try {
      const found = await listModels(baseUrl, apiKey, controller.signal)
      setModels(found)
      if (found.length && !found.includes(model)) setModel(found[0])
      setConnected(true)
      try {
        setHealth(await getHealth(baseUrl, apiKey, controller.signal))
        setHealthError("")
      } catch (cause) {
        if (!controller.signal.aborted) {
          setHealth(null)
          setHealthError(cause instanceof Error ? cause.message : "status.runtimeUnavailable")
        }
      }
    } catch (cause) {
      if (controller.signal.aborted) return
      setConnected(false)
      setError(cause instanceof Error ? cause.message : "status.serverError")
    } finally {
      if (probeRef.current === controller) {
        probeRef.current = null
        setConnecting(false)
      }
    }
  }

  if (servedByEngine && !autoConnected.current && !connected) {
    autoConnected.current = true
    setTimeout(() => connect(), 0)
  }

  const attach = async (files: FileList | File[] | null) => {
    const pictures = Array.from(files || []).filter((file) => file.type.startsWith("image/"))
    if (!pictures.length) return
    const read = (file: File) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    try {
      const urls = await Promise.all(pictures.map(read))
      setPending((current) => [...current, ...urls])
    } catch {
      setError("status.serverError")
    }
  }

  const canSend = useMemo(
    () => (draft.trim() || pending.length) && model && !loading,
    [draft, loading, model, pending]
  )

  const runStream = async (payload: ChatMessage[], targetId: string) => {
    setError("")
    setLoading(true)
    setTokenCount(0)
    setTokPerSec(null)
    setTtft(null)
    setElapsed(0)
    let decodeStart = 0
    const t0 = performance.now()
    let firstToken = true
    let count = 0

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      setElapsed(Number(((performance.now() - t0) / 1000).toFixed(1)))
    }, 100)

    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await streamChat({
        baseUrl,
        apiKey,
        model,
        messages: payload,
        temperature,
        maxTokens,
        enableThinking: thinking,
        cacheSlot: supportsCacheSlots(health) ? cacheSlot : undefined,
        signal: controller.signal,
        onReasoning: (delta) => {
          if (firstToken) {
            setTtft(performance.now() - t0)
            decodeStart = performance.now()
            firstToken = false
          }
          count++
          setTokenCount(count)
          const since = (performance.now() - decodeStart) / 1000
          if (count > 1 && since > 0.2) setTokPerSec((count - 1) / since)
          updateMessages((current) => appendDelta(current, targetId, "reasoning", delta))
        },
        onDelta: (delta) => {
          if (firstToken) {
            setTtft(performance.now() - t0)
            decodeStart = performance.now()
            firstToken = false
          }
          count++
          setTokenCount(count)
          const since = (performance.now() - decodeStart) / 1000
          if (count > 1 && since > 0.2) setTokPerSec((count - 1) / since)
          updateMessages((current) => appendDelta(current, targetId, "content", delta))
        },
      })
      const decodeElapsed = (performance.now() - (decodeStart || t0)) / 1000
      if (count > 1 && decodeElapsed > 0) setTokPerSec((count - 1) / decodeElapsed)
      if (result.usage)
        setTotalTokens((prev) => ({
          prompt: prev.prompt + (result.usage?.prompt_tokens || 0),
          completion: prev.completion + (result.usage?.completion_tokens || 0),
        }))
      setLastRun(result)
      updateMessages((current) => setFinish(current, targetId, result.finishReason))
      setConnected(true)
    } catch (cause) {
      const finish = controller.signal.aborted ? "aborted" : "error"
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "status.generationFailed")
      updateMessages((current) =>
        setFinish(current, targetId, finish).filter((item) => item.id !== targetId || item.content || item.reasoning)
      )
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      setElapsed(Number(((performance.now() - t0) / 1000).toFixed(2)))
      abortRef.current = null
      setLoading(false)
    }
  }

  const send = async (text = draft, previous = messages, pictures = pending, consumeDraft = true) => {
    const content = text.trim()
    if ((!content && !pictures.length) || loading) return
    const user = message("user", content, pictures)
    const assistant = message("assistant", "")
    const history = [...previous, user]
    if (consumeDraft) {
      setDraft("")
      setPending([])
    }
    updateMessages([...history, assistant])
    await runStream(history, assistant.id)
  }

  const continueTurn = async () => {
    if (loading) return
    const request = continuation(messages)
    if (!request) return
    updateMessages(request.history)
    await runStream(request.history, request.targetId)
  }

  const openSettings = (page = "general") => {
    setSettingsPage(page)
    setView("settings")
  }

  const clearChat = () => {
    updateMessages([])
    setLastRun(null)
    setTokPerSec(null)
    setTtft(null)
    setTokenCount(0)
    setElapsed(0)
    setSelectedReasoning(null)
    setTotalTokens({ prompt: 0, completion: 0 })
    setError("")
  }

  const newChat = () => {
    if (loading) return
    if (messages.length)
      setArchives((items) => [{ id: message("system", "").id, slot: cacheSlot, messages: [...messages] }, ...items])
    clearChat()
    setDraft("")
    setView("chat")
    requestAnimationFrame(() => draftRef.current?.focus())
  }

  const exportChat = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ model, messages }, null, 2)], { type: "application/json" })
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "nexdune-chat.json"
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const copyMessage = async (item: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(item.content)
      setCopied(item.id)
    } catch {
      setError(t("ui.copyError"))
    }
  }

  const restoreArchive = (entry: { id: string; slot: number; messages: ChatMessage[] }) => {
    if (loading) return
    const slot = entry.slot < kvSlots ? entry.slot : cacheSlot
    const currentMessages = conversations[slot] || []
    setArchives((items) => [
      ...(currentMessages.length ? [{ id: message("system", "").id, slot, messages: currentMessages }] : []),
      ...items.filter((item) => item.id !== entry.id),
    ])
    setConversations((items) => ({ ...items, [slot]: entry.messages }))
    setCacheSlot(slot)
    setView("chat")
    setHistoryOpen(false)
    setLastRun(null)
    setError("")
    setDraft("")
  }

  const empty = messages.length === 0

  const connectionControls = (
    <fieldset disabled={loading}>
      <section className="side-section">
        <div className="section-title">
          <Link2 className="size-3.5" /> {t("sidebar.connection")}
        </div>
        <label>
          {t("sidebar.endpoint")}
          <Input id="endpoint" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>
        <label>
          {t("sidebar.apiKey")}
          <div className="relative">
            <KeyRound className="field-icon" />
            <Input
              id="api-key"
              className="pl-9"
              type="password"
              value={apiKey}
              placeholder={t("sidebar.apiKeyPlaceholder")}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
          <span className="field-help">{t("sidebar.apiKeyHelp")}</span>
        </label>
        <Button type="button" variant="secondary" onClick={connect} disabled={connecting}>
          {connecting ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t("sidebar.probe")}
        </Button>
        <div className={cn("connection-state", connected && "connected")} aria-live="polite">
          <span />
          {connected ? t("status.connected") : t("status.notConnected")}
        </div>
      </section>
    </fieldset>
  )

  const inferenceControls = (
    <fieldset disabled={loading}>
      <section className="side-section">
        <div className="section-title">
          <SlidersHorizontal className="size-3.5" /> {t("sidebar.inference")}
        </div>
        <label>
          {t("sidebar.model")}
          <select id="model-select" value={model} onChange={(event) => setModel(event.target.value)}>
            {models.length ? (
              models.map((id) => <option key={id}>{id}</option>)
            ) : (
              <option>{model}</option>
            )}
          </select>
        </label>
        {health?.kv_slots && health.kv_slots > 1 ? (
          <label>
            {t("sidebar.kvSession")}
            <select
              id="kv-slot"
              value={cacheSlot}
              onChange={(event) => setCacheSlot(Number(event.target.value))}
              disabled={loading}
            >
              {Array.from({ length: kvSlots }, (_, slot) => (
                <option key={slot} value={slot}>
                  {t("sidebar.sessionLabel", { slot: slot + 1 })}
                </option>
              ))}
            </select>
            <span className="field-help">{t("sidebar.kvSessionHelp")}</span>
          </label>
        ) : null}
        <label>
          <span className="label-line">
            <span>{t("sidebar.temperature")}</span>
            <code>{temperature.toFixed(1)}</code>
          </span>
          <input
            id="temperature"
            className="range"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(event) => setTemperature(Number(event.target.value))}
          />
        </label>
        <label>
          {t("sidebar.maxTokens")}
          <Input
            id="max-tokens"
            type="number"
            min={1}
            max={32768}
            value={maxTokens}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isFinite(value)) setMaxTokens(Math.min(32768, Math.max(1, Math.round(value))))
            }}
          />
        </label>
        <button
          type="button"
          className={cn("toggle-row", thinking && "active")}
          aria-pressed={thinking}
          onClick={() => setThinking((value) => !value)}
        >
          <span>
            <BrainCircuit className="size-4" /> {t("sidebar.reasoning")}
          </span>
          <i>
            <b />
          </i>
        </button>
      </section>
    </fieldset>
  )

  const runtimeControls = (
    <section className="side-section runtime-section" aria-live="polite">
      <div className="section-title">
        <Activity className="size-3.5" /> {t("sidebar.runtime")}
      </div>
      {health?.hwinfo ? (
        <div className="hw-panel">
          {health.hwinfo.cpu ? (
            <div className="hw-row">
              <Cpu className="size-3.5" />
              <span>{health.hwinfo.cpu}</span>
            </div>
          ) : null}
          {health.hwinfo.gpus > 0 ? (
            <div className="hw-row">
              <MonitorDot className="size-3.5" />
              <span>
                {health.hwinfo.gpus}× GPU<small>{health.hwinfo.vram_total_gb.toFixed(0)} GB VRAM</small>
              </span>
            </div>
          ) : null}
          <div className="hw-row">
            <MemoryStick className="size-3.5" />
            <span>
              {health.hwinfo.ram_total_gb.toFixed(0)} GB RAM
              <small>{health.hwinfo.ram_avail_gb.toFixed(0)} GB free</small>
            </span>
          </div>
          <div className="hw-row">
            <HardDrive className="size-3.5" />
            <span>{health.hwinfo.cores} cores</span>
          </div>
        </div>
      ) : null}
      {health?.scheduler ? (
        <>
          <div className="runtime-grid">
            <div>
              <span>{t("dashboard.active")}</span>
              <strong>
                {active}
                <small> / {capacity}</small>
              </strong>
            </div>
            <div>
              <span>{t("dashboard.queued")}</span>
              <strong>
                {health.scheduler.queued}
                <small> / {health.scheduler.max_queue}</small>
              </strong>
            </div>
            <div>
              <span>{t("dashboard.completed")}</span>
              <strong>{health.scheduler.completed}</strong>
            </div>
            <div>
              <span>{t("dashboard.failures")}</span>
              <strong>{failures}</strong>
            </div>
          </div>
          {health.tiers ? (
            (() => {
              const ti = health.tiers
              const total = Math.max(ti.vram + ti.ram + ti.disk, 1)
              return (
                <div className="tier-panel">
                  <div
                    className="tier-bar"
                    role="img"
                    aria-label={t("tier.ariaLabel", { vram: ti.vram, ram: ti.ram, disk: ti.disk })}
                  >
                    <span className="tier-vram" style={{ width: `${(100 * ti.vram) / total}%` }} />
                    <span className="tier-ram" style={{ width: `${(100 * ti.ram) / total}%` }} />
                    <span className="tier-disk" style={{ width: `${(100 * ti.disk) / total}%` }} />
                  </div>
                  <div className="tier-legend">
                    <span>
                      <i className="tier-vram" />
                      {t("tier.vram")} <strong>{ti.vram.toLocaleString()}</strong>
                      <small>{ti.vram_gb.toFixed(1)} GB</small>
                    </span>
                    <span>
                      <i className="tier-ram" />
                      {t("tier.ram")} <strong>{ti.ram.toLocaleString()}</strong>
                      <small>{ti.ram_gb.toFixed(1)} GB</small>
                    </span>
                    <span>
                      <i className="tier-disk" />
                      {t("tier.disk")} <strong>{ti.disk.toLocaleString()}</strong>
                    </span>
                  </div>
                </div>
              )
            })()
          ) : null}
          {totalTokens.prompt + totalTokens.completion > 0 ? (
            <div className="session-stats">
              <span>
                <Database className="size-3" /> {t("dashboard.session")}{" "}
                <strong>{totalTokens.prompt.toLocaleString()}</strong> {t("dashboard.prompt")} +{" "}
                <strong>{totalTokens.completion.toLocaleString()}</strong> {t("dashboard.completion")}
              </span>
            </div>
          ) : null}
          <div className="runtime-foot">
            <span className="runtime-dot" /> {t("sidebar.schedulerOnline")}{" "}
            <code>{kvSlots} KV</code>
          </div>
        </>
      ) : (
        <p className="runtime-unavailable">
          {connected ? (healthError ? t(healthError) : t("status.runtimeUnavailable")) : t("sidebar.runtimeProbe")}
        </p>
      )}
    </section>
  )

  const topbarMetrics = (
    <div className="workspace-metrics" aria-live="polite">
      {(loading || elapsed > 0) && (
        <Badge className={cn("badge-timer", loading && "badge-live")} title="Elapsed generation time">
          <Clock className="size-3" />
          <span>{elapsed > 0 ? `${elapsed.toFixed(1)}s` : "0.0s"}</span>
        </Badge>
      )}
      {tokPerSec != null && (
        <Badge className={cn("badge-speed", loading && "badge-live")} title="Tokens per second">
          <Gauge className="size-3" />
          <span>{tokPerSec.toFixed(1)} tok/s</span>
        </Badge>
      )}
      {tokenCount > 0 && (
        <Badge className="badge-tokens" title="Generated tokens">
          <Zap className="size-3" />
          <span>{tokenCount} tok</span>
        </Badge>
      )}
      {!loading && ttft != null && (
        <Badge className="badge-ttft" title="Time to first token">
          <Timer className="size-3" />
          <span>TTFT {(ttft / 1000).toFixed(2)}s</span>
        </Badge>
      )}
    </div>
  )

  return (
    <div className="app-shell redesigned">
      {/* ── Left Slim Icon Rail ── */}
      <aside className="rail" aria-label={t("ui.sidebar")}>
        <button className="rail-brand" title="Nexdune" onClick={() => setView("chat")}>
          <Brand />
        </button>

        {/* Contract / Expand sidebar toggle */}
        <button
          className={cn("rail-button", sidebarOpen && "active")}
          aria-label={sidebarOpen ? "Contract controls sidebar" : "Expand controls sidebar"}
          title={sidebarOpen ? "Contract controls sidebar" : "Expand controls sidebar"}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </button>

        <button
          className="rail-button"
          aria-label={t("ui.newChat")}
          title={t("ui.newChat")}
          onClick={newChat}
          disabled={loading}
        >
          <SquarePen />
        </button>
        <button
          className="rail-button"
          aria-label={t("ui.search")}
          title={t("ui.search")}
          onClick={() => {
            setQuery("")
            setHistoryOpen(true)
          }}
        >
          <Search />
        </button>
        <button
          className="rail-button"
          aria-label={t("ui.history")}
          title={t("ui.history")}
          onClick={() => {
            setQuery("")
            setHistoryOpen(true)
          }}
        >
          <History />
        </button>

        <div className="rail-bottom">
          <button
            className={cn("rail-button", view === "settings" && "active")}
            aria-label={t("ui.settings")}
            title={t("ui.settings")}
            onClick={() => openSettings()}
          >
            <Settings2 />
          </button>
          <button
            className="rail-button"
            aria-label={t("ui.theme")}
            title={t("ui.theme")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
        </div>
      </aside>

      {/* ── Expandable / Contractable Left Sidebar Drawer with Controls ── */}
      {sidebarOpen && (
        <aside className="sidebar-drawer" aria-label="Controls and Settings">
          <header className="sidebar-drawer-header">
            <div className="sidebar-drawer-title">
              <SlidersHorizontal className="size-4 text-[#5fd7d7]" />
              <span>Controls &amp; Model</span>
            </div>
            <button
              className="icon-action"
              aria-label="Contract sidebar"
              title="Contract sidebar"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelLeftClose className="size-4" />
            </button>
          </header>
          <div className="sidebar-drawer-content">
            {inferenceControls}
            {connectionControls}
            {runtimeControls}
          </div>
        </aside>
      )}

      {/* ── Main Workspace ── */}
      <main className={cn("workspace", view === "brain" && "brain-workspace")}>
        {view !== "brain" && (
          <header className="workspace-topbar">
            <div className="flex items-center gap-3 min-w-0">
              <button className="model-button" onClick={() => openSettings("model")}>
                <span>{model}</span>
                <ChevronDown />
              </button>
            </div>

            {/* Prominent Live Speed & Timing in Topbar */}
            {topbarMetrics}

            <div className="workspace-actions">
              {/* Toggle Thinking Sidebar button */}
              <button
                className={cn("icon-action", thinkingSidebarOpen && "active text-[#5fd7d7]")}
                aria-label="Toggle Thinking Sidebar"
                title="Toggle Thinking Sidebar"
                onClick={() => setThinkingSidebarOpen((v) => !v)}
              >
                <BrainCircuit className="size-4" />
              </button>

              <button
                className={cn("connection-state", connected && "connected")}
                onClick={() => openSettings("connection")}
              >
                <span />
                {connected ? t("status.connected") : t("status.notConnected")}
              </button>
              {view === "chat" && (
                <>
                  <button
                    className="icon-action"
                    aria-label={t("ui.export")}
                    title={t("ui.export")}
                    disabled={empty}
                    onClick={exportChat}
                  >
                    <Download />
                  </button>
                  <button
                    className="icon-action"
                    aria-label={t("topbar.clear")}
                    title={t("topbar.clear")}
                    disabled={empty || loading}
                    onClick={clearChat}
                  >
                    <Trash2 />
                  </button>
                </>
              )}
            </div>
          </header>
        )}

        {view === "settings" ? (
          <section className="settings-page">
            <header className="page-heading">
              <span>NEXDUNE</span>
              <h1>{t("ui.settings")}</h1>
              <p>{t("ui.settingsIntro")}</p>
            </header>
            <nav className="settings-tabs" aria-label={t("ui.settings")}>
              {["general", "model", "connection", "system"].map((id) => (
                <button
                  key={id}
                  aria-current={settingsPage === id ? "page" : undefined}
                  onClick={() => setSettingsPage(id)}
                >
                  {t(`ui.${id}`)}
                </button>
              ))}
            </nav>
            {error && (
              <div className="error-banner" role="alert">
                {t(error)}
              </div>
            )}
            <div className="settings-content">
              {settingsPage === "general" && (
                <section className="settings-card">
                  <h2>{t("ui.appearance")}</h2>
                  <div className="theme-choices">
                    {["dark", "light"].map((value) => (
                      <button
                        key={value}
                        className={`theme-choice ${value}`}
                        aria-pressed={theme === value}
                        onClick={() => setTheme(value)}
                      >
                        <span />
                        <b>{t(`ui.${value}`)}</b>
                      </button>
                    ))}
                  </div>
                  <label className="language-field">
                    <Globe />
                    {t("ui.language")}
                    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
                      {locales.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="settings-help">{t("chat.inputHint")}</p>
                </section>
              )}
              {settingsPage === "connection" && <section className="settings-card">{connectionControls}</section>}
              {settingsPage === "model" && <section className="settings-card">{inferenceControls}</section>}
              {settingsPage === "system" && (
                <section className="settings-card">
                  {runtimeControls}
                </section>
              )}
            </div>
          </section>
        ) : view === "brain" ? (
          <BrainWorkspace baseUrl={baseUrl} apiKey={apiKey} connected={connected} />
        ) : view === "profiling" ? (
          <section className="profiling-workspace">
            <header className="page-heading">
              <span>NEXDUNE / ENGINE</span>
              <h1>Profiling</h1>
            </header>
            <Profiling baseUrl={baseUrl} apiKey={apiKey} connected={connected} />
          </section>
        ) : (
          <section className={cn("chat-view", empty && "empty")} hidden={view === "brio"}>
            {empty ? (
              <div className="welcome-brand">
                <Brand word />
              </div>
            ) : (
              <div className="conversation" role="log" aria-label={t("nav.chat")}>
                <div className="message-list">
                  {messages.map((item, index) => (
                    <article key={item.id} className={cn("message", item.role)}>
                      {item.role !== "user" && (
                        <div className="assistant-brand">
                          <Brand />
                          <span>Nexdune</span>
                        </div>
                      )}
                      {item.images?.length ? (
                        <div className="message-images">
                          {item.images.map((url, at) => (
                            <img key={at} src={url} alt={t("ui.attachedImage", { n: at + 1 })} />
                          ))}
                        </div>
                      ) : null}
                      <div className="message-body">
                        {item.reasoning ? (
                          <details className="reasoning-bubble" open={!item.content}>
                            <summary className="reasoning-summary">
                              <div className="flex items-center gap-1.5">
                                <BrainCircuit className="size-3.5" />
                                <span>{loading && !item.content ? "Thinking live..." : "Thinking Process"}</span>
                              </div>
                              <button
                                type="button"
                                className="reasoning-side-btn"
                                title="Open in Right Sidebar"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setSelectedReasoning(item.reasoning || null)
                                  setThinkingSidebarOpen(true)
                                }}
                              >
                                <PanelRightOpen className="size-3" />
                                <span>Side View</span>
                              </button>
                            </summary>
                            <div className="reasoning-content">
                              <Markdown text={item.reasoning} />
                            </div>
                          </details>
                        ) : null}
                        {item.content ? (
                          item.role === "assistant" ? (
                            <Markdown text={item.content} />
                          ) : (
                            item.content
                          )
                        ) : (
                          <span className="typing" aria-label={t("ui.generating")}>
                            <i />
                            <i />
                            <i />
                          </span>
                        )}
                      </div>
                      {item.role === "assistant" && item.content && (
                        <div className="message-actions">
                          <button
                            className="icon-action"
                            aria-label={t("ui.copy")}
                            title={t("ui.copy")}
                            onClick={() => void copyMessage(item)}
                          >
                            <Copy />
                          </button>
                          {copied === item.id && <span role="status">{t("ui.copied")}</span>}
                          {index === messages.length - 1 && !loading && (
                            <button
                              className="icon-action"
                              aria-label={t("ui.regenerate")}
                              title={t("ui.regenerate")}
                              onClick={() => {
                                const retry = resendFrom(messages, index)
                                if (retry) void send(retry.text, retry.previous, retry.pictures, false)
                              }}
                            >
                              <RefreshCw />
                            </button>
                          )}
                          {index === messages.length - 1 &&
                            !loading &&
                            supportsContinuation(health) &&
                            continuable(item) && (
                              <button
                                className="icon-action"
                                aria-label={t("ui.continue")}
                                title={t("ui.continue")}
                                onClick={() => void continueTurn()}
                              >
                                <StepForward />
                              </button>
                            )}
                        </div>
                      )}
                    </article>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </div>
            )}
            <div className="composer-wrap">
              {error && (
                <div className="error-banner" role="alert">
                  {t(error)}
                </div>
              )}
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault()
                  void send()
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("Files")) e.preventDefault()
                }}
                onDrop={(e) => {
                  if (e.dataTransfer.files.length) {
                    e.preventDefault()
                    void attach(e.dataTransfer.files)
                  }
                }}
              >
                {pending.length > 0 && (
                  <div className="composer-attachments">
                    {pending.map((url, at) => (
                      <span key={at} className="attachment">
                        <img src={url} alt={t("ui.attachedImage", { n: at + 1 })} />
                        <button
                          type="button"
                          aria-label={t("ui.removeImage")}
                          title={t("ui.removeImage")}
                          onClick={() => setPending((list) => list.filter((_, index) => index !== at))}
                        >
                          <X />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Textarea
                  ref={draftRef}
                  id="draft"
                  aria-label={t("chat.placeholder")}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t("chat.placeholder")}
                  onPaste={(event) => {
                    const files = Array.from(event.clipboardData.files || [])
                    if (files.length) {
                      event.preventDefault()
                      void attach(files)
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                />
                <div className="composer-foot">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      void attach(e.target.files)
                      e.target.value = ""
                    }}
                  />
                  <button
                    type="button"
                    className="attach-chip"
                    aria-label={t("ui.attachImage")}
                    title={t("ui.attachImage")}
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus />
                  </button>
                  <button
                    type="button"
                    className="reasoning-chip"
                    aria-pressed={thinking}
                    onClick={() => setThinking((value) => !value)}
                  >
                    <BrainCircuit />
                    {t("sidebar.reasoning")}
                  </button>
                  <button type="button" className="slot-chip" onClick={() => openSettings("model")}>
                    <Database />
                    {t("topbar.slot", { n: cacheSlot + 1 })}
                  </button>
                  {loading ? (
                    <button
                      type="button"
                      className="send-button"
                      aria-label={t("chat.stop")}
                      onClick={() => abortRef.current?.abort()}
                    >
                      <CircleStop />
                    </button>
                  ) : (
                    <button type="submit" className="send-button" aria-label={t("chat.send")} disabled={!canSend}>
                      <ArrowUp />
                    </button>
                  )}
                </div>
              </form>
              {empty && (
                <div className="suggestions">
                  {[
                    { key: "routing", Icon: BrainCircuit, label: "idea" },
                    { key: "benchmark", Icon: Code2, label: "code" },
                    { key: "caching", Icon: Database, label: "analyze" },
                  ].map(({ key, Icon, label }) => (
                    <button
                      key={key}
                      onClick={() => {
                        setDraft(t(`prompts.${key}`))
                        draftRef.current?.focus()
                      }}
                    >
                      <Icon />
                      {t(`ui.${label}`)}
                    </button>
                  ))}
                </div>
              )}
              {!empty && lastRun?.finishReason === "length" && (
                <p className="truncation-note">{t("topbar.truncatedHelp")}</p>
              )}
            </div>
          </section>
        )}

        <section className="brio-workspace" hidden={view !== "brio"}>
          <header className="page-heading">
            <span>NEXDUNE / BRIO</span>
            <h1>{t("nav.brio")}</h1>
          </header>
          <Brio baseUrl={baseUrl} apiKey={apiKey} model={model} connected={connected} />
        </section>
      </main>

      {/* ── Collapsible Right Sidebar for Thinking / Reasoning ── */}
      {thinkingSidebarOpen && (
        <aside className="thinking-sidebar" aria-label="Thinking Process Panel">
          <header className="thinking-sidebar-header">
            <div className="thinking-sidebar-title">
              <BrainCircuit className="size-4 text-[#5fd7d7]" />
              <span>Thinking Process</span>
            </div>
            <button
              className="icon-action"
              aria-label="Close thinking sidebar"
              title="Close thinking sidebar"
              onClick={() => setThinkingSidebarOpen(false)}
            >
              <PanelRightClose className="size-4" />
            </button>
          </header>
          <div className="thinking-sidebar-body">
            {activeReasoning ? (
              <Markdown text={activeReasoning} />
            ) : (
              <div className="thinking-empty">
                <BrainCircuit className="size-8 opacity-30 mx-auto mb-2" />
                <p>No thinking content for this turn. Enable Reasoning in Controls to inspect thoughts live.</p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ── Bottom Floating Menu (NavigationDock preserved as requested!) ── */}
      <NavigationDock view={view} onNavigate={setView} loading={loading} />

      {/* ── History Modal ── */}
      <dialog
        ref={historyDialog}
        className="history-dialog"
        onCancel={() => setHistoryOpen(false)}
        onClose={() => setHistoryOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const r = e.currentTarget.getBoundingClientRect()
            if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
              setHistoryOpen(false)
          }
        }}
      >
        <header>
          <h2>{t("ui.history")}</h2>
          <button className="icon-action" aria-label={t("ui.close")} onClick={() => setHistoryOpen(false)}>
            <X />
          </button>
        </header>
        <label className="history-search">
          <Search />
          <input
            aria-label={t("ui.search")}
            placeholder={t("ui.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="history-results">
          {Object.entries(conversations)
            .filter(
              ([slot, items]) =>
                Number(slot) < kvSlots &&
                items.some((m) => m.content.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
            )
            .map(([slot, items]) => (
              <button
                key={slot}
                disabled={loading}
                onClick={() => {
                  setCacheSlot(Number(slot))
                  setView("chat")
                  setHistoryOpen(false)
                  setDraft("")
                  setError("")
                }}
              >
                <MessageSquareText />
                <span>
                  {items.find((m) => m.role === "user")?.content.slice(0, 85)}
                  <small>{t("topbar.slot", { n: Number(slot) + 1 })}</small>
                </span>
              </button>
            ))}
          {archives
            .filter((entry) =>
              entry.messages.some((m) => m.content.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
            )
            .map((entry) => (
              <button key={entry.id} disabled={loading} onClick={() => restoreArchive(entry)}>
                <History />
                <span>
                  {entry.messages.find((m) => m.role === "user")?.content.slice(0, 85)}
                  <small>{t("ui.archived")}</small>
                </span>
              </button>
            ))}
          <p>{t("ui.historyMemory")}</p>
        </div>
      </dialog>
    </div>
  )
}
