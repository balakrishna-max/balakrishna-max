import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Paperclip, MessageCircle } from 'lucide-react';

export default function ChatbotWidget({ config }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState('WEB');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, loading]);

  const stamp = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const push = (m) => setMessages((prev) => [...prev, m]);

  const sendText = async () => {
    if (!input.trim()) return;
    if (mode === 'REPORTS') {
      push({ from: 'bot', text: 'Reports AI Module Under Development', time: stamp() });
      return;
    }
    push({ from: 'user', text: input, time: stamp() });
    const msg = input;
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`${config.chatbotUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, source: mode }),
      });
      const data = await res.json();
      push({ from: 'bot', text: data.response || 'No response', time: stamp() });
    } catch {
      push({ from: 'bot', text: 'Error connecting to Chat-Bot.', time: '' });
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;
    push({ from: 'user', text: file.name, time: stamp() });
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${config.chatbotUrl}/documents/upload`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      push({ from: 'bot', text: data.message || 'Uploaded', time: stamp() });
    } catch {
      push({ from: 'bot', text: 'Upload failed', time: '' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="grv-chat-fab" onClick={() => setOpen(true)} aria-label="Open chat">
        <MessageCircle size={22} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="grv-chat-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.22 }}
          >
            <div className="grv-chat-header">
              <div className="grv-chat-title">
                <div className="grv-chat-avatar" />
                <div>
                  <div className="grv-chat-name">A2Z Assistant</div>
                  <div className="grv-chat-sub">Online</div>
                </div>
              </div>
              <button className="grv-chat-close" onClick={() => setOpen(false)} aria-label="Close">
                <X size={14} />
              </button>
            </div>

            <div className="grv-chat-body" ref={bodyRef}>
              {messages.length === 0 && (
                <div className="grv-chat-welcome">
                  <p>Hi 👋</p>
                  <p>Welcome to A2Z Procure</p>
                  <p>How can we help?</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`grv-msg ${m.from === 'user' ? 'user' : 'bot'}`}>
                  <div className="grv-msg-bubble">
                    <div className="grv-msg-text">{m.text}</div>
                    {m.time && <div className="grv-msg-time">{m.time}</div>}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="grv-msg bot">
                  <div className="grv-msg-bubble">
                    <div className="grv-typing"><span></span><span></span><span></span></div>
                  </div>
                </div>
              )}
            </div>

            <div className="grv-chat-modes">
              {[
                { val: 'WEB', label: 'WEB' },
                { val: 'RAG', label: 'DOC AI' },
                { val: 'REPORTS', label: 'REPORTS' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  className={`grv-mode-chip ${mode === val ? 'active' : ''}`}
                  onClick={() => setMode(val)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grv-chat-input">
              <input
                type="text"
                placeholder="Type your message here"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendText(); } }}
              />
              <label className="grv-chat-attach">
                <Paperclip size={16} />
                <input type="file" hidden onChange={(e) => uploadFile(e.target.files?.[0])} />
              </label>
              <button className="grv-chat-send" onClick={sendText} aria-label="Send">
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}