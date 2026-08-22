"use client";

import { Check, Send, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ASSISTANT_BENEFITS,
  ASSISTANT_REPLY,
  ASSISTANT_TRANSCRIPT,
} from "@/features/landing/constants/landing.constants";
import type { AssistantMessage } from "@/features/landing/types/landing.types";

/**
 * Marketing preview of the AI shopping assistant. The chat is a self-contained
 * demo (canned reply) — the real assistant lives in features/assistant later.
 */
export function SmartAssistantPreview() {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    ...ASSISTANT_TRANSCRIPT,
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // No standalone /assistant page exists yet (features/assistant is a stub),
  // so "Try the Assistant" points at the one real, working thing on this
  // page — the demo chat right here — instead of a route that would 404.
  const focusDemo = useCallback(() => {
    inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    inputRef.current?.focus();
  }, []);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setTyping(true);
    window.setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", text: ASSISTANT_REPLY }]);
      setTyping(false);
    }, 1500);
  }, [input]);

  useEffect(() => {
    // Scroll only this chat's own message list — never the outer page.
    // `Element.scrollIntoView()` walks every scrollable ancestor by default
    // (including the document), which previously yanked the whole homepage
    // down to this section on mount. Setting `scrollTop` directly is scoped
    // to this element only.
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  return (
    <section className="bg-rj-black py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-5 md:px-8 lg:grid-cols-2">
        {/* Text */}
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-rj-red/30 bg-rj-red/12 px-4 py-1.5">
            <Zap className="h-[11px] w-[11px] fill-rj-red text-rj-red" aria-hidden="true" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-rj-red">
              AI-Powered
            </span>
          </div>
          <h2 className="mb-6 font-serif text-4xl leading-[1.05] text-rj-white md:text-[52px]">
            Your Personal
            <br />
            <em className="not-italic text-rj-red">Shopping</em> Assistant
          </h2>
          <p className="mb-8 text-[15px] leading-relaxed text-rj-gray-400">
            Tell our AI assistant what you&apos;re looking for — style, budget,
            occasion, or size — and it will surface the most relevant products
            across every shop in seconds.
          </p>
          <ul className="mb-10 space-y-3">
            {ASSISTANT_BENEFITS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-[14px] text-rj-gray-200">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rj-red/15">
                  <Check className="h-2.5 w-2.5 text-rj-red" strokeWidth={2.5} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={focusDemo}
            className="rounded-full bg-rj-red px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-rj-red/25 transition-colors hover:bg-rj-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30 focus-visible:ring-offset-2"
          >
            Try the Assistant
          </button>
        </div>

        {/* Chat UI */}
        <div>
          <div className="overflow-hidden rounded-3xl border border-rj-gray-800 bg-[#141414] shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-rj-gray-800 bg-[#1A1A1A] px-5 py-4">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rj-red to-rj-red-dark">
                <Zap className="h-[15px] w-[15px] fill-white text-white" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-rj-white">RobertJ Assistant</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-rj-gray-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-rj-green" />
                  Online · Powered by AI
                </div>
              </div>
              <div className="flex gap-1.5">
                {["#E8192C", "#F4B942", "#22C55E"].map((c) => (
                  <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />
                ))}
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesRef} className="h-72 space-y-4 overflow-y-auto px-4 py-5">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  style={{ animation: "fadeSlideIn 0.3s ease" }}
                >
                  {msg.role === "assistant" ? (
                    <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rj-red">
                      <Zap className="h-2.5 w-2.5 fill-white text-white" aria-hidden="true" />
                    </div>
                  ) : null}
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-rj-red text-white"
                        : "rounded-bl-sm bg-rj-gray-800 text-rj-gray-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {typing ? (
                <div className="flex justify-start gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-rj-red">
                    <Zap className="h-2.5 w-2.5 fill-white text-white" aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-rj-gray-800 px-4 py-3.5">
                    {[0, 1, 2].map((j) => (
                      <span
                        key={j}
                        className="h-1.5 w-1.5 rounded-full bg-rj-gray-600"
                        style={{ animation: `bounce 1s ease-in-out ${j * 200}ms infinite` }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Input */}
            <div className="flex items-center gap-3 border-t border-rj-gray-800 bg-[#1A1A1A] px-4 py-4">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder="Ask about style, size, budget…"
                aria-label="Message the shopping assistant"
                className="flex-1 rounded-full bg-rj-gray-800 px-4 py-2.5 text-[13px] text-rj-white outline-none placeholder:text-rj-gray-600 focus:ring-1 focus:ring-rj-red/40"
              />
              <button
                type="button"
                onClick={send}
                disabled={!input.trim()}
                aria-label="Send message"
                className="flex-shrink-0 rounded-full bg-rj-red p-2.5 text-white transition-all hover:bg-rj-red-dark active:scale-95 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rj-red/30 focus-visible:ring-offset-2"
              >
                <Send className="h-[15px] w-[15px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
