"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/app/components/app-shell";
import { usePermissions } from "@/hooks/use-permissions";

type DocumentStatus =
  | "active"
  | "expiring"
  | "expired"
  | "archived"
  | "draft";

type DocumentRow = {
  id: string;
  company_id: string;
  category_id: string | null;
  title: string;
  document_number: string | null;
  document_type: string;
  description: string | null;
  status: DocumentStatus;
  access_level: "company" | "restricted" | "private";
  owner_type: "company" | "employee";
  owner_employee_id: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  current_version: number;
  is_favorite: boolean;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Employee = {
  id: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
};

const DOCUMENT_TYPES = [
  { value: "other", label: "Other" },
  { value: "legal", label: "Legal" },
  { value: "license", label: "License" },
  { value: "tax", label: "Tax / VAT" },
  { value: "contract", label: "Contract" },
  { value: "certificate", label: "Certificate" },
  { value: "identity", label: "Identity" },
  { value: "permit", label: "Permit" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "report", label: "Report" },
  { value: "inspection", label: "Inspection" },
  { value: "warranty", label: "Warranty" },
  { value: "repair", label: "Repair" },
  { value: "rma", label: "RMA" },
];

const TYPE_LABELS = Object.fromEntries(
  DOCUMENT_TYPES.map((item) => [item.value, item.label]),
);

const INITIAL_DOCUMENTS_PER_CATEGORY = 5;

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getOwnerLabel(
  document: DocumentRow,
  employeeMap: Map<string, Employee>,
) {
  if (document.owner_type === "company") {
    return "Company";
  }

  if (!document.owner_employee_id) {
    return "Employee";
  }

  const employee = employeeMap.get(document.owner_employee_id);

  if (!employee) {
    return "Employee";
  }

  return (
    employee.display_name ||
    `${employee.first_name} ${employee.last_name}`.trim() ||
    "Employee"
  );
}

function getFileLabel(mimeType: string) {
  const mime = mimeType.toLowerCase();

  if (mime.includes("pdf")) return "PDF";

  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv")
  ) {
    return "XLS";
  }

  if (mime.includes("word") || mime.includes("document")) {
    return "DOC";
  }

  if (mime.startsWith("image/")) {
    return "IMG";
  }

  if (mime.includes("zip")) {
    return "ZIP";
  }

  return "FILE";
}

function getStatusLabel(status: DocumentStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusClass(status: DocumentStatus) {
  return `status-badge status-${status}`;
}

function getCategoryInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "D";
}

