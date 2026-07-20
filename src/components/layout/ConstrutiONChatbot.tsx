'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authClient } from '@/lib/auth-client';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

// Public base URL for the backend (same var used by the server-action helpers).
const getBaseUrl = (): string =>
  process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000';

/**
 * Simple, monotonically-increasing message ID generator.
 * Deliberately avoids Math.random()/crypto.randomUUID() so the React
 * Compiler doesn't flag the call site as an impure function during render —
 * this lives at module scope and is only ever invoked from event handlers,
 * but keeping it counter-based sidesteps the lint rule entirely.
 */
let messageIdCounter = 0;
const generateMessageId = (): string => {
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
};

/**
 * Parses a raw Server-Sent-Events chunk buffer and returns any complete
 * "event: ...\ndata: ...\n\n" blocks found, plus whatever incomplete text
 * should be kept around for the next chunk.
 */
const parseSSEBuffer = (
  buffer: string,
): { events: { event: string; data: string }[]; rest: string } => {
  const events: { event: string; data: string }[] = [];
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() || '';

  for (const block of blocks) {
    const lines = block.split('\n');
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (data) events.push({ event, data });
  }

  return { events, rest };
};

export default function ConstructiONChatbot() {
  const { data: session } = authClient.useSession();
  const name = session?.user?.name || 'there';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: `Hello! I am your constractiON Assistant. Ask me anything about civil engineering estimations, project planning, or cost calculations!`,
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, streamingText, suggestions]);

  const sendMessage = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    setSuggestions([]); // clear old suggestions once a new question is asked

    const userMsg: Message = {
      id: generateMessageId(),
      text: userText,
      sender: 'user',
      timestamp: new Date(),
    };

    // Build conversation history from messages sent so far (excludes the welcome
    // greeting and the new message itself, which is sent separately below).
    const history = messages
      .filter(m => m.id !== 'welcome')
      .slice(-12)
      .map(m => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingText('');

    try {
      const res = await fetch(`${getBaseUrl()}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server responded with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalReply = '';
      let finalSuggestions: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSSEBuffer(buffer);
        buffer = rest;

        for (const evt of events) {
          if (evt.event === 'chunk') {
            const { token } = JSON.parse(evt.data) as { token: string };
            finalReply += token;
            setStreamingText(prev => prev + token);
          } else if (evt.event === 'done') {
            const data = JSON.parse(evt.data) as {
              reply: string;
              suggestions?: string[];
            };
            finalReply = data.reply;
            finalSuggestions = data.suggestions || [];
          } else if (evt.event === 'error') {
            throw new Error('AI stream reported an error');
          }
        }
      }

      const botMsg: Message = {
        id: generateMessageId(),
        text: finalReply || "I'm sorry, I couldn't generate a response.",
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      setSuggestions(finalSuggestions);
    } catch (error: unknown) {
      console.error('Chatbot communication error:', error);
      const errorMsg: Message = {
        id: generateMessageId(),
        text: "I'm sorry, I encountered an error communicating with the estimation AI. Please try again shortly.",
        sender: 'bot',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setStreamingText('');
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const userText = inputValue.trim();
    if (!userText) return;
    setInputValue('');
    await sendMessage(userText);
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isLoading) return;
    void sendMessage(suggestion);
  };

  return (
    <>
      {/* Floating Trigger Button - fixed position */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ position: 'fixed', zIndex: 9999 }}
        className="bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#10B981] to-[#38BDF8] text-[#020617] shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-none cursor-pointer"
        aria-label="Toggle chat"
      >
        <span className="absolute -inset-1 animate-ping rounded-full bg-gradient-to-tr from-[#10B981]/40 to-[#38BDF8]/40 opacity-75 blur-sm" />
        {isOpen ? (
          <svg
            className="h-6 w-6 relative z-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="h-6 w-6 relative z-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>

      {/* Chat Window Panel - fixed position */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ position: 'fixed', zIndex: 9998 }}
            className="bottom-24 right-6 w-80 sm:w-96 h-[500px] bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0F172A] border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981]/60 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
                </span>
                <span className="font-semibold text-sm text-[#F8FAFC] tracking-wide">
                  ConstructiON Assistant
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
                aria-label="Close chat"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#0F172A] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
                >
                  {message.sender === 'bot' ? (
                    <div className="flex items-start space-x-2 max-w-[85%]">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                        <svg
                          className="w-4.5 h-4.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div className="bg-[#020617] text-[#F8FAFC] px-4 py-2.5 rounded-2xl rounded-tl-none border border-slate-900 text-sm leading-relaxed shadow-sm">
                        {message.text}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-tr from-[#10B981] to-[#059669] text-[#020617] px-4 py-2.5 rounded-2xl rounded-tr-none text-sm font-semibold leading-relaxed max-w-[85%] shadow-md">
                      {message.text}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="flex items-start space-x-2 max-w-[85%]">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center text-[#38BDF8]">
                      <svg
                        className="w-4.5 h-4.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    {streamingText ? (
                      // Tokens have started arriving — show them live with a blinking cursor.
                      <div className="bg-[#020617] text-[#F8FAFC] px-4 py-2.5 rounded-2xl rounded-tl-none border border-slate-900 text-sm leading-relaxed shadow-sm">
                        {streamingText}
                        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-[#10B981] animate-pulse align-middle" />
                      </div>
                    ) : (
                      // Waiting for the first token — bouncing-dots typing indicator.
                      <div className="bg-[#020617] px-4 py-3 rounded-2xl rounded-tl-none border border-slate-900 flex items-center space-x-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-bounce" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isLoading && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 pl-10">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSuggestionClick(s)}
                      className="text-xs text-left px-3 py-1.5 rounded-full border border-[#38BDF8]/30 text-[#38BDF8] bg-[#38BDF8]/5 hover:bg-[#38BDF8]/15 transition cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSend}
              className="p-3 bg-[#020617] border-t border-slate-800 flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Ask about materials, budget..."
                className="flex-grow bg-[#0F172A] border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-[#F8FAFC] placeholder-slate-500 focus:outline-none focus:border-[#38BDF8]/60 transition"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-[#10B981] text-[#020617] hover:bg-[#10B981]/90 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                aria-label="Send message"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
