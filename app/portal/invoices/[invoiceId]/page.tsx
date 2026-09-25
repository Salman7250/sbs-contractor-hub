"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Hash,
  Receipt,
  User,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  company_id: string;
  customer_id: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: string | null;
  order_id: string | null;
  vat_number: string | null;
  notes: string | null;
  currency: string | null;
};

type InvoiceItem = {
  id: string;
  description: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
};

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  vat_number: string | null;
};

type CustomerPortalUser = {
  id: string;
  company_id: string;
  customer_id: string;
  user_id: string | null;
  role: string;
  status: string;
};

type Company = {
  id: string;
  name: string | null;
};

type PortalSettings = {
  default_currency: string;
  allow_invoice_downloads: boolean;
};

const formatDate = (
  value: string | null | undefined,
) => {
  if (!value) {
    return "—";
  }

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

const formatMoney = (
  value: number,
  currency: string,
) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${currency || "USD"} ${Number(
      value || 0,
    ).toFixed(2)}`;
  }
};

const formatStatus = (
  value: string | null | undefined,
) => {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
};

const getStatusClass = (
  value: string | null | undefined,
) => {
  const status = String(value || "").toLowerCase();

  if (
    status === "paid" ||
    status === "completed"
  ) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (
    status === "partially_paid" ||
    status === "partial"
  ) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (
    status === "overdue" ||
    status === "void" ||
    status === "cancelled"
  ) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-slate-100 text-slate-600 border-slate-200";
};

export default function PortalInvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const invoiceId =
    typeof params.invoiceId === "string"
      ? params.invoiceId
      : "";

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [invoice, setInvoice] =
    useState<Invoice | null>(null);

  const [items, setItems] =
    useState<InvoiceItem[]>([]);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [settings, setSettings] =
    useState<PortalSettings | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!invoiceId) {
      return;
    }

    let cancelled = false;

    async function loadInvoice() {
      setLoading(true);
      setError("");

      try {
        /*
         * ---------------------------------------------------------
         * 1. Get authenticated user
         * ---------------------------------------------------------
         */

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        /*
         * ---------------------------------------------------------
         * 2. Resolve customer portal account
         *
         * IMPORTANT:
         * Actual table is customer_portal_users.
         * ---------------------------------------------------------
         */

        const {
          data: portalUser,
          error: portalUserError,
        } = await supabase
          .from("customer_portal_users")
          .select(
            `
              id,
              company_id,
              customer_id,
              user_id,
              role,
              status
            `,
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (portalUserError) {
          throw portalUserError;
        }

        if (!portalUser) {
          throw new Error(
            "Portal account could not be found.",
          );
        }

        if (portalUser.status !== "active") {
          throw new Error(
            "Your portal account is not active.",
          );
        }

        const typedPortalUser =
          portalUser as CustomerPortalUser;

        /*
         * ---------------------------------------------------------
         * 3. Load invoice + related read-only data
         * ---------------------------------------------------------
         */

        const [
          invoiceResult,
          customerResult,
          companyResult,
          settingsResult,
          itemsResult,
        ] = await Promise.all([
          /*
           * Invoice
           */
          supabase
            .from("invoices")
            .select(
              `
                id,
                company_id,
                customer_id,
                invoice_number,
                issue_date,
                due_date,
                subtotal,
                tax,
                total,
                amount_paid,
                balance_due,
                status,
                order_id,
                vat_number,
                notes,
                currency
              `,
            )
            .eq("id", invoiceId)
            .eq(
              "company_id",
              typedPortalUser.company_id,
            )
            .eq(
              "customer_id",
              typedPortalUser.customer_id,
            )
            .maybeSingle(),

          /*
           * Customer
           *
           * IMPORTANT:
           * customers does NOT have company_name.
           * Address fields are address_line1/address_line2.
           */
          supabase
            .from("customers")
            .select(
              `
                id,
                name,
                email,
                phone,
                address_line1,
                address_line2,
                city,
                state,
                postal_code,
                country,
                vat_number
              `,
            )
            .eq(
              "id",
              typedPortalUser.customer_id,
            )
            .eq(
              "company_id",
              typedPortalUser.company_id,
            )
            .maybeSingle(),

          /*
           * Company
           */
          supabase
            .from("companies")
            .select(
              `
                id,
                name
              `,
            )
            .eq(
              "id",
              typedPortalUser.company_id,
            )
            .maybeSingle(),

          /*
           * Portal settings
           */
          supabase
            .from("customer_portal_settings")
            .select(
              `
                default_currency,
                allow_invoice_downloads
              `,
            )
            .eq(
              "company_id",
              typedPortalUser.company_id,
            )
            .maybeSingle(),

          /*
           * Invoice items
           */
          supabase
            .from("invoice_items")
            .select(
              `
                id,
                description,
                sku,
                quantity,
                unit_price,
                discount_amount,
                tax_amount,
                line_total
              `,
            )
            .eq(
              "invoice_id",
              invoiceId,
            )
            .eq(
              "company_id",
              typedPortalUser.company_id,
            )
            .order("position", {
              ascending: true,
            })
            .order("created_at", {
              ascending: true,
            }),
        ]);

        /*
         * ---------------------------------------------------------
         * 4. Validate invoice
         * ---------------------------------------------------------
         */

        if (invoiceResult.error) {
          throw invoiceResult.error;
        }

        if (!invoiceResult.data) {
          throw new Error(
            "Invoice not found.",
          );
        }

        /*
         * Customer is allowed to be null.
         */
        if (customerResult.error) {
          throw customerResult.error;
        }

        /*
         * Company is allowed to be null.
         */
        if (companyResult.error) {
          throw companyResult.error;
        }

        /*
         * Settings are allowed to be null.
         */
        if (settingsResult.error) {
          throw settingsResult.error;
        }

        /*
         * Invoice items query must succeed.
         */
        if (itemsResult.error) {
          throw itemsResult.error;
        }

        if (cancelled) {
          return;
        }

        /*
         * ---------------------------------------------------------
         * 5. Store data
         * ---------------------------------------------------------
         */

        setInvoice(
          invoiceResult.data as Invoice,
        );

        setItems(
          (itemsResult.data ||
            []) as InvoiceItem[],
        );

        setCustomer(
          customerResult.data as
            | Customer
            | null,
        );

        setCompany(
          companyResult.data as
            | Company
            | null,
        );

        setSettings({
          default_currency:
            String(
              settingsResult.data
                ?.default_currency ||
                "USD",
            ),
          allow_invoice_downloads:
            Boolean(
              settingsResult.data
                ?.allow_invoice_downloads,
            ),
        });
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Portal invoice details error:",
          err,
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load invoice.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInvoice();

    return () => {
      cancelled = true;
    };
  }, [
    invoiceId,
    router,
    supabase,
  ]);

  /*
   * ---------------------------------------------------------
   * Currency
   *
   * Invoice currency takes priority.
   * Portal setting is the fallback.
   * ---------------------------------------------------------
   */

  const currency =
    invoice?.currency ||
    settings?.default_currency ||
    "USD";

  /*
   * ---------------------------------------------------------
   * Balance
   *
   * Prefer the database balance_due value.
   * Fallback to total - amount_paid.
   * ---------------------------------------------------------
   */

  const balance =
    invoice?.balance_due !== undefined &&
    invoice?.balance_due !== null
      ? Math.max(
          Number(invoice.balance_due),
          0,
        )
      : Math.max(
          Number(invoice?.total || 0) -
            Number(invoice?.amount_paid || 0),
          0,
        );

  const status = String(
    invoice?.status || "",
  ).toLowerCase();

  const statusIcon =
    status === "paid" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : (
      <Clock3 className="h-4 w-4" />
    );

  /*
   * ---------------------------------------------------------
   * Loading
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-32 rounded-lg bg-slate-200" />

            <div className="h-32 rounded-2xl bg-white shadow-sm" />

            <div className="h-72 rounded-2xl bg-white shadow-sm" />
          </div>
        </div>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * Error
   * ---------------------------------------------------------
   */

  if (error || !invoice) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/portal?tab=invoices",
              )
            }
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </button>

          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <FileText className="h-5 w-5" />
            </div>

            <h1 className="mt-4 text-lg font-semibold text-slate-900">
              Invoice unavailable
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {error ||
                "This invoice could not be found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/portal?tab=invoices",
              )
            }
            className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Invoices
          </button>

          {settings?.allow_invoice_downloads && (
            <button
              type="button"
              onClick={() =>
                window.print()
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Print / Save PDF
            </button>
          )}
        </div>

        {/* INVOICE HEADER */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-6 sm:p-8">

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">

              <div>
                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Receipt className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600">
                      {company?.name ||
                        "SBS"}
                    </p>

                    <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                      Invoice
                    </h1>
                  </div>

                </div>
              </div>

              <div className="text-left sm:text-right">

                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Invoice Number
                </div>

                <div className="mt-1 text-xl font-bold text-slate-900">
                  {invoice.invoice_number ||
                    invoice.id.slice(0, 8)}
                </div>

                <div
                  className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${getStatusClass(
                    invoice.status,
                  )}`}
                >
                  {statusIcon}

                  {formatStatus(
                    invoice.status,
                  )}
                </div>

              </div>

            </div>
          </div>

          {/* SUMMARY */}

          <div className="grid gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-3">

            <InfoCard
              icon={
                <CalendarDays className="h-4 w-4" />
              }
              label="Invoice Date"
              value={formatDate(
                invoice.issue_date,
              )}
            />

            <InfoCard
              icon={
                <Clock3 className="h-4 w-4" />
              }
              label="Due Date"
              value={formatDate(
                invoice.due_date,
              )}
            />

            <InfoCard
              icon={
                <Hash className="h-4 w-4" />
              }
              label="Reference"
              value={
                invoice.order_id
                  ? invoice.order_id.slice(
                      0,
                      8,
                    )
                  : "—"
              }
            />

          </div>

          {/* CUSTOMER */}

          <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">

            <div>

              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <User className="h-3.5 w-3.5" />
                Bill To
              </div>

              <div className="mt-3">

                <div className="text-sm font-bold text-slate-900">
                  {customer?.name ||
                    "Customer"}
                </div>

                {customer?.email && (
                  <div className="mt-2 text-xs text-slate-500">
                    {customer.email}
                  </div>
                )}

                {customer?.phone && (
                  <div className="mt-1 text-xs text-slate-500">
                    {customer.phone}
                  </div>
                )}

                {(customer?.address_line1 ||
                  customer?.address_line2 ||
                  customer?.city ||
                  customer?.state ||
                  customer?.postal_code ||
                  customer?.country) && (
                  <div className="mt-3 text-xs leading-5 text-slate-500">

                    {customer.address_line1 && (
                      <>
                        {customer.address_line1}
                        <br />
                      </>
                    )}

                    {customer.address_line2 && (
                      <>
                        {customer.address_line2}
                        <br />
                      </>
                    )}

                    {[
                      customer.city,
                      customer.state,
                      customer.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ")}

                    {[
                      customer.city,
                      customer.state,
                      customer.postal_code,
                    ].some(Boolean) &&
                      customer.country && (
                        <>
                          <br />
                        </>
                      )}

                    {customer.country}
                  </div>
                )}

                {(invoice.vat_number ||
                  customer?.vat_number) && (
                  <div className="mt-3 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">
                      VAT:
                    </span>{" "}
                    {invoice.vat_number ||
                      customer?.vat_number}
                  </div>
                )}

              </div>
            </div>

            <div className="sm:text-right">

              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Amount Due
              </div>

              <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                {formatMoney(
                  balance,
                  currency,
                )}
              </div>

              <div className="mt-1 text-xs text-slate-400">
                Outstanding balance
              </div>

            </div>

          </div>

        </section>

        {/* LINE ITEMS */}

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5 sm:px-8">

            <h2 className="text-base font-semibold text-slate-900">
              Invoice Items
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Items included on this invoice.
            </p>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[720px]">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">

                  <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Description
                  </th>

                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    SKU
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Qty
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Unit Price
                  </th>

                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Discount
                  </th>

                  <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Total
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {items.length > 0 ? (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50/70"
                    >

                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-slate-800">
                          {item.description ||
                            "Invoice item"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="font-mono text-xs text-slate-400">
                          {item.sku || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-600">
                        {item.quantity}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-600">
                        {formatMoney(
                          item.unit_price,
                          currency,
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-600">
                        {Number(
                          item.discount_amount || 0,
                        ) > 0
                          ? `-${formatMoney(
                              item.discount_amount,
                              currency,
                            )}`
                          : "—"}
                      </td>

                      <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                        {formatMoney(
                          item.line_total,
                          currency,
                        )}
                      </td>

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center"
                    >
                      <FileText className="mx-auto h-6 w-6 text-slate-300" />

                      <p className="mt-3 text-sm font-medium text-slate-700">
                        No invoice items
                      </p>
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* TOTALS */}

        <section className="mt-6 flex justify-end">

          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between py-2 text-sm text-slate-500">

              <span>Subtotal</span>

              <span className="font-semibold text-slate-700">
                {formatMoney(
                  invoice.subtotal,
                  currency,
                )}
              </span>

            </div>

            <div className="flex items-center justify-between py-2 text-sm text-slate-500">

              <span>Tax</span>

              <span className="font-semibold text-slate-700">
                {formatMoney(
                  invoice.tax,
                  currency,
                )}
              </span>

            </div>

            <div className="my-3 border-t border-slate-200" />

            <div className="flex items-center justify-between py-2">

              <span className="text-sm font-bold text-slate-900">
                Invoice Total
              </span>

              <span className="text-xl font-bold text-slate-900">
                {formatMoney(
                  invoice.total,
                  currency,
                )}
              </span>

            </div>

            <div className="mt-3 flex items-center justify-between text-sm">

              <span className="text-slate-500">
                Amount Paid
              </span>

              <span className="font-semibold text-emerald-600">
                {formatMoney(
                  invoice.amount_paid,
                  currency,
                )}
              </span>

            </div>

            <div className="mt-2 flex items-center justify-between text-sm">

              <span className="font-semibold text-slate-700">
                Balance Due
              </span>

              <span className="font-bold text-slate-900">
                {formatMoney(
                  balance,
                  currency,
                )}
              </span>

            </div>

          </div>

        </section>

        {/* NOTES */}

        {invoice.notes && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

            <h2 className="text-sm font-semibold text-slate-900">
              Notes
            </h2>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500">
              {invoice.notes}
            </p>

          </section>
        )}

        {/* READ ONLY NOTICE */}

        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
          This invoice is provided for viewing
          purposes. Invoice information is
          read-only in the customer portal.
        </div>

      </div>
    </main>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white px-6 py-5">

      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>

      <div className="mt-2 text-sm font-semibold text-slate-800">
        {value}
      </div>

    </div>
  );
}