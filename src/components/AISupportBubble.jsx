import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineChatBubbleLeftRight, HiPaperAirplane, HiXMark } from "react-icons/hi2";
import "./AISupportBubble.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const TEMPLATE_CHOICES = [
  { label: "Environmental project", category: "environmental" },
  { label: "Community or social impact", category: "social" },
  { label: "Governance or policy", category: "governance" },
  { label: "Event announcement", category: "general" },
  { label: "Video presentation", category: "general" },
];

function isTemplateCreationRequest(text) {
  const mentionsTemplate = /\b(?:templates?|layouts?)\b/i.test(text);
  const asksToCreate =
    /\b(?:creat(?:e|es|ed|ing)|mak(?:e|es|ing)|build(?:s|ing)?|design(?:s|ing)?|generat(?:e|es|ed|ing)|start|new|want|need|help|how|can|could|would)\b/i.test(
      text
    );

  return mentionsTemplate && asksToCreate;
}

function getStoredUserRole() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}").role || "";
  } catch {
    return "";
  }
}

export default function AISupportBubble() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [templateFlow, setTemplateFlow] = useState(null);
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

    if (!templateFlow && isTemplateCreationRequest(text)) {
      setTemplateFlow({ step: "kind" });
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "What kind of template would you like to use?",
          choices: TEMPLATE_CHOICES,
        },
      ]);
      return;
    }

    if (templateFlow?.step === "kind") {
      setTemplateFlow({ step: "details", kind: text });
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            `Great choice: ${text}. What should the template include? Describe its purpose, key text or sections, preferred colors, and whether you want image or video placeholders.`,
        },
      ]);
      return;
    }

    setLoading(true);

    try {
      if (templateFlow?.step === "details") {
        const response = await fetch(`${API_BASE_URL}/api/templates/ai-generated`, {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ kind: templateFlow.kind, details: text }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Unable to create the template.");
        }
        setTemplateFlow(null);
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: data.message,
            template: data.template,
          },
        ]);
        return;
      }

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

  const chooseTemplateKind = (choice) => {
    if (loading) return;
    const nextMessages = [
      ...messages,
      { role: "user", content: choice.label },
      {
        role: "assistant",
        content: `Great choice: ${choice.label}. What should the template include? Describe its purpose, key text or sections, preferred colors, and whether you want image or video placeholders.`,
      },
    ];
    setMessages(nextMessages);
    setTemplateFlow({ step: "details", kind: `${choice.label} (${choice.category})` });
  };

  const handleUseGeneratedTemplate = (template) => {
    const userRole = getStoredUserRole();
    if (userRole === "admin") {
      navigate("/manage-templates");
      return;
    }

    navigate("/canvas/new", { state: { template } });
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
                {message.choices && (
                  <div className="ai-support-choices">
                    {message.choices.map((choice) => (
                      <button
                        key={choice.label}
                        type="button"
                        onClick={() => chooseTemplateKind(choice)}
                        disabled={loading || templateFlow?.step !== "kind"}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                )}
                {message.template && (
                  <button
                    type="button"
                    className="ai-support-template-action"
                    onClick={() => handleUseGeneratedTemplate(message.template)}
                  >
                    {getStoredUserRole() === "admin"
                      ? "View in Manage Templates"
                      : "Use this template"}
                  </button>
                )}
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
              placeholder={
                templateFlow?.step === "kind"
                  ? "Or type a template type..."
                  : templateFlow?.step === "details"
                    ? "Describe your template..."
                    : "Ask for help..."
              }
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
