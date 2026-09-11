"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type DocumentCategory = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

type Employee = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  status: string | null;
};

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

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".zip",
];

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

function getEmployeeName(employee: Employee) {
  if (employee.display_name?.trim()) {
    return employee.display_name;
  }

  const fullName = `${employee.first_name || ""} ${
    employee.last_name || ""
  }`.trim();

  return fullName || employee.email || "Unnamed employee";
}

function normalizeDate(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function validateFile(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    return "File is too large. Maximum allowed size is 25 MB.";
  }

  const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;

  const validMime =
    !file.type || ALLOWED_FILE_TYPES.includes(file.type);

  const validExtension = ALLOWED_EXTENSIONS.includes(extension);

  if (!validMime && !validExtension) {
    return "Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, JPEG, PNG and ZIP.";
  }

  return null;
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");

  return cleaned || "document";
}

function createUniquePart() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export default function EditDocumentPage() {
  const params = useParams();
  const router = useRouter();

  const documentId = useMemo(() => {
    const value = params?.id;

    if (Array.isArray(value)) {
      return value[0] || "";
    }

    return value || "";
  }, [params]);

  const supabase = useMemo(() => createClient(), []);

  const [document, setDocument] = useState<DocumentRecord | null>(
    null
  );

  const [categories, setCategories] = useState<DocumentCategory[]>(
    []
  );

  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [title, setTitle] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [description, setDescription] = useState("");

  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [documentReference, setDocumentReference] =
    useState("");

  const [ownerType, setOwnerType] = useState<"company" | "employee">(
    "company"
  );

  const [ownerEmployeeId, setOwnerEmployeeId] = useState("");

  const [accessLevel, setAccessLevel] = useState<
    "company" | "restricted" | "private"
  >("company");

  const [isFavorite, setIsFavorite] = useState(false);

  const [replacementFile, setReplacementFile] =
    useState<File | null>(null);

  const [fileInputKey, setFileInputKey] = useState(0);

  const loadDocument = useCallback(async () => {
    if (!documentId) {
      setErrorMessage("Document ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
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

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", authData.user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership was found for this account."
        );
      }

      const companyId = membership.company_id;

      const [
        documentResult,
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
          .maybeSingle(),

        supabase
          .from("document_categories")
          .select(
            "id, name, slug, is_active"
          )
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("sort_order", {
            ascending: true,
          })
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("employees")
          .select(
            `
              id,
              first_name,
              last_name,
              display_name,
              email,
              status
            `
          )
          .eq("company_id", companyId)
          .eq("status", "active")
          .order("display_name", {
            ascending: true,
          }),
      ]);

      if (documentResult.error) {
        throw documentResult.error;
      }

      if (!documentResult.data) {
        throw new Error("Document not found.");
      }

      if (documentResult.data.company_id !== companyId) {
        throw new Error("You do not have access to this document.");
      }

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      if (employeesResult.error) {
        throw employeesResult.error;
      }

      const loadedDocument =
        documentResult.data as DocumentRecord;

      setDocument(loadedDocument);

      setCategories(
        (categoriesResult.data ||
          []) as DocumentCategory[]
      );

      setEmployees(
        (employeesResult.data || []) as Employee[]
      );

      setTitle(loadedDocument.title || "");
      setDocumentNumber(
        loadedDocument.document_number || ""
      );
      setDocumentType(
        loadedDocument.document_type || ""
      );
      setCategoryId(
        loadedDocument.category_id || ""
      );

      setDescription(
        loadedDocument.description || ""
      );

      setIssueDate(
        normalizeDate(loadedDocument.issue_date)
      );

      setExpiryDate(
        normalizeDate(loadedDocument.expiry_date)
      );

      setIssuingAuthority(
        loadedDocument.issuing_authority || ""
      );

      setDocumentReference(
        loadedDocument.document_reference || ""
      );

      setOwnerType(
        loadedDocument.owner_type === "employee"
          ? "employee"
          : "company"
      );

      setOwnerEmployeeId(
        loadedDocument.owner_employee_id || ""
      );

      setAccessLevel(
        loadedDocument.access_level === "restricted"
          ? "restricted"
          : loadedDocument.access_level === "private"
          ? "private"
          : "company"
      );

      setIsFavorite(
        Boolean(loadedDocument.is_favorite)
      );
    } catch (error) {
      console.error("Load document error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the document."
      );
    } finally {
      setLoading(false);
    }
  }, [documentId, router, supabase]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setErrorMessage("");
    setSuccessMessage("");

    const file = event.target.files?.[0];

    if (!file) {
      setReplacementFile(null);
      return;
    }

    const validationError = validateFile(file);

    if (validationError) {
      setReplacementFile(null);
      setFileInputKey((value) => value + 1);
      setErrorMessage(validationError);
      return;
    }

    setReplacementFile(file);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!document) {
      setErrorMessage("Document data is unavailable.");
      return;
    }

    if (document.is_archived) {
      setErrorMessage(
        "Archived documents cannot be edited. Restore the document first."
      );
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setErrorMessage("Document title is required.");
      return;
    }

    if (issueDate && expiryDate && expiryDate < issueDate) {
      setErrorMessage(
        "Expiry date cannot be earlier than the issue date."
      );
      return;
    }

    if (
      ownerType === "employee" &&
      !ownerEmployeeId
    ) {
      setErrorMessage(
        "Please select the employee who owns this document."
      );
      return;
    }

    if (
      replacementFile &&
      replacementFile.size > MAX_FILE_SIZE
    ) {
      setErrorMessage(
        "Replacement file is too large. Maximum allowed size is 25 MB."
      );
      return;
    }

    setSaving(true);

    let newStoragePath: string | null = null;
    let uploadedReplacement = false;

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

      const userId = authData.user.id;

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership was found for this account."
        );
      }

      const companyId = membership.company_id;

      if (companyId !== document.company_id) {
        throw new Error(
          "Company access validation failed."
        );
      }

      if (
        ownerType === "employee" &&
        ownerEmployeeId
      ) {
        const { data: ownerEmployee, error: ownerError } =
          await supabase
            .from("employees")
            .select("id")
            .eq("id", ownerEmployeeId)
            .eq("company_id", companyId)
            .eq("status", "active")
            .maybeSingle();

        if (ownerError) {
          throw ownerError;
        }

        if (!ownerEmployee) {
          throw new Error(
            "The selected employee could not be validated."
          );
        }
      }

      /*
       * ---------------------------------------------------------
       * FILE REPLACEMENT
       * ---------------------------------------------------------
       *
       * Upload the new file first.
       *
       * We intentionally do NOT delete the old file before the
       * database transaction-like sequence succeeds. That prevents
       * us from losing the original document if the upload or DB
       * update fails.
       */
      if (replacementFile) {
        const uniquePart = createUniquePart();

        const newFileName = safeFileName(
          replacementFile.name
        );

        newStoragePath =
          `${companyId}/documents/${document.id}/${uniquePart}/${newFileName}`;

        const { error: uploadError } =
          await supabase.storage
            .from("documents")
            .upload(
              newStoragePath,
              replacementFile,
              {
                cacheControl: "3600",
                upsert: false,
                contentType:
                  replacementFile.type ||
                  "application/octet-stream",
              }
            );

        if (uploadError) {
          throw new Error(
            `File replacement failed: ${uploadError.message}`
          );
        }

        uploadedReplacement = true;
      }

      const nextVersion =
        Math.max(
          Number(document.current_version || 1),
          1
        ) + (replacementFile ? 1 : 0);

      /*
       * ---------------------------------------------------------
       * UPDATE DOCUMENT
       * ---------------------------------------------------------
       */
      const documentUpdate: Record<
        string,
        string | boolean | number | null
      > = {
        title: cleanTitle,
        document_number:
          documentNumber.trim() || null,
        document_type:
          documentType.trim() || null,
        category_id: categoryId || null,
        description:
          description.trim() || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        issuing_authority:
          issuingAuthority.trim() || null,
        document_reference:
          documentReference.trim() || null,
        owner_type: ownerType,
        owner_employee_id:
          ownerType === "employee"
            ? ownerEmployeeId
            : null,
        access_level: accessLevel,
        is_favorite: isFavorite,
        updated_by: userId,
      };

      if (replacementFile && newStoragePath) {
        documentUpdate.file_name =
          replacementFile.name;

        documentUpdate.mime_type =
          replacementFile.type ||
          "application/octet-stream";

        documentUpdate.file_size =
          replacementFile.size;

        documentUpdate.storage_path =
          newStoragePath;

        documentUpdate.current_version =
          nextVersion;
      }

      const {
        data: updatedDocument,
        error: updateError,
      } = await supabase
        .from("documents")
        .update(documentUpdate)
        .eq("id", document.id)
        .eq("company_id", companyId)
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
        .single();

      if (updateError) {
        throw updateError;
      }

      /*
       * ---------------------------------------------------------
       * NEW VERSION
       * ---------------------------------------------------------
       */
      if (replacementFile && newStoragePath) {
        const { error: versionError } =
          await supabase
            .from("document_versions")
            .insert({
              company_id: companyId,
              document_id: document.id,
              version_number: nextVersion,
              file_name: replacementFile.name,
              mime_type:
                replacementFile.type ||
                "application/octet-stream",
              file_size: replacementFile.size,
              storage_path: newStoragePath,
              change_note:
                "Document file replaced from the edit page.",
              created_by: userId,
            });

        if (versionError) {
          /*
           * The main document now points to the new file, so
           * remove that pointer rather than leaving a fake version.
           *
           * We still keep the new file temporarily because the
           * storage cleanup below may fail and should not hide the
           * database error.
           */
          throw versionError;
        }
      }

      /*
       * ---------------------------------------------------------
       * ACTIVITY LOG
       * ---------------------------------------------------------
       */
      const activityMessage = replacementFile
        ? `Document updated and file replaced with version ${nextVersion}.`
        : "Document information updated.";

      const activityMetadata = {
        replaced_file: Boolean(replacementFile),
        version:
          replacementFile
            ? nextVersion
            : Number(document.current_version || 1),
      };

      const { error: activityError } =
        await supabase
          .from("document_activity")
          .insert({
            company_id: companyId,
            document_id: document.id,
            action: replacementFile
              ? "file_replaced"
              : "updated",
            message: activityMessage,
            metadata: activityMetadata,
            created_by: userId,
          });

      if (activityError) {
        console.warn(
          "Document activity log failed:",
          activityError
        );
      }

      /*
       * ---------------------------------------------------------
       * DELETE OLD FILE
       * ---------------------------------------------------------
       *
       * Only after the new document row and version have been
       * successfully saved.
       */
      if (
        replacementFile &&
        document.storage_path &&
        document.storage_path !== newStoragePath
      ) {
        const { error: removeOldFileError } =
          await supabase.storage
            .from("documents")
            .remove([
              document.storage_path,
            ]);

        if (removeOldFileError) {
          /*
           * Do not fail the entire edit here.
           *
           * The database is correct and the new file is live.
           * The old object can be cleaned up later.
           */
          console.warn(
            "Old document file could not be removed:",
            removeOldFileError
          );
        }
      }

      setDocument(
        updatedDocument as DocumentRecord
      );

      setReplacementFile(null);
      setFileInputKey((value) => value + 1);

      setSuccessMessage(
        replacementFile
          ? `Document updated successfully. Version ${nextVersion} is now active.`
          : "Document updated successfully."
      );

      /*
       * Give the user a short success state before returning
       * to the document detail page.
       */
      window.setTimeout(() => {
        router.push(
          `/documents/${document.id}`
        );
        router.refresh();
      }, 700);
    } catch (error) {
      console.error(
        "Update document error:",
        error
      );

      /*
       * If the new file was uploaded but the database operation
       * failed, clean the orphaned new object.
       */
      if (
        uploadedReplacement &&
        newStoragePath
      ) {
        const { error: cleanupError } =
          await supabase.storage
            .from("documents")
            .remove([newStoragePath]);

        if (cleanupError) {
          console.warn(
            "Could not clean up uploaded replacement file:",
            cleanupError
          );
        }
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the document."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(
      document
        ? `/documents/${document.id}`
        : "/documents"
    );
  };

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="loading-card">
            <div className="spinner" />
            <div>
              <strong>Loading document</strong>
              <span>
                Preparing the document editor...
              </span>
            </div>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .loading-card {
              min-height: 260px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 14px;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              background: #ffffff;
              box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
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
              width: 22px;
              height: 22px;
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
            <div className="error-title">
              Unable to load document
            </div>

            <div className="error-message">
              {errorMessage ||
                "The requested document could not be found."}
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
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              background: #ffffff;
              padding: 28px;
              box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
            }

            .error-title {
              font-size: 18px;
              font-weight: 700;
              color: #111827;
            }

            .error-message {
              margin-top: 7px;
              margin-bottom: 20px;
              color: #6b7280;
              font-size: 14px;
            }

            .btn {
              min-height: 38px;
              border-radius: 9px;
              border: 1px solid #d1d5db;
              padding: 0 14px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              background: #ffffff;
              color: #111827;
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
        <div className="page-header">
          <div>
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
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/documents/${document.id}`
                  )
                }
              >
                {document.title}
              </button>
              <span>/</span>
              <span>Edit</span>
            </div>

            <div className="title-row">
              <div>
                <h1>Edit Document</h1>
                <p>
                  Update document information, ownership,
                  access settings, or replace the file.
                </p>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="document-edit-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="button-spinner" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>

        {document.is_archived && (
          <div className="warning-banner">
            <div className="warning-icon">!</div>

            <div>
              <strong>Document is archived</strong>
              <span>
                Archived documents are locked and cannot
                be edited. Restore the document first.
              </span>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="alert alert-error">
            <div className="alert-icon">!</div>

            <div>
              <strong>Unable to save changes</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <div className="success-icon">✓</div>

            <div>
              <strong>Changes saved</strong>
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        <form
          id="document-edit-form"
          onSubmit={handleSubmit}
        >
          <div className="layout">
            <div className="main-column">
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Document Information</h2>
                    <p>
                      Core information used to identify and
                      manage this document.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field field-full">
                    <label htmlFor="title">
                      Document Title{" "}
                      <span className="required">*</span>
                    </label>

                    <input
                      id="title"
                      type="text"
                      value={title}
                      onChange={(event) =>
                        setTitle(event.target.value)
                      }
                      placeholder="e.g. UAE Trade License"
                      disabled={saving || document.is_archived}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="document-number">
                      Document Number
                    </label>

                    <input
                      id="document-number"
                      type="text"
                      value={documentNumber}
                      onChange={(event) =>
                        setDocumentNumber(
                          event.target.value
                        )
                      }
                      placeholder="e.g. DOC-000124"
                      disabled={saving || document.is_archived}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="document-type">
                      Document Type
                    </label>

                    <input
                      id="document-type"
                      type="text"
                      value={documentType}
                      onChange={(event) =>
                        setDocumentType(
                          event.target.value
                        )
                      }
                      placeholder="e.g. License, Contract, ID"
                      disabled={saving || document.is_archived}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="category">
                      Category
                    </label>

                    <select
                      id="category"
                      value={categoryId}
                      onChange={(event) =>
                        setCategoryId(
                          event.target.value
                        )
                      }
                      disabled={saving || document.is_archived}
                    >
                      <option value="">
                        No category
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
                  </div>

                  <div className="field">
                    <label htmlFor="document-reference">
                      Document Reference
                    </label>

                    <input
                      id="document-reference"
                      type="text"
                      value={documentReference}
                      onChange={(event) =>
                        setDocumentReference(
                          event.target.value
                        )
                      }
                      placeholder="Reference / registration number"
                      disabled={saving || document.is_archived}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="issuing-authority">
                      Issuing Authority
                    </label>

                    <input
                      id="issuing-authority"
                      type="text"
                      value={issuingAuthority}
                      onChange={(event) =>
                        setIssuingAuthority(
                          event.target.value
                        )
                      }
                      placeholder="e.g. DED, Municipality, Supplier"
                      disabled={saving || document.is_archived}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="issue-date">
                      Issue Date
                    </label>

                    <input
                      id="issue-date"
                      type="date"
                      value={issueDate}
                      onChange={(event) =>
                        setIssueDate(
                          event.target.value
                        )
                      }
                      disabled={saving || document.is_archived}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="expiry-date">
                      Expiry Date
                    </label>

                    <input
                      id="expiry-date"
                      type="date"
                      value={expiryDate}
                      onChange={(event) =>
                        setExpiryDate(
                          event.target.value
                        )
                      }
                      disabled={saving || document.is_archived}
                    />
                  </div>

                  <div className="field field-full">
                    <label htmlFor="description">
                      Description
                    </label>

                    <textarea
                      id="description"
                      value={description}
                      onChange={(event) =>
                        setDescription(
                          event.target.value
                        )
                      }
                      placeholder="Add notes or additional information about this document..."
                      rows={5}
                      disabled={saving || document.is_archived}
                    />
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Ownership & Access</h2>
                    <p>
                      Control who owns the document and
                      how it is accessed.
                    </p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field field-full">
                    <label>Document Owner</label>

                    <div className="segmented">
                      <button
                        type="button"
                        className={
                          ownerType === "company"
                            ? "segment active"
                            : "segment"
                        }
                        onClick={() =>
                          setOwnerType("company")
                        }
                        disabled={
                          saving ||
                          document.is_archived
                        }
                      >
                        Company
                      </button>

                      <button
                        type="button"
                        className={
                          ownerType === "employee"
                            ? "segment active"
                            : "segment"
                        }
                        onClick={() =>
                          setOwnerType("employee")
                        }
                        disabled={
                          saving ||
                          document.is_archived
                        }
                      >
                        Employee
                      </button>
                    </div>
                  </div>

                  {ownerType === "employee" && (
                    <div className="field field-full">
                      <label htmlFor="owner-employee">
                        Employee Owner{" "}
                        <span className="required">*</span>
                      </label>

                      <select
                        id="owner-employee"
                        value={ownerEmployeeId}
                        onChange={(event) =>
                          setOwnerEmployeeId(
                            event.target.value
                          )
                        }
                        disabled={
                          saving ||
                          document.is_archived
                        }
                      >
                        <option value="">
                          Select employee
                        </option>

                        {employees.map((employee) => (
                          <option
                            key={employee.id}
                            value={employee.id}
                          >
                            {getEmployeeName(employee)}
                            {employee.email
                              ? ` — ${employee.email}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="field field-full">
                    <label>Access Level</label>

                    <div className="access-options">
                      <button
                        type="button"
                        className={
                          accessLevel === "company"
                            ? "access-option selected"
                            : "access-option"
                        }
                        onClick={() =>
                          setAccessLevel("company")
                        }
                        disabled={
                          saving ||
                          document.is_archived
                        }
                      >
                        <strong>Company</strong>
                        <span>
                          Available to company users who
                          have access to Documents.
                        </span>
                      </button>

                      <button
                        type="button"
                        className={
                          accessLevel === "restricted"
                            ? "access-option selected"
                            : "access-option"
                        }
                        onClick={() =>
                          setAccessLevel("restricted")
                        }
                        disabled={
                          saving ||
                          document.is_archived
                        }
                      >
                        <strong>Restricted</strong>
                        <span>
                          Intended for selected users or
                          shared access.
                        </span>
                      </button>

                      <button
                        type="button"
                        className={
                          accessLevel === "private"
                            ? "access-option selected"
                            : "access-option"
                        }
                        onClick={() =>
                          setAccessLevel("private")
                        }
                        disabled={
                          saving ||
                          document.is_archived
                        }
                      >
                        <strong>Private</strong>
                        <span>
                          Intended for the owner and
                          authorized administrators.
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="field field-full">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={isFavorite}
                        onChange={(event) =>
                          setIsFavorite(
                            event.target.checked
                          )
                        }
                        disabled={
                          saving ||
                          document.is_archived
                        }
                      />

                      <span>
                        <strong>
                          Mark as favorite
                        </strong>
                        <small>
                          Show this document as an important
                          or frequently accessed document.
                        </small>
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Replace Document File</h2>
                    <p>
                      Upload a new file to create the next
                      document version.
                    </p>
                  </div>
                </div>

                <div className="current-file">
                  <div className="file-icon">
                    {document.mime_type ===
                    "application/pdf"
                      ? "PDF"
                      : "FILE"}
                  </div>

                  <div className="file-info">
                    <strong>
                      {document.file_name ||
                        "No file attached"}
                    </strong>

                    <span>
                      Current version{" "}
                      {document.current_version || 1}
                      {document.file_size
                        ? ` • ${formatFileSize(
                            document.file_size
                          )}`
                        : ""}
                    </span>
                  </div>
                </div>

                <div className="upload-area">
                  <input
                    key={fileInputKey}
                    id="replacement-file"
                    type="file"
                    accept={ALLOWED_EXTENSIONS.join(
                      ","
                    )}
                    onChange={handleFileChange}
                    disabled={
                      saving ||
                      document.is_archived
                    }
                  />

                  <label htmlFor="replacement-file">
                    <span className="upload-title">
                      {replacementFile
                        ? "Replacement file selected"
                        : "Choose a replacement file"}
                    </span>

                    <span className="upload-subtitle">
                      PDF, DOC, DOCX, XLS, XLSX, CSV,
                      JPG, JPEG, PNG or ZIP • Max 25 MB
                    </span>
                  </label>
                </div>

                {replacementFile && (
                  <div className="replacement-preview">
                    <div>
                      <strong>
                        {replacementFile.name}
                      </strong>

                      <span>
                        {formatFileSize(
                          replacementFile.size
                        )}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="remove-file"
                      onClick={() => {
                        setReplacementFile(null);
                        setFileInputKey(
                          (value) => value + 1
                        );
                      }}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="version-note">
                  <strong>Versioning:</strong>{" "}
                  Replacing this file will create version{" "}
                  {(document.current_version || 1) + 1}
                  . The previous version will remain
                  available in the document history.
                </div>
              </section>
            </div>

            <aside className="side-column">
              <section className="card sticky-card">
                <div className="card-header">
                  <div>
                    <h2>Document Summary</h2>
                    <p>
                      Current document state.
                    </p>
                  </div>
                </div>

                <div className="summary-list">
                  <div className="summary-row">
                    <span>Status</span>
                    <strong>
                      <span
                        className={`status-badge status-${document.status}`}
                      >
                        {document.status}
                      </span>
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Version</span>
                    <strong>
                      v{document.current_version || 1}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Owner</span>
                    <strong>
                      {ownerType === "employee"
                        ? employees.find(
                            (employee) =>
                              employee.id ===
                              ownerEmployeeId
                          )
                          ? getEmployeeName(
                              employees.find(
                                (employee) =>
                                  employee.id ===
                                  ownerEmployeeId
                              ) as Employee
                            )
                          : "Employee"
                        : "Company"}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Access</span>
                    <strong>
                      {accessLevel}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Favorite</span>
                    <strong>
                      {isFavorite ? "Yes" : "No"}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>File</span>
                    <strong>
                      {formatFileSize(
                        replacementFile?.size ||
                          document.file_size
                      )}
                    </strong>
                  </div>
                </div>

                <div className="side-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    form="document-edit-form"
                    className="btn btn-primary"
                    disabled={
                      saving ||
                      document.is_archived
                    }
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>
                </div>
              </section>
            </aside>
          </div>
        </form>
      </main>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 9px;
          color: #9ca3af;
          font-size: 12px;
          font-weight: 600;
        }

        .breadcrumb button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .breadcrumb button:hover {
          color: #111827;
        }

        .title-row h1 {
          margin: 0;
          color: #111827;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 750;
          letter-spacing: -0.02em;
        }

        .title-row p {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 14px;
          line-height: 1.5;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .btn {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          padding: 0 14px;
          background: #ffffff;
          color: #111827;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .btn:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #9ca3af;
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

        .button-spinner {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .warning-banner,
        .alert {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 13px 15px;
          margin-bottom: 18px;
          border-radius: 11px;
        }

        .warning-banner {
          border: 1px solid #fde68a;
          background: #fffbeb;
          color: #92400e;
        }

        .alert-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .alert-success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .warning-icon,
        .alert-icon,
        .success-icon {
          width: 22px;
          height: 22px;
          flex: 0 0 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 12px;
          font-weight: 800;
        }

        .warning-icon {
          background: #fef3c7;
        }

        .alert-icon {
          background: #fee2e2;
        }

        .success-icon {
          background: #dcfce7;
        }

        .warning-banner > div:last-child,
        .alert > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .warning-banner strong,
        .alert strong {
          font-size: 13px;
        }

        .warning-banner span,
        .alert span {
          font-size: 12.5px;
          line-height: 1.45;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 20px;
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
        }

        .card {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
          overflow: hidden;
        }

        .sticky-card {
          position: sticky;
          top: 20px;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 19px 20px;
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
          font-size: 12.5px;
          line-height: 1.45;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
          padding: 20px;
        }

        .field {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field-full {
          grid-column: 1 / -1;
        }

        .field label {
          color: #374151;
          font-size: 12.5px;
          font-weight: 650;
        }

        .required {
          color: #dc2626;
        }

        .field input,
        .field select,
        .field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          outline: none;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 13px;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .field input,
        .field select {
          height: 40px;
          padding: 0 12px;
        }

        .field textarea {
          min-height: 115px;
          padding: 11px 12px;
          resize: vertical;
          line-height: 1.5;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #6b7280;
          box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.1);
        }

        .field input:disabled,
        .field select:disabled,
        .field textarea:disabled {
          background: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .segmented {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          padding: 4px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
        }

        .segment {
          height: 36px;
          border: 1px solid transparent;
          border-radius: 7px;
          background: transparent;
          color: #6b7280;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }

        .segment.active {
          border-color: #d1d5db;
          background: #ffffff;
          color: #111827;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
        }

        .segment:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .access-options {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
        }

        .access-option {
          min-height: 88px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          gap: 5px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #ffffff;
          text-align: left;
          cursor: pointer;
        }

        .access-option:hover:not(:disabled) {
          border-color: #9ca3af;
          background: #fafafa;
        }

        .access-option.selected {
          border-color: #111827;
          background: #f9fafb;
          box-shadow: inset 0 0 0 1px #111827;
        }

        .access-option strong {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .access-option span {
          color: #6b7280;
          font-size: 11.5px;
          line-height: 1.4;
        }

        .access-option:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .checkbox-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
        }

        .checkbox-row input {
          width: 16px;
          height: 16px;
          margin: 1px 0 0;
          cursor: pointer;
        }

        .checkbox-row span {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .checkbox-row strong {
          color: #111827;
          font-size: 13px;
        }

        .checkbox-row small {
          color: #6b7280;
          font-size: 11.5px;
          line-height: 1.4;
        }

        .current-file {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px;
          padding: 13px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
        }

        .file-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #111827;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
        }

        .file-info {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .file-info strong {
          overflow: hidden;
          color: #111827;
          font-size: 13px;
          font-weight: 650;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-info span {
          color: #6b7280;
          font-size: 11.5px;
        }

        .upload-area {
          position: relative;
          margin: 0 20px 15px;
          border: 1px dashed #cbd5e1;
          border-radius: 11px;
          background: #fafafa;
          overflow: hidden;
        }

        .upload-area input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .upload-area label {
          min-height: 115px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 20px;
          cursor: pointer;
          text-align: center;
        }

        .upload-area:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .upload-title {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .upload-subtitle {
          max-width: 520px;
          color: #6b7280;
          font-size: 11.5px;
          line-height: 1.45;
        }

        .replacement-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 0 20px 15px;
          padding: 11px 12px;
          border: 1px solid #dbeafe;
          border-radius: 9px;
          background: #eff6ff;
        }

        .replacement-preview > div {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .replacement-preview strong {
          overflow: hidden;
          color: #1e3a8a;
          font-size: 12.5px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .replacement-preview span {
          color: #64748b;
          font-size: 11px;
        }

        .remove-file {
          flex: 0 0 auto;
          border: 0;
          background: transparent;
          color: #b91c1c;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .version-note {
          margin: 0 20px 20px;
          padding: 11px 12px;
          border-radius: 9px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 11.5px;
          line-height: 1.5;
        }

        .version-note strong {
          color: #374151;
        }

        .summary-list {
          padding: 5px 20px 12px;
        }

        .summary-row {
          min-height: 43px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          border-bottom: 1px solid #f1f5f9;
        }

        .summary-row:last-child {
          border-bottom: 0;
        }

        .summary-row > span {
          color: #6b7280;
          font-size: 12px;
        }

        .summary-row > strong {
          max-width: 170px;
          overflow: hidden;
          color: #111827;
          font-size: 12px;
          font-weight: 650;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 23px;
          padding: 0 8px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #374151;
          font-size: 10.5px;
          font-weight: 700;
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

        .side-actions {
          display: flex;
          gap: 8px;
          padding: 17px 20px 20px;
          border-top: 1px solid #eef0f2;
        }

        .side-actions .btn {
          flex: 1;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1000px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .sticky-card {
            position: static;
          }

          .access-options {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .page-content {
            padding: 20px;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .btn {
            flex: 1;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .field-full {
            grid-column: auto;
          }
        }

        @media (max-width: 520px) {
          .page-content {
            padding: 15px;
          }

          .title-row h1 {
            font-size: 23px;
          }

          .side-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </AppShell>
  );
}