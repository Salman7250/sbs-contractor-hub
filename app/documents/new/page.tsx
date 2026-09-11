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
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AppShell from "@/app/components/app-shell";

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
  employee_number: string | null;
};

type OwnerType = "company" | "employee";
type AccessLevel = "company" | "restricted" | "private";

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

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
  "application/zip",
];

function getEmployeeName(employee: Employee) {
  return (
    employee.display_name ||
    `${employee.first_name} ${employee.last_name}`.trim() ||
    "Employee"
  );
}

function getFileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getFileExtension(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

export default function NewDocumentPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [ownerType, setOwnerType] =
    useState<OwnerType>("company");

  const [title, setTitle] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentType, setDocumentType] = useState("other");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [documentReference, setDocumentReference] =
    useState("");

  const [employeeId, setEmployeeId] = useState("");

  const [accessLevel, setAccessLevel] =
    useState<AccessLevel>("company");

  const [isFavorite, setIsFavorite] = useState(false);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [dragActive, setDragActive] = useState(false);

  const loadFormData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
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
        throw new Error(
          "No company workspace is assigned to your account.",
        );
      }

      const currentCompanyId = membership.company_id;

      setCompanyId(currentCompanyId);

      const [categoriesResult, employeesResult] =
        await Promise.all([
          supabase
            .from("document_categories")
            .select("id,name,slug")
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("sort_order", {
              ascending: true,
            })
            .order("name", {
              ascending: true,
            }),

          supabase.rpc("get_company_document_employees", {
  p_company_id: currentCompanyId,
}),
        ]);

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      if (employeesResult.error) {
        throw employeesResult.error;
      }

      setCategories(
        (categoriesResult.data || []) as Category[],
      );

      setEmployees(
        (employeesResult.data || []) as Employee[],
      );
    } catch (error) {
      console.error(
        "DOCUMENT FORM LOAD ERROR:",
        error,
      );

      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load document form.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadFormData();
  }, [loadFormData]);

  const handleFile = (file: File | null) => {
    setErrorMessage("");
    setSuccessMessage("");

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        "The selected file is larger than the 25 MB limit.",
      );
      return;
    }

    if (
      file.type &&
      !ALLOWED_FILE_TYPES.includes(file.type)
    ) {
      setErrorMessage(
        "This file type is not supported. Use PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG or ZIP.",
      );
      return;
    }

    const extension = getFileExtension(file.name);

    const allowedExtensions = [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "csv",
      "jpg",
      "jpeg",
      "png",
      "zip",
    ];

    if (
      extension &&
      !allowedExtensions.includes(extension)
    ) {
      setErrorMessage(
        "This file extension is not supported.",
      );
      return;
    }

    setSelectedFile(file);

    if (!title.trim()) {
      const withoutExtension = file.name.replace(
        /\.[^/.]+$/,
        "",
      );

      setTitle(withoutExtension);
    }
  };

  const handleFileInput = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    handleFile(event.target.files?.[0] || null);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    setDragActive(false);

    handleFile(
      event.dataTransfer.files?.[0] || null,
    );
  };

  const generateDocumentNumber =
    async (): Promise<string> => {
      if (!companyId) {
        throw new Error(
          "Company workspace could not be resolved.",
        );
      }

      const prefix = "DOC-";

      const { data, error } = await supabase
        .from("documents")
        .select("document_number")
        .eq("company_id", companyId)
        .like("document_number", `${prefix}%`)
        .order("document_number", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      let nextNumber = 1;

      if (data?.document_number) {
        const numericPart = Number(
          data.document_number.replace(prefix, ""),
        );

        if (Number.isFinite(numericPart)) {
          nextNumber = numericPart + 1;
        }
      }

      return `${prefix}${String(nextNumber).padStart(5, "0")}`;
    };

  const validateForm = () => {
    if (!companyId) {
      return "Company workspace could not be resolved.";
    }

    if (!userId) {
      return "Your authenticated user could not be resolved.";
    }

    if (!title.trim()) {
      return "Document title is required.";
    }

    if (!selectedFile) {
      return "Please select a document file.";
    }

    if (ownerType === "employee" && !employeeId) {
      return "Please select the employee this document belongs to.";
    }

    if (
      issueDate &&
      expiryDate &&
      expiryDate < issueDate
    ) {
      return "Expiry date cannot be earlier than issue date.";
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      return "The selected file is larger than the 25 MB limit.";
    }

    return "";
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (submitting) return;

    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (
      !companyId ||
      !userId ||
      !selectedFile
    ) {
      return;
    }

    try {
      setSubmitting(true);

      const documentNumberValue =
        documentNumber.trim() ||
        (await generateDocumentNumber());

      const safeFileName =
        sanitizeFileName(selectedFile.name) ||
        "document";

      const uniquePart = `${Date.now()}-${crypto.randomUUID()}`;

      const storagePath = [
        companyId,
        "documents",
        uniquePart,
        safeFileName,
      ].join("/");

      const { error: uploadError } =
        await supabase.storage
          .from("documents")
          .upload(
            storagePath,
            selectedFile,
            {
              cacheControl: "3600",
              contentType:
                selectedFile.type ||
                "application/octet-stream",
              upsert: false,
            },
          );

      if (uploadError) {
        throw new Error(
          `File upload failed: ${uploadError.message}`,
        );
      }

      const { data: document, error: documentError } =
        await supabase
          .from("documents")
          .insert({
            company_id: companyId,
            category_id:
              categoryId || null,
            document_number:
              documentNumberValue,
            title: title.trim(),
            document_type:
              documentType,
            description:
              description.trim() || null,
            status: "active",
            access_level: accessLevel,
            owner_type: ownerType,
            owner_employee_id:
              ownerType === "employee"
                ? employeeId
                : null,
            issue_date:
              issueDate || null,
            expiry_date:
              expiryDate || null,
            issuing_authority:
              issuingAuthority.trim() || null,
            document_reference:
              documentReference.trim() || null,
            file_name:
              selectedFile.name,
            mime_type:
              selectedFile.type ||
              "application/octet-stream",
            file_size:
              selectedFile.size,
            storage_path:
              storagePath,
            current_version: 1,
            is_favorite:
              isFavorite,
            is_archived: false,
            created_by: userId,
            updated_by: userId,
          })
          .select("id,title")
          .single();

      if (documentError) {
        await supabase.storage
          .from("documents")
          .remove([storagePath]);

        throw documentError;
      }

      const { error: versionError } =
        await supabase
          .from("document_versions")
          .insert({
            company_id: companyId,
            document_id: document.id,
            version_number: 1,
            file_name:
              selectedFile.name,
            mime_type:
              selectedFile.type ||
              "application/octet-stream",
            file_size:
              selectedFile.size,
            storage_path:
              storagePath,
            change_note:
              "Initial document upload.",
            created_by: userId,
          });

      if (versionError) {
        await supabase
          .from("documents")
          .delete()
          .eq("id", document.id)
          .eq("company_id", companyId);

        await supabase.storage
          .from("documents")
          .remove([storagePath]);

        throw versionError;
      }

      const { error: activityError } =
        await supabase
          .from("document_activity")
          .insert({
            company_id: companyId,
            document_id: document.id,
            action: "created",
            message: `Document "${title.trim()}" was uploaded.`,
            metadata: {
              file_name:
                selectedFile.name,
              file_size:
                selectedFile.size,
              document_type:
                documentType,
              owner_type:
                ownerType,
              owner_employee_id:
                ownerType === "employee"
                  ? employeeId
                  : null,
            },
            created_by: userId,
          });

      if (activityError) {
        console.warn(
          "DOCUMENT ACTIVITY WARNING:",
          activityError,
        );
      }

      setSuccessMessage(
        "Document uploaded successfully. Opening document...",
      );

      setTimeout(() => {
        router.push(
          `/documents/${document.id}`,
        );
      }, 500);
    } catch (error) {
      console.error(
        "CREATE DOCUMENT ERROR:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to create document.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>
              Loading document workspace...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="error-card">
            <div className="error-icon">
              !
            </div>

            <h2>
              Unable to open document workspace
            </h2>

            <p>{loadError}</p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void loadFormData()
              }
            >
              Try Again
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content documents-new-page">
        <style jsx>{`
          .documents-new-page {
            min-width: 0;
            max-width: 1280px;
          }

          .page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }

          .header-copy {
            min-width: 0;
          }

          .back-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 10px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            text-decoration: none;
          }

          .back-link:hover {
            color: #166534;
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
            max-width: 720px;
            margin: 7px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          .layout {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 350px;
            gap: 18px;
            align-items: start;
          }

          .card {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow: 0 2px 10px rgba(15, 23, 42, 0.035);
          }

          .card + .card {
            margin-top: 18px;
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
            line-height: 1.55;
          }

          .card-body {
            padding: 19px;
          }

          .field-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
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
            color: #1e293b;
            background: #fff;
            border: 1px solid #dbe2ea;
            border-radius: 9px;
            font-size: 13px;
            outline: none;
            transition: 150ms ease;
            box-sizing: border-box;
          }

          .input,
          .select {
            height: 42px;
            padding: 0 11px;
          }

          .textarea {
            min-height: 104px;
            padding: 11px;
            resize: vertical;
            line-height: 1.55;
          }

          .input:focus,
          .select:focus,
          .textarea:focus {
            border-color: #86efac;
            box-shadow: 0 0 0 3px #f0fdf4;
          }

          .input::placeholder,
          .textarea::placeholder {
            color: #a1aab7;
          }

          .field-help {
            margin-top: 5px;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.45;
          }

          .owner-switch {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .owner-option {
            position: relative;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 13px;
            color: #475569;
            background: #fff;
            border: 1px solid #dbe2ea;
            border-radius: 10px;
            cursor: pointer;
            transition: 150ms ease;
          }

          .owner-option:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
          }

          .owner-option.active {
            color: #14532d;
            background: #f0fdf4;
            border-color: #86efac;
          }

          .radio-dot {
            width: 17px;
            height: 17px;
            flex: 0 0 17px;
            margin-top: 1px;
            border: 2px solid #cbd5e1;
            border-radius: 50%;
            box-sizing: border-box;
          }

          .owner-option.active .radio-dot {
            border-color: #16a34a;
            box-shadow: inset 0 0 0 4px #fff;
            background: #16a34a;
          }

          .owner-option-title {
            display: block;
            margin-bottom: 2px;
            color: #0f172a;
            font-size: 12px;
            font-weight: 750;
          }

          .owner-option-description {
            display: block;
            color: #64748b;
            font-size: 11px;
            line-height: 1.45;
          }

          .upload-zone {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 220px;
            padding: 24px;
            text-align: center;
            background: #f8fafc;
            border: 1.5px dashed #cbd5e1;
            border-radius: 12px;
            cursor: pointer;
            transition: 150ms ease;
            box-sizing: border-box;
          }

          .upload-zone:hover,
          .upload-zone.drag-active {
            background: #f0fdf4;
            border-color: #4ade80;
          }

          .upload-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 500px;
          }

          .upload-icon {
            display: grid;
            place-items: center;
            width: 54px;
            height: 54px;
            margin-bottom: 12px;
            color: #166534;
            background: #dcfce7;
            border-radius: 15px;
            font-size: 24px;
            font-weight: 800;
          }

          .upload-title {
            color: #0f172a;
            font-size: 14px;
            font-weight: 750;
          }

          .upload-description {
            margin-top: 5px;
            color: #64748b;
            font-size: 12px;
            line-height: 1.55;
          }

          .upload-types {
            margin-top: 9px;
            color: #94a3b8;
            font-size: 11px;
          }

          .file-selected {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            max-width: 620px;
            padding: 13px;
            text-align: left;
            background: #fff;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
          }

          .selected-file-icon {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            flex: 0 0 42px;
            color: #166534;
            background: #dcfce7;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 800;
          }

          .selected-file-info {
            min-width: 0;
            flex: 1;
          }

          .selected-file-name {
            overflow: hidden;
            color: #0f172a;
            font-size: 13px;
            font-weight: 750;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .selected-file-size {
            margin-top: 4px;
            color: #64748b;
            font-size: 11px;
          }

          .remove-file {
            height: 32px;
            padding: 0 9px;
            color: #b91c1c;
            background: #fff;
            border: 1px solid #fecaca;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
          }

          .remove-file:hover {
            background: #fef2f2;
          }

          .access-list {
            display: grid;
            gap: 9px;
          }

          .access-option {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 12px;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            cursor: pointer;
          }

          .access-option:hover {
            background: #f8fafc;
          }

          .access-option.selected {
            background: #f8fafc;
            border-color: #bbf7d0;
          }

          .access-radio {
            width: 17px;
            height: 17px;
            flex: 0 0 17px;
            margin-top: 1px;
            accent-color: #16a34a;
          }

          .access-title {
            color: #0f172a;
            font-size: 12px;
            font-weight: 750;
          }

          .access-description {
            margin-top: 2px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.45;
          }

          .favorite-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 13px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
          }

          .favorite-copy strong {
            display: block;
            color: #0f172a;
            font-size: 12px;
            font-weight: 750;
          }

          .favorite-copy span {
            display: block;
            margin-top: 3px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.4;
          }

          .toggle {
            position: relative;
            width: 40px;
            height: 23px;
            flex: 0 0 40px;
            padding: 0;
            background: #cbd5e1;
            border: 0;
            border-radius: 999px;
            cursor: pointer;
            transition: 150ms ease;
          }

          .toggle.active {
            background: #16a34a;
          }

          .toggle-knob {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 17px;
            height: 17px;
            background: #fff;
            border-radius: 50%;
            transition: 150ms ease;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
          }

          .toggle.active .toggle-knob {
            transform: translateX(17px);
          }

          .side-note {
            padding: 13px;
            color: #475569;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            font-size: 11px;
            line-height: 1.6;
          }

          .side-note strong {
            color: #0f172a;
          }

          .actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 10px;
            padding-top: 18px;
            margin-top: 18px;
            border-top: 1px solid #eef2f7;
          }

          .primary-button,
          .secondary-button {
            min-height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 0 15px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
            transition: 150ms ease;
          }

          .primary-button {
            color: #fff;
            background: #166534;
            border: 1px solid #166534;
          }

          .primary-button:hover {
            background: #14532d;
          }

          .primary-button:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }

          .secondary-button {
            color: #334155;
            background: #fff;
            border: 1px solid #dbe2ea;
          }

          .secondary-button:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
          }

          .alert {
            margin-bottom: 18px;
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 13px;
            line-height: 1.5;
          }

          .alert-error {
            color: #991b1b;
            background: #fef2f2;
            border: 1px solid #fecaca;
          }

          .alert-success {
            color: #166534;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
          }

          .error-card {
            max-width: 560px;
            margin: 50px auto;
            padding: 32px;
            text-align: center;
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow: 0 2px 10px rgba(15, 23, 42, 0.035);
          }

          .error-icon {
            display: grid;
            place-items: center;
            width: 48px;
            height: 48px;
            margin: 0 auto 14px;
            color: #b91c1c;
            background: #fee2e2;
            border-radius: 14px;
            font-size: 20px;
            font-weight: 800;
          }

          .error-card h2 {
            margin: 0;
            color: #0f172a;
            font-size: 18px;
            font-weight: 750;
          }

          .error-card p {
            margin: 8px 0 20px;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
          }

          @media (max-width: 1050px) {
            .layout {
              grid-template-columns: 1fr;
            }

            .side-column {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 18px;
            }

            .side-column .card + .card {
              margin-top: 0;
            }
          }

          @media (max-width: 760px) {
            .field-grid,
            .owner-switch,
            .side-column {
              grid-template-columns: 1fr;
            }

            .field.full {
              grid-column: auto;
            }

            .page-header {
              flex-direction: column;
            }

            .actions {
              flex-direction: column-reverse;
              align-items: stretch;
            }

            .actions > * {
              width: 100%;
            }
          }
        `}</style>

        <div className="page-header">
          <div className="header-copy">
            <Link
              href="/documents"
              className="back-link"
            >
              ← Back to Documents
            </Link>

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Secure Document Upload
            </div>

            <h1>
              Upload Document
            </h1>

            <p className="page-description">
              Add a company record, employee file,
              certificate, contract, license, report or
              other business document to the SBS vault.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="layout">
            <div className="main-column">
              <div className="card">
                <div className="card-header">
                  <h2>
                    Document File
                  </h2>

                  <p>
                    The uploaded file is stored in the
                    private Documents storage area.
                  </p>
                </div>

                <div className="card-body">
                  <div
                    className={`upload-zone ${
                      dragActive
                        ? "drag-active"
                        : ""
                    }`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() =>
                      setDragActive(false)
                    }
                    onDrop={handleDrop}
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      hidden
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.zip"
                      onChange={handleFileInput}
                    />

                    {selectedFile ? (
                      <div
                        className="file-selected"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <div className="selected-file-icon">
                          {getFileExtension(
                            selectedFile.name,
                          )
                            .slice(0, 4)
                            .toUpperCase() ||
                            "FILE"}
                        </div>

                        <div className="selected-file-info">
                          <div
                            className="selected-file-name"
                            title={
                              selectedFile.name
                            }
                          >
                            {selectedFile.name}
                          </div>

                          <div className="selected-file-size">
                            {getFileSizeLabel(
                              selectedFile.size,
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="remove-file"
                          onClick={() => {
                            setSelectedFile(null);

                            if (
                              fileInputRef.current
                            ) {
                              fileInputRef.current.value =
                                "";
                            }
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="upload-content">
                        <div className="upload-icon">
                          ↑
                        </div>

                        <div className="upload-title">
                          Drop your document here
                        </div>

                        <div className="upload-description">
                          Drag and drop a file here, or
                          click to browse your computer.
                        </div>

                        <div className="upload-types">
                          PDF, DOC, DOCX, XLS, XLSX,
                          CSV, JPG, PNG or ZIP · Maximum
                          25 MB
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2>
                    Document Information
                  </h2>

                  <p>
                    Identify and classify the document
                    so it can be found quickly later.
                  </p>
                </div>

                <div className="card-body">
                  <div className="field-grid">
                    <div className="field full">
                      <label htmlFor="title">
                        Document Title{" "}
                        <span className="required">
                          *
                        </span>
                      </label>

                      <input
                        id="title"
                        className="input"
                        value={title}
                        onChange={(event) =>
                          setTitle(
                            event.target.value,
                          )
                        }
                        placeholder="e.g. UAE Trade License 2026"
                        maxLength={200}
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="document-number">
                        Document Number
                      </label>

                      <input
                        id="document-number"
                        className="input"
                        value={documentNumber}
                        onChange={(event) =>
                          setDocumentNumber(
                            event.target.value,
                          )
                        }
                        placeholder="Auto-generated if empty"
                        maxLength={100}
                      />

                      <div className="field-help">
                        Leave empty and SBS will generate
                        a document number.
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="document-type">
                        Document Type
                      </label>

                      <select
                        id="document-type"
                        className="select"
                        value={documentType}
                        onChange={(event) =>
                          setDocumentType(
                            event.target.value,
                          )
                        }
                      >
                        {DOCUMENT_TYPES.map(
                          (type) => (
                            <option
                              key={type.value}
                              value={type.value}
                            >
                              {type.label}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="category">
                        Category
                      </label>

                      <select
                        id="category"
                        className="select"
                        value={categoryId}
                        onChange={(event) =>
                          setCategoryId(
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          Uncategorized
                        </option>

                        {categories.map(
                          (category) => (
                            <option
                              key={category.id}
                              value={category.id}
                            >
                              {category.name}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="reference">
                        Reference / External ID
                      </label>

                      <input
                        id="reference"
                        className="input"
                        value={
                          documentReference
                        }
                        onChange={(event) =>
                          setDocumentReference(
                            event.target.value,
                          )
                        }
                        placeholder="e.g. Authority reference"
                        maxLength={150}
                      />
                    </div>

                    <div className="field full">
                      <label htmlFor="description">
                        Description
                      </label>

                      <textarea
                        id="description"
                        className="textarea"
                        value={description}
                        onChange={(event) =>
                          setDescription(
                            event.target.value,
                          )
                        }
                        placeholder="Add useful context, notes or a short description..."
                        maxLength={2000}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2>
                    Ownership & Dates
                  </h2>

                  <p>
                    Control whether this is a company
                    record or an employee document and
                    capture important validity dates.
                  </p>
                </div>

                <div className="card-body">
                  <div className="field">
                    <label>
                      Document Owner{" "}
                      <span className="required">
                        *
                      </span>
                    </label>

                    <div className="owner-switch">
                      <button
                        type="button"
                        className={`owner-option ${
                          ownerType ===
                          "company"
                            ? "active"
                            : ""
                        }`}
                        onClick={() => {
                          setOwnerType(
                            "company",
                          );
                          setEmployeeId("");

                          if (
                            accessLevel ===
                            "private"
                          ) {
                            setAccessLevel(
                              "company",
                            );
                          }
                        }}
                      >
                        <span className="radio-dot" />

                        <span>
                          <span className="owner-option-title">
                            Company Document
                          </span>

                          <span className="owner-option-description">
                            Licenses, VAT records,
                            contracts, insurance,
                            government documents and
                            company files.
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`owner-option ${
                          ownerType ===
                          "employee"
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setOwnerType(
                            "employee",
                          )
                        }
                      >
                        <span className="radio-dot" />

                        <span>
                          <span className="owner-option-title">
                            Employee Document
                          </span>

                          <span className="owner-option-description">
                            Contracts, IDs, visas,
                            certificates, training and
                            employee records.
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>

                  {ownerType === "employee" && (
                    <div
                      className="field"
                      style={{
                        marginTop: 16,
                      }}
                    >
                      <label htmlFor="employee">
                        Employee{" "}
                        <span className="required">
                          *
                        </span>
                      </label>

                      <select
                        id="employee"
                        className="select"
                        value={employeeId}
                        onChange={(event) =>
                          setEmployeeId(
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          Select employee
                        </option>

                        {employees.map(
                          (employee) => (
                            <option
                              key={employee.id}
                              value={employee.id}
                            >
                              {getEmployeeName(
                                employee,
                              )}
                              {employee.employee_number
                                ? ` · ${employee.employee_number}`
                                : ""}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  )}

                  <div
                    className="field-grid"
                    style={{
                      marginTop: 18,
                    }}
                  >
                    <div className="field">
                      <label htmlFor="issue-date">
                        Issue Date
                      </label>

                      <input
                        id="issue-date"
                        type="date"
                        className="input"
                        value={issueDate}
                        onChange={(event) =>
                          setIssueDate(
                            event.target.value,
                          )
                        }
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="expiry-date">
                        Expiry Date
                      </label>

                      <input
                        id="expiry-date"
                        type="date"
                        className="input"
                        value={expiryDate}
                        onChange={(event) =>
                          setExpiryDate(
                            event.target.value,
                          )
                        }
                      />

                      <div className="field-help">
                        SBS will automatically track
                        expiring and expired documents.
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="issuing-authority">
                        Issuing Authority
                      </label>

                      <input
                        id="issuing-authority"
                        className="input"
                        value={
                          issuingAuthority
                        }
                        onChange={(event) =>
                          setIssuingAuthority(
                            event.target.value,
                          )
                        }
                        placeholder="e.g. Department of Economy"
                        maxLength={200}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="side-column">
              <div className="card">
                <div className="card-header">
                  <h2>
                    Access Control
                  </h2>

                  <p>
                    Decide who can access this
                    document inside the company.
                  </p>
                </div>

                <div className="card-body">
                  <div className="access-list">
                    <label
                      className={`access-option ${
                        accessLevel ===
                        "company"
                          ? "selected"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        className="access-radio"
                        name="access-level"
                        value="company"
                        checked={
                          accessLevel ===
                          "company"
                        }
                        onChange={() =>
                          setAccessLevel(
                            "company",
                          )
                        }
                      />

                      <span>
                        <span className="access-title">
                          Company
                        </span>

                        <span className="access-description">
                          Available to authorized
                          company users according to
                          their permissions.
                        </span>
                      </span>
                    </label>

                    <label
                      className={`access-option ${
                        accessLevel ===
                        "restricted"
                          ? "selected"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        className="access-radio"
                        name="access-level"
                        value="restricted"
                        checked={
                          accessLevel ===
                          "restricted"
                        }
                        onChange={() =>
                          setAccessLevel(
                            "restricted",
                          )
                        }
                      />

                      <span>
                        <span className="access-title">
                          Restricted
                        </span>

                        <span className="access-description">
                          Intended for controlled
                          sharing through document
                          permissions.
                        </span>
                      </span>
                    </label>

                    <label
                      className={`access-option ${
                        accessLevel ===
                        "private"
                          ? "selected"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        className="access-radio"
                        name="access-level"
                        value="private"
                        checked={
                          accessLevel ===
                          "private"
                        }
                        onChange={() =>
                          setAccessLevel(
                            "private",
                          )
                        }
                        disabled={
                          ownerType !==
                          "employee"
                        }
                      />

                      <span>
                        <span className="access-title">
                          Private
                        </span>

                        <span className="access-description">
                          Reserved for the document
                          owner and authorized
                          administrators.
                        </span>
                      </span>
                    </label>
                  </div>

                  {ownerType ===
                    "company" && (
                    <div
                      className="field-help"
                      style={{
                        marginTop: 10,
                      }}
                    >
                      Private access is intended
                      for employee-owned records.
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2>
                    Library Options
                  </h2>

                  <p>
                    Optional organization settings.
                  </p>
                </div>

                <div className="card-body">
                  <div className="favorite-row">
                    <div className="favorite-copy">
                      <strong>
                        Add to Favorites
                      </strong>

                      <span>
                        Keep this document easy to
                        reach from the Documents
                        dashboard.
                      </span>
                    </div>

                    <button
                      type="button"
                      className={`toggle ${
                        isFavorite
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setIsFavorite(
                          (current) =>
                            !current,
                        )
                      }
                      aria-label="Toggle favorite"
                    >
                      <span className="toggle-knob" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2>
                    Storage & Security
                  </h2>
                </div>

                <div className="card-body">
                  <div className="side-note">
                    <strong>
                      Private storage
                    </strong>
                    <br />
                    Files are uploaded into the SBS
                    company document storage area rather
                    than a public file URL.
                    <br />
                    <br />
                    <strong>
                      Version ready
                    </strong>
                    <br />
                    Every new document starts at
                    version 1. Future replacements can be
                    tracked as additional versions.
                    <br />
                    <br />
                    <strong>
                      Activity tracked
                    </strong>
                    <br />
                    The upload is recorded in the
                    document activity history.
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-body">
                  <div className="actions">
                    <Link
                      href="/documents"
                      className="secondary-button"
                    >
                      Cancel
                    </Link>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={submitting}
                    >
                      {submitting
                        ? "Uploading..."
                        : "Upload Document"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}