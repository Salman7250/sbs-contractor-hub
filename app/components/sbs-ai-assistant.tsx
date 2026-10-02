"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

type SbsAiAssistantProps = {
  pathname: string;
};

const QUICK_QUESTIONS = [
  "What can SBS do?",
  "How do I create an invoice?",
  "How do I create a customer?",
  "What is this page for?",
];

function getPageName(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/estimates")) return "Quotes";
  if (pathname.startsWith("/sales")) return "Sales & Orders";
  if (pathname.startsWith("/invoices")) return "Invoices";
  if (pathname.startsWith("/accounting")) return "Accounting";
  if (pathname.startsWith("/products")) return "Products";
  if (pathname.startsWith("/serial-numbers")) return "Serial Numbers";
  if (pathname.startsWith("/inventory")) return "Inventory";
  if (pathname.startsWith("/warehouses")) return "Warehouses";
  if (pathname.startsWith("/pricing")) return "Pricing";
  if (pathname.startsWith("/suppliers")) return "Suppliers";
  if (pathname.startsWith("/purchase-orders")) return "Purchase Orders";
  if (pathname.startsWith("/expenses")) return "Expenses";
  if (pathname.startsWith("/warranty")) return "Warranty";
  if (pathname.startsWith("/repairs")) return "Repairs";
  if (pathname.startsWith("/rma")) return "RMA";
  if (pathname.startsWith("/service-providers")) {
    return "Service Providers";
  }
  if (pathname.startsWith("/service-jobs")) {
    return "Service Jobs";
  }
  if (pathname.startsWith("/b2b-portal")) {
    return "B2B Client Portal";
  }
  if (pathname.startsWith("/analytics")) return "Analytics";
  if (pathname.startsWith("/employees")) return "Employees";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/settings")) return "Settings";

  return "SBS";
}

function GeminiSparkIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <path
        d="
          M16 3.5
          C17.3 10.4 21.6 14.7 28.5 16
          C21.6 17.3 17.3 21.6 16 28.5
          C14.7 21.6 10.4 17.3 3.5 16
          C10.4 14.7 14.7 10.4 16 3.5
          Z
        "
        fill="currentColor"
      />
    </svg>
  );
}

export default function SbsAiAssistant({
  pathname,
}: SbsAiAssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const messagesEndRef =
    useRef<HTMLDivElement | null>(null);

  const pageName = getPageName(pathname);

  /*
   * Show the assistant invitation shortly after
   * the page loads.
   */
  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      setShowHint(true);
    }, 1200);

    const hideTimer = window.setTimeout(() => {
      setShowHint(false);
    }, 6500);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [pathname]);

  /*
   * Hide the invitation whenever the assistant
   * is opened.
   */
  useEffect(() => {
    if (open) {
      setShowHint(false);
    }
  }, [open]);

  /*
   * Keep the latest message visible.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  async function sendMessage(value?: string) {
    const message = (value ?? input).trim();

    if (!message || isTyping) {
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: message,
    };

    setMessages((current) => [
      ...current,
      userMessage,
    ]);

    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch(
        "/api/ai/assistant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            pathname,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Assistant request failed.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            data.message ||
            "I couldn't generate a response.",
        },
      ]);
    } catch (error) {
      console.error(
        "SBS Assistant request failed:",
        error,
      );

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "I couldn't connect to the SBS Assistant right now. Please try again.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  function openAssistant() {
    setShowHint(false);
    setOpen(true);
  }

  function closeAssistant() {
    setOpen(false);
  }

  return (
    <>
      {/* =====================================================
          PAGE-LOAD ASSISTANT INVITATION
      ===================================================== */}

      {!open && showHint && (
        <button
          type="button"
          className="sbs-ai-hint"
          onClick={openAssistant}
          aria-label="Open SBS Assistant"
        >
          <div className="sbs-ai-hint-icon">
            <GeminiSparkIcon />
          </div>

          <div className="sbs-ai-hint-copy">
            <strong>Ask me anything</strong>

            <span>SBS Assistant</span>
          </div>

          <svg
            className="sbs-ai-hint-arrow"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M9 18l6-6-6-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* =====================================================
          FLOATING AI BUTTON
      ===================================================== */}

      {!open && (
        <button
          type="button"
          className="sbs-ai-floating-button"
          onClick={openAssistant}
          aria-label="Open SBS Assistant"
        >
          <span className="sbs-ai-button-icon">
            <GeminiSparkIcon />
          </span>

          <span className="sbs-ai-button-status" />
        </button>
      )}

      {/* =====================================================
          ASSISTANT PANEL
      ===================================================== */}

      {open && (
        <>
          <button
            type="button"
            className="sbs-ai-backdrop"
            aria-label="Close SBS Assistant"
            onClick={closeAssistant}
          />

          <section
            className="sbs-ai-panel"
            aria-label="SBS Assistant"
          >
            {/* HEADER */}

            <header className="sbs-ai-header">
              <div className="sbs-ai-header-brand">
                <div className="sbs-ai-header-logo">
                  <GeminiSparkIcon />
                </div>

                <div className="sbs-ai-header-copy">
                  <div className="sbs-ai-title">
                    SBS Assistant
                  </div>

                  <div className="sbs-ai-status">
                    <span />
                    Online
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="sbs-ai-close"
                onClick={closeAssistant}
                aria-label="Close SBS Assistant"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </header>

            {/* CURRENT PAGE */}

            <div className="sbs-ai-context">
              <span>Viewing</span>

              <strong>{pageName}</strong>
            </div>

            {/* CHAT */}

            <div className="sbs-ai-messages">
              {messages.length === 0 && (
                <div className="sbs-ai-welcome">
                  <div className="sbs-ai-welcome-icon">
                    <GeminiSparkIcon />
                  </div>

                  <h3>
                    How can I help?
                  </h3>

                  <p>
                    Ask me anything about SBS
                    or the work you are doing.
                  </p>

                  <div className="sbs-ai-quick-actions">
                    {QUICK_QUESTIONS.map(
                      (question) => (
                        <button
                          key={question}
                          type="button"
                          onClick={() =>
                            sendMessage(question)
                          }
                          disabled={isTyping}
                        >
                          <span>
                            {question}
                          </span>

                          <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              d="M9 18l6-6-6-6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`sbs-ai-message-row ${message.role}`}
                >
                  {message.role ===
                    "assistant" && (
                    <div className="sbs-ai-message-logo">
                      <GeminiSparkIcon />
                    </div>
                  )}

                  <div
                    className={`sbs-ai-message ${message.role}`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="sbs-ai-message-row assistant">
                  <div className="sbs-ai-message-logo">
                    <GeminiSparkIcon />
                  </div>

                  <div className="sbs-ai-message assistant typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}

            <div className="sbs-ai-input-area">
              <div className="sbs-ai-input">
                <input
                  type="text"
                  value={input}
                  onChange={(event) =>
                    setInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask SBS Assistant..."
                  disabled={isTyping}
                />

                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={
                    !input.trim() ||
                    isTyping
                  }
                  aria-label="Send message"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12h13M13 6l6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="sbs-ai-footer">
                SBS Assistant · Gemini
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}