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
  description: string | null;
  is_active: boolean;
};

type Employee = {
  id: string;
  name: string;
};

type Company = {
  id: string;
  name: string;
  currency: string | null;
};

type FinancialAccount = {
  id: string;
  account_code: string;
  account_name: string;
  financial_account_type: string | null;
  currency: string | null;
  is_active: boolean;
};

const EXPENSE_TYPES: {
  value: ExpenseType;
  label: string;
  description: string;
}[] = [
  {
    value: "operating_expense",
    label: "Operating Expense",
    description: "Normal day-to-day business costs",
  },
  {
    value: "inventory_expense",
    label: "Inventory Expense",
    description: "Costs directly related to inventory",
  },
  {
    value: "employee_advance",
    label: "Employee Advance",
    description: "Money advanced to an employee",
  },
  {
    value: "reimbursement",
    label: "Reimbursement",
    description: "Business expense reimbursed to an employee",
  },
  {
    value: "petty_cash",
    label: "Petty Cash",
    description: "Small cash business expenses",
  },
  {
    value: "other",
    label: "Other",
    description: "Any other money-out transaction",
  },
];

const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "company_card", label: "Company Card" },
  { value: "petty_cash", label: "Petty Cash" },
  { value: "other", label: "Other" },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "AED",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "AED"} ${amount.toFixed(2)}`;
  }
}

export default function NewExpensePage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [company, setCompany] = useState<Company | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [financialAccounts, setFinancialAccounts] =
    useState<FinancialAccount[]>([]);


  const [expenseType, setExpenseType] =
    useState<ExpenseType>("operating_expense");

  const [expenseDate, setExpenseDate] =
    useState(todayString());

  const [categoryId, setCategoryId] = useState("");

  const [description, setDescription] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cash");

  const [paymentAccountId, setPaymentAccountId] =
    useState("");

  const [reference, setReference] =
    useState("");

  const [vendorName, setVendorName] =
    useState("");

  const [employeeId, setEmployeeId] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [status, setStatus] =
    useState<ExpenseStatus>("pending");

  const [settlementStatus, setSettlementStatus] =
    useState<SettlementStatus>("not_applicable");

  const [receiptFile, setReceiptFile] =
    useState<File | null>(null);

  const [receiptPreviewUrl, setReceiptPreviewUrl] =
    useState<string | null>(null);

  /* ---------------------------------------------------------
     CAMERA STATE
  --------------------------------------------------------- */

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhotoUrl, setCapturedPhotoUrl] =
    useState<string | null>(null);

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const cameraStreamRef =
    useRef<MediaStream | null>(null);

  const capturedPhotoFileRef =
    useRef<File | null>(null);

  const isEmployeeExpense =
    expenseType === "employee_advance" ||
    expenseType === "reimbursement";

  const currency =
    company?.currency || "AED";

  const selectedType = EXPENSE_TYPES.find(
    (item) => item.value === expenseType
  );

  const selectedCategory = categories.find(
    (category) => category.id === categoryId
  );

  const selectedPaymentMethod = PAYMENT_METHODS.find(
    (method) => method.value === paymentMethod
  );

  const selectedPaymentAccount = financialAccounts.find(
    (account) => account.id === paymentAccountId
  );

  /* ---------------------------------------------------------
     PAGE LOAD
  --------------------------------------------------------- */

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

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
          "No company membership was found for this account."
        );
      }

      const companyId = membership.company_id;

      const [
        companyResult,
        categoryResult,
        employeeResult,
        financialAccountResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name, currency")
          .eq("id", companyId)
          .maybeSingle(),

        supabase
          .from("expense_categories")
          .select(
            "id, name, description, is_active"
          )
          .eq("company_id", companyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("employees")
          .select(
            "id, first_name, last_name, display_name"
          )
          .eq("company_id", companyId)
          .order("first_name"),

        supabase
          .from("accounting_accounts")
          .select(
            "id, account_code, account_name, financial_account_type, currency, is_active"
          )
          .eq("company_id", companyId)
          .eq("is_active", true)
          .in("financial_account_type", ["cash", "bank", "petty_cash"])
          .order("account_code"),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (categoryResult.error) {
        throw categoryResult.error;
      }

      setCompany(
        (companyResult.data as Company | null) || null
      );

      setCategories(
        (categoryResult.data || []) as Category[]
      );

      if (financialAccountResult.error) {
        throw financialAccountResult.error;
      }

      setFinancialAccounts(
        (financialAccountResult.data || []) as FinancialAccount[]
      );

      if (
        !employeeResult.error &&
        employeeResult.data
      ) {
        setEmployees(
          employeeResult.data.map((employee) => ({
            id: employee.id,
            name:
              employee.display_name ||
              [
                employee.first_name,
                employee.last_name,
              ]
                .filter(Boolean)
                .join(" ") ||
              "Unnamed Employee",
          }))
        );
      } else {
        setEmployees([]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the expense form."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (expenseType === "employee_advance") {
      setSettlementStatus("outstanding");
      setStatus("paid");
    } else if (expenseType === "reimbursement") {
      setSettlementStatus("outstanding");
    } else {
      setSettlementStatus("not_applicable");
    }

    if (!isEmployeeExpense) {
      setEmployeeId("");
    }
  }, [expenseType, isEmployeeExpense]);

  useEffect(() => {
    if (paymentAccountId) {
      const account = financialAccounts.find(
        (item) => item.id === paymentAccountId
      );

      if (!account) {
        setPaymentAccountId("");
      }
    }
  }, [financialAccounts, paymentAccountId]);

  /* ---------------------------------------------------------
     RECEIPT PREVIEW CLEANUP
  --------------------------------------------------------- */

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) {
        URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewUrl]);

  /* ---------------------------------------------------------
     CAMERA CLEANUP
  --------------------------------------------------------- */

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

  useEffect(() => {
    return () => {
      stopCamera();

      if (capturedPhotoUrl) {
        URL.revokeObjectURL(capturedPhotoUrl);
      }
    };
  }, [stopCamera, capturedPhotoUrl]);

  /* ---------------------------------------------------------
     OPEN CAMERA
  --------------------------------------------------------- */

  const openCamera = async () => {
    setErrorMessage("");
    setCameraError("");
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

  /* ---------------------------------------------------------
     CAPTURE PHOTO
  --------------------------------------------------------- */

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      setCameraError(
        "Camera is not ready yet. Please try again."
      );
      return;
    }

    if (
      !video.videoWidth ||
      !video.videoHeight
    ) {
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

    const context =
      canvas.getContext("2d");

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

  /* ---------------------------------------------------------
     RETAKE PHOTO
  --------------------------------------------------------- */

  const retakePhoto = async () => {
    if (capturedPhotoUrl) {
      URL.revokeObjectURL(
        capturedPhotoUrl
      );
    }

    setCapturedPhotoUrl(null);
    capturedPhotoFileRef.current = null;
    setCameraError("");
    setCameraLoading(true);

    try {
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
      setCameraError(
        error instanceof Error
          ? error.message
          : "Unable to restart the camera."
      );
    } finally {
      setCameraLoading(false);
    }
  };

  /* ---------------------------------------------------------
     USE CAPTURED PHOTO
  --------------------------------------------------------- */

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

    setReceiptFile(file);
    setReceiptPreviewUrl(
      URL.createObjectURL(file)
    );

    if (capturedPhotoUrl) {
      URL.revokeObjectURL(
        capturedPhotoUrl
      );
    }

    setCapturedPhotoUrl(null);
    capturedPhotoFileRef.current = null;

    stopCamera();
    setCameraOpen(false);
    setCameraError("");
  };

  /* ---------------------------------------------------------
     CLOSE CAMERA
  --------------------------------------------------------- */

  const closeCamera = () => {
    stopCamera();

    if (capturedPhotoUrl) {
      URL.revokeObjectURL(
        capturedPhotoUrl
      );
    }

    setCapturedPhotoUrl(null);
    capturedPhotoFileRef.current = null;
    setCameraError("");
    setCameraOpen(false);
  };

  /* ---------------------------------------------------------
     NORMAL FILE UPLOAD
  --------------------------------------------------------- */

  const handleReceiptChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      return;
    }

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {
      setErrorMessage(
        "Receipt file must be 10 MB or smaller."
      );

      event.target.value = "";
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "application/pdf",
    ];

    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".heic",
      ".heif",
      ".pdf",
    ];

    const fileName =
      file.name.toLowerCase();

    const hasAllowedType =
      allowedTypes.includes(file.type);

    const hasAllowedExtension =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(extension)
      );

    if (
      !hasAllowedType &&
      !hasAllowedExtension
    ) {
      setErrorMessage(
        "Receipt must be a JPG, PNG, WEBP, HEIC, HEIF, or PDF file."
      );

      event.target.value = "";
      return;
    }

    setErrorMessage("");
    setReceiptFile(file);

    if (receiptPreviewUrl) {
      URL.revokeObjectURL(
        receiptPreviewUrl
      );
    }

    const browserPreviewableTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      browserPreviewableTypes.includes(
        file.type
      )
    ) {
      setReceiptPreviewUrl(
        URL.createObjectURL(file)
      );
    } else {
      setReceiptPreviewUrl(null);
    }
  };

  /* ---------------------------------------------------------
     SUPABASE RECEIPT UPLOAD
  --------------------------------------------------------- */

  const uploadReceipt = async (
    companyId: string,
    expenseId: string
  ) => {
    if (!receiptFile) {
      return null;
    }

    setUploadingReceipt(true);

    try {
      const extension =
        receiptFile.name
          .split(".")
          .pop()
          ?.toLowerCase() || "bin";

      const safeExtension =
        extension.replace(
          /[^a-z0-9]/g,
          ""
        ) || "bin";

      const path =
        `${companyId}/${expenseId}/` +
        `${crypto.randomUUID()}.${safeExtension}`;

      const { error } =
        await supabase.storage
          .from("expense-receipts")
          .upload(
            path,
            receiptFile,
            {
              cacheControl: "3600",
              upsert: false,
              contentType:
                receiptFile.type ||
                "application/octet-stream",
            }
          );

      if (error) {
        throw error;
      }

      return path;
    } finally {
      setUploadingReceipt(false);
    }
  };

  /* ---------------------------------------------------------
     VALIDATION
  --------------------------------------------------------- */

  const validateForm = () => {
    if (!expenseDate) {
      return "Please select the expense date.";
    }

    if (!categoryId) {
      return "Please select an expense category.";
    }

    if (!description.trim()) {
      return "Please enter a description.";
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      return "Please enter a valid expense amount greater than zero.";
    }

    if (
      numericAmount >
      999999999999
    ) {
      return "Expense amount is too large.";
    }

    if (
      isEmployeeExpense &&
      !employeeId
    ) {
      if (employees.length > 0) {
        return "Please select the employee associated with this expense.";
      }
    }

    if (status === "paid" && !paymentAccountId) {
      return "Please select the account the payment came from.";
    }

    if (paymentAccountId) {
      const paymentAccount = financialAccounts.find(
        (account) => account.id === paymentAccountId
      );

      if (!paymentAccount) {
        return "The selected payment account is no longer available.";
      }

      if (paymentAccount.currency && paymentAccount.currency !== currency) {
        return `Payment account currency (${paymentAccount.currency}) does not match the expense currency (${currency}).`;
      }
    }

    if (
      expenseType ===
      "employee_advance"
    ) {
      if (
        settlementStatus !==
          "outstanding" &&
        settlementStatus !==
          "partially_settled" &&
        settlementStatus !==
          "settled"
      ) {
        return "Employee advances must have a settlement status.";
      }
    }

    return null;
  };

  /* ---------------------------------------------------------
     SUBMIT
  --------------------------------------------------------- */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const validationError =
      validateForm();

    if (validationError) {
      setErrorMessage(
        validationError
      );
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

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
      } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq(
            "user_id",
            user.id
          )
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

      const companyId =
        membership.company_id;

      const numericAmount =
        Number(amount);

      const {
        data: expense,
        error: insertError,
      } =
        await supabase
          .from("expenses")
          .insert({
            company_id:
              companyId,
            expense_date:
              expenseDate,
            expense_type:
              expenseType,
            category_id:
              categoryId,
            description:
              description.trim(),
            vendor_name:
              vendorName.trim() ||
              null,
            employee_id:
              employeeId || null,
            amount:
              numericAmount,
            currency,
            payment_method:
              paymentMethod,
            payment_account_id:
              paymentAccountId || null,
            reference:
              reference.trim() ||
              null,
            notes:
              notes.trim() || null,
            receipt_path:
              null,
            status,
            settlement_status:
              isEmployeeExpense
                ? settlementStatus
                : "not_applicable",
            created_by:
              user.id,
          })
          .select("id")
          .single();

      if (insertError) {
        throw insertError;
      }

      if (!expense?.id) {
        throw new Error(
          "Expense was created but no expense ID was returned."
        );
      }

      let uploadedReceiptPath:
        | string
        | null = null;

      if (receiptFile) {
        try {
          uploadedReceiptPath =
            await uploadReceipt(
              companyId,
              expense.id
            );
        } catch (receiptError) {
          setSuccessMessage(
            "Expense recorded, but the receipt could not be uploaded."
          );

          console.error(
            "Expense receipt upload failed:",
            receiptError
          );
        }
      }

      if (uploadedReceiptPath) {
        const {
          error:
            receiptUpdateError,
        } =
          await supabase
            .from("expenses")
            .update({
              receipt_path:
                uploadedReceiptPath,
            })
            .eq(
              "id",
              expense.id
            )
            .eq(
              "company_id",
              companyId
            );

        if (receiptUpdateError) {
          console.error(
            "Expense receipt path update failed:",
            receiptUpdateError
          );
        }
      }

      router.push(
        `/expenses/${expense.id}`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the expense."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------
     LOADING
  --------------------------------------------------------- */

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />

              <div className="mt-3 h-4 w-full max-w-96 animate-pulse rounded bg-slate-100" />

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
                <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">

          {/* Header */}
          <div className="mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Link
                  href="/expenses"
                  className="transition hover:text-emerald-600"
                >
                  Expenses
                </Link>

                <span>/</span>

                <span className="text-slate-700">
                  New Expense
                </span>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                New Expense
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Record a company money-out transaction.
              </p>
            </div>

            <Link
              href="/expenses"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40 sm:w-auto"
            >
              Back to Expenses
            </Link>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="font-semibold">
                Unable to save expense
              </div>

              <div className="mt-1 break-words">
                {errorMessage}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">

              {/* Main Form */}
              <div className="min-w-0 space-y-5 sm:space-y-6">

                {/* Expense Type */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Expense Type
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Select what kind of money-out transaction this is.
                    </p>
                  </div>

                  <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                    {EXPENSE_TYPES.map(
                      (type) => {
                        const selected =
                          expenseType ===
                          type.value;

                        return (
                          <button
                            key={
                              type.value
                            }
                            type="button"
                            onClick={() =>
                              setExpenseType(
                                type.value
                              )
                            }
                            className={`group min-w-0 rounded-xl border p-4 text-left transition ${
                              selected
                                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-900 hover:border-emerald-300 hover:bg-emerald-50/40"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">
                                  {
                                    type.label
                                  }
                                </div>

                                <div
                                  className={`mt-1 text-xs leading-5 ${
                                    selected
                                      ? "text-emerald-50"
                                      : "text-slate-500"
                                  }`}
                                >
                                  {
                                    type.description
                                  }
                                </div>
                              </div>

                              <div
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? "border-white bg-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {selected && (
                                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </section>

                {/* Basic Information */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Basic Information
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Core details used for the expense ledger and reporting.
                    </p>
                  </div>

                  <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="expense-date"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Expense Date
                      </label>

                      <input
                        id="expense-date"
                        type="date"
                        value={
                          expenseDate
                        }
                        onChange={(
                          event
                        ) =>
                          setExpenseDate(
                            event.target
                              .value
                          )
                        }
                        className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="category"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Category
                      </label>

                      <select
                        id="category"
                        value={
                          categoryId
                        }
                        onChange={(
                          event
                        ) =>
                          setCategoryId(
                            event.target
                              .value
                          )
                        }
                        className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      >
                        <option value="">
                          Select category
                        </option>

                        {categories.map(
                          (
                            category
                          ) => (
                            <option
                              key={
                                category.id
                              }
                              value={
                                category.id
                              }
                            >
                              {
                                category.name
                              }
                            </option>
                          )
                        )}
                      </select>

                      {categories.length ===
                        0 && (
                        <p className="mt-2 text-xs text-amber-600">
                          No active expense categories exist yet.
                          Create categories before recording expenses.
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor="description"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Description
                      </label>

                      <input
                        id="description"
                        type="text"
                        value={
                          description
                        }
                        onChange={(
                          event
                        ) =>
                          setDescription(
                            event.target
                              .value
                          )
                        }
                        placeholder="e.g. DHL shipping charges for customer orders"
                        maxLength={
                          500
                        }
                        className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="amount"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Amount
                      </label>

                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-slate-200 px-3 text-xs font-semibold text-slate-500">
                          {
                            currency
                          }
                        </div>

                        <input
                          id="amount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          value={
                            amount
                          }
                          onChange={(
                            event
                          ) =>
                            setAmount(
                              event.target
                                .value
                            )
                          }
                          placeholder="0.00"
                          className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white pl-20 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                        />
                      </div>

                      {Number(
                        amount
                      ) > 0 && (
                        <p className="mt-2 text-xs font-medium text-emerald-600">
                          {formatCurrency(
                            Number(
                              amount
                            ),
                            currency
                          )}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="status"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Initial Status
                      </label>

                      <select
                        id="status"
                        value={
                          status
                        }
                        onChange={(
                          event
                        ) =>
                          setStatus(
                            event.target
                              .value as ExpenseStatus
                          )
                        }
                        className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      >
                        <option value="pending">
                          Pending Approval
                        </option>

                        <option value="approved">
                          Approved
                        </option>

                        <option value="paid">
                          Paid
                        </option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Payment */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Payment
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Record how the money was paid or will be paid. Select the actual cash or bank account when the expense is paid.
                    </p>
                  </div>

                  <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="payment-method"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Payment Method
                      </label>

                      <select
                        id="payment-method"
                        value={
                          paymentMethod
                        }
                        onChange={(
                          event
                        ) =>
                          setPaymentMethod(
                            event.target
                              .value as PaymentMethod
                          )
                        }
                        className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      >
                        {PAYMENT_METHODS.map(
                          (
                            method
                          ) => (
                            <option
                              key={
                                method.value
                              }
                              value={
                                method.value
                              }
                            >
                              {
                                method.label
                              }
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="payment-account"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Payment Account
                        {status === "paid" && (
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        )}
                      </label>

                      <select
                        id="payment-account"
                        value={paymentAccountId}
                        onChange={(event) =>
                          setPaymentAccountId(event.target.value)
                        }
                        className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      >
                        <option value="">
                          {financialAccounts.length > 0
                            ? "Select cash / bank account"
                            : "No cash or bank accounts available"}
                        </option>

                        {financialAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.account_code} — {account.account_name}
                          </option>
                        ))}
                      </select>

                      <p className="mt-2 text-xs text-slate-500">
                        Choose the company cash or bank account that actually paid this expense.
                      </p>

                      {financialAccounts.length === 0 && (
                        <p className="mt-2 text-xs text-amber-600">
                          Add an active cash or bank account in Accounting before marking an expense as paid.
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="reference"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Payment / Transaction Reference
                      </label>

                      <input
                        id="reference"
                        type="text"
                        value={
                          reference
                        }
                        onChange={(
                          event
                        ) =>
                          setReference(
                            event.target
                              .value
                          )
                        }
                        placeholder="Receipt no., transaction ID, cheque no., etc."
                        maxLength={
                          200
                        }
                        className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>
                  </div>
                </section>

                {/* People / Vendor */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      People / Vendor
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Connect the transaction to an employee or supplier/merchant.
                    </p>
                  </div>

                  <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="vendor"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Vendor / Merchant
                      </label>

                      <input
                        id="vendor"
                        type="text"
                        value={
                          vendorName
                        }
                        onChange={(
                          event
                        ) =>
                          setVendorName(
                            event.target
                              .value
                          )
                        }
                        placeholder="e.g. DHL, DEWA, Amazon, local supplier"
                        maxLength={
                          200
                        }
                        className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="employee"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Employee

                        {isEmployeeExpense && (
                          <span className="ml-1 text-red-500">
                            *
                          </span>
                        )}
                      </label>

                      {employees.length >
                      0 ? (
                        <select
                          id="employee"
                          value={
                            employeeId
                          }
                          onChange={(
                            event
                          ) =>
                            setEmployeeId(
                              event.target
                                .value
                            )
                          }
                          className="h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                        >
                          <option value="">
                            {isEmployeeExpense
                              ? "Select employee"
                              : "No employee"}
                          </option>

                          {employees.map(
                            (
                              employee
                            ) => (
                              <option
                                key={
                                  employee.id
                                }
                                value={
                                  employee.id
                                }
                              >
                                {
                                  employee.name
                                }
                              </option>
                            )
                          )}
                        </select>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3">
                          <div className="text-sm font-medium text-slate-700">
                            Employees module not connected yet
                          </div>

                          <div className="mt-1 text-xs leading-5 text-slate-500">
                            The expense database already supports employee_id.
                            Once the Employees module is available, employee
                            selection will connect automatically without
                            changing existing expense records.
                          </div>
                        </div>
                      )}

                      {isEmployeeExpense &&
                        employees.length ===
                          0 && (
                          <p className="mt-2 text-xs text-amber-600">
                            This expense will be recorded now. Employee
                            linking can be completed once the Employees
                            module is connected.
                          </p>
                        )}
                    </div>
                  </div>
                </section>

                {/* Settlement */}
                {isEmployeeExpense && (
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                      <h2 className="text-base font-semibold text-slate-900">
                        Settlement Tracking
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        Track money owed back to the company for advances,
                        or amounts owed to employees for reimbursements.
                      </p>
                    </div>

                    <div className="p-4 sm:p-6">
                      <label
                        htmlFor="settlement-status"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Settlement Status
                      </label>

                      <select
                        id="settlement-status"
                        value={
                          settlementStatus
                        }
                        onChange={(
                          event
                        ) =>
                          setSettlementStatus(
                            event.target
                              .value as SettlementStatus
                          )
                        }
                        className="h-11 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      >
                        <option value="outstanding">
                          Outstanding
                        </option>

                        <option value="partially_settled">
                          Partially Settled
                        </option>

                        <option value="settled">
                          Settled
                        </option>
                      </select>

                      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                        <div className="text-sm font-semibold text-emerald-900">
                          {expenseType ===
                          "employee_advance"
                            ? "Employee Advance"
                            : "Employee Reimbursement"}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-emerald-800/70">
                          {expenseType ===
                          "employee_advance"
                            ? "The payment is recorded as money advanced to the employee. The outstanding balance can be settled later from the expense record."
                            : "The transaction remains connected to the employee so the reimbursement can be tracked through its payment and settlement lifecycle."}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Supporting Information */}
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                    <h2 className="text-base font-semibold text-slate-900">
                      Supporting Information
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Keep receipts and additional notes attached to the permanent expense record.
                    </p>
                  </div>

                  <div className="space-y-5 p-4 sm:p-6">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Receipt / Supporting Document
                      </label>

                      {/* Normal Upload */}
                      <input
                        id="receipt-upload"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
                        onChange={
                          handleReceiptChange
                        }
                        className="hidden"
                      />

                      {/* Receipt Actions */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label
                          htmlFor="receipt-upload"
                          className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
                        >
                          <svg
                            aria-hidden="true"
                            className="h-5 w-5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 16V4" />
                            <path d="M8 8l4-4 4 4" />
                            <path d="M4 16.5v1.25A2.25 2.25 0 0 0 6.25 20h11.5A2.25 2.25 0 0 0 20 17.75V16.5" />
                          </svg>

                          <span>
                            Upload Receipt
                          </span>
                        </label>

                        <button
                          type="button"
                          onClick={
                            openCamera
                          }
                          className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100"
                        >
                          <svg
                            aria-hidden="true"
                            className="h-5 w-5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1.2-1.5h4.6L15.5 5h2A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
                            <circle cx="12" cy="12" r="3.25" />
                          </svg>

                          <span>
                            Take Photo
                          </span>
                        </button>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        Upload a receipt or take a photo with your phone camera.
                        JPG, PNG, WEBP, HEIC, HEIF or PDF · Maximum 10 MB
                      </p>

                      {receiptFile && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {receiptPreviewUrl ? (
                              <img
                                src={
                                  receiptPreviewUrl
                                }
                                alt="Receipt preview"
                                className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500">
                                {receiptFile.name
                                  .toLowerCase()
                                  .endsWith(
                                    ".pdf"
                                  ) ||
                                receiptFile.type ===
                                  "application/pdf"
                                  ? "PDF"
                                  : "IMG"}
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-slate-800">
                                {
                                  receiptFile.name
                                }
                              </div>

                              <div className="mt-1 text-xs text-slate-500">
                                {(
                                  receiptFile.size /
                                  1024 /
                                  1024
                                ).toFixed(
                                  2
                                )}{" "}
                                MB
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="notes"
                        className="mb-2 block text-sm font-medium text-slate-700"
                      >
                        Notes
                      </label>

                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(
                          event
                        ) =>
                          setNotes(
                            event.target
                              .value
                          )
                        }
                        placeholder="Additional details, internal notes, reason for expense, etc."
                        rows={5}
                        maxLength={
                          2000
                        }
                        className="w-full min-w-0 resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      />

                      <div className="mt-1 text-right text-xs text-slate-400">
                        {
                          notes.length
                        }
                        /2000
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Summary */}
              <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          Expense Summary
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          Review before saving.
                        </p>
                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        $
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 p-4 sm:p-6">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Type
                      </div>

                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {
                          selectedType?.label
                        }
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Category
                      </div>

                      <div className="mt-1 break-words text-sm font-medium text-slate-800">
                        {selectedCategory?.name ||
                          "Not selected"}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Payment
                      </div>

                      <div className="mt-1 break-words text-sm font-medium text-slate-800">
                        {
                          selectedPaymentMethod?.label
                        }
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Payment Account
                      </div>

                      <div className="mt-1 break-words text-sm font-medium text-slate-800">
                        {selectedPaymentAccount
                          ? `${selectedPaymentAccount.account_code} — ${selectedPaymentAccount.account_name}`
                          : status === "paid"
                            ? "Not selected"
                            : "Selected when paid"}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-5">
                      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Amount
                      </div>

                      <div className="mt-1 break-words text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                        {formatCurrency(
                          Number(
                            amount
                          ) || 0,
                          currency
                        )}
                      </div>
                    </div>

                    {isEmployeeExpense && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Settlement
                        </div>

                        <div className="mt-1 text-sm font-semibold text-slate-800">
                          {settlementStatus ===
                          "outstanding"
                            ? "Outstanding"
                            : settlementStatus ===
                              "partially_settled"
                            ? "Partially Settled"
                            : "Settled"}
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                        Automatic Processing
                      </div>

                      <p className="mt-2 text-xs leading-5 text-emerald-800/70">
                        Saving this expense creates its permanent ledger
                        record, activity entry, accounting record, and
                        approval notification automatically.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        saving ||
                        uploadingReceipt ||
                        categories.length ===
                          0
                      }
                      className="flex h-11 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving
                        ? uploadingReceipt
                          ? "Uploading receipt..."
                          : "Saving expense..."
                        : "Save Expense"}
                    </button>

                    <Link
                      href="/expenses"
                      className="flex h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                    >
                      Cancel
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </form>
        </div>
      </div>

      {/* =====================================================
          CAMERA MODAL
      ===================================================== */}

      {cameraOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6">
          <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Camera Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Take Receipt Photo
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Position the receipt clearly inside the camera.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCamera}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                aria-label="Close camera"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Camera Area */}
            <div className="relative min-h-0 flex-1 bg-black">

              {!capturedPhotoUrl ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="block aspect-[3/4] max-h-[65vh] w-full object-contain sm:aspect-video"
                  />

                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />

                  {cameraLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="text-center text-white">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                        <p className="mt-3 text-sm font-medium">
                          Starting camera...
                        </p>
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-x-3 bottom-3 rounded-xl border border-red-300/40 bg-red-950/85 p-4 text-sm text-white backdrop-blur sm:inset-x-5 sm:bottom-5">
                      <div className="font-semibold text-red-100">
                        Camera unavailable
                      </div>

                      <p className="mt-1 leading-5 text-red-100/80">
                        {cameraError}
                      </p>

                      <p className="mt-2 text-xs text-red-100/60">
                        Make sure camera permission is allowed for SBS and
                        that you are using HTTPS.
                      </p>
                    </div>
                  )}

                  {!cameraLoading &&
                    !cameraError && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
                        <div className="relative h-[70%] w-[88%] max-w-xl rounded-xl border-2 border-white/70">
                          <div className="absolute -left-0.5 -top-0.5 h-7 w-7 border-l-4 border-t-4 border-white" />
                          <div className="absolute -right-0.5 -top-0.5 h-7 w-7 border-r-4 border-t-4 border-white" />
                          <div className="absolute -bottom-0.5 -left-0.5 h-7 w-7 border-b-4 border-l-4 border-white" />
                          <div className="absolute -bottom-0.5 -right-0.5 h-7 w-7 border-b-4 border-r-4 border-white" />
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <div className="relative flex items-center justify-center bg-black">
                  <img
                    src={capturedPhotoUrl}
                    alt="Captured receipt preview"
                    className="block aspect-[3/4] max-h-[65vh] w-full object-contain sm:aspect-video"
                  />
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-5">

              {capturedPhotoUrl ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={
                      retakePhoto
                    }
                    className="flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    Retake
                  </button>

                  <button
                    type="button"
                    onClick={
                      useCapturedPhoto
                    }
                    className="flex h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Use Photo
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={
                      closeCamera
                    }
                    className="order-2 flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:order-1"
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
                      Boolean(cameraError)
                    }
                    className="order-1 flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:order-2"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white">
                      <span className="h-3 w-3 rounded-full bg-white" />
                    </span>

                    Capture Photo
                  </button>
                </div>
              )}

              <p className="mt-3 text-center text-xs text-slate-400">
                Photos are limited to 10 MB and will be attached to this expense.
              </p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}