import { FormEvent, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../../api/client";

type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  timestamp: string;
};

const SUBJECTS = ["Math", "Science", "History", "English", "General"];
const QUICK_PROMPTS = [
  "Explain this concept in simple terms",
  "Break this into smaller steps",
  "Give me an example",
  "What are the key points?",
  "How does this relate to real life?",
  "Can you quiz me on this?",
];

function now(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function makeId(): string {
  return Math.random().toString(36).slice(2);
}

export function AIStudyAssistantPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";

  const [subject, setSubject] = useState("General");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "ai",
      text: "Hi! I'm your AI study assistant. I'm here to help you understand concepts, answer questions, and support your learning journey. What would you like to learn about today?",
      timestamp: now(),
    },
  ]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Message = { id: makeId(), role: "user", text: text.trim(), timestamp: now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const res = await apiClient.post<{ explanation: string }>(
        "/ai/explain",
        { text: text.trim(), subject },
        { headers: { "x-lang": locale } },
      );
      const aiMsg: Message = {
        id: makeId(),
        role: "ai",
        text: res.data.explanation,
        timestamp: now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "ai",
          text: "Sorry, I couldn't process your request right now. Please try again.",
          timestamp: now(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <main className="page dashboard-page ai-page">
      <header className="portal-topbar">
        <button type="button" className="topbar-back" onClick={() => navigate(-1)} aria-label="Back">
          ‹
        </button>
        <div className="topbar-title-group">
          <span className="topbar-icon ai-icon">✦</span>
          <div>
            <h1 className="topbar-title">{t("ai.title", { defaultValue: "AI Study Assistant" })}</h1>
            <p className="topbar-subtitle">{t("ai.subtitle", { defaultValue: "Get help understanding any topic" })}</p>
          </div>
        </div>
      </header>

      <div className="ai-subject-row">
        <span className="ai-subject-label">{t("ai.selectSubject", { defaultValue: "Select Subject" })}</span>
        <div className="ai-subject-tabs">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              className={`ai-subject-btn${subject === s ? " active" : ""}`}
              onClick={() => setSubject(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-chat-window">
        {messages.map((msg) => (
          <div key={msg.id} className={`ai-bubble-wrap ${msg.role}`}>
            {msg.role === "ai" && (
              <div className="ai-avatar">
                <span>✦</span>
              </div>
            )}
            <div className="ai-bubble">
              <p className="ai-bubble-text">{msg.text}</p>
              <p className="ai-bubble-time">{msg.timestamp}</p>
            </div>
          </div>
        ))}
        {busy && (
          <div className="ai-bubble-wrap ai">
            <div className="ai-avatar"><span>✦</span></div>
            <div className="ai-bubble ai-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="ai-quick-prompts-row">
        <span className="ai-quick-label">💡 {t("ai.quickPrompts", { defaultValue: "Quick Prompts" })}</span>
        <div className="ai-quick-scroll">
          {QUICK_PROMPTS.map((p) => (
            <button key={p} type="button" className="ai-quick-btn" onClick={() => void send(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <form className="ai-input-row" onSubmit={onSubmit}>
        <textarea
          className="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("ai.inputPlaceholder", { defaultValue: "Ask me anything about your studies..." })}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <button type="submit" className="ai-send-btn" disabled={!input.trim() || busy} aria-label="Send">
          ➤
        </button>
      </form>
      <p className="ai-tip">📖 {t("ai.tip", { defaultValue: "Tip: Press Enter to send, Shift + Enter for new line" })}</p>
    </main>
  );
}
