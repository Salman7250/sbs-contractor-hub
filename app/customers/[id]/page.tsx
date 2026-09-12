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

type Customer = {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Customer360Data = {
  customer: Customer | null;

  totalSales: number;
  collected: number;
  receivable: number;
  profit: number;

  invoicesCount: number;
  quotesCount: number;
  ordersCount: number;
  serviceCount: number;
  warrantyCount: number;
  repairsCount: number;
  rmaCount: number;
  documentsCount: number;

  invoices: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  quotes: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  orderItems: Record<string, unknown>[];
  jobs: Record<string, unknown>[];
  warranties: Record<string, unknown>[];
  repairs: Record<string, unknown>[];
  rmas: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  ledger: Record<string, unknown>[];
};

type TabKey =
  | "overview"
  | "ledger"
  | "sales"
  | "orders"
  | "invoices"
  | "payments"
  | "quotes"
  | "profitability"
  | "service"
  | "warranty"
  | "repairs"
  | "documents"
  | "activity";

const tabs: {
  key: TabKey;
  label: string;
}[] = [
  {
    key: "overview",
    label: "Overview",
  },
  {
    key: "ledger",
    label: "Ledger",
  },
  {
    key: "sales",
    label: "Sales",
  },
  {
    key: "orders",
    label: "Orders",
  },
  {
    key: "invoices",
    label: "Invoices",
  },
  {
    key: "payments",
    label: "Payments",
  },
  {
    key: "quotes",
    label: "Quotes",
  },
  {
    key: "profitability",
    label: "Profitability",
  },
  {
    key: "service",
    label: "Service",
  },
  {
    key: "warranty",
    label: "Warranty",
  },
  {
    key: "repairs",
    label: "Repairs & RMA",
  },
  {
    key: "documents",
    label: "Documents",
  },
  {
    key: "activity",
    label: "Activity",
  },
];

const emptyData: Customer360Data = {
  customer: null,

  totalSales: 0,
  collected: 0,
  receivable: 0,
  profit: 0,

  invoicesCount: 0,
  quotesCount: 0,
  ordersCount: 0,
  serviceCount: 0,
  warrantyCount: 0,
  repairsCount: 0,
  rmaCount: 0,
  documentsCount: 0,

  invoices: [],
  payments: [],
  quotes: [],
  orders: [],
  orderItems: [],
  jobs: [],
  warranties: [],
  repairs: [],
  rmas: [],
  documents: [],
  ledger: [],
};

const money = (
  value: number | null | undefined
) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dateOnly = (
  value: string | null | undefined
) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const initials = (name: string) => {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
};

const asRecords = (
  value: unknown
): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" &&
      item !== null
  );
};

