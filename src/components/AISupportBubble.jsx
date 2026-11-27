import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineChatBubbleLeftRight, HiPaperAirplane, HiXMark } from "react-icons/hi2";
import AIMessageContent from "./AIMessageContent";
import "./AISupportBubble.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const TEMPLATE_CHOICES = [
  { label: "Environmental project", category: "environmental" },
  { label: "Community or social impact", category: "social" },
  { label: "Governance or policy", category: "governance" },
  { label: "Event announcement", category: "general" },
  { label: "Video presentation", category: "general" },
];
const PROMPT_STARTERS = {
  schedule:
    "Help me plan a content schedule for [project or campaign]. Suggest a posting cadence, dates, times, and content themes; ask me for any missing details. Do not save it yet.",
  content:
    "Help me create concise digital-signage content for [topic or campaign], with a headline, short body, and call to action.",
  format:
    "Format this for a digital-signage slide with a short headline, concise body, and clear call to action: [paste content]",
};

function getFollowUpPrompt(text) {
  if (/\b(?:schedule|scheduling|calendar|cadence)\b/i.test(text)) {
    return "Refine the schedule plan with the project, target display, dates, and preferred posting times.";
  }
  if (/\b(?:content|caption|headline|title|copy|format)\b/i.test(text)) {
    return "Revise your previous draft to be clearer and more concise for a digital-signage slide.";
  }
  return "Please continue with the next step from your previous answer.";
}

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
  const [pendingTemplateUse, setPendingTemplateUse] = useState(null);
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

    if (templateFlow?.step === "details") {
      setTemplateFlow({
        step: "confirm",
        kind: templateFlow.kind,
        details: text,
      });
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content:
            "This will create and save a shared reusable template. Confirm to continue; nothing is saved if you cancel.",
          confirmation: "create-template",
        },
      ]);
      return;
    }

    if (templateFlow?.step === "confirm") return;

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/ai-support/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Unable to contact the support assistant.");
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.message, tool: data.tool },
      ]);
      setInput(getFollowUpPrompt(text));
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

  const confirmTemplateCreation = async () => {
    if (loading || templateFlow?.step !== "confirm") return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/templates/ai-generated`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: templateFlow.kind,
          details: templateFlow.details,
          confirmed: true,
        }),
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
          tool: { label: "Confirmed template creation" },
        },
      ]);
      setInput("Create matching signage content for the template I just made.");
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error.message || "Unable to create the template.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const cancelTemplateCreation = () => {
    if (loading || templateFlow?.step !== "confirm") return;
    setTemplateFlow(null);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: "Template creation cancelled. Nothing was saved.",
      },
    ]);
  };

  const confirmTemplateUse = () => {
    if (!pendingTemplateUse) return;
    const template = pendingTemplateUse;
    setPendingTemplateUse(null);
    navigate("/canvas/new", { state: { template } });
  };

  const cancelTemplateUse = () => {
    setPendingTemplateUse(null);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: "Opening a canvas was cancelled. No changes were made.",
      },
    ]);
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

    setPendingTemplateUse(template);
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: `Open a new canvas using "${template.name}"? You can review it in the editor before saving.`,
        confirmation: "use-template",
      },
    ]);
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

          <nav className="ai-support-tools" aria-label="Available AI tools">
            <button
              type="button"
              onClick={() => setInput(PROMPT_STARTERS.schedule)}
              disabled={loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)}
            >
              Make a schedule
            </button>
            <button
              type="button"
              onClick={() => setInput("Create a template")}
              disabled={loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)}
            >
              Make a template
            </button>
            <button
              type="button"
              onClick={() => setInput(PROMPT_STARTERS.content)}
              disabled={loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)}
            >
              Make content
            </button>
            <button
              type="button"
              onClick={() => setInput(PROMPT_STARTERS.format)}
              disabled={loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)}
            >
              Format content
            </button>
            <button
              type="button"
              onClick={() => setInput("Show me all upcoming content schedules.")}
              disabled={loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)}
            >
              Upcoming schedules
            </button>
            {getStoredUserRole() === "admin" && (
              <>
                <button
                  type="button"
                  onClick={() => setInput("Which screens need attention?")}
                  disabled={
                    loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)
                  }
                >
                  Display status
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setInput("Summarise the admin dashboard and recent project activity.")
                  }
                  disabled={
                    loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)
                  }
                >
                  Dashboard summary
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() =>
                setInput(
                  "Suggest three concise ESG captions for an environmental sustainability project."
                )
              }
              disabled={loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)}
            >
              ESG captions
            </button>
            <button
              type="button"
              onClick={() =>
                setInput("Suggest three short title options for an ESG campaign.")
              }
              disabled={loading || Boolean(templateFlow) || Boolean(pendingTemplateUse)}
            >
              ESG titles
            </button>
          </nav>

          <div className="ai-support-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                className={`ai-support-message ai-support-message--${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.tool?.label && (
                  <span className="ai-support-tool-badge">
                    {message.tool.label}
                    {message.tool.syncedAt &&
                      ` · synced ${new Date(message.tool.syncedAt).toLocaleTimeString()}`}
                  </span>
                )}
                {message.role === "assistant" ? (
                  <AIMessageContent content={message.content} />
                ) : (
                  message.content
                )}
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
                {message.confirmation === "create-template" && (
                  <div className="ai-support-confirmation">
                    <button
                      type="button"
                      onClick={confirmTemplateCreation}
                      disabled={loading}
                    >
                      Confirm and create
                    </button>
                    <button
                      type="button"
                      className="ai-support-confirmation-cancel"
                      onClick={cancelTemplateCreation}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {message.confirmation === "use-template" && (
                  <div className="ai-support-confirmation">
                    <button
                      type="button"
                      onClick={confirmTemplateUse}
                      disabled={!pendingTemplateUse}
                    >
                      Confirm and open
                    </button>
                    <button
                      type="button"
                      className="ai-support-confirmation-cancel"
                      onClick={cancelTemplateUse}
                      disabled={!pendingTemplateUse}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {message.template && (
                  <button
                    type="button"
                    className="ai-support-template-action"
                    onClick={() => handleUseGeneratedTemplate(message.template)}
                    disabled={Boolean(pendingTemplateUse)}
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
              disabled={
                loading ||
                templateFlow?.step === "confirm" ||
                Boolean(pendingTemplateUse)
              }
            />
            <button
              type="submit"
              disabled={
                loading ||
                templateFlow?.step === "confirm" ||
                Boolean(pendingTemplateUse) ||
                !input.trim()
              }
              aria-label="Send message"
            >
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
