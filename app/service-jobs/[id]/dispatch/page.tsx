"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  company_id: string;
  job_number: string;
  provider_id: string;
  service_type: string;
  status: string;
  priority: string;
  expected_return_date: string | null;
};

type Provider = {
  id: string;
  name: string;
  company_name: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
};

type Product = {
  id: string;
  name: string;
  track_inventory: boolean;
  tracking_mode: string;
};

type Variant = {
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
  barcode: string | null;
  status: string;
  warehouse_id: string | null;
  location_id: string | null;
};

type JobItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
  quantity_completed: number;
  quantity_failed: number;
  quantity_damaged: number;
  service_description: string | null;
  notes: string | null;
};

type DispatchRow = {
  jobItem: JobItem;
  product: Product | null;
  variant: Variant | null;
  alreadyDispatched: number;
  remaining: number;
  quantity: number;
  serialIds: string[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function todayString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export default function DispatchServiceJobPage() {
  const params = useParams();
  const router = useRouter();

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [serializedUnits, setSerializedUnits] = useState<
    SerializedUnit[]
  >([]);

  const [rows, setRows] = useState<DispatchRow[]>([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");

  const [dispatchDate, setDispatchDate] = useState(todayString());
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  const [serialSearch, setSerialSearch] = useState<Record<string, string>>(
    {},
  );

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      if (!membership?.company_id) {
        throw new Error("No company membership was found.");
      }

      const currentCompanyId = membership.company_id as string;
      setCompanyId(currentCompanyId);

      const { data: jobData, error: jobError } = await supabase
        .from("service_jobs")
        .select(
          `
            id,
            company_id,
            job_number,
            provider_id,
            service_type,
            status,
            priority,
            expected_return_date
          `,
        )
        .eq("id", id)
        .eq("company_id", currentCompanyId)
        .maybeSingle();

      if (jobError) {
        throw new Error(jobError.message);
      }

      if (!jobData) {
        throw new Error("Service job not found.");
      }

      setJob(jobData as Job);

      if (
        jobData.status === "completed" ||
        jobData.status === "cancelled"
      ) {
        throw new Error(
          "This service job cannot receive another dispatch.",
        );
      }

      const [
        providerResult,
        warehouseResult,
        locationResult,
        itemResult,
      ] = await Promise.all([
        supabase
          .from("service_providers")
          .select("id,name,company_name")
          .eq("id", jobData.provider_id)
          .eq("company_id", currentCompanyId)
          .maybeSingle(),

        supabase
          .from("warehouses")
          .select("id,name,code")
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("is_default", { ascending: false })
          .order("name"),

        supabase
          .from("warehouse_locations")
          .select("id,warehouse_id,name,code")
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("service_job_items")
          .select(
            `
              id,
              product_id,
              variant_id,
              serialized_unit_id,
              quantity,
              quantity_completed,
              quantity_failed,
              quantity_damaged,
              service_description,
              notes
            `,
          )
          .eq("company_id", currentCompanyId)
          .eq("service_job_id", id)
          .order("created_at"),
      ]);

      if (providerResult.error) {
        throw new Error(providerResult.error.message);
      }

      if (warehouseResult.error) {
        throw new Error(warehouseResult.error.message);
      }

      if (locationResult.error) {
        throw new Error(locationResult.error.message);
      }

      if (itemResult.error) {
        throw new Error(itemResult.error.message);
      }

      const providerData = providerResult.data as Provider | null;

      setProvider(providerData);
      setWarehouses((warehouseResult.data ?? []) as Warehouse[]);
      setLocations((locationResult.data ?? []) as Location[]);

      const jobItems = (itemResult.data ?? []) as JobItem[];

      if (jobItems.length === 0) {
        throw new Error(
          "This service job does not contain any items to dispatch.",
        );
      }

      const productIds = Array.from(
        new Set(jobItems.map((item) => item.product_id)),
      );

      const variantIds = Array.from(
        new Set(
          jobItems
            .map((item) => item.variant_id)
            .filter(Boolean) as string[],
        ),
      );

      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("id,name,track_inventory,tracking_mode")
        .eq("company_id", currentCompanyId)
        .in("id", productIds);

      if (productError) {
        throw new Error(productError.message);
      }

      let variantData: Variant[] = [];

      if (variantIds.length > 0) {
        const { data, error } = await supabase
          .from("product_variants")
          .select("id,product_id,name,sku")
          .eq("company_id", currentCompanyId)
          .in("id", variantIds);

        if (error) {
          throw new Error(error.message);
        }

        variantData = (data ?? []) as Variant[];
      }

      setProducts((productData ?? []) as Product[]);
      setVariants(variantData);

      const dispatchedMap = new Map<string, number>();

      const { data: dispatchItems, error: dispatchError } = await supabase
        .from("service_dispatch_items")
        .select(
          `
            service_job_item_id,
            quantity,
            dispatch_id
          `,
        )
        .eq("company_id", currentCompanyId);

      if (dispatchError) {
        throw new Error(dispatchError.message);
      }

      const dispatchIds = Array.from(
        new Set(
          (dispatchItems ?? [])
            .map((item) => item.dispatch_id)
            .filter(Boolean),
        ),
      );

      let activeDispatchIds = new Set<string>();

      if (dispatchIds.length > 0) {
        const { data: dispatches, error } = await supabase
          .from("service_dispatches")
          .select("id,status")
          .eq("company_id", currentCompanyId)
          .eq("service_job_id", id)
          .in("id", dispatchIds);

        if (error) {
          throw new Error(error.message);
        }

        activeDispatchIds = new Set(
          (dispatches ?? [])
            .filter((dispatch) => dispatch.status !== "cancelled")
            .map((dispatch) => dispatch.id),
        );
      }

      for (const item of dispatchItems ?? []) {
        if (
          item.service_job_item_id &&
          activeDispatchIds.has(item.dispatch_id)
        ) {
          const current =
            dispatchedMap.get(item.service_job_item_id) ?? 0;

          dispatchedMap.set(
            item.service_job_item_id,
            current + Number(item.quantity ?? 0),
          );
        }
      }

      const initialRows: DispatchRow[] = jobItems
        .map((jobItem) => {
          const product =
            (productData ?? []).find(
              (p) => p.id === jobItem.product_id,
            ) ?? null;

          const variant =
            variantData.find(
              (v) => v.id === jobItem.variant_id,
            ) ?? null;

          const alreadyDispatched =
            dispatchedMap.get(jobItem.id) ?? 0;

          const remaining = Math.max(
            0,
            Number(jobItem.quantity) - alreadyDispatched,
          );

          return {
            jobItem,
            product,
            variant,
            alreadyDispatched,
            remaining,
            quantity: 0,
            serialIds: [],
          };
        })
        .filter((row) => row.remaining > 0);

      setRows(initialRows);

      if (!warehouseId && warehouseResult.data?.length) {
        const defaultWarehouse =
          warehouseResult.data.find((w: any) => w.is_default) ??
          warehouseResult.data[0];

        setWarehouseId(defaultWarehouse.id);
      }

      if (!expectedReturnDate && jobData.expected_return_date) {
        setExpectedReturnDate(jobData.expected_return_date);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dispatch information.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!warehouseId) {
      setLocationId("");
      return;
    }

    const warehouseLocations = locations.filter(
      (location) => location.warehouse_id === warehouseId,
    );

    if (
      locationId &&
      warehouseLocations.some((location) => location.id === locationId)
    ) {
      return;
    }

    setLocationId(warehouseLocations[0]?.id ?? "");
  }, [warehouseId, locations, locationId]);

  useEffect(() => {
    if (!warehouseId || !locationId) {
      setSerializedUnits([]);
      return;
    }

    const loadSerials = async () => {
      const { data, error } = await supabase
        .from("serialized_units")
        .select(
          `
            id,
            product_id,
            variant_id,
            serial_number,
            barcode,
            status,
            warehouse_id,
            location_id
          `,
        )
        .eq("company_id", companyId)
        .eq("status", "available")
        .eq("warehouse_id", warehouseId)
        .eq("location_id", locationId)
        .order("serial_number");

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSerializedUnits((data ?? []) as SerializedUnit[]);
    };

    if (companyId) {
      void loadSerials();
    }
  }, [companyId, warehouseId, locationId, supabase]);

  const selectedLocation = locations.find(
    (location) => location.id === locationId,
  );

  const selectedWarehouse = warehouses.find(
    (warehouse) => warehouse.id === warehouseId,
  );

  const totalRemaining = rows.reduce(
    (sum, row) => sum + row.remaining,
    0,
  );

  const totalDispatching = rows.reduce(
    (sum, row) => sum + row.quantity,
    0,
  );

  const selectedRows = rows.filter((row) => row.quantity > 0);

  function updateQuantity(index: number, value: string) {
    const parsed = Number(value);

    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        if (!Number.isFinite(parsed) || parsed <= 0) {
          return {
            ...row,
            quantity: 0,
            serialIds: [],
          };
        }

        const nextQuantity = Math.min(
          Math.floor(parsed),
          Math.floor(row.remaining),
        );

        return {
          ...row,
          quantity: nextQuantity,
          serialIds:
            row.product?.tracking_mode === "serial"
              ? row.serialIds.slice(0, nextQuantity)
              : [],
        };
      }),
    );
  }

  function toggleSerial(rowIndex: number, serialId: string) {
    setRows((current) =>
      current.map((row, index) => {
        if (index !== rowIndex) return row;

        const exists = row.serialIds.includes(serialId);

        if (exists) {
          const next = row.serialIds.filter((id) => id !== serialId);

          return {
            ...row,
            serialIds: next,
            quantity: next.length,
          };
        }

        if (row.serialIds.length >= row.remaining) {
          return row;
        }

        const next = [...row.serialIds, serialId];

        return {
          ...row,
          serialIds: next,
          quantity: next.length,
        };
      }),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (!companyId || !job) {
      setErrorMessage("Service job information is missing.");
      return;
    }

    if (!warehouseId) {
      setErrorMessage("Please select a warehouse.");
      return;
    }

    if (!locationId) {
      setErrorMessage("Please select a warehouse location.");
      return;
    }

    if (!dispatchDate) {
      setErrorMessage("Dispatch date is required.");
      return;
    }

    if (
      expectedReturnDate &&
      expectedReturnDate < dispatchDate
    ) {
      setErrorMessage(
        "Expected return date cannot be before the dispatch date.",
      );
      return;
    }

    if (selectedRows.length === 0) {
      setErrorMessage(
        "Select at least one item and enter a dispatch quantity.",
      );
      return;
    }

    for (const row of selectedRows) {
      if (row.product?.tracking_mode === "serial") {
        if (row.quantity !== row.serialIds.length) {
          setErrorMessage(
            `Select ${row.quantity} serial number(s) for ${
              row.product.name
            }.`,
          );
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const items = selectedRows.map((row) => ({
        service_job_item_id: row.jobItem.id,
        quantity: row.quantity,
        serialized_unit_ids: row.serialIds,
      }));

      const { data, error } = await supabase.rpc(
        "create_service_dispatch",
        {
          p_company_id: companyId,
          p_service_job_id: job.id,
          p_warehouse_id: warehouseId,
          p_location_id: locationId,
          p_dispatch_date: dispatchDate,
          p_expected_return_date:
            expectedReturnDate || null,
          p_notes: notes.trim() || null,
          p_items: items,
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = Array.isArray(data) ? data[0] : data;

      setSuccessMessage(
        `Dispatch ${result?.dispatch_number ?? ""} created successfully.`,
      );

      setTimeout(() => {
        router.push(`/service-jobs/${job.id}`);
        router.refresh();
      }, 700);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create dispatch.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">Loading dispatch...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link href="/service-jobs">Service Jobs</Link>
              <span>/</span>
              <Link href={`/service-jobs/${id}`}>
                {job?.job_number ?? "Service Job"}
              </Link>
              <span>/</span>
              <span>Dispatch</span>
            </div>

            <h1>Dispatch Stock to Provider</h1>

            <p>
              Send company-owned stock from your warehouse to{" "}
              <strong>
                {provider?.name ?? "the service provider"}
              </strong>
              .
            </p>
          </div>

          <div className="header-actions">
            <Link
              href={`/service-jobs/${id}`}
              className="btn btn-secondary"
            >
              Back to Job
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            <strong>Unable to continue</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <strong>Dispatch created</strong>
            <span>{successMessage}</span>
          </div>
        )}

        <div className="summary-grid">
          <div className="stat-card">
            <div className="stat-label">Service Job</div>
            <div className="stat-value">{job?.job_number}</div>
            <div className="stat-meta">
              {job?.service_type}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Items Remaining</div>
            <div className="stat-value">
              {formatNumber(totalRemaining)}
            </div>
            <div className="stat-meta">
              Still available for dispatch
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">This Dispatch</div>
            <div className="stat-value">
              {formatNumber(totalDispatching)}
            </div>
            <div className="stat-meta">
              {selectedRows.length} selected item
              {selectedRows.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Provider</div>
            <div className="stat-value stat-value-small">
              {provider?.name ?? "—"}
            </div>
            <div className="stat-meta">
              {provider?.company_name ?? "Service provider"}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="content-card">
            <div className="card-header">
              <div>
                <h2>Dispatch Details</h2>
                <p>
                  Select the warehouse location where the stock is
                  currently held.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="warehouse">
                  Warehouse <span>*</span>
                </label>

                <select
                  id="warehouse"
                  value={warehouseId}
                  onChange={(event) =>
                    setWarehouseId(event.target.value)
                  }
                  required
                >
                  <option value="">Select warehouse</option>

                  {warehouses.map((warehouse) => (
                    <option
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="location">
                  Location <span>*</span>
                </label>

                <select
                  id="location"
                  value={locationId}
                  onChange={(event) =>
                    setLocationId(event.target.value)
                  }
                  required
                  disabled={!warehouseId}
                >
                  <option value="">
                    {warehouseId
                      ? "Select location"
                      : "Select warehouse first"}
                  </option>

                  {locations
                    .filter(
                      (location) =>
                        location.warehouse_id === warehouseId,
                    )
                    .map((location) => (
                      <option
                        key={location.id}
                        value={location.id}
                      >
                        {location.name} ({location.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="dispatch-date">
                  Dispatch Date <span>*</span>
                </label>

                <input
                  id="dispatch-date"
                  type="date"
                  value={dispatchDate}
                  onChange={(event) =>
                    setDispatchDate(event.target.value)
                  }
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="return-date">
                  Expected Return Date
                </label>

                <input
                  id="return-date"
                  type="date"
                  value={expectedReturnDate}
                  min={dispatchDate}
                  onChange={(event) =>
                    setExpectedReturnDate(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="selected-source">
              <div>
                <strong>Dispatching from</strong>
                <span>
                  {selectedWarehouse?.name ?? "No warehouse selected"}
                </span>
              </div>

              <div>
                <strong>Location</strong>
                <span>
                  {selectedLocation
                    ? `${selectedLocation.name} (${selectedLocation.code})`
                    : "No location selected"}
                </span>
              </div>

              <div>
                <strong>Destination</strong>
                <span>
                  {provider?.name ?? "Service provider"}
                </span>
              </div>
            </div>
          </div>

          <div className="content-card">
            <div className="card-header">
              <div>
                <h2>Stock to Dispatch</h2>
                <p>
                  Dispatch only the remaining quantity required for
                  this service job.
                </p>
              </div>

              <div className="badge badge-info">
                {selectedRows.length} selected
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✓</div>
                <h3>Nothing left to dispatch</h3>
                <p>
                  All required stock for this service job has already
                  been dispatched.
                </p>
              </div>
            ) : (
              <div className="items-list">
                {rows.map((row, index) => {
                  const isSerial =
                    row.product?.tracking_mode === "serial";

                  const search =
                    serialSearch[row.jobItem.id] ?? "";

                  const matchingSerials = serializedUnits
                    .filter(
                      (serial) =>
                        serial.product_id ===
                        row.jobItem.product_id,
                    )
                    .filter(
                      (serial) =>
                        serial.variant_id ===
                        row.jobItem.variant_id,
                    )
                    .filter((serial) => {
                      if (!search.trim()) return true;

                      const query = search
                        .trim()
                        .toLowerCase();

                      return (
                        serial.serial_number
                          .toLowerCase()
                          .includes(query) ||
                        serial.barcode
                          ?.toLowerCase()
                          .includes(query)
                      );
                    });

                  return (
                    <div
                      key={row.jobItem.id}
                      className="item-row"
                    >
                      <div className="item-main">
                        <div className="item-title">
                          {row.product?.name ??
                            "Unknown product"}
                        </div>

                        <div className="item-meta">
                          {row.variant
                            ? `${row.variant.name}${
                                row.variant.sku
                                  ? ` · ${row.variant.sku}`
                                  : ""
                              }`
                            : "Default variant"}
                        </div>

                        {row.jobItem.service_description && (
                          <div className="item-description">
                            {row.jobItem.service_description}
                          </div>
                        )}
                      </div>

                      <div className="item-number">
                        <span>Required</span>
                        <strong>
                          {formatNumber(row.jobItem.quantity)}
                        </strong>
                      </div>

                      <div className="item-number">
                        <span>Dispatched</span>
                        <strong>
                          {formatNumber(row.alreadyDispatched)}
                        </strong>
                      </div>

                      <div className="item-number remaining">
                        <span>Remaining</span>
                        <strong>
                          {formatNumber(row.remaining)}
                        </strong>
                      </div>

                      <div className="quantity-field">
                        <label htmlFor={`qty-${row.jobItem.id}`}>
                          Dispatch
                        </label>

                        {isSerial ? (
                          <div className="serial-count">
                            {row.serialIds.length} /{" "}
                            {formatNumber(row.remaining)}
                          </div>
                        ) : (
                          <input
                            id={`qty-${row.jobItem.id}`}
                            type="number"
                            min="0"
                            max={Math.floor(row.remaining)}
                            step="1"
                            value={
                              row.quantity === 0
                                ? ""
                                : row.quantity
                            }
                            onChange={(event) =>
                              updateQuantity(
                                index,
                                event.target.value,
                              )
                            }
                            placeholder="0"
                          />
                        )}
                      </div>

                      {isSerial && (
                        <div className="serial-selector">
                          <div className="serial-header">
                            <div>
                              <strong>
                                Select Serial Numbers
                              </strong>

                              <span>
                                Choose the actual units leaving
                                the warehouse.
                              </span>
                            </div>

                            <div className="serial-selected">
                              {row.serialIds.length} selected
                            </div>
                          </div>

                          <div className="serial-search">
                            <input
                              type="text"
                              placeholder="Search serial number or barcode..."
                              value={search}
                              onChange={(event) =>
                                setSerialSearch((current) => ({
                                  ...current,
                                  [row.jobItem.id]:
                                    event.target.value,
                                }))
                              }
                            />
                          </div>

                          {!warehouseId ||
                          !locationId ? (
                            <div className="serial-empty">
                              Select a warehouse and location
                              first.
                            </div>
                          ) : matchingSerials.length === 0 ? (
                            <div className="serial-empty">
                              No available serial numbers were
                              found in this location.
                            </div>
                          ) : (
                            <div className="serial-grid">
                              {matchingSerials.map((serial) => {
                                const selected =
                                  row.serialIds.includes(
                                    serial.id,
                                  );

                                const disabled =
                                  !selected &&
                                  row.serialIds.length >=
                                    row.remaining;

                                return (
                                  <button
                                    type="button"
                                    key={serial.id}
                                    className={`serial-card ${
                                      selected
                                        ? "selected"
                                        : ""
                                    }`}
                                    disabled={disabled}
                                    onClick={() =>
                                      toggleSerial(
                                        index,
                                        serial.id,
                                      )
                                    }
                                  >
                                    <span className="serial-check">
                                      {selected ? "✓" : ""}
                                    </span>

                                    <span className="serial-info">
                                      <strong>
                                        {serial.serial_number}
                                      </strong>

                                      {serial.barcode && (
                                        <small>
                                          {serial.barcode}
                                        </small>
                                      )}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="content-card">
            <div className="card-header">
              <div>
                <h2>Dispatch Notes</h2>
                <p>
                  Optional instructions or information for the
                  provider.
                </p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="notes">Notes</label>

              <textarea
                id="notes"
                rows={5}
                value={notes}
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Example: Repair screen, clean chassis, replace damaged hinge..."
              />
            </div>
          </div>

          <div className="bottom-actions">
            <Link
              href={`/service-jobs/${id}`}
              className="btn btn-secondary"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                submitting ||
                loading ||
                rows.length === 0 ||
                selectedRows.length === 0
              }
            >
              {submitting
                ? "Creating Dispatch..."
                : `Dispatch ${formatNumber(totalDispatching)} Item${
                    totalDispatching === 1 ? "" : "s"
                  }`}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1500px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: #6b7280;
          font-size: 13px;
        }

        .breadcrumb a {
          color: #4f46e5;
          text-decoration: none;
        }

        .page-header h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 700;
          color: #111827;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 18px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .stat-label {
          color: #6b7280;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-value {
          color: #111827;
          font-size: 25px;
          font-weight: 700;
        }

        .stat-value-small {
          font-size: 18px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .stat-meta {
          color: #9ca3af;
          font-size: 12px;
          margin-top: 5px;
        }

        .content-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          margin-bottom: 20px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .card-header {
          padding: 20px 22px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 17px;
          font-weight: 700;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .form-grid {
          padding: 22px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          color: #374151;
          font-size: 13px;
          font-weight: 600;
        }

        .field label span {
          color: #dc2626;
        }

        input,
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          padding: 10px 12px;
          background: #fff;
          color: #111827;
          font-size: 14px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        input:disabled,
        select:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        textarea {
          resize: vertical;
          min-height: 120px;
        }

        .selected-source {
          margin: 0 22px 22px;
          padding: 15px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .selected-source div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .selected-source strong {
          color: #6b7280;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .selected-source span {
          color: #111827;
          font-size: 13px;
          font-weight: 600;
        }

        .items-list {
          padding: 0;
        }

        .item-row {
          padding: 22px;
          border-bottom: 1px solid #e5e7eb;
          display: grid;
          grid-template-columns: minmax(240px, 1.7fr) 110px 110px 110px 120px;
          gap: 18px;
          align-items: center;
        }

        .item-row:last-child {
          border-bottom: 0;
        }

        .item-main {
          min-width: 0;
        }

        .item-title {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .item-meta {
          margin-top: 4px;
          color: #6b7280;
          font-size: 12px;
        }

        .item-description {
          margin-top: 8px;
          color: #4b5563;
          font-size: 12px;
          line-height: 1.5;
        }

        .item-number {
          text-align: center;
        }

        .item-number span {
          display: block;
          color: #9ca3af;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .item-number strong {
          color: #111827;
          font-size: 16px;
        }

        .item-number.remaining strong {
          color: #4f46e5;
        }

        .quantity-field label {
          display: block;
          margin-bottom: 7px;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
        }

        .quantity-field input {
          text-align: center;
        }

        .serial-count {
          border: 1px solid #d1d5db;
          border-radius: 9px;
          padding: 10px;
          text-align: center;
          color: #111827;
          font-size: 13px;
          font-weight: 600;
          background: #f9fafb;
        }

        .serial-selector {
          grid-column: 1 / -1;
          margin-top: 4px;
          padding: 16px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
        }

        .serial-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 12px;
        }

        .serial-header strong {
          display: block;
          color: #111827;
          font-size: 13px;
        }

        .serial-header span {
          display: block;
          color: #6b7280;
          font-size: 12px;
          margin-top: 3px;
        }

        .serial-selected {
          padding: 6px 10px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4338ca;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .serial-search {
          margin-bottom: 12px;
        }

        .serial-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          max-height: 310px;
          overflow-y: auto;
          padding-right: 3px;
        }

        .serial-card {
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          padding: 11px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .serial-card:hover:not(:disabled) {
          border-color: #6366f1;
          background: #fafaff;
        }

        .serial-card.selected {
          border-color: #6366f1;
          background: #eef2ff;
        }

        .serial-card:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .serial-check {
          width: 20px;
          height: 20px;
          min-width: 20px;
          border: 1px solid #c7cbd1;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          background: #fff;
          font-size: 12px;
          font-weight: 700;
        }

        .serial-card.selected .serial-check {
          background: #4f46e5;
          border-color: #4f46e5;
        }

        .serial-info {
          min-width: 0;
        }

        .serial-info strong {
          display: block;
          color: #111827;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .serial-info small {
          display: block;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 10px;
        }

        .serial-empty {
          padding: 18px;
          border: 1px dashed #d1d5db;
          border-radius: 9px;
          color: #6b7280;
          text-align: center;
          font-size: 12px;
          background: #fff;
        }

        .field:has(textarea) {
          padding: 22px;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 15px;
          border-radius: 10px;
          margin-bottom: 20px;
          font-size: 13px;
        }

        .alert strong {
          font-weight: 700;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .alert-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
        }

        .badge-info {
          color: #4338ca;
          background: #eef2ff;
        }

        .bottom-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-bottom: 30px;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #4f46e5;
          border-color: #4f46e5;
          color: #fff;
        }

        .btn-primary:hover:not(:disabled) {
          background: #4338ca;
          border-color: #4338ca;
        }

        .btn-secondary {
          background: #fff;
          border-color: #d1d5db;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #f9fafb;
        }

        .empty-state {
          padding: 55px 25px;
          text-align: center;
        }

        .empty-icon {
          width: 44px;
          height: 44px;
          margin: 0 auto 12px;
          border-radius: 50%;
          background: #ecfdf5;
          color: #059669;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 700;
        }

        .empty-state h3 {
          margin: 0;
          color: #111827;
          font-size: 16px;
        }

        .empty-state p {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .loading-state {
          padding: 60px;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }

        @media (max-width: 1100px) {
          .summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .form-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .item-row {
            grid-template-columns: minmax(220px, 1fr) 100px 100px;
          }

          .quantity-field {
            grid-column: span 1;
          }

          .serial-selector {
            grid-column: 1 / -1;
          }

          .serial-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .page-content {
            padding: 18px;
          }

          .page-header {
            flex-direction: column;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .selected-source {
            grid-template-columns: 1fr;
          }

          .item-row {
            grid-template-columns: 1fr 1fr;
          }

          .item-main {
            grid-column: 1 / -1;
          }

          .serial-grid {
            grid-template-columns: 1fr;
          }

          .bottom-actions {
            flex-direction: column-reverse;
          }

          .bottom-actions .btn {
            width: 100%;
          }
        }
      `}</style>
    </AppShell>
  );
}