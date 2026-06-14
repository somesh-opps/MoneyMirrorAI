import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Bot, X, Send, Minimize2, Sparkles, RotateCcw, Mic, Square } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: Date;
}

/** Gemini "contents" format sent to the backend */
interface GeminiTurn {
  role: "user" | "model";
  parts: { text: string }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8005";

const SUGGESTIONS = [
  "How do I improve my financial health score?",
  "What is subscription creep and how can I fix it?",
  "Explain my Financial Twin projections",
  "How much should I save each month?",
  "What are common financial scams in India?",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2);
}

/** Very lightweight markdown-to-JSX: bold, bullets, line breaks */
function formatText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // bullet
    if (/^[•\-\*]\s/.test(line)) {
      const content = line.replace(/^[•\-\*]\s/, "");
      return (
        <li key={i} className="mm-chat-li">
          {inlineBold(content)}
        </li>
      );
    }
    // heading-like (ends with colon)
    if (/^\*\*.*\*\*$/.test(line.trim())) {
      return (
        <p key={i} className="mm-chat-bold">
          {line.replace(/\*\*/g, "")}
        </p>
      );
    }
    if (line.trim() === "") return <br key={i} />;
    return <p key={i}>{inlineBold(line)}</p>;
  });
}

function inlineBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AIChatbot() {
  const [open, setOpen]         = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [pulsing, setPulsing]   = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ── Voice Input (faster-whisper) ───────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        const ext = actualMimeType.includes("mp4") ? "mp4" : "webm";
        const formData = new FormData();
        formData.append("audio", audioBlob, `voice.${ext}`);

        setLoading(true);
        try {
          const res = await fetch(`${API_BASE}/api/chat/voice`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.success && data.text) {
            setInput((prev) => (prev + " " + data.text).trim());
            setTimeout(() => inputRef.current?.focus(), 100);
          } else {
            setError(data.message || "Could not transcribe audio.");
          }
        } catch (e) {
          setError("Failed to reach transcription server.");
        } finally {
          setLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError("");
    } catch (e) {
      setError("Microphone access denied or unavailable.");
    }
  };

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open, minimized]);

  // Pulse the button every 30s to attract attention
  useEffect(() => {
    if (open) return;
    const id = setInterval(() => {
      setPulsing(true);
      setTimeout(() => setPulsing(false), 1800);
    }, 30_000);
    return () => clearInterval(id);
  }, [open]);

  // ── Send message ───────────────────────────────────────────────────────────
  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    setError("");

    const userMsg: Message = { id: uid(), role: "user", text: msg, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Build Gemini history from current messages (excluding the new one)
    const history: GeminiTurn[] = messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    }));

    try {
      const res = await fetch(`${API_BASE}/api/chat/ai`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message ?? "Something went wrong. Please try again.");
      } else {
        const botMsg: Message = {
          id:   uid(),
          role: "assistant",
          text: data.reply,
          ts:   new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } catch {
      setError("Could not reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating Button ──────────────────────────────────────────────── */}
      <button
        id="mm-chatbot-toggle"
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
        onClick={() => { setOpen((v) => !v); setMinimized(false); }}
        className={`mm-fab ${pulsing ? "mm-fab-pulse" : ""} ${open ? "mm-fab-active" : ""}`}
      >
        {open ? (
          <X className="mm-fab-icon" />
        ) : (
          <>
            <Bot className="mm-fab-icon" />
            <span className="mm-fab-badge">AI</span>
          </>
        )}
      </button>

      {/* ── Chat Window ──────────────────────────────────────────────────── */}
      {open && (
        <div className={`mm-chat-window ${minimized ? "mm-chat-minimized" : ""}`} role="dialog" aria-label="MoneyMirror AI Assistant">

          {/* Header */}
          <div className="mm-chat-header">
            <div className="mm-chat-header-left">
              <div className="mm-chat-avatar">
                <Sparkles className="mm-chat-avatar-icon" />
              </div>
              <div>
                <p className="mm-chat-title">MoneyMirror AI</p>
                <p className="mm-chat-subtitle">Your personal finance advisor</p>
              </div>
            </div>
            <div className="mm-chat-header-actions">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="Clear chat"
                  className="mm-chat-action-btn"
                  aria-label="Clear conversation"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                onClick={() => setMinimized((v) => !v)}
                title={minimized ? "Expand" : "Minimize"}
                className="mm-chat-action-btn"
                aria-label={minimized ? "Expand chat" : "Minimize chat"}
              >
                <Minimize2 size={14} />
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close"
                className="mm-chat-action-btn mm-chat-close-btn"
                aria-label="Close chat"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body */}
          {!minimized && (
            <>
              <div className="mm-chat-body">
                {messages.length === 0 ? (
                  <div className="mm-chat-empty">
                    <div className="mm-chat-empty-icon">
                      <Bot size={28} />
                    </div>
                    <p className="mm-chat-empty-title">How can I help you today?</p>
                    <p className="mm-chat-empty-sub">Ask me anything about your finances</p>
                    <div className="mm-chat-suggestions">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="mm-chat-suggestion"
                          disabled={loading}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`mm-chat-msg-row ${m.role === "user" ? "mm-msg-user" : "mm-msg-bot"}`}
                      >
                        {m.role === "assistant" && (
                          <div className="mm-chat-bot-avatar">
                            <Bot size={13} />
                          </div>
                        )}
                        <div className={`mm-chat-bubble ${m.role === "user" ? "mm-bubble-user" : "mm-bubble-bot"}`}>
                          {m.role === "assistant" ? (
                            <ul className="mm-chat-content">{formatText(m.text)}</ul>
                          ) : (
                            <p>{m.text}</p>
                          )}
                          <span className="mm-chat-ts">
                            {m.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* Typing indicator */}
                    {loading && (
                      <div className="mm-chat-msg-row mm-msg-bot">
                        <div className="mm-chat-bot-avatar">
                          <Bot size={13} />
                        </div>
                        <div className="mm-chat-bubble mm-bubble-bot mm-bubble-typing">
                          <span /><span /><span />
                        </div>
                      </div>
                    )}

                    {error && (
                      <div className="mm-chat-error">⚠ {error}</div>
                    )}
                  </>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="mm-chat-footer">
                <textarea
                  ref={inputRef}
                  id="mm-chatbot-input"
                  className="mm-chat-input"
                  rows={1}
                  placeholder="Ask about your finances…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading || isRecording}
                  aria-label="Type your message"
                />
                
                {/* Voice Input Button */}
                <button
                  className={`mm-chat-voice-btn ${isRecording ? "mm-chat-voice-active" : ""}`}
                  onClick={toggleRecording}
                  disabled={loading && !isRecording}
                  aria-label={isRecording ? "Stop recording" : "Start voice input"}
                  title="Voice input"
                >
                  {isRecording ? <Square size={14} className="mm-voice-pulse" fill="currentColor" /> : <Mic size={15} />}
                </button>

                {/* Send Button */}
                <button
                  id="mm-chatbot-send"
                  className={`mm-chat-send ${input.trim() && !loading && !isRecording ? "mm-chat-send-active" : ""}`}
                  onClick={() => send()}
                  disabled={!input.trim() || loading || isRecording}
                  aria-label="Send message"
                >
                  <Send size={15} />
                </button>
              </div>
              <p className="mm-chat-disclaimer">
                AI advice is educational only — not professional financial advice.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Styles ───────────────────────────────────────────────────────────── */}
      <style>{`
        /* ── FAB ── */
        .mm-fab {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 9999;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%);
          box-shadow: 0 8px 32px rgba(99,102,241,0.45), 0 2px 8px rgba(0,0,0,0.18);
          transition: transform 0.22s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;
          outline: none;
        }
        .mm-fab:hover { transform: scale(1.1); box-shadow: 0 12px 40px rgba(99,102,241,0.6), 0 4px 12px rgba(0,0,0,0.2); }
        .mm-fab:active { transform: scale(0.95); }
        .mm-fab-active { background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); }
        .mm-fab-icon { width: 24px; height: 24px; color: #fff; }
        .mm-fab-badge {
          position: absolute;
          top: -4px; right: -4px;
          background: #f97316;
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 5px;
          border-radius: 999px;
          letter-spacing: 0.05em;
          border: 2px solid #fff;
        }
        @keyframes mm-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.7), 0 8px 32px rgba(99,102,241,0.45); }
          70% { box-shadow: 0 0 0 18px rgba(99,102,241,0), 0 8px 32px rgba(99,102,241,0.45); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0), 0 8px 32px rgba(99,102,241,0.45); }
        }
        .mm-fab-pulse { animation: mm-pulse-ring 1.8s cubic-bezier(0.215,0.61,0.355,1) 2; }

        /* ── Window ── */
        .mm-chat-window {
          position: fixed;
          bottom: 100px;
          right: 28px;
          z-index: 9998;
          width: 380px;
          max-height: 600px;
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: rgba(15,15,30,0.92);
          backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15);
          animation: mm-window-in 0.28s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes mm-window-in {
          from { opacity: 0; transform: translateY(24px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .mm-chat-minimized { max-height: 60px; }
        @media (max-width: 440px) {
          .mm-chat-window { width: calc(100vw - 32px); right: 16px; bottom: 88px; }
          .mm-fab { bottom: 20px; right: 16px; }
        }

        /* ── Header ── */
        .mm-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(99,102,241,0.3) 0%, rgba(139,92,246,0.2) 100%);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
        }
        .mm-chat-header-left { display: flex; align-items: center; gap: 10px; }
        .mm-chat-avatar {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(99,102,241,0.4);
          flex-shrink: 0;
        }
        .mm-chat-avatar-icon { width: 18px; height: 18px; color: #fff; }
        .mm-chat-title { color: #f1f5f9; font-size: 14px; font-weight: 700; margin: 0; line-height: 1.2; }
        .mm-chat-subtitle { color: rgba(255,255,255,0.5); font-size: 11px; margin: 0; }
        .mm-chat-header-actions { display: flex; gap: 4px; }
        .mm-chat-action-btn {
          width: 28px; height: 28px;
          border-radius: 8px; border: none;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .mm-chat-action-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .mm-chat-close-btn:hover { background: rgba(239,68,68,0.2); color: #ef4444; }

        /* ── Body ── */
        .mm-chat-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          scroll-behavior: smooth;
        }
        .mm-chat-body::-webkit-scrollbar { width: 4px; }
        .mm-chat-body::-webkit-scrollbar-track { background: transparent; }
        .mm-chat-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }

        /* ── Empty state ── */
        .mm-chat-empty { text-align: center; padding: 8px 0 4px; }
        .mm-chat-empty-icon {
          width: 56px; height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2));
          border: 1px solid rgba(99,102,241,0.3);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 12px;
          color: #818cf8;
        }
        .mm-chat-empty-title { color: #f1f5f9; font-size: 15px; font-weight: 700; margin: 0 0 4px; }
        .mm-chat-empty-sub { color: rgba(255,255,255,0.45); font-size: 12px; margin: 0 0 16px; }
        .mm-chat-suggestions { display: flex; flex-direction: column; gap: 6px; }
        .mm-chat-suggestion {
          text-align: left;
          padding: 9px 13px;
          border-radius: 10px;
          border: 1px solid rgba(99,102,241,0.25);
          background: rgba(99,102,241,0.08);
          color: rgba(255,255,255,0.75);
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          line-height: 1.4;
        }
        .mm-chat-suggestion:hover:not(:disabled) {
          background: rgba(99,102,241,0.18);
          border-color: rgba(99,102,241,0.5);
          color: #fff;
        }

        /* ── Messages ── */
        .mm-chat-msg-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          animation: mm-msg-in 0.2s ease;
        }
        @keyframes mm-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mm-msg-user { flex-direction: row-reverse; }
        .mm-msg-bot  { flex-direction: row; }
        .mm-chat-bot-avatar {
          width: 26px; height: 26px;
          border-radius: 8px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          color: #fff;
          flex-shrink: 0;
          margin-bottom: 2px;
        }
        .mm-chat-bubble {
          max-width: 82%;
          padding: 10px 13px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.5;
          position: relative;
        }
        .mm-bubble-user {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .mm-bubble-bot {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.09);
          color: #e2e8f0;
          border-bottom-left-radius: 4px;
        }
        .mm-chat-content { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
        .mm-chat-li { display: flex; gap: 6px; }
        .mm-chat-li::before { content: "•"; color: #818cf8; flex-shrink: 0; }
        .mm-chat-bold { font-weight: 700; color: #c7d2fe; margin: 2px 0; }
        .mm-chat-content p { margin: 2px 0; }
        .mm-chat-ts { display: block; font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 5px; text-align: right; }

        /* ── Typing ── */
        .mm-bubble-typing {
          display: flex; align-items: center; gap: 5px;
          padding: 12px 16px;
        }
        .mm-bubble-typing span {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.4);
          animation: mm-bounce 1.2s infinite;
        }
        .mm-bubble-typing span:nth-child(2) { animation-delay: 0.2s; }
        .mm-bubble-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes mm-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }

        /* ── Error ── */
        .mm-chat-error {
          font-size: 12px;
          color: #fca5a5;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 10px;
          padding: 8px 12px;
        }

        /* ── Footer ── */
        .mm-chat-footer {
          padding: 10px 12px 6px;
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          gap: 8px;
          align-items: flex-end;
          flex-shrink: 0;
        }
        .mm-chat-input {
          flex: 1;
          resize: none;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          color: #f1f5f9;
          font-size: 13px;
          padding: 9px 12px;
          outline: none;
          max-height: 100px;
          overflow-y: auto;
          transition: border-color 0.15s;
          font-family: inherit;
          line-height: 1.5;
        }
        .mm-chat-input::placeholder { color: rgba(255,255,255,0.3); }
        .mm-chat-input:focus { border-color: rgba(99,102,241,0.6); }
        .mm-chat-send {
          width: 36px; height: 36px;
          border-radius: 10px;
          border: none;
          background: rgba(99,102,241,0.2);
          color: rgba(255,255,255,0.35);
          cursor: not-allowed;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s, transform 0.15s;
          flex-shrink: 0;
        }
        .mm-chat-send-active {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(99,102,241,0.4);
        }
        .mm-chat-send-active:hover { transform: scale(1.06); }
        .mm-chat-send-active:active { transform: scale(0.95); }

        /* ── Voice ── */
        .mm-chat-voice-btn {
          width: 36px; height: 36px;
          border-radius: 10px;
          border: none;
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .mm-chat-voice-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }
        .mm-chat-voice-btn:disabled { cursor: not-allowed; opacity: 0.5; }
        .mm-chat-voice-active {
          background: rgba(239,68,68,0.2) !important;
          color: #ef4444 !important;
        }
        .mm-voice-pulse { animation: mm-pulse-op 1.2s infinite alternate; }
        @keyframes mm-pulse-op {
          from { opacity: 1; }
          to { opacity: 0.4; }
        }

        /* ── Disclaimer ── */
        .mm-chat-disclaimer {
          text-align: center;
          font-size: 10px;
          color: rgba(255,255,255,0.22);
          padding: 0 12px 10px;
          margin: 0;
          flex-shrink: 0;
        }
      `}</style>
    </>
  );
}