export default function DocumentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const canView = hasPermission("documents", "view");
  const canCreate = hasPermission("documents", "create");
  const canEdit = hasPermission("documents", "edit");
  const canDelete = hasPermission("documents", "delete");
  const canArchive = canEdit;

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [view, setView] = useState<
    "all" | "recent" | "expiring" | "favorites" | "archived"
  >("all");

  const [expandedCategories, setExpandedCategories] = useState<
    Set<string>
  >(new Set());

  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          window.location.href = "/login";
          return;
        }

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
          throw new Error(
            "No company workspace is assigned to your account.",
          );
        }

        const currentCompanyId = membership.company_id;

        setCompanyId(currentCompanyId);

        const [
          documentsResult,
          categoriesResult,
          employeesResult,
        ] = await Promise.all([
          supabase
            .from("documents")
            .select(
              `
                id,
                company_id,
                category_id,
                title,
                document_number,
                document_type,
                description,
                status,
                access_level,
                owner_type,
                owner_employee_id,
                issue_date,
                expiry_date,
                file_name,
                mime_type,
                file_size,
                current_version,
                is_favorite,
                is_archived,
                created_by,
                created_at,
                updated_at
              `,
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", { ascending: false }),

          supabase
            .from("document_categories")
            .select("id,name,slug")
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true }),

          supabase
            .from("employees")
            .select(
              "id,display_name,first_name,last_name",
            )
            .eq("company_id", currentCompanyId)
            .order("first_name", { ascending: true }),
        ]);

        if (documentsResult.error) {
          throw documentsResult.error;
        }

        if (categoriesResult.error) {
          throw categoriesResult.error;
        }

        if (employeesResult.error) {
          throw employeesResult.error;
        }

        setDocuments(
          (documentsResult.data || []) as DocumentRow[],
        );

        setCategories(
          (categoriesResult.data || []) as Category[],
        );

        setEmployees(
          (employeesResult.data || []) as Employee[],
        );
      } catch (error) {
        console.error("DOCUMENTS LOAD ERROR:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load documents.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const employeeMap = useMemo(
    () =>
      new Map(
        employees.map((employee) => [
          employee.id,
          employee,
        ]),
      ),
    [employees],
  );

  const categoryMap = useMemo(
    () =>
      new Map(
        categories.map((category) => [
          category.id,
          category,
        ]),
      ),
    [categories],
  );

  const stats = useMemo(() => {
    const now = new Date();

    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const expiring = documents.filter((document) => {
      if (
        document.is_archived ||
        !document.expiry_date
      ) {
        return false;
      }

      const expiry = new Date(
        `${document.expiry_date}T23:59:59`,
      );

      return (
        expiry >= now &&
        expiry <= thirtyDaysFromNow
      );
    }).length;

    return {
      total: documents.length,

      company: documents.filter(
        (document) =>
          document.owner_type === "company",
      ).length,

      employee: documents.filter(
        (document) =>
          document.owner_type === "employee",
      ).length,

      expiring,

      expired: documents.filter(
        (document) =>
          document.status === "expired" &&
          !document.is_archived,
      ).length,

      reports: documents.filter(
        (document) =>
          document.document_type === "report",
      ).length,
    };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    const now = new Date();

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(
      now.getDate() + 30,
    );

    return documents.filter((document) => {
      if (normalizedSearch) {
        const searchableValues = [
          document.title,
          document.document_number,
          document.file_name,
          document.description,
          document.document_type,
        ]
          .filter(Boolean)
          .map((value) =>
            value!.toLowerCase(),
          );

        if (
          !searchableValues.some((value) =>
            value.includes(normalizedSearch),
          )
        ) {
          return false;
        }
      }

      if (
        statusFilter !== "all" &&
        document.status !== statusFilter
      ) {
        return false;
      }

      if (
        ownerFilter !== "all" &&
        document.owner_type !== ownerFilter
      ) {
        return false;
      }

      if (
        categoryFilter !== "all" &&
        document.category_id !== categoryFilter
      ) {
        return false;
      }

      if (
        typeFilter !== "all" &&
        document.document_type !== typeFilter
      ) {
        return false;
      }

      if (view === "recent") {
        if (
          new Date(document.created_at) <
          sevenDaysAgo
        ) {
          return false;
        }
      }

      if (view === "expiring") {
        if (!document.expiry_date) {
          return false;
        }

        const expiry = new Date(
          `${document.expiry_date}T23:59:59`,
        );

        if (
          expiry < now ||
          expiry > thirtyDaysFromNow
        ) {
          return false;
        }
      }

      if (
        view === "favorites" &&
        !document.is_favorite
      ) {
        return false;
      }

      if (view === "archived" && !document.is_archived) {
        return false;
      }

      return true;
    });
  }, [
    documents,
    search,
    statusFilter,
    ownerFilter,
    categoryFilter,
    typeFilter,
    view,
  ]);

  const groupedDocuments = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        category: Category | null;
        documents: DocumentRow[];
      }
    >();

    for (const document of filteredDocuments) {
      const key =
        document.category_id &&
        categoryMap.has(document.category_id)
          ? document.category_id
          : "uncategorized";

      const existing = groups.get(key);

      if (existing) {
        existing.documents.push(document);
      } else {
        groups.set(key, {
          key,
          category:
            key === "uncategorized"
              ? null
              : categoryMap.get(
                  document.category_id!,
                ) || null,
          documents: [document],
        });
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => {
        if (!a.category && !b.category) {
          return 0;
        }

        if (!a.category) {
          return 1;
        }

        if (!b.category) {
          return -1;
        }

        return a.category.name.localeCompare(
          b.category.name,
        );
      },
    );
  }, [filteredDocuments, categoryMap]);

  const totalVisibleDocuments =
    filteredDocuments.length;

  const activeCategoryCount =
    groupedDocuments.length;

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current);

      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }

      return next;
    });
  };

  const showAllCategory = (categoryKey: string) => {
    setExpandedCategories((current) => {
      const next = new Set(current);
      next.add(categoryKey);
      return next;
    });
  };

  const toggleFavorite = async (
    document: DocumentRow,
  ) => {
    if (!companyId) return;

    const nextValue =
      !document.is_favorite;

    setDocuments((current) =>
      current.map((item) =>
        item.id === document.id
          ? {
              ...item,
              is_favorite: nextValue,
            }
          : item,
      ),
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("documents")
      .update({
        is_favorite: nextValue,
        updated_by: user?.id ?? null,
      })
      .eq("id", document.id)
      .eq("company_id", companyId);

    if (error) {
      setDocuments((current) =>
        current.map((item) =>
          item.id === document.id
            ? {
                ...item,
                is_favorite:
                  document.is_favorite,
              }
            : item,
        ),
      );

      setErrorMessage(error.message);
    }
  };

  const archiveDocument = async (
    document: DocumentRow,
  ) => {
    if (!companyId) return;

    const confirmed = window.confirm(
      `Archive "${document.title}"?\n\nThe document will remain in its history but will no longer appear as an active document.`,
    );

    if (!confirmed) return;

    try {
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("documents")
        .update({
          is_archived: true,
          status: "archived",
          updated_by: user?.id ?? null,
        })
        .eq("id", document.id)
        .eq("company_id", companyId);

      if (error) {
        throw error;
      }

      await supabase
        .from("document_activity")
        .insert({
          company_id: companyId,
          document_id: document.id,
          action: "archived",
          message: `Document "${document.title}" was archived.`,
          created_by: user?.id ?? null,
        });

      await loadData(true);
    } catch (error) {
      console.error(
        "ARCHIVE DOCUMENT ERROR:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to archive document.",
      );
    }
  };

  const unarchiveDocument = async (
    document: DocumentRow,
  ) => {
    if (!companyId || !canArchive || !document.is_archived) return;

    const confirmed = window.confirm(
      `Unarchive "${document.title}"?\n\nThe document will be restored to the active document library.`,
    );

    if (!confirmed) return;

    try {
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let restoredStatus: DocumentStatus = "active";

      if (document.expiry_date) {
        const now = new Date();
        const expiry = new Date(`${document.expiry_date}T23:59:59`);
        const thirtyDaysFromNow = new Date(now);
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        if (expiry < now) {
          restoredStatus = "expired";
        } else if (expiry <= thirtyDaysFromNow) {
          restoredStatus = "expiring";
        }
      }

      const { error } = await supabase
        .from("documents")
        .update({
          is_archived: false,
          status: restoredStatus,
          updated_by: user?.id ?? null,
        })
        .eq("id", document.id)
        .eq("company_id", companyId);

      if (error) throw error;

      await supabase.from("document_activity").insert({
        company_id: companyId,
        document_id: document.id,
        action: "unarchived",
        message: `Document "${document.title}" was restored from the archive.`,
        created_by: user?.id ?? null,
      });

      await loadData(true);
    } catch (error) {
      console.error("UNARCHIVE DOCUMENT ERROR:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to unarchive document.",
      );
    }
  };

  const deleteDocument = async (
    document: DocumentRow,
  ) => {
    if (!companyId || !canDelete) return;

    const confirmed = window.confirm(
      `Permanently delete "${document.title}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setErrorMessage("");

      const { error: deleteError } = await supabase
        .from("documents")
        .delete()
        .eq("id", document.id)
        .eq("company_id", companyId);

      if (deleteError) throw deleteError;

      setDocuments((current) =>
        current.filter((item) => item.id !== document.id),
      );
    } catch (error) {
      console.error("DELETE DOCUMENT ERROR:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete document.",
      );
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setOwnerFilter("all");
    setCategoryFilter("all");
    setTypeFilter("all");
    setView("all");
    setExpandedCategories(new Set());
  };

  if (loading || permissionsLoading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Loading Documents...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!canView) {
    return (
      <AppShell>
        <div className="page-content documents-page">
          <div className="empty-state">
            <div className="empty-icon">!</div>
            <h3>Access restricted</h3>
            <p>You do not have permission to view company documents.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content documents-page">
        <style jsx>{`
          .documents-page {
            min-width: 0;
          }

          .page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }

          .eyebrow {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 7px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .eyebrow-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #16a34a;
            box-shadow: 0 0 0 4px #dcfce7;
          }

          .page-header h1 {
            margin: 0;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.15;
            font-weight: 750;
            letter-spacing: -0.03em;
          }

          .page-description {
            margin: 7px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.55;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
          }

          .primary-button,
          .secondary-button {
            min-height: 40px;
            border-radius: 10px;
            padding: 0 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
            white-space: nowrap;
            transition:
              background 160ms ease,
              border-color 160ms ease,
              color 160ms ease,
              box-shadow 160ms ease;
          }

          .primary-button {
            color: #fff;
            background: #166534;
            border: 1px solid #166534;
            box-shadow:
              0 1px 2px
              rgba(15, 23, 42, 0.08);
          }

          .primary-button:hover {
            background: #14532d;
            border-color: #14532d;
          }

          .secondary-button {
            color: #334155;
            background: #fff;
            border: 1px solid #dbe2ea;
          }

          .secondary-button:hover {
            color: #0f172a;
            background: #f8fafc;
            border-color: #cbd5e1;
          }

          .secondary-button:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }

          .kpi-grid {
            display: grid;
            grid-template-columns:
              repeat(7, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 20px;
          }

          .kpi-card {
            min-width: 0;
            padding: 17px 18px;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow:
              0 2px 8px
              rgba(15, 23, 42, 0.035);
          }

          .kpi-label {
            margin-bottom: 7px;
            color: #64748b;
            font-size: 12px;
            font-weight: 650;
          }

          .kpi-value {
            color: #0f172a;
            font-size: 23px;
            line-height: 1;
            font-weight: 750;
            letter-spacing: -0.02em;
          }

          .kpi-card.alert .kpi-value {
            color: #b45309;
          }

          .kpi-card.danger .kpi-value {
            color: #b91c1c;
          }

          .workspace-card {
            overflow: hidden;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow:
              0 2px 10px
              rgba(15, 23, 42, 0.035);
          }

          .workspace-top {
            padding: 17px 18px 14px;
            border-bottom: 1px solid #eef2f7;
          }

          .view-tabs {
            display: flex;
            align-items: center;
            gap: 5px;
            overflow-x: auto;
            margin-bottom: 15px;
          }

          .view-tab {
            flex: 0 0 auto;
            padding: 8px 11px;
            color: #64748b;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition:
              background 150ms ease,
              border-color 150ms ease,
              color 150ms ease;
          }

          .view-tab:hover {
            color: #0f172a;
            background: #f1f5f9;
          }

          .view-tab.active {
            color: #166534;
            background: #f0fdf4;
            border-color: #bbf7d0;
          }

          .filter-grid {
            display: grid;
            grid-template-columns:
              minmax(220px, 1.8fr)
              repeat(4, minmax(130px, 1fr))
              auto;
            gap: 9px;
            align-items: center;
          }

          .search-box,
          .filter-select {
            width: 100%;
            height: 40px;
            color: #1e293b;
            background: #fff;
            border: 1px solid #dbe2ea;
            border-radius: 9px;
            font-size: 13px;
            outline: none;
            transition:
              border-color 150ms ease,
              box-shadow 150ms ease;
          }

          .search-box {
            padding: 0 12px;
          }

          .filter-select {
            padding: 0 10px;
          }

          .search-box:focus,
          .filter-select:focus {
            border-color: #86efac;
            box-shadow:
              0 0 0 3px #f0fdf4;
          }

          .clear-button {
            height: 40px;
            padding: 0 8px;
            color: #64748b;
            background: transparent;
            border: 0;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
          }

          .clear-button:hover {
            color: #166534;
          }

          .library-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 15px 18px;
            border-bottom: 1px solid #eef2f7;
          }

          .library-summary-left {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .library-summary h2 {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
            font-weight: 750;
          }

          .summary-divider {
            width: 1px;
            height: 16px;
            background: #e2e8f0;
          }

          .summary-meta {
            color: #64748b;
            font-size: 12px;
            font-weight: 650;
          }

          .category-count {
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 750;
          }

          .category-list {
            display: flex;
            flex-direction: column;
          }

          .category-section {
            border-bottom: 1px solid #eef2f7;
          }

          .category-section:last-child {
            border-bottom: 0;
          }

          .category-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 16px 18px;
            background: #fff;
          }

          .category-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 0;
          }

          .category-icon {
            display: grid;
            place-items: center;
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 800;
          }

          .category-heading {
            min-width: 0;
          }

          .category-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }

          .category-title {
            margin: 0;
            overflow: hidden;
            color: #0f172a;
            font-size: 14px;
            font-weight: 750;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .category-subtitle {
            margin: 3px 0 0;
            color: #94a3b8;
            font-size: 11px;
          }

          .category-header-right {
            display: flex;
            align-items: center;
            gap: 9px;
            flex: 0 0 auto;
          }

          .category-attention {
            display: inline-flex;
            align-items: center;
            min-height: 26px;
            padding: 0 8px;
            color: #92400e;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 750;
          }

          .category-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            height: 32px;
            padding: 0 8px;
            color: #64748b;
            background: #fff;
            border: 1px solid #dbe2ea;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition:
              background 150ms ease,
              color 150ms ease,
              border-color 150ms ease;
          }

          .category-toggle:hover {
            color: #166534;
            background: #f0fdf4;
            border-color: #bbf7d0;
          }

          .category-files {
            padding: 0 18px 18px;
          }

          .document-list {
            overflow: hidden;
            border: 1px solid #e5e7eb;
            border-radius: 11px;
          }

          .document-row {
            display: grid;
            grid-template-columns:
              minmax(300px, 2fr)
              minmax(90px, 0.65fr)
              minmax(110px, 0.8fr)
              minmax(120px, 0.85fr)
              minmax(110px, 0.8fr)
              auto;
            align-items: center;
            min-height: 72px;
            border-bottom: 1px solid #eef2f7;
            transition: background 140ms ease;
          }

          .document-row:last-child {
            border-bottom: 0;
          }

          .document-row:hover {
            background: #fbfdfc;
          }

          .document-row.header-row {
            min-height: 38px;
            background: #f8fafc;
          }

          .document-row.header-row:hover {
            background: #f8fafc;
          }

          .document-row > div {
            min-width: 0;
            padding: 0 12px;
          }

          .document-row > div:first-child {
            padding-left: 14px;
          }

          .document-row > div:last-child {
            padding-right: 14px;
          }

          .column-label {
            color: #64748b;
            font-size: 10px;
            font-weight: 750;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          .document-cell {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .favorite-button {
            display: grid;
            place-items: center;
            width: 29px;
            height: 29px;
            flex: 0 0 29px;
            color: #94a3b8;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 15px;
            cursor: pointer;
            transition:
              color 150ms ease,
              background 150ms ease,
              border-color 150ms ease;
          }

          .favorite-button:hover {
            color: #b45309;
            background: #fffbeb;
            border-color: #fde68a;
          }

          .favorite-button.active {
            color: #b45309;
            background: #fffbeb;
            border-color: #fde68a;
          }

          .file-icon {
            display: grid;
            place-items: center;
            width: 36px;
            height: 36px;
            flex: 0 0 36px;
            color: #475569;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 9px;
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.02em;
          }

          .document-main {
            min-width: 0;
          }

          .document-title {
            display: block;
            overflow: hidden;
            color: #0f172a;
            font-size: 13px;
            font-weight: 750;
            text-decoration: none;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .document-title:hover {
            color: #166534;
          }

          .document-meta {
            display: flex;
            gap: 6px;
            margin-top: 3px;
            overflow: hidden;
            color: #94a3b8;
            font-size: 10px;
            white-space: nowrap;
          }

          .document-meta span:first-child {
            max-width: 190px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .type-text,
          .owner-text {
            color: #475569;
            font-size: 12px;
            font-weight: 650;
          }

          .expiry-text {
            color: #475569;
            font-size: 12px;
            font-weight: 650;
          }

          .muted {
            color: #94a3b8;
            font-weight: 500;
          }

          .warning-text {
            color: #b45309;
            font-weight: 750;
          }

          .danger-text {
            color: #b91c1c;
            font-weight: 750;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            min-height: 24px;
            padding: 0 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 750;
            white-space: nowrap;
          }

          .status-active {
            color: #166534;
            background: #dcfce7;
          }

          .status-expiring {
            color: #92400e;
            background: #fef3c7;
          }

          .status-expired {
            color: #991b1b;
            background: #fee2e2;
          }

          .status-archived {
            color: #475569;
            background: #e2e8f0;
          }

          .status-draft {
            color: #1d4ed8;
            background: #dbeafe;
          }

          .row-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
            white-space: nowrap;
          }

          .document-section-cards {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 20px;
          }

          .document-section-card {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 17px 18px;
            color: inherit;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow: 0 2px 10px rgba(15, 23, 42, 0.035);
            text-decoration: none;
            transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease, transform 150ms ease;
          }

          .document-section-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06);
          }

          .document-section-card.normal-section:hover {
            border-color: #cbd5e1;
            background: #fbfdff;
          }

          .document-section-card.reports-section:hover {
            border-color: #86efac;
            background: #f8fff9;
          }

          .document-section-icon {
            display: grid;
            place-items: center;
            width: 44px;
            height: 44px;
            flex: 0 0 44px;
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 11px;
            font-size: 17px;
            font-weight: 800;
          }

          .document-section-copy {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .document-section-label {
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .document-section-copy strong {
            overflow: hidden;
            color: #0f172a;
            font-size: 15px;
            font-weight: 750;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .document-section-copy > span:last-child {
            color: #64748b;
            font-size: 11px;
            line-height: 1.45;
          }

          .document-section-count {
            display: grid;
            place-items: center;
            min-width: 36px;
            height: 30px;
            margin-left: auto;
            padding: 0 9px;
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 800;
          }

          .row-action {
            box-sizing: border-box;
            appearance: none;
            -webkit-appearance: none;
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            min-width: 52px;
            height: 32px !important;
            margin: 0;
            padding: 0 10px !important;
            color: #475569 !important;
            background: #fff !important;
            border: 1px solid #dbe2ea !important;
            border-radius: 8px !important;
            outline: none;
            font-family: inherit !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            white-space: nowrap;
            cursor: pointer;
            box-shadow:
              0 1px 2px
              rgba(15, 23, 42, 0.04);
            transition:
              color 150ms ease,
              background-color 150ms ease,
              border-color 150ms ease,
              box-shadow 150ms ease,
              transform 150ms ease;
          }

          .row-action-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            font-size: 12px;
            line-height: 1;
          }

          .row-action:hover {
            transform: translateY(-1px);
          }

          .row-action:active {
            transform: translateY(0);
          }

          .row-action:focus-visible {
            box-shadow:
              0 0 0 3px #dcfce7 !important;
          }

          .row-action.view {
            color: #334155 !important;
          }

          .row-action.view:hover {
            color: #0f172a !important;
            background: #f8fafc !important;
            border-color: #cbd5e1 !important;
          }

          .row-action.edit {
            color: #166534 !important;
            background: #f0fdf4 !important;
            border-color: #bbf7d0 !important;
          }

          .row-action.edit:hover {
            color: #14532d !important;
            background: #dcfce7 !important;
            border-color: #86efac !important;
          }

          .row-action.archive {
            color: #b91c1c !important;
            background: #fff !important;
            border-color: #fecaca !important;
          }

          .row-action.archive:hover {
            color: #991b1b !important;
            background: #fef2f2 !important;
            border-color: #fca5a5 !important;
          }

          .row-action.restore {
            color: #166534 !important;
            background: #f0fdf4 !important;
            border-color: #bbf7d0 !important;
          }

          .row-action.restore:hover {
            color: #14532d !important;
            background: #dcfce7 !important;
            border-color: #86efac !important;
          }

          .row-action.delete {
            color: #b91c1c !important;
            background: #fff !important;
            border-color: #fecaca !important;
          }

          .row-action.delete:hover {
            color: #991b1b !important;
            background: #fef2f2 !important;
            border-color: #fca5a5 !important;
          }

          .category-footer {
            display: flex;
            align-items: center;
            justify-content: center;
            padding-top: 11px;
          }

          .show-more-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 34px;
            padding: 0 13px;
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 750;
            cursor: pointer;
            transition:
              background 150ms ease,
              border-color 150ms ease,
              color 150ms ease;
          }

          .show-more-button:hover {
            color: #14532d;
            background: #dcfce7;
            border-color: #86efac;
          }

          .empty-state {
            padding: 70px 20px;
            text-align: center;
          }

          .empty-icon {
            display: grid;
            place-items: center;
            width: 54px;
            height: 54px;
            margin: 0 auto 14px;
            color: #64748b;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 15px;
            font-size: 23px;
          }

          .empty-state h3 {
            margin: 0;
            color: #0f172a;
            font-size: 16px;
            font-weight: 750;
          }

          .empty-state p {
            max-width: 520px;
            margin: 7px auto 18px;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
          }

          .alert {
            margin-bottom: 18px;
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 13px;
          }

          .alert-error {
            color: #991b1b;
            background: #fef2f2;
            border: 1px solid #fecaca;
          }

          @media (max-width: 1450px) {
            .kpi-grid {
              grid-template-columns:
                repeat(3, minmax(0, 1fr));
            }

            .filter-grid {
              grid-template-columns:
                1.5fr 1fr 1fr 1fr 1fr auto;
            }

            .document-row {
              grid-template-columns:
                minmax(270px, 2fr)
                minmax(80px, 0.65fr)
                minmax(100px, 0.8fr)
                minmax(110px, 0.8fr)
                minmax(100px, 0.75fr)
                auto;
            }
          }

          @media (max-width: 1150px) {
            .filter-grid {
              grid-template-columns:
                repeat(3, minmax(0, 1fr));
            }

            .filter-grid > :first-child {
              grid-column: 1 / -1;
            }

            .document-row {
              min-width: 980px;
            }

            .category-files {
              overflow-x: auto;
            }

            .document-list {
              min-width: 980px;
            }
          }

          @media (max-width: 900px) {
            .page-header {
              flex-direction: column;
            }

            .header-actions {
              width: 100%;
            }

            .header-actions > * {
              flex: 1;
            }
          }

          @media (max-width: 760px) {
            .document-section-cards {
              grid-template-columns: 1fr;
            }

            .kpi-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr));
            }

            .filter-grid {
              grid-template-columns: 1fr;
            }

            .filter-grid > :first-child {
              grid-column: auto;
            }

            .library-summary {
              align-items: flex-start;
              flex-direction: column;
            }

            .category-header {
              align-items: flex-start;
            }

            .category-header-right {
              gap: 6px;
            }

            .category-attention {
              display: none;
            }
          }

          @media (max-width: 480px) {
            .kpi-grid {
              grid-template-columns: 1fr;
            }

            .header-actions {
              display: grid;
              grid-template-columns: 1fr;
            }

            .header-actions > * {
              width: 100%;
            }

            .category-header-left {
              align-items: flex-start;
            }
          }
        `}</style>

        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Business Document Center
            </div>

            <h1>Documents</h1>

            <p className="page-description">
              Secure company files, employee documents,
              business records and generated reports in
              one place.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

            {canCreate && (
              <Link
                href="/documents/reports"
                className="secondary-button"
              >
                ▣ Create Report
              </Link>
            )}

            {canCreate && (
              <Link
                href="/documents/new"
                className="primary-button"
              >
                + Upload Document
              </Link>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            {errorMessage}
          </div>
        )}

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">
              Total Documents
            </div>

            <div className="kpi-value">
              {stats.total}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              Company Documents
            </div>

            <div className="kpi-value">
              {stats.company}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              Employee Documents
            </div>

            <div className="kpi-value">
              {stats.employee}
            </div>
          </div>

          <div className="kpi-card alert">
            <div className="kpi-label">
              Expiring in 30 Days
            </div>

            <div className="kpi-value">
              {stats.expiring}
            </div>
          </div>

          <div className="kpi-card danger">
            <div className="kpi-label">
              Expired
            </div>

            <div className="kpi-value">
              {stats.expired}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              Generated Reports
            </div>

            <div className="kpi-value">
              {stats.reports}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              Archived
            </div>

            <div className="kpi-value">
              {documents.filter((document) => document.is_archived).length}
            </div>
          </div>
        </div>

        <div className="workspace-card">
          <div className="workspace-top">
            <div className="view-tabs">
              <button
                type="button"
                className={`view-tab ${
                  view === "all"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setView("all")
                }
              >
                All Documents
              </button>

              <button
                type="button"
                className={`view-tab ${
                  view === "recent"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setView("recent")
                }
              >
                Recent
              </button>

              <button
                type="button"
                className={`view-tab ${
                  view === "expiring"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setView("expiring")
                }
              >
                Expiring Soon
              </button>

              <button
                type="button"
                className={`view-tab ${
                  view === "favorites"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setView("favorites")
                }
              >
                Favorites
              </button>

              <button
                type="button"
                className={`view-tab ${
                  view === "archived"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setView("archived")
                }
              >
                Archived
              </button>
            </div>

            <div className="filter-grid">
              <input
                type="text"
                className="search-box"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search documents, numbers, filenames..."
                aria-label="Search documents"
              />

              <select
                className="filter-select"
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value,
                  )
                }
                aria-label="Filter by category"
              >
                <option value="all">
                  All Categories
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value,
                  )
                }
                aria-label="Filter by document type"
              >
                <option value="all">
                  All Types
                </option>

                {DOCUMENT_TYPES.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                  >
                    {type.label}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={ownerFilter}
                onChange={(event) =>
                  setOwnerFilter(
                    event.target.value,
                  )
                }
                aria-label="Filter by owner"
              >
                <option value="all">
                  All Owners
                </option>

                <option value="company">
                  Company
                </option>

                <option value="employee">
                  Employees
                </option>
              </select>

              <select
                className="filter-select"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
                aria-label="Filter by status"
              >
                <option value="all">
                  All Statuses
                </option>

                <option value="active">
                  Active
                </option>

                <option value="expiring">
                  Expiring
                </option>

                <option value="expired">
                  Expired
                </option>

                <option value="draft">
                  Draft
                </option>

                <option value="archived">
                  Archived
                </option>
              </select>

              <button
                type="button"
                className="clear-button"
                onClick={clearFilters}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="library-summary">
            <div className="library-summary-left">
              <h2>
                {view === "all"
                  ? "Document Library"
                  : view === "recent"
                    ? "Recently Added"
                    : view === "expiring"
                      ? "Documents Requiring Attention"
                      : view === "archived"
                        ? "Archived Documents"
                        : "Favorite Documents"}
              </h2>

              <span className="summary-divider" />

              <span className="summary-meta">
                {totalVisibleDocuments} document
                {totalVisibleDocuments === 1
                  ? ""
                  : "s"}
              </span>

              <span className="category-count">
                {activeCategoryCount} categor
                {activeCategoryCount === 1
                  ? "y"
                  : "ies"}
              </span>
            </div>
          </div>

          {groupedDocuments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                ▣
              </div>

              <h3>
                {documents.length === 0
                  ? "Your document center is ready"
                  : "No documents match your filters"}
              </h3>

              <p>
                {documents.length === 0
                  ? "Upload your first company, employee or business document to start building the SBS document library."
                  : "Try clearing one or more filters, or upload a new document."}
              </p>

              {documents.length === 0 && canCreate ? (
                <Link
                  href="/documents/new"
                  className="primary-button"
                >
                  + Upload First Document
                </Link>
              ) : (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="category-list">
              {groupedDocuments.map(
                (group) => {
                  const isExpanded =
                    expandedCategories.has(
                      group.key,
                    );

                  const visibleDocuments =
                    isExpanded
                      ? group.documents
                      : group.documents.slice(
                          0,
                          INITIAL_DOCUMENTS_PER_CATEGORY,
                        );

                  const remainingCount =
                    group.documents.length -
                    visibleDocuments.length;

                  const expiringCount =
                    group.documents.filter(
                      (document) =>
                        document.status ===
                        "expiring",
                    ).length;

                  const categoryName =
                    group.category?.name ||
                    "Uncategorized";

                  return (
                    <section
                      key={group.key}
                      className="category-section"
                    >
                      <div className="category-header">
                        <div className="category-header-left">
                          <div className="category-icon">
                            {group.category
                              ? getCategoryInitial(
                                  categoryName,
                                )
                              : "?"}
                          </div>

                          <div className="category-heading">
                            <div className="category-title-row">
                              <h3 className="category-title">
                                {categoryName}
                              </h3>
                            </div>

                            <p className="category-subtitle">
                              {
                                group.documents
                                  .length
                              } document
                              {group.documents
                                .length === 1
                                ? ""
                                : "s"}
                              {expiringCount >
                                0 && (
                                <>
                                  {" "}
                                  ·{" "}
                                  {
                                    expiringCount
                                  } expiring soon
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="category-header-right">
                          {expiringCount >
                            0 && (
                            <span className="category-attention">
                              {expiringCount}{" "}
                              attention
                            </span>
                          )}

                          {group.documents
                            .length >
                            INITIAL_DOCUMENTS_PER_CATEGORY && (
                            <button
                              type="button"
                              className="category-toggle"
                              onClick={() =>
                                toggleCategory(
                                  group.key,
                                )
                              }
                              aria-label={
                                isExpanded
                                  ? `Collapse ${categoryName}`
                                  : `Expand all ${categoryName} documents`
                              }
                            >
                              {isExpanded
                                ? "−"
                                : "+"}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="category-files">
                        <div className="document-list">
                          <div className="document-row header-row">
                            <div>
                              <span className="column-label">
                                Document
                              </span>
                            </div>

                            <div>
                              <span className="column-label">
                                Type
                              </span>
                            </div>

                            <div>
                              <span className="column-label">
                                Owner
                              </span>
                            </div>

                            <div>
                              <span className="column-label">
                                Expiry
                              </span>
                            </div>

                            <div>
                              <span className="column-label">
                                Status
                              </span>
                            </div>

                            <div>
                              <span className="column-label">
                                Actions
                              </span>
                            </div>
                          </div>

                          {visibleDocuments.map(
                            (document) => (
                              <div
                                key={document.id}
                                className="document-row"
                              >
                                <div>
                                  <div className="document-cell">
                                    <button
                                      type="button"
                                      className={`favorite-button ${
                                        document.is_favorite
                                          ? "active"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        void toggleFavorite(
                                          document,
                                        )
                                      }
                                      title={
                                        document.is_favorite
                                          ? "Remove favorite"
                                          : "Add favorite"
                                      }
                                      aria-label={
                                        document.is_favorite
                                          ? `Remove ${document.title} from favorites`
                                          : `Add ${document.title} to favorites`
                                      }
                                    >
                                      {document.is_favorite
                                        ? "★"
                                        : "☆"}
                                    </button>

                                    <div className="file-icon">
                                      {getFileLabel(
                                        document.mime_type,
                                      )}
                                    </div>

                                    <div className="document-main">
                                      <button
                                        type="button"
                                        className="document-title"
                                        onClick={() =>
                                          router.push(
                                            `/documents/${document.id}`,
                                          )
                                        }
                                        title={
                                          document.title
                                        }
                                      >
                                        {
                                          document.title
                                        }
                                      </button>

                                      <div className="document-meta">
                                        <span>
                                          {
                                            document.file_name
                                          }
                                        </span>

                                        <span>
                                          •
                                        </span>

                                        <span>
                                          {formatBytes(
                                            document.file_size,
                                          )}
                                        </span>

                                        {document.current_version >
                                          1 && (
                                          <>
                                            <span>
                                              •
                                            </span>

                                            <span>
                                              v
                                              {
                                                document.current_version
                                              }
                                            </span>
                                          </>
                                        )}

                                        {document.document_number && (
                                          <>
                                            <span>
                                              •
                                            </span>

                                            <span>
                                              #
                                              {
                                                document.document_number
                                              }
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <span className="type-text">
                                    {TYPE_LABELS[
                                      document
                                        .document_type
                                    ] ||
                                      document.document_type}
                                  </span>
                                </div>

                                <div>
                                  <span className="owner-text">
                                    {getOwnerLabel(
                                      document,
                                      employeeMap,
                                    )}
                                  </span>
                                </div>

                                <div>
                                  {document.expiry_date ? (
                                    <span
                                      className={`expiry-text ${
                                        document.status ===
                                        "expired"
                                          ? "danger-text"
                                          : document.status ===
                                              "expiring"
                                            ? "warning-text"
                                            : ""
                                      }`}
                                    >
                                      {formatDate(
                                        document.expiry_date,
                                      )}
                                    </span>
                                  ) : (
                                    <span className="muted">
                                      No expiry
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <span
                                    className={getStatusClass(
                                      document.status,
                                    )}
                                  >
                                    {getStatusLabel(
                                      document.status,
                                    )}
                                  </span>
                                </div>

                                <div>
                                  <div className="row-actions">
                            <button
                              type="button"
                              className="row-action view"
                              onClick={() => router.push(`/documents/${document.id}`)}
                              title="View document"
                            >
                              <span className="row-action-icon" aria-hidden="true">↗</span>
                              View
                            </button>

                            {canEdit && !document.is_archived && (
                              <button
                                type="button"
                                className="row-action edit"
                                onClick={() => router.push(`/documents/${document.id}/edit`)}
                                title="Edit document"
                              >
                                <span className="row-action-icon" aria-hidden="true">✎</span>
                                Edit
                              </button>
                            )}

                            {canArchive && !document.is_archived && (
                              <button
                                type="button"
                                className="row-action archive"
                                onClick={() =>
                                  void archiveDocument(document)
                                }
                                title="Archive document"
                              >
                                Archive
                              </button>
                            )}

                            {canArchive && document.is_archived && (
                              <button
                                type="button"
                                className="row-action restore"
                                onClick={() =>
                                  void unarchiveDocument(document)
                                }
                                title="Unarchive document"
                              >
                                Unarchive
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                className="row-action delete"
                                onClick={() =>
                                  void deleteDocument(document)
                                }
                                title="Permanently delete document"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                                </div>
                              </div>
                            ),
                          )}
                        </div>

                        {group.documents.length >
                          INITIAL_DOCUMENTS_PER_CATEGORY &&
                          !isExpanded && (
                            <div className="category-footer">
                              <button
                                type="button"
                                className="show-more-button"
                                onClick={() =>
                                  showAllCategory(
                                    group.key,
                                  )
                                }
                              >
                                View all{" "}
                                {
                                  group
                                    .documents
                                    .length
                                }{" "}
                                documents
                                {" · "}
                                {
                                  group
                                    .documents
                                    .length -
                                    INITIAL_DOCUMENTS_PER_CATEGORY
                                }{" "}
                                more
                              </button>
                            </div>
                          )}

                        {isExpanded &&
                          group.documents.length >
                            INITIAL_DOCUMENTS_PER_CATEGORY && (
                            <div className="category-footer">
                              <button
                                type="button"
                                className="show-more-button"
                                onClick={() =>
                                  toggleCategory(
                                    group.key,
                                  )
                                }
                              >
                                Show less
                              </button>
                            </div>
                          )}
                      </div>
                    </section>
                  );
                },
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}