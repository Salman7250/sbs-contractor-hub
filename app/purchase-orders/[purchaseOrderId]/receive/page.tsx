"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import JsBarcode from "jsbarcode";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type POStatus =
  | "draft"
  | "sent"
  | "confirmed"
  | "partially_received"
  | "received"
  | "cancelled";

type Warehouse = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  is_default: boolean;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
  location_type: string;
  is_active: boolean;
};

type Product = {
  id: string;
  name: string | null;
};

type Variant = {
  id: string;
  name: string | null;
  sku: string | null;
};

type Supplier = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
};

type PurchaseOrderItem = {
  id: string;
  company_id: string;
  purchase_order_id: string;
  product_id: string;
  variant_id: string | null;
  supplier_product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  supplier_sku: string | null;
  description: string | null;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  product?: Product | null;
  variant?: Variant | null;
};

type PurchaseOrder = {
  id: string;
  company_id: string;
  supplier_id: string;
  po_number: string;
  status: POStatus;
  currency: string;
  order_date: string;
  expected_date: string | null;
  warehouse_id: string | null;
  supplier_reference: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  supplier?: Supplier | null;
};

type ReceiveLine = {
  poItemId: string;
  quantity: number;
  lotNumber: string;
  serialText: string;
};

type ValidationIssue = {
  row: number;
  message: string;
};

type ExcelRow = {
  rowNumber: number;
  productSku: string;
  variantSku: string;
  supplierSku: string;
  serialNumber: string;
};

type SerialImportPreview = {
  total: number;
  groupedSerials: Record<string, string[]>;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

const clean = (value: unknown) => String(value ?? "").trim();

const readColumn = (
  row: Record<string, unknown>,
  aliases: string[]
) => {
  const entries = Object.entries(row);
  const normalizedAliases = aliases.map(normalize);
  const match = entries.find(([key]) =>
    normalizedAliases.includes(normalize(key))
  );
  return clean(match?.[1]);
};

const numberValue = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);

const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(value);

const trackingLabel = () => "Batch + Serial";

const getRemaining = (item: PurchaseOrderItem) =>
  Math.max(
    0,
    numberValue(item.quantity) -
      numberValue(item.received_quantity)
  );

const parseSerialText = (text: string) =>
  text
    .split(/\r?\n|,|;/)
    .map((value) => value.trim())
    .filter(Boolean);

