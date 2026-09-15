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
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type ExpenseType =
  | "operating_expense"
  | "inventory_expense"
  | "employee_advance"
  | "reimbursement"
  | "petty_cash"
  | "other";

type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "credit_card"
  | "debit_card"
  | "company_card"
  | "petty_cash"
  | "other";

type ExpenseStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

type SettlementStatus =
  | "not_applicable"
  | "outstanding"
  | "partially_settled"
  | "settled";

type Category = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
};

type Expense = {
  id: string;
  company_id: string;
  expense_date: string;
  expense_type: ExpenseType;
  category_id: string | null;
  description: string;
  vendor_name: string | null;
  employee_id: string | null;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  receipt_path: string | null;
  status: ExpenseStatus;
  settlement_status: SettlementStatus;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type Settlement = {
  id: string;
  amount: number;
};

const expenseTypeLabels: Record<ExpenseType, string> = {
  operating_expense: "Operating Expense",
  inventory_expense: "Inventory Expense",
  employee_advance: "Employee Advance",
  reimbursement: "Reimbursement",
  petty_cash: "Petty Cash",
  other: "Other",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  company_card: "Company Card",
  petty_cash: "Petty Cash",
  other: "Other",
};

const statusLabels: Record<ExpenseStatus, string> = {
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  cancelled: "Cancelled",
};

const settlementLabels: Record<SettlementStatus, string> = {
  not_applicable: "Not Applicable",
  outstanding: "Outstanding",
  partially_settled: "Partially Settled",
  settled: "Settled",
};

const allowedReceiptExtensions = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "pdf",
];

const allowedReceiptMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function employeeName(employee: Employee) {
  if (employee.display_name?.trim()) {
    return employee.display_name.trim();
  }

  return (
    [employee.first_name, employee.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "Employee"
  );
}

function formatCurrency(amount: number, currency = "AED") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function isPreviewableImage(file: File | null) {
  if (!file) return false;

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "";

  return (
    ["jpg", "jpeg", "png", "webp"].includes(extension) ||
    ["image/jpeg", "image/png", "image/webp"].includes(file.type)
  );
}

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();

  const expenseId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [expense, setExpense] = useState<Expense | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  const [expenseType, setExpenseType] =
    useState<ExpenseType>("operating_expense");

  const [expenseDate, setExpenseDate] =
    useState(todayString());

  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("AED");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [vendorName, setVendorName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [status, setStatus] =
    useState<ExpenseStatus>("pending");

  const [settlementStatus, setSettlementStatus] =
    useState<SettlementStatus>("not_applicable");

  const [receiptFile, setReceiptFile] =
    useState<File | null>(null);

  const [receiptPreviewUrl, setReceiptPreviewUrl] =
    useState<string | null>(null);

  const [removeExistingReceipt, setRemoveExistingReceipt] =
    useState(false);

  /*
   * Camera state
   */
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [capturedPhotoUrl, setCapturedPhotoUrl] =
    useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef =
    useRef<MediaStream | null>(null);

  const capturedPhotoFileRef =
    useRef<File | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();

    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }

    setCapturedPhotoUrl(null);
    capturedPhotoFileRef.current = null;
    setCameraError("");
    setCameraOpen(false);
    setCameraLoading(false);
  }, [capturedPhotoUrl, stopCamera]);

  const openCamera = async () => {
    setErrorMessage("");
    setCameraError("");

    if (capturedPhotoUrl) {
      URL.revokeObjectURL(capturedPhotoUrl);
    }

    setCapturedPhotoUrl(null);
    capturedPhotoFileRef.current = null;

    setCameraOpen(true);
    setCameraLoading(true);

    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Camera access is not supported by this browser."
        );
      }

      stopCamera();

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
            width: {
              ideal: 1920,
            },
            height: {
              ideal: 1080,
            },
          },
          audio: false,
        });

      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error(
        "Camera access failed:",
        error
      );

      setCameraError(
        error instanceof Error
          ? error.message
          : "Unable to access the camera."
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      setCameraError(
        "Camera is not ready yet. Please try again."
      );
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setCameraError(
        "Camera is still starting. Please wait a moment and try again."
      );
      return;
    }

    const maxDimension = 2400;

    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > maxDimension) {
      const scale = maxDimension / width;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError(
        "Unable to capture the camera image."
      );
      return;
    }

    context.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError(
            "Unable to create the captured photo."
          );
          return;
        }

        if (blob.size > 10 * 1024 * 1024) {
          setCameraError(
            "Captured photo is larger than 10 MB."
          );
          return;
        }

        const file = new File(
          [blob],
          `receipt-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
            lastModified: Date.now(),
          }
        );

        if (capturedPhotoUrl) {
          URL.revokeObjectURL(
            capturedPhotoUrl
          );
        }

        const previewUrl =
          URL.createObjectURL(file);

        capturedPhotoFileRef.current = file;
        setCapturedPhotoUrl(previewUrl);

        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const retakePhoto = async () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(
        capturedPhotoUrl
      );
    }

    setCapturedPhotoUrl(null);
    capturedPhotoFileRef.current = null;
    setCameraError("");

    await openCamera();
  };

  const useCapturedPhoto = () => {
    const file =
      capturedPhotoFileRef.current;

    if (!file) {
      setCameraError(
        "No captured photo is available."
      );
      return;
    }

    if (receiptPreviewUrl) {
      URL.revokeObjectURL(
        receiptPreviewUrl
      );
    }

    const previewUrl =
      capturedPhotoUrl ||
      URL.createObjectURL(file);

    setReceiptFile(file);
    setReceiptPreviewUrl(previewUrl);

    setRemoveExistingReceipt(false);

    capturedPhotoFileRef.current = null;
    setCapturedPhotoUrl(null);

    stopCamera();
    setCameraError("");
    setCameraOpen(false);
  };

  const handleReceiptChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0] || null;

    if (!file) {
      return;
    }

    const extension =
      fileExtension(file);

    const validExtension =
      allowedReceiptExtensions.includes(
        extension
      );

    const validMime =
      allowedReceiptMimeTypes.includes(
        file.type
      );

    if (
      !validExtension &&
      !validMime
    ) {
      setErrorMessage(
        "Receipt must be JPG, JPEG, PNG, WEBP, HEIC, HEIF, or PDF."
      );

      event.target.value = "";
      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setErrorMessage(
        "Receipt file must be 10 MB or smaller."
      );

      event.target.value = "";
      return;
    }

    setErrorMessage("");
    setRemoveExistingReceipt(false);

    if (receiptPreviewUrl) {
      URL.revokeObjectURL(
        receiptPreviewUrl
      );
    }

    setReceiptFile(file);

    if (isPreviewableImage(file)) {
      setReceiptPreviewUrl(
        URL.createObjectURL(file)
      );
    } else {
      setReceiptPreviewUrl(null);
    }
  };

  const clearSelectedReceipt = () => {
    if (receiptPreviewUrl) {
      URL.revokeObjectURL(
        receiptPreviewUrl
      );
    }

    setReceiptPreviewUrl(null);
    setReceiptFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const loadData = useCallback(async () => {
    if (!expenseId) {
      setErrorMessage(
        "Expense ID is missing."
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        router.push("/login");
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
          "No company membership was found for your account."
        );
      }

      const companyId =
        membership.company_id;

      const [
        expenseResult,
        categoriesResult,
        settlementsResult,
        employeeResult,
      ] = await Promise.all([
        supabase
          .from("expenses")
          .select(
            `
              id,
              company_id,
              expense_date,
              expense_type,
              category_id,
              description,
              vendor_name,
              employee_id,
              amount,
              currency,
              payment_method,
              reference,
              notes,
              receipt_path,
              status,
              settlement_status,
              created_by,
              approved_by,
              approved_at,
              created_at,
              updated_at
            `
          )
          .eq("id", expenseId)
          .eq("company_id", companyId)
          .maybeSingle(),

        supabase
          .from("expense_categories")
          .select("id, name")
          .eq("company_id", companyId)
          .order("name"),

        supabase
          .from("expense_settlements")
          .select("id, amount")
          .eq("expense_id", expenseId)
          .eq("company_id", companyId),

        supabase
          .from("employees")
          .select(
            "id, first_name, last_name, display_name"
          )
          .eq("company_id", companyId)
          .order("first_name"),
      ]);

      if (expenseResult.error) {
        throw expenseResult.error;
      }

      if (!expenseResult.data) {
        throw new Error(
          "Expense not found."
        );
      }

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      if (settlementsResult.error) {
        throw settlementsResult.error;
      }

      if (employeeResult.error) {
        throw employeeResult.error;
      }

      const loadedExpense =
        expenseResult.data as Expense;

      setExpense(loadedExpense);

      setCategories(
        (categoriesResult.data ||
          []) as Category[]
      );

      setSettlements(
        (settlementsResult.data ||
          []) as Settlement[]
      );

      setEmployees(
        (employeeResult.data ||
          []) as Employee[]
      );

      setExpenseType(
        loadedExpense.expense_type
      );

      setExpenseDate(
        loadedExpense.expense_date
      );

      setCategoryId(
        loadedExpense.category_id || ""
      );

      setDescription(
        loadedExpense.description
      );

      setAmount(
        String(loadedExpense.amount)
      );

      setCurrency(
        loadedExpense.currency || "AED"
      );

      setPaymentMethod(
        loadedExpense.payment_method
      );

      setVendorName(
        loadedExpense.vendor_name || ""
      );

      setEmployeeId(
        loadedExpense.employee_id || ""
      );

      setReference(
        loadedExpense.reference || ""
      );

      setNotes(
        loadedExpense.notes || ""
      );

      setStatus(
        loadedExpense.status
      );

      setSettlementStatus(
        loadedExpense.settlement_status
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to load expense."
      );
    } finally {
      setLoading(false);
    }
  }, [
    expenseId,
    router,
    supabase,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      stopCamera();

      if (receiptPreviewUrl) {
        URL.revokeObjectURL(
          receiptPreviewUrl
        );
      }

      if (capturedPhotoUrl) {
        URL.revokeObjectURL(
          capturedPhotoUrl
        );
      }
    };
  }, [
    capturedPhotoUrl,
    receiptPreviewUrl,
    stopCamera,
  ]);

  const settledAmount = useMemo(
    () =>
      settlements.reduce(
        (total, item) =>
          total +
          Number(item.amount || 0),
        0
      ),
    [settlements]
  );

  const hasSettlements =
    settlements.length > 0;

  const isEmployeeAdvance =
    expenseType ===
    "employee_advance";

  const isReimbursement =
    expenseType ===
    "reimbursement";

  const hasSettlementTracking =
    isEmployeeAdvance ||
    isReimbursement;

  const handleTypeChange = (
    value: ExpenseType
  ) => {
    setExpenseType(value);

    if (
      value ===
        "employee_advance" ||
      value === "reimbursement"
    ) {
      if (
        settlementStatus ===
        "not_applicable"
      ) {
        setSettlementStatus(
          "outstanding"
        );
      }
    } else if (!hasSettlements) {
      setSettlementStatus(
        "not_applicable"
      );
    }
  };

  async function uploadReceipt(
    companyId: string,
    file: File
  ) {
    const extension =
      fileExtension(file) || "file";

    const safeExtension =
      extension.replace(
        /[^a-z0-9]/g,
        ""
      ) || "file";

    const path =
      `${companyId}/${expenseId}/` +
      `${crypto.randomUUID()}.${safeExtension}`;

    const { error } =
      await supabase.storage
        .from("expense-receipts")
        .upload(path, file, {
          contentType:
            file.type ||
            "application/octet-stream",
          cacheControl: "3600",
          upsert: false,
        });

    if (error) {
      throw error;
    }

    return path;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!expense) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      const numericAmount =
        Number(amount);

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount <= 0
      ) {
        throw new Error(
          "Enter a valid expense amount."
        );
      }

      if (!expenseDate) {
        throw new Error(
          "Expense date is required."
        );
      }

      if (!description.trim()) {
        throw new Error(
          "Expense description is required."
        );
      }

      if (
        hasSettlements &&
        numericAmount < settledAmount
      ) {
        throw new Error(
          `Expense amount cannot be lower than the amount already settled (${formatCurrency(
            settledAmount,
            currency
          )}).`
        );
      }

      if (
        hasSettlementTracking &&
        settlementStatus ===
          "not_applicable"
      ) {
        throw new Error(
          "Employee advances and reimbursements must have a settlement status."
        );
      }

      if (
        !hasSettlementTracking &&
        !hasSettlements
      ) {
        setSettlementStatus(
          "not_applicable"
        );
      }

      let newReceiptPath =
        expense.receipt_path;

      if (receiptFile) {
        newReceiptPath =
          await uploadReceipt(
            expense.company_id,
            receiptFile
          );
      } else if (
        removeExistingReceipt
      ) {
        newReceiptPath = null;
      }

      const updateData = {
        expense_date: expenseDate,
        expense_type: expenseType,
        category_id:
          categoryId || null,
        description:
          description.trim(),
        vendor_name:
          vendorName.trim() || null,
        employee_id:
          employeeId || null,
        amount: numericAmount,
        currency:
          currency.trim().toUpperCase() ||
          "AED",
        payment_method:
          paymentMethod,
        reference:
          reference.trim() || null,
        notes:
          notes.trim() || null,
        receipt_path:
          newReceiptPath,
        status,
        settlement_status:
          hasSettlementTracking ||
          hasSettlements
            ? settlementStatus
            : "not_applicable",
      };

      const {
        error: updateError,
      } = await supabase
        .from("expenses")
        .update(updateData)
        .eq("id", expense.id)
        .eq(
          "company_id",
          expense.company_id
        );

      if (updateError) {
        /*
         * If a new receipt was uploaded but
         * the database update failed, remove
         * the newly-created orphaned object.
         */
        if (
          receiptFile &&
          newReceiptPath &&
          newReceiptPath !==
            expense.receipt_path
        ) {
          await supabase.storage
            .from("expense-receipts")
            .remove([newReceiptPath])
            .catch(() => undefined);
        }

        throw updateError;
      }

      const changedFields: string[] =
        [];

      if (
        expense.expense_date !==
        updateData.expense_date
      ) {
        changedFields.push(
          "expense_date"
        );
      }

      if (
        expense.expense_type !==
        updateData.expense_type
      ) {
        changedFields.push(
          "expense_type"
        );
      }

      if (
        expense.category_id !==
        updateData.category_id
      ) {
        changedFields.push(
          "category"
        );
      }

      if (
        expense.description !==
        updateData.description
      ) {
        changedFields.push(
          "description"
        );
      }

      if (
        Number(expense.amount) !==
        updateData.amount
      ) {
        changedFields.push("amount");
      }

      if (
        expense.currency !==
        updateData.currency
      ) {
        changedFields.push(
          "currency"
        );
      }

      if (
        expense.payment_method !==
        updateData.payment_method
      ) {
        changedFields.push(
          "payment_method"
        );
      }

      if (
        expense.vendor_name !==
        updateData.vendor_name
      ) {
        changedFields.push(
          "vendor"
        );
      }

      if (
        expense.employee_id !==
        updateData.employee_id
      ) {
        changedFields.push(
          "employee"
        );
      }

      if (
        expense.reference !==
        updateData.reference
      ) {
        changedFields.push(
          "reference"
        );
      }

      if (
        expense.notes !==
        updateData.notes
      ) {
        changedFields.push(
          "notes"
        );
      }

      if (
        expense.status !==
        updateData.status
      ) {
        changedFields.push(
          "status"
        );
      }

      if (
        expense.settlement_status !==
        updateData.settlement_status
      ) {
        changedFields.push(
          "settlement_status"
        );
      }

      if (
        expense.receipt_path !==
        updateData.receipt_path
      ) {
        changedFields.push(
          "receipt"
        );
      }

      await supabase
        .from("expense_activity")
        .insert({
          company_id:
            expense.company_id,
          expense_id:
            expense.id,
          actor_id: user.id,
          action: "updated",
          details: {
            changed_fields:
              changedFields,
            previous_status:
              expense.status,
            new_status:
              updateData.status,
          },
        });

      /*
       * Remove the previous Storage object
       * after the DB update succeeds.
       */
      if (
        expense.receipt_path &&
        expense.receipt_path !==
          updateData.receipt_path
      ) {
        const {
          error: removeError,
        } = await supabase.storage
          .from("expense-receipts")
          .remove([
            expense.receipt_path,
          ]);

        if (removeError) {
          console.warn(
            "Old receipt could not be removed:",
            removeError
          );
        }
      }

      setSuccessMessage(
        "Expense updated successfully."
      );

      setTimeout(() => {
        router.push(
          `/expenses/${expense.id}`
        );
      }, 500);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update expense."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[70vh] items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
            <p className="text-sm text-gray-500">
              Loading expense...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!expense) {
    return (
      <AppShell>
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <h2 className="text-lg font-bold text-rose-800">
              Expense not found
            </h2>

            <p className="mt-1 text-sm text-rose-700">
              {errorMessage ||
                "The requested expense could not be found."}
            </p>

            <Link
              href="/expenses"
              className="mt-5 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Back to Expenses
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <Link
                    href="/expenses"
                    className="transition hover:text-emerald-700"
                  >
                    Expenses
                  </Link>

                  <span>/</span>

                  <Link
                    href={`/expenses/${expense.id}`}
                    className="transition hover:text-emerald-700"
                  >
                    Expense Detail
                  </Link>

                  <span>/</span>

                  <span className="font-medium text-gray-700">
                    Edit
                  </span>
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  Edit Expense
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Update expense #
                  {expense.id
                    .slice(0, 8)
                    .toUpperCase()}{" "}
                  ·{" "}
                  {formatDate(
                    expense.expense_date
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/expenses/${expense.id}`}
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Link>

                <button
                  form="expense-edit-form"
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
          {errorMessage && (
            <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <form
            id="expense-edit-form"
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)]"
          >
            <div className="space-y-6">
              {/* Expense Type */}
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-bold text-gray-900">
                    Expense Type
                  </h2>

                  <p className="mt-0.5 text-sm text-gray-500">
                    Define how this money-out transaction should be classified.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(
                    expenseTypeLabels
                  ).map(
                    ([value, label]) => {
                      const selected =
                        expenseType ===
                        value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            handleTypeChange(
                              value as ExpenseType
                            )
                          }
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                              : "border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/40"
                          }`}
                        >
                          <p className="text-sm font-semibold">
                            {label}
                          </p>

                          <p
                            className={`mt-1 text-xs ${
                              selected
                                ? "text-emerald-50"
                                : "text-gray-500"
                            }`}
                          >
                            {value ===
                            "employee_advance"
                              ? "Money issued to an employee."
                              : value ===
                                  "inventory_expense"
                                ? "Costs directly related to inventory."
                                : value ===
                                    "reimbursement"
                                  ? "Money owed back to an employee."
                                  : value ===
                                      "petty_cash"
                                    ? "Small cash-based business spending."
                                    : "General company money-out transaction."}
                          </p>
                        </button>
                      );
                    }
                  )}
                </div>
              </section>

              {/* Basic Information */}
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-bold text-gray-900">
                    Basic Information
                  </h2>

                  <p className="mt-0.5 text-sm text-gray-500">
                    Core details of the expense.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Expense Date
                    </label>

                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(event) =>
                        setExpenseDate(
                          event.target.value
                        )
                      }
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Category
                    </label>

                    <select
                      value={categoryId}
                      onChange={(event) =>
                        setCategoryId(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">
                        Select category
                      </option>

                      {categories.map(
                        (category) => (
                          <option
                            key={category.id}
                            value={category.id}
                          >
                            {category.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Description
                    </label>

                    <input
                      type="text"
                      value={description}
                      onChange={(event) =>
                        setDescription(
                          event.target.value
                        )
                      }
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="What was this expense for?"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Amount
                    </label>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(event) =>
                        setAmount(
                          event.target.value
                        )
                      }
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="0.00"
                    />

                    {hasSettlements && (
                      <p className="mt-1.5 text-xs text-amber-600">
                        Minimum allowed:{" "}
                        {formatCurrency(
                          settledAmount,
                          currency
                        )}{" "}
                        because settlements already exist.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Currency
                    </label>

                    <input
                      type="text"
                      maxLength={3}
                      value={currency}
                      onChange={(event) =>
                        setCurrency(
                          event.target.value.toUpperCase()
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm uppercase text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="AED"
                    />
                  </div>
                </div>
              </section>

              {/* Payment */}
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-bold text-gray-900">
                    Payment Information
                  </h2>

                  <p className="mt-0.5 text-sm text-gray-500">
                    Record how the transaction was paid.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Payment Method
                    </label>

                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(
                          event.target
                            .value as PaymentMethod
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      {Object.entries(
                        paymentMethodLabels
                      ).map(
                        ([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Reference
                    </label>

                    <input
                      type="text"
                      value={reference}
                      onChange={(event) =>
                        setReference(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Transaction ID, receipt number, etc."
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Vendor / Merchant
                    </label>

                    <input
                      type="text"
                      value={vendorName}
                      onChange={(event) =>
                        setVendorName(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Supplier, shop, service provider, etc."
                    />
                  </div>
                </div>
              </section>

              {/* People */}
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-bold text-gray-900">
                    People
                  </h2>

                  <p className="mt-0.5 text-sm text-gray-500">
                    Connect the transaction to an employee when applicable.
                  </p>
                </div>

                <div className="p-6">
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                    Employee
                  </label>

                  <select
                    value={employeeId}
                    onChange={(event) =>
                      setEmployeeId(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">
                      No employee
                    </option>

                    {employees.map(
                      (employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                        >
                          {employeeName(
                            employee
                          )}
                        </option>
                      )
                    )}
                  </select>

                  {employees.length ===
                    0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      No employees are currently available for this company.
                    </p>
                  )}
                </div>
              </section>

              {/* Settlement */}
              {hasSettlementTracking && (
                <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-6 py-4">
                    <h2 className="text-base font-bold text-gray-900">
                      Settlement Tracking
                    </h2>

                    <p className="mt-0.5 text-sm text-gray-500">
                      Track whether money issued or owed has been settled.
                    </p>
                  </div>

                  <div className="p-6">
                    {hasSettlements && (
                      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-amber-800">
                              Existing settlements
                            </p>

                            <p className="mt-1 text-xs text-amber-700">
                              This expense already has recorded settlement transactions.
                            </p>
                          </div>

                          <p className="text-sm font-bold text-amber-800">
                            {formatCurrency(
                              settledAmount,
                              currency
                            )}
                          </p>
                        </div>

                        <p className="mt-3 text-xs text-amber-700">
                          Existing settlements cannot be edited from this page. Use the Expense Detail page to add additional settlements.
                        </p>
                      </div>
                    )}

                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Settlement Status
                    </label>

                    <select
                      value={settlementStatus}
                      onChange={(event) =>
                        setSettlementStatus(
                          event.target
                            .value as SettlementStatus
                        )
                      }
                      disabled={
                        hasSettlements
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="outstanding">
                        {
                          settlementLabels.outstanding
                        }
                      </option>

                      <option value="partially_settled">
                        {
                          settlementLabels.partially_settled
                        }
                      </option>

                      <option value="settled">
                        {
                          settlementLabels.settled
                        }
                      </option>
                    </select>

                    {hasSettlements && (
                      <p className="mt-2 text-xs text-gray-500">
                        Settlement status is controlled by the recorded settlement transactions.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Supporting Information */}
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-bold text-gray-900">
                    Supporting Information
                  </h2>

                  <p className="mt-0.5 text-sm text-gray-500">
                    Receipt and additional notes.
                  </p>
                </div>

                <div className="space-y-5 p-6">
                  {/* Receipt */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Receipt
                    </label>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 3v12" />
                          <path d="m7 8 5-5 5 5" />
                          <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                        </svg>

                        <span>
                          Upload Receipt
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={openCamera}
                        className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
                      >
                        <svg
                          className="h-5 w-5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-.5-2Z" />
                          <circle
                            cx="12"
                            cy="12"
                            r="3.5"
                          />
                        </svg>

                        <span>
                          Take Photo
                        </span>
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                      onChange={
                        handleReceiptChange
                      }
                      className="hidden"
                    />

                    <p className="mt-2 text-xs text-gray-500">
                      JPG, JPEG, PNG, WEBP, HEIC, HEIF or PDF · Maximum 10 MB.
                    </p>

                    {/* Newly selected receipt */}
                    {receiptFile && (
                      <div className="mt-4 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
                        {receiptPreviewUrl && (
                          <div className="border-b border-emerald-200 bg-white p-2">
                            <div className="relative overflow-hidden rounded-lg bg-gray-100">
                              <img
                                src={
                                  receiptPreviewUrl
                                }
                                alt="Receipt preview"
                                className="max-h-[360px] w-full object-contain"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-emerald-800">
                              New receipt selected
                            </p>

                            <p className="mt-1 truncate text-xs text-emerald-700">
                              {receiptFile.name}
                            </p>

                            <p className="mt-1 text-[11px] text-emerald-600">
                              {(
                                receiptFile.size /
                                1024 /
                                1024
                              ).toFixed(2)}{" "}
                              MB
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={
                              clearSelectedReceipt
                            }
                            className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="border-t border-emerald-200 px-4 py-2.5 text-xs text-emerald-700">
                          This receipt will replace the existing receipt when you save the expense.
                        </div>
                      </div>
                    )}

                    {/* Existing receipt */}
                    {expense.receipt_path &&
                      !receiptFile &&
                      !removeExistingReceipt && (
                        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-700">
                              Existing receipt
                            </p>

                            <p className="mt-1 truncate text-xs text-gray-500">
                              {
                                expense.receipt_path
                                  .split("/")
                                  .pop()
                              }
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setRemoveExistingReceipt(
                                true
                              )
                            }
                            className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        </div>
                      )}

                    {/* Existing receipt removal */}
                    {removeExistingReceipt && (
                      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-rose-800">
                            Existing receipt will be removed
                          </p>

                          <p className="mt-1 text-xs text-rose-700">
                            Upload a new receipt above if you want to replace it instead.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setRemoveExistingReceipt(
                              false
                            )
                          }
                          className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          Keep
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Notes
                    </label>

                    <textarea
                      rows={5}
                      value={notes}
                      onChange={(event) =>
                        setNotes(
                          event.target.value
                        )
                      }
                      className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Additional information about this expense..."
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Status */}
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-bold text-gray-900">
                    Expense Status
                  </h2>

                  <p className="mt-0.5 text-sm text-gray-500">
                    Control the current workflow state.
                  </p>
                </div>

                <div className="space-y-5 p-6">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      Status
                    </label>

                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(
                          event.target
                            .value as ExpenseStatus
                        )
                      }
                      disabled={
                        expense.status ===
                        "cancelled"
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      {Object.entries(
                        statusLabels
                      ).map(
                        ([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        )
                      )}
                    </select>

                    {expense.status ===
                      "cancelled" && (
                      <p className="mt-2 text-xs text-rose-600">
                        Cancelled expenses cannot be reopened from the edit page.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      Current Status
                    </p>

                    <p className="mt-2 text-sm font-bold text-emerald-900">
                      {
                        statusLabels[
                          expense.status
                        ]
                      }
                    </p>
                  </div>
                </div>
              </section>

              {/* Financial Summary */}
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-bold text-gray-900">
                    Financial Summary
                  </h2>
                </div>

                <div className="space-y-4 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-500">
                      Current Amount
                    </span>

                    <span className="text-sm font-bold text-gray-900">
                      {formatCurrency(
                        Number(
                          amount || 0
                        ),
                        currency
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-500">
                      Already Settled
                    </span>

                    <span className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(
                        settledAmount,
                        currency
                      )}
                    </span>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-gray-700">
                        Outstanding
                      </span>

                      <span className="text-lg font-bold text-amber-600">
                        {formatCurrency(
                          Math.max(
                            Number(
                              amount || 0
                            ) -
                              settledAmount,
                            0
                          ),
                          currency
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Existing Record */}
              <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-base font-bold text-gray-900">
                    Existing Record
                  </h2>
                </div>

                <div className="space-y-4 p-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Expense ID
                    </p>

                    <p className="mt-1 break-all font-mono text-xs text-gray-700">
                      {expense.id}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Created
                    </p>

                    <p className="mt-1 text-sm text-gray-700">
                      {new Intl.DateTimeFormat(
                        "en-US",
                        {
                          dateStyle:
                            "medium",
                          timeStyle:
                            "short",
                        }
                      ).format(
                        new Date(
                          expense.created_at
                        )
                      )}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Last Updated
                    </p>

                    <p className="mt-1 text-sm text-gray-700">
                      {new Intl.DateTimeFormat(
                        "en-US",
                        {
                          dateStyle:
                            "medium",
                          timeStyle:
                            "short",
                        }
                      ).format(
                        new Date(
                          expense.updated_at
                        )
                      )}
                    </p>
                  </div>
                </div>
              </section>

              {/* Audit Reminder */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-bold text-emerald-900">
                  Changes are audited
                </p>

                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  Saving this expense creates an activity record showing which fields were changed. Existing settlement transactions remain permanently recorded.
                </p>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  form="expense-edit-form"
                  disabled={saving}
                  className="w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving Changes..."
                    : "Save Changes"}
                </button>

                <Link
                  href={`/expenses/${expense.id}`}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* Camera Modal */}
        {cameraOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
            <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Take Receipt Photo
                  </h2>

                  <p className="mt-0.5 text-xs text-gray-500">
                    Position the receipt inside the frame.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCamera}
                  className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Close camera"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m6 6 12 12" />
                    <path d="m18 6-12 12" />
                  </svg>
                </button>
              </div>

              {/* Camera Area */}
              <div className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden bg-black">
                {capturedPhotoUrl ? (
                  <img
                    src={capturedPhotoUrl}
                    alt="Captured receipt"
                    className="max-h-[70vh] w-full object-contain"
                  />
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full max-h-[70vh] w-full object-contain"
                    />

                    {/* Receipt framing guide */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative h-[72%] w-[86%] max-w-2xl rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]">
                        <div className="absolute left-3 top-3 h-8 w-8 border-l-4 border-t-4 border-emerald-400" />
                        <div className="absolute right-3 top-3 h-8 w-8 border-r-4 border-t-4 border-emerald-400" />
                        <div className="absolute bottom-3 left-3 h-8 w-8 border-b-4 border-l-4 border-emerald-400" />
                        <div className="absolute bottom-3 right-3 h-8 w-8 border-b-4 border-r-4 border-emerald-400" />

                        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11px] font-medium text-white">
                          Align receipt here
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {cameraLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                    <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                    <p className="mt-3 text-sm font-medium text-white">
                      Starting camera...
                    </p>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-lg">
                    {cameraError}
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col gap-3 border-t border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                {capturedPhotoUrl ? (
                  <>
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
                        <path d="M3 21v-5h5" />
                      </svg>

                      Retake Photo
                    </button>

                    <button
                      type="button"
                      onClick={
                        useCapturedPhoto
                      }
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="m5 12 4 4L19 6" />
                      </svg>

                      Use Photo
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={closeCamera}
                      className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={
                        capturePhoto
                      }
                      disabled={
                        cameraLoading ||
                        !!cameraError
                      }
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3.5"
                        />
                      </svg>

                      Capture Photo
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}