"use client";

import {
  Archive,
  Check,
  Copy,
  File,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  company_id: string;
  customer_id: string;
  subject: string;
  status: string;
  created_by_user_id: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  company_id: string;
  customer_id: string;
  request_id: string | null;
  conversation_id: string | null;
  sender_user_id: string;
  sender_type: "client" | "company";
  message: string | null;
  content: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
  deleted_at: string | null;
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type Company = {
  id: string;
  name: string | null;
  logo_url: string | null;
};

function formatTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getMessageText(message: Message) {
  return message.content || message.message || "";
}

function initials(name: string | null | undefined) {
  if (!name) return "C";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function MessagesPage() {
  const supabase = useMemo(() => createClient(), []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [userId, setUserId] = useState("");
  const [company, setCompany] = useState<Company | null>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] =
    useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [menuMessageId, setMenuMessageId] = useState<string | null>(null);

  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [creatingConversation, setCreatingConversation] = useState(false);


  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.id === selectedConversationId,
      ) || null,
    [conversations, selectedConversationId],
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const customerMatch =
        customer &&
        selectedConversation?.id === conversation.id &&
        (customer.name || "")
          .toLowerCase()
          .includes(term);

      return (
        conversation.subject.toLowerCase().includes(term) ||
        customerMatch
      );
    });
  }, [conversations, search, customer, selectedConversation]);

  const loadCompanyAndAccess = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      window.location.href = "/login";
      return null;
    }

    setUserId(user.id);

    const { data: membership, error: membershipError } =
      await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!membership?.company_id) {
      throw new Error("No company is associated with your account.");
    }

    const companyId = membership.company_id;

    const { data: hasAccess, error: accessError } =
      await supabase.rpc("company_has_module_access", {
        p_company_id: companyId,
        p_module_slug: "b2b-client-portal",
      });

    if (accessError) {
      throw accessError;
    }

    if (!hasAccess) {
      setAccessDenied(true);
      return null;
    }

    const { data: companyData, error: companyError } =
      await supabase
        .from("companies")
        .select("id,name,logo_url")
        .eq("id", companyId)
        .maybeSingle();

    if (companyError) {
      throw companyError;
    }

    setCompany(companyData as Company | null);

    return companyId;
  }, [supabase]);

  const loadConversations = useCallback(
    async (companyId: string) => {
      const { data, error } = await supabase
        .from("customer_portal_conversations")
        .select(
          `
            id,
            company_id,
            customer_id,
            subject,
            status,
            created_by_user_id,
            last_message_at,
            created_at,
            updated_at
          `,
        )
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      const nextConversations =
        (data || []) as Conversation[];

      setConversations(nextConversations);

      if (
        !selectedConversationId &&
        nextConversations.length > 0
      ) {
        setSelectedConversationId(
          nextConversations[0].id,
        );
      }

      return nextConversations;
    },
    [supabase],
  );

  const loadCustomers = useCallback(
    async (companyId: string) => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,email,phone")
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      setCustomers((data || []) as Customer[]);
    },
    [supabase],
  );

  const loadMessages = useCallback(
    async (conversationId: string) => {
      setLoadingMessages(true);

      try {
        const { data: conversation, error: conversationError } =
          await supabase
            .from("customer_portal_conversations")
            .select("id,customer_id")
            .eq("id", conversationId)
            .maybeSingle();

        if (conversationError) {
          throw conversationError;
        }

        if (!conversation) {
          setMessages([]);
          setCustomer(null);
          return;
        }

        const { data, error } = await supabase
          .from("customer_portal_messages")
          .select(
            `
              id,
              company_id,
              customer_id,
              request_id,
              conversation_id,
              sender_user_id,
              sender_type,
              message,
              content,
              attachment_url,
              attachment_name,
              attachment_type,
              created_at,
              deleted_at
            `,
          )
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (error) {
          throw error;
        }

        setMessages((data || []) as Message[]);

        const { data: customerData, error: customerError } =
          await supabase
            .from("customers")
            .select("id,name,email,phone")
            .eq("id", conversation.customer_id)
            .maybeSingle();

        if (customerError) {
          throw customerError;
        }

        setCustomer(customerData as Customer | null);

        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
          });
        });
      } finally {
        setLoadingMessages(false);
      }
    },
    [supabase],
  );

  const loadPage = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setAccessDenied(false);

        const companyId = await loadCompanyAndAccess();

        if (!companyId) {
          return;
        }

        const nextConversations =
          await loadConversations(companyId);

        await loadCustomers(companyId);

        if (selectedConversationId) {
          const stillExists = nextConversations.some(
            (conversation) =>
              conversation.id === selectedConversationId,
          );

          if (!stillExists) {
            setSelectedConversationId(
              nextConversations[0]?.id || null,
            );
          }
        } else if (nextConversations[0]) {
          setSelectedConversationId(
            nextConversations[0].id,
          );
        }
      } catch (error) {
        console.error("Messages inbox error:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      loadCompanyAndAccess,
      loadConversations,
      loadCustomers,
      selectedConversationId,
    ],
  );

  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    void loadMessages(selectedConversationId);
  }, [selectedConversationId, loadMessages]);

  async function createConversation() {
    if (
      !company?.id ||
      !newCustomerId ||
      !newSubject.trim()
    ) {
      return;
    }

    try {
      setCreatingConversation(true);

      const { data, error } = await supabase
        .from("customer_portal_conversations")
        .insert({
          company_id: company.id,
          customer_id: newCustomerId,
          subject: newSubject.trim(),
          status: "open",
          created_by_user_id: userId,
        })
        .select(
          `
            id,
            company_id,
            customer_id,
            subject,
            status,
            created_by_user_id,
            last_message_at,
            created_at,
            updated_at
          `,
        )
        .single();

      if (error) {
        throw error;
      }

      setConversations((current) => [
        data as Conversation,
        ...current,
      ]);

      setSelectedConversationId(data.id);
      setNewSubject("");
      setNewCustomerId("");
      setShowNewConversation(false);
    } catch (error) {
      console.error(
        "Create conversation error:",
        error,
      );
    } finally {
      setCreatingConversation(false);
    }
  }

  async function sendMessage() {
    if (
      !company?.id ||
      !selectedConversation ||
      (!messageText.trim() && !selectedFile)
    ) {
      return;
    }

    try {
      setSending(true);

      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;

      /*
       * Attachment storage can be connected to your
       * existing Supabase Storage bucket later.
       *
       * For now we preserve the selected file locally
       * in the UI rather than pretending it uploaded.
       */
      if (selectedFile) {
        attachmentName = selectedFile.name;
        attachmentType = selectedFile.type || null;
      }

      const content = messageText.trim();

      const { data, error } = await supabase
        .from("customer_portal_messages")
        .insert({
          company_id: company.id,
          customer_id:
            selectedConversation.customer_id,
          conversation_id:
            selectedConversation.id,
          sender_user_id: userId,
          sender_type: "company",
          message: content || null,
          content: content || null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
        })
        .select(
          `
            id,
            company_id,
            customer_id,
            request_id,
            conversation_id,
            sender_user_id,
            sender_type,
            message,
            content,
            attachment_url,
            attachment_name,
            attachment_type,
            created_at,
            deleted_at
          `,
        )
        .single();

      if (error) {
        throw error;
      }

      setMessages((current) => [
        ...current,
        data as Message,
      ]);

      setMessageText("");
      setSelectedFile(null);

      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
        });
      });

      await loadConversations(company.id);
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    try {
      const { error } = await supabase
        .from("customer_portal_messages")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      if (error) {
        throw error;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                deleted_at:
                  new Date().toISOString(),
              }
            : message,
        ),
      );

      setMenuMessageId(null);
    } catch (error) {
      console.error(
        "Delete message error:",
        error,
      );
    }
  }

  async function archiveConversation() {
    if (!selectedConversation) return;

    try {
      const { error } = await supabase
        .from("customer_portal_conversations")
        .update({
          status: "archived",
        })
        .eq("id", selectedConversation.id);

      if (error) {
        throw error;
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id ===
          selectedConversation.id
            ? {
                ...conversation,
                status: "archived",
              }
            : conversation,
        ),
      );
    } catch (error) {
      console.error(
        "Archive conversation error:",
        error,
      );
    }
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error(
        "Copy message error:",
        error,
      );
    }

    setMenuMessageId(null);
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] || null;

    if (file) {
      setSelectedFile(file);
    }
  }

  function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      void sendMessage();
    }
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-card">
          <div className="spinner" />
          <strong>Loading Messages</strong>
          <span>
            Preparing your customer conversations...
          </span>
        </div>

        <style jsx>{`
          .loading-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f7fb;
          }

          .loading-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            padding: 35px;
          }

          .loading-card strong {
            font-size: 16px;
            color: #111827;
          }

          .loading-card span {
            color: #9ca3af;
            font-size: 13px;
          }

          .spinner {
            width: 30px;
            height: 30px;
            margin-bottom: 8px;
            border: 3px solid #e5e7eb;
            border-top-color: #111827;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="access-page">
        <div className="access-card">
          <div className="access-icon">
            <MessageCircle size={25} />
          </div>

          <h1>Client Portal Required</h1>

          <p>
            Customer messaging is part of the B2B
            Client Portal module. Your current plan
            or account does not have access to this
            module.
          </p>

          <Link
            href="/settings"
            className="access-button"
          >
            Back to Settings
          </Link>
        </div>

        <style jsx>{`
          .access-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 25px;
            background: #f5f7fb;
          }

          .access-card {
            width: min(480px, 100%);
            padding: 35px;
            text-align: center;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          }

          .access-icon {
            width: 52px;
            height: 52px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 18px;
            border-radius: 14px;
            background: #f3f4f6;
            color: #111827;
          }

          h1 {
            margin: 0;
            font-size: 22px;
            color: #111827;
          }

          p {
            margin: 12px 0 0;
            color: #6b7280;
            font-size: 14px;
            line-height: 1.7;
          }

          .access-button {
            display: inline-flex;
            margin-top: 22px;
            min-height: 42px;
            align-items: center;
            padding: 0 18px;
            border-radius: 10px;
            background: #111827;
            color: #fff;
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <AppShell
        title="Messages"
        description="Communicate directly with your customers through the B2B Client Portal."
        actions={
          <div className="header-actions">
            <button
              type="button"
              className="refresh-button"
              onClick={() => void loadPage(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "refreshing" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              type="button"
              className="new-button"
              onClick={() => setShowNewConversation(true)}
            >
              <Plus size={16} />
              New Conversation
            </button>
          </div>
        }
      >
        <div className="messages-page-content">
<section className="messenger">
            <div className="conversation-panel">
              <div className="conversation-header">
                <div>
                  <strong>
                    Conversations
                  </strong>
                  <span>
                    {conversations.length} total
                  </span>
                </div>
              </div>

              <div className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Search conversations..."
                />
              </div>

              <div className="conversation-list">
                {filteredConversations.length ===
                0 ? (
                  <div className="conversation-empty">
                    <MessageCircle size={28} />

                    <strong>
                      No conversations
                    </strong>

                    <span>
                      Start a conversation with a
                      customer.
                    </span>
                  </div>
                ) : (
                  filteredConversations.map(
                    (conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        className={`conversation-row ${
                          selectedConversationId ===
                          conversation.id
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedConversationId(
                            conversation.id,
                          )
                        }
                      >
                        <div className="conversation-avatar">
                          <User size={17} />
                        </div>

                        <div className="conversation-content">
                          <div className="conversation-title">
                            <strong>
                              {conversation.subject ||
                                "Customer conversation"}
                            </strong>

                            <span>
                              {formatDate(
                                conversation.updated_at,
                              )}
                            </span>
                          </div>

                          <div className="conversation-subtitle">
                            {conversation.status ===
                            "archived"
                              ? "Archived"
                              : "Customer conversation"}
                          </div>
                        </div>
                      </button>
                    ),
                  )
                )}
              </div>
            </div>

            <section className="chat-panel">
              {!selectedConversation ? (
                <div className="chat-empty">
                  <div className="chat-empty-icon">
                    <MessageCircle
                      size={30}
                    />
                  </div>

                  <h2>
                    Select a conversation
                  </h2>

                  <p>
                    Choose a customer conversation
                    from the left to start
                    messaging.
                  </p>
                </div>
              ) : (
                <>
                  <div className="chat-header">
                    <div className="chat-person">
                      <div className="large-avatar">
                        {initials(
                          customer?.name,
                        )}
                      </div>

                      <div>
                        <strong>
                          {customer?.name ||
                            "Customer"}
                        </strong>

                        <span>
                          {customer?.email ||
                            "Customer Portal"}
                        </span>
                      </div>
                    </div>

                    <div className="chat-header-actions">
                      <button
                        type="button"
                        title="Archive conversation"
                        onClick={() =>
                          void archiveConversation()
                        }
                      >
                        <Archive size={17} />
                      </button>

                      <button
                        type="button"
                        title="Customer"
                      >
                        <User size={17} />
                      </button>
                    </div>
                  </div>

                  <div className="conversation-subject">
                    <strong>
                      {selectedConversation.subject}
                    </strong>

                    <span>
                      Started{" "}
                      {formatDate(
                        selectedConversation.created_at,
                      )}
                    </span>
                  </div>

                  <div className="messages-area">
                    {loadingMessages ? (
                      <div className="messages-loading">
                        <div className="spinner small" />
                        Loading messages...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="messages-empty">
                        <MessageCircle
                          size={28}
                        />

                        <strong>
                          No messages yet
                        </strong>

                        <span>
                          Send the first message
                          to this customer.
                        </span>
                      </div>
                    ) : (
                      <>
                        {messages.map(
                          (message) => {
                            const isCompany =
                              message.sender_type ===
                              "company";

                            const text =
                              getMessageText(
                                message,
                              );

                            return (
                              <div
                                key={
                                  message.id
                                }
                                className={`message-line ${
                                  isCompany
                                    ? "company-message"
                                    : "client-message"
                                }`}
                              >
                                <div className="message-bubble-wrap">
                                  <div
                                    className={`message-bubble ${
                                      message.deleted_at
                                        ? "deleted"
                                        : ""
                                    }`}
                                  >
                                    {message.deleted_at ? (
                                      <em>
                                        This message
                                        was deleted.
                                      </em>
                                    ) : (
                                      <>
                                        {text && (
                                          <div className="message-text">
                                            {text}
                                          </div>
                                        )}

                                        {message.attachment_name && (
                                          <div className="attachment">
                                            <File
                                              size={
                                                17
                                              }
                                            />

                                            <span>
                                              {
                                                message.attachment_name
                                              }
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  <div className="message-meta">
                                    <span>
                                      {formatTime(
                                        message.created_at,
                                      )}
                                    </span>

                                    {isCompany && (
                                      <Check
                                        size={
                                          13
                                        }
                                      />
                                    )}

                                    <button
                                      type="button"
                                      className="message-menu-button"
                                      onClick={() =>
                                        setMenuMessageId(
                                          menuMessageId ===
                                            message.id
                                            ? null
                                            : message.id,
                                        )
                                      }
                                    >
                                      <MoreHorizontal
                                        size={
                                          15
                                        }
                                      />
                                    </button>

                                    {menuMessageId ===
                                      message.id && (
                                      <div className="message-menu">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void copyMessage(
                                              text,
                                            )
                                          }
                                        >
                                          <Copy
                                            size={
                                              14
                                            }
                                          />
                                          Copy
                                        </button>

                                        {isCompany &&
                                          !message.deleted_at && (
                                            <button
                                              type="button"
                                              className="danger"
                                              onClick={() =>
                                                void deleteMessage(
                                                  message.id,
                                                )
                                              }
                                            >
                                              <Trash2
                                                size={
                                                  14
                                                }
                                              />
                                              Delete
                                            </button>
                                          )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          },
                        )}

                        <div
                          ref={messagesEndRef}
                        />
                      </>
                    )}
                  </div>

                  {selectedFile && (
                    <div className="selected-file">
                      <File size={15} />

                      <span>
                        {selectedFile.name}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFile(null)
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <div className="composer">
                    <button
                      type="button"
                      className="attach-button"
                      title="Attach file"
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                    >
                      <Paperclip size={19} />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      onChange={
                        handleFileChange
                      }
                    />

                    <textarea
                      value={messageText}
                      onChange={(event) =>
                        setMessageText(
                          event.target.value,
                        )
                      }
                      onKeyDown={
                        handleComposerKeyDown
                      }
                      placeholder="Write a message..."
                      rows={1}
                    />

                    <button
                      type="button"
                      className="send-button"
                      disabled={
                        sending ||
                        (!messageText.trim() &&
                          !selectedFile)
                      }
                      onClick={() =>
                        void sendMessage()
                      }
                    >
                      {sending ? (
                        <div className="button-spinner" />
                      ) : (
                        <Send size={17} />
                      )}
                    </button>
                  </div>
                </>
              )}
            </section>

            <aside className="customer-panel">
              <div className="customer-panel-header">
                <strong>
                  Customer
                </strong>

                <button type="button">
                  <MoreHorizontal
                    size={17}
                  />
                </button>
              </div>

              <div className="customer-profile">
                <div className="profile-avatar">
                  {initials(
                    customer?.name,
                  )}
                </div>

                <strong>
                  {customer?.name ||
                    "Customer"}
                </strong>

                <span>
                  {customer?.email ||
                    "No email"}
                </span>
              </div>

              <div className="customer-details-panel">
                <div>
                  <span>Email</span>
                  <strong>
                    {customer?.email ||
                      "—"}
                  </strong>
                </div>

                <div>
                  <span>Phone</span>
                  <strong>
                    {customer?.phone ||
                      "—"}
                  </strong>
                </div>
              </div>

              <div className="customer-actions">
                <Link
                  href={
                    customer
                      ? `/customers/${customer.id}`
                      : "/customers"
                  }
                  className="customer-action"
                >
                  <User size={16} />
                  View Customer
                </Link>
              </div>
            </aside>
          </section>
        </div>
      </AppShell>

      {showNewConversation && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <div>
                <strong>
                  New Conversation
                </strong>

                <span>
                  Start a conversation with a
                  customer.
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowNewConversation(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <label>
                Customer

                <select
                  value={newCustomerId}
                  onChange={(event) =>
                    setNewCustomerId(
                      event.target.value,
                    )
                  }
                >
                  <option value="">
                    Select customer
                  </option>

                  {customers.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.name ||
                          item.email ||
                          "Customer"}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                Subject

                <input
                  value={newSubject}
                  onChange={(event) =>
                    setNewSubject(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. Order update"
                />
              </label>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-cancel"
                onClick={() =>
                  setShowNewConversation(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="modal-create"
                disabled={
                  creatingConversation ||
                  !newCustomerId ||
                  !newSubject.trim()
                }
                onClick={() =>
                  void createConversation()
                }
              >
                {creatingConversation
                  ? "Creating..."
                  : "Create Conversation"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .messages-page-content {
          min-width: 0;
          padding: 26px 32px 32px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .refreshing {
          animation: spin 0.8s linear infinite;
        }

        .messenger {
          height: calc(100vh - 145px);
          min-height: 600px;
          display: grid;
          grid-template-columns: 310px minmax(0, 1fr) 250px;
          overflow: hidden;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 15px;
          box-shadow: 0 8px 25px rgba(15, 23, 42, 0.04);
        }

        .conversation-panel {
          min-width: 0;
          display: flex;
          flex-direction: column;
          border-right: 1px solid #e5e7eb;
        }

        .conversation-header {
          height: 67px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 17px;
          border-bottom: 1px solid #f0f1f3;
        }

        .conversation-header strong {
          display: block;
          color: #111827;
          font-size: 14px;
        }

        .conversation-header span {
          display: block;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 10px;
        }

        .search-box {
          margin: 12px;
          height: 38px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          color: #9ca3af;
          background: #fafafa;
        }

        .search-box input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #111827;
          font-size: 12px;
        }

        .conversation-list {
          flex: 1;
          overflow-y: auto;
        }

        .conversation-row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px;
          border: 0;
          border-bottom: 1px solid #f5f5f5;
          background: #fff;
          text-align: left;
          cursor: pointer;
        }

        .conversation-row:hover {
          background: #fafafa;
        }

        .conversation-row.selected {
          background: #f3f4f6;
        }

        .conversation-avatar {
          width: 39px;
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 11px;
          background: #eef2f7;
          color: #64748b;
        }

        .conversation-content {
          min-width: 0;
          flex: 1;
        }

        .conversation-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 7px;
        }

        .conversation-title strong {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #111827;
          font-size: 12px;
        }

        .conversation-title span {
          flex: 0 0 auto;
          color: #9ca3af;
          font-size: 9px;
        }

        .conversation-subtitle {
          margin-top: 5px;
          color: #9ca3af;
          font-size: 10px;
        }

        .conversation-empty,
        .messages-empty {
          height: 230px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 20px;
          color: #9ca3af;
          text-align: center;
        }

        .conversation-empty strong,
        .messages-empty strong {
          color: #374151;
          font-size: 12px;
        }

        .conversation-empty span,
        .messages-empty span {
          max-width: 190px;
          font-size: 10px;
          line-height: 1.5;
        }

        .chat-panel {
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: #fff;
        }

        .chat-header {
          min-height: 67px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
          border-bottom: 1px solid #e5e7eb;
        }

        .chat-person {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .large-avatar {
          width: 39px;
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: #111827;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
        }

        .chat-person strong {
          display: block;
          color: #111827;
          font-size: 13px;
        }

        .chat-person span {
          display: block;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 10px;
        }

        .chat-header-actions {
          display: flex;
          gap: 5px;
        }

        .chat-header-actions button,
        .customer-panel-header button {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
        }

        .chat-header-actions button:hover,
        .customer-panel-header button:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .conversation-subject {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 11px 18px;
          background: #fafafa;
          border-bottom: 1px solid #f0f1f3;
        }

        .conversation-subject strong {
          color: #374151;
          font-size: 11px;
        }

        .conversation-subject span {
          color: #9ca3af;
          font-size: 9px;
        }

        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 20px 23px;
          background: #fafbfc;
        }

        .message-line {
          display: flex;
          margin-bottom: 12px;
        }

        .company-message {
          justify-content: flex-end;
        }

        .client-message {
          justify-content: flex-start;
        }

        .message-bubble-wrap {
          position: relative;
          max-width: min(70%, 550px);
        }

        .message-bubble {
          padding: 10px 13px;
          border-radius: 13px;
          background: #fff;
          border: 1px solid #e5e7eb;
          color: #374151;
          font-size: 12px;
          line-height: 1.6;
        }

        .company-message .message-bubble {
          background: #111827;
          border-color: #111827;
          color: #fff;
        }

        .message-bubble.deleted {
          color: #9ca3af;
          background: #f3f4f6;
          border-color: #e5e7eb;
        }

        .message-text {
          white-space: pre-wrap;
          word-break: break-word;
        }

        .attachment {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          padding: 8px 9px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.12);
        }

        .client-message .attachment {
          background: #f3f4f6;
        }

        .attachment span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 11px;
        }

        .message-meta {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 3px;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 9px;
        }

        .client-message .message-meta {
          justify-content: flex-start;
        }

        .message-menu-button {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1px;
          border: 0;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
        }

        .message-menu {
          position: absolute;
          right: 0;
          top: 19px;
          z-index: 20;
          width: 125px;
          padding: 5px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
        }

        .message-menu button {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #374151;
          font-size: 10px;
          cursor: pointer;
          text-align: left;
        }

        .message-menu button:hover {
          background: #f3f4f6;
        }

        .message-menu button.danger {
          color: #dc2626;
        }

        .composer {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid #e5e7eb;
          background: #fff;
        }

        .composer textarea {
          min-height: 39px;
          max-height: 120px;
          flex: 1;
          resize: vertical;
          padding: 11px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          outline: none;
          background: #fafafa;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
        }

        .composer textarea:focus {
          border-color: #9ca3af;
          background: #fff;
        }

        .attach-button,
        .send-button {
          width: 39px;
          height: 39px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border-radius: 10px;
          cursor: pointer;
        }

        .attach-button {
          border: 1px solid #e5e7eb;
          background: #fff;
          color: #6b7280;
        }

        .send-button {
          border: 0;
          background: #111827;
          color: #fff;
        }

        .send-button:disabled {
          opacity: 0.45;
          cursor: default;
        }

        .selected-file {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 12px;
          border-top: 1px solid #f0f1f3;
          background: #fafafa;
          color: #6b7280;
          font-size: 10px;
        }

        .selected-file span {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .selected-file button {
          display: flex;
          border: 0;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
        }

        .customer-panel {
          min-width: 0;
          border-left: 1px solid #e5e7eb;
          background: #fff;
        }

        .customer-panel-header {
          height: 67px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 15px;
          border-bottom: 1px solid #f0f1f3;
        }

        .customer-panel-header strong {
          font-size: 13px;
        }

        .customer-profile {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 25px 15px;
          text-align: center;
        }

        .profile-avatar {
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 11px;
          border-radius: 17px;
          background: #111827;
          color: #fff;
          font-size: 17px;
          font-weight: 800;
        }

        .customer-profile strong {
          color: #111827;
          font-size: 14px;
        }

        .customer-profile span {
          max-width: 210px;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #9ca3af;
          font-size: 10px;
        }

        .customer-details-panel {
          padding: 0 16px;
        }

        .customer-details-panel > div {
          padding: 12px 0;
          border-top: 1px solid #f0f1f3;
        }

        .customer-details-panel span {
          display: block;
          margin-bottom: 4px;
          color: #9ca3af;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 700;
        }

        .customer-details-panel strong {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #374151;
          font-size: 11px;
        }

        .customer-actions {
          padding: 15px;
        }

        .customer-action {
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          color: #374151;
          text-decoration: none;
          font-size: 11px;
          font-weight: 700;
        }

        .chat-empty {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .chat-empty-icon {
          width: 62px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
          border-radius: 17px;
          background: #f3f4f6;
          color: #6b7280;
        }

        .chat-empty h2 {
          margin: 0;
          font-size: 17px;
        }

        .chat-empty p {
          max-width: 300px;
          margin: 7px 0 0;
          color: #9ca3af;
          font-size: 12px;
          line-height: 1.6;
        }

        .messages-loading {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #9ca3af;
          font-size: 11px;
        }

        .spinner.small {
          width: 17px;
          height: 17px;
          border-width: 2px;
        }

        .button-spinner {
          width: 15px;
          height: 15px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }


        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.38);
        }

        .modal {
          width: min(460px, 100%);
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.2);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header strong {
          display: block;
          font-size: 15px;
        }

        .modal-header span {
          display: block;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 11px;
        }

        .modal-header button {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 8px;
          background: #f3f4f6;
          color: #6b7280;
          cursor: pointer;
        }

        .modal-body {
          display: flex;
          flex-direction: column;
          gap: 17px;
          padding: 20px;
        }

        .modal-body label {
          display: flex;
          flex-direction: column;
          gap: 7px;
          color: #374151;
          font-size: 11px;
          font-weight: 700;
        }

        .modal-body input,
        .modal-body select {
          height: 40px;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          outline: 0;
          background: #fff;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 15px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .modal-cancel,
        .modal-create {
          min-height: 39px;
          padding: 0 15px;
          border-radius: 9px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .modal-cancel {
          border: 1px solid #d1d5db;
          background: #fff;
          color: #374151;
        }

        .modal-create {
          border: 0;
          background: #111827;
          color: #fff;
        }

        .modal-create:disabled {
          opacity: 0.45;
          cursor: default;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1150px) {
          .messenger {
            grid-template-columns: 280px minmax(0, 1fr);
          }

          .customer-panel {
            display: none;
          }
        }

        @media (max-width: 800px) {
          .messages-page-content {
            padding: 18px;
          }

          .messenger {
            height: calc(100vh - 120px);
            min-height: 500px;
            grid-template-columns: 250px minmax(0, 1fr);
          }
        }

        @media (max-width: 620px) {
          .messages-page-content {
            padding: 12px;
          }

          .new-button {
            width: 39px;
            padding: 0;
            font-size: 0;
          }

          .new-button svg {
            margin: 0;
          }

          .messenger {
            grid-template-columns: 1fr;
          }

          .conversation-panel {
            display: none;
          }

          .message-bubble-wrap {
            max-width: 82%;
          }

          .conversation-subject span {
            display: none;
          }
        }
      `}</style>
    </>
  );
}