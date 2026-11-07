import { useEffect, useRef, useState } from "react";
import { HiOutlineChatBubbleLeftRight, HiPaperAirplane, HiXMark } from "react-icons/hi2";
import "./AISupportBubble.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

export default function AISupportBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I’m your CMS support assistant. How can I help?",
    },
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai-support/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Unable to contact the support assistant.");
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.message },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error.message || "The support assistant is unavailable.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`ai-support ${open ? "ai-support--open" : ""}`}>
      {open && (
        <section className="ai-support-panel" aria-label="AI support chat">
          <header className="ai-support-header">
            <div>
              <strong>AI Support</strong>
              <span>CMS assistant</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close support chat">
              <HiXMark size={20} />
            </button>
          </header>

          <div className="ai-support-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                className={`ai-support-message ai-support-message--${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.content}
              </div>
            ))}
            {loading && (
              <div className="ai-support-message ai-support-message--assistant ai-support-message--typing">
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="ai-support-form" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for help..."
              aria-label="Support message"
              maxLength={2000}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send message">
              <HiPaperAirplane size={18} />
            </button>
          </form>
        </section>
      )}

      {!open && (
        <button
          type="button"
          className="ai-support-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open AI support chat"
        >
          <HiOutlineChatBubbleLeftRight size={27} />
        </button>
      )}
    </div>
  );
}