export default function ReceivePurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();

  const purchaseOrderId = String(
    params?.purchaseOrderId || ""
  );

  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState("");

  const [purchaseOrder, setPurchaseOrder] =
    useState<PurchaseOrder | null>(null);

  const [items, setItems] = useState<PurchaseOrderItem[]>([]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");

  const [notes, setNotes] = useState("");

  const [batchNumber, setBatchNumber] = useState("");

  const [receiveLines, setReceiveLines] = useState<
    Record<string, ReceiveLine>
  >({});

  const [selectedItemId, setSelectedItemId] = useState("");

  const [excelIssues, setExcelIssues] = useState<
    ValidationIssue[]
  >([]);

  const [excelFileName, setExcelFileName] = useState("");
  const [serialImportPreview, setSerialImportPreview] =
    useState<SerialImportPreview | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [scannerInput, setScannerInput] = useState("");
  const [labelsReady, setLabelsReady] = useState(false);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerTimerRef = useRef<number | null>(null);

  const activeItems = useMemo(
    () => items.filter((item) => getRemaining(item) > 0),
    [items]
  );

  const selectedItem = useMemo(
    () =>
      activeItems.find(
        (item) => item.id === selectedItemId
      ) || null,
    [activeItems, selectedItemId]
  );

  const selectedLine = selectedItem
    ? receiveLines[selectedItem.id]
    : undefined;

  const totalReceivingQuantity = useMemo(
    () =>
      Object.values(receiveLines).reduce(
        (sum, line) => sum + numberValue(line.quantity),
        0
      ),
    [receiveLines]
  );

  const totalSerials = useMemo(
    () =>
      Object.values(receiveLines).reduce(
        (sum, line) =>
          sum + parseSerialText(line.serialText).length,
        0
      ),
    [receiveLines]
  );

  const loadCompany = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error(
        "Your session has expired. Please sign in again."
      );
    }

    const { data, error } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.company_id) {
      throw new Error(
        "No company workspace is available for your account."
      );
    }

    return data.company_id as string;
  }, [supabase]);

  const loadPurchaseOrder = useCallback(
    async (currentCompanyId: string) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          `
            id,
            company_id,
            supplier_id,
            po_number,
            status,
            currency,
            order_date,
            expected_date,
            warehouse_id,
            supplier_reference,
            subtotal,
            discount_amount,
            tax_amount,
            shipping_amount,
            total_amount,
            notes,
            terms,
            supplier:suppliers(
              id,
              display_name,
              legal_name
            )
          `
        )
        .eq("company_id", currentCompanyId)
        .eq("id", purchaseOrderId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error(
          "Purchase order was not found."
        );
      }

      setPurchaseOrder(
        data as unknown as PurchaseOrder
      );

      if (data.warehouse_id) {
        setWarehouseId(data.warehouse_id);
      }

      setNotes(data.notes || "");
      setBatchNumber((current) =>
        current ||
        `GRN-${String(data.po_number || "PO").replace(/[^A-Za-z0-9-]/g, "-")}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`
      );
    },
    [purchaseOrderId, supabase]
  );

  const loadItems = useCallback(
    async (currentCompanyId: string) => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select(
          `
            id,
            company_id,
            purchase_order_id,
            product_id,
            variant_id,
            supplier_product_id,
            product_name,
            variant_name,
            sku,
            supplier_sku,
            description,
            quantity,
            received_quantity,
            unit_cost,
            discount_amount,
            tax_amount,
            line_total,
            product:products(
              id,
              name
            ),
            variant:product_variants(
              id,
              name,
              sku
            )
          `
        )
        .eq("company_id", currentCompanyId)
        .eq(
          "purchase_order_id",
          purchaseOrderId
        )
        .order("created_at", {
          ascending: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      const loadedItems =
        (data || []) as unknown as PurchaseOrderItem[];

      setItems(loadedItems);

      const initialBatch =
        batchNumber ||
        `GRN-${String(purchaseOrderId).slice(0, 8).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

      setBatchNumber((current) => current || initialBatch);

      const initialLines: Record<
        string,
        ReceiveLine
      > = {};

      loadedItems.forEach((item) => {
        const remaining = getRemaining(item);

        initialLines[item.id] = {
          poItemId: item.id,
          quantity: remaining > 0 ? remaining : 0,
          lotNumber: initialBatch,
          serialText: "",
        };
      });

      setReceiveLines(initialLines);

      const firstOpen = loadedItems.find(
        (item) => getRemaining(item) > 0
      );

      if (firstOpen) {
        setSelectedItemId(firstOpen.id);
      }
    },
    [batchNumber, purchaseOrderId, supabase]
  );

  const loadWarehouses = useCallback(
    async (currentCompanyId: string) => {
      const { data, error } = await supabase
        .from("warehouses")
        .select(
          `
            id,
            name,
            code,
            is_active,
            is_default
          `
        )
        .eq("company_id", currentCompanyId)
        .order("is_default", {
          ascending: false,
        })
        .order("name", {
          ascending: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      const activeWarehouses =
        ((data || []) as Warehouse[]).filter(
          (warehouse) => warehouse.is_active
        );

      setWarehouses(activeWarehouses);

      if (!warehouseId) {
        const defaultWarehouse =
          activeWarehouses.find(
            (warehouse) => warehouse.is_default
          ) || activeWarehouses[0];

        if (defaultWarehouse) {
          setWarehouseId(defaultWarehouse.id);
        }
      }
    },
    [supabase, warehouseId]
  );

  const loadLocations = useCallback(
    async (currentWarehouseId: string) => {
      if (!currentWarehouseId || !companyId) {
        setLocations([]);
        setLocationId("");
        return;
      }

      const { data, error } = await supabase
        .from("warehouse_locations")
        .select(
          `
            id,
            warehouse_id,
            name,
            code,
            location_type,
            is_active
          `
        )
        .eq("company_id", companyId)
        .eq(
          "warehouse_id",
          currentWarehouseId
        )
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        });

      if (error) {
        throw new Error(error.message);
      }

      const activeLocations =
        (data || []) as Location[];

      setLocations(activeLocations);

      if (
        locationId &&
        !activeLocations.some(
          (location) =>
            location.id === locationId
        )
      ) {
        setLocationId("");
      }

      const receivingLocation =
        activeLocations.find(
          (location) =>
            location.location_type ===
            "receiving"
        );

      if (!locationId && receivingLocation) {
        setLocationId(receivingLocation.id);
      }
    },
    [
      companyId,
      locationId,
      supabase,
    ]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const currentCompanyId =
          await loadCompany();

        if (cancelled) return;

        setCompanyId(currentCompanyId);

        await loadPurchaseOrder(
          currentCompanyId
        );

        await loadItems(
          currentCompanyId
        );

        await loadWarehouses(
          currentCompanyId
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load purchase order."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    loadCompany,
    loadItems,
    loadPurchaseOrder,
    loadWarehouses,
  ]);

  useEffect(() => {
    if (!companyId || !warehouseId) {
      return;
    }

    void loadLocations(
      warehouseId
    ).catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load warehouse locations."
      );
    });
  }, [
    companyId,
    warehouseId,
    loadLocations,
  ]);

  const updateReceiveLine = (
    itemId: string,
    patch: Partial<ReceiveLine>
  ) => {
    setReceiveLines((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        ...patch,
      },
    }));
  };

  const updateBatchNumber = (value: string) => {
    setBatchNumber(value);
    setReceiveLines((current) => {
      const next = { ...current };
      Object.keys(next).forEach((itemId) => {
        next[itemId] = { ...next[itemId], lotNumber: value };
      });
      return next;
    });
  };

  const addSerialToSelectedLine = (value: string) => {
    const serial = value.trim();

    if (!selectedItem || !serial) {
      return false;
    }

    const currentSerials = parseSerialText(
      receiveLines[selectedItem.id]?.serialText || ""
    );
    const duplicate = currentSerials.some(
      (entry) => normalize(entry) === normalize(serial)
    );

    if (duplicate) {
      setScannerMessage("This serial has already been added.");
      return false;
    }

    updateReceiveLine(selectedItem.id, {
      serialText: [...currentSerials, serial].join("\n"),
    });
    setScannerMessage(`Serial captured: ${serial}`);
    return true;
  };

  const stopScanner = () => {
    if (scannerTimerRef.current !== null) {
      window.clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }

    scannerStreamRef.current?.getTracks().forEach((track) => track.stop());
    scannerStreamRef.current = null;
    setScannerOpen(false);
  };

  const startScanner = async () => {
    if (!selectedItem) {
      setScannerMessage("Select a purchase-order product first.");
      return;
    }

    const barcodeDetector = (
      window as Window & {
        BarcodeDetector?: new (options?: {
          formats?: string[];
        }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerMessage("Camera access is unavailable in this browser.");
      return;
    }

    try {
      setScannerMessage("");
      setScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      scannerStreamRef.current = stream;

      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream;
        await scannerVideoRef.current.play();
      }

      const detector = barcodeDetector
        ? new barcodeDetector({
            formats: [
              "code_128",
              "code_39",
              "data_matrix",
              "qr_code",
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
            ],
          })
        : null;

      const scan = async () => {
        if (!scannerVideoRef.current || !scannerStreamRef.current) {
          return;
        }

        try {
          const detections = detector
            ? await detector.detect(scannerVideoRef.current)
            : [];
          const value = detections[0]?.rawValue?.trim();

          if (value) {
            addSerialToSelectedLine(value);
            stopScanner();
            return;
          }
        } catch {
          setScannerMessage("Unable to read a barcode. Adjust the camera and try again.");
        }

        scannerTimerRef.current = window.setTimeout(() => {
          void scan();
        }, 250);
      };

      void scan();
    } catch (error) {
      stopScanner();
      setScannerMessage(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied."
          : "Unable to start the camera scanner."
      );
    }
  };

  const submitScannerInput = () => {
    const value = scannerInput.trim();
    if (!value) return;
    if (addSerialToSelectedLine(value)) {
      setScannerInput("");
      stopScanner();
    }
  };

  const handleScannerInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitScannerInput();
    }
  };

  const prepareLabels = () => {
    setLabelsReady(true);
    window.setTimeout(() => window.print(), 150);
  };

  useEffect(() => {
    if (!labelsReady) return;

    document
      .querySelectorAll<SVGSVGElement>("[data-receiving-barcode]")
      .forEach((element) => {
        const value = element.dataset.receivingBarcode;
        if (!value) return;

        JsBarcode(element, value, {
          format: "CODE128",
          displayValue: false,
          height: 34,
          margin: 0,
          width: 1.4,
        });
      });
  }, [labelsReady, receiveLines]);

  useEffect(() => () => stopScanner(), []);

  /*
   * Every valid SKU source that can identify an
   * open PO line.
   *
   * Product table itself does NOT contain an SKU.
   * SKU belongs to the PO line / variant / supplier
   * product relationship.
   */
  const getItemIdentifiers = (
    item: PurchaseOrderItem
  ) => {
    const values = new Set<string>();

    [
      item.sku,
      item.supplier_sku,
      item.variant?.sku,
    ].forEach((value) => {
      const normalized = normalize(value);

      if (normalized) {
        values.add(normalized);
      }
    });

    return values;
  };

  /*
   * Match an Excel row to exactly one open PO line.
   *
   * Priority:
   * 1. Variant SKU
   * 2. Supplier SKU
   * 3. PO line SKU
   * 4. Any unique identifier
   * 5. If there is only one open PO line,
   *    allow a blank/unknown SKU and assign it there.
   */
  const matchExcelRowToPOItem = (
    row: ExcelRow
  ): PurchaseOrderItem | null => {
    const productSku = normalize(
      row.productSku
    );

    const variantSku = normalize(
      row.variantSku
    );

    const supplierSku = normalize(
      row.supplierSku
    );

    const openItems = activeItems;

    if (!openItems.length) {
      return null;
    }

    /*
     * Variant SKU is the strongest match because
     * variants own SKUs in our architecture.
     */
    if (variantSku) {
      const matches = openItems.filter(
        (item) =>
          normalize(item.variant?.sku) ===
            variantSku ||
          normalize(item.sku) === variantSku
      );

      if (matches.length === 1) {
        return matches[0];
      }

      if (matches.length > 1) {
        return null;
      }
    }

    /*
     * Supplier SKU.
     */
    if (supplierSku) {
      const matches = openItems.filter(
        (item) =>
          normalize(item.supplier_sku) ===
          supplierSku
      );

      if (matches.length === 1) {
        return matches[0];
      }

      if (matches.length > 1) {
        return null;
      }
    }

    /*
     * PO line SKU.
     */
    if (productSku) {
      const matches = openItems.filter(
        (item) =>
          normalize(item.sku) === productSku
      );

      if (matches.length === 1) {
        return matches[0];
      }

      if (matches.length > 1) {
        return null;
      }
    }

    /*
     * Cross-check all known identifiers.
     */
    const provided = [
      productSku,
      variantSku,
      supplierSku,
    ].filter(Boolean);

    if (provided.length) {
      const scored = openItems
        .map((item) => {
          const identifiers =
            getItemIdentifiers(item);

          let score = 0;

          if (
            productSku &&
            identifiers.has(productSku)
          ) {
            score += 5;
          }

          if (
            variantSku &&
            identifiers.has(variantSku)
          ) {
            score += 10;
          }

          if (
            supplierSku &&
            identifiers.has(supplierSku)
          ) {
            score += 8;
          }

          return {
            item,
            score,
          };
        })
        .filter(
          (entry) => entry.score > 0
        )
        .sort(
          (a, b) =>
            b.score - a.score
        );

      if (
        scored.length === 1
      ) {
        return scored[0].item;
      }

      if (
        scored.length > 1 &&
        scored[0].score >
          scored[1].score
      ) {
        return scored[0].item;
      }
    }

    /*
     * If this PO only has one open line,
     * SKU is not necessary to identify it.
     */
    if (openItems.length === 1) {
      return openItems[0];
    }

    return null;
  };

  const validateSerialsAgainstCompany =
    async (
      serials: string[]
    ): Promise<string[]> => {
      const normalized =
        serials
          .map((serial) =>
            serial.trim()
          )
          .filter(Boolean);

      const issues: string[] = [];

      const seen = new Set<string>();

      for (const serial of normalized) {
        const key =
          normalize(serial);

        if (seen.has(key)) {
          issues.push(
            `Duplicate serial number "${serial}" in the import.`
          );
        }

        seen.add(key);
      }

      if (!normalized.length) {
        return issues;
      }

      const { data, error } =
        await supabase
          .from("serialized_units")
          .select("serial_number")
          .eq(
            "company_id",
            companyId
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const existing =
        new Set(
          (data || []).map(
            (row) =>
              normalize(
                row.serial_number
              )
          )
        );

      for (const serial of normalized) {
        if (
          existing.has(
            normalize(serial)
          )
        ) {
          issues.push(
            `Serial number "${serial}" already exists in this company.`
          );
        }
      }

      return issues;
    };

  const handleExcelImport = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setExcelIssues([]);
    setErrorMessage("");
    setSuccessMessage("");
    setExcelFileName(file.name);

    try {
      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          type: "array",
        });

      const firstSheetName =
        workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error(
          "The Excel workbook does not contain a worksheet."
        );
      }

      const worksheet =
        workbook.Sheets[
          firstSheetName
        ];

      const rows =
        XLSX.utils.sheet_to_json<
          Record<string, unknown>
        >(worksheet, {
          defval: "",
        });

      if (!rows.length) {
        throw new Error(
          "The Excel worksheet is empty."
        );
      }

      const parsedRows: ExcelRow[] =
        rows.map(
          (row, index) => ({
            rowNumber: index + 2,

            productSku: readColumn(row, [
              "Product SKU",
              "SKU",
              "Product Code",
            ]),

            variantSku: readColumn(row, [
              "Variant SKU",
              "Variant Code",
            ]),

            supplierSku: readColumn(row, [
              "Supplier SKU",
              "Supplier Code",
            ]),

            serialNumber: readColumn(row, [
              "Serial",
              "Serial Number",
              "S/N",
              "SN",
              "Service Tag",
              "Asset Tag",
              "Barcode",
            ]),
          })
        );

      const issues: ValidationIssue[] =
        [];

      const groupedSerials =
        new Map<
          string,
          string[]
        >();

      for (const row of parsedRows) {
        if (!row.serialNumber) {
          issues.push({
            row: row.rowNumber,
            message:
              "Serial Number is required.",
          });

          continue;
        }

        const matchedItem =
          matchExcelRowToPOItem(
            row
          );

        if (!matchedItem) {
          const identifier =
            row.variantSku ||
            row.productSku ||
            row.supplierSku ||
            "(no SKU provided)";

          issues.push({
            row: row.rowNumber,
            message:
              `No unique open PO line matches "${identifier}". Use the actual Variant SKU, PO SKU, Supplier SKU, or leave the SKU fields blank when this PO has only one open line.`,
          });

          continue;
        }

        if (
          getRemaining(
            matchedItem
          ) <= 0
        ) {
          issues.push({
            row: row.rowNumber,
            message:
              `PO line "${matchedItem.product_name}" has no remaining quantity to receive.`,
          });

          continue;
        }

        const current =
          groupedSerials.get(
            matchedItem.id
          ) || [];

        current.push(
          row.serialNumber
        );

        groupedSerials.set(
          matchedItem.id,
          current
        );
      }

      for (const [
        itemId,
        serials,
      ] of groupedSerials.entries()) {
        const item =
          activeItems.find(
            (candidate) =>
              candidate.id ===
              itemId
          );

        if (!item) {
          continue;
        }

        const remaining =
          getRemaining(item);

        if (
          serials.length >
          remaining
        ) {
          issues.push({
            row: 0,
            message:
              `${item.product_name}${item.variant_name ? ` — ${item.variant_name}` : ""}: Excel contains ${serials.length} serial numbers but only ${remaining} units remain on the PO.`,
          });
        }
      }

      const allSerials =
        parsedRows
          .map(
            (row) =>
              row.serialNumber
          )
          .filter(Boolean);

      /*
       * Only check existing serials if the
       * import itself hasn't already failed
       * for missing identifiers.
       */
      if (allSerials.length) {
        const duplicateIssues =
          await validateSerialsAgainstCompany(
            allSerials
          );

        duplicateIssues.forEach(
          (message) => {
            issues.push({
              row: 0,
              message,
            });
          }
        );
      }

      if (issues.length) {
        setExcelIssues(
          issues
        );

        return;
      }

      setSerialImportPreview({
        total: allSerials.length,
        groupedSerials: Object.fromEntries(groupedSerials),
      });
      setSuccessMessage(
        `Import preview ready for ${allSerials.length} serial number${allSerials.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      setExcelIssues([
        {
          row: 0,
          message:
            error instanceof Error
              ? error.message
              : "Unable to read the Excel file.",
        },
      ]);
    } finally {
      event.target.value = "";
    }
  };

  const confirmSerialImport = () => {
    if (!serialImportPreview) {
      return;
    }

    const newLines = { ...receiveLines };

    Object.entries(serialImportPreview.groupedSerials).forEach(
      ([itemId, serials]) => {
        const current = newLines[itemId];
        if (!current) return;

        newLines[itemId] = {
          ...current,
          quantity: Math.max(numberValue(current.quantity), serials.length),
          serialText: serials.join("\n"),
        };
      }
    );

    setReceiveLines(newLines);
    const firstImportedItem = Object.keys(
      serialImportPreview.groupedSerials
    )[0];
    if (firstImportedItem) {
      setSelectedItemId(firstImportedItem);
    }
    setSuccessMessage(
      `Added ${serialImportPreview.total} serial number${serialImportPreview.total === 1 ? "" : "s"} to the receiving lines.`
    );
    setSerialImportPreview(null);
  };

  /*
   * Generates a PO-specific workbook.
   *
   * Sheet 1:
   * Serial Import
   *
   * Sheet 2:
   * Open PO Lines
   *
   * Sheet 3:
   * Instructions
   */
  const downloadTemplate = () => {
    const workbook =
      XLSX.utils.book_new();

    const templateRows = [
      {
        "Product SKU": "",
        "Variant SKU": "",
        "Supplier SKU": "",
        "Serial Number": "",
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        templateRows
      );

    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 28 },
      { wch: 36 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Serial Import"
    );

    const openLines =
      activeItems.map(
        (item) => ({
          "PO Number":
            purchaseOrder?.po_number ||
            "",

          "PO Line ID":
            item.id,

          "Product Name":
            item.product_name,

          "Variant Name":
            item.variant_name ||
            "",

          "Variant SKU":
            item.variant?.sku ||
            "",

          "PO Line SKU":
            item.sku ||
            "",

          "Supplier SKU":
            item.supplier_sku ||
            "",

          "Ordered Qty":
            numberValue(
              item.quantity
            ),

          "Already Received":
            numberValue(
              item.received_quantity
            ),

          "Remaining Qty":
            getRemaining(item),

          "Tracking":
            trackingLabel(),
        })
      );

    const linesSheet =
      XLSX.utils.json_to_sheet(
        openLines
      );

    linesSheet["!cols"] = [
      { wch: 18 },
      { wch: 38 },
      { wch: 30 },
      { wch: 28 },
      { wch: 28 },
      { wch: 24 },
      { wch: 28 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      linesSheet,
      "Open PO Lines"
    );

    const instructions = [
      {
        Field:
          "Serial Number",
        Required:
          "YES",
        Description:
          "Enter the actual physical serial number of the received unit.",
      },
      {
        Field:
          "Variant SKU",
        Required:
          "Recommended",
        Description:
          "Use the Variant SKU shown on the Open PO Lines sheet when available.",
      },
      {
        Field:
          "Product SKU",
        Required:
          "Optional",
        Description:
          "Use the PO Line SKU shown on the Open PO Lines sheet if applicable.",
      },
      {
        Field:
          "Supplier SKU",
        Required:
          "Optional",
        Description:
          "Use the supplier SKU if that is how the supplier identifies the item.",
      },
      {
        Field:
          "Important",
        Required:
          "",
        Description:
          "Do not invent serial numbers. Only enter serial numbers physically present on received units.",
      },
      {
        Field:
          "Important",
        Required:
          "",
        Description:
          "Duplicate or already-registered serial numbers will be rejected.",
      },
      {
        Field:
          "Important",
        Required:
          "",
        Description:
          "If this PO has only one open line, the SKU columns can be left blank and SBS will assign the serials to that line.",
      },
    ];

    const instructionsSheet =
      XLSX.utils.json_to_sheet(
        instructions
      );

    instructionsSheet["!cols"] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 105 },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      instructionsSheet,
      "Instructions"
    );

    XLSX.writeFile(
      workbook,
      `${purchaseOrder?.po_number || "SBS-PO"}_Serial_Import_Template.xlsx`
    );
  };

  const validateBeforeReceive =
    (): string[] => {
      const errors: string[] =
        [];

      if (!warehouseId) {
        errors.push(
          "Please select a warehouse."
        );
      }

      if (!batchNumber.trim()) {
        errors.push(
          "Please enter a receiving batch / GRN number."
        );
      }

      if (
        locations.length > 0 &&
        !locationId
      ) {
        errors.push(
          "Please select a warehouse location."
        );
      }

      if (
        !activeItems.length
      ) {
        errors.push(
          "There are no open PO lines remaining to receive."
        );
      }

      const seenSerials =
        new Set<string>();

      for (const item of activeItems) {
        const line =
          receiveLines[
            item.id
          ];

        if (!line) {
          continue;
        }

        const qty =
          numberValue(
            line.quantity
          );

        const remaining =
          getRemaining(item);

        if (qty <= 0) {
          continue;
        }

        if (
          qty > remaining
        ) {
          errors.push(
            `${item.product_name}${item.variant_name ? ` — ${item.variant_name}` : ""}: receiving quantity ${qty} exceeds remaining quantity ${remaining}.`
          );
        }

        if (
          !line.lotNumber.trim()
        ) {
          errors.push(
            `${item.product_name}${item.variant_name ? ` — ${item.variant_name}` : ""}: Lot / Batch number is required.`
          );
        }

        const serials =
          parseSerialText(
            line.serialText
          );

        if (
          serials.length >
          qty
        ) {
          errors.push(
            `${item.product_name}${item.variant_name ? ` — ${item.variant_name}` : ""}: ${serials.length} serial numbers were entered for a receiving quantity of ${qty}.`
          );
        }

        for (const serial of serials) {
          const key =
            normalize(
              serial
            );

          if (
            seenSerials.has(
              key
            )
          ) {
            errors.push(
              `Duplicate serial number "${serial}" appears more than once in this receipt.`
            );
          }

          seenSerials.add(
            key
          );
        }
      }

      return errors;
    };

  const handleReceive = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const validationErrors =
      validateBeforeReceive();

    if (
      validationErrors.length
    ) {
      setErrorMessage(
        validationErrors.join(
          "\n"
        )
      );

      return;
    }

    const itemsToReceive =
      activeItems
        .map((item) => {
          const line =
            receiveLines[
              item.id
            ];

          if (!line) {
            return null;
          }

          const quantity =
            numberValue(
              line.quantity
            );

          if (
            quantity <= 0
          ) {
            return null;
          }

          const serialNumbers =
            parseSerialText(
              line.serialText
            );

          return {
            purchase_order_item_id:
              item.id,
            quantity,
            lot_number:
              batchNumber.trim(),
            serial_numbers:
              serialNumbers,
          };
        })
        .filter(Boolean);

    if (
      !itemsToReceive.length
    ) {
      setErrorMessage(
        "Enter a receiving quantity for at least one PO line."
      );

      return;
    }

    const serialsToValidate = itemsToReceive.flatMap(
      (item) => item?.serial_numbers || []
    );

    if (serialsToValidate.length) {
      const duplicateIssues =
        await validateSerialsAgainstCompany(serialsToValidate);

      if (duplicateIssues.length) {
        setErrorMessage(duplicateIssues.join("\n"));
        return;
      }
    }

    try {
      setSaving(true);

      const { error } =
        await supabase.rpc(
          "receive_purchase_order",
          {
            p_company_id:
              companyId,

            p_purchase_order_id:
              purchaseOrderId,

            p_warehouse_id:
              warehouseId,

            p_location_id:
              locationId ||
              null,

            p_items:
              itemsToReceive,

            p_notes:
              notes.trim() ||
              null,
          }
        );

      if (error) {
        throw new Error(
          error.message
        );
      }

      const receivedSerials = itemsToReceive.flatMap(
        (item) => item?.serial_numbers || []
      );

      if (receivedSerials.length) {
        const { data: serializedUnits, error: serializedUnitsError } =
          await supabase
            .from("serialized_units")
            .select("id, serial_number, barcode")
            .eq("company_id", companyId)
            .eq("purchase_order_id", purchaseOrderId)
            .in("serial_number", receivedSerials);

        if (serializedUnitsError) {
          throw new Error(serializedUnitsError.message);
        }

        for (const unit of serializedUnits || []) {
          if (unit.barcode) continue;

          const { error: barcodeError } = await supabase
            .from("serialized_units")
            .update({ barcode: unit.serial_number })
            .eq("company_id", companyId)
            .eq("id", unit.id)
            .is("barcode", null);

          if (barcodeError) {
            throw new Error(barcodeError.message);
          }
        }
      }

      setSuccessMessage(
        "Purchase order received successfully."
      );
      setLabelsReady(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to receive purchase order."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSerialKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      event.key === "Enter" &&
      event.shiftKey
    ) {
      event.preventDefault();
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="loading-card">
            <div className="spinner" />

            <div>
              <strong>
                Loading purchase order...
              </strong>

              <span>
                Preparing receiving workspace and inventory lines.
              </span>
            </div>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .loading-card {
              min-height: 240px;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 14px;
              border: 1px solid #e5e7eb;
              background: #ffffff;
              border-radius: 14px;
              color: #334155;
            }

            .loading-card span {
              display: block;
              margin-top: 4px;
              font-size: 13px;
              color: #64748b;
            }

            .spinner {
              width: 24px;
              height: 24px;
              border: 3px solid #dbe4ea;
              border-top-color: #166534;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  if (!purchaseOrder) {
    return (
      <AppShell>
        <div className="page-content inventory-page">
          <div className="error-card">
            <strong>
              Purchase order unavailable
            </strong>

            <p>
              {errorMessage ||
                "The purchase order could not be found."}
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/purchase-orders"
                )
              }
            >
              Back to Purchase Orders
            </button>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .error-card {
              padding: 24px;
              border: 1px solid #fecaca;
              background: #fff7f7;
              border-radius: 14px;
              color: #991b1b;
            }

            .error-card p {
              margin: 8px 0 18px;
              color: #7f1d1d;
              white-space: pre-line;
            }

            button {
              border: 1px solid #166534;
              background: #166534;
              color: #ffffff;
              border-radius: 9px;
              padding: 10px 15px;
              font-weight: 700;
              cursor: pointer;
            }
          `}</style>
        </div>
      </AppShell>
    );
  }

  const supplierName =
    purchaseOrder.supplier
      ?.display_name ||
    purchaseOrder.supplier
      ?.legal_name ||
    "—";

  return (
    <AppShell>
      <div className="page-content inventory-page">
        <div className="page-header">
          <div className="eyebrow">
            <span />
            PURCHASE ORDERS / RECEIVING
          </div>

          <div className="title-row">
            <div>
              <h1>
                Receive Purchase Order
              </h1>

              <p>
                Receive stock into a warehouse,
                assign batch/lot provenance,
                and optionally register actual
                serial numbers.
              </p>
            </div>

            <div className="header-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={
                  downloadTemplate
                }
                disabled={
                  !activeItems.length
                }
              >
                <span className="button-icon">
                  ↓
                </span>

                Download Excel Template
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  router.push(
                    `/purchase-orders/${purchaseOrder.id}`
                  )
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div className="po-summary-card">
          <div>
            <span className="summary-label">
              Purchase Order
            </span>

            <strong>
              {purchaseOrder.po_number}
            </strong>
          </div>

          <div>
            <span className="summary-label">
              Supplier
            </span>

            <strong>
              {supplierName}
            </strong>
          </div>

          <div>
            <span className="summary-label">
              Status
            </span>

            <span
              className={`status-pill ${purchaseOrder.status}`}
            >
              {purchaseOrder.status.replaceAll(
                "_",
                " "
              )}
            </span>
          </div>

          <div>
            <span className="summary-label">
              PO Total
            </span>

            <strong>
              {formatMoney(
                numberValue(
                  purchaseOrder.total_amount
                ),
                purchaseOrder.currency
              )}
            </strong>
          </div>
        </div>

        {errorMessage && (
          <div className="alert error">
            <strong>
              Unable to receive
            </strong>

            <div>
              {errorMessage}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="alert success">
            <strong>
              Success
            </strong>

            <div>
              {successMessage}
            </div>
          </div>
        )}

        <form
          onSubmit={
            handleReceive
          }
        >
          <div className="stats-grid">
            <div className="stat-card">
              <span>
                Open PO Lines
              </span>

              <strong>
                {activeItems.length}
              </strong>

              <small>
                Lines with quantity remaining
              </small>
            </div>

            <div className="stat-card">
              <span>
                Remaining Units
              </span>

              <strong>
                {formatNumber(
                  activeItems.reduce(
                    (sum, item) =>
                      sum +
                      getRemaining(
                        item
                      ),
                    0
                  )
                )}
              </strong>

              <small>
                Available to receive
              </small>
            </div>

            <div className="stat-card">
              <span>
                Receiving Now
              </span>

              <strong>
                {formatNumber(
                  totalReceivingQuantity
                )}
              </strong>

              <small>
                Total selected quantity
              </small>
            </div>

            <div className="stat-card">
              <span>
                Serial Numbers
              </span>

              <strong>
                {formatNumber(
                  totalSerials
                )}
              </strong>

              <small>
                Actual serials entered
              </small>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>
                  Receiving Destination
                </h2>

                <p>
                  Choose where the received
                  inventory will physically enter
                  the warehouse.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                <span>
                  Warehouse *
                </span>

                <select
                  value={
                    warehouseId
                  }
                  onChange={(event) => {
                    setWarehouseId(
                      event.target.value
                    );

                    setLocationId(
                      ""
                    );
                  }}
                >
                  <option value="">
                    Select warehouse
                  </option>

                  {warehouses.map(
                    (warehouse) => (
                      <option
                        key={
                          warehouse.id
                        }
                        value={
                          warehouse.id
                        }
                      >
                        {
                          warehouse.name
                        }{" "}
                        (
                        {
                          warehouse.code
                        }
                        )
                        {warehouse.is_default
                          ? " — Default"
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  Location{" "}
                  {locations.length
                    ? "*"
                    : ""}
                </span>

                <select
                  value={
                    locationId
                  }
                  onChange={(event) =>
                    setLocationId(
                      event.target.value
                    )
                  }
                  disabled={
                    !warehouseId ||
                    !locations.length
                  }
                >
                  <option value="">
                    {locations.length
                      ? "Select location"
                      : "No active locations"}
                  </option>

                  {locations.map(
                    (location) => (
                      <option
                        key={
                          location.id
                        }
                        value={
                          location.id
                        }
                      >
                        {
                          location.name
                        }{" "}
                        (
                        {
                          location.code
                        }
                        ) —{" "}
                        {
                          location.location_type
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  Receiving Batch / GRN *
                </span>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(event) =>
                    updateBatchNumber(event.target.value)
                  }
                  placeholder="GRN-20260924-001"
                />
                <small>
                  One receiving batch identifier is shared across all products received in this submission.
                </small>
              </label>

              <label>
                <span>
                  Products in This Batch
                </span>
                <input
                  type="text"
                  value={`${Object.values(receiveLines).filter((line) => numberValue(line.quantity) > 0).length} product line(s) / ${formatNumber(totalReceivingQuantity)} unit(s)`}
                  readOnly
                />
                <small>
                  Multiple PO products can be received under the same batch / GRN.
                </small>
              </label>

              <label className="full">
                <span>
                  Receiving Notes
                </span>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  rows={3}
                  placeholder="Optional receiving notes..."
                />
              </label>
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>
                  Excel Serial Import
                </h2>

                <p>
                  Upload actual serial numbers from
                  an Excel workbook. SBS will match
                  them to the open PO lines and
                  validate duplicates automatically.
                </p>
              </div>

              <div className="excel-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    downloadTemplate
                  }
                  disabled={
                    !activeItems.length
                  }
                >
                  Download Template
                </button>

                <label className="upload-button">
                  <span>
                    Import Excel
                  </span>

                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={
                      handleExcelImport
                    }
                  />
                </label>
              </div>
            </div>

            {excelFileName && (
              <div className="file-info">
                <span className="file-icon">
                  XLS
                </span>

                <div>
                  <strong>
                    {excelFileName}
                  </strong>

                  <small>
                    Excel serial import processed
                    for this PO.
                  </small>
                </div>
              </div>
            )}

            {serialImportPreview && (
              <div className="import-preview">
                <div>
                  <strong>Import Preview</strong>
                  <span>
                    Rows found: {serialImportPreview.total} · Valid: {serialImportPreview.total} · Duplicates: 0 · Invalid: 0
                  </span>
                </div>
                <div className="import-preview-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={confirmSerialImport}
                  >
                    Add {serialImportPreview.total} Serials
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setSerialImportPreview(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="excel-help">
              <div>
                <strong>
                  Recommended columns
                </strong>

                <span>
                  Product SKU · Variant SKU ·
                  Supplier SKU · Serial Number
                </span>
              </div>

              <div>
                <strong>
                  Required
                </strong>

                <span>
                  Serial Number
                </span>
              </div>

              <div>
                <strong>
                  Best practice
                </strong>

                <span>
                  Download the PO-specific template
                  so you can see the exact open PO
                  line identifiers.
                </span>
              </div>
            </div>

            {excelIssues.length >
              0 && (
              <div className="validation-box">
                <div className="validation-title">
                  <strong>
                    Validation Issues
                  </strong>

                  <span>
                    {
                      excelIssues.length
                    }
                  </span>
                </div>

                <div className="validation-list">
                  {excelIssues.map(
                    (
                      issue,
                      index
                    ) => (
                      <div
                        className="validation-row"
                        key={`${issue.row}-${index}`}
                      >
                        <strong>
                          {issue.row >
                          0
                            ? `Row ${issue.row}`
                            : "Import"}
                        </strong>

                        <span>
                          {
                            issue.message
                          }
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2>
                  Items to Receive
                </h2>

                <p>
                  All selected products can share the same receiving batch / GRN.
                  Serial numbers remain attached to their individual products.
                </p>
              </div>
            </div>

            {!activeItems.length ? (
              <div className="empty-state">
                <div className="empty-icon">
                  ✓
                </div>

                <strong>
                  Nothing left to receive
                </strong>

                <p>
                  All quantities on this purchase
                  order have already been received.
                </p>
              </div>
            ) : (
              <div className="receive-layout">
                <div className="item-list">
                  {activeItems.map(
                    (item) => {
                      const remaining =
                        getRemaining(
                          item
                        );

                      const line =
                        receiveLines[
                          item.id
                        ];

                      const serialCount =
                        parseSerialText(
                          line?.serialText ||
                            ""
                        ).length;

                      const isSelected =
                        selectedItemId ===
                        item.id;

                      return (
                        <button
                          type="button"
                          key={
                            item.id
                          }
                          className={`item-card ${
                            isSelected
                              ? "selected"
                              : ""
                          }`}
                          onClick={() =>
                            setSelectedItemId(
                              item.id
                            )
                          }
                        >
                          <div className="item-card-top">
                            <div>
                              <strong>
                                {
                                  item.product_name
                                }
                              </strong>

                              {item.variant_name && (
                                <span>
                                  {
                                    item.variant_name
                                  }
                                </span>
                              )}
                            </div>

                            <span className="tracking-badge">
                              {trackingLabel()}
                            </span>
                          </div>

                          <div className="item-identifiers">
                            <span>
                              PO SKU:{" "}
                              {
                                item.sku ||
                                "—"
                              }
                            </span>

                            <span>
                              Variant SKU:{" "}
                              {
                                item
                                  .variant
                                  ?.sku ||
                                "—"
                              }
                            </span>

                            <span>
                              Supplier SKU:{" "}
                              {
                                item
                                  .supplier_sku ||
                                "—"
                              }
                            </span>
                          </div>

                          <div className="item-card-bottom">
                            <span>
                              Remaining{" "}
                              <strong>
                                {formatNumber(
                                  remaining
                                )}
                              </strong>
                            </span>

                            <span>
                              Serial{" "}
                              <strong>
                                {
                                  serialCount
                                }
                              </strong>
                            </span>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="editor-panel">
                  {selectedItem &&
                  selectedLine ? (
                    <>
                      <div className="editor-heading">
                        <div>
                          <span className="editor-kicker">
                            RECEIVING LINE
                          </span>

                          <h3>
                            {
                              selectedItem.product_name
                            }
                          </h3>

                          {selectedItem.variant_name && (
                            <p>
                              {
                                selectedItem.variant_name
                              }
                            </p>
                          )}
                        </div>

                        <span className="tracking-badge large">
                          {trackingLabel()}
                        </span>
                      </div>

                      <div className="identifier-grid">
                        <div>
                          <span>
                            PO SKU
                          </span>

                          <strong>
                            {
                              selectedItem.sku ||
                              "—"
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Variant SKU
                          </span>

                          <strong>
                            {
                              selectedItem
                                .variant
                                ?.sku ||
                              "—"
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Supplier SKU
                          </span>

                          <strong>
                            {
                              selectedItem
                                .supplier_sku ||
                              "—"
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Product
                          </span>

                          <strong>
                            {
                              selectedItem
                                .product
                                ?.name ||
                              selectedItem.product_name ||
                              "—"
                            }
                          </strong>
                        </div>
                      </div>

                      <div className="form-grid">
                        <label>
                          <span>
                            Receiving Quantity *
                          </span>

                          <input
                            type="number"
                            min="0"
                            max={getRemaining(
                              selectedItem
                            )}
                            step="1"
                            value={
                              selectedLine.quantity
                            }
                            onChange={(
                              event
                            ) =>
                              updateReceiveLine(
                                selectedItem.id,
                                {
                                  quantity:
                                    numberValue(
                                      event
                                        .target
                                        .value
                                    ),
                                }
                              )
                            }
                          />

                          <small>
                            Maximum remaining:{" "}
                            {formatNumber(
                              getRemaining(
                                selectedItem
                              )
                            )}
                          </small>
                        </label>

                        <label>
                          <span>
                            Receiving Batch / GRN
                          </span>

                          <input
                            type="text"
                            value={batchNumber}
                            readOnly
                          />

                          <small>
                            Shared across every product being received in this submission.
                          </small>
                        </label>

                        <label className="full">
                          <span>
                            Serial Numbers{" "}
                            <em>
                              "optional child serial tracking"
                            </em>
                          </span>

                          <div className="serial-tools">
                              <button
                                type="button"
                                className="scanner-primary-button"
                                onClick={() => void startScanner()}
                                aria-label="Scan serial number with camera or barcode scanner"
                              >
                                <span className="scanner-button-icon">⌁</span>
                                <span>Scan Serial Number</span>
                              </button>

                              <div className="serial-actions">
                                <label className="upload-button">
                                  📤 Import Excel
                                  <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleExcelImport}
                                  />
                                </label>

                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => {
                                    const serial = window.prompt("Enter serial number");
                                    if (serial) addSerialToSelectedLine(serial);
                                  }}
                                >
                                  ✚ Add Manually
                                </button>
                              </div>

                              <div className="scanner-hint">
                                <strong>Scanner ready:</strong> Use your phone camera, or connect a USB/Bluetooth barcode scanner and scan directly into this receiving screen.
                              </div>
                          </div>

                          {scannerMessage && (
                            <small className="scanner-message">
                              {scannerMessage}
                            </small>
                          )}

                          <textarea
                            rows={10}
                            value={
                              selectedLine.serialText
                            }
                            onKeyDown={
                              handleSerialKeyDown
                            }
                            onChange={(
                              event
                            ) =>
                              updateReceiveLine(
                                selectedItem.id,
                                {
                                  serialText:
                                    event
                                      .target
                                      .value,
                                }
                              )
                            }
                            placeholder={`Enter actual serial numbers, one per line.\n\nExample:\nABC123456\nABC123457\nABC123458`}
                          />

                          <small>
                            `${parseSerialText(selectedLine.serialText).length} / ${selectedLine.quantity} child serials identified.`
                          </small>
                        </label>
                      </div>

                      <div className="line-summary">
                        <div>
                          <span>
                            Ordered
                          </span>

                          <strong>
                            {formatNumber(
                              selectedItem.quantity
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Already Received
                          </span>

                          <strong>
                            {formatNumber(
                              selectedItem.received_quantity
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Remaining
                          </span>

                          <strong>
                            {formatNumber(
                              getRemaining(
                                selectedItem
                              )
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Serials Entered
                          </span>

                          <strong>
                            {
                              parseSerialText(
                                selectedLine.serialText
                              ).length
                            }
                          </strong>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="editor-empty">
                      <strong>
                        Select a PO line
                      </strong>

                      <span>
                        Choose an item from the left to
                        configure its receiving quantity,
                        batch, and serial numbers.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bottom-bar">
            <div>
              <strong>
                Receiving{" "}
                {formatNumber(
                  totalReceivingQuantity
                )}{" "}
                units
              </strong>

              <span>
                {formatNumber(
                  totalSerials
                )}{" "}
                serial numbers will be registered.
              </span>
            </div>

            <div className="bottom-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  router.push(
                    `/purchase-orders/${purchaseOrder.id}`
                  )
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  saving ||
                  !activeItems.length ||
                  !warehouseId
                }
              >
                {saving ? (
                  <>
                    <span className="button-spinner" />
                    Receiving...
                  </>
                ) : (
                  "Receive Purchase Order"
                )}
              </button>

              {labelsReady && (
                <button
                  type="button"
                  className="secondary-button print-labels-button"
                  onClick={prepareLabels}
                >
                  🖨 Print Labels
                </button>
              )}
            </div>
          </div>
        </form>

        {scannerOpen && (
          <div className="scanner-overlay" role="dialog" aria-modal="true">
            <div className="scanner-dialog">
              <div className="section-header">
                <div>
                  <h2>Scan Serial Number</h2>
                  <p>Point your phone or webcam at the barcode, or use a USB/Bluetooth barcode scanner.</p>
                </div>
                <button type="button" className="secondary-button" onClick={stopScanner}>
                  Close
                </button>
              </div>
              <video ref={scannerVideoRef} className="scanner-video" muted playsInline />
              <div className="scanner-fallback">
                <strong>Scanner fallback</strong>
                <span>Use a USB/Bluetooth barcode scanner or paste/type the serial here. Most hardware scanners behave like a keyboard and finish with Enter.</span>
                <div className="scanner-input-row">
                  <input
                    autoFocus
                    value={scannerInput}
                    onChange={(event) => setScannerInput(event.target.value)}
                    onKeyDown={handleScannerInputKeyDown}
                    placeholder="Scan or enter serial number"
                  />
                  <button type="button" className="primary-button" onClick={submitScannerInput}>
                    Add Serial
                  </button>
                </div>
              </div>
              <p className="scanner-message">Scanning {selectedItem?.product_name || "selected product"}...</p>
            </div>
          </div>
        )}

        <div className="print-label-sheet" aria-hidden="true">
          {activeItems.flatMap((item) => {
            const line = receiveLines[item.id];
            if (!line) return [];
            return parseSerialText(line.serialText).map((serial) => (
              <div className="print-label" key={`${item.id}-${serial}`}>
                <strong>SHARIF BUSINESS SOLUTIONS</strong>
                <span>{item.product_name}</span>
                <span>{item.variant_name || ""}</span>
                {item.sku ? <span>SKU: {item.sku}</span> : null}
                {item.description ? <span>{item.description}</span> : null}
                <span>Batch: {batchNumber}</span>
                <b>S/N: {serial}</b>
                <svg
                  className="label-barcode"
                  data-receiving-barcode={serial}
                  aria-label={`Barcode ${serial}`}
                />
                <span>{serial}</span>
              </div>
            ));
          })}
        </div>

        <style jsx>{`
          .page-content {
            padding: 28px;
            max-width: 1600px;
            margin: 0 auto;
          }

          .page-header {
            margin-bottom: 20px;
          }

          .eyebrow {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #64748b;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
          }

          .eyebrow span {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #166534;
          }

          .title-row {
            margin-top: 8px;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
          }

          h1 {
            margin: 0;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.15;
            letter-spacing: -0.02em;
          }

          .page-header p {
            margin: 8px 0 0;
            color: #64748b;
            font-size: 14px;
            max-width: 800px;
          }

          .header-actions,
          .excel-actions,
          .bottom-actions {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          button {
            font-family: inherit;
          }

          .primary-button,
          .secondary-button,
          .upload-button {
            min-height: 40px;
            padding: 0 14px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 750;
            cursor: pointer;
            transition:
              transform 0.15s ease,
              box-shadow 0.15s ease,
              background 0.15s ease;
          }

          .primary-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border: 1px solid #166534;
            background: #166534;
            color: #ffffff;
          }

          .primary-button:hover:not(:disabled) {
            background: #14532d;
            box-shadow: 0 4px 12px rgba(22, 101, 52, 0.18);
          }

          .secondary-button {
            border: 1px solid #d1d5db;
            background: #ffffff;
            color: #334155;
          }

          .secondary-button:hover:not(:disabled) {
            background: #f8fafc;
          }

          button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          .button-icon {
            font-size: 18px;
            line-height: 1;
          }

          .po-summary-card {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
            padding: 18px 20px;
            margin-bottom: 18px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
          }

          .po-summary-card > div {
            min-width: 0;
          }

          .summary-label,
          .identifier-grid span,
          .line-summary span,
          .stat-card span,
          label > span,
          .excel-help strong {
            display: block;
            color: #64748b;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .po-summary-card strong {
            display: block;
            margin-top: 5px;
            color: #0f172a;
            font-size: 14px;
          }

          .status-pill {
            display: inline-flex;
            margin-top: 6px;
            padding: 5px 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            text-transform: capitalize;
            background: #f1f5f9;
            color: #475569;
          }

          .status-pill.confirmed {
            background: #ecfdf5;
            color: #166534;
          }

          .status-pill.partially_received {
            background: #eff6ff;
            color: #1d4ed8;
          }

          .status-pill.received {
            background: #ecfdf5;
            color: #166534;
          }

          .alert {
            margin-bottom: 18px;
            padding: 13px 15px;
            border-radius: 11px;
            font-size: 13px;
          }

          .alert strong {
            display: block;
            margin-bottom: 4px;
          }

          .alert.error {
            border: 1px solid #fecaca;
            background: #fff7f7;
            color: #991b1b;
          }

          .alert.success {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #166534;
          }

          .alert div {
            white-space: pre-line;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 18px;
          }

          .stat-card {
            padding: 17px 18px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
          }

          .stat-card strong {
            display: block;
            margin-top: 7px;
            color: #0f172a;
            font-size: 25px;
            line-height: 1;
          }

          .stat-card small {
            display: block;
            margin-top: 7px;
            color: #94a3b8;
            font-size: 12px;
          }

          .section-card {
            margin-bottom: 18px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
            overflow: hidden;
          }

          .section-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            padding: 19px 20px;
            border-bottom: 1px solid #e5e7eb;
          }

          .section-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 16px;
          }

          .section-header p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 13px;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            padding: 20px;
          }

          label {
            display: block;
          }

          label.full {
            grid-column: 1 / -1;
          }

          input,
          select,
          textarea {
            width: 100%;
            box-sizing: border-box;
            margin-top: 7px;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #ffffff;
            color: #0f172a;
            font-family: inherit;
            font-size: 13px;
            outline: none;
          }

          input,
          select {
            height: 42px;
            padding: 0 12px;
          }

          textarea {
            padding: 11px 12px;
            resize: vertical;
            line-height: 1.5;
          }

          input:focus,
          select:focus,
          textarea:focus {
            border-color: #166534;
            box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
          }

          label small {
            display: block;
            margin-top: 5px;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.45;
          }

          .upload-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #166534;
            background: #166534;
            color: #ffffff;
          }

          .upload-button:hover {
            background: #14532d;
          }

          .upload-button input {
            display: none;
          }

          .file-info {
            display: flex;
            align-items: center;
            gap: 11px;
            margin: 18px 20px 0;
            padding: 11px 13px;
            border: 1px solid #dcfce7;
            border-radius: 10px;
            background: #f0fdf4;
          }

          .file-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            border-radius: 8px;
            background: #166534;
            color: #ffffff;
            font-size: 10px;
            font-weight: 900;
          }

          .file-info strong {
            display: block;
            color: #166534;
            font-size: 13px;
          }

          .file-info small {
            display: block;
            margin-top: 2px;
            color: #64748b;
            font-size: 11px;
          }

          .import-preview {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            margin: 18px 20px 0;
            padding: 13px;
            border: 1px solid #bfdbfe;
            border-radius: 10px;
            background: #eff6ff;
          }

          .import-preview strong,
          .import-preview span {
            display: block;
          }

          .import-preview strong {
            color: #1e3a8a;
            font-size: 13px;
          }

          .import-preview span {
            margin-top: 4px;
            color: #475569;
            font-size: 11px;
          }

          .import-preview-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .excel-help {
            display: grid;
            grid-template-columns: 1fr 1fr 1.5fr;
            gap: 12px;
            margin: 18px 20px 20px;
          }

          .excel-help > div {
            padding: 13px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #f8fafc;
          }

          .excel-help span {
            display: block;
            margin-top: 5px;
            color: #475569;
            font-size: 12px;
            line-height: 1.45;
          }

          .validation-box {
            margin: 0 20px 20px;
            border: 1px solid #fecaca;
            border-radius: 11px;
            background: #fff7f7;
            overflow: hidden;
          }

          .validation-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 14px;
            color: #991b1b;
            border-bottom: 1px solid #fecaca;
          }

          .validation-title span {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 25px;
            height: 25px;
            border-radius: 999px;
            background: #fee2e2;
            font-size: 11px;
            font-weight: 800;
          }

          .validation-list {
            max-height: 260px;
            overflow: auto;
          }

          .validation-row {
            display: grid;
            grid-template-columns: 90px 1fr;
            gap: 10px;
            padding: 10px 14px;
            border-bottom: 1px solid #fee2e2;
            color: #7f1d1d;
            font-size: 12px;
          }

          .validation-row:last-child {
            border-bottom: 0;
          }

          .receive-layout {
            display: grid;
            grid-template-columns: 370px minmax(0, 1fr);
            min-height: 620px;
          }

          .item-list {
            padding: 14px;
            border-right: 1px solid #e5e7eb;
            background: #f8fafc;
            overflow: auto;
          }

          .item-card {
            width: 100%;
            margin-bottom: 9px;
            padding: 13px;
            border: 1px solid #e2e8f0;
            border-radius: 11px;
            background: #ffffff;
            color: inherit;
            text-align: left;
            cursor: pointer;
          }

          .item-card:hover {
            border-color: #cbd5e1;
          }

          .item-card.selected {
            border-color: #166534;
            box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.08);
          }

          .item-card-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
          }

          .item-card-top strong {
            display: block;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.35;
          }

          .item-card-top div > span {
            display: block;
            margin-top: 3px;
            color: #64748b;
            font-size: 11px;
          }

          .tracking-badge {
            flex: 0 0 auto;
            padding: 4px 7px;
            border-radius: 999px;
            background: #f1f5f9;
            color: #475569;
            font-size: 9px;
            font-weight: 850;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .tracking-badge.large {
            font-size: 10px;
            padding: 6px 9px;
          }

          .item-identifiers {
            display: grid;
            gap: 3px;
            margin-top: 10px;
            color: #64748b;
            font-size: 10px;
          }

          .item-card-bottom {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 11px;
            padding-top: 9px;
            border-top: 1px solid #f1f5f9;
            color: #64748b;
            font-size: 11px;
          }

          .item-card-bottom strong {
            color: #0f172a;
          }

          .editor-panel {
            min-width: 0;
            padding: 24px;
          }

          .editor-heading {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 15px;
            padding-bottom: 18px;
            border-bottom: 1px solid #e5e7eb;
          }

          .editor-kicker {
            color: #166534;
            font-size: 10px;
            font-weight: 850;
            letter-spacing: 0.08em;
          }

          .editor-heading h3 {
            margin: 5px 0 0;
            color: #0f172a;
            font-size: 20px;
          }

          .editor-heading p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 13px;
          }

          .identifier-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 18px;
          }

          .identifier-grid > div {
            padding: 11px;
            border: 1px solid #e5e7eb;
            border-radius: 9px;
            background: #f8fafc;
          }

          .identifier-grid strong {
            display: block;
            margin-top: 5px;
            color: #334155;
            font-size: 12px;
            word-break: break-word;
          }

          .editor-panel .form-grid {
            padding: 20px 0 0;
          }

          .line-summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 18px;
          }

          .line-summary > div {
            padding: 12px;
            border: 1px solid #e5e7eb;
            border-radius: 9px;
            background: #f8fafc;
          }

          .line-summary strong {
            display: block;
            margin-top: 5px;
            color: #0f172a;
            font-size: 15px;
          }

          .editor-empty,
          .empty-state {
            min-height: 320px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            color: #64748b;
          }

          .editor-empty strong,
          .empty-state strong {
            color: #334155;
            font-size: 15px;
          }

          .editor-empty span,
          .empty-state p {
            max-width: 450px;
            margin: 7px 0 0;
            color: #94a3b8;
            font-size: 13px;
            line-height: 1.5;
          }

          .empty-icon {
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
            border-radius: 50%;
            background: #ecfdf5;
            color: #166534;
            font-weight: 900;
          }

          .bottom-bar {
            position: sticky;
            bottom: 0;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            margin-top: 2px;
            padding: 14px 18px;
            border: 1px solid #dbe2e8;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.97);
            box-shadow: 0 -4px 18px rgba(15, 23, 42, 0.06);
            backdrop-filter: blur(10px);
          }

          .bottom-bar strong {
            display: block;
            color: #0f172a;
            font-size: 13px;
          }

          .bottom-bar > div:first-child span {
            display: block;
            margin-top: 3px;
            color: #64748b;
            font-size: 11px;
          }

          .serial-tools {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 10px;
  }

  .scanner-primary-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    width: 100%;
    min-height: 48px;
    padding: 0 16px;
    border: 1px solid #166534;
    border-radius: 10px;
    background: #166534;
    color: white;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(22, 101, 52, 0.16);
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .scanner-primary-button:hover {
    background: #14532d;
    transform: translateY(-1px);
  }

  .scanner-button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 1px solid rgba(255,255,255,0.45);
    border-radius: 7px;
    font-size: 18px;
    line-height: 1;
  }

  .scanner-hint {
    padding: 9px 11px;
    border: 1px solid #dbeafe;
    border-radius: 8px;
    background: #f8fbff;
    color: #64748b;
    font-size: 10px;
    line-height: 1.5;
  }

  .scanner-hint strong {
    color: #334155;
  }

  .serial-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 8px 0;
          }

          .serial-actions .secondary-button,
          .serial-actions .upload-button {
            min-height: 36px;
            padding: 0 10px;
            font-size: 12px;
          }

          .scanner-message {
            color: #166534;
            font-size: 12px;
          }

          .scanner-overlay {
            position: fixed;
            z-index: 50;
            inset: 0;
            display: grid;
            place-items: center;
            padding: 20px;
            background: rgba(15, 23, 42, 0.58);
          }

          .scanner-dialog {
            width: min(560px, 100%);
            overflow: hidden;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.25);
          }

          .scanner-dialog .section-header {
            border-bottom: 1px solid #eef2f7;
          }

          .scanner-video {
            display: block;
            width: 100%;
            min-height: 280px;
            background: #0f172a;
            object-fit: cover;
          }

          .scanner-dialog .scanner-message {
            display: block;
            padding: 0 18px 18px;
          }

          .scanner-fallback {
            padding: 16px 18px 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .scanner-fallback strong {
            color: #334155;
            font-size: 12px;
          }

          .scanner-fallback span {
            color: #64748b;
            font-size: 11px;
            line-height: 1.45;
          }

          .scanner-input-row {
            display: flex;
            gap: 8px;
            margin-top: 4px;
          }

          .scanner-input-row input {
            margin-top: 0;
            height: 38px;
            flex: 1;
          }

          .scanner-input-row .primary-button {
            min-height: 38px;
          }

          .print-label-sheet {
            display: none;
          }

          .print-label {
            display: flex;
            width: 3.2in;
            min-height: 1.8in;
            flex-direction: column;
            justify-content: center;
            gap: 5px;
            border: 1px solid #111827;
            padding: 12px;
            color: #111827;
            text-align: center;
          }

          .print-label strong {
            font-size: 10px;
          }

          .print-label span,
          .print-label b {
            font-size: 10px;
          }

          .print-label b {
            font-size: 12px;
          }

          .label-barcode {
            margin-top: 5px;
            width: 100%;
            height: 34px;
          }

          .button-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255, 255, 255, 0.4);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          em {
            font-style: normal;
            color: #94a3b8;
            font-weight: 500;
            text-transform: none;
            letter-spacing: 0;
          }

          @media (max-width: 1100px) {
            .stats-grid,
            .po-summary-card {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .receive-layout {
              grid-template-columns: 1fr;
            }

            .item-list {
              border-right: 0;
              border-bottom: 1px solid #e5e7eb;
              max-height: 320px;
            }

            .identifier-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 760px) {
            .page-content {
              padding: 18px;
            }

            .title-row,
            .bottom-bar,
            .section-header {
              align-items: stretch;
              flex-direction: column;
            }

            .header-actions,
            .excel-actions,
            .bottom-actions {
              width: 100%;
              flex-wrap: wrap;
            }

            .header-actions button,
            .excel-actions button,
            .excel-actions label,
            .bottom-actions button {
              flex: 1;
            }

            .stats-grid,
            .po-summary-card,
            .form-grid,
            .excel-help,
            .line-summary {
              grid-template-columns: 1fr;
            }

            label.full {
              grid-column: auto;
            }

            .identifier-grid {
              grid-template-columns: 1fr;
            }

            .editor-panel {
              padding: 18px;
            }
          }

          @media print {
            body :global(*) {
              visibility: hidden;
            }

            .print-label-sheet,
            .print-label-sheet * {
              visibility: visible;
            }

            .print-label-sheet {
              display: grid;
              grid-template-columns: repeat(2, 3.2in);
              gap: 0.2in;
              padding: 0.2in;
            }

            .print-label {
              break-inside: avoid;
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
}