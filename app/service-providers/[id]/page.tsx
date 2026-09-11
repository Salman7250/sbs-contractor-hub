"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Provider = {
  id: string;
  company_id: string;
  provider_number: string;
  name: string;
  company_name: string | null;
  service_types: string[] | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  payment_terms: string | null;
  default_rate: number;
  status: "active" | "inactive" | "blocked";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProviderStock = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
  last_dispatch_at: string | null;
  last_return_at: string | null;
};

type Product = {
  id: string;
  name: string;
  tracking_mode: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type SerializedUnit = {
  id: string;
  serial_number: string;
  status: string;
};

type ServiceJob = {
  id: string;
  job_number: string;
  service_type: string;
  status: string;
  priority: string;
  dispatched_date: string | null;
  expected_return_date: string | null;
  completed_date: string | null;
  estimated_cost: number;
  actual_cost: number;
  created_at: string;
};

type ServiceJobItem = {
  id: string;
  service_job_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  quantity_completed: number;
  quantity_failed: number;
  quantity_damaged: number;
  unit_service_cost: number;
};

type Dispatch = {
  id: string;
  dispatch_number: string;
  service_job_id: string;
  dispatch_date: string;
  expected_return_date: string | null;
  status: string;
};

type DispatchItem = {
  id: string;
  dispatch_id: string;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
};

type ServiceReturn = {
  id: string;
  return_number: string;
  dispatch_id: string;
  service_job_id: string;
  return_date: string;
  status: string;
};

type ServiceReturnItem = {
  id: string;
  service_return_id: string;
  dispatch_item_id: string | null;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
  result: string;
  service_cost: number;
};

type Activity = {
  id: string;
  action: string;
  message: string;
  created_at: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function numberFormat(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}

function money(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClass(value: string) {
  if (
    ["active", "completed", "returned"].includes(value)
  ) {
    return "sp-status sp-status-success";
  }

  if (
    [
      "in_progress",
      "awaiting_return",
      "partially_returned",
      "dispatched",
    ].includes(value)
  ) {
    return "sp-status sp-status-info";
  }

  if (
    [
      "blocked",
      "cancelled",
      "damaged",
      "scrapped",
    ].includes(value)
  ) {
    return "sp-status sp-status-danger";
  }

  if (
    ["inactive", "draft"].includes(value)
  ) {
    return "sp-status sp-status-neutral";
  }

  return "sp-status sp-status-warning";
}

function daysBetween(
  start: string | null | undefined,
  end?: string | null,
) {
  if (!start) return 0;

  const startDate = new Date(start);
  const endDate = end
    ? new Date(end)
    : new Date();

  const difference =
    endDate.getTime() - startDate.getTime();

  return Math.max(
    0,
    Math.floor(
      difference /
        (1000 * 60 * 60 * 24),
    ),
  );
}

export default function ServiceProviderDetailPage() {
  const params = useParams();
  const router = useRouter();

  const providerId = String(
    params?.id ?? "",
  );

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [provider, setProvider] =
    useState<Provider | null>(null);

  const [stock, setStock] =
    useState<ProviderStock[]>([]);

  const [jobs, setJobs] =
    useState<ServiceJob[]>([]);

  const [jobItems, setJobItems] =
    useState<ServiceJobItem[]>([]);

  const [dispatches, setDispatches] =
    useState<Dispatch[]>([]);

  const [dispatchItems, setDispatchItems] =
    useState<DispatchItem[]>([]);

  const [returns, setReturns] =
    useState<ServiceReturn[]>([]);

  const [returnItems, setReturnItems] =
    useState<ServiceReturnItem[]>([]);

  const [activities, setActivities] =
    useState<Activity[]>([]);

  const [products, setProducts] =
    useState<Record<string, Product>>({});

  const [variants, setVariants] =
    useState<Record<string, Variant>>({});

  const [serials, setSerials] =
    useState<Record<string, SerializedUnit>>(
      {},
    );

  const [activeTab, setActiveTab] =
    useState<
      | "overview"
      | "stock"
      | "jobs"
      | "dispatches"
      | "returns"
      | "activity"
    >("overview");

  const loadData = useCallback(
    async (silent = false) => {
      if (!providerId) return;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const {
          data: memberships,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1);

        if (membershipError) {
          throw new Error(
            membershipError.message,
          );
        }

        const companyId =
          memberships?.[0]?.company_id;

        if (!companyId) {
          throw new Error(
            "No company membership was found.",
          );
        }

        const {
          data: providerData,
          error: providerError,
        } = await supabase
          .from("service_providers")
          .select(
            "id,company_id,provider_number,name,company_name,service_types,email,phone,whatsapp,address,payment_terms,default_rate,status,notes,created_at,updated_at",
          )
          .eq("id", providerId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (providerError) {
          throw new Error(
            providerError.message,
          );
        }

        if (!providerData) {
          throw new Error(
            "Service provider not found.",
          );
        }

        setProvider(providerData);

        const [
          stockResult,
          jobsResult,
          dispatchesResult,
          returnsResult,
          activityResult,
        ] = await Promise.all([
          supabase
            .from("service_provider_stock")
            .select(
              "id,product_id,variant_id,serialized_unit_id,quantity,last_dispatch_at,last_return_at",
            )
            .eq("company_id", companyId)
            .eq("provider_id", providerId)
            .gt("quantity", 0)
            .order("updated_at", {
              ascending: false,
            }),

          supabase
            .from("service_jobs")
            .select(
              "id,job_number,service_type,status,priority,dispatched_date,expected_return_date,completed_date,estimated_cost,actual_cost,created_at",
            )
            .eq("company_id", companyId)
            .eq("provider_id", providerId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("service_dispatches")
            .select(
              "id,dispatch_number,service_job_id,dispatch_date,expected_return_date,status",
            )
            .eq("company_id", companyId)
            .eq("provider_id", providerId)
            .order("dispatch_date", {
              ascending: false,
            }),

          supabase
            .from("service_returns")
            .select(
              "id,return_number,dispatch_id,service_job_id,return_date,status",
            )
            .eq("company_id", companyId)
            .eq("provider_id", providerId)
            .order("return_date", {
              ascending: false,
            }),

          supabase
            .from("service_provider_activity")
            .select(
              "id,action,message,created_at",
            )
            .eq("company_id", companyId)
            .eq("provider_id", providerId)
            .order("created_at", {
              ascending: false,
            })
            .limit(100),
        ]);

        if (stockResult.error) {
          throw new Error(
            stockResult.error.message,
          );
        }

        if (jobsResult.error) {
          throw new Error(
            jobsResult.error.message,
          );
        }

        if (dispatchesResult.error) {
          throw new Error(
            dispatchesResult.error.message,
          );
        }

        if (returnsResult.error) {
          throw new Error(
            returnsResult.error.message,
          );
        }

        if (activityResult.error) {
          throw new Error(
            activityResult.error.message,
          );
        }

        const jobsData =
          jobsResult.data ?? [];

        const dispatchesData =
          dispatchesResult.data ?? [];

        const returnsData =
          returnsResult.data ?? [];

        setStock(
          stockResult.data ?? [],
        );

        setJobs(jobsData);
        setDispatches(
          dispatchesData,
        );

        setReturns(
          returnsData,
        );

        setActivities(
          activityResult.data ?? [],
        );

        const jobIds =
          jobsData.map(
            (job) => job.id,
          );

        const dispatchIds =
          dispatchesData.map(
            (dispatch) => dispatch.id,
          );

        const returnIds =
          returnsData.map(
            (returnRow) => returnRow.id,
          );

        const [
          jobItemsResult,
          dispatchItemsResult,
          returnItemsResult,
          productsResult,
          variantsResult,
        ] = await Promise.all([
          jobIds.length
            ? supabase
                .from("service_job_items")
                .select(
                  "id,service_job_id,product_id,variant_id,quantity,quantity_completed,quantity_failed,quantity_damaged,unit_service_cost",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "service_job_id",
                  jobIds,
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          dispatchIds.length
            ? supabase
                .from(
                  "service_dispatch_items",
                )
                .select(
                  "id,dispatch_id,service_job_item_id,product_id,variant_id,serialized_unit_id,quantity",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "dispatch_id",
                  dispatchIds,
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          returnIds.length
            ? supabase
                .from(
                  "service_return_items",
                )
                .select(
                  "id,service_return_id,dispatch_item_id,product_id,variant_id,serialized_unit_id,quantity,result,service_cost",
                )
                .eq(
                  "company_id",
                  companyId,
                )
                .in(
                  "service_return_id",
                  returnIds,
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          supabase
            .from("products")
            .select(
              "id,name,tracking_mode",
            )
            .eq(
              "company_id",
              companyId,
            ),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku",
            )
            .eq(
              "company_id",
              companyId,
            ),
        ]);

        if (jobItemsResult.error) {
          throw new Error(
            jobItemsResult.error.message,
          );
        }

        if (
          dispatchItemsResult.error
        ) {
          throw new Error(
            dispatchItemsResult.error.message,
          );
        }

        if (
          returnItemsResult.error
        ) {
          throw new Error(
            returnItemsResult.error.message,
          );
        }

        if (productsResult.error) {
          throw new Error(
            productsResult.error.message,
          );
        }

        if (variantsResult.error) {
          throw new Error(
            variantsResult.error.message,
          );
        }

        const jobItemsData =
          (jobItemsResult.data ??
            []) as ServiceJobItem[];

        const dispatchItemsData =
          (dispatchItemsResult.data ??
            []) as DispatchItem[];

        const returnItemsData =
          (returnItemsResult.data ??
            []) as ServiceReturnItem[];

        setJobItems(
          jobItemsData,
        );

        setDispatchItems(
          dispatchItemsData,
        );

        setReturnItems(
          returnItemsData,
        );

        const productMap: Record<
          string,
          Product
        > = {};

        for (const product of
          productsResult.data ?? []) {
          productMap[product.id] =
            product;
        }

        const variantMap: Record<
          string,
          Variant
        > = {};

        for (const variant of
          variantsResult.data ?? []) {
          variantMap[variant.id] =
            variant;
        }

        setProducts(productMap);
        setVariants(variantMap);

        const serialIds =
          Array.from(
            new Set(
              [
                ...(stockResult.data ??
                  []).map(
                    (item) =>
                      item.serialized_unit_id,
                  ),

                ...dispatchItemsData.map(
                  (item) =>
                    item.serialized_unit_id,
                ),

                ...returnItemsData.map(
                  (item) =>
                    item.serialized_unit_id,
                ),
              ].filter(Boolean),
            ),
          ) as string[];

        if (serialIds.length) {
          const {
            data: serialRows,
            error: serialError,
          } = await supabase
            .from("serialized_units")
            .select(
              "id,serial_number,status",
            )
            .eq(
              "company_id",
              companyId,
            )
            .in(
              "id",
              serialIds,
            );

          if (serialError) {
            throw new Error(
              serialError.message,
            );
          }

          const serialMap: Record<
            string,
            SerializedUnit
          > = {};

          for (const serial of
            serialRows ?? []) {
            serialMap[serial.id] =
              serial;
          }

          setSerials(serialMap);
        } else {
          setSerials({});
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load provider.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      providerId,
      router,
      supabase,
    ],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          ![
            "completed",
            "cancelled",
          ].includes(job.status),
      ),
    [jobs],
  );

  const completedJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status ===
          "completed",
      ),
    [jobs],
  );

  const totalProviderStock =
    useMemo(
      () =>
        stock.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantity || 0,
            ),
          0,
        ),
      [stock],
    );

  const serializedStockCount =
    useMemo(
      () =>
        stock.filter(
          (item) =>
            item.serialized_unit_id !==
            null,
        ).length,
      [stock],
    );

  const totalServiceCost =
    useMemo(
      () =>
        jobs.reduce(
          (sum, job) =>
            sum +
            Number(
              job.actual_cost || 0,
            ),
          0,
        ),
      [jobs],
    );

  const totalDispatched =
    useMemo(
      () =>
        dispatchItems.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantity || 0,
            ),
          0,
        ),
      [dispatchItems],
    );

  const totalReturned =
    useMemo(
      () =>
        returnItems.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantity || 0,
            ),
          0,
        ),
      [returnItems],
    );

  const completedQuantity =
    useMemo(
      () =>
        jobItems.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantity_completed ||
                0,
            ),
          0,
        ),
      [jobItems],
    );

  const failedQuantity =
    useMemo(
      () =>
        jobItems.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantity_failed ||
                0,
            ),
          0,
        ),
      [jobItems],
    );

  const damagedQuantity =
    useMemo(
      () =>
        jobItems.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantity_damaged ||
                0,
            ),
          0,
        ),
      [jobItems],
    );

  const successRate =
    useMemo(() => {
      const resolved =
        completedQuantity +
        failedQuantity +
        damagedQuantity;

      if (!resolved) return 0;

      return (
        (completedQuantity /
          resolved) *
        100
      );
    }, [
      completedQuantity,
      failedQuantity,
      damagedQuantity,
    ]);

  const averageTurnaround =
    useMemo(() => {
      const finished =
        jobs.filter(
          (job) =>
            job.dispatched_date &&
            job.completed_date,
        );

      if (!finished.length)
        return 0;

      const totalDays =
        finished.reduce(
          (sum, job) =>
            sum +
            daysBetween(
              job.dispatched_date,
              job.completed_date,
            ),
          0,
        );

      return (
        totalDays /
        finished.length
      );
    }, [jobs]);

  const overdueJobs =
    useMemo(() => {
      const now = new Date();

      return openJobs.filter(
        (job) => {
          if (
            !job.expected_return_date
          ) {
            return false;
          }

          const expected =
            new Date(
              `${job.expected_return_date}T23:59:59`,
            );

          return expected < now;
        },
      );
    }, [openJobs]);

  const jobById = useMemo(() => {
    const map: Record<
      string,
      ServiceJob
    > = {};

    for (const job of jobs) {
      map[job.id] = job;
    }

    return map;
  }, [jobs]);

  const dispatchById =
    useMemo(() => {
      const map: Record<
        string,
        Dispatch
      > = {};

      for (const dispatch of
        dispatches) {
        map[dispatch.id] =
          dispatch;
      }

      return map;
    }, [dispatches]);

  const getProductName = (
    productId: string,
  ) =>
    products[productId]?.name ||
    "Product";

  const getVariantName = (
    variantId: string | null,
  ) => {
    if (!variantId) return null;

    const variant =
      variants[variantId];

    if (!variant) return null;

    return (
      variant.sku ||
      variant.name ||
      null
    );
  };

  const getItemLabel = (
    productId: string,
    variantId: string | null,
    serializedUnitId: string | null,
  ) => {
    const parts = [
      getProductName(productId),
    ];

    const variantName =
      getVariantName(
        variantId,
      );

    if (variantName) {
      parts.push(variantName);
    }

    if (serializedUnitId) {
      const serial =
        serials[
          serializedUnitId
        ];

      if (serial) {
        parts.push(
          `SN: ${serial.serial_number}`,
        );
      }
    }

    return parts.join(" · ");
  };

  if (loading) {
    return (
      <AppShell>
        <div className="sp-page">
          <div className="sp-loading">
            Loading service provider...
          </div>
        </div>

        <style jsx>{`
          .sp-page {
            padding: 28px;
          }

          .sp-loading {
            min-height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            font-size: 14px;
          }
        `}</style>
      </AppShell>
    );
  }

  if (!provider) {
    return (
      <AppShell>
        <div className="sp-page">
          <div className="sp-error">
            {errorMessage ||
              "Service provider not found."}
          </div>
        </div>

        <style jsx>{`
          .sp-page {
            padding: 28px;
          }

          .sp-error {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 20px;
            color: #991b1b;
            font-size: 13px;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="sp-page">
        <div className="sp-breadcrumb">
          <button
            onClick={() =>
              router.push(
                "/service-providers",
              )
            }
          >
            Service Providers
          </button>

          <span>/</span>

          <span>
            {provider.name}
          </span>
        </div>

        <div className="sp-header">
          <div className="sp-header-left">
            <div className="sp-avatar">
              {provider.name
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <h1>
                {provider.name}
              </h1>

              <div className="sp-subtitle">
                {provider.company_name ||
                  "External Service Provider"}
              </div>

              <div className="sp-number">
                {provider.provider_number}
              </div>
            </div>
          </div>

          <div className="sp-header-actions">
            <button
              className="sp-button"
              onClick={() =>
                router.push(
                  `/service-providers/${provider.id}/edit`,
                )
              }
            >
              Edit Provider
            </button>

            <button
              className="sp-button"
              onClick={() =>
                loadData(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              className="sp-button sp-button-primary"
              onClick={() =>
                router.push(
                  "/service-jobs/new",
                )
              }
            >
              New Service Job
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="sp-alert">
            {errorMessage}
          </div>
        )}

        {overdueJobs.length > 0 && (
          <div className="sp-warning">
            <strong>
              {overdueJobs.length} overdue
              service job
              {overdueJobs.length === 1
                ? ""
                : "s"}
              .
            </strong>{" "}
            Some company-owned stock may
            still be with this provider
            beyond the expected return date.
          </div>
        )}

        <div className="sp-stats">
          <div className="sp-stat-card">
            <div className="sp-stat-label">
              Provider Stock
            </div>

            <div className="sp-stat-value">
              {numberFormat(
                totalProviderStock,
              )}
            </div>

            <div className="sp-stat-sub">
              Units currently held
            </div>
          </div>

          <div className="sp-stat-card">
            <div className="sp-stat-label">
              Open Jobs
            </div>

            <div className="sp-stat-value">
              {openJobs.length}
            </div>

            <div className="sp-stat-sub">
              {overdueJobs.length} overdue
            </div>
          </div>

          <div className="sp-stat-card">
            <div className="sp-stat-label">
              Total Jobs
            </div>

            <div className="sp-stat-value">
              {jobs.length}
            </div>

            <div className="sp-stat-sub">
              {completedJobs.length} completed
            </div>
          </div>

          <div className="sp-stat-card">
            <div className="sp-stat-label">
              Dispatched
            </div>

            <div className="sp-stat-value">
              {numberFormat(
                totalDispatched,
              )}
            </div>

            <div className="sp-stat-sub">
              Total units sent
            </div>
          </div>

          <div className="sp-stat-card">
            <div className="sp-stat-label">
              Returned
            </div>

            <div className="sp-stat-value">
              {numberFormat(
                totalReturned,
              )}
            </div>

            <div className="sp-stat-sub">
              Total units received
            </div>
          </div>

          <div className="sp-stat-card">
            <div className="sp-stat-label">
              Service Cost
            </div>

            <div className="sp-stat-value">
              {money(
                totalServiceCost,
              )}
            </div>

            <div className="sp-stat-sub">
              Actual recorded cost
            </div>
          </div>
        </div>

        <div className="sp-info-card">
          <div className="sp-info-grid">
            <div>
              <div className="sp-info-label">
                Status
              </div>

              <span
                className={getStatusClass(
                  provider.status,
                )}
              >
                {statusLabel(
                  provider.status,
                )}
              </span>
            </div>

            <div>
              <div className="sp-info-label">
                Email
              </div>

              <div className="sp-info-value">
                {provider.email ||
                  "—"}
              </div>
            </div>

            <div>
              <div className="sp-info-label">
                Phone
              </div>

              <div className="sp-info-value">
                {provider.phone ||
                  "—"}
              </div>
            </div>

            <div>
              <div className="sp-info-label">
                WhatsApp
              </div>

              <div className="sp-info-value">
                {provider.whatsapp ||
                  "—"}
              </div>
            </div>

            <div>
              <div className="sp-info-label">
                Payment Terms
              </div>

              <div className="sp-info-value">
                {provider.payment_terms ||
                  "—"}
              </div>
            </div>

            <div>
              <div className="sp-info-label">
                Default Rate
              </div>

              <div className="sp-info-value">
                {money(
                  Number(
                    provider.default_rate ||
                      0,
                  ),
                )}
              </div>
            </div>

            <div>
              <div className="sp-info-label">
                Service Types
              </div>

              <div className="sp-service-tags">
                {provider.service_types
                    ?.length ? (
                  provider.service_types.map(
                    (type) => (
                      <span
                        className="sp-tag"
                        key={type}
                      >
                        {type}
                      </span>
                    ),
                  )
                ) : (
                  <span className="sp-info-value">
                    Not specified
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="sp-info-label">
                Address
              </div>

              <div className="sp-info-value">
                {provider.address ||
                  "—"}
              </div>
            </div>
          </div>

          {provider.notes && (
            <div className="sp-note">
              <div className="sp-info-label">
                Internal Notes
              </div>

              <div className="sp-note-text">
                {provider.notes}
              </div>
            </div>
          )}
        </div>

        <div className="sp-tabs">
          {[
            ["overview", "Overview"],
            [
              "stock",
              `Provider Stock (${numberFormat(
                totalProviderStock,
              )})`,
            ],
            [
              "jobs",
              `Jobs (${jobs.length})`,
            ],
            [
              "dispatches",
              `Dispatches (${dispatches.length})`,
            ],
            [
              "returns",
              `Returns (${returns.length})`,
            ],
            ["activity", "Activity"],
          ].map(
            ([value, label]) => (
              <button
                key={value}
                className={`sp-tab ${
                  activeTab === value
                    ? "sp-tab-active"
                    : ""
                }`}
                onClick={() =>
                  setActiveTab(
                    value as
                      | "overview"
                      | "stock"
                      | "jobs"
                      | "dispatches"
                      | "returns"
                      | "activity",
                  )
                }
              >
                {label}
              </button>
            ),
          )}
        </div>

        {activeTab ===
          "overview" && (
          <div className="sp-content-grid">
            <div className="sp-card">
              <div className="sp-card-header">
                <div>
                  <div className="sp-card-title">
                    Provider Performance
                  </div>

                  <div className="sp-card-description">
                    Operational performance
                    across this provider's
                    service history.
                  </div>
                </div>
              </div>

              <div className="sp-card-body">
                <div className="sp-performance-grid">
                  <div className="sp-performance">
                    <strong>
                      {numberFormat(
                        completedQuantity,
                      )}
                    </strong>
                    <span>
                      Completed
                    </span>
                  </div>

                  <div className="sp-performance">
                    <strong>
                      {numberFormat(
                        failedQuantity,
                      )}
                    </strong>
                    <span>
                      Not Repaired
                    </span>
                  </div>

                  <div className="sp-performance">
                    <strong>
                      {numberFormat(
                        damagedQuantity,
                      )}
                    </strong>
                    <span>
                      Damaged / Scrapped
                    </span>
                  </div>

                  <div className="sp-performance">
                    <strong>
                      {successRate.toFixed(
                        1,
                      )}
                      %
                    </strong>
                    <span>
                      Success Rate
                    </span>
                  </div>

                  <div className="sp-performance">
                    <strong>
                      {averageTurnaround.toFixed(
                        1,
                      )}
                    </strong>
                    <span>
                      Avg. Days
                    </span>
                  </div>

                  <div className="sp-performance">
                    <strong>
                      {money(
                        totalServiceCost,
                      )}
                    </strong>
                    <span>
                      Service Cost
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sp-card">
              <div className="sp-card-header">
                <div>
                  <div className="sp-card-title">
                    Current Custody
                  </div>

                  <div className="sp-card-description">
                    Company-owned stock currently
                    held by this provider.
                  </div>
                </div>
              </div>

              <div className="sp-card-body">
                <div className="sp-custody-summary">
                  <strong>
                    {numberFormat(
                      totalProviderStock,
                    )}
                  </strong>

                  <span>
                    units with provider
                  </span>

                  <small>
                    {serializedStockCount}{" "}
                    serialized unit
                    {serializedStockCount ===
                    1
                      ? ""
                      : "s"}
                  </small>
                </div>

                {stock
                  .slice(0, 5)
                  .map((item) => (
                    <div
                      className="sp-mini-row"
                      key={item.id}
                    >
                      <div>
                        <strong>
                          {getItemLabel(
                            item.product_id,
                            item.variant_id,
                            item.serialized_unit_id,
                          )}
                        </strong>

                        <small>
                          Last dispatched{" "}
                          {formatDateTime(
                            item.last_dispatch_at,
                          )}
                        </small>
                      </div>

                      <b>
                        {numberFormat(
                          item.quantity,
                        )}
                      </b>
                    </div>
                  ))}

                {stock.length > 5 && (
                  <button
                    className="sp-text-button"
                    onClick={() =>
                      setActiveTab(
                        "stock",
                      )
                    }
                  >
                    View all provider stock
                  </button>
                )}

                {!stock.length && (
                  <div className="sp-empty-small">
                    No stock currently held.
                  </div>
                )}
              </div>
            </div>

            <div className="sp-card">
              <div className="sp-card-header">
                <div>
                  <div className="sp-card-title">
                    Open Service Jobs
                  </div>

                  <div className="sp-card-description">
                    Jobs currently in progress
                    or awaiting return.
                  </div>
                </div>

                <button
                  className="sp-small-button"
                  onClick={() =>
                    setActiveTab("jobs")
                  }
                >
                  View Jobs
                </button>
              </div>

              <div className="sp-card-body sp-no-padding">
                {!openJobs.length ? (
                  <div className="sp-empty-large">
                    No open service jobs.
                  </div>
                ) : (
                  <div className="sp-table-scroll">
                    <table className="sp-table">
                      <thead>
                        <tr>
                          <th>Job</th>
                          <th>Service</th>
                          <th>Status</th>
                          <th>
                            Expected Return
                          </th>
                          <th>Cost</th>
                        </tr>
                      </thead>

                      <tbody>
                        {openJobs
                          .slice(0, 8)
                          .map(
                            (job) => (
                              <tr
                                key={
                                  job.id
                                }
                              >
                                <td>
                                  <button
                                    className="sp-link"
                                    onClick={() =>
                                      router.push(
                                        `/service-jobs/${job.id}`,
                                      )
                                    }
                                  >
                                    {
                                      job.job_number
                                    }
                                  </button>
                                </td>

                                <td>
                                  {
                                    job.service_type
                                  }
                                </td>

                                <td>
                                  <span
                                    className={getStatusClass(
                                      job.status,
                                    )}
                                  >
                                    {statusLabel(
                                      job.status,
                                    )}
                                  </span>
                                </td>

                                <td>
                                  {formatDate(
                                    job.expected_return_date,
                                  )}
                                </td>

                                <td>
                                  {money(
                                    Number(
                                      job.actual_cost ||
                                        0,
                                    ),
                                  )}
                                </td>
                              </tr>
                            ),
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="sp-card">
              <div className="sp-card-header">
                <div>
                  <div className="sp-card-title">
                    Recent Activity
                  </div>

                  <div className="sp-card-description">
                    Latest provider activity.
                  </div>
                </div>
              </div>

              <div className="sp-card-body">
                {!activities.length ? (
                  <div className="sp-empty-small">
                    No activity recorded yet.
                  </div>
                ) : (
                  activities
                    .slice(0, 7)
                    .map(
                      (activity) => (
                        <div
                          className="sp-activity-row"
                          key={
                            activity.id
                          }
                        >
                          <div className="sp-activity-dot" />

                          <div>
                            <strong>
                              {
                                activity.message
                              }
                            </strong>

                            <small>
                              {formatDateTime(
                                activity.created_at,
                              )}
                            </small>
                          </div>
                        </div>
                      ),
                    )
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab ===
          "stock" && (
          <div className="sp-card">
            <div className="sp-card-header">
              <div>
                <div className="sp-card-title">
                  Provider Stock & Custody
                </div>

                <div className="sp-card-description">
                  Company-owned inventory currently
                  outside your warehouses.
                </div>
              </div>

              <strong className="sp-header-count">
                {numberFormat(
                  totalProviderStock,
                )}{" "}
                units
              </strong>
            </div>

            <div className="sp-card-body sp-no-padding">
              {!stock.length ? (
                <div className="sp-empty-large">
                  This provider currently holds no
                  company stock.
                </div>
              ) : (
                <div className="sp-table-scroll">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Type</th>
                        <th>Serial Number</th>
                        <th>Quantity</th>
                        <th>
                          Last Dispatch
                        </th>
                        <th>
                          Last Return
                        </th>
                        <th>Days Held</th>
                      </tr>
                    </thead>

                    <tbody>
                      {stock.map(
                        (item) => {
                          const serial =
                            item.serialized_unit_id
                              ? serials[
                                  item
                                    .serialized_unit_id
                                ]
                              : null;

                          const daysHeld =
                            daysBetween(
                              item.last_dispatch_at,
                            );

                          return (
                            <tr
                              key={
                                item.id
                              }
                            >
                              <td>
                                <strong>
                                  {
                                    getProductName(
                                      item.product_id,
                                    )
                                  }
                                </strong>

                                {getVariantName(
                                  item.variant_id,
                                ) && (
                                  <small className="sp-table-sub">
                                    {
                                      getVariantName(
                                        item.variant_id,
                                      )
                                    }
                                  </small>
                                )}
                              </td>

                              <td>
                                <span className="sp-tag">
                                  {item.serialized_unit_id
                                    ? "Serialized"
                                    : "Bulk"}
                                </span>
                              </td>

                              <td>
                                {
                                  serial?.serial_number ||
                                  "—"
                                }
                              </td>

                              <td>
                                <strong>
                                  {numberFormat(
                                    item.quantity,
                                  )}
                                </strong>
                              </td>

                              <td>
                                {formatDateTime(
                                  item.last_dispatch_at,
                                )}
                              </td>

                              <td>
                                {formatDateTime(
                                  item.last_return_at,
                                )}
                              </td>

                              <td>
                                <span
                                  className={
                                    daysHeld >
                                    30
                                      ? "sp-days-danger"
                                      : "sp-days-normal"
                                  }
                                >
                                  {daysHeld}{" "}
                                  day
                                  {daysHeld ===
                                  1
                                    ? ""
                                    : "s"}
                                </span>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab ===
          "jobs" && (
          <div className="sp-card">
            <div className="sp-card-header">
              <div>
                <div className="sp-card-title">
                  Service Jobs
                </div>

                <div className="sp-card-description">
                  Complete service history for this
                  provider.
                </div>
              </div>

              <strong className="sp-header-count">
                {jobs.length}{" "}
                {jobs.length === 1
                  ? "job"
                  : "jobs"}
              </strong>
            </div>

            <div className="sp-card-body sp-no-padding">
              {!jobs.length ? (
                <div className="sp-empty-large">
                  No service jobs found.
                </div>
              ) : (
                <div className="sp-table-scroll">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Service</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>
                          Dispatched
                        </th>
                        <th>Expected</th>
                        <th>
                          Actual Cost
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {jobs.map(
                        (job) => (
                          <tr
                            key={
                              job.id
                            }
                          >
                            <td>
                              <button
                                className="sp-link"
                                onClick={() =>
                                  router.push(
                                    `/service-jobs/${job.id}`,
                                  )
                                }
                              >
                                {
                                  job.job_number
                                }
                              </button>
                            </td>

                            <td>
                              {
                                job.service_type
                              }
                            </td>

                            <td>
                              <span
                                className={getStatusClass(
                                  job.priority,
                                )}
                              >
                                {statusLabel(
                                  job.priority,
                                )}
                              </span>
                            </td>

                            <td>
                              <span
                                className={getStatusClass(
                                  job.status,
                                )}
                              >
                                {statusLabel(
                                  job.status,
                                )}
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                job.dispatched_date,
                              )}
                            </td>

                            <td>
                              {formatDate(
                                job.expected_return_date,
                              )}
                            </td>

                            <td>
                              {money(
                                Number(
                                  job.actual_cost ||
                                    0,
                                ),
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab ===
          "dispatches" && (
          <div className="sp-card">
            <div className="sp-card-header">
              <div>
                <div className="sp-card-title">
                  Dispatch History
                </div>

                <div className="sp-card-description">
                  Stock sent from company warehouses
                  to this provider.
                </div>
              </div>
            </div>

            <div className="sp-card-body sp-no-padding">
              {!dispatches.length ? (
                <div className="sp-empty-large">
                  No dispatches recorded.
                </div>
              ) : (
                <div className="sp-table-scroll">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>
                          Dispatch
                        </th>
                        <th>Job</th>
                        <th>Date</th>
                        <th>
                          Expected Return
                        </th>
                        <th>Items</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {dispatches.map(
                        (dispatch) => {
                          const itemCount =
                            dispatchItems
                              .filter(
                                (
                                  item,
                                ) =>
                                  item.dispatch_id ===
                                  dispatch.id,
                              )
                              .reduce(
                                (
                                  sum,
                                  item,
                                ) =>
                                  sum +
                                  Number(
                                    item.quantity ||
                                      0,
                                  ),
                                0,
                              );

                          const job =
                            jobById[
                              dispatch
                                .service_job_id
                            ];

                          return (
                            <tr
                              key={
                                dispatch.id
                              }
                            >
                              <td>
                                <strong>
                                  {
                                    dispatch.dispatch_number
                                  }
                                </strong>
                              </td>

                              <td>
                                {job ? (
                                  <button
                                    className="sp-link"
                                    onClick={() =>
                                      router.push(
                                        `/service-jobs/${job.id}`,
                                      )
                                    }
                                  >
                                    {
                                      job.job_number
                                    }
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </td>

                              <td>
                                {formatDate(
                                  dispatch.dispatch_date,
                                )}
                              </td>

                              <td>
                                {formatDate(
                                  dispatch.expected_return_date,
                                )}
                              </td>

                              <td>
                                {numberFormat(
                                  itemCount,
                                )}
                              </td>

                              <td>
                                <span
                                  className={getStatusClass(
                                    dispatch.status,
                                  )}
                                >
                                  {statusLabel(
                                    dispatch.status,
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab ===
          "returns" && (
          <div className="sp-card">
            <div className="sp-card-header">
              <div>
                <div className="sp-card-title">
                  Return History
                </div>

                <div className="sp-card-description">
                  Stock received back and recorded
                  service outcomes.
                </div>
              </div>
            </div>

            <div className="sp-card-body sp-no-padding">
              {!returns.length ? (
                <div className="sp-empty-large">
                  No returns recorded.
                </div>
              ) : (
                <div className="sp-table-scroll">
                  <table className="sp-table">
                    <thead>
                      <tr>
                        <th>Return</th>
                        <th>
                          Dispatch
                        </th>
                        <th>Job</th>
                        <th>Date</th>
                        <th>Quantity</th>
                        <th>
                          Service Cost
                        </th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {returns.map(
                        (returnRow) => {
                          const items =
                            returnItems.filter(
                              (
                                item,
                              ) =>
                                item.service_return_id ===
                                returnRow.id,
                            );

                          const quantity =
                            items.reduce(
                              (
                                sum,
                                item,
                              ) =>
                                sum +
                                Number(
                                  item.quantity ||
                                    0,
                                ),
                              0,
                            );

                          const cost =
                            items.reduce(
                              (
                                sum,
                                item,
                              ) =>
                                sum +
                                Number(
                                  item.service_cost ||
                                    0,
                                ),
                              0,
                            );

                          const dispatch =
                            dispatchById[
                              returnRow
                                .dispatch_id
                            ];

                          const job =
                            jobById[
                              returnRow
                                .service_job_id
                            ];

                          return (
                            <tr
                              key={
                                returnRow.id
                              }
                            >
                              <td>
                                <strong>
                                  {
                                    returnRow.return_number
                                  }
                                </strong>
                              </td>

                              <td>
                                {
                                  dispatch?.dispatch_number ||
                                  "—"
                                }
                              </td>

                              <td>
                                {job ? (
                                  <button
                                    className="sp-link"
                                    onClick={() =>
                                      router.push(
                                        `/service-jobs/${job.id}`,
                                      )
                                    }
                                  >
                                    {
                                      job.job_number
                                    }
                                  </button>
                                ) : (
                                  "—"
                                )}
                              </td>

                              <td>
                                {formatDate(
                                  returnRow.return_date,
                                )}
                              </td>

                              <td>
                                {numberFormat(
                                  quantity,
                                )}
                              </td>

                              <td>
                                {money(
                                  cost,
                                )}
                              </td>

                              <td>
                                <span
                                  className={getStatusClass(
                                    returnRow.status,
                                  )}
                                >
                                  {statusLabel(
                                    returnRow.status,
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab ===
          "activity" && (
          <div className="sp-card">
            <div className="sp-card-header">
              <div>
                <div className="sp-card-title">
                  Provider Activity
                </div>

                <div className="sp-card-description">
                  Complete operational history for
                  this provider.
                </div>
              </div>
            </div>

            <div className="sp-card-body">
              {!activities.length ? (
                <div className="sp-empty-large">
                  No activity recorded.
                </div>
              ) : (
                <div className="sp-activity-list">
                  {activities.map(
                    (activity) => (
                      <div
                        className="sp-activity-full"
                        key={
                          activity.id
                        }
                      >
                        <div className="sp-activity-dot" />

                        <div className="sp-activity-full-content">
                          <div className="sp-activity-full-top">
                            <strong>
                              {statusLabel(
                                activity.action,
                              )}
                            </strong>

                            <span>
                              {formatDateTime(
                                activity.created_at,
                              )}
                            </span>
                          </div>

                          <div className="sp-activity-message">
                            {
                              activity.message
                            }
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .sp-page {
          padding: 28px;
          max-width: 1500px;
          margin: 0 auto;
        }

        .sp-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #6b7280;
          font-size: 13px;
        }

        .sp-breadcrumb button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #6b7280;
          font-size: 13px;
          cursor: pointer;
        }

        .sp-breadcrumb button:hover {
          color: #111827;
        }

        .sp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .sp-header-left {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .sp-avatar {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: #f3f4f6;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          flex-shrink: 0;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 25px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .sp-subtitle {
          margin-top: 5px;
          color: #6b7280;
          font-size: 13px;
        }

        .sp-number {
          margin-top: 4px;
          color: #9ca3af;
          font-size: 11px;
        }

        .sp-header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        .sp-button {
          height: 40px;
          padding: 0 14px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .sp-button:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .sp-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sp-button-primary {
          background: #111827;
          border-color: #111827;
          color: #fff;
        }

        .sp-button-primary:hover {
          background: #1f2937;
          border-color: #1f2937;
        }

        .sp-alert {
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
        }

        .sp-warning {
          margin-bottom: 18px;
          padding: 12px 14px;
          border: 1px solid #fde68a;
          border-radius: 10px;
          background: #fffbeb;
          color: #92400e;
          font-size: 12px;
        }

        .sp-warning strong {
          color: #78350f;
        }

        .sp-stats {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 13px;
          margin-bottom: 18px;
        }

        .sp-stat-card {
          padding: 17px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .sp-stat-label {
          margin-bottom: 8px;
          color: #6b7280;
          font-size: 11px;
        }

        .sp-stat-value {
          color: #111827;
          font-size: 21px;
          line-height: 1.1;
          font-weight: 700;
        }

        .sp-stat-sub {
          margin-top: 6px;
          color: #9ca3af;
          font-size: 11px;
        }

        .sp-info-card {
          margin-bottom: 18px;
          padding: 19px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .sp-info-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 17px;
        }

        .sp-info-label {
          margin-bottom: 5px;
          color: #9ca3af;
          font-size: 10px;
          font-weight: 600;
        }

        .sp-info-value {
          color: #374151;
          font-size: 12px;
          line-height: 1.45;
          word-break: break-word;
        }

        .sp-service-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .sp-tag {
          display: inline-flex;
          align-items: center;
          min-height: 23px;
          padding: 0 8px;
          border-radius: 6px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 10px;
          font-weight: 600;
        }

        .sp-note {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #f3f4f6;
        }

        .sp-note-text {
          color: #374151;
          font-size: 12px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .sp-tabs {
          display: flex;
          align-items: center;
          gap: 2px;
          margin-bottom: 18px;
          border-bottom: 1px solid #e5e7eb;
          overflow-x: auto;
        }

        .sp-tab {
          min-height: 40px;
          padding: 0 13px;
          border: 0;
          border-bottom: 2px solid transparent;
          background: transparent;
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
        }

        .sp-tab:hover {
          color: #111827;
        }

        .sp-tab-active {
          border-bottom-color: #111827;
          color: #111827;
        }

        .sp-content-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
          gap: 18px;
        }

        .sp-card {
          min-width: 0;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          overflow: hidden;
        }

        .sp-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 17px 19px;
          border-bottom: 1px solid #e5e7eb;
        }

        .sp-card-title {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .sp-card-description {
          margin-top: 4px;
          color: #6b7280;
          font-size: 11px;
          line-height: 1.4;
        }

        .sp-card-body {
          padding: 19px;
        }

        .sp-no-padding {
          padding: 0;
        }

        .sp-header-count {
          color: #6b7280;
          font-size: 11px;
          white-space: nowrap;
        }

        .sp-performance-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .sp-performance {
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #fafafa;
        }

        .sp-performance strong {
          display: block;
          color: #111827;
          font-size: 18px;
          line-height: 1.1;
        }

        .sp-performance span {
          display: block;
          margin-top: 5px;
          color: #6b7280;
          font-size: 10px;
        }

        .sp-custody-summary {
          padding: 14px;
          margin-bottom: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
        }

        .sp-custody-summary strong {
          display: block;
          color: #111827;
          font-size: 25px;
        }

        .sp-custody-summary span {
          display: block;
          margin-top: 3px;
          color: #6b7280;
          font-size: 11px;
        }

        .sp-custody-summary small {
          display: block;
          margin-top: 5px;
          color: #9ca3af;
          font-size: 10px;
        }

        .sp-mini-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 11px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .sp-mini-row > div {
          min-width: 0;
        }

        .sp-mini-row strong {
          display: block;
          color: #374151;
          font-size: 11px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sp-mini-row small {
          display: block;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 9px;
        }

        .sp-mini-row > b {
          color: #111827;
          font-size: 12px;
          flex-shrink: 0;
        }

        .sp-text-button {
          margin-top: 12px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #374151;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .sp-text-button:hover {
          text-decoration: underline;
        }

        .sp-small-button {
          height: 32px;
          padding: 0 10px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #fff;
          color: #374151;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .sp-empty-small,
        .sp-empty-large {
          color: #9ca3af;
          text-align: center;
          font-size: 11px;
        }

        .sp-empty-small {
          padding: 20px 0;
        }

        .sp-empty-large {
          padding: 45px 20px;
        }

        .sp-table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .sp-table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
        }

        .sp-table th {
          padding: 11px 15px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #6b7280;
          font-size: 10px;
          font-weight: 600;
          text-align: left;
          white-space: nowrap;
        }

        .sp-table td {
          padding: 12px 15px;
          border-bottom: 1px solid #f3f4f6;
          color: #374151;
          font-size: 11px;
          vertical-align: middle;
        }

        .sp-table tbody tr:hover {
          background: #fafafa;
        }

        .sp-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .sp-table td strong {
          color: #111827;
          font-weight: 600;
        }

        .sp-table-sub {
          display: block;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 9px;
        }

        .sp-link {
          padding: 0;
          border: 0;
          background: transparent;
          color: #111827;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .sp-link:hover {
          text-decoration: underline;
        }

        .sp-status {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 0 7px;
          border-radius: 6px;
          font-size: 9px;
          font-weight: 600;
          white-space: nowrap;
        }

        .sp-status-success {
          background: #ecfdf3;
          color: #166534;
        }

        .sp-status-info {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .sp-status-danger {
          background: #fef2f2;
          color: #b91c1c;
        }

        .sp-status-warning {
          background: #fffbeb;
          color: #92400e;
        }

        .sp-status-neutral {
          background: #f3f4f6;
          color: #4b5563;
        }

        .sp-days-normal {
          color: #374151;
          font-weight: 600;
        }

        .sp-days-danger {
          color: #b91c1c;
          font-weight: 700;
        }

        .sp-activity-row {
          display: flex;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .sp-activity-row:last-child {
          border-bottom: 0;
        }

        .sp-activity-row > div:last-child {
          min-width: 0;
        }

        .sp-activity-row strong {
          display: block;
          color: #374151;
          font-size: 11px;
          line-height: 1.45;
        }

        .sp-activity-row small {
          display: block;
          margin-top: 4px;
          color: #9ca3af;
          font-size: 9px;
        }

        .sp-activity-dot {
          width: 7px;
          height: 7px;
          margin-top: 5px;
          border-radius: 50%;
          background: #9ca3af;
          flex-shrink: 0;
        }

        .sp-activity-list {
          display: flex;
          flex-direction: column;
        }

        .sp-activity-full {
          display: flex;
          gap: 11px;
          padding: 14px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .sp-activity-full:last-child {
          border-bottom: 0;
        }

        .sp-activity-full-content {
          min-width: 0;
          flex: 1;
        }

        .sp-activity-full-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .sp-activity-full-top strong {
          color: #111827;
          font-size: 11px;
        }

        .sp-activity-full-top span {
          color: #9ca3af;
          font-size: 9px;
          white-space: nowrap;
        }

        .sp-activity-message {
          margin-top: 4px;
          color: #4b5563;
          font-size: 11px;
          line-height: 1.5;
        }

        @media (max-width: 1250px) {
          .sp-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .sp-info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 950px) {
          .sp-content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .sp-page {
            padding: 18px;
          }

          .sp-header {
            flex-direction: column;
          }

          .sp-header-actions {
            width: 100%;
          }

          .sp-header-actions .sp-button {
            flex: 1;
          }

          .sp-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sp-info-grid {
            grid-template-columns: 1fr;
          }

          .sp-performance-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          h1 {
            font-size: 22px;
          }
        }
      `}</style>
    </AppShell>
  );
}