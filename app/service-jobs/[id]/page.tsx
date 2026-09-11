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

type ServiceJob = {
  id: string;
  company_id: string;
  job_number: string;
  provider_id: string;
  customer_id: string | null;
  source:
    | "internal"
    | "repair"
    | "warranty"
    | "rma"
    | "purchase"
    | "other";
  service_type: string;
  status:
    | "draft"
    | "open"
    | "in_progress"
    | "awaiting_return"
    | "partially_returned"
    | "completed"
    | "cancelled";
  priority:
    | "low"
    | "normal"
    | "high"
    | "urgent";
  dispatched_date: string | null;
  expected_return_date: string | null;
  completed_date: string | null;
  notes: string | null;
  internal_notes: string | null;
  estimated_cost: number;
  actual_cost: number;
  created_at: string;
  updated_at: string;
};

type Provider = {
  id: string;
  name: string;
  company_name: string | null;
  provider_number: string;
  status: string;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  name: string;
  tracking_mode: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
};

type JobItem = {
  id: string;
  service_job_id: string;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
  quantity_completed: number;
  quantity_failed: number;
  quantity_damaged: number;
  service_description: string | null;
  unit_service_cost: number;
  notes: string | null;
};

type Warehouse = {
  id: string;
  name: string;
};

type Dispatch = {
  id: string;
  dispatch_number: string;
  service_job_id: string;
  provider_id: string;
  warehouse_id: string | null;
  dispatch_date: string;
  expected_return_date: string | null;
  status:
    | "draft"
    | "dispatched"
    | "partially_returned"
    | "returned"
    | "cancelled";
  notes: string | null;
  created_at: string;
};

type DispatchItem = {
  id: string;
  dispatch_id: string;
  service_job_item_id: string | null;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
  notes: string | null;
};

type ServiceReturn = {
  id: string;
  return_number: string;
  dispatch_id: string;
  service_job_id: string;
  provider_id: string;
  return_date: string;
  status:
    | "draft"
    | "received"
    | "inspected"
    | "completed"
    | "cancelled";
  notes: string | null;
  created_at: string;
};

type ReturnItem = {
  id: string;
  service_return_id: string;
  dispatch_item_id: string | null;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
  result:
    | "completed"
    | "not_repaired"
    | "damaged"
    | "scrapped"
    | "pending"
    | "other";
  work_performed: string | null;
  failure_reason: string | null;
  condition_received: string | null;
  service_cost: number;
  notes: string | null;
};

type Activity = {
  id: string;
  action: string;
  message: string;
  created_by: string | null;
  created_at: string;
};

type ItemSummary = JobItem & {
  productName: string;
  variantName: string | null;
  variantSku: string | null;
  serialNumber: string | null;
  dispatched: number;
  returned: number;
  withProvider: number;
};

