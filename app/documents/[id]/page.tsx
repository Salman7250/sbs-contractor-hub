"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type DocumentRecord = {
  id: string;
  company_id: string;
  category_id: string | null;
  document_number: string | null;
  title: string;
  document_type: string | null;
  description: string | null;
  status: string;
  access_level: string;
  owner_type: string;
  owner_employee_id: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  issuing_authority: string | null;
  document_reference: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string | null;
  current_version: number;
  is_favorite: boolean;
  is_archived: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type Category = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  job_title: string | null;
  department: string | null;
};

type DocumentVersion = {
  id: string;
  document_id: string;
  version_number: number;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  storage_path: string;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
};

type DocumentLink = {
  id: string;
  document_id: string;
  entity_type: string;
  entity_id: string;
  label: string | null;
  created_at: string;
};

type DocumentActivity = {
  id: string;
  action: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "—";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getEmployeeName(employee: Employee | null) {
  if (!employee) return "—";

  if (employee.display_name?.trim()) {
    return employee.display_name;
  }

  const name = `${employee.first_name || ""} ${
    employee.last_name || ""
  }`.trim();

  return name || employee.email || "Unnamed employee";
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "D";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatAction(action: string) {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getFileExtension(fileName: string | null) {
  if (!fileName) return "FILE";

  const parts = fileName.split(".");
  if (parts.length < 2) return "FILE";

  return parts[parts.length - 1]
    .slice(0, 5)
    .toUpperCase();
}

function isPreviewable(mimeType: string | null) {
  if (!mimeType) return false;

  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/")
  );
}

export default function DocumentInformationPage() {
  const params = useParams();
  const router = useRouter();

  const documentId = useMemo(() => {
    const value = params?.id;

    if (Array.isArray(value)) {
      return value[0] || "";
    }

    return value || "";
  }, [params]);

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [document, setDocument] =
    useState<DocumentRecord | null>(null);

  const [category, setCategory] =
    useState<Category | null>(null);

  const [owner, setOwner] =
    useState<Employee | null>(null);

  const [versions, setVersions] =
    useState<DocumentVersion[]>([]);

  const [links, setLinks] =
    useState<DocumentLink[]>([]);

  const [activities, setActivities] =
    useState<DocumentActivity[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [working, setWorking] =
    useState(false);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [previewTitle, setPreviewTitle] =
    useState("");

  const [restoreVersion, setRestoreVersion] =
    useState<DocumentVersion | null>(null);

  const [restoreNote, setRestoreNote] =
    useState("");

  const [showArchiveConfirm, setShowArchiveConfirm] =
    useState(false);

  const [showLinkModal, setShowLinkModal] =
    useState(false);

  const [linkEntityType, setLinkEntityType] =
    useState("customer");

  const [linkSearch, setLinkSearch] =
    useState("");

  const [linkTargets, setLinkTargets] = useState<
    {
      entity_id: string;
      entity_label: string;
      entity_subtitle: string | null;
    }[]
  >([]);

  const [linkTargetsLoading, setLinkTargetsLoading] =
    useState(false);

  const [selectedLinkTarget, setSelectedLinkTarget] =
    useState<{
      entity_id: string;
      entity_label: string;
      entity_subtitle: string | null;
    } | null>(null);

  const [linkSaving, setLinkSaving] =
    useState(false);

  const [removingLinkId, setRemovingLinkId] =
    useState<string | null>(null);

  const [activeTab, setActiveTab] =
    useState<"overview" | "versions" | "activity">(
      "overview"
    );

  const loadDocument = useCallback(
    async (showRefreshing = false) => {
      if (!documentId) {
        setErrorMessage(
          "Document ID is missing."
        );
        setLoading(false);
        return;
      }

      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: authData,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!authData.user) {
          router.replace("/login");
          return;
        }

        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select("company_id")
          .eq(
            "user_id",
            authData.user.id
          )
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership was found."
          );
        }

        const companyId =
          membership.company_id;

        const {
          data: documentData,
          error: documentError,
        } = await supabase
          .from("documents")
          .select(
            `
              id,
              company_id,
              category_id,
              document_number,
              title,
              document_type,
              description,
              status,
              access_level,
              owner_type,
              owner_employee_id,
              issue_date,
              expiry_date,
              issuing_authority,
              document_reference,
              file_name,
              mime_type,
              file_size,
              storage_path,
              current_version,
              is_favorite,
              is_archived,
              created_by,
              updated_by,
              created_at,
              updated_at
            `
          )
          .eq("id", documentId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (documentError) {
          throw documentError;
        }

        if (!documentData) {
          throw new Error(
            "Document not found."
          );
        }

        const loadedDocument =
          documentData as DocumentRecord;

        const [
          categoryResult,
          ownerResult,
          versionsResult,
          linksResult,
          activityResult,
        ] = await Promise.all([
          loadedDocument.category_id
            ? supabase
                .from("document_categories")
                .select("id, name")
                .eq(
                  "id",
                  loadedDocument.category_id
                )
                .eq(
                  "company_id",
                  companyId
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          loadedDocument.owner_employee_id
            ? supabase
                .from("employees")
                .select(
                  `
                    id,
                    first_name,
                    last_name,
                    display_name,
                    email,
                    job_title,
                    department
                  `
                )
                .eq(
                  "id",
                  loadedDocument.owner_employee_id
                )
                .eq(
                  "company_id",
                  companyId
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          supabase
            .from("document_versions")
            .select(
              `
                id,
                document_id,
                version_number,
                file_name,
                mime_type,
                file_size,
                storage_path,
                change_note,
                created_by,
                created_at
              `
            )
            .eq(
              "document_id",
              documentId
            )
            .eq(
              "company_id",
              companyId
            )
            .order(
              "version_number",
              {
                ascending: false,
              }
            ),

          supabase
            .from("document_links")
            .select(
              `
                id,
                document_id,
                entity_type,
                entity_id,
                label,
                created_at
              `
            )
            .eq(
              "document_id",
              documentId
            )
            .eq(
              "company_id",
              companyId
            )
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("document_activity")
            .select(
              `
                id,
                action,
                message,
                metadata,
                created_by,
                created_at
              `
            )
            .eq(
              "document_id",
              documentId
            )
            .eq(
              "company_id",
              companyId
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(100),
        ]);

        if (categoryResult.error) {
          throw categoryResult.error;
        }

        if (ownerResult.error) {
          throw ownerResult.error;
        }

        if (versionsResult.error) {
          throw versionsResult.error;
        }

        if (linksResult.error) {
          throw linksResult.error;
        }

        if (activityResult.error) {
          throw activityResult.error;
        }

        setDocument(loadedDocument);

        setCategory(
          (categoryResult.data ||
            null) as Category | null
        );

        setOwner(
          (ownerResult.data ||
            null) as Employee | null
        );

        setVersions(
          (versionsResult.data ||
            []) as DocumentVersion[]
        );

        setLinks(
          (linksResult.data ||
            []) as DocumentLink[]
        );

        setActivities(
          (activityResult.data ||
            []) as DocumentActivity[]
        );
      } catch (error) {
        console.error(
          "Load document error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the document."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [documentId, router, supabase]
  );

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const createSignedUrl = async (
    storagePath: string,
    fileName: string | null,
    download = false
  ) => {
    const {
      data,
      error,
    } = await supabase.storage
      .from("documents")
      .createSignedUrl(
        storagePath,
        300,
        {
          download: download
            ? fileName || true
            : false,
        }
      );

    if (error) {
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error(
        "Unable to generate secure file URL."
      );
    }

    return data.signedUrl;
  };

  const handlePreview = async (
    storagePath: string | null,
    fileName: string | null,
    mimeType: string | null
  ) => {
    if (!storagePath) {
      setErrorMessage(
        "This version does not have a storage file."
      );
      return;
    }

    if (!isPreviewable(mimeType)) {
      setErrorMessage(
        "This file type cannot be previewed in the browser. Use Download instead."
      );
      return;
    }

    try {
      setWorking(true);
      setErrorMessage("");

      const url = await createSignedUrl(
        storagePath,
        fileName,
        false
      );

      setPreviewTitle(
        fileName || "Document Preview"
      );

      setPreviewUrl(url);
    } catch (error) {
      console.error(
        "Preview error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to preview the file."
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDownload = async (
    storagePath: string | null,
    fileName: string | null
  ) => {
    if (!storagePath) {
      setErrorMessage(
        "This version does not have a storage file."
      );
      return;
    }

    try {
      setWorking(true);
      setErrorMessage("");

      const url = await createSignedUrl(
        storagePath,
        fileName,
        true
      );

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(
        "Download error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to download the file."
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRestore = async () => {
    if (!document || !restoreVersion) {
      return;
    }

    try {
      setWorking(true);
      setErrorMessage("");

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("company_members")
        .select("company_id")
        .eq(
          "user_id",
          authData.user.id
        )
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (
        !membership?.company_id ||
        membership.company_id !==
          document.company_id
      ) {
        throw new Error(
          "Company access validation failed."
        );
      }

      const {
        data,
        error,
      } = await supabase.rpc(
        "restore_document_version",
        {
          p_company_id:
            document.company_id,
          p_document_id:
            document.id,
          p_version_id:
            restoreVersion.id,
          p_change_note:
            restoreNote.trim() || null,
        }
      );

      if (error) {
        throw error;
      }

      const result = Array.isArray(data)
        ? data[0]
        : data;

      const newVersion =
        result?.new_version_number ||
        document.current_version + 1;

      setRestoreVersion(null);
      setRestoreNote("");

      await loadDocument(true);

      setActiveTab("versions");

      setErrorMessage("");

      /*
       * A lightweight browser notification gives immediate
       * confirmation without adding another visual component.
       */
      window.setTimeout(() => {
        window.alert(
          `Version ${restoreVersion.version_number} was restored as version ${newVersion}.`
        );
      }, 50);
    } catch (error) {
      console.error(
        "Restore version error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to restore this document version."
      );
    } finally {
      setWorking(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!document) return;

    try {
      setWorking(true);
      setErrorMessage("");

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        router.replace("/login");
        return;
      }

      const {
        error,
      } = await supabase
        .from("documents")
        .update({
          is_archived:
            !document.is_archived,
          updated_by:
            authData.user.id,
        })
        .eq("id", document.id)
        .eq(
          "company_id",
          document.company_id
        );

      if (error) {
        throw error;
      }

      await supabase
        .from("document_activity")
        .insert({
          company_id:
            document.company_id,
          document_id: document.id,
          action: document.is_archived
            ? "restored"
            : "archived",
          message: document.is_archived
            ? "Document restored from archive."
            : "Document archived.",
          metadata: {
            previous_archived:
              document.is_archived,
          },
          created_by:
            authData.user.id,
        });

      setShowArchiveConfirm(false);

      await loadDocument(true);
    } catch (error) {
      console.error(
        "Archive toggle error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update document status."
      );
    } finally {
      setWorking(false);
    }
  };

  const linkEntityOptions = [
    { value: "customer", label: "Customer" },
    { value: "employee", label: "Employee" },
    { value: "invoice", label: "Invoice" },
    { value: "order", label: "Sales Order" },
    { value: "estimate", label: "Estimate" },
    { value: "job", label: "Job" },
    { value: "purchase_order", label: "Purchase Order" },
    { value: "supplier", label: "Supplier" },
    { value: "repair", label: "Repair" },
    { value: "warranty", label: "Warranty" },
    { value: "rma", label: "RMA" },
    { value: "service_job", label: "Service Job" },
    { value: "serialized_unit", label: "Serial Number" },
  ];

  const loadLinkTargets = useCallback(
  async (entityType: string, search: string) => {
    if (!document?.company_id) return;

    setLinkTargetsLoading(true);

    try {
      // The UI uses singular entity keys while the database RPC
      // uses plural resource names.
      const rpcEntityTypeMap: Record<string, string> = {
        customer: "customers",
        employee: "employees",
        invoice: "invoices",
        order: "orders",
        estimate: "estimates",
        job: "jobs",
        purchase_order: "purchase_orders",
        supplier: "suppliers",
        repair: "repairs",
        warranty: "warranties",
        rma: "rmas",
        service_job: "service_jobs",
        serialized_unit: "serialized_units",
      };

      const rpcEntityType =
        rpcEntityTypeMap[entityType] ?? entityType;

      const { data, error } = await supabase.rpc(
        "get_document_link_targets",
        {
          p_company_id: document.company_id,
          p_entity_type: rpcEntityType,
          p_search: search.trim() || null,
        }
      );

      if (error) throw error;

      setLinkTargets(
        (data || []) as {
          entity_id: string;
          entity_label: string;
          entity_subtitle: string | null;
        }[]
      );
    } catch (error) {
      console.error("Load link targets error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load records for linking."
      );

      setLinkTargets([]);
    } finally {
      setLinkTargetsLoading(false);
    }
  },
  [document?.company_id, supabase]
);

  useEffect(() => {
    if (!showLinkModal) return;

    const timer = window.setTimeout(() => {
      loadLinkTargets(linkEntityType, linkSearch);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    showLinkModal,
    linkEntityType,
    linkSearch,
    loadLinkTargets,
  ]);

  const openLinkModal = () => {
    setErrorMessage("");
    setSelectedLinkTarget(null);
    setLinkSearch("");
    setLinkTargets([]);
    setShowLinkModal(true);
  };

  const handleAddDocumentLink = async () => {
  if (!document || !selectedLinkTarget) return;

  try {
    setLinkSaving(true);
    setErrorMessage("");

    const rpcEntityTypeMap: Record<string, string> = {
      customer: "customers",
      employee: "employees",
      invoice: "invoices",
      order: "orders",
      estimate: "estimates",
      job: "jobs",
      purchase_order: "purchase_orders",
      supplier: "suppliers",
      repair: "repairs",
      warranty: "warranties",
      rma: "rmas",
      service_job: "service_jobs",
      serialized_unit: "serialized_units",
    };

    const rpcEntityType =
      rpcEntityTypeMap[linkEntityType] ?? linkEntityType;

    const { error } = await supabase.rpc(
      "add_document_link",
      {
        p_company_id: document.company_id,
        p_document_id: document.id,
        p_entity_type: rpcEntityType,
        p_entity_id: selectedLinkTarget.entity_id,
        p_label: selectedLinkTarget.entity_label,
      }
    );

    if (error) throw error;

    setShowLinkModal(false);
    setSelectedLinkTarget(null);
    setLinkSearch("");
    setLinkTargets([]);

    await loadDocument(true);
  } catch (error) {
    console.error("Add document link error:", error);

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Unable to link this record."
    );
  } finally {
    setLinkSaving(false);
  }
};

  const handleRemoveDocumentLink = async (link: DocumentLink) => {
    if (!document) return;

    const confirmed = window.confirm(
      `Remove the ${link.entity_type.replace(/_/g, " ")} link from this document?`
    );

    if (!confirmed) return;

    try {
      setRemovingLinkId(link.id);
      setErrorMessage("");

      const { error } = await supabase.rpc(
        "remove_document_link",
        {
          p_company_id: document.company_id,
          p_document_id: document.id,
          p_link_id: link.id,
        }
      );

      if (error) throw error;

      await loadDocument(true);
    } catch (error) {
      console.error("Remove document link error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to remove this document link."
      );
    } finally {
      setRemovingLinkId(null);
    }
  };

  const currentVersion =
    versions.find(
      (version) =>
        version.version_number ===
        document?.current_version
    ) || null;

  const getEntityPath = (
    entityType: string,
    entityId: string
  ) => {
    const routes: Record<
      string,
      string
    > = {
      customer: `/customers/${entityId}`,
      customers: `/customers/${entityId}`,
      employee: `/employees/${entityId}`,
      employees: `/employees/${entityId}`,
      supplier: `/suppliers/${entityId}`,
      suppliers: `/suppliers/${entityId}`,
      invoice: `/invoices/${entityId}`,
      invoices: `/invoices/${entityId}`,
      order: `/sales-orders/${entityId}`,
      sales_order: `/sales-orders/${entityId}`,
      purchase_order: `/purchase-orders/${entityId}`,
      job: `/jobs/${entityId}`,
      repair: `/repairs/${entityId}`,
      warranty: `/warranty/${entityId}`,
      rma: `/rma/${entityId}`,
      service_job: `/service-jobs/${entityId}`,
      serialized_unit: `/serial-numbers/${entityId}`,
      serial_number: `/serial-numbers/${entityId}`,
    };

    return routes[
      entityType.toLowerCase()
    ] || null;
  };

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="loading-card">
            <div className="spinner" />

            <div>
              <strong>
                Loading document
              </strong>

              <span>
                Preparing document information...
              </span>
            </div>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .loading-card {
              min-height: 360px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 14px;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              background: #ffffff;
              box-shadow: 0 2px 8px
                rgba(15, 23, 42, 0.04);
            }

            .loading-card > div:last-child {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }

            .loading-card strong {
              color: #111827;
              font-size: 15px;
            }

            .loading-card span {
              color: #6b7280;
              font-size: 13px;
            }

            .spinner {
              width: 23px;
              height: 23px;
              border: 2px solid #d1d5db;
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
        </main>
      </AppShell>
    );
  }

  if (!document) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="error-card">
            <div className="error-icon">
              !
            </div>

            <div>
              <h2>
                Document not found
              </h2>

              <p>
                {errorMessage ||
                  "The requested document could not be loaded."}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                router.push("/documents")
              }
            >
              Back to Documents
            </button>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .error-card {
              min-height: 280px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              gap: 14px;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              background: #ffffff;
            }

            .error-icon {
              width: 42px;
              height: 42px;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
              background: #fef2f2;
              color: #b91c1c;
              font-weight: 800;
            }

            h2 {
              margin: 0;
              color: #111827;
              font-size: 18px;
            }

            p {
              margin: 6px 0 0;
              color: #6b7280;
              font-size: 13px;
            }

            .btn {
              min-height: 38px;
              border-radius: 9px;
              border: 1px solid #d1d5db;
              padding: 0 14px;
              background: #ffffff;
              color: #111827;
              font-size: 13px;
              font-weight: 650;
              cursor: pointer;
            }

            .btn-primary {
              border-color: #111827;
              background: #111827;
              color: #ffffff;
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page-content">
        <div className="breadcrumb">
          <button
            type="button"
            onClick={() =>
              router.push("/documents")
            }
          >
            Documents
          </button>

          <span>/</span>

          <span>{document.title}</span>
        </div>

        <section className="hero">
          <div className="hero-left">
            <div className="hero-file-icon">
              {getFileExtension(
                document.file_name
              )}
            </div>

            <div className="hero-content">
              <div className="hero-topline">
                <span
                  className={`status-badge status-${document.status}`}
                >
                  {document.status}
                </span>

                {document.is_favorite && (
                  <span className="favorite-badge">
                    ★ Favorite
                  </span>
                )}

                {document.is_archived && (
                  <span className="archived-badge">
                    Archived
                  </span>
                )}
              </div>

              <h1>{document.title}</h1>

              <p>
                {document.document_number ||
                  "No document number"}
                {" • "}
                {category?.name ||
                  "Uncategorized"}
                {" • "}
                Version{" "}
                {document.current_version ||
                  1}
              </p>

              <div className="hero-meta">
                <span>
                  {document.file_name ||
                    "No file"}
                </span>

                <span>•</span>

                <span>
                  {formatFileSize(
                    document.file_size
                  )}
                </span>

                <span>•</span>

                <span>
                  Updated{" "}
                  {formatDate(
                    document.updated_at
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="hero-actions">
            {document.storage_path && (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    handlePreview(
                      document.storage_path,
                      document.file_name,
                      document.mime_type
                    )
                  }
                  disabled={working}
                >
                  Preview
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    handleDownload(
                      document.storage_path,
                      document.file_name
                    )
                  }
                  disabled={working}
                >
                  Download
                </button>
              </>
            )}

            {!document.is_archived && (
              <button
                type="button"
                className="btn"
                onClick={() =>
                  router.push(
                    `/documents/${document.id}/edit`
                  )
                }
                disabled={working}
              >
                Edit
              </button>
            )}

            <button
              type="button"
              className={
                document.is_archived
                  ? "btn btn-primary"
                  : "btn btn-danger"
              }
              onClick={() =>
                setShowArchiveConfirm(true)
              }
              disabled={working}
            >
              {document.is_archived
                ? "Restore"
                : "Archive"}
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="alert alert-error">
            <div className="alert-icon">
              !
            </div>

            <div>
              <strong>
                Something went wrong
              </strong>

              <span>
                {errorMessage}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setErrorMessage("")
              }
            >
              ×
            </button>
          </div>
        )}

        <div className="tabs">
          <button
            type="button"
            className={
              activeTab === "overview"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("overview")
            }
          >
            Overview
          </button>

          <button
            type="button"
            className={
              activeTab === "versions"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("versions")
            }
          >
            Versions
            <span className="tab-count">
              {versions.length}
            </span>
          </button>

          <button
            type="button"
            className={
              activeTab === "activity"
                ? "tab active"
                : "tab"
            }
            onClick={() =>
              setActiveTab("activity")
            }
          >
            Activity
            <span className="tab-count">
              {activities.length}
            </span>
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="content-grid">
            <div className="main-column">
              <section className="card preview-card">
                <div className="card-header">
                  <div>
                    <h2>
                      Current Document
                    </h2>

                    <p>
                      The currently active file
                      for this document.
                    </p>
                  </div>

                  <span className="current-pill">
                    Current v
                    {document.current_version ||
                      1}
                  </span>
                </div>

                <div className="preview-body">
                  <div className="large-file-icon">
                    {getFileExtension(
                      document.file_name
                    )}
                  </div>

                  <h3>
                    {document.file_name ||
                      "No file attached"}
                  </h3>

                  <p>
                    {formatFileSize(
                      document.file_size
                    )}
                    {" • "}
                    {document.mime_type ||
                      "Unknown file type"}
                  </p>

                  <div className="preview-actions">
                    {document.storage_path &&
                      isPreviewable(
                        document.mime_type
                      ) && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() =>
                            handlePreview(
                              document.storage_path,
                              document.file_name,
                              document.mime_type
                            )
                          }
                          disabled={working}
                        >
                          Open Preview
                        </button>
                      )}

                    {document.storage_path && (
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          handleDownload(
                            document.storage_path,
                            document.file_name
                          )
                        }
                        disabled={working}
                      >
                        Download File
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Document Information
                    </h2>

                    <p>
                      Key details and lifecycle
                      information.
                    </p>
                  </div>
                </div>

                <div className="info-grid">
                  <div className="info-item">
                    <span>
                      Document Number
                    </span>
                    <strong>
                      {document.document_number ||
                        "—"}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Document Type
                    </span>
                    <strong>
                      {document.document_type ||
                        "—"}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>Category</span>
                    <strong>
                      {category?.name ||
                        "Uncategorized"}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>Access Level</span>
                    <strong>
                      <span className="value-badge">
                        {document.access_level}
                      </span>
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Issue Date
                    </span>
                    <strong>
                      {formatDate(
                        document.issue_date
                      )}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Expiry Date
                    </span>
                    <strong>
                      {formatDate(
                        document.expiry_date
                      )}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Issuing Authority
                    </span>
                    <strong>
                      {document.issuing_authority ||
                        "—"}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Document Reference
                    </span>
                    <strong>
                      {document.document_reference ||
                        "—"}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Created
                    </span>
                    <strong>
                      {formatDateTime(
                        document.created_at
                      )}
                    </strong>
                  </div>

                  <div className="info-item">
                    <span>
                      Last Updated
                    </span>
                    <strong>
                      {formatDateTime(
                        document.updated_at
                      )}
                    </strong>
                  </div>
                </div>

                {document.description && (
                  <div className="description-box">
                    <span>
                      Description
                    </span>

                    <p>
                      {document.description}
                    </p>
                  </div>
                )}
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Owner
                    </h2>

                    <p>
                      Who this document belongs
                      to.
                    </p>
                  </div>
                </div>

                {document.owner_type ===
                  "employee" && owner ? (
                  <div className="owner-card">
                    <div className="owner-avatar">
                      {getInitials(
                        getEmployeeName(owner)
                      )}
                    </div>

                    <div className="owner-details">
                      <strong>
                        {getEmployeeName(owner)}
                      </strong>

                      <span>
                        {owner.job_title ||
                          "Employee"}
                        {owner.department
                          ? ` • ${owner.department}`
                          : ""}
                      </span>

                      {owner.email && (
                        <span>
                          {owner.email}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        router.push(
                          `/employees/${owner.id}`
                        )
                      }
                    >
                      View Employee
                    </button>
                  </div>
                ) : (
                  <div className="company-owner">
                    <div className="company-icon">
                      C
                    </div>

                    <div>
                      <strong>
                        Company Document
                      </strong>

                      <span>
                        Owned by the company
                        rather than an
                        individual employee.
                      </span>
                    </div>
                  </div>
                )}
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Linked Records
                    </h2>
                    <p>
                      Business records connected
                      to this document.
                    </p>
                  </div>

                  <div className="linked-header-actions">
                    <span className="section-count">
                      {links.length}
                    </span>

                    {!document.is_archived && (
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={openLinkModal}
                        disabled={working || linkSaving}
                      >
                        + Link Record
                      </button>
                    )}
                  </div>
                </div>

                {links.length === 0 ? (
                  <div className="linked-empty">
                    <div className="linked-empty-icon">
                      +
                    </div>
                    <div>
                      <strong>No records linked yet</strong>
                      <span>
                        Connect this document to a customer, invoice, order,
                        employee, repair, serial number, or other business record.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="links-list">
                    {links.map((link) => {
                      const path = getEntityPath(
                        link.entity_type,
                        link.entity_id
                      );

                      return (
                        <div key={link.id} className="link-row">
                          <div className="link-icon">
                            {link.entity_type
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <div className="link-content">
                            <strong>
                              {link.label || link.entity_type}
                            </strong>
                            <span>
                              {link.entity_type.replace(/_/g, " ")}
                              {" • "}
                              {link.entity_id}
                            </span>
                          </div>

                          <div className="link-row-actions">
                            {path ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => router.push(path)}
                              >
                                View
                              </button>
                            ) : (
                              <span className="unavailable">
                                Not linked
                              </span>
                            )}

                            {!document.is_archived && (
                              <button
                                type="button"
                                className="btn btn-link-remove"
                                onClick={() =>
                                  handleRemoveDocumentLink(link)
                                }
                                disabled={
                                  removingLinkId === link.id || working
                                }
                              >
                                {removingLinkId === link.id
                                  ? "Removing..."
                                  : "Remove"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="side-column">
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      Document Snapshot
                    </h2>

                    <p>
                      Quick reference.
                    </p>
                  </div>
                </div>

                <div className="snapshot">
                  <div className="snapshot-stat">
                    <strong>
                      {document.current_version ||
                        1}
                    </strong>

                    <span>
                      Current Version
                    </span>
                  </div>

                  <div className="snapshot-stat">
                    <strong>
                      {versions.length}
                    </strong>

                    <span>
                      Total Versions
                    </span>
                  </div>

                  <div className="snapshot-stat">
                    <strong>
                      {links.length}
                    </strong>

                    <span>
                      Linked Records
                    </span>
                  </div>

                  <div className="snapshot-stat">
                    <strong>
                      {activities.length}
                    </strong>

                    <span>
                      Activities
                    </span>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>
                      File Information
                    </h2>

                    <p>
                      Current storage metadata.
                    </p>
                  </div>
                </div>

                <div className="file-details">
                  <div>
                    <span>File Name</span>
                    <strong>
                      {document.file_name ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>File Type</span>
                    <strong>
                      {document.mime_type ||
                        "—"}
                    </strong>
                  </div>

                  <div>
                    <span>File Size</span>
                    <strong>
                      {formatFileSize(
                        document.file_size
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Current Version
                    </span>
                    <strong>
                      v
                      {document.current_version ||
                        1}
                    </strong>
                  </div>
                </div>
              </section>

              {currentVersion && (
                <section className="card current-version-card">
                  <div className="current-version-mark">
                    ✓
                  </div>

                  <div>
                    <span>
                      Active Version
                    </span>

                    <strong>
                      Version{" "}
                      {
                        currentVersion.version_number
                      }
                    </strong>

                    <p>
                      {currentVersion.file_name ||
                        document.file_name ||
                        "Current file"}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      handleDownload(
                        currentVersion.storage_path,
                        currentVersion.file_name
                      )
                    }
                    disabled={working}
                  >
                    Download
                  </button>
                </section>
              )}
            </aside>
          </div>
        )}

        {activeTab === "versions" && (
          <section className="card versions-card">
            <div className="card-header">
              <div>
                <h2>
                  Version History
                </h2>

                <p>
                  Every file version is preserved.
                  Restoring an old version creates a
                  new version and never deletes history.
                </p>
              </div>

              <span className="section-count">
                {versions.length}{" "}
                {versions.length === 1
                  ? "version"
                  : "versions"}
              </span>
            </div>

            {versions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  V
                </div>

                <h3>
                  No version history
                </h3>

                <p>
                  Version history will appear here
                  when document files are uploaded or
                  replaced.
                </p>
              </div>
            ) : (
              <div className="version-list">
                {versions.map(
                  (version, index) => {
                    const isCurrent =
                      version.version_number ===
                      document.current_version;

                    const isLatest =
                      index === 0;

                    return (
                      <div
                        key={version.id}
                        className={
                          isCurrent
                            ? "version-row current"
                            : "version-row"
                        }
                      >
                        <div className="version-marker">
                          <div
                            className={
                              isCurrent
                                ? "version-dot current-dot"
                                : "version-dot"
                            }
                          >
                            {isCurrent
                              ? "✓"
                              : version.version_number}
                          </div>

                          {index <
                            versions.length - 1 && (
                            <div className="version-line" />
                          )}
                        </div>

                        <div className="version-main">
                          <div className="version-top">
                            <div className="version-title">
                              <strong>
                                Version{" "}
                                {
                                  version.version_number
                                }
                              </strong>

                              {isCurrent && (
                                <span className="current-version-badge">
                                  Current
                                </span>
                              )}

                              {isLatest &&
                                !isCurrent && (
                                  <span className="latest-badge">
                                    Latest upload
                                  </span>
                                )}
                            </div>

                            <span className="version-date">
                              {formatDateTime(
                                version.created_at
                              )}
                            </span>
                          </div>

                          <div className="version-file">
                            <div className="small-file-icon">
                              {getFileExtension(
                                version.file_name
                              )}
                            </div>

                            <div>
                              <strong>
                                {version.file_name ||
                                  "Unnamed file"}
                              </strong>

                              <span>
                                {formatFileSize(
                                  version.file_size
                                )}
                                {" • "}
                                {version.mime_type ||
                                  "Unknown type"}
                              </span>
                            </div>
                          </div>

                          {version.change_note && (
                            <div className="change-note">
                              <span>
                                Change note
                              </span>

                              <p>
                                {
                                  version.change_note
                                }
                              </p>
                            </div>
                          )}

                          <div className="version-actions">
                            {isPreviewable(
                              version.mime_type
                            ) && (
                              <button
                                type="button"
                                className="btn"
                                onClick={() =>
                                  handlePreview(
                                    version.storage_path,
                                    version.file_name,
                                    version.mime_type
                                  )
                                }
                                disabled={
                                  working
                                }
                              >
                                Preview
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn"
                              onClick={() =>
                                handleDownload(
                                  version.storage_path,
                                  version.file_name
                                )
                              }
                              disabled={
                                working
                              }
                            >
                              Download
                            </button>

                            {!isCurrent &&
                              !document.is_archived && (
                                <button
                                  type="button"
                                  className="btn btn-restore"
                                  onClick={() => {
                                    setRestoreVersion(
                                      version
                                    );
                                    setRestoreNote("");
                                  }}
                                  disabled={
                                    working
                                  }
                                >
                                  Restore Version
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === "activity" && (
          <section className="card activity-card">
            <div className="card-header">
              <div>
                <h2>
                  Document Activity
                </h2>

                <p>
                  A complete timeline of changes and
                  document actions.
                </p>
              </div>

              <span className="section-count">
                {activities.length}
              </span>
            </div>

            {activities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  A
                </div>

                <h3>
                  No activity yet
                </h3>

                <p>
                  Document activity will appear here
                  as changes are made.
                </p>
              </div>
            ) : (
              <div className="activity-list">
                {activities.map(
                  (activity, index) => (
                    <div
                      key={activity.id}
                      className="activity-row"
                    >
                      <div className="activity-marker">
                        <div className="activity-dot">
                          {activity.action ===
                          "version_restored"
                            ? "↻"
                            : activity.action ===
                              "file_replaced"
                            ? "↑"
                            : "•"}
                        </div>

                        {index <
                          activities.length - 1 && (
                          <div className="activity-line" />
                        )}
                      </div>

                      <div className="activity-content">
                        <div className="activity-header">
                          <strong>
                            {formatAction(
                              activity.action
                            )}
                          </strong>

                          <span>
                            {formatDateTime(
                              activity.created_at
                            )}
                          </span>
                        </div>

                        <p>
                          {activity.message}
                        </p>

                        {activity.metadata &&
                          Object.keys(
                            activity.metadata
                          ).length > 0 && (
                            <div className="metadata">
                              {Object.entries(
                                activity.metadata
                              )
                                .filter(
                                  ([, value]) =>
                                    value !==
                                      null &&
                                    value !==
                                      undefined
                                )
                                .slice(0, 4)
                                .map(
                                  ([
                                    key,
                                    value,
                                  ]) => (
                                    <span
                                      key={key}
                                    >
                                      <b>
                                        {formatAction(
                                          key
                                        )}
                                        :
                                      </b>{" "}
                                      {String(
                                        value
                                      )}
                                    </span>
                                  )
                                )}
                            </div>
                          )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {previewUrl && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setPreviewUrl(null);
              }
            }}
          >
            <div className="preview-modal">
              <div className="modal-header">
                <div>
                  <strong>
                    {previewTitle}
                  </strong>

                  <span>
                    Secure preview
                  </span>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setPreviewUrl(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="preview-frame">
                {previewTitle
                  .toLowerCase()
                  .endsWith(".pdf") ? (
                  <iframe
                    src={previewUrl}
                    title={previewTitle}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={previewTitle}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {restoreVersion && (
          <div className="modal-backdrop">
            <div className="confirm-modal">
              <div className="confirm-icon">
                ↻
              </div>

              <h2>
                Restore Version{" "}
                {restoreVersion.version_number}?
              </h2>

              <p>
                This will make Version{" "}
                {restoreVersion.version_number} the
                active document file.
              </p>

              <div className="restore-preview">
                <div className="small-file-icon large">
                  {getFileExtension(
                    restoreVersion.file_name
                  )}
                </div>

                <div>
                  <strong>
                    {restoreVersion.file_name ||
                      "Document version"}
                  </strong>

                  <span>
                    Version{" "}
                    {
                      restoreVersion.version_number
                    }
                    {" • "}
                    {formatFileSize(
                      restoreVersion.file_size
                    )}
                  </span>
                </div>
              </div>

              <div className="field">
                <label htmlFor="restore-note">
                  Restore Note
                </label>

                <textarea
                  id="restore-note"
                  value={restoreNote}
                  onChange={(event) =>
                    setRestoreNote(
                      event.target.value
                    )
                  }
                  placeholder="Optional reason for restoring this version..."
                  rows={3}
                  disabled={working}
                />
              </div>

              <div className="confirm-info">
                <strong>
                  Nothing will be deleted.
                </strong>

                <span>
                  Restoring this version creates a new
                  version in the history so your
                  document audit trail remains intact.
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setRestoreVersion(null)
                  }
                  disabled={working}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRestore}
                  disabled={working}
                >
                  {working
                    ? "Restoring..."
                    : "Restore Version"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showLinkModal && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !linkSaving
              ) {
                setShowLinkModal(false);
              }
            }}
          >
            <div className="link-modal">
              <div className="modal-header">
                <div>
                  <strong>Link Business Record</strong>
                  <span>
                    Connect this document to an existing SBS record.
                  </span>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowLinkModal(false)}
                  disabled={linkSaving}
                >
                  ×
                </button>
              </div>

              <div className="link-modal-body">
                <div className="field">
                  <label htmlFor="link-entity-type">Record Type</label>
                  <select
                    id="link-entity-type"
                    value={linkEntityType}
                    onChange={(event) => {
                      setLinkEntityType(event.target.value);
                      setSelectedLinkTarget(null);
                      setLinkSearch("");
                    }}
                    disabled={linkSaving}
                  >
                    {linkEntityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="link-record-search">Search Records</label>
                  <input
                    id="link-record-search"
                    type="search"
                    value={linkSearch}
                    onChange={(event) => {
                      setLinkSearch(event.target.value);
                      setSelectedLinkTarget(null);
                    }}
                    placeholder={`Search ${
                      linkEntityOptions.find(
                        (option) => option.value === linkEntityType
                      )?.label.toLowerCase() || "records"
                    }...`}
                    autoFocus
                    disabled={linkSaving}
                  />
                </div>

                <div className="link-target-panel">
                  {linkTargetsLoading ? (
                    <div className="link-loading">
                      <div className="spinner small" />
                      <span>Searching records...</span>
                    </div>
                  ) : linkTargets.length === 0 ? (
                    <div className="link-target-empty">
                      <strong>No matching records</strong>
                      <span>
                        Try a different search term or choose another record type.
                      </span>
                    </div>
                  ) : (
                    <div className="link-target-list">
                      {linkTargets.map((target) => {
                        const selected =
                          selectedLinkTarget?.entity_id === target.entity_id;

                        return (
                          <button
                            type="button"
                            key={target.entity_id}
                            className={
                              selected
                                ? "link-target selected"
                                : "link-target"
                            }
                            onClick={() =>
                              setSelectedLinkTarget(target)
                            }
                            disabled={linkSaving}
                          >
                            <span className="link-target-icon">
                              {
                                linkEntityOptions
                                  .find(
                                    (option) =>
                                      option.value === linkEntityType
                                  )
                                  ?.label.slice(0, 2)
                                  .toUpperCase() || "RE"
                              }
                            </span>

                            <span className="link-target-content">
                              <strong>{target.entity_label}</strong>
                              {target.entity_subtitle && (
                                <span>{target.entity_subtitle}</span>
                              )}
                            </span>

                            <span className="link-target-check">
                              {selected ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedLinkTarget && (
                  <div className="selected-link-summary">
                    <div className="selected-link-check">✓</div>
                    <div>
                      <span>Selected record</span>
                      <strong>{selectedLinkTarget.entity_label}</strong>
                      {selectedLinkTarget.entity_subtitle && (
                        <small>{selectedLinkTarget.entity_subtitle}</small>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowLinkModal(false)}
                  disabled={linkSaving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddDocumentLink}
                  disabled={!selectedLinkTarget || linkSaving}
                >
                  {linkSaving ? "Linking..." : "Link Record"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showArchiveConfirm && (
          <div className="modal-backdrop">
            <div className="confirm-modal">
              <div
                className={
                  document.is_archived
                    ? "confirm-icon restore"
                    : "confirm-icon archive"
                }
              >
                {document.is_archived
                  ? "↻"
                  : "!"}
              </div>

              <h2>
                {document.is_archived
                  ? "Restore this document?"
                  : "Archive this document?"}
              </h2>

              <p>
                {document.is_archived
                  ? "The document will become active again and can be edited."
                  : "The document will be archived and editing will be disabled."}
              </p>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setShowArchiveConfirm(
                      false
                    )
                  }
                  disabled={working}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className={
                    document.is_archived
                      ? "btn btn-primary"
                      : "btn btn-danger"
                  }
                  onClick={
                    handleArchiveToggle
                  }
                  disabled={working}
                >
                  {working
                    ? "Working..."
                    : document.is_archived
                    ? "Restore Document"
                    : "Archive Document"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          color: #9ca3af;
          font-size: 12px;
          font-weight: 600;
        }

        .breadcrumb button {
          border: 0;
          padding: 0;
          background: transparent;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .breadcrumb button:hover {
          color: #111827;
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          padding: 23px;
          margin-bottom: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .hero-left {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 17px;
        }

        .hero-file-icon {
          width: 64px;
          height: 64px;
          flex: 0 0 64px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          background: #111827;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.04em;
        }

        .hero-content {
          min-width: 0;
        }

        .hero-topline {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
        }

        .hero h1 {
          margin: 0;
          overflow: hidden;
          color: #111827;
          font-size: 25px;
          line-height: 1.25;
          font-weight: 750;
          letter-spacing: -0.02em;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hero-content > p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .hero-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-top: 8px;
          color: #9ca3af;
          font-size: 11.5px;
        }

        .hero-meta span:first-child {
          max-width: 350px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .hero-actions {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
        }

        .btn {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          padding: 0 13px;
          background: #ffffff;
          color: #111827;
          font-size: 12.5px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .btn:hover:not(:disabled) {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .btn-primary {
          border-color: #111827;
          background: #111827;
          color: #ffffff;
        }

        .btn-primary:hover:not(:disabled) {
          border-color: #1f2937;
          background: #1f2937;
        }

        .btn-danger {
          border-color: #dc2626;
          background: #dc2626;
          color: #ffffff;
        }

        .btn-danger:hover:not(:disabled) {
          border-color: #b91c1c;
          background: #b91c1c;
        }

        .btn-restore {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .status-badge,
        .favorite-badge,
        .archived-badge,
        .current-version-badge,
        .latest-badge,
        .current-pill,
        .value-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 23px;
          border-radius: 999px;
          padding: 0 8px;
          font-size: 10.5px;
          font-weight: 700;
        }

        .status-badge {
          background: #f3f4f6;
          color: #374151;
          text-transform: capitalize;
        }

        .status-active {
          background: #ecfdf5;
          color: #047857;
        }

        .status-expiring {
          background: #fffbeb;
          color: #b45309;
        }

        .status-expired {
          background: #fef2f2;
          color: #b91c1c;
        }

        .status-draft {
          background: #f3f4f6;
          color: #4b5563;
        }

        .status-archived {
          background: #f3f4f6;
          color: #6b7280;
        }

        .favorite-badge {
          background: #fffbeb;
          color: #a16207;
        }

        .archived-badge {
          background: #f3f4f6;
          color: #6b7280;
        }

        .current-version-badge {
          background: #ecfdf5;
          color: #047857;
        }

        .latest-badge {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .current-pill {
          background: #ecfdf5;
          color: #047857;
        }

        .value-badge {
          background: #f3f4f6;
          color: #374151;
          text-transform: capitalize;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
        }

        .alert-icon {
          width: 22px;
          height: 22px;
          flex: 0 0 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fee2e2;
          font-size: 12px;
          font-weight: 800;
        }

        .alert > div:nth-child(2) {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .alert strong {
          font-size: 12.5px;
        }

        .alert span {
          font-size: 12px;
          line-height: 1.45;
        }

        .alert > button {
          border: 0;
          background: transparent;
          color: #991b1b;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
        }

        .tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 18px;
          padding: 4px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
          width: fit-content;
        }

        .tab {
          min-height: 35px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 1px solid transparent;
          border-radius: 7px;
          padding: 0 12px;
          background: transparent;
          color: #6b7280;
          font-size: 12.5px;
          font-weight: 650;
          cursor: pointer;
        }

        .tab.active {
          border-color: #d1d5db;
          background: #ffffff;
          color: #111827;
          box-shadow: 0 1px 3px
            rgba(15, 23, 42, 0.06);
        }

        .tab-count {
          min-width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 10px;
          font-weight: 700;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 18px;
          align-items: start;
        }

        .main-column {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .side-column {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.04);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          padding: 18px 20px;
          border-bottom: 1px solid #eef0f2;
        }

        .card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.45;
        }

        .section-count {
          min-width: 27px;
          height: 25px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 8px;
          border-radius: 7px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 10.5px;
          font-weight: 700;
        }

        .preview-body {
          min-height: 285px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .large-file-icon {
          width: 76px;
          height: 76px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 13px;
          border-radius: 16px;
          background: #f3f4f6;
          color: #374151;
          font-size: 14px;
          font-weight: 800;
        }

        .preview-body h3 {
          max-width: 650px;
          margin: 0;
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .preview-body > p {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .preview-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 17px;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          padding: 5px 20px 10px;
        }

        .info-item {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 14px 8px 14px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .info-item:nth-last-child(-n + 2) {
          border-bottom: 0;
        }

        .info-item span:first-child {
          color: #9ca3af;
          font-size: 11px;
          font-weight: 600;
        }

        .info-item > strong {
          overflow: hidden;
          color: #111827;
          font-size: 12.5px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .description-box {
          margin: 0 20px 20px;
          padding: 13px 14px;
          border-radius: 9px;
          background: #f9fafb;
        }

        .description-box > span {
          color: #6b7280;
          font-size: 11px;
          font-weight: 650;
        }

        .description-box p {
          margin: 6px 0 0;
          color: #374151;
          font-size: 12.5px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .owner-card,
        .company-owner {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 18px 20px;
          padding: 13px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
        }

        .owner-avatar,
        .company-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #111827;
          color: #ffffff;
          font-size: 12px;
          font-weight: 750;
        }

        .owner-details,
        .company-owner > div:last-child {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .owner-details strong,
        .company-owner strong {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .owner-details span,
        .company-owner span {
          color: #6b7280;
          font-size: 11.5px;
        }

        .links-list {
          padding: 5px 20px 10px;
        }

        .link-row {
          min-height: 64px;
          display: flex;
          align-items: center;
          gap: 11px;
          border-bottom: 1px solid #f1f5f9;
        }

        .link-row:last-child {
          border-bottom: 0;
        }

        .link-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #f3f4f6;
          color: #374151;
          font-size: 9px;
          font-weight: 800;
        }

        .link-content {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .link-content strong {
          overflow: hidden;
          color: #111827;
          font-size: 12.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .link-content span {
          color: #9ca3af;
          font-size: 10.5px;
          text-transform: capitalize;
        }

        .unavailable {
          color: #9ca3af;
          font-size: 10.5px;
          font-weight: 600;
        }

        .snapshot {
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 8px 12px 15px;
        }

        .snapshot-stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 13px 9px;
        }

        .snapshot-stat strong {
          color: #111827;
          font-size: 21px;
          line-height: 1;
          font-weight: 750;
        }

        .snapshot-stat span {
          color: #9ca3af;
          font-size: 10.5px;
          font-weight: 600;
        }

        .file-details {
          padding: 7px 20px 17px;
        }

        .file-details > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 11px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .file-details > div:last-child {
          border-bottom: 0;
        }

        .file-details span {
          color: #9ca3af;
          font-size: 10.5px;
          font-weight: 600;
        }

        .file-details strong {
          overflow: hidden;
          color: #111827;
          font-size: 11.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .current-version-card {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 15px;
        }

        .current-version-mark {
          width: 35px;
          height: 35px;
          flex: 0 0 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #ecfdf5;
          color: #047857;
          font-size: 14px;
          font-weight: 800;
        }

        .current-version-card > div:nth-child(2) {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .current-version-card span {
          color: #047857;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .current-version-card strong {
          color: #111827;
          font-size: 12.5px;
        }

        .current-version-card p {
          overflow: hidden;
          margin: 0;
          color: #6b7280;
          font-size: 10.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .versions-card,
        .activity-card {
          width: 100%;
        }

        .version-list {
          padding: 20px;
        }

        .version-row {
          display: flex;
          gap: 14px;
        }

        .version-row + .version-row {
          margin-top: 5px;
        }

        .version-marker {
          width: 34px;
          flex: 0 0 34px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .version-dot {
          width: 31px;
          height: 31px;
          flex: 0 0 31px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d1d5db;
          border-radius: 50%;
          background: #ffffff;
          color: #6b7280;
          font-size: 9px;
          font-weight: 750;
        }

        .current-dot {
          border-color: #10b981;
          background: #ecfdf5;
          color: #047857;
        }

        .version-line {
          width: 1px;
          flex: 1;
          min-height: 25px;
          margin: 5px 0;
          background: #e5e7eb;
        }

        .version-main {
          min-width: 0;
          flex: 1;
          margin-bottom: 14px;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          background: #ffffff;
        }

        .version-row.current .version-main {
          border-color: #bbf7d0;
          background: #fafffc;
        }

        .version-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .version-title {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
        }

        .version-title > strong {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .version-date {
          color: #9ca3af;
          font-size: 10.5px;
          white-space: nowrap;
        }

        .version-file {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 13px;
          padding: 10px;
          border-radius: 8px;
          background: #f9fafb;
        }

        .small-file-icon {
          width: 35px;
          height: 35px;
          flex: 0 0 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #111827;
          color: #ffffff;
          font-size: 8px;
          font-weight: 800;
        }

        .small-file-icon.large {
          width: 40px;
          height: 40px;
          flex-basis: 40px;
        }

        .version-file > div:last-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .version-file strong {
          overflow: hidden;
          color: #111827;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .version-file span {
          color: #9ca3af;
          font-size: 10.5px;
        }

        .change-note {
          margin-top: 10px;
          padding: 10px 11px;
          border-radius: 8px;
          background: #f9fafb;
        }

        .change-note span {
          color: #9ca3af;
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .change-note p {
          margin: 4px 0 0;
          color: #4b5563;
          font-size: 11.5px;
          line-height: 1.5;
        }

        .version-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 12px;
        }

        .version-actions .btn {
          min-height: 34px;
          font-size: 11.5px;
        }

        .empty-state {
          min-height: 250px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 30px;
          text-align: center;
        }

        .empty-icon {
          width: 43px;
          height: 43px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          border-radius: 11px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 14px;
          font-weight: 800;
        }

        .empty-state h3 {
          margin: 0;
          color: #111827;
          font-size: 14px;
        }

        .empty-state p {
          max-width: 440px;
          margin: 6px 0 0;
          color: #9ca3af;
          font-size: 11.5px;
          line-height: 1.5;
        }

        .activity-list {
          padding: 20px;
        }

        .activity-row {
          display: flex;
          gap: 13px;
        }

        .activity-marker {
          width: 28px;
          flex: 0 0 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .activity-dot {
          width: 27px;
          height: 27px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e5e7eb;
          border-radius: 50%;
          background: #f9fafb;
          color: #6b7280;
          font-size: 10px;
          font-weight: 750;
        }

        .activity-line {
          width: 1px;
          flex: 1;
          min-height: 25px;
          margin: 4px 0;
          background: #e5e7eb;
        }

        .activity-content {
          min-width: 0;
          flex: 1;
          padding: 1px 0 22px;
        }

        .activity-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .activity-header strong {
          color: #111827;
          font-size: 12.5px;
          font-weight: 700;
        }

        .activity-header span {
          color: #9ca3af;
          font-size: 10.5px;
          white-space: nowrap;
        }

        .activity-content > p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 11.5px;
          line-height: 1.5;
        }

        .metadata {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }

        .metadata span {
          padding: 4px 7px;
          border-radius: 6px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 9.5px;
        }

        .metadata b {
          color: #374151;
        }

        .linked-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .btn-small {
          min-height: 34px;
          padding: 0 12px;
          font-size: 12px;
        }

        .links-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .link-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
        }

        .link-row-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }

        .btn-link-remove {
          color: #b91c1c;
          border-color: #fecaca;
          background: #fffafa;
        }

        .btn-link-remove:hover {
          background: #fef2f2;
          border-color: #fca5a5;
        }

        .linked-empty {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 18px;
          border: 1px dashed #d1d5db;
          border-radius: 11px;
          background: #f9fafb;
        }

        .linked-empty-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #111827;
          color: #ffffff;
          font-size: 20px;
          font-weight: 500;
          flex-shrink: 0;
        }

        .linked-empty > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .linked-empty strong {
          color: #111827;
          font-size: 13px;
        }

        .linked-empty span {
          color: #6b7280;
          font-size: 12px;
          line-height: 1.55;
        }

        .link-modal {
          width: min(680px, calc(100vw - 32px));
          max-height: calc(100vh - 48px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.18);
        }

        .link-modal-body {
          padding: 20px;
          overflow-y: auto;
        }

        .link-target-panel {
          min-height: 190px;
          max-height: 330px;
          margin-top: 14px;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          background: #f9fafb;
        }

        .link-loading,
        .link-target-empty {
          min-height: 190px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 7px;
          text-align: center;
          padding: 20px;
        }

        .link-target-empty strong {
          color: #374151;
          font-size: 13px;
        }

        .link-target-empty span,
        .link-loading span {
          color: #6b7280;
          font-size: 12px;
        }

        .spinner.small {
          width: 19px;
          height: 19px;
        }

        .link-target-list {
          display: flex;
          flex-direction: column;
          padding: 7px;
          gap: 5px;
        }

        .link-target {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 11px;
          border: 1px solid transparent;
          border-radius: 9px;
          padding: 10px 11px;
          background: #ffffff;
          color: #111827;
          text-align: left;
          cursor: pointer;
        }

        .link-target:hover {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .link-target.selected {
          border-color: #111827;
          background: #f3f4f6;
        }

        .link-target-icon {
          width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #eef0f2;
          color: #374151;
          font-size: 10px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .link-target-content {
          min-width: 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .link-target-content strong {
          overflow: hidden;
          color: #111827;
          font-size: 13px;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .link-target-content span {
          overflow: hidden;
          color: #6b7280;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .link-target-check {
          width: 23px;
          height: 23px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #ffffff;
          background: transparent;
          font-size: 12px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .link-target.selected .link-target-check {
          background: #111827;
        }

        .selected-link-summary {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
          padding: 11px 12px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #f9fafb;
        }

        .selected-link-check {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: #111827;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          flex-shrink: 0;
        }

        .selected-link-summary > div:last-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .selected-link-summary span {
          color: #6b7280;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .selected-link-summary strong {
          overflow: hidden;
          color: #111827;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .selected-link-summary small {
          overflow: hidden;
          color: #6b7280;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .modal-backdrop {
          position: fixed;
          z-index: 100;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(
            15,
            23,
            42,
            0.52
          );
          backdrop-filter: blur(3px);
        }

        .preview-modal {
          width: min(
            1100px,
            100%
          );
          height: min(
            850px,
            92vh
          );
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 24px 70px
            rgba(15, 23, 42, 0.25);
        }

        .modal-header {
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 10px 15px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header > div:first-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .modal-header strong {
          overflow: hidden;
          color: #111827;
          font-size: 13px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .modal-header span {
          color: #9ca3af;
          font-size: 10.5px;
        }

        .modal-close {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
          color: #6b7280;
          font-size: 20px;
          cursor: pointer;
        }

        .preview-frame {
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
        }

        .preview-frame iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }

        .preview-frame img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .confirm-modal {
          width: min(
            470px,
            100%
          );
          padding: 24px;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 24px 70px
            rgba(15, 23, 42, 0.25);
        }

        .confirm-icon {
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 13px;
          border-radius: 12px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 18px;
          font-weight: 800;
        }

        .confirm-icon.archive {
          background: #fef2f2;
          color: #b91c1c;
        }

        .confirm-icon.restore {
          background: #ecfdf5;
          color: #047857;
        }

        .confirm-modal h2 {
          margin: 0;
          color: #111827;
          font-size: 18px;
          font-weight: 750;
        }

        .confirm-modal > p {
          margin: 7px 0 17px;
          color: #6b7280;
          font-size: 12.5px;
          line-height: 1.5;
        }

        .restore-preview {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          padding: 11px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
        }

        .restore-preview > div:last-child {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .restore-preview strong {
          overflow: hidden;
          color: #111827;
          font-size: 12px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .restore-preview span {
          color: #9ca3af;
          font-size: 10.5px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          color: #374151;
          font-size: 11.5px;
          font-weight: 650;
        }

        .field textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 75px;
          padding: 9px 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          outline: none;
          resize: vertical;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
        }

        .field textarea:focus {
          border-color: #6b7280;
          box-shadow: 0 0 0 3px
            rgba(107, 114, 128, 0.1);
        }

        .confirm-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-top: 13px;
          padding: 10px 11px;
          border-radius: 8px;
          background: #f9fafb;
        }

        .confirm-info strong {
          color: #374151;
          font-size: 11px;
        }

        .confirm-info span {
          color: #6b7280;
          font-size: 10.5px;
          line-height: 1.45;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 18px;
        }

        @media (max-width: 1050px) {
          .hero {
            align-items: flex-start;
            flex-direction: column;
          }

          .hero-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .content-grid {
            grid-template-columns: 1fr;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 760px) {
          .page-content {
            padding: 20px;
          }

          .hero-left {
            align-items: flex-start;
          }

          .hero h1 {
            font-size: 21px;
            white-space: normal;
          }

          .hero-actions {
            display: grid;
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .hero-actions .btn {
            width: 100%;
          }

          .side-column {
            display: flex;
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          .info-item:nth-last-child(-n + 2) {
            border-bottom: 1px solid #f1f5f9;
          }

          .info-item:last-child {
            border-bottom: 0;
          }

          .owner-card,
          .company-owner {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .owner-card .btn {
            width: 100%;
          }

          .version-top {
            flex-direction: column;
          }

          .version-date {
            white-space: normal;
          }

          .activity-header {
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }
        }

        @media (max-width: 520px) {
          .page-content {
            padding: 15px;
          }

          .hero {
            padding: 17px;
          }

          .hero-left {
            flex-direction: column;
          }

          .hero-actions {
            grid-template-columns: 1fr;
          }

          .tabs {
            width: 100%;
            overflow-x: auto;
          }

          .tab {
            flex: 1;
            white-space: nowrap;
          }

          .card-header {
            padding: 15px;
          }

          .version-list,
          .activity-list {
            padding: 15px;
          }

          .version-row {
            gap: 8px;
          }

          .version-marker {
            width: 28px;
            flex-basis: 28px;
          }

          .version-dot {
            width: 27px;
            height: 27px;
            flex-basis: 27px;
          }

          .version-actions {
            flex-direction: column;
          }

          .version-actions .btn {
            width: 100%;
          }

          .preview-modal {
            height: 95vh;
          }

          .modal-actions {
            flex-direction: column-reverse;
          }

          .modal-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}