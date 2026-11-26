"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import StressGauge from "@/components/StressGauge";
import Markdown from "@/components/Markdown";
import {
  apiConversation, apiConversations, apiDeleteConversation, apiEscalate, apiFeedback, errorMessage, streamChat,
} from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useLang } from "@/lib/i18n";
import { ACTION_ICONS, CATEGORY_META } from "@/lib/constants";
import type { AnalysisSummary, ChatMessage, ConversationSummary } from "@/types";

const STARTERS = {
  en: [
    "I took a kandhu vatti loan and the daily interest is crushing me",
    "A loan app is threatening to send messages to my contacts",
    "My gold loan is overdue and I got an auction notice",
    "I pay 10% per week to a moneylender — is that legal?",
    "Help me make a budget — salary ₹25,000, EMIs ₹11,000",
    "Which government schemes can help a woman-led household?",
  ],
  ta: [
    "கந்து வட்டிக்கு கடன் வாங்கினேன், தினசரி வட்டி கட்ட முடியவில்லை",
    "கடன் செயலி என் தொடர்புகளுக்கு மிரட்டல் அனுப்புகிறது",
    "நகைக் கடன் தவணை தாண்டி ஏல நோட்டீஸ் வந்தது",
    "seettu eduthutten, ippo monthly katta mudiyala",
    "மகளிர் குடும்பத்திற்கு உதவும் அரசு திட்டங்கள் எவை?",
    "மாத வருமானம் ₹20,000 — பட்ஜெட் போட உதவுங்கள்",
  ],
};

type UIMsg = ChatMessage & { streaming?: boolean; error?: boolean };

