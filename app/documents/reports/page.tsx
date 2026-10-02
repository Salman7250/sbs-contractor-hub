"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Report = {
  id: string;
  document_id: string;
  title: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  report_type: string;
  description: string | null;
  row_count: number;
  tags: string[];
  created_at: string;
  storage_path: string;
};

type Warehouse = {
  id: string;
  name: string;
};

type PurchaseOrder = {
  id: string;
  po_number: string | null;
};

type Customer = {
  id: string;
  name: string | null;
};

const REPORT_TYPES = [
  ["inventory_list", "Inventory List"],
  ["pallet_list", "Pallet / Lot List"],
  ["asset_list", "Asset List"],
  ["stock_count", "Stock Count"],
  ["purchase_list", "Purchase List"],
  ["sales_list", "Sales List"],
  ["employee_list", "Employee List"],
  ["customer_list", "Customer List"],
  ["general", "General Report"],
] as const;

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "xlsx",
  "xls",
  "csv",
  "pdf",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
];

function formatBytes(value: number) {
  if (!value) return "0 B";

  const units = ["B", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );

  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${
    units[index]
  }`;
}

function getExtension(name: string) {
  const parts = name.split(".");

  if (parts.length < 2) {
    return "FILE";
  }

  return parts[parts.length - 1].toUpperCase();
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getReportTypeLabel(type: string) {
  return (
    REPORT_TYPES.find(([value]) => value === type)?.[1] ||
    "General Report"
  );
}

async function detectCsvRows(file: File) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return 0;
  }

  return new Promise<number>((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "").trim();

      if (!text) {
        resolve(0);
        return;
      }

      const rows = text
        .split(/\r\n|\n|\r/)
        .filter(Boolean);

      resolve(Math.max(rows.length - 1, 0));
    };

    reader.onerror = () => resolve(0);

    reader.readAsText(file);
  });
}

export default function DocumentsReportsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [companyId, setCompanyId] =
    useState<string | null>(null);

  const [reports, setReports] =
    useState<Report[]>([]);

  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [purchaseOrders, setPurchaseOrders] =
    useState<PurchaseOrder[]>([]);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [file, setFile] =
    useState<File | null>(null);

  const [title, setTitle] =
    useState("");

  const [reportType, setReportType] =
    useState("inventory_list");

  const [description, setDescription] =
    useState("");

  const [warehouseId, setWarehouseId] =
    useState("");

  const [purchaseOrderId, setPurchaseOrderId] =
    useState("");

  const [customerId, setCustomerId] =
    useState("");

  const [tags, setTags] =
    useState("");

  const [rowCount, setRowCount] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

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

      const {
        data: membership,
        error: membershipError,
      } = await supabase
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

      const currentCompanyId =
        membership.company_id;

      setCompanyId(currentCompanyId);

      const [
        reportsResult,
        warehousesResult,
        purchaseOrdersResult,
        customersResult,
      ] = await Promise.all([
        supabase
          .from("document_report_metadata")
          .select(
            `
              id,
              document_id,
              report_type,
              description,
              row_count,
              tags,
              created_at,
              documents!inner(
                title,
                file_name,
                mime_type,
                file_size,
                storage_path,
                document_type
              )
            `,
          )
          .eq(
            "company_id",
            currentCompanyId,
          )
          .eq(
            "documents.document_type",
            "report",
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("warehouses")
          .select("id,name")
          .eq(
            "company_id",
            currentCompanyId,
          )
          .order("name"),

        supabase
  .from("purchase_orders")
  .select("id,po_number")
          .eq(
            "company_id",
            currentCompanyId,
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(200),

        supabase
          .from("customers")
          .select("id,name")
          .eq(
            "company_id",
            currentCompanyId,
          )
          .order("name")
          .limit(200),
      ]);

      if (reportsResult.error) {
        throw reportsResult.error;
      }

      if (warehousesResult.error) {
        throw warehousesResult.error;
      }

      if (purchaseOrdersResult.error) {
        throw purchaseOrdersResult.error;
      }

      if (customersResult.error) {
        throw customersResult.error;
      }

      const normalizedReports: Report[] =
        (reportsResult.data || []).map(
          (row: any) => {
            const document = Array.isArray(
              row.documents,
            )
              ? row.documents[0]
              : row.documents;

            return {
              id: row.id,
              document_id: row.document_id,
              title:
                document?.title ||
                "Untitled report",
              file_name:
                document?.file_name ||
                "file",
              mime_type:
                document?.mime_type ||
                "application/octet-stream",
              file_size: Number(
                document?.file_size || 0,
              ),
              report_type:
                row.report_type,
              description:
                row.description,
              row_count: Number(
                row.row_count || 0,
              ),
              tags: Array.isArray(row.tags)
                ? row.tags
                : [],
              created_at:
                row.created_at,
              storage_path:
                document?.storage_path ||
                "",
            };
          },
        );

      setReports(normalizedReports);

      setWarehouses(
        warehousesResult.data || [],
      );

      setPurchaseOrders(
        purchaseOrdersResult.data || [],
      );

      setCustomers(
        customersResult.data || [],
      );
    } catch (loadError) {
      console.error(
        "REPORTS LOAD ERROR:",
        loadError,
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load reports.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const handleFileChange = async (
    nextFile: File | null,
  ) => {
    setError("");

    if (!nextFile) {
      return;
    }

    if (nextFile.size > MAX_FILE_SIZE) {
      setError(
        "The selected file is larger than the 25 MB limit.",
      );
      return;
    }

    const extension =
      nextFile.name
        .split(".")
        .pop()
        ?.toLowerCase() || "";

    if (
      !ALLOWED_EXTENSIONS.includes(
        extension,
      )
    ) {
      setError(
        "Reports support XLSX, XLS, CSV, PDF, DOC, DOCX, JPG and PNG files.",
      );
      return;
    }

    setFile(nextFile);

    if (!title.trim()) {
      setTitle(
        nextFile.name.replace(
          /\.[^/.]+$/,
          "",
        ),
      );
    }

    const detectedRows =
      await detectCsvRows(nextFile);

    if (detectedRows) {
      setRowCount(
        String(detectedRows),
      );
    }
  };

  const handleUpload = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (uploading) {
      return;
    }

    setError("");

    if (!companyId) {
      setError(
        "Company workspace could not be resolved.",
      );
      return;
    }

    if (!title.trim()) {
      setError(
        "Report title is required.",
      );
      return;
    }

    if (!file) {
      setError(
        "Please select the report file.",
      );
      return;
    }

    try {
      setUploading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      const safeFileName =
        sanitizeFileName(
          file.name,
        ) || "report";

      const storagePath = [
        companyId,
        "reports",
        `${Date.now()}-${crypto.randomUUID()}`,
        safeFileName,
      ].join("/");

      const {
        error: uploadError,
      } = await supabase.storage
        .from("documents")
        .upload(
          storagePath,
          file,
          {
            cacheControl: "3600",
            contentType:
              file.type ||
              "application/octet-stream",
            upsert: false,
          },
        );

      if (uploadError) {
        throw new Error(
          `File upload failed: ${uploadError.message}`,
        );
      }

      const {
        data: document,
        error: documentError,
      } = await supabase
        .from("documents")
        .insert({
          company_id: companyId,
          title: title.trim(),
          document_type: "report",
          description:
            description.trim() ||
            null,
          category_id: null,
          status: "active",
          access_level: "company",
          owner_type: "company",
          file_name: file.name,
          mime_type:
            file.type ||
            "application/octet-stream",
          file_size: file.size,
          storage_path:
            storagePath,
          current_version: 1,
          is_favorite: false,
          is_archived: false,
          created_by: user.id,
          updated_by: user.id,
        })
        .select("id")
        .single();

      if (documentError) {
        await supabase.storage
          .from("documents")
          .remove([storagePath]);

        throw documentError;
      }

      const {
        error: versionError,
      } = await supabase
        .from("document_versions")
        .insert({
          company_id: companyId,
          document_id:
            document.id,
          version_number: 1,
          file_name:
            file.name,
          mime_type:
            file.type ||
            "application/octet-stream",
          file_size:
            file.size,
          storage_path:
            storagePath,
          change_note:
            "Initial report upload.",
          created_by:
            user.id,
        });

      if (versionError) {
        await supabase
          .from("documents")
          .delete()
          .eq(
            "id",
            document.id,
          )
          .eq(
            "company_id",
            companyId,
          );

        await supabase.storage
          .from("documents")
          .remove([
            storagePath,
          ]);

        throw versionError;
      }

      const {
        error: metadataError,
      } = await supabase
        .from(
          "document_report_metadata",
        )
        .insert({
          company_id:
            companyId,
          document_id:
            document.id,
          report_type:
            reportType,
          description:
            description.trim() ||
            null,
          related_warehouse_id:
            warehouseId || null,
          related_purchase_order_id:
            purchaseOrderId ||
            null,
          related_customer_id:
            customerId || null,
          tags: tags
            .split(",")
            .map(
              (tag) =>
                tag.trim(),
            )
            .filter(Boolean)
            .slice(0, 30),
          row_count: Math.max(
            Number(rowCount) ||
              0,
            0,
          ),
          created_by:
            user.id,
        });

      if (metadataError) {
        await supabase
          .from("documents")
          .delete()
          .eq(
            "id",
            document.id,
          )
          .eq(
            "company_id",
            companyId,
          );

        await supabase.storage
          .from("documents")
          .remove([
            storagePath,
          ]);

        throw metadataError;
      }

      await supabase
        .from("document_activity")
        .insert({
          company_id:
            companyId,
          document_id:
            document.id,
          action:
            "created",
          message: `Report "${title.trim()}" was uploaded.`,
          metadata: {
            report_type:
              reportType,
            row_count:
              Number(
                rowCount,
              ) || 0,
            file_name:
              file.name,
          },
          created_by:
            user.id,
        });

      setFile(null);
      setTitle("");
      setDescription("");
      setWarehouseId("");
      setPurchaseOrderId("");
      setCustomerId("");
      setTags("");
      setRowCount("");

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }

      await loadReports();
    } catch (uploadError) {
      console.error(
        "REPORT UPLOAD ERROR:",
        uploadError,
      );

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload report.",
      );
    } finally {
      setUploading(false);
    }
  };

  const filteredReports =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return reports;
      }

      return reports.filter(
        (report) => {
          const searchableText = [
            report.title,
            report.file_name,
            report.description ||
              "",
            report.tags.join(" "),
            getReportTypeLabel(
              report.report_type,
            ),
          ]
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            query,
          );
        },
      );
    }, [reports, search]);

  const handleDownload = async (
    report: Report,
  ) => {
    if (!report.storage_path) {
      setError(
        "This report does not have a storage file.",
      );
      return;
    }

    const {
      data,
      error: signedUrlError,
    } = await supabase.storage
      .from("documents")
      .createSignedUrl(
        report.storage_path,
        300,
        {
          download:
            report.file_name,
        },
      );

    if (
      signedUrlError ||
      !data?.signedUrl
    ) {
      setError(
        signedUrlError?.message ||
          "Unable to create a secure download link.",
      );
      return;
    }

    window.open(
      data.signedUrl,
      "_blank",
      "noopener,noreferrer",
    );
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>
              Loading Reports...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content reports-page">
        <style jsx>{`
          .reports-page {
            min-width: 0;
            max-width: 1400px;
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
            font-weight: 750;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .eyebrow-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #16a34a;
            box-shadow:
              0 0 0 4px #dcfce7;
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
            max-width: 760px;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 9px;
            flex-wrap: wrap;
          }

          .button {
            min-height: 40px;
            border-radius: 10px;
            padding: 0 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid #dbe2ea;
            background: #fff;
            color: #334155;
            font-size: 13px;
            font-weight: 750;
            text-decoration: none;
            cursor: pointer;
            font-family: inherit;
            appearance: none;
            line-height: 1;
            box-sizing: border-box;
            transition:
              background 160ms ease,
              border-color 160ms ease,
              color 160ms ease;
          }

          .button:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
          }

          .button:focus-visible {
            outline: none;
            border-color: #86efac;
            box-shadow: 0 0 0 3px #f0fdf4;
          }

          .button.primary {
            color: #fff;
            background: #166534;
            border-color: #166534;
          }

          .button.primary:hover {
            background: #14532d;
            border-color: #14532d;
          }

          .button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .error-banner {
            margin-bottom: 18px;
            padding: 12px 14px;
            border: 1px solid #fecaca;
            border-radius: 10px;
            background: #fef2f2;
            color: #991b1b;
            font-size: 13px;
          }

          .workspace-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1.25fr)
              minmax(340px, 0.75fr);
            gap: 18px;
            margin-bottom: 18px;
          }

          .card {
            overflow: hidden;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow:
              0 2px 10px
              rgba(15, 23, 42, 0.035);
          }

          .card-header {
            padding: 17px 19px;
            border-bottom: 1px solid #eef2f7;
          }

          .card-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
            font-weight: 750;
          }

          .card-header p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .card-body {
            padding: 19px;
          }

          .fields {
            display: grid;
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .field.full {
            grid-column: 1 / -1;
          }

          .field label {
            display: block;
            margin-bottom: 7px;
            color: #334155;
            font-size: 12px;
            font-weight: 750;
          }

          .required {
            color: #dc2626;
          }

          .input,
          .select,
          .textarea {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #dbe2ea;
            border-radius: 9px;
            background: #fff;
            color: #1e293b;
            font-size: 13px;
            outline: none;
          }

          .input,
          .select {
            height: 42px;
            padding: 0 11px;
          }

          .textarea {
            min-height: 88px;
            padding: 10px;
            resize: vertical;
          }

          .input:focus,
          .select:focus,
          .textarea:focus {
            border-color: #86efac;
            box-shadow:
              0 0 0 3px #f0fdf4;
          }

          .file-drop {
            min-height: 170px;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            border: 1.5px dashed #cbd5e1;
            border-radius: 11px;
            background: #f8fafc;
            cursor: pointer;
            transition:
              background 160ms ease,
              border-color 160ms ease;
          }

          .file-drop:hover {
            background: #f0fdf4;
            border-color: #4ade80;
          }

          .file-selected {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            text-align: left;
          }

          .file-badge {
            width: 48px;
            height: 48px;
            flex: 0 0 48px;
            display: grid;
            place-items: center;
            border-radius: 11px;
            background: #dcfce7;
            color: #166534;
            font-size: 10px;
            font-weight: 850;
          }

          .file-name {
            overflow: hidden;
            color: #0f172a;
            font-size: 13px;
            font-weight: 750;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .muted {
            margin-top: 4px;
            color: #94a3b8;
            font-size: 11px;
          }

          .hint {
            margin-top: 6px;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.5;
          }

          .workflow {
            display: grid;
            gap: 14px;
          }

          .workflow-item {
            display: flex;
            align-items: flex-start;
            gap: 11px;
          }

          .workflow-number {
            width: 29px;
            height: 29px;
            flex: 0 0 29px;
            display: grid;
            place-items: center;
            border-radius: 9px;
            background: #f0fdf4;
            color: #166534;
            font-size: 11px;
            font-weight: 850;
          }

          .workflow-item strong {
            display: block;
            color: #0f172a;
            font-size: 12px;
          }

          .workflow-item span {
            display: block;
            margin-top: 3px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .search-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 14px;
          }

          .search-box {
            width: min(340px, 100%);
            height: 40px;
            box-sizing: border-box;
            border: 1px solid #dbe2ea;
            border-radius: 9px;
            padding: 0 12px;
            color: #1e293b;
            font-size: 13px;
            outline: none;
          }

          .search-box:focus {
            border-color: #86efac;
            box-shadow:
              0 0 0 3px #f0fdf4;
          }

          .report-count {
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
          }

          .table-wrap {
            overflow-x: auto;
          }

          .table {
            width: 100%;
            min-width: 950px;
            border-collapse: collapse;
          }

          .table th {
            padding: 11px 16px;
            background: #f8fafc;
            color: #64748b;
            text-align: left;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .table td {
            padding: 13px 16px;
            border-top: 1px solid #f1f5f9;
            color: #334155;
            font-size: 13px;
            vertical-align: middle;
          }

          .table tbody tr:hover {
            background: #fafafa;
          }

          .report-title {
            color: #0f172a;
            font-weight: 750;
            text-decoration: none;
          }

          .report-title:hover {
            color: #166534;
          }

          .type-badge {
            display: inline-flex;
            padding: 5px 8px;
            border-radius: 999px;
            background: #f0fdf4;
            color: #166534;
            font-size: 11px;
            font-weight: 750;
            white-space: nowrap;
          }

          .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
          }

          .tag {
            padding: 4px 7px;
            border-radius: 999px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 10px;
          }

          .empty {
            padding: 54px 20px;
            color: #64748b;
            text-align: center;
            font-size: 13px;
          }

          @media (max-width: 1050px) {
            .workspace-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 700px) {
            .page-header {
              flex-direction: column;
            }

            .fields {
              grid-template-columns: 1fr;
            }

            .field.full {
              grid-column: auto;
            }

            .search-header {
              align-items: stretch;
              flex-direction: column;
            }

            .search-box {
              width: 100%;
            }
          }
        `}</style>

        <header className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Reports & Lists
            </div>

            <h1>
              Operational Reports
            </h1>

            <p className="page-description">
              Keep Excel lists, pallet reports,
              stock counts and other operational
              files inside the SBS document chamber.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button"
              onClick={() => router.push("/documents")}
            >
              ← Documents
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        <div className="workspace-grid">
          <form
            className="card"
            onSubmit={handleUpload}
          >
            <div className="card-header">
              <h2>
                Upload Report or List
              </h2>

              <p>
                Upload the Excel, CSV or document
                your team uses for operational work.
              </p>
            </div>

            <div className="card-body">
              <div className="fields">
                <div className="field full">
                  <label>
                    Report File{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <div
                    className="file-drop"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    <input
                      ref={fileInputRef}
                      hidden
                      type="file"
                      accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        void handleFileChange(
                          event.target.files?.[0] ||
                            null,
                        )
                      }
                    />

                    {file ? (
                      <div className="file-selected">
                        <div className="file-badge">
                          {getExtension(
                            file.name,
                          )}
                        </div>

                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div className="file-name">
                            {file.name}
                          </div>

                          <div className="muted">
                            {formatBytes(
                              file.size,
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <strong>
                          Drop or choose a report file
                        </strong>

                        <div className="muted">
                          XLSX, XLS, CSV, PDF,
                          DOC, DOCX, JPG or PNG
                          · 25 MB max
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="field full">
                  <label>
                    Report Title{" "}
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    className="input"
                    value={title}
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )
                    }
                    placeholder="Laptop Pallet P1042 - Inventory List"
                  />
                </div>

                <div className="field">
                  <label>
                    Report Type
                  </label>

                  <select
                    className="select"
                    value={reportType}
                    onChange={(event) =>
                      setReportType(
                        event.target.value,
                      )
                    }
                  >
                    {REPORT_TYPES.map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Rows / Items
                  </label>

                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={rowCount}
                    onChange={(event) =>
                      setRowCount(
                        event.target.value,
                      )
                    }
                    placeholder="e.g. 46"
                  />
                </div>

                <div className="field">
                  <label>
                    Warehouse
                  </label>

                  <select
                    className="select"
                    value={warehouseId}
                    onChange={(event) =>
                      setWarehouseId(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Not linked
                    </option>

                    {warehouses.map(
                      (warehouse) => (
                        <option
                          key={warehouse.id}
                          value={warehouse.id}
                        >
                          {warehouse.name}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Purchase Order
                  </label>

                  <select
                    className="select"
                    value={purchaseOrderId}
                    onChange={(event) =>
                      setPurchaseOrderId(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Not linked
                    </option>

                    {purchaseOrders.map(
                      (purchaseOrder) => (
                        <option
                          key={
                            purchaseOrder.id
                          }
                          value={
                            purchaseOrder.id
                          }
                        >
                          {purchaseOrder.po_number ||
                            purchaseOrder.id.slice(
                              0,
                              8,
                            )}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Customer
                  </label>

                  <select
                    className="select"
                    value={customerId}
                    onChange={(event) =>
                      setCustomerId(
                        event.target.value,
                      )
                    }
                  >
                    <option value="">
                      Not linked
                    </option>

                    {customers.map(
                      (customer) => (
                        <option
                          key={customer.id}
                          value={customer.id}
                        >
                          {customer.name ||
                            "Unnamed customer"}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="field">
                  <label>
                    Tags
                  </label>

                  <input
                    className="input"
                    value={tags}
                    onChange={(event) =>
                      setTags(
                        event.target.value,
                      )
                    }
                    placeholder="pallet, laptops, october"
                  />
                </div>

                <div className="field full">
                  <label>
                    Description
                  </label>

                  <textarea
                    className="textarea"
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )
                    }
                    placeholder="What is this list or report documenting?"
                  />
                </div>

                <div className="field full">
                  <button
                    className="button primary"
                    type="submit"
                    disabled={uploading}
                  >
                    {uploading
                      ? "Uploading..."
                      : "Upload Report"}
                  </button>

                  <div className="hint">
                    Reports are stored inside the
                    company's secure Documents
                    storage and become available
                    from the central document chamber.
                  </div>
                </div>
              </div>
            </div>
          </form>

          <section className="card">
            <div className="card-header">
              <h2>
                Report Workflow
              </h2>

              <p>
                Keep operational lists tied to the
                business context that produced them.
              </p>
            </div>

            <div className="card-body">
              <div className="workflow">
                {[
                  [
                    "1",
                    "Create the list",
                    "Make your Excel or CSV list exactly as requested.",
                  ],
                  [
                    "2",
                    "Upload it",
                    "Store it in Reports & Lists with a clear title.",
                  ],
                  [
                    "3",
                    "Link context",
                    "Attach a warehouse, purchase order or customer when relevant.",
                  ],
                  [
                    "4",
                    "Find it later",
                    "Search the central chamber instead of hunting through computers or chats.",
                  ],
                ].map(
                  ([
                    number,
                    heading,
                    text,
                  ]) => (
                    <div
                      className="workflow-item"
                      key={number}
                    >
                      <div className="workflow-number">
                        {number}
                      </div>

                      <div>
                        <strong>
                          {heading}
                        </strong>

                        <span>
                          {text}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="card">
          <div className="card-header">
            <div className="search-header">
              <div>
                <h2>
                  Saved Reports & Lists
                </h2>

                <p>
                  Operational files already stored
                  in the Documents chamber.
                </p>
              </div>

              <span className="report-count">
                {filteredReports.length}{" "}
                {filteredReports.length === 1
                  ? "report"
                  : "reports"}
              </span>
            </div>

            <div
              style={{
                marginTop: 14,
              }}
            >
              <input
                className="search-box"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search reports, filenames, tags..."
              />
            </div>
          </div>

          {filteredReports.length ===
          0 ? (
            <div className="empty">
              No saved reports match your
              search.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>
                      Report
                    </th>

                    <th>
                      Type
                    </th>

                    <th>
                      File
                    </th>

                    <th>
                      Items
                    </th>

                    <th>
                      Tags
                    </th>

                    <th>
                      Created
                    </th>

                    <th />
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.map(
                    (report) => (
                      <tr
                        key={report.id}
                      >
                        <td>
                          <Link
                            href={`/documents/${report.document_id}`}
                            className="report-title"
                          >
                            {report.title}
                          </Link>

                          {report.description && (
                            <div className="muted">
                              {
                                report.description
                              }
                            </div>
                          )}
                        </td>

                        <td>
                          <span className="type-badge">
                            {getReportTypeLabel(
                              report.report_type,
                            )}
                          </span>
                        </td>

                        <td>
                          <div>
                            {
                              report.file_name
                            }
                          </div>

                          <div className="muted">
                            {formatBytes(
                              report.file_size,
                            )}
                          </div>
                        </td>

                        <td>
                          {report.row_count ||
                            "—"}
                        </td>

                        <td>
                          <div className="tags">
                            {report.tags
                              .slice(
                                0,
                                5,
                              )
                              .map(
                                (
                                  tag,
                                ) => (
                                  <span
                                    className="tag"
                                    key={tag}
                                  >
                                    {tag}
                                  </span>
                                ),
                              )}
                          </div>
                        </td>

                        <td>
                          {new Intl.DateTimeFormat(
                            "en",
                            {
                              month:
                                "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          ).format(
                            new Date(
                              report.created_at,
                            ),
                          )}
                        </td>

                        <td>
                          <button
                            className="button"
                            type="button"
                            onClick={() =>
                              void handleDownload(
                                report,
                              )
                            }
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}