const formatMoney = (value: number) =>
  `AED ${Number(value || 0).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value: string | null) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-AE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusLabel = (status: string) => {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
};

const priorityLabel = (priority: string) => {
  return (
    priority.charAt(0).toUpperCase() +
    priority.slice(1)
  );
};

const resultLabel = (result: string) => {
  return statusLabel(result);
};

export default function ServiceJobDetailPage() {
  const params = useParams();
  const router = useRouter();

  const jobId =
    typeof params?.id === "string"
      ? params.id
      : "";

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [job, setJob] =
    useState<ServiceJob | null>(null);

  const [provider, setProvider] =
    useState<Provider | null>(null);

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [variants, setVariants] =
    useState<ProductVariant[]>([]);

  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);

  const [warehouses, setWarehouses] =
    useState<Warehouse[]>([]);

  const [jobItems, setJobItems] =
    useState<JobItem[]>([]);

  const [dispatches, setDispatches] =
    useState<Dispatch[]>([]);

  const [dispatchItems, setDispatchItems] =
    useState<DispatchItem[]>([]);

  const [returns, setReturns] =
    useState<ServiceReturn[]>([]);

  const [returnItems, setReturnItems] =
    useState<ReturnItem[]>([]);

  const [activities, setActivities] =
    useState<Activity[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [actionLoading, setActionLoading] =
    useState(false);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!jobId) return;

      if (isRefresh) {
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
          data: membership,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw new Error(
            `Membership lookup failed: ${membershipError.message}`
          );
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership was found for your account."
          );
        }

        const companyId =
          membership.company_id;

        const {
          data: jobData,
          error: jobError,
        } = await supabase
          .from("service_jobs")
          .select(
            `
              id,
              company_id,
              job_number,
              provider_id,
              customer_id,
              source,
              service_type,
              status,
              priority,
              dispatched_date,
              expected_return_date,
              completed_date,
              notes,
              internal_notes,
              estimated_cost,
              actual_cost,
              created_at,
              updated_at
            `
          )
          .eq("id", jobId)
          .eq("company_id", companyId)
          .maybeSingle();

        if (jobError) {
          throw new Error(
            `Service job lookup failed: ${jobError.message}`
          );
        }

        if (!jobData) {
          throw new Error(
            "Service job not found."
          );
        }

        const currentJob =
          jobData as ServiceJob;

        setJob(currentJob);

        const providerPromise =
          currentJob.provider_id
            ? supabase
                .from("service_providers")
                .select(
                  "id,name,company_name,provider_number,status"
                )
                .eq(
                  "id",
                  currentJob.provider_id
                )
                .eq(
                  "company_id",
                  companyId
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              });

        const customerPromise =
          currentJob.customer_id
            ? supabase
                .from("customers")
                .select(
                  "id,name,email,phone"
                )
                .eq(
                  "id",
                  currentJob.customer_id
                )
                .eq(
                  "company_id",
                  companyId
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              });

        const [
          providerResult,
          customerResult,
          productsResult,
          variantsResult,
          serializedResult,
          warehousesResult,
          jobItemsResult,
          dispatchesResult,
          returnsResult,
          activitiesResult,
        ] = await Promise.all([
          providerPromise,

          customerPromise,

          supabase
            .from("products")
            .select(
              "id,name,tracking_mode"
            )
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku"
            )
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("serialized_units")
            .select(
              "id,product_id,variant_id,serial_number"
            )
            .eq("company_id", companyId),

          supabase
            .from("warehouses")
            .select("id,name")
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("service_job_items")
            .select(
              `
                id,
                service_job_id,
                product_id,
                variant_id,
                serialized_unit_id,
                quantity,
                quantity_completed,
                quantity_failed,
                quantity_damaged,
                service_description,
                unit_service_cost,
                notes
              `
            )
            .eq(
              "service_job_id",
              jobId
            )
            .eq(
              "company_id",
              companyId
            )
            .order("created_at"),

          supabase
            .from("service_dispatches")
            .select(
              `
                id,
                dispatch_number,
                service_job_id,
                provider_id,
                warehouse_id,
                dispatch_date,
                expected_return_date,
                status,
                notes,
                created_at
              `
            )
            .eq(
              "service_job_id",
              jobId
            )
            .eq(
              "company_id",
              companyId
            )
            .order("dispatch_date", {
              ascending: false,
            }),

          supabase
            .from("service_returns")
            .select(
              `
                id,
                return_number,
                dispatch_id,
                service_job_id,
                provider_id,
                return_date,
                status,
                notes,
                created_at
              `
            )
            .eq(
              "service_job_id",
              jobId
            )
            .eq(
              "company_id",
              companyId
            )
            .order("return_date", {
              ascending: false,
            }),

          supabase
            .from("service_provider_activity")
            .select(
              `
                id,
                action,
                message,
                created_by,
                created_at
              `
            )
            .eq(
              "service_job_id",
              jobId
            )
            .eq(
              "company_id",
              companyId
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(100),
        ]);

        if (providerResult.error) {
          throw new Error(
            `Provider lookup failed: ${providerResult.error.message}`
          );
        }

        if (customerResult.error) {
          throw new Error(
            `Customer lookup failed: ${customerResult.error.message}`
          );
        }

        if (productsResult.error) {
          throw new Error(
            `Products lookup failed: ${productsResult.error.message}`
          );
        }

        if (variantsResult.error) {
          throw new Error(
            `Variants lookup failed: ${variantsResult.error.message}`
          );
        }

        if (serializedResult.error) {
          throw new Error(
            `Serial numbers lookup failed: ${serializedResult.error.message}`
          );
        }

        if (warehousesResult.error) {
          throw new Error(
            `Warehouses lookup failed: ${warehousesResult.error.message}`
          );
        }

        if (jobItemsResult.error) {
          throw new Error(
            `Job items lookup failed: ${jobItemsResult.error.message}`
          );
        }

        if (dispatchesResult.error) {
          throw new Error(
            `Dispatch lookup failed: ${dispatchesResult.error.message}`
          );
        }

        if (returnsResult.error) {
          throw new Error(
            `Returns lookup failed: ${returnsResult.error.message}`
          );
        }

        if (activitiesResult.error) {
          throw new Error(
            `Activity lookup failed: ${activitiesResult.error.message}`
          );
        }

        setProvider(
          (providerResult.data ||
            null) as Provider | null
        );

        setCustomer(
          (customerResult.data ||
            null) as Customer | null
        );

        setProducts(
          (productsResult.data ||
            []) as Product[]
        );

        setVariants(
          (variantsResult.data ||
            []) as ProductVariant[]
        );

        setSerializedUnits(
          (serializedResult.data ||
            []) as SerializedUnit[]
        );

        setWarehouses(
          (warehousesResult.data ||
            []) as Warehouse[]
        );

        const currentJobItems =
          (jobItemsResult.data ||
            []) as JobItem[];

        const currentDispatches =
          (dispatchesResult.data ||
            []) as Dispatch[];

        const currentReturns =
          (returnsResult.data ||
            []) as ServiceReturn[];

        setJobItems(currentJobItems);
        setDispatches(
          currentDispatches
        );
        setReturns(currentReturns);

        /*
         * Load dispatch items separately.
         * This avoids PostgREST relationship
         * embedding issues.
         */
        const dispatchIds =
          currentDispatches.map(
            (dispatch) => dispatch.id
          );

        let currentDispatchItems: DispatchItem[] =
          [];

        if (dispatchIds.length > 0) {
          const {
            data,
            error,
          } = await supabase
            .from("service_dispatch_items")
            .select(
              `
                id,
                dispatch_id,
                service_job_item_id,
                product_id,
                variant_id,
                serialized_unit_id,
                quantity,
                notes
              `
            )
            .eq(
              "company_id",
              companyId
            )
            .in(
              "dispatch_id",
              dispatchIds
            );

          if (error) {
            throw new Error(
              `Dispatch items lookup failed: ${error.message}`
            );
          }

          currentDispatchItems =
            (data || []) as DispatchItem[];
        }

        setDispatchItems(
          currentDispatchItems
        );

        /*
         * Load return items separately.
         */
        const returnIds =
          currentReturns.map(
            (serviceReturn) =>
              serviceReturn.id
          );

        let currentReturnItems: ReturnItem[] =
          [];

        if (returnIds.length > 0) {
          const {
            data,
            error,
          } = await supabase
            .from("service_return_items")
            .select(
              `
                id,
                service_return_id,
                dispatch_item_id,
                product_id,
                variant_id,
                serialized_unit_id,
                quantity,
                result,
                work_performed,
                failure_reason,
                condition_received,
                service_cost,
                notes
              `
            )
            .eq(
              "company_id",
              companyId
            )
            .in(
              "service_return_id",
              returnIds
            );

          if (error) {
            throw new Error(
              `Return items lookup failed: ${error.message}`
            );
          }

          currentReturnItems =
            (data || []) as ReturnItem[];
        }

        setReturnItems(
          currentReturnItems
        );

        setActivities(
          (activitiesResult.data ||
            []) as Activity[]
        );
      } catch (error) {
        console.error(
          "SERVICE JOB DETAIL LOAD ERROR:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load service job."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [jobId, router, supabase]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const productMap = useMemo(() => {
    return new Map(
      products.map((product) => [
        product.id,
        product,
      ])
    );
  }, [products]);

  const variantMap = useMemo(() => {
    return new Map(
      variants.map((variant) => [
        variant.id,
        variant,
      ])
    );
  }, [variants]);

  const serialMap = useMemo(() => {
    return new Map(
      serializedUnits.map((unit) => [
        unit.id,
        unit,
      ])
    );
  }, [serializedUnits]);

  const warehouseMap = useMemo(() => {
    return new Map(
      warehouses.map((warehouse) => [
        warehouse.id,
        warehouse,
      ])
    );
  }, [warehouses]);

  const dispatchQuantityByJobItem =
    useMemo(() => {
      const map = new Map<string, number>();

      for (const item of dispatchItems) {
        if (!item.service_job_item_id) {
          continue;
        }

        map.set(
          item.service_job_item_id,
          (map.get(
            item.service_job_item_id
          ) || 0) + Number(item.quantity || 0)
        );
      }

      return map;
    }, [dispatchItems]);

  const returnedQuantityByDispatchItem =
    useMemo(() => {
      const map = new Map<string, number>();

      for (const item of returnItems) {
        if (!item.dispatch_item_id) {
          continue;
        }

        map.set(
          item.dispatch_item_id,
          (map.get(
            item.dispatch_item_id
          ) || 0) + Number(item.quantity || 0)
        );
      }

      return map;
    }, [returnItems]);

  const returnedQuantityByJobItem =
    useMemo(() => {
      const map = new Map<string, number>();

      for (const dispatchItem of dispatchItems) {
        if (!dispatchItem.service_job_item_id) {
          continue;
        }

        const returned =
          returnedQuantityByDispatchItem.get(
            dispatchItem.id
          ) || 0;

        map.set(
          dispatchItem.service_job_item_id,
          (map.get(
            dispatchItem.service_job_item_id
          ) || 0) + returned
        );
      }

      return map;
    }, [
      dispatchItems,
      returnedQuantityByDispatchItem,
    ]);

  const itemSummaries = useMemo<ItemSummary[]>(
    () => {
      return jobItems.map((item) => {
        const product =
          productMap.get(item.product_id);

        const variant = item.variant_id
          ? variantMap.get(item.variant_id)
          : null;

        const serial =
          item.serialized_unit_id
            ? serialMap.get(
                item.serialized_unit_id
              )
            : null;

        const dispatched =
          dispatchQuantityByJobItem.get(
            item.id
          ) || 0;

        const returned =
          returnedQuantityByJobItem.get(
            item.id
          ) || 0;

        return {
          ...item,
          productName:
            product?.name ||
            "Unknown product",
          variantName:
            variant?.name || null,
          variantSku:
            variant?.sku || null,
          serialNumber:
            serial?.serial_number || null,
          dispatched,
          returned,
          withProvider: Math.max(
            dispatched - returned,
            0
          ),
        };
      });
    },
    [
      jobItems,
      productMap,
      variantMap,
      serialMap,
      dispatchQuantityByJobItem,
      returnedQuantityByJobItem,
    ]
  );

  const totalRequired = useMemo(() => {
    return itemSummaries.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    );
  }, [itemSummaries]);

  const totalDispatched = useMemo(() => {
    return itemSummaries.reduce(
      (sum, item) =>
        sum + Number(item.dispatched || 0),
      0
    );
  }, [itemSummaries]);

  const totalReturned = useMemo(() => {
    return itemSummaries.reduce(
      (sum, item) =>
        sum + Number(item.returned || 0),
      0
    );
  }, [itemSummaries]);

  const totalWithProvider = useMemo(() => {
    return itemSummaries.reduce(
      (sum, item) =>
        sum +
        Number(item.withProvider || 0),
      0
    );
  }, [itemSummaries]);

  const totalCompleted = useMemo(() => {
    return itemSummaries.reduce(
      (sum, item) =>
        sum +
        Number(
          item.quantity_completed || 0
        ),
      0
    );
  }, [itemSummaries]);

  const totalFailedDamaged = useMemo(() => {
    return itemSummaries.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity_failed || 0) +
        Number(item.quantity_damaged || 0),
      0
    );
  }, [itemSummaries]);

  const totalPending =
    Math.max(
      totalRequired - totalReturned,
      0
    );

  const returnServiceCost = useMemo(() => {
    return returnItems.reduce(
      (sum, item) =>
        sum +
        Number(item.service_cost || 0),
      0
    );
  }, [returnItems]);

  const canDispatch =
    !!job &&
    job.status !== "completed" &&
    job.status !== "cancelled" &&
    totalPending > 0;

  const canReceive =
    !!job &&
    job.status !== "completed" &&
    job.status !== "cancelled" &&
    totalWithProvider > 0;

  const canComplete =
    !!job &&
    job.status !== "completed" &&
    job.status !== "cancelled" &&
    totalRequired > 0 &&
    totalWithProvider === 0 &&
    totalDispatched > 0;

  const getDispatchWarehouseName = (
    warehouseId: string | null
  ) => {
    if (!warehouseId) {
      return "—";
    }

    return (
      warehouseMap.get(warehouseId)
        ?.name || "Unknown warehouse"
    );
  };

  const handleMarkCompleted =
    async () => {
      if (!job) return;

      if (!canComplete) {
        setErrorMessage(
          "The service job can only be completed after all dispatched stock has been returned."
        );
        return;
      }

      const confirmed = window.confirm(
        "Mark this service job as completed?"
      );

      if (!confirmed) {
        return;
      }

      setActionLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const actualCost =
          returnServiceCost > 0
            ? returnServiceCost
            : Number(
                job.actual_cost || 0
              );

        const {
          error: updateError,
        } = await supabase
          .from("service_jobs")
          .update({
            status: "completed",
            completed_date:
              new Date().toISOString(),
            actual_cost: actualCost,
          })
          .eq("id", job.id)
          .eq(
            "company_id",
            job.company_id
          );

        if (updateError) {
          throw new Error(
            `Unable to complete service job: ${updateError.message}`
          );
        }

        await supabase
          .from("service_provider_activity")
          .insert({
            company_id:
              job.company_id,
            provider_id:
              job.provider_id,
            service_job_id:
              job.id,
            action:
              "job_completed",
            message: `Service job ${job.job_number} marked as completed.`,
            created_by: user.id,
          });

        await loadData(true);
      } catch (error) {
        console.error(
          "COMPLETE SERVICE JOB ERROR:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to complete service job."
        );
      } finally {
        setActionLoading(false);
      }
    };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>
              Loading service job...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="page-header">
            <Link
              href="/service-jobs"
              className="back-link"
            >
              ← Service Jobs
            </Link>

            <h1>Service Job</h1>
          </div>

          <div className="content-card">
            <div className="empty-state">
              <div className="empty-icon">
                !
              </div>

              <h3>
                Service job not found
              </h3>

              <p>
                {errorMessage ||
                  "The requested service job could not be found."}
              </p>

              <Link
                href="/service-jobs"
                className="primary-button"
              >
                Back to Service Jobs
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content">
        <div className="page-header">
          <div>
            <Link
              href="/service-jobs"
              className="back-link"
            >
              ← Service Jobs
            </Link>

            <div className="title-row">
              <div>
                <div className="eyebrow">
                  Service Job
                </div>

                <h1>
                  {job.job_number}
                </h1>

                <p className="page-description">
                  {job.service_type}
                  {" · "}
                  {provider?.name ||
                    "Unknown provider"}
                </p>
              </div>

              <div className="header-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    loadData(true)
                  }
                  disabled={
                    refreshing ||
                    actionLoading
                  }
                >
                  {refreshing
                    ? "Refreshing..."
                    : "Refresh"}
                </button>

                <Link
                  href={`/service-jobs/${job.id}/edit`}
                  className="secondary-button"
                >
                  Edit Job
                </Link>

                {canDispatch && (
                  <Link
                    href={`/service-jobs/${job.id}/dispatch`}
                    className="primary-button"
                  >
                    Dispatch Stock
                  </Link>
                )}

                {canReceive && (
                  <Link
                    href={`/service-jobs/${job.id}/returns`}
                    className="secondary-button"
                  >
                    Receive Return
                  </Link>
                )}

                {canComplete && (
                  <button
                    type="button"
                    className="success-button"
                    onClick={
                      handleMarkCompleted
                    }
                    disabled={
                      actionLoading
                    }
                  >
                    {actionLoading
                      ? "Completing..."
                      : "Mark Completed"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            <strong>
              Unable to continue
            </strong>

            <span>
              {errorMessage}
            </span>
          </div>
        )}

        <div className="status-banner">
          <div className="status-banner-left">
            <span
              className={`status-badge status-${job.status}`}
            >
              {statusLabel(job.status)}
            </span>

            <span
              className={`priority-badge priority-${job.priority}`}
            >
              {priorityLabel(
                job.priority
              )}
            </span>

            <span className="source-text">
              Source:{" "}
              {statusLabel(job.source)}
            </span>
          </div>

          <div className="status-banner-right">
            <span>
              Created{" "}
              {formatDateTime(
                job.created_at
              )}
            </span>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Items Required
            </div>

            <div className="stat-value">
              {totalRequired}
            </div>

            <div className="stat-subtext">
              Across {jobItems.length} line
              {jobItems.length === 1
                ? ""
                : "s"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Dispatched
            </div>

            <div className="stat-value">
              {totalDispatched}
            </div>

            <div className="stat-subtext">
              Stock sent to provider
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              With Provider
            </div>

            <div className="stat-value">
              {totalWithProvider}
            </div>

            <div className="stat-subtext">
              Currently outside warehouse
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Returned
            </div>

            <div className="stat-value">
              {totalReturned}
            </div>

            <div className="stat-subtext">
              Stock received back
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Completed
            </div>

            <div className="stat-value">
              {totalCompleted}
            </div>

            <div className="stat-subtext">
              Successfully serviced
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Failed / Damaged
            </div>

            <div className="stat-value">
              {totalFailedDamaged}
            </div>

            <div className="stat-subtext">
              Unsuccessful outcomes
            </div>
          </div>
        </div>

        <div className="two-column-grid">
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Job Details</h2>
                <p>
                  Core service job information.
                </p>
              </div>
            </div>

            <div className="details-grid">
              <div className="detail-item">
                <span>
                  Service Provider
                </span>

                <strong>
                  {provider?.name ||
                    "—"}
                </strong>

                {provider?.company_name && (
                  <small>
                    {
                      provider.company_name
                    }
                  </small>
                )}
              </div>

              <div className="detail-item">
                <span>
                  Provider Number
                </span>

                <strong>
                  {provider?.provider_number ||
                    "—"}
                </strong>
              </div>

              <div className="detail-item">
                <span>
                  Customer
                </span>

                <strong>
                  {customer?.name ||
                    "Internal / No customer"}
                </strong>
              </div>

              <div className="detail-item">
                <span>
                  Service Type
                </span>

                <strong>
                  {job.service_type}
                </strong>
              </div>

              <div className="detail-item">
                <span>
                  Priority
                </span>

                <strong>
                  {priorityLabel(
                    job.priority
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>
                  Expected Return
                </span>

                <strong>
                  {formatDate(
                    job.expected_return_date
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>
                  Dispatched Date
                </span>

                <strong>
                  {formatDate(
                    job.dispatched_date
                  )}
                </strong>
              </div>

              <div className="detail-item">
                <span>
                  Completed Date
                </span>

                <strong>
                  {formatDate(
                    job.completed_date
                  )}
                </strong>
              </div>
            </div>
          </div>

          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Cost Summary</h2>
                <p>
                  Estimated and actual provider
                  service costs.
                </p>
              </div>
            </div>

            <div className="cost-summary">
              <div className="cost-row">
                <span>
                  Estimated Cost
                </span>

                <strong>
                  {formatMoney(
                    Number(
                      job.estimated_cost ||
                        0
                    )
                  )}
                </strong>
              </div>

              <div className="cost-row">
                <span>
                  Recorded Return Costs
                </span>

                <strong>
                  {formatMoney(
                    returnServiceCost
                  )}
                </strong>
              </div>

              <div className="cost-divider" />

              <div className="cost-row total">
                <span>
                  Actual Cost
                </span>

                <strong>
                  {formatMoney(
                    Number(
                      job.actual_cost ||
                        0
                    )
                  )}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h2>Stock Custody</h2>

              <p>
                Track every item required,
                dispatched, returned and still
                held by the service provider.
              </p>
            </div>

            {canDispatch && (
              <Link
                href={`/service-jobs/${job.id}/dispatch`}
                className="primary-button"
              >
                Dispatch Stock
              </Link>
            )}
          </div>

          {itemSummaries.length === 0 ? (
            <div className="empty-inline">
              No stock items have been added to
              this service job.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Serial Number</th>
                    <th>Required</th>
                    <th>Dispatched</th>
                    <th>Returned</th>
                    <th>With Provider</th>
                    <th>Completed</th>
                    <th>Failed / Damaged</th>
                  </tr>
                </thead>

                <tbody>
                  {itemSummaries.map(
                    (item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="product-cell">
                            <strong>
                              {
                                item.productName
                              }
                            </strong>

                            {item.service_description && (
                              <small>
                                {
                                  item.service_description
                                }
                              </small>
                            )}
                          </div>
                        </td>

                        <td>
                          <div>
                            {
                              item.variantName ||
                              "—"
                            }

                            {item.variantSku && (
                              <small className="muted-block">
                                SKU:{" "}
                                {
                                  item.variantSku
                                }
                              </small>
                            )}
                          </div>
                        </td>

                        <td>
                          {item.serialNumber ? (
                            <span className="serial-badge">
                              {
                                item.serialNumber
                              }
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>
                          <strong>
                            {item.quantity}
                          </strong>
                        </td>

                        <td>
                          {item.dispatched}
                        </td>

                        <td>
                          {item.returned}
                        </td>

                        <td>
                          <span
                            className={
                              item.withProvider >
                              0
                                ? "number-warning"
                                : "number-success"
                            }
                          >
                            {
                              item.withProvider
                            }
                          </span>
                        </td>

                        <td>
                          <span className="number-success">
                            {
                              item.quantity_completed
                            }
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              Number(
                                item.quantity_failed ||
                                  0
                              ) +
                                Number(
                                  item.quantity_damaged ||
                                    0
                                ) >
                              0
                                ? "number-danger"
                                : "muted"
                            }
                          >
                            {Number(
                              item.quantity_failed ||
                                0
                            ) +
                              Number(
                                item.quantity_damaged ||
                                  0
                              )}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h2>Dispatch History</h2>

              <p>
                Stock movements sent to the
                service provider.
              </p>
            </div>

            {canDispatch && (
              <Link
                href={`/service-jobs/${job.id}/dispatch`}
                className="secondary-button"
              >
                New Dispatch
              </Link>
            )}
          </div>

          {dispatches.length === 0 ? (
            <div className="empty-inline">
              No stock has been dispatched yet.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Dispatch</th>
                    <th>Date</th>
                    <th>Warehouse</th>
                    <th>Items</th>
                    <th>Expected Return</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {dispatches.map(
                    (dispatch) => {
                      const itemsForDispatch =
                        dispatchItems.filter(
                          (item) =>
                            item.dispatch_id ===
                            dispatch.id
                        );

                      const quantity =
                        itemsForDispatch.reduce(
                          (
                            sum,
                            item
                          ) =>
                            sum +
                            Number(
                              item.quantity ||
                                0
                            ),
                          0
                        );

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
                            {formatDate(
                              dispatch.dispatch_date
                            )}
                          </td>

                          <td>
                            {getDispatchWarehouseName(
                              dispatch.warehouse_id
                            )}
                          </td>

                          <td>
                            {quantity}
                          </td>

                          <td>
                            {formatDate(
                              dispatch.expected_return_date
                            )}
                          </td>

                          <td>
                            <span
                              className={`status-badge status-${dispatch.status}`}
                            >
                              {statusLabel(
                                dispatch.status
                              )}
                            </span>
                          </td>

                          <td>
                            {dispatch.notes ||
                              "—"}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h2>Return History</h2>

              <p>
                Stock received back from the
                service provider and its result.
              </p>
            </div>

            {canReceive && (
              <Link
                href={`/service-jobs/${job.id}/returns`}
                className="primary-button"
              >
                Receive Return
              </Link>
            )}
          </div>

          {returns.length === 0 ? (
            <div className="empty-inline">
              No provider returns have been
              recorded yet.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Return</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Completed</th>
                    <th>Not Repaired</th>
                    <th>Damaged</th>
                    <th>Scrapped</th>
                    <th>Service Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {returns.map(
                    (serviceReturn) => {
                      const itemsForReturn =
                        returnItems.filter(
                          (item) =>
                            item.service_return_id ===
                            serviceReturn.id
                        );

                      const total =
                        itemsForReturn.reduce(
                          (
                            sum,
                            item
                          ) =>
                            sum +
                            Number(
                              item.quantity ||
                                0
                            ),
                          0
                        );

                      const completed =
                        itemsForReturn
                          .filter(
                            (item) =>
                              item.result ===
                              "completed"
                          )
                          .reduce(
                            (
                              sum,
                              item
                            ) =>
                              sum +
                              Number(
                                item.quantity ||
                                  0
                              ),
                            0
                          );

                      const notRepaired =
                        itemsForReturn
                          .filter(
                            (item) =>
                              item.result ===
                              "not_repaired"
                          )
                          .reduce(
                            (
                              sum,
                              item
                            ) =>
                              sum +
                              Number(
                                item.quantity ||
                                  0
                              ),
                            0
                          );

                      const damaged =
                        itemsForReturn
                          .filter(
                            (item) =>
                              item.result ===
                              "damaged"
                          )
                          .reduce(
                            (
                              sum,
                              item
                            ) =>
                              sum +
                              Number(
                                item.quantity ||
                                  0
                              ),
                            0
                          );

                      const scrapped =
                        itemsForReturn
                          .filter(
                            (item) =>
                              item.result ===
                              "scrapped"
                          )
                          .reduce(
                            (
                              sum,
                              item
                            ) =>
                              sum +
                              Number(
                                item.quantity ||
                                  0
                              ),
                            0
                          );

                      const cost =
                        itemsForReturn.reduce(
                          (
                            sum,
                            item
                          ) =>
                            sum +
                            Number(
                              item.service_cost ||
                                0
                            ),
                          0
                        );

                      return (
                        <tr
                          key={
                            serviceReturn.id
                          }
                        >
                          <td>
                            <strong>
                              {
                                serviceReturn.return_number
                              }
                            </strong>
                          </td>

                          <td>
                            {formatDate(
                              serviceReturn.return_date
                            )}
                          </td>

                          <td>
                            {total}
                          </td>

                          <td>
                            <span className="number-success">
                              {
                                completed
                              }
                            </span>
                          </td>

                          <td>
                            {
                              notRepaired
                            }
                          </td>

                          <td>
                            <span
                              className={
                                damaged >
                                0
                                  ? "number-danger"
                                  : "muted"
                              }
                            >
                              {damaged}
                            </span>
                          </td>

                          <td>
                            <span
                              className={
                                scrapped >
                                0
                                  ? "number-danger"
                                  : "muted"
                              }
                            >
                              {scrapped}
                            </span>
                          </td>

                          <td>
                            {formatMoney(
                              cost
                            )}
                          </td>

                          <td>
                            <span
                              className={`status-badge status-${serviceReturn.status}`}
                            >
                              {statusLabel(
                                serviceReturn.status
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="two-column-grid">
          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Provider Instructions</h2>

                <p>
                  Notes shared for the service
                  work.
                </p>
              </div>
            </div>

            <div className="notes-content">
              {job.notes ? (
                <p>
                  {job.notes}
                </p>
              ) : (
                <div className="empty-inline">
                  No provider instructions have
                  been added.
                </div>
              )}
            </div>
          </div>

          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>Internal Notes</h2>

                <p>
                  Internal information for your
                  team.
                </p>
              </div>
            </div>

            <div className="notes-content">
              {job.internal_notes ? (
                <p>
                  {job.internal_notes}
                </p>
              ) : (
                <div className="empty-inline">
                  No internal notes have been
                  added.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h2>Activity</h2>

              <p>
                History of actions performed on
                this service job.
              </p>
            </div>
          </div>

          {activities.length === 0 ? (
            <div className="empty-inline">
              No activity has been recorded yet.
            </div>
          ) : (
            <div className="activity-list">
              {activities.map(
                (activity) => (
                  <div
                    className="activity-item"
                    key={activity.id}
                  >
                    <div className="activity-dot" />

                    <div className="activity-content">
                      <div className="activity-top">
                        <strong>
                          {statusLabel(
                            activity.action
                          )}
                        </strong>

                        <span>
                          {formatDateTime(
                            activity.created_at
                          )}
                        </span>
                      </div>

                      <p>
                        {
                          activity.message
                        }
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 20px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          color: #6b7280;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .back-link:hover {
          color: #111827;
        }

        .title-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }

        .eyebrow {
          color: #6b7280;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 700;
        }

        .page-description {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex-wrap: wrap;
        }

        .status-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
        }

        .status-banner-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .status-banner-right {
          color: #9ca3af;
          font-size: 12px;
        }

        .source-text {
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 1px 2px
            rgba(0, 0, 0, 0.03);
          min-width: 0;
        }

        .stat-label {
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-value {
          color: #111827;
          font-size: 25px;
          line-height: 1.1;
          font-weight: 700;
        }

        .stat-subtext {
          color: #9ca3af;
          font-size: 11px;
          margin-top: 7px;
          line-height: 1.4;
        }

        .two-column-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 18px;
        }

        .content-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px
            rgba(0, 0, 0, 0.03);
          overflow: hidden;
          margin-bottom: 18px;
        }

        .two-column-grid .content-card {
          margin-bottom: 0;
        }

        .content-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .content-card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .content-card-header p {
          margin: 4px 0 0;
          color: #9ca3af;
          font-size: 12px;
          line-height: 1.45;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
        }

        .detail-item {
          padding: 16px 20px;
          border-bottom: 1px solid #f3f4f6;
          min-width: 0;
        }

        .detail-item:nth-last-child(-n + 2) {
          border-bottom: 0;
        }

        .detail-item span {
          display: block;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 5px;
        }

        .detail-item strong {
          display: block;
          color: #111827;
          font-size: 13px;
          font-weight: 600;
          overflow-wrap: anywhere;
        }

        .detail-item small {
          display: block;
          color: #9ca3af;
          font-size: 11px;
          margin-top: 3px;
        }

        .cost-summary {
          padding: 8px 20px 16px;
        }

        .cost-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 0;
          color: #6b7280;
          font-size: 13px;
        }

        .cost-row strong {
          color: #111827;
          font-size: 13px;
        }

        .cost-row.total {
          padding-top: 16px;
          color: #111827;
          font-weight: 700;
        }

        .cost-row.total strong {
          font-size: 17px;
        }

        .cost-divider {
          height: 1px;
          background: #e5e7eb;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 980px;
        }

        th {
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-align: left;
          white-space: nowrap;
        }

        td {
          padding: 14px 16px;
          border-bottom: 1px solid #f3f4f6;
          color: #374151;
          font-size: 12px;
          vertical-align: middle;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .product-cell {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 190px;
        }

        .product-cell strong {
          color: #111827;
          font-size: 12px;
        }

        .product-cell small {
          color: #9ca3af;
          font-size: 11px;
          max-width: 250px;
        }

        .muted-block {
          display: block;
          color: #9ca3af;
          font-size: 10px;
          margin-top: 3px;
        }

        .serial-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border-radius: 6px;
          background: #f3f4f6;
          color: #374151;
          font-family: monospace;
          font-size: 11px;
          white-space: nowrap;
        }

        .number-success {
          color: #15803d;
          font-weight: 700;
        }

        .number-warning {
          color: #b45309;
          font-weight: 700;
        }

        .number-danger {
          color: #dc2626;
          font-weight: 700;
        }

        .muted {
          color: #9ca3af;
        }

        .notes-content {
          padding: 18px 20px;
        }

        .notes-content p {
          margin: 0;
          color: #374151;
          font-size: 13px;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        .empty-inline {
          padding: 26px 20px;
          color: #9ca3af;
          font-size: 13px;
          text-align: center;
        }

        .activity-list {
          padding: 6px 20px 14px;
        }

        .activity-item {
          display: flex;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .activity-item:last-child {
          border-bottom: 0;
        }

        .activity-dot {
          width: 8px;
          height: 8px;
          margin-top: 5px;
          border-radius: 50%;
          background: #9ca3af;
          flex: 0 0 auto;
        }

        .activity-content {
          min-width: 0;
          flex: 1;
        }

        .activity-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .activity-top strong {
          color: #111827;
          font-size: 12px;
        }

        .activity-top span {
          color: #9ca3af;
          font-size: 11px;
          white-space: nowrap;
        }

        .activity-content p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.5;
        }

        .status-badge,
        .priority-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          line-height: 1;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-draft {
          background: #f3f4f6;
          color: #4b5563;
        }

        .status-open {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-in_progress {
          background: #fef3c7;
          color: #92400e;
        }

        .status-awaiting_return {
          background: #fff7ed;
          color: #c2410c;
        }

        .status-partially_returned {
          background: #fef3c7;
          color: #a16207;
        }

        .status-completed {
          background: #ecfdf5;
          color: #047857;
        }

        .status-cancelled {
          background: #fef2f2;
          color: #b91c1c;
        }

        .status-dispatched {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-returned {
          background: #ecfdf5;
          color: #047857;
        }

        .status-received {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-inspected {
          background: #fef3c7;
          color: #92400e;
        }

        .status-low {
          background: #f3f4f6;
          color: #4b5563;
        }

        .priority-normal {
          background: #f3f4f6;
          color: #4b5563;
        }

        .priority-high {
          background: #fff7ed;
          color: #c2410c;
        }

        .priority-urgent {
          background: #fef2f2;
          color: #b91c1c;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px 15px;
          margin-bottom: 18px;
          border-radius: 10px;
          font-size: 13px;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .alert-error span {
          white-space: pre-wrap;
        }

        .primary-button,
        .secondary-button,
        .success-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 13px;
          border-radius: 8px;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            opacity 0.15s ease;
          white-space: nowrap;
        }

        .primary-button {
          background: #111827;
          border: 1px solid #111827;
          color: #ffffff;
        }

        .primary-button:hover {
          background: #1f2937;
        }

        .secondary-button {
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #374151;
        }

        .secondary-button:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .success-button {
          background: #15803d;
          border: 1px solid #15803d;
          color: #ffffff;
        }

        .success-button:hover {
          background: #166534;
        }

        .primary-button:disabled,
        .secondary-button:disabled,
        .success-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .loading-state {
          min-height: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          gap: 12px;
          font-size: 13px;
        }

        .loading-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid #e5e7eb;
          border-top-color: #111827;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .empty-state {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
        }

        .empty-icon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fef2f2;
          color: #dc2626;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 14px;
        }

        .empty-state h3 {
          margin: 0;
          color: #111827;
          font-size: 16px;
        }

        .empty-state p {
          max-width: 520px;
          margin: 7px 0 18px;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1250px) {
          .stats-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }
        }

        @media (max-width: 900px) {
          .page-content {
            padding: 20px;
          }

          .title-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .header-actions {
            justify-content: flex-start;
          }

          .two-column-grid {
            grid-template-columns: 1fr;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .detail-item:nth-last-child(-n + 2) {
            border-bottom: 1px solid #f3f4f6;
          }

          .detail-item:last-child {
            border-bottom: 0;
          }
        }

        @media (max-width: 640px) {
          .page-content {
            padding: 16px;
          }

          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .status-banner {
            align-items: flex-start;
            flex-direction: column;
          }

          .status-banner-right {
            width: 100%;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions a,
          .header-actions button {
            flex: 1;
          }

          .content-card-header {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>
    </AppShell>
  );
}