// Minimal Web Speech API typing
type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export default function ChatPage() {
  const { user, ready } = useAuth(true);
  const { lang, t } = useLang();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [engine, setEngine] = useState<string>("");
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMsg[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState("");
  const [rated, setRated] = useState<Record<string, 1 | -1>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [escalated, setEscalated] = useState<string | null>(null);
  const [showSide, setShowSide] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [listening, setListening] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SR | null>(null);
  const stickRef = useRef(true);
  const seqRef = useRef(0);

  const refreshList = useCallback(async () => {
    try {
      const d = await apiConversations();
      setConversations(d.conversations);
      setEngine(d.engine);
      return d.conversations;
    } catch { return []; }
  }, []);

  const openConversation = useCallback(async (id: string) => {
    abortRef.current?.abort();
    setLoadingConv(true); setError(""); setShowSide(false);
    try {
      const d = await apiConversation(id);
      setConvId(id);
      setMessages(d.messages);
      const lastAi = [...d.messages].reverse().find((m) => m.role === "assistant");
      setSuggestions(lastAi?.meta?.suggestions ?? []);
      const lastUser = [...d.messages].reverse().find((m) => m.role === "user" && m.meta?.analysis);
      setAnalysis(lastUser?.meta?.analysis ?? null);
      try { localStorage.setItem("vazhi_last_conv", id); } catch {}
    } catch (e) {
      setError(errorMessage(e, "Couldn't open that conversation."));
    } finally { setLoadingConv(false); }
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    const id = setTimeout(() => refreshList().then((list) => {
      let last: string | null = null;
      try { last = localStorage.getItem("vazhi_last_conv"); } catch {}
      if (last && list.some((c) => c.id === last)) openConversation(last);
    }), 0);
    return () => clearTimeout(id);
  }, [ready, user, refreshList, openConversation]);

  // Auto-scroll only if the user is already near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const autoSize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  const newChat = () => {
    abortRef.current?.abort();
    setConvId(null); setMessages([]); setAnalysis(null); setSuggestions([]); setError(""); setShowSide(false);
    try { localStorage.removeItem("vazhi_last_conv"); } catch {}
    taRef.current?.focus();
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput(""); setError(""); setSuggestions([]);
    requestAnimationFrame(autoSize);
    stickRef.current = true;
    const n = ++seqRef.current;
    const tempUser: UIMsg = { id: `u-${n}`, role: "user", content: text };
    const tempAi: UIMsg = { id: `a-${n}`, role: "assistant", content: "", streaming: true };
    setMessages((m) => [...m, tempUser, tempAi]);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      await streamChat({ message: text, conversation_id: convId }, {
        onMeta: (d) => {
          setConvId(d.conversation_id);
          try { localStorage.setItem("vazhi_last_conv", d.conversation_id); } catch {}
          setMessages((m) => m.map((x) => (x.id === tempUser.id ? { ...d.user_message } : x)));
          if (!convId) refreshList();
        },
        onAnalysis: (a) => {
          setAnalysis(a);
          setMessages((m) => m.map((x) => (x.role === "user" && x.content === text && !x.meta?.analysis ? { ...x, meta: { ...x.meta, analysis: a } } : x)));
        },
        onDelta: (chunk) => setMessages((m) => m.map((x) => (x.id === tempAi.id ? { ...x, content: x.content + chunk } : x))),
        onDone: (d) => {
          setMessages((m) => m.map((x) => (x.id === tempAi.id ? { ...d.message } : x)));
          setSuggestions(d.suggestions);
          setEngine(d.engine);
          refreshList();
        },
        onError: (detail) => { setError(detail); setMessages((m) => m.map((x) => (x.id === tempAi.id ? { ...x, streaming: false, error: true } : x))); },
      }, ctrl.signal);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setMessages((m) => m.map((x) => (x.id === tempAi.id ? { ...x, streaming: false, content: x.content || "_(stopped)_" } : x)));
      } else {
        setError((e as Error).message?.includes("fetch") ? "Can't reach the VazhiAPI server. Please try again." : (e as Error).message);
        setMessages((m) => m.filter((x) => x.id !== tempAi.id));
        setInput(text);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      setMessages((m) => m.map((x) => (x.streaming ? { ...x, streaming: false } : x)));
    }
  };

  const stop = () => abortRef.current?.abort();

  const rate = async (msg: UIMsg, r: 1 | -1) => {
    if (!msg.session_id) return;
    setRated((s) => ({ ...s, [msg.id]: r }));
    try { await apiFeedback({ session_id: msg.session_id, rating: r, message_id: msg.id }); } catch { /* non-blocking */ }
  };

  const copy = async (msg: UIMsg) => {
    try { await navigator.clipboard.writeText(msg.content); setCopied(msg.id); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const escalate = async () => {
    if (!user) return;
    try {
      const r = await apiEscalate(user.user_id, { reason: analysis ? `Chat escalation — ${analysis.debt_category_label}, stress ${analysis.stress_score}` : "Requested from chat", session_id: analysis?.session_id });
      setEscalated(r.message);
    } catch (e) { setError(errorMessage(e)); }
  };

  const removeConv = async (id: string) => {
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    try {
      await apiDeleteConversation(id);
      if (id === convId) newChat();
      refreshList();
    } catch (e) { setError(errorMessage(e)); }
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) { setError("Voice input isn't supported in this browser — try Chrome or Edge."); return; }
    const rec = new Ctor();
    rec.lang = lang === "ta" ? "ta-IN" : "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input + " " : "";
    rec.onresult = (e) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      setInput(base + s);
      requestAnimationFrame(autoSize);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const crisis = analysis?.crisis?.level;
  const meta = analysis ? CATEGORY_META[analysis.debt_category] : null;

  if (!ready || !user) return (<><Navbar /><div className="page-container"><div className="spinner" style={{ margin: "6rem auto" }} /></div></>);

  return (
    <>
      <Navbar />
      <div className={`backdrop ${showSide || showPanel ? "show" : ""}`} onClick={() => { setShowSide(false); setShowPanel(false); }} />
      <div className="chat-shell">
        {/* ── Conversations ── */}
        <aside className={`chat-side ${showSide ? "show" : ""}`}>
          <button className="btn-primary" onClick={newChat} style={{ width: "100%" }}>＋ {t("new_chat")}</button>
          <div className="panel-label" style={{ marginTop: "0.4rem" }}>{lang === "ta" ? "முந்தைய உரையாடல்கள்" : "Recent conversations"}</div>
          <div className="chat-list">
            {conversations.length === 0 && <div className="muted" style={{ fontSize: "0.82rem", padding: "0.5rem" }}>No conversations yet.</div>}
            {conversations.map((c) => (
              <div key={c.id} role="button" tabIndex={0} className={`conv-item ${c.id === convId ? "active" : ""}`}
                onClick={() => openConversation(c.id)} onKeyDown={(e) => e.key === "Enter" && openConversation(c.id)}>
                <span>💬</span>
                <span className="title" title={c.title}>{c.title}</span>
                <button className="conv-del" aria-label="Delete conversation" onClick={(e) => { e.stopPropagation(); removeConv(c.id); }}>🗑</button>
              </div>
            ))}
          </div>
          {user.user_id === "guest" && (
            <div className="benefit-box" style={{ marginTop: "auto", fontSize: "0.74rem", lineHeight: 1.5 }}>
              📱 {lang === "ta" ? "விருந்தினர் முறை: உரையாடல்கள் இந்தச் சாதனத்தில் மட்டும்." : "Guest mode: chats stay on this device."}{" "}
              <Link href="/register">{lang === "ta" ? "கணக்கு உருவாக்கு" : "Create an account"}</Link>
            </div>
          )}
          <div style={{ marginTop: user.user_id === "guest" ? 0 : "auto", fontSize: "0.72rem" }} className="muted">
            🔒 {lang === "ta" ? "உங்கள் உரையாடல்கள் ரகசியமானவை. சுயவிவரத்தில் எப்போது வேண்டுமானாலும் நீக்கலாம்." : "Private to you. Delete anytime from your profile."}
          </div>
        </aside>

        {/* ── Chat ── */}
        <section className="chat-main">
          <div className="chat-head">
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
              <button className="btn-ghost btn-sm mobile-toggle" onClick={() => setShowSide(true)} aria-label="Conversations">☰</button>
              <div className="bot-avatar">வ</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Vazhi Counsellor</div>
                <div style={{ fontSize: "0.72rem" }} className="muted">
                  {busy ? (lang === "ta" ? "பதிலளிக்கிறது…" : "typing…") : engine === "claude" ? "Powered by Claude · Tamil · English · Tanglish" : engine === "vazhi-browser" ? "On-device mode · Tamil · English · Tanglish" : "Tamil · English · Tanglish · Confidential"}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
              <button className="btn-ghost btn-sm mobile-toggle panel-t" onClick={() => setShowPanel(true)} disabled={!analysis}>📊</button>
              <button className="btn-danger btn-sm" onClick={escalate} title={t("talk_human")}>🧑‍⚕️ <span className="nav-desktop-only">{t("talk_human")}</span></button>
            </div>
          </div>

          <div className="chat-scroll" ref={scrollRef} onScroll={onScroll} aria-live="polite">
            {escalated && <div className="ok-box">✓ {escalated}</div>}
            {(crisis === "critical" || crisis === "severe") && (
              <div className="crisis-banner">
                <div style={{ fontWeight: 700, color: "#fecaca", marginBottom: "0.35rem" }}>
                  {crisis === "critical" ? (lang === "ta" ? "💛 நீங்கள் தனியாக இல்லை — இப்போதே பேசுங்கள்" : "💛 You're not alone — please talk to someone now")
                    : (lang === "ta" ? "⚠️ மிரட்டல் ஒரு குற்றம்" : "⚠️ Threats and harassment are crimes")}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {(crisis === "critical" ? [["Tele-MANAS", "14416"], ["Emergency", "112"], ["SNEHA", "044-24640050"]] : [["Police", "100"], ["Cyber crime", "1930"], ["Legal aid", "15100"]]).map(([n, num]) => (
                    <a key={num} href={`tel:${num}`} className="chip" style={{ borderColor: "rgba(239,68,68,0.5)", color: "#fecaca" }}>📞 {n} · <b>{num}</b></a>
                  ))}
                </div>
              </div>
            )}

            {loadingConv && <div className="spinner" style={{ margin: "3rem auto" }} />}

            {!loadingConv && messages.length === 0 && (
              <div style={{ margin: "auto", maxWidth: 640, textAlign: "center", padding: "1rem 0" }}>
                <div className="bot-avatar" style={{ width: 56, height: 56, fontSize: "1.6rem", margin: "0 auto 1rem", borderRadius: 16 }}>வ</div>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.4rem" }}>
                  {lang === "ta" ? `வணக்கம்${user.full_name ? ", " + user.full_name.split(" ")[0] : ""}!` : `Vanakkam${user.full_name ? ", " + user.full_name.split(" ")[0] : ""}!`}
                </h1>
                <p className="muted" style={{ marginBottom: "1.5rem", lineHeight: 1.7 }}>
                  {lang === "ta"
                    ? "உங்கள் பணப் பிரச்சனையை உங்கள் வார்த்தைகளில் சொல்லுங்கள். நான் கேட்பேன், உங்கள் உரிமைகளையும் உதவும் திட்டங்களையும் காட்டுவேன். வெட்கப்பட வேண்டாம்."
                    : "Tell me about your money worry in your own words. I'll listen, explain your rights, and find schemes and next steps that fit — no judgement, ever."}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
                  {STARTERS[lang].map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}

            {messages.map((m, idx) => m.role === "user" ? (
              <div key={m.id} className="msg-row user"><div className="bubble-user">{m.content}</div></div>
            ) : (
              <div key={m.id} className="msg-row">
                <div className="bot-avatar">வ</div>
                <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <div className={`bubble-ai ${m.error ? "error-box" : ""}`}>
                    {m.content ? (
                      <div className={m.streaming ? "caret" : ""}><Markdown text={m.content} /></div>
                    ) : m.streaming ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span className="typing"><span /><span /><span /></span>
                        <span className="muted" style={{ fontSize: "0.82rem" }}>{analysis && idx === messages.length - 1 ? (lang === "ta" ? "பதில் தயாராகிறது…" : "Writing a reply…") : (lang === "ta" ? "6 அடுக்கு பகுப்பாய்வு…" : "Analysing across 6 layers…")}</span>
                      </div>
                    ) : <span className="muted">—</span>}
                  </div>
                  {!m.streaming && m.content && !m.id.startsWith("a-") && (
                    <div className="msg-tools">
                      {m.meta?.category && CATEGORY_META[m.meta.category] && (
                        <span className="badge" style={{ background: `${CATEGORY_META[m.meta.category].color}22`, color: CATEGORY_META[m.meta.category].color, border: `1px solid ${CATEGORY_META[m.meta.category].color}44` }}>
                          {CATEGORY_META[m.meta.category].icon} {lang === "ta" ? CATEGORY_META[m.meta.category].label_ta : CATEGORY_META[m.meta.category].label}
                        </span>
                      )}
                      {typeof m.meta?.stress_score === "number" && <span className="badge badge-saffron">Stress {Math.round(m.meta.stress_score)}</span>}
                      <span style={{ marginLeft: "0.25rem" }}>{t("helpful")}</span>
                      <button className={`icon-btn ${rated[m.id] === 1 ? "on" : ""}`} onClick={() => rate(m, 1)} aria-label="Helpful">👍</button>
                      <button className={`icon-btn ${rated[m.id] === -1 ? "on" : ""}`} onClick={() => rate(m, -1)} aria-label="Not helpful">👎</button>
                      <button className="icon-btn" onClick={() => copy(m)} aria-label="Copy">{copied === m.id ? "✓ Copied" : "⧉ Copy"}</button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {!busy && suggestions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", paddingLeft: "2.6rem" }}>
                {suggestions.map((s) => <button key={s} className="chip" onClick={() => send(s)}>↳ {s}</button>)}
              </div>
            )}
            {error && <div className="error-box">{error}</div>}
          </div>

          <div className="chat-input-wrap">
            <div className="chat-input">
              <textarea ref={taRef} rows={1} value={input} placeholder={t("chat_placeholder")} aria-label="Message"
                onChange={(e) => { setInput(e.target.value); autoSize(); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
              <button className={`mic-btn ${listening ? "rec" : ""}`} onClick={toggleMic} aria-label="Voice input" title={lang === "ta" ? "தமிழில் பேசுங்கள்" : "Speak (Tamil or English)"}>🎙</button>
              {busy ? (
                <button className="send-btn" onClick={stop} aria-label="Stop" style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)", color: "white" }}>■</button>
              ) : (
                <button className="send-btn" onClick={() => send()} disabled={!input.trim()} aria-label="Send">➤</button>
              )}
            </div>
            <div className="muted" style={{ fontSize: "0.7rem", marginTop: "0.4rem", textAlign: "center" }}>
              Enter to send · Shift+Enter for a new line · Not legal or medical advice — free legal aid: 15100
            </div>
          </div>
        </section>

        {/* ── Live analysis ── */}
        <aside className={`chat-panel ${showPanel ? "show" : ""}`}>
          {!analysis ? (
            <div className="glass-card panel-card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
              <div style={{ fontWeight: 600, marginBottom: "0.35rem" }}>{lang === "ta" ? "நேரடி பகுப்பாய்வு" : "Live analysis"}</div>
              <div className="muted" style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
                {lang === "ta" ? "ஒவ்வொரு செய்தியும் 6 அடுக்கு AI மூலம் பகுப்பாய்வு செய்யப்படும்." : "Each message runs through the 6-layer pipeline — stress, debt type, trajectory and the best strategy appear here."}
              </div>
            </div>
          ) : (
            <>
              <div className="glass-card panel-card" style={{ textAlign: "center" }}>
                <div className="panel-label">L1 · {lang === "ta" ? "மன அழுத்தம்" : "Stress"}</div>
                <StressGauge score={analysis.stress_score} label={analysis.stress_label} size={130} />
              </div>
              <div className="glass-card panel-card">
                <div className="panel-label">L2 · {lang === "ta" ? "கடன் வகை" : "Debt type"}</div>
                <div style={{ fontWeight: 700, color: meta?.color }}>{meta?.icon} {lang === "ta" ? analysis.debt_category_label_ta : analysis.debt_category_label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.6rem" }}>
                  {Object.entries(analysis.debt_category_probabilities).slice(0, 3).map(([k, v]) => (
                    <div key={k}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem" }} className="muted">
                        <span>{CATEGORY_META[k]?.label ?? k}</span><span>{Math.round(v * 100)}%</span>
                      </div>
                      <div className="bar"><div style={{ width: `${v * 100}%`, background: CATEGORY_META[k]?.color ?? "#f59e0b" }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card panel-card">
                <div className="panel-label">L3 · {lang === "ta" ? "போக்கு" : "Trajectory"}</div>
                <div style={{ fontWeight: 700, color: analysis.crisis_trajectory === "Rising" ? "#ef4444" : analysis.crisis_trajectory === "Declining" ? "#10b981" : "#f59e0b" }}>
                  {analysis.crisis_trajectory === "Rising" ? "↗" : analysis.crisis_trajectory === "Declining" ? "↘" : "→"} {analysis.crisis_trajectory}
                </div>
                <div className="muted" style={{ fontSize: "0.78rem" }}>Predicted peak {analysis.predicted_peak_score}/100</div>
              </div>
              <div className="glass-card panel-card">
                <div className="panel-label">L5 · {lang === "ta" ? "உத்தி" : "Strategy"}</div>
                <div style={{ fontWeight: 700 }}>{ACTION_ICONS[analysis.rl_action]} {analysis.rl_action_label}</div>
                <div className="muted" style={{ fontSize: "0.78rem", marginTop: "0.3rem", lineHeight: 1.5 }}>{analysis.rl_action_description}</div>
              </div>
              {analysis.matched_schemes?.length > 0 && (
                <div className="glass-card panel-card">
                  <div className="panel-label">{lang === "ta" ? "பொருந்தும் திட்டங்கள்" : "Matched schemes"}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {analysis.matched_schemes.map((s) => (
                      <a key={s.id} href={s.application_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                        <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{lang === "ta" ? s.name_ta : s.name} ↗</div>
                        <div className="muted" style={{ fontSize: "0.72rem" }}>📞 {s.helpline}</div>
                      </a>
                    ))}
                  </div>
                  <Link href="/schemes" style={{ fontSize: "0.78rem", display: "inline-block", marginTop: "0.6rem" }}>Find more for me →</Link>
                </div>
              )}
              {analysis.helplines?.length > 0 && (
                <div className="glass-card panel-card">
                  <div className="panel-label">{lang === "ta" ? "உதவி எண்கள்" : "Helplines"}</div>
                  {analysis.helplines.map((h) => (
                    <a key={h.id} href={`tel:${h.number}`} className="sos-row" style={{ borderTop: "none", padding: "0.35rem 0" }}>
                      <span style={{ fontSize: "0.8rem" }}>{lang === "ta" ? h.name_ta : h.name}</span><span className="sos-num">{h.number}</span>
                    </a>
                  ))}
                </div>
              )}
              <div className="muted" style={{ fontSize: "0.68rem", textAlign: "center" }}>Pipeline: {analysis.processing_time_ms} ms</div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
