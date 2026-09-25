"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  tracking_mode: string | null;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type Batch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  lot_number: string;
  received_at: string | null;
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
  company_id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  barcode: string | null;
  status: string | null;
  warehouse_id: string | null;
  location_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  invoice_id: string | null;
  purchase_order_id: string | null;
  purchase_order_item_id: string | null;
  cost_price: number | null;
  warranty_start: string | null;
  warranty_end: string | null;
  received_at: string | null;
  sold_at: string | null;
  batch_id: string | null;
  allocated_at: string | null;
  returned_at: string | null;
  disposed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type WarrantyFilter = "all" | "active" | "expired" | "none";

const STATUS_OPTIONS = [
  "all",
  "available",
  "reserved",
  "sold",
  "returned",
  "repair",
  "rma",
  "damaged",
  "lost",
  "disposed",
];

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(value);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function getWarrantyState(
  warrantyStart: string | null,
  warrantyEnd: string | null,
): "active" | "expired" | "none" {
  if (!warrantyStart && !warrantyEnd) {
    return "none";
  }

  const now = new Date();

  if (warrantyEnd) {
    const end = new Date(warrantyEnd);

    if (!Number.isNaN(end.getTime())) {
      if (end >= now) {
        return "active";
      }

      return "expired";
    }
  }

  if (warrantyStart) {
    const start = new Date(warrantyStart);

    if (
      !Number.isNaN(start.getTime()) &&
      start <= now
    ) {
      return "active";
    }
  }

  return "none";
}

function titleCase(value: string | null) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusClass(status: string | null) {
  switch (normalize(status)) {
    case "available":
      return "status status-available";

    case "reserved":
      return "status status-reserved";

    case "sold":
      return "status status-sold";

    case "returned":
      return "status status-returned";

    case "repair":
    case "rma":
      return "status status-warning";

    case "damaged":
    case "lost":
    case "disposed":
      return "status status-danger";

    default:
      return "status status-neutral";
  }
}

