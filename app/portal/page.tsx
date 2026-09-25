"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileText,
  Image as ImageIcon,
  MoreVertical,
  Paperclip,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type PortalTab =
  | "dashboard"
  | "ledger"
  | "quotes"
  | "orders"
  | "invoices"
  | "documents"
  | "services"
  | "warranty"
  | "repairs"
  | "requests"
  | "messages"
  | "profile";

type PortalUser = {
  id: string;
  company_id: string;
  customer_id: string;
  role: "primary" | "billing" | "manager" | "viewer" | string;
  status: "invited" | "active" | "suspended" | "revoked" | string;
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

type PortalSettings = {
  company_id: string;
  enabled: boolean;
  portal_name: string;
  welcome_message: string | null;
  support_email: string | null;
  support_phone: string | null;
  default_currency: string;
  allow_invoice_downloads: boolean;
  allow_document_downloads: boolean;
  allow_payment_history: boolean;
  allow_quote_acceptance: boolean;
  allow_service_requests: boolean;
  allow_client_messages: boolean;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number;
  amount_paid: number;
  status: string | null;
  customer_id: string;
};

type Quote = {
  id: string;
  estimate_number: string | null;
  estimate_date: string | null;
  total: number;
  status: string | null;
  customer_id: string;
};

type Order = {
  id: string;
  order_number: string | null;
  order_date: string | null;
  total: number;
  status: string | null;
  customer_id: string;
};

type Job = {
  id: string;
  job_number: string | null;
  title: string | null;
  status: string | null;
  scheduled_date: string | null;
  customer_id: string;
};

type Warranty = {
  id: string;
  warranty_number: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  customer_id: string;
};

type Rma = {
  id: string;
  rma_number: string | null;
  status: string | null;
  reason: string | null;
  created_at: string | null;
  customer_id: string;
};

type Repair = {
  id: string;
  repair_number: string | null;
  status: string | null;
  device_description: string | null;
  created_at: string | null;
  customer_id: string;
};

type PortalRequest = {
  id: string;
  request_type: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
};

type PortalMessage = {
  id: string;
  request_id: string | null;
  sender_user_id: string | null;
  sender_type: "client" | "company";
  message: string;
  created_at: string;
};

type MessageAttachment = {
  name: string;
  mime: string;
  url: string;
};

const MESSAGE_ATTACHMENT_BUCKET = "customer-portal-attachments";
const ATTACHMENT_START = "[[SBS_ATTACHMENT]]";
const ATTACHMENT_END = "[[/SBS_ATTACHMENT]]";

function parseMessageContent(rawMessage: string) {
  const match = rawMessage.match(
    new RegExp(`${ATTACHMENT_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s\\S]*?)${ATTACHMENT_END.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`),
  );

  if (!match) {
    return { text: rawMessage, attachment: null as MessageAttachment | null };
  }

  let attachment: MessageAttachment | null = null;

  try {
    const parsed = JSON.parse(match[1]) as Partial<MessageAttachment>;
    if (parsed.name && parsed.mime && parsed.url) {
      attachment = {
        name: String(parsed.name),
        mime: String(parsed.mime),
        url: String(parsed.url),
      };
    }
  } catch {
    attachment = null;
  }

  return {
    text: rawMessage.replace(match[0], "").trim(),
    attachment,
  };
}


type PortalDocument = {
  id: string;
  document_id: string;
  can_view: boolean;
  can_download: boolean;
  expires_at: string | null;
  created_at: string;
  document: {
    id: string;
    name: string | null;
    file_name: string | null;
    storage_path: string | null;
    mime_type: string | null;
    created_at: string | null;
  } | null;
};

type CustomerLedgerEntry = {
  id: string;
  transaction_at: string | null;
  transaction_type: string | null;
  reference: string | null;
  description: string | null;
  debit: number;
  credit: number;
  amount: number;
  payment_method: string | null;
  status: string | null;
  order_id: string | null;
  invoice_id: string | null;
};

type Toast = {
  type: "success" | "error";
  message: string;
};

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));

const dateFormat = (value: string | null | undefined) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const dateTimeFormat = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const normalizeStatus = (value: string | null | undefined) =>
  String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const statusClass = (value: string | null | undefined) => {
  const status = String(value || "").toLowerCase();

  if (
    [
      "paid",
      "completed",
      "complete",
      "active",
      "resolved",
      "delivered",
      "approved",
    ].includes(status)
  ) {
    return "status status-success";
  }

  if (
    [
      "overdue",
      "cancelled",
      "canceled",
      "rejected",
      "failed",
      "revoked",
    ].includes(status)
  ) {
    return "status status-danger";
  }

  if (
    ["partial", "in_progress", "waiting_on_client", "processing"].includes(
      status,
    )
  ) {
    return "status status-warning";
  }

  return "status";
};

export default function PortalPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

