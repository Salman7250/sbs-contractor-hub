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

type ServiceJob = {
  id: string;
  company_id: string;
  job_number: string;
  provider_id: string;
  status: string;
  service_type: string;
  priority: string;
  notes: string | null;
  internal_notes: string | null;
  expected_return_date: string | null;
};

type Provider = {
  id: string;
  name: string;
  company_name: string | null;
};

type Dispatch = {
  id: string;
  dispatch_number: string;
  dispatch_date: string;
  expected_return_date: string | null;
  status: string;
  warehouse_id: string | null;
  location_id: string | null;
  notes: string | null;
};

type DispatchItem = {
  id: string;
  dispatch_id: string;
  service_job_item_id: string | null;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
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

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  status: string;
};

type ExistingReturnItem = {
  dispatch_item_id: string | null;
  quantity: number;
  result: string;
};

type ExistingReturn = {
  id: string;
  return_number: string;
  return_date: string;
  status: string;
};

type ReturnLine = {
  dispatchItemId: string;
  productId: string;
  variantId: string | null;
  serializedUnitId: string | null;
  quantity: number;
  result: string;
  workPerformed: string;
  failureReason: string;
  conditionReceived: string;
  serviceCost: number;
  notes: string;
};

const RESULT_OPTIONS = [
  {
    value: "completed",
    label: "Completed",
    description: "Repaired successfully and returned to stock",
  },
  {
    value: "not_repaired",
    label: "Not Repaired",
    description: "Returned without successful repair",
  },
  {
    value: "damaged",
    label: "Damaged",
    description: "Returned physically damaged",
  },
  {
    value: "scrapped",
    label: "Scrapped",
    description: "Written off and removed from inventory",
  },
  {
    value: "pending",
    label: "Pending",
    description: "Returned for further internal processing",
  },
  {
    value: "other",
    label: "Other",
    description: "Another return outcome",
  },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value: number) {
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ServiceJobReturnsPage() {
  const params = useParams();
  const router = useRouter();

  const serviceJobId = String(params?.id ?? "");

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [job, setJob] = useState<ServiceJob | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);

  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [selectedDispatchId, setSelectedDispatchId] = useState("");

  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);
  const [existingReturnItems, setExistingReturnItems] = useState<
    ExistingReturnItem[]
  >([]);
  const [existingReturns, setExistingReturns] = useState<ExistingReturn[]>(
    [],
  );

  const [products, setProducts] = useState<Record<string, Product>>({});
  const [variants, setVariants] = useState<Record<string, Variant>>({});
  const [warehouses, setWarehouses] = useState<Record<string, Warehouse>>({});
  const [locations, setLocations] = useState<Record<string, Location>>({});

  const [serializedUnits, setSerializedUnits] = useState<
    Record<string, SerializedUnit>
  >({});

  const [returnDate, setReturnDate] = useState(today());
  const [notes, setNotes] = useState("");

  const [selectedLines, setSelectedLines] = useState<
    Record<string, ReturnLine>
  >({});

  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(
    async (silent = false) => {
      if (!serviceJobId) return;

      if (!silent) setLoading(true);
      else setRefreshing(true);

      setErrorMessage("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        const { data: memberships, error: membershipError } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1);

        if (membershipError) {
          throw new Error(
            `Unable to resolve company: ${membershipError.message}`,
          );
        }

        const currentCompanyId = memberships?.[0]?.company_id;

        if (!currentCompanyId) {
          throw new Error("No company membership was found.");
        }

        setCompanyId(currentCompanyId);

        const { data: jobData, error: jobError } = await supabase
          .from("service_jobs")
          .select(
            "id,company_id,job_number,provider_id,status,service_type,priority,notes,internal_notes,expected_return_date",
          )
          .eq("id", serviceJobId)
          .eq("company_id", currentCompanyId)
          .maybeSingle();

        if (jobError) {
          throw new Error(`Unable to load service job: ${jobError.message}`);
        }

        if (!jobData) {
          throw new Error("Service job was not found.");
        }

        setJob(jobData);

        const [
          providerResult,
          dispatchResult,
          warehouseResult,
          locationResult,
        ] = await Promise.all([
          supabase
            .from("service_providers")
            .select("id,name,company_name")
            .eq("id", jobData.provider_id)
            .eq("company_id", currentCompanyId)
            .maybeSingle(),

          supabase
            .from("service_dispatches")
            .select(
              "id,dispatch_number,dispatch_date,expected_return_date,status,warehouse_id,location_id,notes",
            )
            .eq("service_job_id", serviceJobId)
            .eq("company_id", currentCompanyId)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false }),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", currentCompanyId),

          supabase
            .from("warehouse_locations")
            .select("id,warehouse_id,name,code")
            .eq("company_id", currentCompanyId),
        ]);

        if (providerResult.error) {
          throw new Error(
            `Unable to load provider: ${providerResult.error.message}`,
          );
        }

        if (dispatchResult.error) {
          throw new Error(
            `Unable to load dispatches: ${dispatchResult.error.message}`,
          );
        }

        if (warehouseResult.error) {
          throw new Error(
            `Unable to load warehouses: ${warehouseResult.error.message}`,
          );
        }

        if (locationResult.error) {
          throw new Error(
            `Unable to load locations: ${locationResult.error.message}`,
          );
        }

        setProvider(providerResult.data);
        setDispatches(dispatchResult.data ?? []);

        const warehouseMap: Record<string, Warehouse> = {};
        for (const row of warehouseResult.data ?? []) {
          warehouseMap[row.id] = row;
        }

        const locationMap: Record<string, Location> = {};
        for (const row of locationResult.data ?? []) {
          locationMap[row.id] = row;
        }

        setWarehouses(warehouseMap);
        setLocations(locationMap);

        const dispatchIds = (dispatchResult.data ?? []).map((d) => d.id);

        if (dispatchIds.length === 0) {
          setDispatchItems([]);
          setExistingReturnItems([]);
          setExistingReturns([]);
          return;
        }

        const { data: allDispatchItems, error: dispatchItemsError } =
          await supabase
            .from("service_dispatch_items")
            .select(
              "id,dispatch_id,service_job_item_id,product_id,variant_id,serialized_unit_id,quantity",
            )
            .eq("company_id", currentCompanyId)
            .in("dispatch_id", dispatchIds);

        if (dispatchItemsError) {
          throw new Error(
            `Unable to load dispatched items: ${dispatchItemsError.message}`,
          );
        }

        const allReturnResults = await Promise.all([
          supabase
            .from("service_returns")
            .select("id,return_number,return_date,status")
            .eq("company_id", currentCompanyId)
            .eq("service_job_id", serviceJobId)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false }),

          supabase
            .from("service_return_items")
            .select("dispatch_item_id,quantity,result")
            .eq("company_id", currentCompanyId),

          supabase
            .from("products")
            .select("id,name,tracking_mode")
            .eq("company_id", currentCompanyId),

          supabase
            .from("product_variants")
            .select("id,product_id,name,sku")
            .eq("company_id", currentCompanyId),
        ]);

        const returnsResult = allReturnResults[0];
        const returnItemsResult = allReturnResults[1];
        const productsResult = allReturnResults[2];
        const variantsResult = allReturnResults[3];

        if (returnsResult.error) {
          throw new Error(
            `Unable to load returns: ${returnsResult.error.message}`,
          );
        }

        if (returnItemsResult.error) {
          throw new Error(
            `Unable to load returned quantities: ${returnItemsResult.error.message}`,
          );
        }

        if (productsResult.error) {
          throw new Error(
            `Unable to load products: ${productsResult.error.message}`,
          );
        }

        if (variantsResult.error) {
          throw new Error(
            `Unable to load variants: ${variantsResult.error.message}`,
          );
        }

        const productMap: Record<string, Product> = {};
        for (const row of productsResult.data ?? []) {
          productMap[row.id] = row;
        }

        const variantMap: Record<string, Variant> = {};
        for (const row of variantsResult.data ?? []) {
          variantMap[row.id] = row;
        }

        setProducts(productMap);
        setVariants(variantMap);
        setExistingReturns(returnsResult.data ?? []);
        setExistingReturnItems(returnItemsResult.data ?? []);

        const currentDispatchItems = (allDispatchItems ?? []).filter(
          (item) => item.dispatch_id === selectedDispatchId,
        );

        setDispatchItems(
          selectedDispatchId
            ? currentDispatchItems
            : allDispatchItems ?? [],
        );

        const serialIds = (allDispatchItems ?? [])
          .map((item) => item.serialized_unit_id)
          .filter(Boolean) as string[];

        if (serialIds.length > 0) {
          const { data: serialRows, error: serialError } = await supabase
            .from("serialized_units")
            .select("id,product_id,variant_id,serial_number,status")
            .eq("company_id", currentCompanyId)
            .in("id", serialIds);

          if (serialError) {
            throw new Error(
              `Unable to load serial numbers: ${serialError.message}`,
            );
          }

          const serialMap: Record<string, SerializedUnit> = {};

          for (const row of serialRows ?? []) {
            serialMap[row.id] = row;
          }

          setSerializedUnits(serialMap);
        } else {
          setSerializedUnits({});
        }

        if (!selectedDispatchId && dispatchResult.data?.length) {
          setSelectedDispatchId(dispatchResult.data[0].id);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load service return information.";

        setErrorMessage(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, selectedDispatchId, serviceJobId, supabase],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedDispatchId) {
      setDispatchItems([]);
      return;
    }

    const loadSelectedDispatch = async () => {
      if (!companyId) return;

      const { data, error } = await supabase
        .from("service_dispatch_items")
        .select(
          "id,dispatch_id,service_job_item_id,product_id,variant_id,serialized_unit_id,quantity",
        )
        .eq("company_id", companyId)
        .eq("dispatch_id", selectedDispatchId);

      if (!error) {
        setDispatchItems(data ?? []);
      }
    };

    loadSelectedDispatch();
  }, [companyId, selectedDispatchId, supabase]);

  const selectedDispatch = useMemo(
    () => dispatches.find((dispatch) => dispatch.id === selectedDispatchId),
    [dispatches, selectedDispatchId],
  );

  const returnedQuantityByDispatchItem = useMemo(() => {
    const map: Record<string, number> = {};

    for (const item of existingReturnItems) {
      if (!item.dispatch_item_id) continue;

      map[item.dispatch_item_id] =
        (map[item.dispatch_item_id] ?? 0) + Number(item.quantity ?? 0);
    }

    return map;
  }, [existingReturnItems]);

  const outstandingItems = useMemo(() => {
    return dispatchItems
      .map((item) => {
        const returned = returnedQuantityByDispatchItem[item.id] ?? 0;
        const outstanding = Math.max(0, Number(item.quantity) - returned);

        return {
          ...item,
          returned,
          outstanding,
        };
      })
      .filter((item) => item.outstanding > 0);
  }, [dispatchItems, returnedQuantityByDispatchItem]);

  const totalOutstanding = useMemo(
    () =>
      outstandingItems.reduce(
        (sum, item) => sum + Number(item.outstanding),
        0,
      ),
    [outstandingItems],
  );

  const selectedQuantity = useMemo(
    () =>
      Object.values(selectedLines).reduce(
        (sum, line) => sum + Number(line.quantity || 0),
        0,
      ),
    [selectedLines],
  );

  const selectedCost = useMemo(
    () =>
      Object.values(selectedLines).reduce(
        (sum, line) => sum + Number(line.serviceCost || 0),
        0,
      ),
    [selectedLines],
  );

  const selectedCount = Object.keys(selectedLines).length;

  const isSerialized = (item: DispatchItem) => {
    return Boolean(item.serialized_unit_id);
  };

  const toggleLine = (item: DispatchItem & { outstanding: number }) => {
    const existing = selectedLines[item.id];

    if (existing) {
      const next = { ...selectedLines };
      delete next[item.id];
      setSelectedLines(next);
      return;
    }

    setSelectedLines((current) => ({
      ...current,
      [item.id]: {
        dispatchItemId: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        serializedUnitId: item.serialized_unit_id,
        quantity: Number(item.outstanding),
        result: "completed",
        workPerformed: "",
        failureReason: "",
        conditionReceived: "",
        serviceCost: 0,
        notes: "",
      },
    }));
  };

  const updateLine = (
    dispatchItemId: string,
    field: keyof ReturnLine,
    value: string | number,
  ) => {
    setSelectedLines((current) => {
      const line = current[dispatchItemId];

      if (!line) return current;

      return {
        ...current,
        [dispatchItemId]: {
          ...line,
          [field]: value,
        },
      };
    });
  };

  const selectAllOutstanding = () => {
    const next: Record<string, ReturnLine> = {};

    for (const item of outstandingItems) {
      next[item.id] = {
        dispatchItemId: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        serializedUnitId: item.serialized_unit_id,
        quantity: Number(item.outstanding),
        result: "completed",
        workPerformed: "",
        failureReason: "",
        conditionReceived: "",
        serviceCost: 0,
        notes: "",
      };
    }

    setSelectedLines(next);
  };

  const clearAll = () => {
    setSelectedLines({});
  };

  const handleDispatchChange = (value: string) => {
    setSelectedDispatchId(value);
    setSelectedLines({});
    setErrorMessage("");
  };

  const submitReturn = async () => {
    if (!companyId || !userId || !job || !selectedDispatch) {
      setErrorMessage("Required service return information is missing.");
      return;
    }

    const lines = Object.values(selectedLines);

    if (lines.length === 0) {
      setErrorMessage("Select at least one item to receive.");
      return;
    }

    if (!returnDate) {
      setErrorMessage("Return date is required.");
      return;
    }

    for (const line of lines) {
      const sourceItem = outstandingItems.find(
        (item) => item.id === line.dispatchItemId,
      );

      if (!sourceItem) {
        setErrorMessage("One of the selected items is no longer available.");
        return;
      }

      if (line.quantity <= 0) {
        setErrorMessage("Return quantity must be greater than zero.");
        return;
      }

      if (line.quantity > sourceItem.outstanding) {
        setErrorMessage(
          "A return quantity exceeds the outstanding provider quantity.",
        );
        return;
      }

      if (line.result === "damaged" && !line.conditionReceived.trim()) {
        setErrorMessage(
          "Please describe the condition received for damaged items.",
        );
        return;
      }

      if (
        line.result === "not_repaired" &&
        !line.failureReason.trim()
      ) {
        setErrorMessage(
          "Please provide a failure reason for items that were not repaired.",
        );
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const payload = lines.map((line) => ({
        dispatch_item_id: line.dispatchItemId,
        quantity: Number(line.quantity),
        result: line.result,
        serialized_unit_id: line.serializedUnitId,
        work_performed: line.workPerformed.trim() || null,
        failure_reason: line.failureReason.trim() || null,
        condition_received: line.conditionReceived.trim() || null,
        service_cost: Number(line.serviceCost || 0),
        notes: line.notes.trim() || null,
      }));

      const { data, error } = await supabase.rpc("create_service_return", {
        p_company_id: companyId,
        p_service_job_id: serviceJobId,
        p_dispatch_id: selectedDispatch.id,
        p_return_date: returnDate,
        p_notes: notes.trim() || null,
        p_items: payload,
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result?.return_id) {
        throw new Error("The service return was not created.");
      }

      router.push(`/service-jobs/${serviceJobId}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to create service return.";

      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .loading {
            min-height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            font-size: 14px;
          }
        `}</style>

        <div className="page-content">
          <div className="loading">Loading service return...</div>
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .error-card {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 24px;
            color: #991b1b;
          }
        `}</style>

        <div className="page-content">
          <div className="error-card">
            {errorMessage || "Service job not found."}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1500px;
          margin: 0 auto;
        }

        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6b7280;
          font-size: 13px;
          margin-bottom: 10px;
        }

        .breadcrumb button {
          border: 0;
          background: transparent;
          padding: 0;
          color: #6b7280;
          cursor: pointer;
          font-size: 13px;
        }

        .breadcrumb button:hover {
          color: #111827;
        }

        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .title-wrap h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1.2;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.02em;
        }

        .subtitle {
          margin-top: 7px;
          color: #6b7280;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .button {
          height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          border: 1px solid #d1d5db;
          background: #fff;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .button:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .button-primary {
          background: #111827;
          border-color: #111827;
          color: #fff;
        }

        .button-primary:hover {
          background: #1f2937;
          border-color: #1f2937;
        }

        .button-danger {
          color: #991b1b;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
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
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 22px;
          line-height: 1.1;
          font-weight: 700;
          color: #111827;
        }

        .stat-sub {
          margin-top: 6px;
          font-size: 12px;
          color: #9ca3af;
        }

        .grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 20px;
          align-items: start;
        }

        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          margin-bottom: 20px;
        }

        .card-header {
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .card-title {
          font-size: 15px;
          font-weight: 700;
          color: #111827;
        }

        .card-description {
          margin-top: 4px;
          color: #6b7280;
          font-size: 12px;
        }

        .card-body {
          padding: 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .field {
          min-width: 0;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .label {
          display: block;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
        }

        .input,
        .select,
        .textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          color: #111827;
          font-size: 13px;
          outline: none;
          transition: 0.15s ease;
        }

        .input,
        .select {
          height: 40px;
          padding: 0 12px;
        }

        .textarea {
          min-height: 90px;
          resize: vertical;
          padding: 10px 12px;
          line-height: 1.5;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
        }

        .dispatch-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .summary-box {
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 12px;
          background: #f9fafb;
        }

        .summary-label {
          color: #6b7280;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .summary-value {
          color: #111827;
          font-size: 13px;
          font-weight: 600;
        }

        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .toolbar-left {
          color: #6b7280;
          font-size: 12px;
        }

        .toolbar-actions {
          display: flex;
          gap: 8px;
        }

        .small-button {
          border: 1px solid #d1d5db;
          background: #fff;
          color: #374151;
          border-radius: 8px;
          height: 34px;
          padding: 0 11px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .small-button:hover {
          background: #f9fafb;
        }

        .item-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .item-card {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 16px;
          transition: 0.15s ease;
        }

        .item-card.selected {
          border-color: #9ca3af;
          box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.05);
        }

        .item-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .checkbox {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          accent-color: #111827;
          cursor: pointer;
          flex: 0 0 auto;
        }

        .item-main {
          flex: 1;
          min-width: 0;
        }

        .item-name {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .item-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 6px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          height: 24px;
          padding: 0 8px;
          border-radius: 6px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 11px;
          font-weight: 600;
        }

        .tag-serial {
          background: #fef3c7;
          color: #92400e;
        }

        .item-quantity {
          text-align: right;
          min-width: 100px;
        }

        .quantity-number {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }

        .quantity-label {
          color: #9ca3af;
          font-size: 11px;
          margin-top: 2px;
        }

        .return-form {
          border-top: 1px solid #e5e7eb;
          margin-top: 15px;
          padding-top: 15px;
        }

        .result-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 14px;
        }

        .result-option {
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #fff;
          padding: 10px;
          cursor: pointer;
          text-align: left;
        }

        .result-option:hover {
          background: #f9fafb;
        }

        .result-option.active {
          border-color: #111827;
          background: #f9fafb;
        }

        .result-label {
          color: #111827;
          font-size: 12px;
          font-weight: 700;
        }

        .result-description {
          margin-top: 3px;
          color: #6b7280;
          font-size: 10px;
          line-height: 1.35;
        }

        .line-grid {
          display: grid;
          grid-template-columns: 140px minmax(0, 1fr);
          gap: 12px;
        }

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          border: 1px dashed #d1d5db;
          border-radius: 10px;
          background: #fafafa;
        }

        .empty-title {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .empty-text {
          color: #6b7280;
          font-size: 12px;
          margin-top: 5px;
        }

        .alert {
          margin-bottom: 20px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13px;
        }

        .sidebar-sticky {
          position: sticky;
          top: 20px;
        }

        .provider-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
        }

        .provider-icon {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #e5e7eb;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
        }

        .provider-name {
          font-size: 13px;
          color: #111827;
          font-weight: 700;
        }

        .provider-company {
          font-size: 11px;
          color: #6b7280;
          margin-top: 3px;
        }

        .cost-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .cost-box:last-child {
          border-bottom: 0;
        }

        .cost-label {
          color: #6b7280;
          font-size: 12px;
        }

        .cost-value {
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .submit-area {
          display: flex;
          gap: 10px;
          margin-top: 18px;
        }

        .submit-area .button {
          flex: 1;
        }

        .history-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .history-row:last-child {
          border-bottom: 0;
        }

        .history-number {
          font-size: 12px;
          color: #111827;
          font-weight: 700;
        }

        .history-date {
          color: #6b7280;
          font-size: 11px;
          margin-top: 3px;
        }

        .history-status {
          color: #374151;
          font-size: 11px;
          font-weight: 600;
        }

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .grid {
            grid-template-columns: 1fr;
          }

          .sidebar-sticky {
            position: static;
          }
        }

        @media (max-width: 700px) {
          .page-content {
            padding: 18px;
          }

          .header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions .button {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .dispatch-summary {
            grid-template-columns: 1fr;
          }

          .result-grid {
            grid-template-columns: 1fr 1fr;
          }

          .line-grid {
            grid-template-columns: 1fr;
          }

          .item-top {
            flex-wrap: wrap;
          }

          .item-quantity {
            margin-left: 30px;
            text-align: left;
          }
        }
      `}</style>

      <div className="page-content">
        <div className="breadcrumb">
          <button onClick={() => router.push("/service-jobs")}>
            Service Jobs
          </button>
          <span>/</span>
          <button onClick={() => router.push(`/service-jobs/${job.id}`)}>
            {job.job_number}
          </button>
          <span>/</span>
          <span>Receive Return</span>
        </div>

        <div className="header">
          <div className="title-wrap">
            <h1>Receive Provider Return</h1>
            <div className="subtitle">
              Receive stock back from the service provider and record the
              outcome.
            </div>
          </div>

          <div className="header-actions">
            <button
              className="button"
              onClick={() => router.push(`/service-jobs/${job.id}`)}
            >
              Back to Job
            </button>

            <button
              className="button"
              onClick={() => loadData(true)}
              disabled={refreshing || submitting}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {errorMessage && <div className="alert">{errorMessage}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Service Job</div>
            <div className="stat-value">{job.job_number}</div>
            <div className="stat-sub">
              {job.service_type || "Service work"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Selected Dispatch</div>
            <div className="stat-value">
              {selectedDispatch?.dispatch_number || "—"}
            </div>
            <div className="stat-sub">
              {selectedDispatch
                ? formatDate(selectedDispatch.dispatch_date)
                : "No dispatch selected"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Still With Provider</div>
            <div className="stat-value">
              {formatNumber(totalOutstanding)}
            </div>
            <div className="stat-sub">Selected dispatch</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">This Return</div>
            <div className="stat-value">
              {formatNumber(selectedQuantity)}
            </div>
            <div className="stat-sub">
              {selectedCount} selected line
              {selectedCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="grid">
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Return Details</div>
                  <div className="card-description">
                    Select the dispatch and record when the stock was received.
                  </div>
                </div>
              </div>

              <div className="card-body">
                <div className="form-grid">
                  <div className="field">
                    <label className="label">Dispatch</label>
                    <select
                      className="select"
                      value={selectedDispatchId}
                      onChange={(event) =>
                        handleDispatchChange(event.target.value)
                      }
                      disabled={submitting}
                    >
                      {dispatches.length === 0 && (
                        <option value="">No dispatches available</option>
                      )}

                      {dispatches.map((dispatch) => (
                        <option key={dispatch.id} value={dispatch.id}>
                          {dispatch.dispatch_number} —{" "}
                          {formatDate(dispatch.dispatch_date)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label className="label">Return Date</label>
                    <input
                      className="input"
                      type="date"
                      value={returnDate}
                      onChange={(event) => setReturnDate(event.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                {selectedDispatch && (
                  <div className="dispatch-summary">
                    <div className="summary-box">
                      <div className="summary-label">Warehouse</div>
                      <div className="summary-value">
                        {selectedDispatch.warehouse_id
                          ? warehouses[selectedDispatch.warehouse_id]?.name ??
                            "Warehouse"
                          : "—"}
                      </div>
                    </div>

                    <div className="summary-box">
                      <div className="summary-label">Location</div>
                      <div className="summary-value">
                        {selectedDispatch.location_id
                          ? locations[selectedDispatch.location_id]?.name ??
                            "Location"
                          : "—"}
                      </div>
                    </div>

                    <div className="summary-box">
                      <div className="summary-label">Expected Return</div>
                      <div className="summary-value">
                        {formatDate(selectedDispatch.expected_return_date)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Items to Receive</div>
                  <div className="card-description">
                    Select the items physically received from the provider.
                  </div>
                </div>

                <div className="toolbar-actions">
                  <button
                    className="small-button"
                    onClick={selectAllOutstanding}
                    disabled={
                      submitting || outstandingItems.length === 0
                    }
                  >
                    Select All
                  </button>

                  <button
                    className="small-button"
                    onClick={clearAll}
                    disabled={submitting || selectedCount === 0}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="card-body">
                {outstandingItems.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-title">
                      Nothing is outstanding
                    </div>
                    <div className="empty-text">
                      All items from this dispatch have already been received.
                    </div>
                  </div>
                ) : (
                  <div className="item-list">
                    {outstandingItems.map((item) => {
                      const product = products[item.product_id];
                      const variant = item.variant_id
                        ? variants[item.variant_id]
                        : null;
                      const serial = item.serialized_unit_id
                        ? serializedUnits[item.serialized_unit_id]
                        : null;

                      const line = selectedLines[item.id];
                      const selected = Boolean(line);

                      return (
                        <div
                          key={item.id}
                          className={`item-card ${
                            selected ? "selected" : ""
                          }`}
                        >
                          <div className="item-top">
                            <input
                              className="checkbox"
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleLine(item)}
                              disabled={submitting}
                            />

                            <div className="item-main">
                              <div className="item-name">
                                {product?.name || "Product"}
                              </div>

                              <div className="item-meta">
                                {variant && (
                                  <span className="tag">
                                    {variant.sku || variant.name || "Variant"}
                                  </span>
                                )}

                                {serial && (
                                  <span className="tag tag-serial">
                                    Serial: {serial.serial_number}
                                  </span>
                                )}

                                {!serial && (
                                  <span className="tag">Bulk Stock</span>
                                )}
                              </div>
                            </div>

                            <div className="item-quantity">
                              <div className="quantity-number">
                                {formatNumber(item.outstanding)}
                              </div>
                              <div className="quantity-label">
                                outstanding
                              </div>
                            </div>
                          </div>

                          {selected && line && (
                            <div className="return-form">
                              <div className="result-grid">
                                {RESULT_OPTIONS.map((option) => (
                                  <button
                                    type="button"
                                    key={option.value}
                                    className={`result-option ${
                                      line.result === option.value
                                        ? "active"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      updateLine(
                                        item.id,
                                        "result",
                                        option.value,
                                      )
                                    }
                                    disabled={submitting}
                                  >
                                    <div className="result-label">
                                      {option.label}
                                    </div>
                                    <div className="result-description">
                                      {option.description}
                                    </div>
                                  </button>
                                ))}
                              </div>

                              <div className="line-grid">
                                <div className="field">
                                  <label className="label">
                                    Return Quantity
                                  </label>

                                  <input
                                    className="input"
                                    type="number"
                                    min="1"
                                    max={item.outstanding}
                                    step="1"
                                    value={line.quantity}
                                    onChange={(event) => {
                                      const value = Math.max(
                                        1,
                                        Math.min(
                                          Number(item.outstanding),
                                          Number(event.target.value || 1),
                                        ),
                                      );

                                      updateLine(
                                        item.id,
                                        "quantity",
                                        value,
                                      );
                                    }}
                                    disabled={
                                      submitting || isSerialized(item)
                                    }
                                  />
                                </div>

                                <div className="field">
                                  <label className="label">
                                    Service Cost
                                  </label>

                                  <input
                                    className="input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line.serviceCost}
                                    onChange={(event) =>
                                      updateLine(
                                        item.id,
                                        "serviceCost",
                                        Math.max(
                                          0,
                                          Number(event.target.value || 0),
                                        ),
                                      )
                                    }
                                    disabled={submitting}
                                  />
                                </div>

                                <div className="field full">
                                  <label className="label">
                                    Work Performed
                                  </label>

                                  <textarea
                                    className="textarea"
                                    placeholder="Describe the work completed by the provider..."
                                    value={line.workPerformed}
                                    onChange={(event) =>
                                      updateLine(
                                        item.id,
                                        "workPerformed",
                                        event.target.value,
                                      )
                                    }
                                    disabled={submitting}
                                  />
                                </div>

                                {(line.result === "not_repaired" ||
                                  line.result === "damaged" ||
                                  line.result === "scrapped") && (
                                  <div className="field full">
                                    <label className="label">
                                      Failure Reason
                                    </label>

                                    <textarea
                                      className="textarea"
                                      placeholder="Explain why the item was not successfully repaired..."
                                      value={line.failureReason}
                                      onChange={(event) =>
                                        updateLine(
                                          item.id,
                                          "failureReason",
                                          event.target.value,
                                        )
                                      }
                                      disabled={submitting}
                                    />
                                  </div>
                                )}

                                <div className="field full">
                                  <label className="label">
                                    Condition Received
                                  </label>

                                  <input
                                    className="input"
                                    placeholder="e.g. Good, repaired, scratched, damaged..."
                                    value={line.conditionReceived}
                                    onChange={(event) =>
                                      updateLine(
                                        item.id,
                                        "conditionReceived",
                                        event.target.value,
                                      )
                                    }
                                    disabled={submitting}
                                  />
                                </div>

                                <div className="field full">
                                  <label className="label">
                                    Line Notes
                                  </label>

                                  <textarea
                                    className="textarea"
                                    placeholder="Additional notes..."
                                    value={line.notes}
                                    onChange={(event) =>
                                      updateLine(
                                        item.id,
                                        "notes",
                                        event.target.value,
                                      )
                                    }
                                    disabled={submitting}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Return Notes</div>
                  <div className="card-description">
                    General notes for this provider return.
                  </div>
                </div>
              </div>

              <div className="card-body">
                <textarea
                  className="textarea"
                  placeholder="Add receiving notes, provider comments, courier information, or inspection notes..."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="sidebar-sticky">
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Provider</div>
                  <div className="card-description">
                    Current stock custody owner
                  </div>
                </div>
              </div>

              <div className="card-body">
                <div className="provider-box">
                  <div className="provider-icon">
                    {(provider?.name || "P").charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="provider-name">
                      {provider?.name || "Provider"}
                    </div>

                    <div className="provider-company">
                      {provider?.company_name || "External service provider"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Return Summary</div>
                  <div className="card-description">
                    Current transaction
                  </div>
                </div>
              </div>

              <div className="card-body">
                <div className="cost-box">
                  <span className="cost-label">Items selected</span>
                  <span className="cost-value">
                    {selectedCount}
                  </span>
                </div>

                <div className="cost-box">
                  <span className="cost-label">Quantity</span>
                  <span className="cost-value">
                    {formatNumber(selectedQuantity)}
                  </span>
                </div>

                <div className="cost-box">
                  <span className="cost-label">Service cost</span>
                  <span className="cost-value">
                    {money(selectedCost)}
                  </span>
                </div>

                <div className="cost-box">
                  <span className="cost-label">Still with provider</span>
                  <span className="cost-value">
                    {formatNumber(
                      Math.max(0, totalOutstanding - selectedQuantity),
                    )}
                  </span>
                </div>

                <div className="submit-area">
                  <button
                    className="button"
                    onClick={() =>
                      router.push(`/service-jobs/${job.id}`)
                    }
                    disabled={submitting}
                  >
                    Cancel
                  </button>

                  <button
                    className="button button-primary"
                    onClick={submitReturn}
                    disabled={
                      submitting ||
                      selectedCount === 0 ||
                      outstandingItems.length === 0
                    }
                  >
                    {submitting ? "Receiving..." : "Receive Return"}
                  </button>
                </div>
              </div>
            </div>

            {existingReturns.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Previous Returns</div>
                    <div className="card-description">
                      Return history for this job
                    </div>
                  </div>
                </div>

                <div className="card-body">
                  {existingReturns.slice(0, 5).map((returnRow) => (
                    <div className="history-row" key={returnRow.id}>
                      <div>
                        <div className="history-number">
                          {returnRow.return_number}
                        </div>

                        <div className="history-date">
                          {formatDate(returnRow.return_date)}
                        </div>
                      </div>

                      <div className="history-status">
                        {returnRow.status.replace("_", " ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}