const numberValue = (
  row: Record<string, unknown>,
  keys: string[]
) => {
  for (const key of keys) {
    const value = row[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      const parsed = Number(value);

      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
};

const stringValue = (
  row: Record<string, unknown>,
  keys: string[]
) => {
  for (const key of keys) {
    const value = row[key];

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      return String(value);
    }
  }

  return null;
};

export default function Customer360Page() {
  const params = useParams();
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const customerId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : "";

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [data, setData] =
    useState<Customer360Data>(emptyData);

  const [activeTab, setActiveTab] =
    useState<TabKey>("overview");

  const loadCustomer360 =
    useCallback(
      async (
        showRefresh = false
      ) => {
        if (!customerId) {
          setErrorMessage(
            "Customer ID is missing."
          );
          setLoading(false);
          return;
        }

        try {
          setErrorMessage("");

          if (showRefresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          /*
           * ----------------------------------------------------
           * CUSTOMER
           * ----------------------------------------------------
           */

          const {
            data: customerData,
            error: customerError,
          } = await supabase
            .from("customers")
            .select(
              `
                id,
                company_id,
                name,
                email,
                phone,
                address_line1,
                address_line2,
                city,
                state,
                postal_code,
                notes,
                created_at,
                updated_at
              `
            )
            .eq(
              "id",
              customerId
            )
            .maybeSingle();

          if (customerError) {
            throw customerError;
          }

          if (!customerData) {
            setErrorMessage(
              "Customer not found."
            );
            return;
          }

          /*
           * ----------------------------------------------------
           * CORE CUSTOMER DATA
           * ----------------------------------------------------
           */

          const [
            invoicesResult,
            paymentsResult,
            quotesResult,
            ordersResult,
            jobsResult,
            warrantiesResult,
            repairsResult,
            rmasResult,
            ledgerResult,
          ] = await Promise.all([
            supabase
              .from("invoices")
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),

            supabase
              .from("invoice_payments")
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),

            supabase
              .from("estimates")
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),

            supabase
              .from("orders")
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),

            supabase
              .from("jobs")
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),

            supabase
              .from("warranties")
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),

            supabase
              .from("repairs")
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),

            supabase
              .from("rmas")
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),

            supabase
              .from(
                "customer_ledger_entries"
              )
              .select("*")
              .eq(
                "customer_id",
                customerId
              )
              .order(
                "transaction_at",
                {
                  ascending: true,
                }
              ),
          ]);

          const coreErrors = [
            invoicesResult.error,
            paymentsResult.error,
            quotesResult.error,
            ordersResult.error,
            jobsResult.error,
            warrantiesResult.error,
            repairsResult.error,
            rmasResult.error,
            ledgerResult.error,
          ].filter(Boolean);

          if (coreErrors.length) {
            throw coreErrors[0];
          }

          const invoices =
            asRecords(
              invoicesResult.data
            );

          const payments =
            asRecords(
              paymentsResult.data
            );

          const quotes =
            asRecords(
              quotesResult.data
            );

          const orders =
            asRecords(
              ordersResult.data
            );

          const jobs =
            asRecords(
              jobsResult.data
            );

          const warranties =
            asRecords(
              warrantiesResult.data
            );

          const repairs =
            asRecords(
              repairsResult.data
            );

          const rmas =
            asRecords(
              rmasResult.data
            );

          const ledger =
            asRecords(
              ledgerResult.data
            );

          /*
           * ----------------------------------------------------
           * ORDER ITEMS
           *
           * order_items does NOT have customer_id.
           * Customer belongs to orders.customer_id.
           * ----------------------------------------------------
           */

          const orderIds = orders
            .map((order) =>
              stringValue(order, ["id"])
            )
            .filter(
              (
                id
              ): id is string =>
                Boolean(id)
            );

          let orderItems:
            Record<string, unknown>[] =
            [];

          if (orderIds.length) {
            const {
              data: orderItemsData,
              error:
                orderItemsError,
            } = await supabase
              .from("order_items")
              .select("*")
              .in(
                "order_id",
                orderIds
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              );

            if (orderItemsError) {
              console.warn(
                "Failed to load order items:",
                orderItemsError
              );
            } else {
              orderItems =
                asRecords(
                  orderItemsData
                );
            }
          }

          /*
           * ----------------------------------------------------
           * DOCUMENT SHARES
           *
           * document_shares uses
           * shared_with_customer_id.
           * ----------------------------------------------------
           */

          let documents:
            Record<string, unknown>[] =
            [];

          const {
            data: documentShareData,
            error:
              documentShareError,
          } = await supabase
            .from("document_shares")
            .select("*")
            .eq(
              "shared_with_customer_id",
              customerId
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            );

          if (documentShareError) {
            console.warn(
              "Failed to load customer document shares:",
              documentShareError
            );
          } else {
            const shares =
              asRecords(
                documentShareData
              );

            const documentIds =
              shares
                .map((share) =>
                  stringValue(
                    share,
                    ["document_id"]
                  )
                )
                .filter(
                  (
                    id
                  ): id is string =>
                    Boolean(id)
                );

            if (
              documentIds.length
            ) {
              const {
                data: documentsData,
                error:
                  documentsError,
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
                .in(
                  "id",
                  documentIds
                )
                .order(
                  "created_at",
                  {
                    ascending: false,
                  }
                );

              if (documentsError) {
                console.warn(
                  "Failed to load documents:",
                  documentsError
                );
              } else {
                documents =
                  asRecords(
                    documentsData
                  );
              }
            }
          }

          /*
           * ----------------------------------------------------
           * FINANCIAL CALCULATIONS
           * ----------------------------------------------------
           */

          const totalSales =
            invoices.reduce(
              (
                sum,
                invoice
              ) =>
                sum +
                numberValue(
                  invoice,
                  [
                    "total",
                    "grand_total",
                    "total_amount",
                    "amount",
                  ]
                ),
              0
            );

          const collected =
            payments.reduce(
              (
                sum,
                payment
              ) =>
                sum +
                numberValue(
                  payment,
                  [
                    "amount",
                    "paid_amount",
                  ]
                ),
              0
            );

          const receivable =
            Math.max(
              totalSales -
                collected,
              0
            );

          /*
           * Profit from actual order item fields:
           *
           * line_total
           * quantity
           * unit_cost
           */

          const profit =
            orderItems.reduce(
              (
                sum,
                item
              ) => {
                const revenue =
                  numberValue(
                    item,
                    [
                      "line_total",
                    ]
                  );

                const quantity =
                  numberValue(
                    item,
                    [
                      "quantity",
                    ]
                  );

                const unitCost =
                  numberValue(
                    item,
                    [
                      "unit_cost",
                    ]
                  );

                const cost =
                  unitCost *
                  quantity;

                return (
                  sum +
                  (revenue -
                    cost)
                );
              },
              0
            );

          setData({
            customer:
              customerData as Customer,

            totalSales,
            collected,
            receivable,
            profit,

            invoicesCount:
              invoices.length,

            quotesCount:
              quotes.length,

            ordersCount:
              orders.length,

            serviceCount:
              jobs.length,

            warrantyCount:
              warranties.length,

            repairsCount:
              repairs.length,

            rmaCount:
              rmas.length,

            documentsCount:
              documents.length,

            invoices,
            payments,
            quotes,
            orders,
            orderItems,
            jobs,
            warranties,
            repairs,
            rmas,
            documents,
            ledger,
          });
        } catch (error) {
          console.error(
            "Failed to load customer 360:",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load customer."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        customerId,
        supabase,
      ]
    );

  useEffect(() => {
    const timer =
      window.setTimeout(() => {
        void loadCustomer360();
      }, 0);

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [loadCustomer360]);

  const customer =
    data.customer;

  const averageOrderValue =
    data.ordersCount > 0
      ? data.totalSales /
        data.ordersCount
      : 0;

  const grossMargin =
    data.totalSales > 0
      ? (data.profit /
          data.totalSales) *
        100
      : 0;

  const address = [
    customer?.address_line1,
    customer?.address_line2,
    customer?.city,
    customer?.state,
    customer?.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  const tabCount = (
    tab: TabKey
  ) => {
    switch (tab) {
      case "invoices":
        return data.invoicesCount;

      case "payments":
        return data.payments.length;

      case "quotes":
        return data.quotesCount;

      case "orders":
        return data.ordersCount;

      case "service":
        return data.serviceCount;

      case "warranty":
        return data.warrantyCount;

      case "repairs":
        return (
          data.repairsCount +
          data.rmaCount
        );

      case "documents":
        return data.documentsCount;

      default:
        return null;
    }
  };

  const renderEmpty = (
    title: string,
    description: string
  ) => (
    <div className="empty-state">
      <div className="empty-icon">
        ○
      </div>

      <div className="empty-title">
        {title}
      </div>

      <div className="empty-description">
        {description}
      </div>
    </div>
  );

  const renderOverview =
    () => (
      <div className="overview-stack">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Sales
            </div>

            <div className="stat-value">
              {money(
                data.totalSales
              )}
            </div>

            <div className="stat-sub">
              Lifetime invoiced
              value
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Collected
            </div>

            <div className="stat-value">
              {money(
                data.collected
              )}
            </div>

            <div className="stat-sub">
              Payments received
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Receivable
            </div>

            <div className="stat-value receivable">
              {money(
                data.receivable
              )}
            </div>

            <div className="stat-sub">
              Outstanding
              balance
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Profit
            </div>

            <div className="stat-value profit">
              {money(
                data.profit
              )}
            </div>

            <div className="stat-sub">
              Estimated gross
              profit
            </div>
          </div>
        </div>

        <div className="mini-grid">
          <MiniMetric
            label="Invoices"
            value={
              data.invoicesCount
            }
          />

          <MiniMetric
            label="Quotes"
            value={
              data.quotesCount
            }
          />

          <MiniMetric
            label="Orders"
            value={
              data.ordersCount
            }
          />

          <MiniMetric
            label="Service"
            value={
              data.serviceCount
            }
          />

          <MiniMetric
            label="Warranty"
            value={
              data.warrantyCount
            }
          />

          <MiniMetric
            label="Repairs"
            value={
              data.repairsCount
            }
          />

          <MiniMetric
            label="RMA"
            value={
              data.rmaCount
            }
          />

          <MiniMetric
            label="Documents"
            value={
              data.documentsCount
            }
          />
        </div>

        <div className="two-column">
          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>
                  Customer
                  Information
                </h2>

                <p>
                  Contact and
                  account details
                </p>
              </div>
            </div>

            <div className="info-grid">
              <InfoItem
                label="Customer"
                value={
                  customer?.name
                }
              />

              <InfoItem
                label="Email"
                value={
                  customer?.email
                }
              />

              <InfoItem
                label="Phone"
                value={
                  customer?.phone
                }
              />

              <InfoItem
                label="Customer Since"
                value={dateOnly(
                  customer?.created_at
                )}
              />

              <InfoItem
                label="Address"
                value={
                  address ||
                  "—"
                }
              />

              <InfoItem
                label="Status"
                value="Active"
                badge
              />
            </div>

            {customer?.notes ? (
              <div className="notes-box">
                <div className="notes-label">
                  Notes
                </div>

                <div className="notes-text">
                  {
                    customer.notes
                  }
                </div>
              </div>
            ) : null}
          </section>

          <section className="content-card">
            <div className="card-header">
              <div>
                <h2>
                  Account Snapshot
                </h2>

                <p>
                  Commercial
                  performance
                </p>
              </div>
            </div>

            <div className="snapshot-list">
              <SnapshotRow
                label="Average Order Value"
                value={money(
                  averageOrderValue
                )}
              />

              <SnapshotRow
                label="Gross Profit"
                value={money(
                  data.profit
                )}
              />

              <SnapshotRow
                label="Gross Margin"
                value={`${grossMargin.toFixed(
                  1
                )}%`}
              />

              <SnapshotRow
                label="Open Receivable"
                value={money(
                  data.receivable
                )}
                danger={
                  data.receivable >
                  0
                }
              />

              <SnapshotRow
                label="Invoices"
                value={String(
                  data.invoicesCount
                )}
              />

              <SnapshotRow
                label="Orders"
                value={String(
                  data.ordersCount
                )}
              />
            </div>
          </section>
        </div>

        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>
                Recent Activity
              </h2>

              <p>
                Latest customer
                transactions
              </p>
            </div>
          </div>

          {data.invoices.length ===
            0 &&
          data.orders.length ===
            0 &&
          data.payments.length ===
            0 ? (
            renderEmpty(
              "No activity yet",
              "Customer activity will appear here as transactions are created."
            )
          ) : (
            <div className="activity-list">
              {[
                ...data.invoices
                  .slice(
                    0,
                    5
                  )
                  .map(
                    (
                      item
                    ) => ({
                      type:
                        "Invoice",
                      title:
                        stringValue(
                          item,
                          [
                            "invoice_number",
                            "number",
                          ]
                        ) ||
                        "Invoice",
                      date:
                        stringValue(
                          item,
                          [
                            "created_at",
                          ]
                        ),
                      amount:
                        numberValue(
                          item,
                          [
                            "total",
                            "grand_total",
                            "total_amount",
                          ]
                        ),
                    })
                  ),

                ...data.payments
                  .slice(
                    0,
                    5
                  )
                  .map(
                    (
                      item
                    ) => ({
                      type:
                        "Payment",
                      title:
                        stringValue(
                          item,
                          [
                            "reference",
                            "payment_method",
                            "payment_number",
                          ]
                        ) ||
                        "Payment",
                      date:
                        stringValue(
                          item,
                          [
                            "created_at",
                          ]
                        ),
                      amount:
                        numberValue(
                          item,
                          [
                            "amount",
                            "paid_amount",
                          ]
                        ),
                    })
                  ),
              ]
                .filter(
                  (
                    item
                  ) =>
                    Boolean(
                      item.date
                    )
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    new Date(
                      b.date ||
                        0
                    ).getTime() -
                    new Date(
                      a.date ||
                        0
                    ).getTime()
                )
                .slice(
                  0,
                  8
                )
                .map(
                  (
                    activity,
                    index
                  ) => (
                    <div
                      className="activity-row"
                      key={`${activity.type}-${index}`}
                    >
                      <div className="activity-dot" />

                      <div className="activity-main">
                        <div className="activity-title">
                          {
                            activity.title
                          }
                        </div>

                        <div className="activity-meta">
                          {
                            activity.type
                          }{" "}
                          ·{" "}
                          {dateOnly(
                            activity.date
                          )}
                        </div>
                      </div>

                      <div className="activity-amount">
                        {money(
                          activity.amount
                        )}
                      </div>
                    </div>
                  )
                )}
            </div>
          )}
        </section>
      </div>
    );

  const renderLedger =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Customer Ledger
            </h2>

            <p>
              Complete debit and
              credit history
            </p>
          </div>
        </div>

        {data.ledger.length ===
        0 ? (
          renderEmpty(
            "No ledger entries",
            "Customer financial activity will appear here."
          )
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Date
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Reference
                  </th>

                  <th>
                    Debit
                  </th>

                  <th>
                    Credit
                  </th>

                  <th>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.ledger.map(
                  (
                    entry,
                    index
                  ) => (
                    <tr
                      key={
                        stringValue(
                          entry,
                          [
                            "id",
                          ]
                        ) ||
                        `ledger-${index}`
                      }
                    >
                      <td>
                        {dateOnly(
                          stringValue(
                            entry,
                            [
                              "transaction_at",
                            ]
                          )
                        )}
                      </td>

                      <td>
                        {stringValue(
                          entry,
                          [
                            "transaction_type",
                          ]
                        ) || "—"}
                      </td>

                      <td>
                        {stringValue(
                          entry,
                          [
                            "description",
                            "memo",
                          ]
                        ) ||
                          "Ledger entry"}
                      </td>

                      <td>
                        {stringValue(
                          entry,
                          [
                            "reference",
                          ]
                        ) || "—"}
                      </td>

                      <td>
                        {money(
                          numberValue(
                            entry,
                            [
                              "debit",
                            ]
                          )
                        )}
                      </td>

                      <td>
                        {money(
                          numberValue(
                            entry,
                            [
                              "credit",
                            ]
                          )
                        )}
                      </td>

                      <td>
                        {stringValue(
                          entry,
                          [
                            "status",
                          ]
                        ) || "—"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );

  const renderSales =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Sales
            </h2>

            <p>
              Revenue, cost and
              profit performance
            </p>
          </div>
        </div>

        {data.orderItems.length ===
        0 ? (
          renderEmpty(
            "No sales data",
            "Line-item sales will appear here."
          )
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Product
                  </th>

                  <th>
                    SKU
                  </th>

                  <th>
                    Quantity
                  </th>

                  <th>
                    Unit Price
                  </th>

                  <th>
                    Revenue
                  </th>

                  <th>
                    Cost
                  </th>

                  <th>
                    Profit
                  </th>

                  <th>
                    Margin
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.orderItems.map(
                  (
                    item,
                    index
                  ) => {
                    const productName =
                      stringValue(
                        item,
                        [
                          "product_name",
                        ]
                      ) ||
                      "Product";

                    const sku =
                      stringValue(
                        item,
                        [
                          "sku",
                        ]
                      ) ||
                      "—";

                    const quantity =
                      numberValue(
                        item,
                        [
                          "quantity",
                        ]
                      );

                    const unitPrice =
                      numberValue(
                        item,
                        [
                          "unit_price",
                        ]
                      );

                    const revenue =
                      numberValue(
                        item,
                        [
                          "line_total",
                        ]
                      );

                    const unitCost =
                      numberValue(
                        item,
                        [
                          "unit_cost",
                        ]
                      );

                    const cost =
                      unitCost *
                      quantity;

                    const profit =
                      revenue -
                      cost;

                    const margin =
                      revenue >
                      0
                        ? (profit /
                            revenue) *
                          100
                        : 0;

                    return (
                      <tr
                        key={
                          stringValue(
                            item,
                            [
                              "id",
                            ]
                          ) ||
                          `sale-${index}`
                        }
                      >
                        <td>
                          {
                            productName
                          }
                        </td>

                        <td>
                          {sku}
                        </td>

                        <td>
                          {quantity}
                        </td>

                        <td>
                          {money(
                            unitPrice
                          )}
                        </td>

                        <td>
                          {money(
                            revenue
                          )}
                        </td>

                        <td>
                          {money(
                            cost
                          )}
                        </td>

                        <td className="profit-text">
                          {money(
                            profit
                          )}
                        </td>

                        <td>
                          {margin.toFixed(
                            1
                          )}
                          %
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );

  const renderOrders =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Orders
            </h2>

            <p>
              Customer sales orders
            </p>
          </div>
        </div>

        {data.orders.length ===
        0 ? (
          renderEmpty(
            "No orders",
            "Sales orders for this customer will appear here."
          )
        ) : (
          <DataTable
            rows={data.orders}
            columns={[
              [
                "Order",
                "order_number",
              ],
              [
                "Status",
                "status",
              ],
              [
                "Payment",
                "payment_status",
              ],
              [
                "Fulfillment",
                "fulfillment_status",
              ],
              [
                "Total",
                "total_amount",
              ],
              [
                "Date",
                "created_at",
              ],
            ]}
            moneyColumns={[
              "total_amount",
            ]}
          />
        )}
      </section>
    );

  const renderInvoices =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Invoices
            </h2>

            <p>
              Customer invoices and
              balances
            </p>
          </div>
        </div>

        {data.invoices.length ===
        0 ? (
          renderEmpty(
            "No invoices",
            "Invoices for this customer will appear here."
          )
        ) : (
          <DataTable
            rows={
              data.invoices
            }
            columns={[
              [
                "Invoice",
                "invoice_number",
                "number",
              ],
              [
                "Status",
                "status",
              ],
              [
                "Total",
                "total",
                "grand_total",
                "total_amount",
              ],
              [
                "Date",
                "created_at",
              ],
            ]}
            moneyColumns={[
              "total",
              "grand_total",
              "total_amount",
            ]}
          />
        )}
      </section>
    );

  const renderPayments =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Payments
            </h2>

            <p>
              Payments received from
              this customer
            </p>
          </div>
        </div>

        {data.payments.length ===
        0 ? (
          renderEmpty(
            "No payments",
            "Customer payments will appear here."
          )
        ) : (
          <DataTable
            rows={
              data.payments
            }
            columns={[
              [
                "Reference",
                "reference",
                "payment_number",
              ],
              [
                "Method",
                "payment_method",
              ],
              [
                "Amount",
                "amount",
                "paid_amount",
              ],
              [
                "Date",
                "created_at",
              ],
            ]}
            moneyColumns={[
              "amount",
              "paid_amount",
            ]}
          />
        )}
      </section>
    );

  const renderQuotes =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Quotes
            </h2>

            <p>
              Customer estimates and
              quotations
            </p>
          </div>
        </div>

        {data.quotes.length ===
        0 ? (
          renderEmpty(
            "No quotes",
            "Quotes for this customer will appear here."
          )
        ) : (
          <DataTable
            rows={data.quotes}
            columns={[
              [
                "Quote",
                "estimate_number",
                "quote_number",
                "number",
              ],
              [
                "Status",
                "status",
              ],
              [
                "Total",
                "total",
                "grand_total",
                "total_amount",
              ],
              [
                "Date",
                "created_at",
              ],
            ]}
            moneyColumns={[
              "total",
              "grand_total",
              "total_amount",
            ]}
          />
        )}
      </section>
    );

  const renderProfitability =
    () => (
      <div className="overview-stack">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Revenue
            </div>

            <div className="stat-value">
              {money(
                data.totalSales
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Estimated Profit
            </div>

            <div className="stat-value profit">
              {money(
                data.profit
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Gross Margin
            </div>

            <div className="stat-value">
              {grossMargin.toFixed(
                1
              )}
              %
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Average Order Value
            </div>

            <div className="stat-value">
              {money(
                averageOrderValue
              )}
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>
                Profitability Analysis
              </h2>

              <p>
                Customer-level
                commercial performance
              </p>
            </div>
          </div>

          <div className="profit-bars">
            <ProfitBar
              label="Revenue"
              value={
                data.totalSales
              }
              max={Math.max(
                data.totalSales,
                1
              )}
            />

            <ProfitBar
              label="Gross Profit"
              value={
                data.profit
              }
              max={Math.max(
                data.totalSales,
                1
              )}
            />

            <ProfitBar
              label="Receivable"
              value={
                data.receivable
              }
              max={Math.max(
                data.totalSales,
                1
              )}
            />
          </div>
        </section>
      </div>
    );

  const renderService =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Service
            </h2>

            <p>
              Customer jobs and service
              history
            </p>
          </div>
        </div>

        {data.jobs.length ===
        0 ? (
          renderEmpty(
            "No service jobs",
            "Service jobs for this customer will appear here."
          )
        ) : (
          <DataTable
            rows={data.jobs}
            columns={[
              [
                "Job",
                "job_number",
                "number",
              ],
              [
                "Status",
                "status",
              ],
              [
                "Type",
                "job_type",
                "type",
              ],
              [
                "Date",
                "created_at",
              ],
            ]}
          />
        )}
      </section>
    );

  const renderWarranty =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Warranty
            </h2>

            <p>
              Customer warranty coverage
            </p>
          </div>
        </div>

        {data.warranties.length ===
        0 ? (
          renderEmpty(
            "No warranty records",
            "Warranty records will appear here."
          )
        ) : (
          <DataTable
            rows={
              data.warranties
            }
            columns={[
              [
                "Warranty",
                "warranty_number",
                "number",
              ],
              [
                "Status",
                "status",
              ],
              [
                "Start",
                "start_date",
              ],
              [
                "End",
                "end_date",
              ],
            ]}
          />
        )}
      </section>
    );

  const renderRepairs =
    () => (
      <div className="two-column">
        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>
                Repairs
              </h2>

              <p>
                Customer repair history
              </p>
            </div>
          </div>

          {data.repairs.length ===
          0 ? (
            renderEmpty(
              "No repairs",
              "Repair records will appear here."
            )
          ) : (
            <DataTable
              rows={
                data.repairs
              }
              columns={[
                [
                  "Repair",
                  "repair_number",
                  "number",
                ],
                [
                  "Status",
                  "status",
                ],
                [
                  "Created",
                  "created_at",
                ],
              ]}
            />
          )}
        </section>

        <section className="content-card">
          <div className="card-header">
            <div>
              <h2>
                RMA
              </h2>

              <p>
                Customer return / RMA
                history
              </p>
            </div>
          </div>

          {data.rmas.length ===
          0 ? (
            renderEmpty(
              "No RMA records",
              "Return merchandise authorizations will appear here."
            )
          ) : (
            <DataTable
              rows={data.rmas}
              columns={[
                [
                  "RMA",
                  "rma_number",
                  "number",
                ],
                [
                  "Status",
                  "status",
                ],
                [
                  "Created",
                  "created_at",
                ],
              ]}
            />
          )}
        </section>
      </div>
    );

  const renderDocuments =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Documents
            </h2>

            <p>
              Customer-related documents
            </p>
          </div>
        </div>

        {data.documents.length ===
        0 ? (
          renderEmpty(
            "No documents",
            "Shared customer documents will appear here."
          )
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    Document
                  </th>

                  <th>
                    Type
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    File
                  </th>

                  <th>
                    Created
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.documents.map(
                  (
                    document,
                    index
                  ) => (
                    <tr
                      key={
                        stringValue(
                          document,
                          ["id"]
                        ) ||
                        `document-${index}`
                      }
                    >
                      <td className="table-strong">
                        {stringValue(
                          document,
                          [
                            "title",
                            "document_number",
                            "file_name",
                          ]
                        ) ||
                          "Document"}
                      </td>

                      <td>
                        {stringValue(
                          document,
                          [
                            "document_type",
                          ]
                        ) ||
                          "—"}
                      </td>

                      <td>
                        {stringValue(
                          document,
                          [
                            "status",
                          ]
                        ) ||
                          "—"}
                      </td>

                      <td>
                        {stringValue(
                          document,
                          [
                            "file_name",
                          ]
                        ) ||
                          "—"}
                      </td>

                      <td>
                        {dateOnly(
                          stringValue(
                            document,
                            [
                              "created_at",
                            ]
                          )
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );

  const renderActivity =
    () => (
      <section className="content-card">
        <div className="card-header">
          <div>
            <h2>
              Activity
            </h2>

            <p>
              Customer account timeline
            </p>
          </div>
        </div>

        {renderEmpty(
          "Activity timeline",
          "Customer actions, calls, messages, status changes and internal activity can be surfaced here."
        )}
      </section>
    );

  const renderActiveTab =
    () => {
      switch (
        activeTab
      ) {
        case "overview":
          return renderOverview();

        case "ledger":
          return renderLedger();

        case "sales":
          return renderSales();

        case "orders":
          return renderOrders();

        case "invoices":
          return renderInvoices();

        case "payments":
          return renderPayments();

        case "quotes":
          return renderQuotes();

        case "profitability":
          return renderProfitability();

        case "service":
          return renderService();

        case "warranty":
          return renderWarranty();

        case "repairs":
          return renderRepairs();

        case "documents":
          return renderDocuments();

        case "activity":
          return renderActivity();

        default:
          return renderOverview();
      }
    };

  /*
   * ----------------------------------------------------------
   * PAGE
   * ----------------------------------------------------------
   */

  return (
    <AppShell>
      <div className="customer-page">
        <div className="page-content">
          {loading ? (
            <div className="state-card">
              <div className="spinner" />

              <div className="state-title">
                Loading customer...
              </div>

              <div className="state-text">
                Preparing customer
                workspace.
              </div>
            </div>
          ) : errorMessage ? (
            <div className="state-card">
              <div className="error-symbol">
                !
              </div>

              <div className="state-title">
                Unable to load customer
              </div>

              <div className="state-text">
                {errorMessage}
              </div>

              <div className="state-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    router.push(
                      "/customers"
                    )
                  }
                >
                  Back to Customers
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    void loadCustomer360()
                  }
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : !customer ? (
            <div className="state-card">
              <div className="state-title">
                Customer not found
              </div>

              <div className="state-text">
                This customer may have
                been deleted or you
                may no longer have
                access.
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  router.push(
                    "/customers"
                  )
                }
              >
                Back to Customers
              </button>
            </div>
          ) : (
            <>
              <div className="page-header">
                <div className="page-header-left">
                  <button
                    type="button"
                    className="back-button"
                    onClick={() =>
                      router.push(
                        "/customers"
                      )
                    }
                    aria-label="Back to customers"
                  >
                    ←
                  </button>

                  <div className="customer-avatar">
                    {initials(
                      customer.name
                    )}
                  </div>

                  <div className="customer-heading">
                    <div className="breadcrumb">
                      Customers /{" "}
                      <span>
                        {
                          customer.name
                        }
                      </span>
                    </div>

                    <h1>
                      {
                        customer.name
                      }
                    </h1>

                    <div className="customer-meta">
                      {customer.email ||
                        "No email"}

                      {customer.phone
                        ? ` · ${customer.phone}`
                        : ""}

                      {" · "}

                      Customer since{" "}
                      {dateOnly(
                        customer.created_at
                      )}
                    </div>
                  </div>
                </div>

                <div className="page-header-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      void loadCustomer360(
                        true
                      )
                    }
                    disabled={
                      refreshing
                    }
                  >
                    {refreshing
                      ? "Refreshing..."
                      : "Refresh"}
                  </button>
                </div>
              </div>

              <div className="tabs-shell">
                <div className="tabs-scroll">
                  {tabs.map(
                    (tab) => {
                      const count =
                        tabCount(
                          tab.key
                        );

                      return (
                        <button
                          key={
                            tab.key
                          }
                          type="button"
                          className={`customer-tab ${
                            activeTab ===
                            tab.key
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            setActiveTab(
                              tab.key
                            )
                          }
                        >
                          <span>
                            {
                              tab.label
                            }
                          </span>

                          {count !==
                          null ? (
                            <span className="tab-count">
                              {
                                count
                              }
                            </span>
                          ) : null}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="tab-content">
                {renderActiveTab()}
              </div>
            </>
          )}
        </div>
      </div>

<style jsx global>{`
        .customer-page {
          width: 100%;
          min-height: 100%;
          background: #f5f7fb;
        }

        .page-content {
          width: 100%;
          max-width: 1700px;
          margin: 0 auto;
          padding: 28px;
          box-sizing: border-box;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          margin-bottom: 22px;
        }

        .page-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .customer-heading {
          min-width: 0;
        }

        .back-button {
          width: 42px;
          height: 42px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #ffffff;
          color: #374151;
          font-size: 20px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .back-button:hover {
          background: #f9fafb;
        }

        .customer-avatar {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: #ecfdf3;
          color: #15803d;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 17px;
          font-weight: 700;
          flex-shrink: 0;
          border: 1px solid #bbf7d0;
        }

        .breadcrumb {
          color: #9ca3af;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .breadcrumb span {
          color: #6b7280;
        }

        h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.02em;
        }

        .customer-meta {
          margin-top: 6px;
          font-size: 13px;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .page-header-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        .secondary-button,
        .primary-button {
          height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.15s ease;
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

        .primary-button {
          border: 1px solid #15803d;
          background: #15803d;
          color: #ffffff;
        }

        .primary-button:hover {
          background: #166534;
        }

        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .tabs-shell {
          border: 1px solid #e5e7eb;
          border-radius: 14px 14px 0 0;
          background: #ffffff;
          overflow: hidden;
        }

        .tabs-scroll {
          display: flex;
          align-items: center;
          overflow-x: auto;
          scrollbar-width: thin;
        }

        .customer-tab {
          position: relative;
          flex-shrink: 0;
          border: 0;
          border-bottom: 2px solid transparent;
          background: transparent;
          color: #6b7280;
          padding: 15px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        }

        .customer-tab:hover {
          color: #111827;
          background: #fafafa;
        }

        .customer-tab.active {
          color: #111827;
          border-bottom-color: #15803d;
          background: #ffffff;
        }

        .tab-count {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .customer-tab.active .tab-count {
          background: #ecfdf3;
          color: #15803d;
        }

        .tab-content {
          padding-top: 20px;
        }

        .overview-stack {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 16px;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 19px;
          box-shadow: 0 2px 7px
            rgba(15, 23, 42, 0.03);
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 25px;
          line-height: 1.1;
          font-weight: 700;
          color: #111827;
        }

        .stat-value.receivable {
          color: #b45309;
        }

        .stat-value.profit,
        .profit-text {
          color: #15803d;
        }

        .stat-sub {
          margin-top: 7px;
          font-size: 12px;
          color: #9ca3af;
        }

        .mini-grid {
          display: grid;
          grid-template-columns: repeat(
            8,
            minmax(0, 1fr)
          );
          gap: 12px;
        }

        .mini-metric {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 14px;
          min-width: 0;
        }

        .mini-label {
          font-size: 11px;
          font-weight: 600;
          color: #9ca3af;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mini-value {
          margin-top: 5px;
          font-size: 19px;
          font-weight: 700;
          color: #111827;
        }

        .two-column {
          display: grid;
          grid-template-columns:
            minmax(0, 1.25fr)
            minmax(0, 0.75fr);
          gap: 20px;
        }

        .content-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 7px
            rgba(15, 23, 42, 0.03);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 20px;
          border-bottom: 1px solid #f0f1f3;
        }

        .card-header h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }

        .card-header p {
          margin: 5px 0 0;
          font-size: 12px;
          color: #9ca3af;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
        }

        .info-item {
          padding: 17px 20px;
          border-bottom: 1px solid #f3f4f6;
        }

        .info-label {
          font-size: 11px;
          font-weight: 600;
          color: #9ca3af;
          margin-bottom: 5px;
        }

        .info-value {
          font-size: 13px;
          color: #374151;
          word-break: break-word;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 999px;
          background: #ecfdf3;
          color: #15803d;
          font-size: 11px;
          font-weight: 700;
        }

        .notes-box {
          margin: 18px 20px 20px;
          padding: 13px;
          border-radius: 10px;
          background: #f9fafb;
        }

        .notes-label {
          font-size: 11px;
          color: #9ca3af;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .notes-text {
          color: #4b5563;
          font-size: 13px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .snapshot-list {
          padding: 5px 20px;
        }

        .snapshot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 14px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .snapshot-row:last-child {
          border-bottom: 0;
        }

        .snapshot-label {
          color: #6b7280;
          font-size: 13px;
        }

        .snapshot-value {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .snapshot-value.danger {
          color: #b45309;
        }

        .activity-list {
          padding: 3px 20px;
        }

        .activity-row {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 14px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .activity-row:last-child {
          border-bottom: 0;
        }

        .activity-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #15803d;
          flex-shrink: 0;
        }

        .activity-main {
          min-width: 0;
          flex: 1;
        }

        .activity-title {
          color: #111827;
          font-size: 13px;
          font-weight: 600;
        }

        .activity-meta {
          margin-top: 3px;
          color: #9ca3af;
          font-size: 11px;
        }

        .activity-amount {
          color: #111827;
          font-size: 13px;
          font-weight: 700;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
        }

        thead {
          background: #f9fafb;
        }

        th {
          text-align: left;
          padding: 12px 16px;
          font-size: 11px;
          font-weight: 700;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
          white-space: nowrap;
        }

        td {
          padding: 13px 16px;
          font-size: 13px;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .table-strong {
          font-weight: 700;
          color: #111827;
        }

        .empty-state {
          padding: 56px 24px;
          text-align: center;
        }

        .empty-icon {
          width: 42px;
          height: 42px;
          margin: 0 auto 12px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e5e7eb;
          color: #9ca3af;
          font-size: 19px;
        }

        .empty-title {
          color: #374151;
          font-size: 14px;
          font-weight: 700;
        }

        .empty-description {
          margin-top: 6px;
          color: #9ca3af;
          font-size: 12px;
        }

        .state-card {
          min-height: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 2px 7px
            rgba(15, 23, 42, 0.03);
        }

        .spinner {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 3px solid #e5e7eb;
          border-top-color: #15803d;
          animation: spin 0.8s linear
            infinite;
          margin-bottom: 16px;
        }

        .state-title {
          color: #111827;
          font-size: 17px;
          font-weight: 700;
        }

        .state-text {
          margin-top: 7px;
          max-width: 520px;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.6;
        }

        .state-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .error-symbol {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fef2f2;
          color: #dc2626;
          font-weight: 800;
          margin-bottom: 14px;
        }

        .profit-bars {
          padding: 20px;
        }

        .profit-bar-row {
          margin-bottom: 20px;
        }

        .profit-bar-row:last-child {
          margin-bottom: 0;
        }

        .profit-bar-head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 7px;
        }

        .profit-bar-label {
          color: #4b5563;
          font-size: 12px;
          font-weight: 600;
        }

        .profit-bar-value {
          color: #111827;
          font-size: 12px;
          font-weight: 700;
        }

        .profit-bar-track {
          height: 9px;
          border-radius: 999px;
          background: #f3f4f6;
          overflow: hidden;
        }

        .profit-bar-fill {
          height: 100%;
          border-radius: inherit;
          background: #15803d;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1300px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .mini-grid {
            grid-template-columns: repeat(
              4,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 1000px) {
          .two-column {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .page-content {
            padding: 18px;
          }

          .page-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .page-header-left {
            width: 100%;
          }

          .page-header-actions {
            width: 100%;
          }

          .page-header-actions button {
            width: 100%;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .mini-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .info-grid {
            grid-template-columns: 1fr;
          }

          h1 {
            font-size: 23px;
          }

          .customer-meta {
            white-space: normal;
          }

          .state-actions {
            flex-direction: column;
            width: 100%;
            max-width: 260px;
          }
        }
      `}</style>
    </AppShell>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="mini-metric">
      <div className="mini-label">
        {label}
      </div>

      <div className="mini-value">
        {value}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  badge = false,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
  badge?: boolean;
}) {
  return (
    <div className="info-item">
      <div className="info-label">
        {label}
      </div>

      <div className="info-value">
        {badge ? (
          <span className="status-badge">
            {value || "Active"}
          </span>
        ) : (
          value || "—"
        )}
      </div>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="snapshot-row">
      <span className="snapshot-label">
        {label}
      </span>

      <span
        className={`snapshot-value ${
          danger
            ? "danger"
            : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ProfitBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const width = Math.min(
    Math.max(
      max > 0
        ? (value / max) *
          100
        : 0,
      0
    ),
    100
  );

  return (
    <div className="profit-bar-row">
      <div className="profit-bar-head">
        <span className="profit-bar-label">
          {label}
        </span>

        <span className="profit-bar-value">
          {money(value)}
        </span>
      </div>

      <div className="profit-bar-track">
        <div
          className="profit-bar-fill"
          style={{
            width: `${width}%`,
          }}
        />
      </div>
    </div>
  );
}

function DataTable({
  rows,
  columns,
  moneyColumns = [],
}: {
  rows: Record<
    string,
    unknown
  >[];
  columns: [
    string,
    ...string[]
  ][];
  moneyColumns?: string[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(
              (
                [label],
                index
              ) => (
                <th
                  key={`${label}-${index}`}
                >
                  {label}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
              rowIndex
            ) => (
              <tr
                key={
                  stringValue(
                    row,
                    ["id"]
                  ) ||
                  `row-${rowIndex}`
                }
              >
                {columns.map(
                  (
                    [
                      label,
                      ...keys
                    ],
                    colIndex
                  ) => {
                    let value =
                      stringValue(
                        row,
                        keys
                      );

                    const primaryKey =
                      keys[0] ||
                      "";

                    if (
                      moneyColumns.includes(
                        primaryKey
                      )
                    ) {
                      value =
                        money(
                          numberValue(
                            row,
                            keys
                          )
                        );
                    }

                    if (
                      primaryKey ===
                        "created_at" ||
                      primaryKey ===
                        "start_date" ||
                      primaryKey ===
                        "end_date"
                    ) {
                      value =
                        dateOnly(
                          stringValue(
                            row,
                            keys
                          )
                        );
                    }

                    return (
                      <td
                        key={`${label}-${colIndex}`}
                      >
                        {value ||
                          "—"}
                      </td>
                    );
                  }
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}