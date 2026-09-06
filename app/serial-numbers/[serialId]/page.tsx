"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type SerialStatus =
  | "available"
  | "reserved"
  | "sold"
  | "returned"
  | "repair"
  | "rma"
  | "damaged"
  | "lost"
  | "disposed";

type SerializedUnit = {
  id: string;
  company_id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: SerialStatus;
  warehouse_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  invoice_id: string | null;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  cost_price: number;
  warranty_start: string | null;
  warranty_end: string | null;
  received_at: string | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
  } | null;
  variant?: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
  } | null;
  customer?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

type HistoryEvent = {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

const inputStyle = {
  border: "1px solid #e2e8f0",
};

function statusLabel(status: SerialStatus) {
  switch (status) {
    case "available":
      return "Available";
    case "reserved":
      return "Reserved";
    case "sold":
      return "Sold";
    case "returned":
      return "Returned";
    case "repair":
      return "Repair";
    case "rma":
      return "RMA";
    case "damaged":
      return "Damaged";
    case "lost":
      return "Lost";
    case "disposed":
      return "Disposed";
    default:
      return status;
  }
}

function statusClasses(status: SerialStatus) {
  switch (status) {
    case "available":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "reserved":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "sold":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "returned":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    case "repair":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "rma":
      return "bg-rose-50 text-rose-700 ring-rose-200";
    case "damaged":
      return "bg-red-50 text-red-700 ring-red-200";
    case "lost":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "disposed":
      return "bg-slate-100 text-slate-500 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function eventLabel(eventType: string) {
  switch (eventType) {
    case "created":
      return "Serial number created";
    case "status_changed":
      return "Status changed";
    case "warehouse_transfer":
      return "Warehouse transferred";
    case "sold":
      return "Unit sold";
    case "returned":
      return "Unit returned";
    case "repair":
      return "Sent for repair";
    case "rma":
      return "RMA created";
    case "warranty":
      return "Warranty updated";
    default:
      return eventType
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );
  }
}

function formatStatusForHistory(
  status: string | null
) {
  if (!status) return "—";

  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1.5 text-sm text-slate-900">
        {value}
      </div>
    </div>
  );
}

