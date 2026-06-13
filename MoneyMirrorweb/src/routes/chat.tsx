import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Bot, Send, Sparkles, Mic, Square, MessageSquare, Plus, Trash2, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAuthStore } from '@/lib/authStore';

export const Route = createFileRoute('/chat')({
  component: ChatScreen,
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: Date;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: Date;
  messages: Message[];
}

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
    if (/^[•\-\*]\s/.test(line)) {
      const content = line.replace(/^[•\-\*]\s/, "");
      return (
        <li key={i} className="flex gap-2">
          <span className="text-primary">•</span>
          <span>{inlineBold(content)}</span>
        </li>
      );
    }
    if (/^\*\*.*\*\*$/.test(line.trim())) {
      return (
        <p key={i} className="font-bold text-foreground my-1">
          {line.replace(/\*\*/g, "")}
        </p>
      );
    }
    if (line.trim() === "") return <br key={i} />;
    return <p key={i} className="my-1">{inlineBold(line)}</p>;
  });
}

function inlineBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
function ChatScreen() {
  const user = useAuthStore((s) => s.user);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Chat Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("mm_chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((s: any) => ({
          ...s,
          updatedAt: new Date(s.updatedAt),
          messages: s.messages.map((m: any) => ({ ...m, ts: new Date(m.ts) }))
        }));
      } catch (e) {
        return [];
      }
    }
    return [{ id: uid(), title: "New Conversation", updatedAt: new Date(), messages: [] }];
  });
  
  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0]?.id || "");

  // Current Session state variables
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Persist sessions
  useEffect(() => {
    localStorage.setItem("mm_chat_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // Derived active session
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const createNewSession = () => {
    const newSession: ChatSession = { id: uid(), title: "New Conversation", updatedAt: new Date(), messages: [] };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    if (newSessions.length === 0) {
      const newSession: ChatSession = { id: uid(), title: "New Conversation", updatedAt: new Date(), messages: [] };
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
    } else {
      setSessions(newSessions);
      if (activeSessionId === id) {
        setActiveSessionId(newSessions[0].id);
      }
    }
  };

  const updateSession = (updater: (session: ChatSession) => ChatSession) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? updater(s) : s));
  };

  // ── Voice Input (faster-whisper) ───────────────────────────────────────────
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("audio", audioBlob, "voice.webm");

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

  // ── Send message ───────────────────────────────────────────────────────────
  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    setError("");

    const userMsg: Message = { id: uid(), role: "user", text: msg, ts: new Date() };
    
    // Update session with new message and title if it's the first message
    updateSession(s => ({
      ...s,
      title: s.messages.length === 0 ? msg.slice(0, 30) + (msg.length > 30 ? "..." : "") : s.title,
      updatedAt: new Date(),
      messages: [...s.messages, userMsg]
    }));
    
    setLoading(true);

    // Build Gemini history from current messages
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
        updateSession(s => ({
          ...s,
          updatedAt: new Date(),
          messages: [...s.messages, botMsg]
        }));
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

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* ── Sidebar (History) ── */}
      {sidebarOpen && (
        <div className="w-80 border-r border-border bg-card/50 flex flex-col hidden md:flex shrink-0">
          <div className="p-4 border-b border-border flex gap-2">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2.5 text-muted-foreground hover:bg-muted rounded-xl transition-colors shrink-0"
              title="Close sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
            <button
              onClick={createNewSession}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Plus size={16} /> New Chat
            </button>
          </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map(session => (
            <div
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                activeSessionId === session.id 
                  ? "bg-primary/10 border border-primary/20" 
                  : "hover:bg-muted border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare size={16} className={activeSessionId === session.id ? "text-primary" : "text-muted-foreground"} />
                <div className="truncate">
                  <p className={`text-sm font-medium truncate ${activeSessionId === session.id ? "text-foreground" : "text-muted-foreground"}`}>
                    {session.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {session.updatedAt.toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button 
                onClick={(e) => deleteSession(session.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all"
                aria-label="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors bg-background/50 backdrop-blur-sm border border-border"
            title="Open sidebar"
          >
            <PanelLeftOpen size={20} />
          </button>
        )}


        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-lg mx-auto">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                <Sparkles size={40} />
              </div>
              <h3 className="font-display text-2xl font-bold">How can I help you today?</h3>
              <p className="text-muted-foreground">Ask me anything about your finances, subscriptions, or upload transactions for analysis.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-8">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={loading}
                    className="p-4 rounded-xl border border-border bg-card text-left text-sm text-muted-foreground hover:bg-primary/5 hover:border-primary/30 hover:text-foreground transition-all disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="h-8 w-8 rounded-lg bg-gradient-hero flex items-center justify-center text-white shrink-0 mt-1">
                      <Bot size={16} />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 ${
                    m.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-tr-sm" 
                      : "bg-muted text-foreground rounded-tl-sm border border-border"
                  }`}>
                    {m.role === "assistant" ? (
                      <div className="flex flex-col space-y-2 text-sm leading-relaxed">
                        {formatText(m.text)}
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{m.text}</p>
                    )}
                    <div className={`text-[10px] mt-2 text-right ${m.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {m.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  
                  {m.role === "user" && user && (
                    <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-1 overflow-hidden">
                      {user.profile_image ? (
                        <img src={user.profile_image} className="h-full w-full object-cover" alt="" />
                      ) : (
                        <span className="text-xs font-bold text-primary">{user.name?.[0]?.toUpperCase() ?? "U"}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-4 justify-start">
                  <div className="h-8 w-8 rounded-lg bg-gradient-hero flex items-center justify-center text-white shrink-0 mt-1">
                    <Bot size={16} />
                  </div>
                  <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm border border-border p-4 flex items-center gap-1.5 h-[52px]">
                    <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mx-auto bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-lg flex justify-center">
                  ⚠ {error}
                </div>
              )}
              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background border-t border-border">
          <div className="max-w-3xl mx-auto relative flex items-end gap-2">
            <div className="relative flex-1 bg-muted rounded-2xl border border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
              <textarea
                ref={inputRef}
                rows={1}
                className="w-full max-h-32 bg-transparent resize-none p-4 pr-12 text-sm outline-none text-foreground placeholder:text-muted-foreground"
                placeholder="Ask about your finances..."
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                }}
                onKeyDown={handleKeyDown}
                disabled={loading || isRecording}
              />
              <button
                onClick={toggleRecording}
                disabled={loading && !isRecording}
                className={`absolute right-3 bottom-3 p-1.5 rounded-lg transition-colors ${
                  isRecording 
                    ? "bg-destructive/20 text-destructive animate-pulse" 
                    : "text-muted-foreground hover:bg-background hover:text-foreground"
                }`}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                {isRecording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
              </button>
            </div>
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || isRecording}
              className={`h-12 w-12 flex-shrink-0 rounded-2xl flex items-center justify-center transition-all ${
                input.trim() && !loading && !isRecording
                  ? "bg-primary text-primary-foreground hover:opacity-90 shadow-lg hover:scale-105"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              <Send size={18} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