const [activeTab, setActiveTab] = useState<PortalTab>(() => {
  if (typeof window === "undefined") {
    return "dashboard";
  }

  const tab = new URLSearchParams(window.location.search).get("tab");

  const validTabs: PortalTab[] = [
    "dashboard",
    "ledger",
    "quotes",
    "orders",
    "invoices",
    "documents",
    "services",
    "warranty",
    "repairs",
    "requests",
    "messages",
    "profile",
  ];

  return validTabs.includes(tab as PortalTab)
    ? (tab as PortalTab)
    : "dashboard";
});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [settings, setSettings] = useState<PortalSettings | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [rmas, setRmas] = useState<Rma[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<CustomerLedgerEntry[]>([]);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    request_type: "general",
    subject: "",
    message: "",
    priority: "normal",
  });

  const [messageForm, setMessageForm] = useState({
    request_id: "",
    message: "",
  });

  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<PortalMessage | null>(null);
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const messageFileInputRef = useRef<HTMLInputElement | null>(null);
  const messageComposerRef = useRef<HTMLTextAreaElement | null>(null);
  const notify = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });

    window.setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const loadPortal = useCallback(
    async (isRefresh = false) => {
      try {
        setLoadError(null);

        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.replace("/portal/login");
          return;
        }

        const { data: rawPortalUser, error: portalUserError } = await supabase
          .from("customer_portal_users")
          .select(
            `
              id,
              company_id,
              customer_id,
              role,
              status,
              invited_at,
              activated_at,
              last_login_at
            `,
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (portalUserError) {
          throw new Error(portalUserError.message);
        }

        if (!rawPortalUser) {
          router.replace("/portal/login");
          return;
        }

        const rawStatus = String(rawPortalUser.status || "active");
        let activatedAt = rawPortalUser.activated_at ?? null;

        // An invitation becomes an active portal account as soon as the
        // customer has authenticated successfully. This also self-heals
        // older invitations that were left in the `invited` state.
        if (rawStatus === "invited") {
          const activationTime = new Date().toISOString();

          const { error: activationError } = await supabase.rpc(
            "customer_portal_activate_my_account",
          );

          if (activationError) {
            console.warn(
              "Customer portal auto-activation failed:",
              activationError,
            );
          } else {
            activatedAt = activationTime;
          }
        }

        const normalizedPortalUser: PortalUser = {
          id: String(rawPortalUser.id),
          company_id: String(rawPortalUser.company_id),
          customer_id: String(rawPortalUser.customer_id),
          role: String(rawPortalUser.role || "viewer"),
          status: rawStatus === "invited" ? "active" : rawStatus,
          invited_at: rawPortalUser.invited_at ?? null,
          activated_at: activatedAt,
          last_login_at: rawPortalUser.last_login_at ?? null,
        };

        if (["suspended", "revoked"].includes(normalizedPortalUser.status)) {
          router.replace("/portal/login");
          return;
        }

        setPortalUser(normalizedPortalUser);

        // Keep the portal account's last-login timestamp current.
        void supabase
          .from("customer_portal_users")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", normalizedPortalUser.id)
          .eq("user_id", user.id);

        const companyId = normalizedPortalUser.company_id;
        const customerId = normalizedPortalUser.customer_id;

        const [
          settingsResponse,
          customerResponse,
          companyResponse,
          invoicesResponse,
          quotesResponse,
          ordersResponse,
          jobsResponse,
          warrantiesResponse,
          rmasResponse,
          repairsResponse,
          requestsResponse,
          messagesResponse,
          ledgerResponse,
          documentSharesResponse,
        ] = await Promise.all([
          supabase
            .from("customer_portal_settings")
            .select(
              `
                company_id,
                enabled,
                portal_name,
                welcome_message,
                support_email,
                support_phone,
                default_currency,
                allow_invoice_downloads,
                allow_document_downloads,
                allow_payment_history,
                allow_quote_acceptance,
                allow_service_requests,
                allow_client_messages
              `,
            )
            .eq("company_id", companyId)
            .maybeSingle(),

          supabase
            .from("customers")
            .select(
              `
                id,
                name,
                email,
                phone,
                address_line1,
                city,
                state,
                country
              `,
            )
            .eq("id", customerId)
            .maybeSingle(),

          supabase
            .from("companies")
            .select("name")
            .eq("id", companyId)
            .maybeSingle(),

          supabase
            .from("invoices")
            .select(
              `
                id,
                invoice_number,
                issue_date,
                due_date,
                total,
                amount_paid,
                status,
                customer_id
              `,
            )
            .eq("customer_id", customerId)
            .order("issue_date", { ascending: false }),

          supabase
            .from("estimates")
            .select(
              `
                id,
                estimate_number,
                created_at,
                total,
                status,
                customer_id
              `,
            )
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),

          supabase
             .from("orders")
            .select(
              `
                id,
                order_number,
                created_at,
                total_amount,
                status,
                customer_id
              `,
            )
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),

          supabase
            .from("jobs")
            .select(
              `
                id,
                job_number,
                title,
                status,
                scheduled_date,
                customer_id
              `,
            )
            .eq("customer_id", customerId)
            .order("scheduled_date", { ascending: false }),

          supabase
            .from("warranties")
            .select(
              `
                id,
                warranty_number,
                status,
                start_date,
                end_date,
                customer_id
              `,
            )
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),

          supabase
            .from("rmas")
            .select(
              `
                id,
                rma_number,
                status,
                reason,
                created_at,
                customer_id
              `,
            )
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),

          supabase
            .from("repairs")
            .select(
              `
                id,
                repair_number,
                status,
                created_at,
                customer_id
              `,
            )
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false }),

          supabase
            .from("customer_portal_requests")
            .select(
              `
                id,
                request_type,
                subject,
                message,
                status,
                priority,
                resolution,
                created_at,
                updated_at
              `,
            )
            .eq("customer_id", customerId)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("customer_portal_messages")
            .select(
              `
                id,
                request_id,
                sender_user_id,
                sender_type,
                message,
                created_at
              `,
            )
            .eq("customer_id", customerId)
            .order("created_at", { ascending: true }),

          supabase
            .from("customer_ledger_entries")
            .select(
              `
                transaction_at,
                transaction_type,
                reference,
                description,
                debit,
                credit,
                amount,
                payment_method,
                status,
                order_id,
                invoice_id
              `,
            )
            .eq("customer_id", customerId)
            .order("transaction_at", { ascending: false }),

          supabase
            .from("document_shares")
            .select(
              `
                id,
                document_id,
                can_view,
                can_download,
                expires_at,
                created_at
              `,
            )
            .eq("company_id", companyId)
            .eq("shared_with_customer_id", customerId)
            .eq("can_view", true)
            .order("created_at", { ascending: false }),
        ]);

        const queryErrors = [
          ["portal settings", settingsResponse.error],
          ["customer", customerResponse.error],
          ["company", companyResponse.error],
          ["invoices", invoicesResponse.error],
          ["quotes", quotesResponse.error],
          ["orders", ordersResponse.error],
          ["jobs", jobsResponse.error],
          ["warranties", warrantiesResponse.error],
          ["RMAs", rmasResponse.error],
          ["repairs", repairsResponse.error],
          ["requests", requestsResponse.error],
          ["messages", messagesResponse.error],
          ["ledger", ledgerResponse.error],
          ["documents", documentSharesResponse.error],
        ].filter(([, error]) => Boolean(error));

        if (queryErrors.length > 0) {
          console.warn(
            "Some customer portal data could not be loaded:",
            queryErrors,
          );
        }

        if (customerResponse.error) {
          throw new Error(
            `Unable to load your customer account: ${customerResponse.error.message}`,
          );
        }

        if (settingsResponse.data) {
          setSettings({
            company_id: String(settingsResponse.data.company_id),
            enabled: Boolean(settingsResponse.data.enabled),
            portal_name: String(
              settingsResponse.data.portal_name || "Client Portal",
            ),
            welcome_message:
              settingsResponse.data.welcome_message ?? null,
            support_email: settingsResponse.data.support_email ?? null,
            support_phone: settingsResponse.data.support_phone ?? null,
            default_currency: String(
              settingsResponse.data.default_currency || "USD",
            ),
            allow_invoice_downloads: Boolean(
              settingsResponse.data.allow_invoice_downloads,
            ),
            allow_document_downloads: Boolean(
              settingsResponse.data.allow_document_downloads,
            ),
            allow_payment_history: Boolean(
              settingsResponse.data.allow_payment_history,
            ),
            allow_quote_acceptance: Boolean(
              settingsResponse.data.allow_quote_acceptance,
            ),
            allow_service_requests: Boolean(
              settingsResponse.data.allow_service_requests,
            ),
            allow_client_messages: Boolean(
              settingsResponse.data.allow_client_messages,
            ),
          });
        }

        if (customerResponse.data) {
          setCustomer({
            id: String(customerResponse.data.id),
            name: customerResponse.data.name ?? null,
            email: customerResponse.data.email ?? null,
            phone: customerResponse.data.phone ?? null,
            company_name: companyResponse.data?.name ?? null,
            address: customerResponse.data.address_line1 ?? null,
            city: customerResponse.data.city ?? null,
            state: customerResponse.data.state ?? null,
            country: customerResponse.data.country ?? null,
          });
        }

        setInvoices(
          ((invoicesResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            invoice_number: row.invoice_number ?? null,
            invoice_date: row.issue_date ?? null,
            due_date: row.due_date ?? null,
            total: Number(row.total ?? row.total_amount ?? 0),
            amount_paid: Number(row.amount_paid || 0),
            status: row.status ?? null,
            customer_id: String(row.customer_id),
          })),
        );

        setQuotes(
          ((quotesResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            estimate_number: row.estimate_number ?? null,
            estimate_date: row.created_at ?? null,
            total: Number(row.total ?? row.total_amount ?? 0),
            status: row.status ?? null,
            customer_id: String(row.customer_id),
          })),
        );

        setOrders(
          ((ordersResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            order_number: row.order_number ?? null,
            order_date: row.created_at ?? null,
            total: Number(row.total ?? row.total_amount ?? 0),
            status: row.status ?? null,
            customer_id: String(row.customer_id),
          })),
        );

        setJobs(
          ((jobsResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            job_number: row.job_number ?? null,
            title: row.title ?? null,
            status: row.status ?? null,
            scheduled_date: row.scheduled_date ?? null,
            customer_id: String(row.customer_id),
          })),
        );

        setWarranties(
          ((warrantiesResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            warranty_number: row.warranty_number ?? null,
            status: row.status ?? null,
            start_date: row.start_date ?? null,
            end_date: row.end_date ?? null,
            customer_id: String(row.customer_id),
          })),
        );

        setRmas(
          ((rmasResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            rma_number: row.rma_number ?? null,
            status: row.status ?? null,
            reason: row.reason ?? null,
            created_at: row.created_at ?? null,
            customer_id: String(row.customer_id),
          })),
        );

        setRepairs(
          ((repairsResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            repair_number: row.repair_number ?? null,
            status: row.status ?? null,
            device_description: null,
            created_at: row.created_at ?? null,
            customer_id: String(row.customer_id),
          })),
        );

        setRequests(
          ((requestsResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            request_type: String(row.request_type || "general"),
            subject: String(row.subject || ""),
            message: String(row.message || ""),
            status: String(row.status || "open"),
            priority: String(row.priority || "normal"),
            resolution: row.resolution ?? null,
            created_at: String(row.created_at),
            updated_at: String(row.updated_at),
          })),
        );

        setMessages(
          ((messagesResponse.data || []) as any[]).map((row) => ({
            id: String(row.id),
            request_id: row.request_id ? String(row.request_id) : null,
            sender_user_id: row.sender_user_id ? String(row.sender_user_id) : null,
            sender_type:
              row.sender_type === "company" ? "company" : "client",
            message: String(row.message || ""),
            created_at: String(row.created_at),
          })),
        );

        setLedgerEntries(
          ((ledgerResponse.data || []) as any[]).map((row) => ({
            id: `${row.transaction_at || "transaction"}-${row.reference || "entry"}-${Math.random()}`,
            transaction_at: row.transaction_at ?? null,
            transaction_type: row.transaction_type ?? null,
            reference: row.reference ?? null,
            description: row.description ?? null,
            debit: Number(row.debit || 0),
            credit: Number(row.credit || 0),
            amount: Number(row.amount || 0),
            payment_method: row.payment_method ?? null,
            status: row.status ?? null,
            order_id: row.order_id ? String(row.order_id) : null,
            invoice_id: row.invoice_id ? String(row.invoice_id) : null,
          })),
        );

        const sharedRows = (documentSharesResponse.data || []) as any[];

        if (sharedRows.length > 0) {
          const documentIds = sharedRows
            .map((row) => row.document_id)
            .filter(Boolean);

          const { data: documentRows, error: documentError } = await supabase
            .from("documents")
            .select(
              `
                id,
                name,
                file_name,
                storage_path,
                mime_type,
                created_at
              `,
            )
            .in("id", documentIds);

          if (documentError) {
            throw new Error(documentError.message);
          }

          const documentMap = new Map<string, any>();

          (documentRows || []).forEach((row: any) => {
            documentMap.set(String(row.id), row);
          });

          const mappedDocuments: PortalDocument[] = sharedRows.map((row) => {
            const rawDocument = documentMap.get(String(row.document_id));

            return {
              id: String(row.id),
              document_id: String(row.document_id),
              can_view: Boolean(row.can_view),
              can_download: Boolean(row.can_download),
              expires_at: row.expires_at ?? null,
              created_at: String(row.created_at),
              document: rawDocument
                ? {
                    id: String(rawDocument.id),
                    name: rawDocument.name ?? null,
                    file_name: rawDocument.file_name ?? null,
                    storage_path: rawDocument.storage_path ?? null,
                    mime_type: rawDocument.mime_type ?? null,
                    created_at: rawDocument.created_at ?? null,
                  }
                : null,
            };
          });

          setDocuments(mappedDocuments);
        } else {
          setDocuments([]);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load the customer portal.";

        console.error("Customer portal load error:", error);
        setLoadError(message);
        notify("error", message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [notify, router, supabase],
  );

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadPortal();
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [loadPortal]);

  

  const updateTab = (tab: PortalTab) => {
    setActiveTab(tab);

    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/portal/login");
  };

  const handleRequestSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!portalUser || !customer) {
      notify("error", "Portal information is not available.");
      return;
    }

    if (!requestForm.subject.trim() || !requestForm.message.trim()) {
      notify("error", "Please enter a subject and message.");
      return;
    }

    try {
      setSubmittingRequest(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/portal/login");
        return;
      }

      const { error } = await supabase
        .from("customer_portal_requests")
        .insert({
          company_id: portalUser.company_id,
          customer_id: customer.id,
          user_id: user.id,
          request_type: requestForm.request_type,
          subject: requestForm.subject.trim(),
          message: requestForm.message.trim(),
          priority: requestForm.priority,
          status: "open",
        });

      if (error) {
        throw new Error(error.message);
      }

      setRequestForm({
        request_type: "general",
        subject: "",
        message: "",
        priority: "normal",
      });

      setRequestModalOpen(false);

      notify("success", "Your request has been submitted.");

      await loadPortal(true);
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to submit your request.",
      );
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleMessageSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!portalUser || !customer) {
      notify("error", "Portal information is not available.");
      return;
    }

    if (!messageForm.message.trim() && !messageAttachment) {
      notify("error", "Write a message or attach a file first.");
      return;
    }

    try {
      setSubmittingMessage(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/portal/login");
        return;
      }

      let attachmentMarker = "";

      if (messageAttachment) {
        if (messageAttachment.size > 10 * 1024 * 1024) {
          throw new Error("Attachments must be 10 MB or smaller.");
        }

        setUploadingAttachment(true);
        const safeName = messageAttachment.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${portalUser.company_id}/${customer.id}/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(MESSAGE_ATTACHMENT_BUCKET)
          .upload(path, messageAttachment, {
            cacheControl: "3600",
            upsert: false,
            contentType: messageAttachment.type || undefined,
          });

        if (uploadError) {
          throw new Error(
            `${uploadError.message}. Create the \"${MESSAGE_ATTACHMENT_BUCKET}\" Supabase Storage bucket if it does not exist.`,
          );
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(MESSAGE_ATTACHMENT_BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 7);

        if (signedError || !signedData?.signedUrl) {
          throw new Error(signedError?.message || "Could not create the attachment link.");
        }

        attachmentMarker = `${ATTACHMENT_START}${JSON.stringify({
          name: messageAttachment.name,
          mime: messageAttachment.type || "application/octet-stream",
          url: signedData.signedUrl,
        })}${ATTACHMENT_END}`;
      }

      const body = messageForm.message.trim();
      const replyPrefix = replyingTo
        ? `Replying to ${replyingTo.sender_type === "client" ? "your message" : "the account team"}\n\n`
        : "";
      const storedMessage = [attachmentMarker, replyPrefix, body].filter(Boolean).join("\n");

      const { error } = await supabase
        .from("customer_portal_messages")
        .insert({
          company_id: portalUser.company_id,
          customer_id: customer.id,
          request_id: messageForm.request_id || replyingTo?.request_id || null,
          sender_user_id: user.id,
          sender_type: "client",
          message: storedMessage,
        });

      if (error) throw new Error(error.message);

      setMessageForm((current) => ({ ...current, message: "", request_id: "" }));
      setMessageAttachment(null);
      setReplyingTo(null);
      setMessageMenuId(null);
      notify("success", "Message sent.");
      await loadPortal(true);
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to send your message.",
      );
    } finally {
      setUploadingAttachment(false);
      setSubmittingMessage(false);
    }
  };

  const handleCopyMessage = async (message: PortalMessage) => {
    try {
      const content = parseMessageContent(message.message);
      await navigator.clipboard.writeText(content.text || message.message);
      notify("success", "Message copied.");
    } catch {
      notify("error", "Could not copy this message.");
    } finally {
      setMessageMenuId(null);
    }
  };

  const handleReplyMessage = (message: PortalMessage) => {
    setReplyingTo(message);
    setMessageMenuId(null);
    updateTab("messages");
    window.setTimeout(() => messageComposerRef.current?.focus(), 0);
  };

  const handleDeleteMessage = async (message: PortalMessage) => {
    if (message.sender_type !== "client") return;
    if (!customer) return;
    if (!window.confirm("Delete this message? This cannot be undone.")) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/portal/login");
        return;
      }

      const { error } = await supabase
        .from("customer_portal_messages")
        .delete()
        .eq("id", message.id)
        .eq("customer_id", customer.id)
        .eq("sender_user_id", user.id);

      if (error) throw new Error(error.message);

      setMessages((current) => current.filter((item) => item.id !== message.id));
      setMessageMenuId(null);
      notify("success", "Message deleted.");
    } catch (error) {
      notify(
        "error",
        error instanceof Error ? error.message : "Unable to delete the message.",
      );
    }
  };

  const handleAttachmentChange = (file: File | null) => {
    if (!file) {
      setMessageAttachment(null);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify("error", "Attachments must be 10 MB or smaller.");
      return;
    }
    setMessageAttachment(file);
  };

  const downloadDocument = async (document: PortalDocument) => {
    if (!document.document?.storage_path) {
      notify("error", "This document is not available for download.");
      return;
    }

    if (!document.can_download) {
      notify("error", "Download access is disabled for this document.");
      return;
    }

    try {
      const storagePath = document.document.storage_path;

      const firstSlash = storagePath.indexOf("/");

      if (firstSlash === -1) {
        notify("error", "The document storage path is invalid.");
        return;
      }

      const bucket = storagePath.slice(0, firstSlash);
      const path = storagePath.slice(firstSlash + 1);

      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message || "Could not create download link.");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to download the document.",
      );
    }
  };

  const currency = settings?.default_currency || "USD";

  const totalInvoiced = useMemo(
    () => invoices.reduce((sum, invoice) => sum + invoice.total, 0),
    [invoices],
  );

  const totalPaid = useMemo(
    () => invoices.reduce((sum, invoice) => sum + invoice.amount_paid, 0),
    [invoices],
  );

  const totalOutstanding = Math.max(totalInvoiced - totalPaid, 0);

  const ledgerDebits = useMemo(
    () => ledgerEntries.reduce((sum, entry) => sum + entry.debit, 0),
    [ledgerEntries],
  );

  const ledgerCredits = useMemo(
    () => ledgerEntries.reduce((sum, entry) => sum + entry.credit, 0),
    [ledgerEntries],
  );

  const ledgerBalance = ledgerDebits - ledgerCredits;

  const openRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          !["resolved", "closed", "cancelled"].includes(
            request.status.toLowerCase(),
          ),
      ).length,
    [requests],
  );

  const dashboardInvoices = invoices.slice(0, 5);
  const dashboardOrders = orders.slice(0, 5);
  const dashboardRequests = requests.slice(0, 5);

  const navItems: Array<{
    id: PortalTab;
    label: string;
    icon: string;
  }> = [
    { id: "dashboard", label: "Dashboard", icon: "⌂" },
    { id: "ledger", label: "Account Ledger", icon: "▤" },
    { id: "quotes", label: "Quotes", icon: "▱" },
    { id: "orders", label: "Orders", icon: "◫" },
    { id: "invoices", label: "Invoices", icon: "▣" },
    { id: "documents", label: "Documents", icon: "□" },
    { id: "services", label: "Service Jobs", icon: "⚙" },
    { id: "warranty", label: "Warranty", icon: "✓" },
    { id: "repairs", label: "Repairs & RMA", icon: "⚒" },
    { id: "requests", label: "Requests", icon: "?" },
    { id: "messages", label: "Messages", icon: "✉" },
    { id: "profile", label: "Profile", icon: "●" },
  ];

  if (loading) {
    return (
      <>
        <div className="loading-screen">
          <div className="loading-card">
            <div className="spinner" />
            <div>
              <strong>Loading portal</strong>
              <span>Please wait while we load your business information.</span>
            </div>
          </div>
        </div>

        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f5f7fb;
          }

          .loading-card {
            display: flex;
            align-items: center;
            gap: 14px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 22px 26px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
          }

          .loading-card strong {
            display: block;
            color: #111827;
            font-size: 15px;
          }

          .loading-card span {
            display: block;
            margin-top: 4px;
            color: #6b7280;
            font-size: 13px;
          }

          .spinner {
            width: 26px;
            height: 26px;
            border: 3px solid #e5e7eb;
            border-top-color: #111827;
            border-radius: 999px;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </>
    );
  }

  if (loadError || !portalUser || !customer) {
    return (
      <>
        <div className="portal-error-screen">
          <div className="portal-error-card">
            <div className="portal-error-icon">!</div>
            <h2>We could not load your portal</h2>
            <p>
              {loadError ||
                "Your customer portal account could not be loaded. Please refresh the page or contact your administrator."}
            </p>
            <div className="portal-error-actions">
              <button
                type="button"
                onClick={() => void loadPortal()}
              >
                Try again
              </button>
              <button
                type="button"
                className="portal-error-secondary"
                onClick={() => void handleLogout()}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          .portal-error-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f5f7fb;
          }

          .portal-error-card {
            width: min(100%, 520px);
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            padding: 36px;
            text-align: center;
            box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
          }

          .portal-error-icon {
            width: 52px;
            height: 52px;
            margin: 0 auto 18px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            background: #fef2f2;
            color: #dc2626;
            font-weight: 800;
            font-size: 22px;
          }

          .portal-error-card h2 {
            margin: 0;
            color: #111827;
            font-size: 22px;
          }

          .portal-error-card p {
            margin: 10px 0 24px;
            color: #6b7280;
            font-size: 14px;
            line-height: 1.6;
          }

          .portal-error-actions {
            display: flex;
            justify-content: center;
            gap: 10px;
          }

          .portal-error-actions button {
            border: 0;
            border-radius: 10px;
            padding: 11px 16px;
            background: #111827;
            color: #fff;
            font-weight: 700;
            cursor: pointer;
          }

          .portal-error-actions .portal-error-secondary {
            background: #f3f4f6;
            color: #374151;
          }
        `}</style>
      </>
    );
  }

  return (
    <div className="portal-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">SBS</div>
          <div>
            <div className="brand-title">
              {settings?.portal_name || "Client Portal"}
            </div>
            <div className="brand-subtitle">
              Sharif Business Solutions
            </div>
          </div>
        </div>

        <div className="customer-mini">
          <div className="customer-avatar">
            {(customer.name || customer.company_name || "C")
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="customer-mini-info">
            <strong>
              {customer.name || customer.company_name || "Customer"}
            </strong>
            <span>{customer.email || "Client account"}</span>
          </div>
        </div>

        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={activeTab === item.id ? "nav-item active" : "nav-item"}
              onClick={() => updateTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>

              {item.id === "requests" && openRequests > 0 ? (
                <span className="nav-badge">{openRequests}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">CUSTOMER PORTAL</div>
            <h1>{settings?.portal_name || "Client Portal"}</h1>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadPortal(true)}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <div className="profile-chip">
              <div className="profile-avatar">
                {(customer.name || customer.company_name || "C")
                  .charAt(0)
                  .toUpperCase()}
              </div>
              <div>
                <strong>
                  {customer.name || customer.company_name || "Customer"}
                </strong>
                <span>
                  {normalizeStatus(portalUser.role)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {toast ? (
          <div
            className={
              toast.type === "success"
                ? "toast toast-success"
                : "toast toast-error"
            }
          >
            {toast.message}
          </div>
        ) : null}

        <div className="page-content">
          {activeTab === "dashboard" ? (
            <>
              <section className="welcome-card">
                <div>
                  <div className="section-kicker">WELCOME BACK</div>
                  <h2>
                    Hello,{" "}
                    {customer.name ||
                      customer.company_name ||
                      "there"}
                    .
                  </h2>
                  <p>
                    {settings?.welcome_message ||
                      "Manage your invoices, orders, documents, service requests and account activity from one place."}
                  </p>
                </div>

                <div className="welcome-actions">
                  {settings?.allow_service_requests !== false ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setRequestModalOpen(true)}
                    >
                      New Request
                    </button>
                  ) : null}

                  {settings?.allow_client_messages !== false ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => updateTab("messages")}
                    >
                      Message Us
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="stats-grid">
                <StatCard
                  title="Total Invoiced"
                  value={money(totalInvoiced, currency)}
                  subtitle={`${invoices.length} invoice${
                    invoices.length === 1 ? "" : "s"
                  }`}
                />

                <StatCard
                  title="Total Paid"
                  value={money(totalPaid, currency)}
                  subtitle="Payments recorded"
                />

                <StatCard
                  title="Outstanding"
                  value={money(totalOutstanding, currency)}
                  subtitle="Current balance"
                  danger={totalOutstanding > 0}
                />

                <StatCard
                  title="Open Requests"
                  value={String(openRequests)}
                  subtitle={`${requests.length} total request${
                    requests.length === 1 ? "" : "s"
                  }`}
                />
              </section>

              <section className="content-grid two">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Recent Invoices</h3>
                      <p>Your latest billing activity</p>
                    </div>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() => updateTab("invoices")}
                    >
                      View all
                    </button>
                  </div>

                  {dashboardInvoices.length === 0 ? (
                    <EmptyState
                      title="No invoices yet"
                      text="Invoices issued to your account will appear here."
                    />
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Invoice</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardInvoices.map((invoice) => (
                            <tr key={invoice.id}>
                              <td>
                                <strong>
                                  {invoice.invoice_number ||
                                    invoice.id.slice(0, 8)}
                                </strong>
                              </td>
                              <td>{dateFormat(invoice.invoice_date)}</td>
                              <td>
                                {money(invoice.total, currency)}
                              </td>
                              <td>
                                <span
                                  className={statusClass(invoice.status)}
                                >
                                  {normalizeStatus(invoice.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Recent Orders</h3>
                      <p>Your latest sales orders</p>
                    </div>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() => updateTab("orders")}
                    >
                      View all
                    </button>
                  </div>

                  {dashboardOrders.length === 0 ? (
                    <EmptyState
                      title="No orders yet"
                      text="Orders connected to your customer account will appear here."
                    />
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dashboardOrders.map((order) => (
                            <tr key={order.id}>
                              <td>
                                <strong>
                                  {order.order_number ||
                                    order.id.slice(0, 8)}
                                </strong>
                              </td>
                              <td>{dateFormat(order.order_date)}</td>
                              <td>
                                {money(order.total, currency)}
                              </td>
                              <td>
                                <span
                                  className={statusClass(order.status)}
                                >
                                  {normalizeStatus(order.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>

              <section className="content-grid two">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Account Snapshot</h3>
                      <p>Overview of your current activity</p>
                    </div>
                  </div>

                  <div className="snapshot-grid">
                    <SnapshotItem
                      label="Quotes"
                      value={quotes.length}
                      onClick={() => updateTab("quotes")}
                    />
                    <SnapshotItem
                      label="Orders"
                      value={orders.length}
                      onClick={() => updateTab("orders")}
                    />
                    <SnapshotItem
                      label="Documents"
                      value={documents.length}
                      onClick={() => updateTab("documents")}
                    />
                    <SnapshotItem
                      label="Service Jobs"
                      value={jobs.length}
                      onClick={() => updateTab("services")}
                    />
                    <SnapshotItem
                      label="Warranties"
                      value={warranties.length}
                      onClick={() => updateTab("warranty")}
                    />
                    <SnapshotItem
                      label="Repairs / RMA"
                      value={rmas.length + repairs.length}
                      onClick={() => updateTab("repairs")}
                    />
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3>Recent Requests</h3>
                      <p>Support and service activity</p>
                    </div>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() => updateTab("requests")}
                    >
                      View all
                    </button>
                  </div>

                  {dashboardRequests.length === 0 ? (
                    <EmptyState
                      title="No requests yet"
                      text="Your support requests will appear here."
                    />
                  ) : (
                    <div className="request-list">
                      {dashboardRequests.map((request) => (
                        <div className="request-row" key={request.id}>
                          <div className="request-main">
                            <strong>{request.subject}</strong>
                            <span>
                              {normalizeStatus(request.request_type)} ·{" "}
                              {dateFormat(request.created_at)}
                            </span>
                          </div>

                          <span className={statusClass(request.status)}>
                            {normalizeStatus(request.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "ledger" ? (
            <section className="card">
              <SectionHeader
                title="Account Ledger"
                subtitle="Your complete account activity from the shared customer ledger."
              />

              <div className="ledger-summary">
                <div>
                  <span>Total Debits</span>
                  <strong>{money(ledgerDebits, currency)}</strong>
                </div>

                <div>
                  <span>Total Credits</span>
                  <strong>{money(ledgerCredits, currency)}</strong>
                </div>

                <div>
                  <span>Ledger Balance</span>
                  <strong
                    className={ledgerBalance > 0 ? "text-danger" : ""}
                  >
                    {money(ledgerBalance, currency)}
                  </strong>
                </div>

                <div>
                  <span>Invoice Outstanding</span>
                  <strong
                    className={
                      totalOutstanding > 0 ? "text-danger" : ""
                    }
                  >
                    {money(totalOutstanding, currency)}
                  </strong>
                </div>
              </div>

              <div className="table-wrap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Reference</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {ledgerEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{dateFormat(entry.transaction_at)}</td>
                        <td>
                          <span className="ledger-type">
                            {normalizeStatus(entry.transaction_type)}
                          </span>
                        </td>
                        <td>
                          <strong>
                            {entry.description || "Account transaction"}
                          </strong>
                          {entry.payment_method ? (
                            <span className="table-subtext">
                              {normalizeStatus(entry.payment_method)}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          {entry.reference ||
                            entry.invoice_id ||
                            entry.order_id ||
                            "—"}
                        </td>
                        <td>
                          {entry.debit > 0
                            ? money(entry.debit, currency)
                            : "—"}
                        </td>
                        <td>
                          {entry.credit > 0
                            ? money(entry.credit, currency)
                            : "—"}
                        </td>
                        <td>
                          <span className={statusClass(entry.status)}>
                            {normalizeStatus(entry.status)}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState
                            title="No ledger activity"
                            text="Account transactions will appear here once activity is recorded."
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {activeTab === "quotes" ? (
            <section className="card">
              <SectionHeader
                title="Quotes"
                subtitle="Review quotations and estimates issued to your account."
              />

              <DataTable
                headers={[
                  "Quote",
                  "Date",
                  "Total",
                  "Status",
                ]}
                emptyTitle="No quotes"
                emptyText="Quotes and estimates will appear here."
              >
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <strong>
                        {quote.estimate_number ||
                          quote.id.slice(0, 8)}
                      </strong>
                    </td>
                    <td>{dateFormat(quote.estimate_date)}</td>
                    <td>{money(quote.total, currency)}</td>
                    <td>
                      <span className={statusClass(quote.status)}>
                        {normalizeStatus(quote.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </section>
          ) : null}

          {activeTab === "orders" ? (
            <section className="card">
              <SectionHeader
                title="Orders"
                subtitle="Review your sales orders and order status."
              />

              <DataTable
                headers={[
                  "Order",
                  "Date",
                  "Total",
                  "Status",
                ]}
                emptyTitle="No orders"
                emptyText="Sales orders associated with your account will appear here."
              >
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>
                        {order.order_number ||
                          order.id.slice(0, 8)}
                      </strong>
                    </td>
                    <td>{dateFormat(order.order_date)}</td>
                    <td>{money(order.total, currency)}</td>
                    <td>
                      <span className={statusClass(order.status)}>
                        {normalizeStatus(order.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </section>
          ) : null}

          {activeTab === "invoices" ? (
            <section className="card">
              <SectionHeader
                title="Invoices"
                subtitle="View invoices and payment status."
              />

              <DataTable
                headers={[
                  "Invoice",
                  "Invoice Date",
                  "Due Date",
                  "Total",
                  "Paid",
                  "Balance",
                  "Status",
                ]}
                emptyTitle="No invoices"
                emptyText="Your invoices will appear here."
              >
                {invoices.map((invoice) => {
                  const balance = Math.max(
                    invoice.total - invoice.amount_paid,
                    0,
                  );

                  return (
                    <tr key={invoice.id}>
                      <td>
                        <strong>
                          {invoice.invoice_number ||
                            invoice.id.slice(0, 8)}
                        </strong>
                      </td>
                      <td>{dateFormat(invoice.invoice_date)}</td>
                      <td>{dateFormat(invoice.due_date)}</td>
                      <td>{money(invoice.total, currency)}</td>
                      <td>
                        {settings?.allow_payment_history
                          ? money(invoice.amount_paid, currency)
                          : "—"}
                      </td>
                      <td>{money(balance, currency)}</td>
                      <td>
                        <span className={statusClass(invoice.status)}>
                          {normalizeStatus(invoice.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            </section>
          ) : null}

          {activeTab === "documents" ? (
            <section className="card">
              <SectionHeader
                title="Documents"
                subtitle="Documents your company has shared with you."
              />

              {documents.length === 0 ? (
                <EmptyState
                  title="No shared documents"
                  text="Documents shared by your account manager will appear here."
                />
              ) : (
                <div className="document-grid">
                  {documents.map((item) => {
                    const doc = item.document;

                    return (
                      <div className="document-card" key={item.id}>
                        <div className="document-icon">□</div>

                        <div className="document-info">
                          <strong>
                            {doc?.name ||
                              doc?.file_name ||
                              "Shared document"}
                          </strong>

                          <span>
                            {doc?.mime_type || "Document"} ·{" "}
                            {dateFormat(item.created_at)}
                          </span>

                          {item.expires_at ? (
                            <small>
                              Access expires{" "}
                              {dateFormat(item.expires_at)}
                            </small>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            void downloadDocument(item)
                          }
                          disabled={!item.can_download}
                        >
                          {item.can_download
                            ? "Download"
                            : "View only"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "services" ? (
            <section className="card">
              <SectionHeader
                title="Service Jobs"
                subtitle="Track service and field work associated with your account."
              />

              <DataTable
                headers={[
                  "Job",
                  "Title",
                  "Scheduled",
                  "Status",
                ]}
                emptyTitle="No service jobs"
                emptyText="Service jobs connected to your account will appear here."
              >
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>
                        {job.job_number ||
                          job.id.slice(0, 8)}
                      </strong>
                    </td>
                    <td>{job.title || "Service Job"}</td>
                    <td>{dateFormat(job.scheduled_date)}</td>
                    <td>
                      <span className={statusClass(job.status)}>
                        {normalizeStatus(job.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </section>
          ) : null}

          {activeTab === "warranty" ? (
            <section className="card">
              <SectionHeader
                title="Warranty"
                subtitle="View your warranty coverage and status."
              />

              <DataTable
                headers={[
                  "Warranty",
                  "Start Date",
                  "End Date",
                  "Status",
                ]}
                emptyTitle="No warranty records"
                emptyText="Warranty information associated with your account will appear here."
              >
                {warranties.map((warranty) => (
                  <tr key={warranty.id}>
                    <td>
                      <strong>
                        {warranty.warranty_number ||
                          warranty.id.slice(0, 8)}
                      </strong>
                    </td>
                    <td>{dateFormat(warranty.start_date)}</td>
                    <td>{dateFormat(warranty.end_date)}</td>
                    <td>
                      <span className={statusClass(warranty.status)}>
                        {normalizeStatus(warranty.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </section>
          ) : null}

          {activeTab === "repairs" ? (
            <div className="content-grid two">
              <section className="card">
                <SectionHeader
                  title="RMA"
                  subtitle="Return merchandise authorizations associated with your account."
                />

                {rmas.length === 0 ? (
                  <EmptyState
                    title="No RMA records"
                    text="Your RMA records will appear here."
                  />
                ) : (
                  <div className="simple-list">
                    {rmas.map((rma) => (
                      <div className="simple-row" key={rma.id}>
                        <div>
                          <strong>
                            {rma.rma_number ||
                              rma.id.slice(0, 8)}
                          </strong>
                          <span>
                            {rma.reason || "Return request"} ·{" "}
                            {dateFormat(rma.created_at)}
                          </span>
                        </div>

                        <span className={statusClass(rma.status)}>
                          {normalizeStatus(rma.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="card">
                <SectionHeader
                  title="Repairs"
                  subtitle="Track repairs and service work for your products."
                />

                {repairs.length === 0 ? (
                  <EmptyState
                    title="No repair records"
                    text="Repair activity will appear here."
                  />
                ) : (
                  <div className="simple-list">
                    {repairs.map((repair) => (
                      <div
                        className="simple-row"
                        key={repair.id}
                      >
                        <div>
                          <strong>
                            {repair.repair_number ||
                              repair.id.slice(0, 8)}
                          </strong>
                          <span>
                            {repair.device_description ||
                              "Repair job"}{" "}
                            · {dateFormat(repair.created_at)}
                          </span>
                        </div>

                        <span className={statusClass(repair.status)}>
                          {normalizeStatus(repair.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {activeTab === "requests" ? (
            <section className="card">
              <div className="card-header">
                <div>
                  <h3>Support & Service Requests</h3>
                  <p>
                    Submit requests and track their progress.
                  </p>
                </div>

                {settings?.allow_service_requests !== false ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setRequestModalOpen(true)}
                  >
                    New Request
                  </button>
                ) : null}
              </div>

              {requests.length === 0 ? (
                <EmptyState
                  title="No requests"
                  text="Create a request whenever you need help from the business."
                />
              ) : (
                <div className="request-list large">
                  {requests.map((request) => (
                    <div
                      className="request-card"
                      key={request.id}
                    >
                      <div className="request-card-top">
                        <div>
                          <div className="request-meta">
                            {normalizeStatus(request.request_type)} ·{" "}
                            {dateFormat(request.created_at)}
                          </div>
                          <h4>{request.subject}</h4>
                        </div>

                        <div className="request-badges">
                          <span className={statusClass(request.priority)}>
                            {normalizeStatus(request.priority)}
                          </span>
                          <span className={statusClass(request.status)}>
                            {normalizeStatus(request.status)}
                          </span>
                        </div>
                      </div>

                      <p>{request.message}</p>

                      {request.resolution ? (
                        <div className="resolution">
                          <strong>Resolution</strong>
                          <span>{request.resolution}</span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "messages" ? (
            <section className="messenger-card">
              <div className="messenger-header">
                <div className="messenger-heading">
                  <div className="messenger-avatar">
                    {(customer.company_name || customer.name || "A").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="messenger-title-row">
                      <h3>Messages</h3>
                    </div>
                    <p>Direct conversation with your account team{customer.company_name ? ` · ${customer.company_name}` : ""}</p>
                  </div>
                </div>
                <span className="secure-label">Secure business conversation</span>
              </div>

              <div className="conversation-area">
                {messages.length === 0 ? (
                  <div className="conversation-empty">
                    <div className="conversation-empty-icon"><Send size={20} /></div>
                    <strong>Start a conversation</strong>
                    <span>Send a message to your account team. You can also attach documents, images, invoices, or other files.</span>
                  </div>
                ) : (
                  <div className="message-thread">
                    <div className="thread-day"><span>Conversation</span></div>
                    {messages.map((message) => {
                      const parsed = parseMessageContent(message.message);
                      const isClient = message.sender_type === "client";
                      return (
                        <div key={message.id} className={isClient ? "messenger-message-row client" : "messenger-message-row company"}>
                          {!isClient ? <div className="thread-avatar">{(customer.company_name || "A").charAt(0).toUpperCase()}</div> : null}
                          <div className="message-stack">
                            <div className="message-meta-line">
                              <span>{isClient ? "You" : "Account Team"}</span>
                              <span>{dateTimeFormat(message.created_at)}</span>
                            </div>
                            <div className="message-bubble-wrap">
                              <div className="messenger-bubble">
                                {parsed.attachment ? (
                                  <a href={parsed.attachment.url} target="_blank" rel="noreferrer" className="attachment-card">
                                    <span className="attachment-icon">{parsed.attachment.mime.startsWith("image/") ? <ImageIcon size={17} /> : <FileText size={17} />}</span>
                                    <span className="attachment-copy"><strong>{parsed.attachment.name}</strong><small>{parsed.attachment.mime || "Attachment"}</small></span>
                                    <span className="attachment-open">Open</span>
                                  </a>
                                ) : null}
                                {parsed.text ? <p>{parsed.text}</p> : null}
                              </div>
                              <div className="message-menu-wrap">
                                <button type="button" className="message-menu-button" aria-label="Message actions" onClick={() => setMessageMenuId((current) => current === message.id ? null : message.id)}><MoreVertical size={16} /></button>
                                {messageMenuId === message.id ? (
                                  <div className="message-menu">
                                    <button type="button" onClick={() => void handleCopyMessage(message)}><Copy size={14} />Copy</button>
                                    <button type="button" onClick={() => handleReplyMessage(message)}><Reply size={14} />Reply</button>
                                    {isClient ? <button type="button" className="danger-menu-item" onClick={() => void handleDeleteMessage(message)}><Trash2 size={14} />Delete</button> : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {settings?.allow_client_messages !== false ? (
                <div className="composer-shell">
                  {replyingTo ? (
                    <div className="reply-banner">
                      <div>
                        <span>Replying to {replyingTo.sender_type === "client" ? "your message" : "the account team"}</span>
                        <strong>{parseMessageContent(replyingTo.message).text.slice(0, 120) || "Attachment"}</strong>
                      </div>
                      <button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><X size={16} /></button>
                    </div>
                  ) : null}

                  {messageAttachment ? (
                    <div className="attachment-preview">
                      <div className="attachment-preview-icon">{messageAttachment.type.startsWith("image/") ? <ImageIcon size={17} /> : <FileText size={17} />}</div>
                      <div><strong>{messageAttachment.name}</strong><span>{(messageAttachment.size / 1024 / 1024).toFixed(2)} MB</span></div>
                      <button type="button" onClick={() => setMessageAttachment(null)} aria-label="Remove attachment"><X size={15} /></button>
                    </div>
                  ) : null}

                  <form className="messenger-composer" onSubmit={handleMessageSubmit}>
                    <input ref={messageFileInputRef} type="file" hidden onChange={(event) => { handleAttachmentChange(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
                    <button type="button" className="composer-icon-button" onClick={() => messageFileInputRef.current?.click()} disabled={submittingMessage || uploadingAttachment} aria-label="Attach a file"><Paperclip size={19} /></button>
                    <textarea
                      ref={messageComposerRef}
                      value={messageForm.message}
                      onChange={(event) => setMessageForm((current) => ({ ...current, message: event.target.value }))}
                      onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                      placeholder="Write a message..."
                      rows={1}
                      disabled={submittingMessage}
                    />
                    <button type="submit" className="send-message-button" disabled={submittingMessage || uploadingAttachment || (!messageForm.message.trim() && !messageAttachment)}>
                      {submittingMessage ? <span className="send-spinner" /> : <Send size={17} />}
                      <span>{uploadingAttachment ? "Uploading..." : submittingMessage ? "Sending..." : "Send"}</span>
                    </button>
                  </form>
                  <div className="composer-hint"><span>Press Enter to send · Shift + Enter for a new line</span><span>Max attachment size: 10 MB</span></div>
                </div>
              ) : (
                <div className="messaging-disabled">Messaging is currently disabled for this customer portal.</div>
              )}
            </section>
          ) : null}

          {activeTab === "profile" ? (
            <section className="content-grid two">
              <div className="card">
                <SectionHeader
                  title="Customer Profile"
                  subtitle="Your customer information stored in SBS."
                />

                <div className="profile-details">
                  <ProfileField
                    label="Name"
                    value={customer.name}
                  />
                  <ProfileField
                    label="Company"
                    value={customer.company_name}
                  />
                  <ProfileField
                    label="Email"
                    value={customer.email}
                  />
                  <ProfileField
                    label="Phone"
                    value={customer.phone}
                  />
                  <ProfileField
                    label="Address"
                    value={customer.address}
                  />
                  <ProfileField
                    label="City"
                    value={customer.city}
                  />
                  <ProfileField
                    label="State"
                    value={customer.state}
                  />
                  <ProfileField
                    label="Country"
                    value={customer.country}
                  />
                </div>
              </div>

              <div className="card">
                <SectionHeader
                  title="Portal Account"
                  subtitle="Access and permissions for your portal account."
                />

                <div className="portal-account">
                  <div className="account-row">
                    <span>Role</span>
                    <strong>
                      {normalizeStatus(portalUser.role)}
                    </strong>
                  </div>

                  <div className="account-row">
                    <span>Status</span>
                    <span className={statusClass(portalUser.status)}>
                      {normalizeStatus(portalUser.status)}
                    </span>
                  </div>

                  <div className="account-row">
                    <span>Invited</span>
                    <strong>
                      {dateFormat(portalUser.invited_at)}
                    </strong>
                  </div>

                  <div className="account-row">
                    <span>Activated</span>
                    <strong>
                      {dateFormat(portalUser.activated_at)}
                    </strong>
                  </div>

                  <div className="account-row">
                    <span>Last Login</span>
                    <strong>
                      {dateFormat(portalUser.last_login_at)}
                    </strong>
                  </div>
                </div>

                <div className="permissions-box">
                  <h4>Portal Features</h4>

                  <PermissionRow
                    label="Invoice downloads"
                    enabled={
                      settings?.allow_invoice_downloads === true
                    }
                  />

                  <PermissionRow
                    label="Document downloads"
                    enabled={
                      settings?.allow_document_downloads === true
                    }
                  />

                  <PermissionRow
                    label="Payment history"
                    enabled={
                      settings?.allow_payment_history === true
                    }
                  />

                  <PermissionRow
                    label="Quote acceptance"
                    enabled={
                      settings?.allow_quote_acceptance === true
                    }
                  />

                  <PermissionRow
                    label="Service requests"
                    enabled={
                      settings?.allow_service_requests === true
                    }
                  />

                  <PermissionRow
                    label="Client messages"
                    enabled={
                      settings?.allow_client_messages === true
                    }
                  />
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </main>

      {requestModalOpen ? (
        <div
          className="modal-overlay"
          onMouseDown={() => setRequestModalOpen(false)}
        >
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3>New Request</h3>
                <p>Send a request to your account team.</p>
              </div>

              <button
                type="button"
                className="close-button"
                onClick={() => setRequestModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              className="form"
              onSubmit={handleRequestSubmit}
            >
              <div className="form-grid">
                <div className="field">
                  <label>Request Type</label>
                  <select
                    value={requestForm.request_type}
                    onChange={(event) =>
                      setRequestForm((current) => ({
                        ...current,
                        request_type: event.target.value,
                      }))
                    }
                  >
                    <option value="general">General</option>
                    <option value="invoice">Invoice</option>
                    <option value="quote">Quote</option>
                    <option value="order">Order</option>
                    <option value="payment">Payment</option>
                    <option value="service">Service</option>
                    <option value="warranty">Warranty</option>
                    <option value="rma">RMA</option>
                    <option value="document">Document</option>
                    <option value="support">Support</option>
                  </select>
                </div>

                <div className="field">
                  <label>Priority</label>
                  <select
                    value={requestForm.priority}
                    onChange={(event) =>
                      setRequestForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Subject</label>
                <input
                  value={requestForm.subject}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      subject: event.target.value,
                    }))
                  }
                  placeholder="What do you need help with?"
                />
              </div>

              <div className="field">
                <label>Message</label>
                <textarea
                  value={requestForm.message}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      message: event.target.value,
                    }))
                  }
                  placeholder="Describe your request..."
                  rows={6}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setRequestModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={submittingRequest}
                >
                  {submittingRequest
                    ? "Submitting..."
                    : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        .portal-app {
          min-height: 100vh;
          display: flex;
          background: #f5f7fb;
          color: #111827;
        }

        .sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 270px;
          background: #ffffff;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          z-index: 20;
        }

        .brand {
          min-height: 84px;
          padding: 20px 20px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #f0f1f3;
        }

        .brand-mark {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #111827;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .brand-title {
          font-size: 15px;
          font-weight: 750;
          color: #111827;
        }

        .brand-subtitle {
          margin-top: 3px;
          font-size: 11px;
          color: #9ca3af;
        }

        .customer-mini {
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 11px;
          border-bottom: 1px solid #f0f1f3;
        }

        .customer-avatar,
        .profile-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #eef2f7;
          color: #111827;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .customer-mini-info {
          min-width: 0;
        }

        .customer-mini-info strong {
          display: block;
          font-size: 13px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .customer-mini-info span {
          display: block;
          margin-top: 3px;
          font-size: 11px;
          color: #9ca3af;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav {
          padding: 14px 12px;
          overflow-y: auto;
        }

        .nav-item {
          width: 100%;
          height: 42px;
          border: 0;
          background: transparent;
          color: #6b7280;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 12px;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          margin-bottom: 3px;
        }

        .nav-item:hover {
          background: #f8fafc;
          color: #111827;
        }

        .nav-item.active {
          background: #111827;
          color: #ffffff;
        }

        .nav-icon {
          width: 20px;
          text-align: center;
          font-size: 14px;
          opacity: 0.9;
        }

        .nav-badge {
          margin-left: auto;
          min-width: 21px;
          height: 21px;
          padding: 0 6px;
          border-radius: 999px;
          background: #ef4444;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
        }

        .sidebar-footer {
          margin-top: auto;
          padding: 14px 12px 18px;
          border-top: 1px solid #f0f1f3;
        }

        .logout-button {
          width: 100%;
          height: 40px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          color: #4b5563;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 12px;
          font-size: 13px;
        }

        .logout-button:hover {
          background: #f9fafb;
          color: #111827;
        }

        .main {
          margin-left: 270px;
          width: calc(100% - 270px);
          min-height: 100vh;
        }

        .topbar {
          min-height: 84px;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          padding: 0 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .eyebrow,
        .section-kicker {
          color: #9ca3af;
          font-size: 10px;
          letter-spacing: 0.12em;
          font-weight: 800;
        }

        .topbar h1 {
          margin: 5px 0 0;
          font-size: 20px;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .profile-chip {
          height: 44px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 4px 0 9px;
        }

        .profile-chip strong {
          display: block;
          font-size: 12px;
        }

        .profile-chip span {
          display: block;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 10px;
        }

        .page-content {
          padding: 28px;
          max-width: 1600px;
          margin: 0 auto;
        }

        .welcome-card {
          background: #111827;
          color: #ffffff;
          border-radius: 16px;
          padding: 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }

        .welcome-card h2 {
          margin: 8px 0 8px;
          font-size: 25px;
          letter-spacing: -0.03em;
        }

        .welcome-card p {
          margin: 0;
          max-width: 720px;
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.7;
        }

        .welcome-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 19px;
          box-shadow: 0 2px 7px rgba(15, 23, 42, 0.025);
        }

        .stat-label {
          color: #6b7280;
          font-size: 12px;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 23px;
          font-weight: 750;
          letter-spacing: -0.03em;
        }

        .stat-subtitle {
          margin-top: 6px;
          color: #9ca3af;
          font-size: 11px;
        }

        .content-grid {
          display: grid;
          gap: 18px;
          margin-bottom: 18px;
        }

        .content-grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 2px 7px rgba(15, 23, 42, 0.025);
          min-width: 0;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .card-header h3 {
          margin: 0;
          font-size: 16px;
          letter-spacing: -0.01em;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #9ca3af;
          font-size: 12px;
          line-height: 1.5;
        }

        .section-header {
          margin-bottom: 18px;
        }

        .section-header h3 {
          margin: 0;
          font-size: 18px;
          letter-spacing: -0.02em;
        }

        .section-header p {
          margin: 5px 0 0;
          color: #9ca3af;
          font-size: 12px;
        }

        .primary-button,
        .secondary-button,
        .text-button {
          border-radius: 8px;
          height: 38px;
          padding: 0 13px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .primary-button:hover {
          background: #1f2937;
        }

        .secondary-button {
          border: 1px solid #e5e7eb;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .text-button {
          border: 0;
          background: transparent;
          color: #111827;
          padding: 0;
          height: auto;
        }

        .text-button:hover {
          text-decoration: underline;
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 650px;
        }

        th {
          text-align: left;
          padding: 11px 12px;
          border-bottom: 1px solid #e5e7eb;
          color: #9ca3af;
          font-size: 10px;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          white-space: nowrap;
        }

        td {
          padding: 13px 12px;
          border-bottom: 1px solid #f0f1f3;
          color: #4b5563;
          font-size: 12px;
          vertical-align: middle;
        }

        td strong {
          color: #111827;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        .status {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 0 8px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 10px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .status-success {
          background: #ecfdf3;
          color: #15803d;
        }

        .status-warning {
          background: #fff7ed;
          color: #c2410c;
        }

        .status-danger {
          background: #fef2f2;
          color: #dc2626;
        }

        .snapshot-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .snapshot-item {
          border: 1px solid #eef0f3;
          border-radius: 10px;
          padding: 14px;
          background: #fbfcfe;
          cursor: pointer;
          text-align: left;
        }

        .snapshot-item:hover {
          border-color: #dfe3e8;
          background: #ffffff;
        }

        .snapshot-item span {
          display: block;
          color: #6b7280;
          font-size: 11px;
        }

        .snapshot-item strong {
          display: block;
          margin-top: 6px;
          font-size: 20px;
          color: #111827;
        }

        .request-list {
          display: flex;
          flex-direction: column;
        }

        .request-list.large {
          gap: 12px;
        }

        .request-row,
        .simple-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 13px 0;
          border-bottom: 1px solid #f0f1f3;
        }

        .request-row:last-child,
        .simple-row:last-child {
          border-bottom: 0;
        }

        .request-main strong,
        .simple-row strong {
          display: block;
          color: #111827;
          font-size: 13px;
        }

        .request-main span,
        .simple-row span {
          display: block;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 11px;
        }

        .request-card {
          border: 1px solid #e7e9ed;
          border-radius: 12px;
          padding: 17px;
        }

        .request-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .request-meta {
          color: #9ca3af;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .request-card h4 {
          margin: 7px 0 0;
          font-size: 14px;
        }

        .request-card p {
          margin: 13px 0 0;
          color: #4b5563;
          font-size: 12px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .request-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .resolution {
          margin-top: 13px;
          padding: 12px;
          border-radius: 9px;
          background: #f8fafc;
        }

        .resolution strong,
        .resolution span {
          display: block;
        }

        .resolution strong {
          color: #374151;
          font-size: 11px;
        }

        .resolution span {
          margin-top: 4px;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.5;
        }

        .simple-list {
          display: flex;
          flex-direction: column;
        }

        .document-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .document-card {
          border: 1px solid #e7e9ed;
          border-radius: 11px;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .document-icon {
          width: 38px;
          height: 42px;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #6b7280;
        }

        .document-info {
          min-width: 0;
          flex: 1;
        }

        .document-info strong {
          display: block;
          color: #111827;
          font-size: 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .document-info span {
          display: block;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 10px;
        }

        .document-info small {
          display: block;
          margin-top: 4px;
          color: #c2410c;
          font-size: 10px;
        }

        .ledger-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 22px;
        }

        .ledger-summary > div {
          border: 1px solid #e9ebef;
          border-radius: 10px;
          background: #fbfcfe;
          padding: 14px;
        }

        .ledger-summary span {
          display: block;
          color: #9ca3af;
          font-size: 11px;
        }

        .ledger-summary strong {
          display: block;
          margin-top: 7px;
          color: #111827;
          font-size: 18px;
        }

        .ledger-type {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 8px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #374151;
          font-size: 10px;
          font-weight: 700;
        }

        .table-subtext {
          display: block;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 10px;
        }

        .text-danger {
          color: #dc2626 !important;
        }

        .empty-state {
          padding: 38px 20px;
          text-align: center;
          border: 1px dashed #e1e4e8;
          border-radius: 10px;
          background: #fbfcfe;
        }

        .empty-state strong {
          display: block;
          color: #374151;
          font-size: 13px;
        }

        .empty-state span {
          display: block;
          margin-top: 5px;
          color: #9ca3af;
          font-size: 11px;
          line-height: 1.5;
        }

        .profile-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .profile-field {
          padding: 13px;
          border: 1px solid #edf0f3;
          border-radius: 9px;
          background: #fbfcfe;
        }

        .profile-field span {
          display: block;
          color: #9ca3af;
          font-size: 10px;
        }

        .profile-field strong {
          display: block;
          margin-top: 5px;
          color: #111827;
          font-size: 12px;
          word-break: break-word;
        }

        .portal-account {
          border: 1px solid #edf0f3;
          border-radius: 10px;
          overflow: hidden;
        }

        .account-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 14px;
          border-bottom: 1px solid #edf0f3;
        }

        .account-row:last-child {
          border-bottom: 0;
        }

        .account-row span:first-child {
          color: #9ca3af;
          font-size: 11px;
        }

        .account-row strong {
          color: #111827;
          font-size: 12px;
          text-align: right;
        }

        .permissions-box {
          margin-top: 18px;
          border: 1px solid #edf0f3;
          border-radius: 10px;
          padding: 15px;
        }

        .permissions-box h4 {
          margin: 0 0 10px;
          font-size: 13px;
        }

        .permission-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #f1f2f4;
        }

        .permission-row:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .permission-row span {
          color: #4b5563;
          font-size: 11px;
        }

        .permission-state {
          min-width: 62px;
          text-align: center;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 800;
        }

        .permission-on {
          background: #ecfdf3;
          color: #15803d;
        }

        .permission-off {
          background: #f3f4f6;
          color: #9ca3af;
        }

        .messenger-card { display: flex; flex-direction: column; height: calc(100vh - 140px); min-height: 620px; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(15,23,42,.025); }
        .messenger-header { min-height: 76px; display:flex; align-items:center; justify-content:space-between; gap:20px; padding:14px 20px; border-bottom:1px solid #edf0f3; }
        .messenger-heading { display:flex; align-items:center; gap:12px; min-width:0; }
        .messenger-avatar,.thread-avatar { flex:0 0 auto; display:grid; place-items:center; border-radius:50%; background:#111827; color:#fff; font-weight:750; }
        .messenger-avatar { width:42px; height:42px; font-size:13px; }
        .thread-avatar { width:30px; height:30px; font-size:10px; margin-top:21px; }
        .messenger-title-row { display:flex; align-items:center; gap:7px; }
        .messenger-title-row h3 { margin:0; font-size:15px; }
        .messenger-heading p { margin:4px 0 0; color:#9ca3af; font-size:11px; }
        .secure-label { padding:6px 9px; border-radius:999px; background:#f8fafc; color:#9ca3af; font-size:9px; font-weight:700; white-space:nowrap; }
        .conversation-area { flex:1; min-height:0; overflow-y:auto; background:#f8fafc; }
        .message-thread { max-width:980px; margin:0 auto; padding:24px 24px 30px; display:flex; flex-direction:column; gap:15px; }
        .thread-day { display:flex; align-items:center; gap:10px; color:#b0b7c3; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; margin-bottom:3px; }
        .thread-day::before,.thread-day::after { content:""; height:1px; flex:1; background:#e8ebef; }
        .messenger-message-row { display:flex; align-items:flex-start; gap:9px; }
        .messenger-message-row.client { justify-content:flex-end; }
        .message-stack { max-width:min(720px,78%); min-width:0; }
        .message-meta-line { display:flex; align-items:center; gap:8px; margin:0 3px 5px; color:#a1a8b3; font-size:9px; }
        .messenger-message-row.client .message-meta-line { justify-content:flex-end; }
        .message-bubble-wrap { display:flex; align-items:center; gap:5px; }
        .messenger-message-row.client .message-bubble-wrap { flex-direction:row-reverse; }
        .messenger-bubble { min-width:80px; padding:11px 13px; border:1px solid #e5e7eb; border-radius:14px; background:#fff; color:#374151; box-shadow:0 1px 2px rgba(15,23,42,.025); }
        .messenger-message-row.client .messenger-bubble { border-color:#111827; background:#111827; color:#fff; border-bottom-right-radius:5px; }
        .messenger-message-row.company .messenger-bubble { border-bottom-left-radius:5px; }
        .messenger-bubble p { margin:0; font-size:12px; line-height:1.65; white-space:pre-wrap; overflow-wrap:anywhere; }
        .message-menu-wrap { position:relative; flex:0 0 auto; }
        .message-menu-button { width:28px; height:28px; display:grid; place-items:center; border:0; border-radius:8px; background:transparent; color:#a1a8b3; cursor:pointer; }
        .message-menu-button:hover { background:#eef1f4; color:#374151; }
        .message-menu { position:absolute; right:0; top:32px; z-index:40; min-width:135px; padding:5px; border:1px solid #e5e7eb; border-radius:10px; background:#fff; box-shadow:0 14px 30px rgba(15,23,42,.12); }
        .message-menu button { width:100%; height:34px; display:flex; align-items:center; gap:8px; padding:0 9px; border:0; border-radius:7px; background:transparent; color:#4b5563; font-size:11px; cursor:pointer; text-align:left; }
        .message-menu button:hover { background:#f5f7fa; color:#111827; }
        .message-menu .danger-menu-item { color:#dc2626; }
        .attachment-card { display:flex; align-items:center; gap:9px; min-width:240px; max-width:390px; padding:8px; margin-bottom:8px; border:1px solid #e6e9ee; border-radius:9px; background:#f8fafc; color:inherit; text-decoration:none; }
        .messenger-message-row.client .attachment-card { border-color:rgba(255,255,255,.16); background:rgba(255,255,255,.09); }
        .attachment-icon { width:32px; height:32px; display:grid; place-items:center; flex:0 0 auto; border-radius:8px; background:#fff; color:#4b5563; }
        .attachment-copy { min-width:0; flex:1; }
        .attachment-copy strong,.attachment-copy small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .attachment-copy strong { font-size:10px; }
        .attachment-copy small { margin-top:2px; opacity:.6; font-size:9px; }
        .attachment-open { flex:0 0 auto; font-size:9px; font-weight:700; opacity:.65; }
        .conversation-empty { width:min(420px,calc(100% - 40px)); min-height:360px; margin:auto; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; }
        .conversation-empty-icon { width:48px; height:48px; display:grid; place-items:center; border-radius:14px; background:#111827; color:#fff; margin-bottom:12px; }
        .conversation-empty strong { color:#111827; font-size:14px; }
        .conversation-empty span { margin-top:6px; color:#9ca3af; font-size:11px; line-height:1.6; }
        .composer-shell { padding:12px 16px 10px; border-top:1px solid #e5e7eb; background:#fff; }
        .reply-banner { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:9px; padding:9px 11px; border:1px solid #e5e7eb; border-left:3px solid #111827; border-radius:9px; background:#f8fafc; }
        .reply-banner div { min-width:0; }
        .reply-banner span,.reply-banner strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .reply-banner span { color:#9ca3af; font-size:9px; font-weight:700; text-transform:uppercase; }
        .reply-banner strong { margin-top:3px; color:#374151; font-size:11px; }
        .reply-banner button,.attachment-preview button { width:28px; height:28px; display:grid; place-items:center; border:0; border-radius:7px; background:#eef1f4; color:#6b7280; cursor:pointer; }
        .attachment-preview { display:flex; align-items:center; gap:9px; margin-bottom:9px; padding:8px 10px; border:1px solid #e5e7eb; border-radius:9px; background:#f8fafc; }
        .attachment-preview-icon { width:30px; height:30px; display:grid; place-items:center; border-radius:7px; background:#fff; color:#4b5563; }
        .attachment-preview > div:nth-child(2) { flex:1; min-width:0; }
        .attachment-preview strong,.attachment-preview span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .attachment-preview strong { color:#374151; font-size:10px; }
        .attachment-preview span { margin-top:2px; color:#9ca3af; font-size:9px; }
        .messenger-composer { display:flex; align-items:flex-end; gap:8px; max-width:980px; margin:0 auto; padding:7px; border:1px solid #dfe3e8; border-radius:12px; background:#fff; box-shadow:0 2px 8px rgba(15,23,42,.035); }
        .composer-icon-button { width:38px; height:38px; flex:0 0 auto; display:grid; place-items:center; border:0; border-radius:9px; background:#f3f4f6; color:#4b5563; cursor:pointer; }
        .composer-icon-button:hover { background:#e9edf1; }
        .messenger-composer textarea { flex:1; min-width:0; min-height:38px; max-height:130px; padding:9px 3px; border:0; outline:none; resize:none; background:transparent; color:#111827; font-family:inherit; font-size:12px; line-height:1.5; }
        .send-message-button { min-width:76px; height:38px; display:inline-flex; align-items:center; justify-content:center; gap:7px; flex:0 0 auto; border:1px solid #111827; border-radius:9px; background:#111827; color:#fff; font-size:11px; font-weight:700; cursor:pointer; }
        .send-message-button:hover:not(:disabled) { background:#1f2937; }
        .send-message-button:disabled { opacity:.5; cursor:not-allowed; }
        .send-spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation:spin .8s linear infinite; }
        .composer-hint { max-width:980px; margin:6px auto 0; display:flex; align-items:center; justify-content:space-between; gap:10px; color:#b0b7c3; font-size:8px; }
        .messaging-disabled { padding:16px; border-top:1px solid #e5e7eb; text-align:center; color:#9ca3af; font-size:11px; }

        .toast {
          position: fixed;
          top: 92px;
          right: 25px;
          z-index: 100;
          max-width: 360px;
          padding: 12px 14px;
          border-radius: 9px;
          background: #111827;
          color: #ffffff;
          font-size: 12px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.16);
        }

        .toast-success {
          background: #166534;
        }

        .toast-error {
          background: #b91c1c;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(15, 23, 42, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal {
          width: min(620px, 100%);
          max-height: min(850px, 90vh);
          overflow-y: auto;
          background: #ffffff;
          border-radius: 14px;
          box-shadow: 0 25px 60px rgba(15, 23, 42, 0.22);
          border: 1px solid #e5e7eb;
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 19px 20px;
          border-bottom: 1px solid #edf0f3;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 17px;
        }

        .modal-header p {
          margin: 5px 0 0;
          color: #9ca3af;
          font-size: 11px;
        }

        .close-button {
          width: 32px;
          height: 32px;
          border: 0;
          border-radius: 8px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
        }

        .form {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .field {
          margin-bottom: 14px;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          color: #374151;
          font-size: 11px;
          font-weight: 700;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          border: 1px solid #dfe3e8;
          border-radius: 8px;
          background: #ffffff;
          color: #111827;
          outline: none;
          font-family: inherit;
          font-size: 12px;
        }

        .field input,
        .field select {
          height: 40px;
          padding: 0 11px;
        }

        .field textarea {
          min-height: 130px;
          padding: 10px 11px;
          resize: vertical;
          line-height: 1.5;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(156, 163, 175, 0.1);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 5px;
        }

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ledger-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .document-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .sidebar {
            width: 220px;
          }

          .main {
            margin-left: 220px;
            width: calc(100% - 220px);
          }

          .content-grid.two {
            grid-template-columns: 1fr;
          }

          .topbar {
            padding: 0 20px;
          }

          .page-content {
            padding: 20px;
          }
        }

        @media (max-width: 760px) {
          .sidebar {
            position: static;
            width: 100%;
            min-height: auto;
          }

          .portal-app {
            flex-direction: column;
          }

          .nav {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 3px;
          }

          .sidebar-footer {
            display: none;
          }

          .main {
            width: 100%;
            margin-left: 0;
          }

          .topbar {
            position: static;
            padding: 15px 18px;
            align-items: flex-start;
            flex-direction: column;
          }

          .topbar-actions {
            width: 100%;
            justify-content: space-between;
          }

          .page-content {
            padding: 16px;
          }

          .welcome-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .snapshot-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .profile-details {
            grid-template-columns: 1fr;
          }

          .ledger-summary {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .messenger-card { height: calc(100vh - 185px); min-height: 560px; }
          .messenger-header { padding:12px 14px; }
          .secure-label { display:none; }
          .message-thread { padding:18px 12px 24px; }
          .message-stack { max-width:88%; }
          .composer-shell { padding:10px; }
          .composer-hint span:last-child { display:none; }
        }

        @media (max-width: 520px) {
          .brand {
            padding: 16px;
          }

          .customer-mini {
            padding: 14px 16px;
          }

          .nav {
            padding: 10px;
          }

          .welcome-card {
            padding: 20px;
          }

          .snapshot-grid {
            grid-template-columns: 1fr 1fr;
          }

          .topbar-actions .secondary-button {
            display: none;
          }

          .profile-chip {
            padding-left: 0;
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  danger = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  danger?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">{title}</div>
      <div className={danger ? "stat-value text-danger" : "stat-value"}>
        {value}
      </div>
      <div className="stat-subtitle">{subtitle}</div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="section-header">
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );
}

function SnapshotItem({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="snapshot-item"
      onClick={onClick}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function EmptyState({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function DataTable({
  headers,
  emptyTitle,
  emptyText,
  children,
}: {
  headers: string[];
  emptyTitle: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {children || (
            <tr>
              <td colSpan={headers.length}>
                <EmptyState
                  title={emptyTitle}
                  text={emptyText}
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function PermissionRow({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <div className="permission-row">
      <span>{label}</span>

      <span
        className={
          enabled
            ? "permission-state permission-on"
            : "permission-state permission-off"
        }
      >
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}