export default function SerialNumberDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const serialId = Array.isArray(params.serialId)
    ? params.serialId[0]
    : params.serialId;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  const [unit, setUnit] =
    useState<SerializedUnit | null>(null);

  const [history, setHistory] =
    useState<HistoryEvent[]>([]);

  const [currency, setCurrency] = useState("USD");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      if (!serialId) {
        setErrorMessage(
          "Serial number ID is missing."
        );
        return;
      }

      // ------------------------------------------------------
      // 1. Authenticate
      // ------------------------------------------------------

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      // ------------------------------------------------------
      // 2. Get company membership
      // ------------------------------------------------------

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
        setErrorMessage(
          "No company membership was found for this account."
        );
        return;
      }

      const companyId = membership.company_id;

      // ------------------------------------------------------
      // 3. Company
      // ------------------------------------------------------

      const {
        data: company,
        error: companyError,
      } = await supabase
        .from("companies")
        .select("id, currency")
        .eq("id", companyId)
        .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      setCurrency(company?.currency || "USD");

      // ------------------------------------------------------
      // 4. Serialized unit
      // ------------------------------------------------------

      const {
        data: serialData,
        error: serialError,
      } = await supabase
        .from("serialized_units")
        .select(
          `
            id,
            company_id,
            product_id,
            variant_id,
            serial_number,
            barcode,
            status,
            warehouse_id,
            customer_id,
            order_id,
            invoice_id,
            purchase_order_id,
            purchase_order_item_id,
            cost_price,
            warranty_start,
            warranty_end,
            received_at,
            sold_at,
            notes,
            created_at,
            updated_at,
            products (
              id,
              name,
              brand,
              category
            ),
            product_variants (
              id,
              name,
              sku,
              barcode
            ),
            customers (
              id,
              name,
              email,
              phone
            )
          `
        )
        .eq("id", serialId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (serialError) {
        throw serialError;
      }

      if (!serialData) {
        setErrorMessage(
          "Serial number not found."
        );
        return;
      }

      const normalizedUnit: SerializedUnit = {
        id: serialData.id,
        company_id: serialData.company_id,
        product_id: serialData.product_id,
        variant_id: serialData.variant_id,
        serial_number: serialData.serial_number,
        barcode: serialData.barcode,
        status: serialData.status,
        warehouse_id: serialData.warehouse_id,
        customer_id: serialData.customer_id,
        order_id: serialData.order_id,
        invoice_id: serialData.invoice_id,
        purchase_order_id:
          serialData.purchase_order_id,
        purchase_order_item_id:
          serialData.purchase_order_item_id,
        cost_price: Number(
          serialData.cost_price || 0
        ),
        warranty_start:
          serialData.warranty_start,
        warranty_end:
          serialData.warranty_end,
        received_at:
          serialData.received_at,
        sold_at: serialData.sold_at,
        notes: serialData.notes,
        created_at:
          serialData.created_at,
        updated_at:
          serialData.updated_at,
        product: Array.isArray(
          serialData.products
        )
          ? serialData.products[0] || null
          : serialData.products || null,
        variant: Array.isArray(
          serialData.product_variants
        )
          ? serialData.product_variants[0] ||
            null
          : serialData.product_variants ||
            null,
        customer: Array.isArray(
          serialData.customers
        )
          ? serialData.customers[0] || null
          : serialData.customers || null,
      };

      setUnit(normalizedUnit);

      // ------------------------------------------------------
      // 5. History
      // ------------------------------------------------------

      const {
        data: historyData,
        error: historyError,
      } = await supabase
        .from("serial_number_history")
        .select(
          `
            id,
            event_type,
            from_status,
            to_status,
            from_warehouse_id,
            to_warehouse_id,
            reference_type,
            reference_id,
            notes,
            created_by,
            created_at
          `
        )
        .eq(
          "serialized_unit_id",
          serialId
        )
        .eq("company_id", companyId)
        .order("created_at", {
          ascending: false,
        });

      if (historyError) {
        throw historyError;
      }

      setHistory(
        (historyData || []) as HistoryEvent[]
      );
    } catch (error) {
      console.error(
        "Serial number detail load error:",
        error
      );

      setErrorMessage(
        "Unable to load this serial number. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router, serialId, supabase]);

  useEffect(() => {
    // This effect intentionally starts the asynchronous serial-number synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  // ----------------------------------------------------------
  // Warranty state
  // ----------------------------------------------------------

  const warrantyState = useMemo(() => {
    if (!unit?.warranty_end) {
      return {
        label: "No Warranty",
        classes:
          "bg-slate-100 text-slate-600 ring-slate-200",
      };
    }

    const today = new Date();
    const end = new Date(
      `${unit.warranty_end}T23:59:59`
    );

    if (end < today) {
      return {
        label: "Expired",
        classes:
          "bg-red-50 text-red-700 ring-red-200",
      };
    }

    return {
      label: "Active",
      classes:
        "bg-emerald-50 text-emerald-700 ring-emerald-200",
    };
  }, [unit]);

  return (
    <AppShell
      title={
        unit
          ? unit.serial_number
          : "Serial Number"
      }
      description={
        unit?.product?.name ||
        "Serialized unit details"
      }
      actions={
        unit ? (
          <Link
            href={`/serial-numbers/${unit.id}/edit`}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Edit Serial Number
          </Link>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* -------------------------------------------------- */}
        {/* Back */}
        {/* -------------------------------------------------- */}

        <Link
          href="/serial-numbers"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-black"
        >
          <span className="mr-2">←</span>
          Back to Serial Numbers
        </Link>

        {/* -------------------------------------------------- */}
        {/* Error */}
        {/* -------------------------------------------------- */}

        {errorMessage && (
          <div
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
            style={{
              border:
                "1px solid #fecaca",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* Loading */}
        {/* -------------------------------------------------- */}

        {loading ? (
          <div
            className="rounded-xl bg-white p-12 text-center text-sm text-slate-500"
            style={{
              border:
                "1px solid #e2e8f0",
            }}
          >
            Loading serial number...
          </div>
        ) : unit ? (
          <>
            {/* ------------------------------------------------ */}
            {/* Hero */}
            {/* ------------------------------------------------ */}

            <section
              className="rounded-xl bg-white p-6"
              style={{
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="break-all text-2xl font-semibold tracking-tight text-slate-950">
                      {unit.serial_number}
                    </h1>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusClasses(
                        unit.status
                      )}`}
                    >
                      {statusLabel(
                        unit.status
                      )}
                    </span>
                  </div>

                  <div className="mt-2 text-sm text-slate-500">
                    {unit.product?.name ||
                      "Unknown Product"}

                    {unit.variant &&
                      unit.variant.name !==
                        "Default" && (
                        <>
                          {" "}
                          ·{" "}
                          {unit.variant.name}
                        </>
                      )}
                  </div>

                  {unit.barcode && (
                    <div className="mt-3 text-sm text-slate-500">
                      <span className="font-medium text-slate-700">
                        Barcode:
                      </span>{" "}
                      {unit.barcode}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <div className="text-xs uppercase tracking-wide text-slate-400">
                    Unit Cost
                  </div>

                  <div className="text-xl font-semibold text-slate-950">
                    {formatMoney(
                      unit.cost_price,
                      currency
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ------------------------------------------------ */}
            {/* Overview */}
            {/* ------------------------------------------------ */}

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Product */}
              <section
                className="rounded-xl bg-white p-6"
                style={inputStyle}
              >
                <h2 className="text-base font-semibold text-slate-950">
                  Product
                </h2>

                <div className="mt-5 space-y-5">
                  <DetailItem
                    label="Product"
                    value={
                      <Link
                        href={`/products/${unit.product_id}`}
                        className="font-medium hover:underline"
                      >
                        {unit.product?.name ||
                          "Unknown Product"}
                      </Link>
                    }
                  />

                  <DetailItem
                    label="Brand"
                    value={
                      unit.product?.brand ||
                      "—"
                    }
                  />

                  <DetailItem
                    label="Category"
                    value={
                      unit.product?.category ||
                      "—"
                    }
                  />

                  <DetailItem
                    label="Variant"
                    value={
                      unit.variant?.name ||
                      "Default"
                    }
                  />

                  <DetailItem
                    label="SKU"
                    value={
                      unit.variant?.sku ||
                      "—"
                    }
                  />
                </div>
              </section>

              {/* Ownership */}
              <section
                className="rounded-xl bg-white p-6"
                style={inputStyle}
              >
                <h2 className="text-base font-semibold text-slate-950">
                  Ownership & Location
                </h2>

                <div className="mt-5 space-y-5">
                  <DetailItem
                    label="Customer"
                    value={
                      unit.customer ? (
                        <Link
                          href={`/customers/${unit.customer.id}`}
                          className="font-medium hover:underline"
                        >
                          {unit.customer.name}
                        </Link>
                      ) : (
                        "Not assigned"
                      )
                    }
                  />

                  <DetailItem
                    label="Warehouse"
                    value={
                      unit.warehouse_id
                        ? unit.warehouse_id
                        : "Not assigned"
                    }
                  />

                  <DetailItem
                    label="Sales Order"
                    value={
                      unit.order_id ? (
                        <Link
                          href={`/sales/${unit.order_id}`}
                          className="font-medium hover:underline"
                        >
                          View Order
                        </Link>
                      ) : (
                        "Not assigned"
                      )
                    }
                  />

                  <DetailItem
                    label="Invoice"
                    value={
                      unit.invoice_id ? (
                        <Link
                          href={`/invoices/${unit.invoice_id}`}
                          className="font-medium hover:underline"
                        >
                          View Invoice
                        </Link>
                      ) : (
                        "Not assigned"
                      )
                    }
                  />
                </div>
              </section>

              {/* Warranty */}
              <section
                className="rounded-xl bg-white p-6"
                style={inputStyle}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-950">
                    Warranty
                  </h2>

                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${warrantyState.classes}`}
                  >
                    {warrantyState.label}
                  </span>
                </div>

                <div className="mt-5 space-y-5">
                  <DetailItem
                    label="Warranty Start"
                    value={formatDate(
                      unit.warranty_start
                    )}
                  />

                  <DetailItem
                    label="Warranty End"
                    value={formatDate(
                      unit.warranty_end
                    )}
                  />

                  <DetailItem
                    label="Received"
                    value={formatDateTime(
                      unit.received_at
                    )}
                  />

                  <DetailItem
                    label="Sold"
                    value={formatDateTime(
                      unit.sold_at
                    )}
                  />
                </div>
              </section>
            </div>

            {/* ------------------------------------------------ */}
            {/* Notes */}
            {/* ------------------------------------------------ */}

            {unit.notes && (
              <section
                className="rounded-xl bg-white p-6"
                style={inputStyle}
              >
                <h2 className="text-base font-semibold text-slate-950">
                  Notes
                </h2>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {unit.notes}
                </p>
              </section>
            )}

            {/* ------------------------------------------------ */}
            {/* History */}
            {/* ------------------------------------------------ */}

            <section
              className="rounded-xl bg-white p-6"
              style={inputStyle}
            >
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  Serial History
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Complete lifecycle history for this
                  physical unit.
                </p>
              </div>

              {history.length === 0 ? (
                <div className="mt-6 rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No history events recorded yet.
                </div>
              ) : (
                <div className="relative mt-6">
                  <div className="space-y-6">
                    {history.map(
                      (event, index) => (
                        <div
                          key={event.id}
                          className="relative flex gap-4"
                        >
                          {/* Timeline */}
                          <div className="flex w-6 flex-shrink-0 flex-col items-center">
                            <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black text-[10px] text-white">
                              {index + 1}
                            </div>

                            {index <
                              history.length -
                                1 && (
                              <div className="absolute left-[11px] top-6 h-full w-px bg-slate-200" />
                            )}
                          </div>

                          {/* Event */}
                          <div className="min-w-0 flex-1 pb-1">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <h3 className="text-sm font-medium text-slate-900">
                                {eventLabel(
                                  event.event_type
                                )}
                              </h3>

                              <span className="text-xs text-slate-400">
                                {formatDateTime(
                                  event.created_at
                                )}
                              </span>
                            </div>

                            {(event.from_status ||
                              event.to_status) && (
                              <div className="mt-2 text-sm text-slate-600">
                                {event.from_status && (
                                  <span>
                                    {formatStatusForHistory(
                                      event.from_status
                                    )}
                                  </span>
                                )}

                                {event.from_status &&
                                  event.to_status && (
                                    <span className="mx-2 text-slate-400">
                                      →
                                    </span>
                                  )}

                                {event.to_status && (
                                  <span className="font-medium text-slate-900">
                                    {formatStatusForHistory(
                                      event.to_status
                                    )}
                                  </span>
                                )}
                              </div>
                            )}

                            {event.notes && (
                              <p className="mt-2 text-sm leading-6 text-slate-500">
                                {event.notes}
                              </p>
                            )}

                            {event.reference_type &&
                              event.reference_id && (
                                <div className="mt-2 text-xs text-slate-400">
                                  Reference:{" "}
                                  {
                                    event.reference_type
                                  }
                                </div>
                              )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ------------------------------------------------ */}
            {/* System Information */}
            {/* ------------------------------------------------ */}

            <section
              className="rounded-xl bg-white p-6"
              style={inputStyle}
            >
              <h2 className="text-base font-semibold text-slate-950">
                System Information
              </h2>

              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem
                  label="Serial ID"
                  value={
                    <span className="break-all font-mono text-xs">
                      {unit.id}
                    </span>
                  }
                />

                <DetailItem
                  label="Created"
                  value={formatDateTime(
                    unit.created_at
                  )}
                />

                <DetailItem
                  label="Last Updated"
                  value={formatDateTime(
                    unit.updated_at
                  )}
                />

                <DetailItem
                  label="Company"
                  value={
                    <span className="break-all font-mono text-xs">
                      {unit.company_id}
                    </span>
                  }
                />
              </div>
            </section>
          </>
        ) : (
          <div
            className="rounded-xl bg-white p-12 text-center"
            style={inputStyle}
          >
            <h2 className="text-base font-semibold text-slate-950">
              Serial number not found
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              This serialized unit may have been removed
              or you may not have access to it.
            </p>

            <Link
              href="/serial-numbers"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Back to Serial Numbers
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}