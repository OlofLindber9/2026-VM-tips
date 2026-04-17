"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
};

export default function GroupChat({
  groupId,
  currentUserId,
}: {
  groupId: string;
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottomRef = useRef(true);

  // Initial fetch + polling every 8s
  useEffect(() => {
    async function fetchMessages() {
      try {
        const res = await fetch(`/api/groups/${groupId}/chat`);
        if (!res.ok) return;
        const data: Message[] = await res.json();
        setMessages((prev) => {
          if (
            prev.length === data.length &&
            prev[prev.length - 1]?.id === data[data.length - 1]?.id
          )
            return prev;
          return data;
        });
      } catch {
        // ignore network errors silently
      }
    }

    fetchMessages();
    const interval = setInterval(fetchMessages, 8000);
    return () => clearInterval(interval);
  }, [groupId]);

  // Auto-scroll to bottom only when user is already near the bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setInput("");
    // Reset textarea height after clearing
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch(`/api/groups/${groupId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const msg: Message = await res.json();
        setMessages((prev) => [...prev, msg]);
        isAtBottomRef.current = true;
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Idag";
    if (d.toDateString() === yesterday.toDateString()) return "Igår";
    return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long" });
  }

  // Group messages by date for date dividers
  const grouped: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.createdAt);
    if (!grouped.length || grouped[grouped.length - 1].date !== date) {
      grouped.push({ date, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  }

  return (
    <div className="glass-card flex flex-col" style={{ height: "480px" }}>
      <h2 className="font-bold text-white mb-3 flex-shrink-0">💬 Gruppchat</h2>

      {/* Message list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
      >
        {messages.length === 0 ? (
          <p className="text-white/30 text-sm text-center mt-8">
            Inga meddelanden ännu. Starta en konversation!
          </p>
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date divider */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/30 px-2">{date}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {msgs.map((msg, i) => {
                const isOwn = msg.userId === currentUserId;
                const prevMsg = i > 0 ? msgs[i - 1] : null;
                const showSender = !prevMsg || prevMsg.userId !== msg.userId;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwn ? "items-end" : "items-start"} ${showSender ? "mt-2" : "mt-0.5"}`}
                  >
                    {showSender && !isOwn && (
                      <span className="text-xs text-app-ice ml-3 mb-0.5 font-medium">
                        {msg.displayName}
                      </span>
                    )}
                    <div className="flex items-end gap-1.5 max-w-[80%]">
                      {isOwn && (
                        <span className="text-[10px] text-white/30 mb-1 flex-shrink-0">
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-snug ${
                          isOwn
                            ? "rounded-br-sm text-white"
                            : "rounded-bl-sm text-white/90"
                        }`}
                        style={{
                          background: isOwn
                            ? "rgba(45, 106, 79, 0.7)"
                            : "rgba(255,255,255,0.08)",
                          border: isOwn
                            ? "1px solid rgba(45,106,79,0.6)"
                            : "1px solid rgba(255,255,255,0.1)",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {msg.content}
                      </div>
                      {!isOwn && (
                        <span className="text-[10px] text-white/30 mb-1 flex-shrink-0">
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2 mt-3 flex-shrink-0 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Auto-grow: reset to auto first so shrinking works
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Skriv ett meddelande…"
          maxLength={4000}
          disabled={sending}
          rows={1}
          className="input-dark flex-1 text-sm py-2 resize-none leading-snug"
          style={{ overflow: "hidden" }}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ height: "38px" }}
        >
          Skicka
        </button>
      </form>
    </div>
  );
}