export default function SerialNumbersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [serializedUnits, setSerializedUnits] = useState<
    SerializedUnit[]
  >([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] =
    useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [warrantyFilter, setWarrantyFilter] =
    useState<WarrantyFilter>("all");

  const [page, setPage] = useState(1);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannerMessage, setScannerMessage] = useState("");
  const [scannerBusy, setScannerBusy] = useState(false);

  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerTimerRef = useRef<number | null>(null);

  const PAGE_SIZE = 20;

  const loadData = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          throw new Error("You must be signed in.");
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership found.",
          );
        }

        const currentCompanyId =
          membership.company_id;

        const [
          productsResult,
          variantsResult,
          batchesResult,
          warehousesResult,
          locationsResult,
          serializedResult,
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,name,brand,category,tracking_mode",
            )
            .eq("company_id", currentCompanyId)
            .order("name"),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,sku",
            )
            .eq("company_id", currentCompanyId)
            .order("name"),

          supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,lot_number,received_at",
            )
            .eq("company_id", currentCompanyId)
            .neq("status", "cancelled")
            .order("received_at", {
              ascending: false,
            }),

          supabase
            .from("warehouses")
            .select("id,name,code")
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("warehouse_locations")
            .select(
              "id,warehouse_id,name,code",
            )
            .eq("company_id", currentCompanyId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("serialized_units")
            .select(
              [
                "id",
                "company_id",
                "product_id",
                "variant_id",
                "serial_number",
                "barcode",
                "status",
                "warehouse_id",
                "location_id",
                "customer_id",
                "order_id",
                "order_item_id",
                "invoice_id",
                "purchase_order_id",
                "purchase_order_item_id",
                "cost_price",
                "warranty_start",
                "warranty_end",
                "received_at",
                "sold_at",
                "batch_id",
                "allocated_at",
                "returned_at",
                "disposed_at",
                "created_at",
                "updated_at",
              ].join(","),
            )
            .eq("company_id", currentCompanyId)
            .order("created_at", {
              ascending: false,
            }),
        ]);

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

        if (batchesResult.error) {
          throw new Error(
            batchesResult.error.message,
          );
        }

        if (warehousesResult.error) {
          throw new Error(
            warehousesResult.error.message,
          );
        }

        if (locationsResult.error) {
          throw new Error(
            locationsResult.error.message,
          );
        }

        if (serializedResult.error) {
          throw new Error(
            serializedResult.error.message,
          );
        }

        setProducts(
          (productsResult.data ?? []) as Product[],
        );

        setVariants(
          (variantsResult.data ?? []) as Variant[],
        );

        setBatches(
          (batchesResult.data ?? []) as Batch[],
        );

        setWarehouses(
          (warehousesResult.data ?? []) as Warehouse[],
        );

        setLocations(
          (locationsResult.data ?? []) as Location[],
        );

        setSerializedUnits(
          (serializedResult.data ??
            []) as unknown as SerializedUnit[],
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load serial numbers.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    statusFilter,
    productFilter,
    warehouseFilter,
    batchFilter,
    warrantyFilter,
  ]);

  const productMap = useMemo(() => {
    return new Map(
      products.map((product) => [
        product.id,
        product,
      ]),
    );
  }, [products]);

  const variantMap = useMemo(() => {
    return new Map(
      variants.map((variant) => [
        variant.id,
        variant,
      ]),
    );
  }, [variants]);

  const batchMap = useMemo(() => {
    return new Map(
      batches.map((batch) => [
        batch.id,
        batch,
      ]),
    );
  }, [batches]);

  const warehouseMap = useMemo(() => {
    return new Map(
      warehouses.map((warehouse) => [
        warehouse.id,
        warehouse,
      ]),
    );
  }, [warehouses]);

  const locationMap = useMemo(() => {
    return new Map(
      locations.map((location) => [
        location.id,
        location,
      ]),
    );
  }, [locations]);

  const filteredUnits = useMemo(() => {
    const q = normalize(search);

    return serializedUnits.filter((unit) => {
      const product =
        productMap.get(unit.product_id);

      const variant = unit.variant_id
        ? variantMap.get(unit.variant_id)
        : null;

      const batch = unit.batch_id
        ? batchMap.get(unit.batch_id)
        : null;

      const matchesSearch =
        !q ||
        normalize(unit.serial_number).includes(q) ||
        normalize(unit.barcode).includes(q) ||
        normalize(product?.name).includes(q) ||
        normalize(product?.brand).includes(q) ||
        normalize(variant?.name).includes(q) ||
        normalize(variant?.sku).includes(q) ||
        normalize(batch?.lot_number).includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        normalize(unit.status) ===
          normalize(statusFilter);

      const matchesProduct =
        productFilter === "all" ||
        unit.product_id === productFilter;

      const matchesWarehouse =
        warehouseFilter === "all" ||
        unit.warehouse_id === warehouseFilter;

      const matchesBatch =
        batchFilter === "all" ||
        unit.batch_id === batchFilter;

      const warrantyState = getWarrantyState(
        unit.warranty_start,
        unit.warranty_end,
      );

      const matchesWarranty =
        warrantyFilter === "all" ||
        warrantyState === warrantyFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProduct &&
        matchesWarehouse &&
        matchesBatch &&
        matchesWarranty
      );
    });
  }, [
    serializedUnits,
    productMap,
    variantMap,
    batchMap,
    search,
    statusFilter,
    productFilter,
    warehouseFilter,
    batchFilter,
    warrantyFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredUnits.length / PAGE_SIZE,
    ),
  );

  const paginatedUnits = useMemo(() => {
    const start =
      (page - 1) * PAGE_SIZE;

    return filteredUnits.slice(
      start,
      start + PAGE_SIZE,
    );
  }, [filteredUnits, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const stats = useMemo(() => {
    const total = serializedUnits.length;

    const available = serializedUnits.filter(
      (unit) =>
        normalize(unit.status) === "available",
    ).length;

    const reserved = serializedUnits.filter(
      (unit) =>
        normalize(unit.status) === "reserved",
    ).length;

    const sold = serializedUnits.filter(
      (unit) =>
        normalize(unit.status) === "sold",
    ).length;

    const repairRma = serializedUnits.filter(
      (unit) => {
        const status = normalize(unit.status);

        return (
          status === "repair" ||
          status === "rma"
        );
      },
    ).length;

    const problem = serializedUnits.filter(
      (unit) => {
        const status = normalize(unit.status);

        return (
          status === "damaged" ||
          status === "lost" ||
          status === "disposed"
        );
      },
    ).length;

    return {
      total,
      available,
      reserved,
      sold,
      repairRma,
      problem,
    };
  }, [serializedUnits]);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (statusFilter !== "all") count++;
    if (productFilter !== "all") count++;
    if (warehouseFilter !== "all") count++;
    if (batchFilter !== "all") count++;
    if (warrantyFilter !== "all") count++;

    return count;
  }, [
    statusFilter,
    productFilter,
    warehouseFilter,
    batchFilter,
    warrantyFilter,
  ]);

  const stopSerialScanner = useCallback(() => {
    if (scannerTimerRef.current !== null) {
      window.clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }

    scannerStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    scannerStreamRef.current = null;
    setScannerBusy(false);
    setScannerOpen(false);
  }, []);

  const openSerialDetail = useCallback(
    async (value: string) => {
      const scannedValue = value.trim();

      if (!scannedValue) return;

      const normalizedValue = normalize(scannedValue);

      const localMatch = serializedUnits.find(
        (unit) =>
          normalize(unit.serial_number) === normalizedValue ||
          normalize(unit.barcode) === normalizedValue,
      );

      if (localMatch) {
        stopSerialScanner();
        router.push(`/serial-numbers/${localMatch.id}`);
        return;
      }

      setScannerMessage("Searching serial number...");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          throw new Error("You must be signed in.");
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        if (!membership?.company_id) {
          throw new Error("No company membership found.");
        }

        const companyId = membership.company_id;

        const { data: serialMatch, error: serialError } =
          await supabase
            .from("serialized_units")
            .select("id")
            .eq("company_id", companyId)
            .eq("serial_number", scannedValue)
            .limit(1)
            .maybeSingle();

        if (serialError) {
          throw new Error(serialError.message);
        }

        if (serialMatch?.id) {
          stopSerialScanner();
          router.push(`/serial-numbers/${serialMatch.id}`);
          return;
        }

        const { data: barcodeMatch, error: barcodeError } =
          await supabase
            .from("serialized_units")
            .select("id")
            .eq("company_id", companyId)
            .eq("barcode", scannedValue)
            .limit(1)
            .maybeSingle();

        if (barcodeError) {
          throw new Error(barcodeError.message);
        }

        if (barcodeMatch?.id) {
          stopSerialScanner();
          router.push(`/serial-numbers/${barcodeMatch.id}`);
          return;
        }

        setScannerMessage(`Serial or barcode "${scannedValue}" was not found.`);
      } catch (error) {
        console.error(error);

        setScannerMessage(
          error instanceof Error
            ? error.message
            : "Unable to find this serial number.",
        );
      }
    },
    [router, serializedUnits, stopSerialScanner, supabase],
  );

  const startSerialScanner = async () => {
    setScannerMessage("");
    setScannerInput("");
    setScannerOpen(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerMessage(
        "Camera scanning is unavailable in this browser. Use the scanner input below.",
      );
      return;
    }

    try {
      setScannerBusy(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      scannerStreamRef.current = stream;

      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        await scannerVideoRef.current.play();
      }

      const BarcodeDetectorClass = (
        window as Window & {
          BarcodeDetector?: new (options?: {
            formats?: string[];
          }) => {
            detect: (
              source: HTMLVideoElement,
            ) => Promise<Array<{ rawValue?: string }>>;
          };
        }
      ).BarcodeDetector;

      if (!BarcodeDetectorClass) {
        setScannerBusy(false);
        setScannerMessage(
          "Automatic camera barcode detection is not supported in this browser. Use the scanner input below.",
        );
        return;
      }

      const detector = new BarcodeDetectorClass({
        formats: [
          "code_128",
          "code_39",
          "code_93",
          "codabar",
          "data_matrix",
          "qr_code",
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
        ],
      });

      const scan = async () => {
        if (!scannerVideoRef.current || !scannerStreamRef.current) {
          return;
        }

        try {
          const detections = await detector.detect(
            scannerVideoRef.current,
          );

          const value = detections[0]?.rawValue?.trim();

          if (value) {
            await openSerialDetail(value);
            return;
          }
        } catch (error) {
          console.error(error);
        }

        scannerTimerRef.current = window.setTimeout(() => {
          void scan();
        }, 250);
      };

      void scan();
    } catch (error) {
      console.error(error);

      setScannerBusy(false);

      setScannerMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied. Use the scanner input below."
          : "Unable to start the camera. Use the scanner input below.",
      );
    }
  };

  const submitSerialScannerInput = async () => {
    const value = scannerInput.trim();

    if (!value) return;

    await openSerialDetail(value);
  };

  const handleSerialScannerKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitSerialScannerInput();
    }
  };

  useEffect(() => {
    return () => {
      if (scannerTimerRef.current !== null) {
        window.clearTimeout(scannerTimerRef.current);
      }

      scannerStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setProductFilter("all");
    setWarehouseFilter("all");
    setBatchFilter("all");
    setWarrantyFilter("all");
  };

  return (
    <AppShell>
      <div className="page-content serial-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Asset Registry
            </div>

            <h1 className="page-title">
              Serial Numbers
            </h1>

            <p className="page-subtitle">
              Manage and trace individual serialized
              assets across products, batches, locations,
              warranties, and lifecycle status.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void startSerialScanner()}
            >
              <span className="scan-button-icon">⌁</span>
              Scan Serial
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="error-card">
            <div>
              <strong>
                Unable to load serial numbers
              </strong>

              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => loadData()}
            >
              Retry
            </button>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Serial Assets
            </div>

            <div className="stat-value">
              {stats.total.toLocaleString()}
            </div>

            <div className="stat-meta">
              Serialized units
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Available
            </div>

            <div className="stat-value">
              {stats.available.toLocaleString()}
            </div>

            <div className="stat-meta positive">
              Ready for allocation
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Reserved
            </div>

            <div className="stat-value">
              {stats.reserved.toLocaleString()}
            </div>

            <div className="stat-meta">
              Allocated but not sold
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Sold
            </div>

            <div className="stat-value">
              {stats.sold.toLocaleString()}
            </div>

            <div className="stat-meta">
              Completed assets
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Repair / RMA
            </div>

            <div className="stat-value">
              {stats.repairRma.toLocaleString()}
            </div>

            <div className="stat-meta warning-text">
              Requires attention
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Problem Assets
            </div>

            <div className="stat-value">
              {stats.problem.toLocaleString()}
            </div>

            <div className="stat-meta danger-text">
              Damaged, lost or disposed
            </div>
          </div>
        </div>

        <div className="toolbar-card">
          <div className="toolbar-main">
            <div className="search-wrap">
              <span className="search-icon">
                ⌕
              </span>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search serial, barcode, product, SKU or batch..."
              />

              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
            >
              {STATUS_OPTIONS.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status === "all"
                    ? "All statuses"
                    : titleCase(status)}
                </option>
              ))}
            </select>

            <select
              value={productFilter}
              onChange={(event) =>
                setProductFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All products
              </option>

              {products.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.name}
                </option>
              ))}
            </select>

            <select
              value={warehouseFilter}
              onChange={(event) =>
                setWarehouseFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All warehouses
              </option>

              {warehouses.map((warehouse) => (
                <option
                  key={warehouse.id}
                  value={warehouse.id}
                >
                  {warehouse.name}
                </option>
              ))}
            </select>

            <select
              value={batchFilter}
              onChange={(event) =>
                setBatchFilter(
                  event.target.value,
                )
              }
            >
              <option value="all">
                All batches
              </option>

              {batches.map((batch) => {
                const product =
                  productMap.get(
                    batch.product_id,
                  );

                return (
                  <option
                    key={batch.id}
                    value={batch.id}
                  >
                    {batch.lot_number}
                    {product
                      ? ` · ${product.name}`
                      : ""}
                  </option>
                );
              })}
            </select>

            <select
              value={warrantyFilter}
              onChange={(event) =>
                setWarrantyFilter(
                  event.target
                    .value as WarrantyFilter,
                )
              }
            >
              <option value="all">
                All warranty states
              </option>

              <option value="active">
                Warranty active
              </option>

              <option value="expired">
                Warranty expired
              </option>

              <option value="none">
                No warranty
              </option>
            </select>
          </div>

          <div className="toolbar-footer">
            <div className="result-summary">
              <strong>
                {filteredUnits.length.toLocaleString()}
              </strong>{" "}
              assets
              {activeFilterCount > 0 && (
                <>
                  {" "}
                  · {activeFilterCount} filter
                  {activeFilterCount === 1
                    ? ""
                    : "s"}{" "}
                  active
                </>
              )}
            </div>

            {activeFilterCount > 0 && (
              <button
                type="button"
                className="clear-filters"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <h2>
                Serialized Asset Registry
              </h2>

              <p>
                Individual serialized units linked to
                their batch and current inventory
                location.
              </p>
            </div>

            <div className="header-count">
              {filteredUnits.length.toLocaleString()}
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner" />

              <span>
                Loading serialized assets...
              </span>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                #
              </div>

              <h3>
                {serializedUnits.length === 0
                  ? "No serial assets yet"
                  : "No matching serial assets"}
              </h3>

              <p>
                {serializedUnits.length === 0
                  ? "Serialized units will appear here when serialized inventory is received."
                  : "Try changing your search or filters."}
              </p>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Serial Number</th>
                      <th>Product</th>
                      <th>Batch / Lot</th>
                      <th>Status</th>
                      <th>Warehouse</th>
                      <th>Location</th>
                      <th>Cost</th>
                      <th>Warranty</th>
                      <th>Received</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedUnits.map(
                      (unit) => {
                        const product =
                          productMap.get(
                            unit.product_id,
                          );

                        const variant =
                          unit.variant_id
                            ? variantMap.get(
                                unit.variant_id,
                              )
                            : null;

                        const batch =
                          unit.batch_id
                            ? batchMap.get(
                                unit.batch_id,
                              )
                            : null;

                        const warehouse =
                          unit.warehouse_id
                            ? warehouseMap.get(
                                unit.warehouse_id,
                              )
                            : null;

                        const location =
                          unit.location_id
                            ? locationMap.get(
                                unit.location_id,
                              )
                            : null;

                        const warrantyState =
                          getWarrantyState(
                            unit.warranty_start,
                            unit.warranty_end,
                          );

                        return (
                          <tr
                            key={unit.id}
                          >
                            <td>
                              <button
                                type="button"
                                className="serial-link"
                                onClick={() =>
                                  router.push(
                                    `/serial-numbers/${unit.id}`,
                                  )
                                }
                              >
                                <span className="serial-main">
                                  {
                                    unit.serial_number
                                  }
                                </span>

                                {unit.barcode && (
                                  <span className="serial-barcode">
                                    Barcode:{" "}
                                    {
                                      unit.barcode
                                    }
                                  </span>
                                )}
                              </button>
                            </td>

                            <td>
                              <div className="product-cell">
                                <span className="product-name">
                                  {product?.name ??
                                    "Unknown product"}
                                </span>

                                <span className="product-meta">
                                  {[
                                    product?.brand,
                                    variant?.name,
                                    variant?.sku
                                      ? `SKU ${variant.sku}`
                                      : null,
                                  ]
                                    .filter(
                                      Boolean,
                                    )
                                    .join(
                                      " · ",
                                    ) ||
                                    "—"}
                                </span>
                              </div>
                            </td>

                            <td>
                              {batch ? (
                                <button
                                  type="button"
                                  className="batch-link"
                                  onClick={() =>
                                    router.push(
                                      `/inventory/batches/${batch.id}`,
                                    )
                                  }
                                >
                                  <span>
                                    {
                                      batch.lot_number
                                    }
                                  </span>

                                  <small>
                                    {formatDate(
                                      batch.received_at,
                                    )}
                                  </small>
                                </button>
                              ) : (
                                <span className="muted">
                                  No batch
                                </span>
                              )}
                            </td>

                            <td>
                              <span
                                className={statusClass(
                                  unit.status,
                                )}
                              >
                                <span className="status-dot" />

                                {titleCase(
                                  unit.status,
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="location-cell">
                                <span>
                                  {warehouse?.name ??
                                    "—"}
                                </span>

                                {warehouse?.code && (
                                  <small>
                                    {
                                      warehouse.code
                                    }
                                  </small>
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="location-cell">
                                <span>
                                  {location?.name ??
                                    "—"}
                                </span>

                                {location?.code && (
                                  <small>
                                    {
                                      location.code
                                    }
                                  </small>
                                )}
                              </div>
                            </td>

                            <td className="cost-cell">
                              {formatCurrency(
                                unit.cost_price,
                              )}
                            </td>

                            <td>
                              {warrantyState ===
                              "active" ? (
                                <div className="warranty-cell warranty-active">
                                  <span>
                                    Active
                                  </span>

                                  <small>
                                    Until{" "}
                                    {formatDate(
                                      unit.warranty_end,
                                    )}
                                  </small>
                                </div>
                              ) : warrantyState ===
                                "expired" ? (
                                <div className="warranty-cell warranty-expired">
                                  <span>
                                    Expired
                                  </span>

                                  <small>
                                    {formatDate(
                                      unit.warranty_end,
                                    )}
                                  </small>
                                </div>
                              ) : (
                                <span className="muted">
                                  No warranty
                                </span>
                              )}
                            </td>

                            <td className="date-cell">
                              {formatDate(
                                unit.received_at,
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <div className="pagination-info">
                  Showing{" "}
                  <strong>
                    {Math.min(
                      (page - 1) *
                        PAGE_SIZE +
                        1,
                      filteredUnits.length,
                    )}
                  </strong>{" "}
                  –{" "}
                  <strong>
                    {Math.min(
                      page * PAGE_SIZE,
                      filteredUnits.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong>
                    {filteredUnits.length}
                  </strong>
                </div>

                <div className="pagination-actions">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1,
                          ),
                      )
                    }
                  >
                    Previous
                  </button>

                  <span>
                    Page {page} of{" "}
                    {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      page >= totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1,
                          ),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {scannerOpen && (
        <div
          className="scanner-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Scan serial number"
        >
          <div className="scanner-dialog">
            <div className="scanner-header">
              <div>
                <div className="scanner-eyebrow">
                  SERIAL NUMBER
                </div>

                <h2>Scan Serial Number</h2>

                <p>
                  Scan the laptop barcode or serial number.
                  When found, the matching asset details will
                  open automatically.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button scanner-close"
                onClick={stopSerialScanner}
              >
                Close
              </button>
            </div>

            <div className="scanner-camera">
              <video
                ref={scannerVideoRef}
                muted
                playsInline
                autoPlay
              />

              <div className="scanner-frame">
                <span />
              </div>

              {!scannerBusy && !scannerMessage && (
                <div className="scanner-camera-hint">
                  Camera ready
                </div>
              )}
            </div>

            <div className="scanner-fallback">
              <strong>
                USB / Bluetooth Scanner
              </strong>

              <span>
                You can also scan directly into this field.
                Most barcode scanners behave like a keyboard
                and finish with Enter.
              </span>

              <div className="scanner-input-row">
                <input
                  autoFocus
                  value={scannerInput}
                  onChange={(event) =>
                    setScannerInput(event.target.value)
                  }
                  onKeyDown={handleSerialScannerKeyDown}
                  placeholder="Scan or enter serial number..."
                />

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    void submitSerialScannerInput()
                  }
                >
                  Open Asset
                </button>
              </div>
            </div>

            {scannerMessage && (
              <div className="scanner-message">
                {scannerMessage}
              </div>
            )}

            {scannerBusy && !scannerMessage && (
              <div className="scanner-status">
                Point the camera at the barcode...
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .serial-page {
          padding-bottom: 40px;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 24px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #64748b;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #16a34a;
          box-shadow: 0 0 0 3px #dcfce7;
        }

        .page-title {
          margin: 0;
          font-size: 30px;
          line-height: 1.15;
          font-weight: 750;
          letter-spacing: -0.025em;
          color: #0f172a;
        }

        .page-subtitle {
          margin: 7px 0 0;
          font-size: 14px;
          line-height: 1.5;
          color: #64748b;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .primary-button,
        .secondary-button {
          height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: white;
          color: #334155;
        }

        .secondary-button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .secondary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .primary-button {
          border: 1px solid #166534;
          background: #166534;
          color: white;
          box-shadow: 0 1px 2px rgba(22, 101, 52, 0.12);
        }

        .primary-button:hover {
          background: #14532d;
          border-color: #14532d;
        }

        .scan-button-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          border-radius: 5px;
          font-size: 13px;
          line-height: 1;
        }

        .scanner-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 23, 42, 0.68);
          backdrop-filter: blur(5px);
        }

        .scanner-dialog {
          width: min(620px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: white;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
        }

        .scanner-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .scanner-eyebrow {
          margin-bottom: 5px;
          color: #166534;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .scanner-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 19px;
          font-weight: 750;
        }

        .scanner-header p {
          max-width: 440px;
          margin: 6px 0 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
        }

        .scanner-close {
          flex-shrink: 0;
        }

        .scanner-camera {
          position: relative;
          margin: 20px;
          overflow: hidden;
          aspect-ratio: 16 / 10;
          border-radius: 12px;
          background: #020617;
        }

        .scanner-camera video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .scanner-frame {
          position: absolute;
          inset: 18% 10%;
          border: 2px solid rgba(255, 255, 255, 0.9);
          border-radius: 10px;
          pointer-events: none;
        }

        .scanner-frame::before,
        .scanner-frame::after,
        .scanner-frame span::before,
        .scanner-frame span::after {
          position: absolute;
          width: 25px;
          height: 25px;
          content: "";
        }

        .scanner-frame::before {
          top: -2px;
          left: -2px;
          border-top: 3px solid #22c55e;
          border-left: 3px solid #22c55e;
        }

        .scanner-frame::after {
          top: -2px;
          right: -2px;
          border-top: 3px solid #22c55e;
          border-right: 3px solid #22c55e;
        }

        .scanner-frame span::before {
          bottom: -2px;
          left: -2px;
          border-bottom: 3px solid #22c55e;
          border-left: 3px solid #22c55e;
        }

        .scanner-frame span::after {
          right: -2px;
          bottom: -2px;
          border-right: 3px solid #22c55e;
          border-bottom: 3px solid #22c55e;
        }

        .scanner-camera-hint {
          position: absolute;
          left: 50%;
          bottom: 13px;
          transform: translateX(-50%);
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(2, 6, 23, 0.72);
          color: white;
          font-size: 10px;
        }

        .scanner-fallback {
          margin: 0 20px 20px;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          background: #f8fafc;
        }

        .scanner-fallback strong {
          display: block;
          color: #334155;
          font-size: 12px;
        }

        .scanner-fallback > span {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
        }

        .scanner-input-row {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .scanner-input-row input {
          min-width: 0;
          flex: 1;
          height: 40px;
          padding: 0 12px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          outline: none;
          background: white;
          color: #334155;
          font-size: 13px;
        }

        .scanner-input-row input:focus {
          border-color: #86a98f;
          box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
        }

        .scanner-message,
        .scanner-status {
          margin: 0 20px 20px;
          padding: 11px 13px;
          border-radius: 9px;
          background: #f0fdf4;
          color: #166534;
          font-size: 11px;
          line-height: 1.5;
        }

        .error-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
          padding: 14px 16px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fef2f2;
          color: #991b1b;
        }

        .error-card strong {
          display: block;
          font-size: 13px;
        }

        .error-card p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #b91c1c;
        }

        .error-card button {
          border: 1px solid #fecaca;
          background: white;
          color: #991b1b;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(
            6,
            minmax(0, 1fr)
          );
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          min-width: 0;
          padding: 17px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .stat-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 650;
          color: #64748b;
        }

        .stat-value {
          margin-top: 8px;
          font-size: 25px;
          line-height: 1;
          font-weight: 750;
          letter-spacing: -0.02em;
          color: #0f172a;
        }

        .stat-meta {
          margin-top: 9px;
          font-size: 11px;
          color: #94a3b8;
        }

        .stat-meta.positive {
          color: #15803d;
        }

        .stat-meta.warning-text {
          color: #b45309;
        }

        .stat-meta.danger-text {
          color: #dc2626;
        }

        .toolbar-card {
          margin-bottom: 18px;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .toolbar-main {
          display: grid;
          grid-template-columns:
            minmax(280px, 1.8fr)
            minmax(145px, 0.8fr)
            minmax(155px, 0.9fr)
            minmax(155px, 0.9fr)
            minmax(175px, 1fr)
            minmax(165px, 0.9fr);
          gap: 9px;
        }

        .search-wrap {
          position: relative;
          min-width: 0;
        }

        .search-wrap input,
        .toolbar-main select {
          width: 100%;
          height: 40px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: white;
          color: #334155;
          font-size: 13px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .search-wrap input {
          padding: 0 38px 0 37px;
        }

        .toolbar-main select {
          padding: 0 30px 0 11px;
        }

        .search-wrap input:focus,
        .toolbar-main select:focus {
          border-color: #86a98f;
          box-shadow: 0 0 0 3px
            rgba(22, 101, 52, 0.08);
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-52%);
          font-size: 18px;
          color: #94a3b8;
          pointer-events: none;
        }

        .clear-search {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 25px;
          height: 25px;
          border: 0;
          border-radius: 6px;
          background: #f1f5f9;
          color: #64748b;
          cursor: pointer;
          font-size: 17px;
          line-height: 1;
        }

        .toolbar-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 11px;
          padding: 0 2px;
        }

        .result-summary {
          font-size: 12px;
          color: #94a3b8;
        }

        .result-summary strong {
          color: #475569;
        }

        .clear-filters {
          border: 0;
          background: transparent;
          color: #166534;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
        }

        .content-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: white;
          box-shadow: 0 2px 8px
            rgba(15, 23, 42, 0.035);
        }

        .content-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 17px 18px;
          border-bottom: 1px solid #e5e7eb;
        }

        .content-card-header h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #1e293b;
        }

        .content-card-header p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #94a3b8;
        }

        .header-count {
          min-width: 36px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          border-radius: 8px;
          background: #f1f5f9;
          color: #475569;
          font-size: 12px;
          font-weight: 700;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 1380px;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th {
          height: 42px;
          padding: 0 13px;
          border-bottom: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #64748b;
          font-size: 10.5px;
          font-weight: 750;
          letter-spacing: 0.045em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        td {
          height: 72px;
          padding: 10px 13px;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          font-size: 12px;
          vertical-align: middle;
        }

        tbody tr:hover {
          background: #fafcfb;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        th:nth-child(1) {
          width: 205px;
        }

        th:nth-child(2) {
          width: 235px;
        }

        th:nth-child(3) {
          width: 165px;
        }

        th:nth-child(4) {
          width: 125px;
        }

        th:nth-child(5) {
          width: 145px;
        }

        th:nth-child(6) {
          width: 135px;
        }

        th:nth-child(7) {
          width: 105px;
        }

        th:nth-child(8) {
          width: 150px;
        }

        th:nth-child(9) {
          width: 115px;
        }

        .serial-link,
        .batch-link {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .serial-main {
          color: #166534;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .serial-link:hover .serial-main {
          text-decoration: underline;
        }

        .serial-barcode {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 10.5px;
          white-space: nowrap;
        }

        .product-cell,
        .location-cell,
        .warranty-cell {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .product-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #1e293b;
          font-weight: 650;
        }

        .product-meta {
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #94a3b8;
          font-size: 10.5px;
        }

        .batch-link span {
          color: #166534;
          font-weight: 650;
          white-space: nowrap;
        }

        .batch-link:hover span {
          text-decoration: underline;
        }

        .batch-link small {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 10.5px;
        }

        .muted {
          color: #94a3b8;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 26px;
          padding: 0 8px;
          border: 1px solid transparent;
          border-radius: 7px;
          font-size: 10.5px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: currentColor;
        }

        .status-available {
          border-color: #bbf7d0;
          background: #f0fdf4;
          color: #15803d;
        }

        .status-reserved {
          border-color: #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .status-sold {
          border-color: #e2e8f0;
          background: #f8fafc;
          color: #64748b;
        }

        .status-returned {
          border-color: #ddd6fe;
          background: #f5f3ff;
          color: #6d28d9;
        }

        .status-warning {
          border-color: #fde68a;
          background: #fffbeb;
          color: #b45309;
        }

        .status-danger {
          border-color: #fecaca;
          background: #fef2f2;
          color: #dc2626;
        }

        .status-neutral {
          border-color: #e2e8f0;
          background: #f8fafc;
          color: #64748b;
        }

        .location-cell span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #334155;
          font-weight: 600;
        }

        .location-cell small {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 10.5px;
          white-space: nowrap;
        }

        .cost-cell {
          color: #1e293b;
          font-weight: 650;
          white-space: nowrap;
        }

        .warranty-cell span {
          font-weight: 650;
          white-space: nowrap;
        }

        .warranty-cell small {
          margin-top: 4px;
          color: #94a3b8;
          font-size: 10.5px;
          white-space: nowrap;
        }

        .warranty-active span {
          color: #15803d;
        }

        .warranty-expired span {
          color: #dc2626;
        }

        .date-cell {
          color: #64748b;
          white-space: nowrap;
        }

        .loading-state {
          min-height: 330px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #94a3b8;
          font-size: 13px;
        }

        .spinner {
          width: 25px;
          height: 25px;
          border: 2px solid #e2e8f0;
          border-top-color: #166534;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .empty-state {
          min-height: 330px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          border-radius: 12px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 21px;
          font-weight: 700;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #334155;
        }

        .empty-state p {
          max-width: 460px;
          margin: 7px 0 16px;
          font-size: 12px;
          line-height: 1.55;
          color: #94a3b8;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 13px 16px;
          border-top: 1px solid #e5e7eb;
        }

        .pagination-info {
          color: #94a3b8;
          font-size: 11.5px;
        }

        .pagination-info strong {
          color: #475569;
        }

        .pagination-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .pagination-actions button {
          height: 32px;
          padding: 0 11px;
          border: 1px solid #dbe1e8;
          border-radius: 7px;
          background: white;
          color: #475569;
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
        }

        .pagination-actions button:hover:not(
            :disabled
          ) {
          background: #f8fafc;
        }

        .pagination-actions button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .pagination-actions span {
          min-width: 85px;
          text-align: center;
          color: #64748b;
          font-size: 11px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 600px) {
          .scanner-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .scanner-dialog {
            max-height: 94vh;
            border-radius: 18px 18px 0 0;
          }

          .scanner-header {
            padding: 17px;
          }

          .scanner-camera {
            margin: 15px;
          }

          .scanner-fallback {
            margin: 0 15px 15px;
          }

          .scanner-input-row {
            flex-direction: column;
          }

          .scanner-input-row button {
            width: 100%;
          }
        }

        @media (max-width: 1450px) {
          .stats-grid {
            grid-template-columns: repeat(
              3,
              minmax(0, 1fr)
            );
          }

          .toolbar-main {
            grid-template-columns:
              minmax(260px, 1.6fr)
              repeat(
                3,
                minmax(145px, 1fr)
              );
          }
        }

        @media (max-width: 1050px) {
          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .toolbar-main {
            grid-template-columns:
              repeat(
                2,
                minmax(0, 1fr)
              );
          }
        }

        @media (max-width: 700px) {
          .stats-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .toolbar-main {
            grid-template-columns: 1fr;
          }

          .header-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .header-actions button {
            width: 100%;
          }

          .pagination {
            align-items: flex-start;
            flex-direction: column;
          }

          .pagination-actions {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </AppShell>
  );
}