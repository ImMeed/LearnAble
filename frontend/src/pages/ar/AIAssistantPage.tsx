import { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles, Send } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { apiClient } from '../../api/client';

type Message = { role: 'assistant' | 'user'; text: string; time: string };

const SUBJECTS = ['Math', 'Science', 'History', 'English', 'General'];

const QUICK_PROMPTS = [
  'Explain this concept in simple terms',
  'Break this into smaller steps',
  'Give me an example',
  'What are the key points?',
  'How does this apply in real life?',
];

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AIAssistantPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);

  const [subject, setSubject] = useState('General');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: "Hi! I'm your AI study assistant. I'm here to help you understand concepts, answer questions, and support your learning journey. What would you like to learn about today?",
      time: now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', text: text.trim(), time: now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post<{ explanation: string }>('/ai/explain', {
        text: text.trim(),
        subject,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.data.explanation, time: now() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: isAr ? 'عذراً، حدث خطأ. حاول مرة أخرى.' : 'Sorry, something went wrong. Please try again.', time: now() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link to={localePrefix + '/dashboard'}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            {isAr ? 'مساعد الدراسة بالذكاء الاصطناعي' : 'AI Study Assistant'}
          </h1>
          <p className="text-xs text-muted-foreground">{isAr ? 'احصل على مساعدة في فهم أي موضوع' : 'Get help understanding any topic'}</p>
        </div>
      </div>

      {/* Subject selector */}
      <div className="flex gap-2 px-4 py-3 border-b border-border bg-background shrink-0 overflow-x-auto">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSubject(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all ${
              subject === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-foreground hover:border-primary/50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? (isAr ? 'justify-start' : 'justify-end') : (isAr ? 'justify-end' : 'justify-start')}`}>
            {m.role === 'assistant' && (
              <div className={`w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 ${isAr ? 'ml-2' : 'mr-2'}`}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={`max-w-[80%] ${m.role === 'assistant' ? 'bg-card border border-border' : 'bg-primary text-primary-foreground'} rounded-2xl px-4 py-3`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
              <p className={`text-xs mt-1 ${m.role === 'assistant' ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>{m.time}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <div className="flex gap-1 items-center h-5">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-4 py-2 border-t border-border bg-background shrink-0">
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {isAr ? 'اقتراحات سريعة' : 'Quick Prompts'}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => void send(p)}
              className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:border-primary/50 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-background shrink-0">
        <div className="flex gap-3 items-end bg-card border border-border rounded-2xl px-4 py-3">
          <textarea
            className="flex-1 bg-transparent resize-none outline-none text-sm text-foreground placeholder:text-muted-foreground max-h-32"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAr ? 'اسألني أي شيء عن دراستك...' : 'Ask me anything about your studies...'}
          />
          <Button
            size="icon"
            className="rounded-xl shrink-0 bg-primary hover:bg-primary/90"
            onClick={() => void send(input)}
            disabled={!input.trim() || loading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {isAr ? 'اضغط Enter للإرسال، Shift+Enter لسطر جديد' : 'Tip: Press Enter to send, Shift + Enter for new line'}
        </p>
      </div>
    </div>
  );
}
