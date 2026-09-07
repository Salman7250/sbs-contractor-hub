"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type TrackingMode = "none" | "quantity" | "batch" | "serial";

type Warehouse = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  is_default: boolean;
};

type Location = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

type Product = {
  id: string;
  name: string;
  tracking_mode: TrackingMode;
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
};

type TransferItem = {
  product_id: string;
  variant_id: string;
  quantity: string;
};

type FormState = {
  source_warehouse_id: string;
  source_location_id: string;
  destination_warehouse_id: string;
  destination_location_id: string;
  notes: string;
};

const emptyForm: FormState = {
  source_warehouse_id: "",
  source_location_id: "",
  destination_warehouse_id: "",
  destination_location_id: "",
  notes: "",
};

const emptyItem: TransferItem = {
  product_id: "",
  variant_id: "",
  quantity: "",
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function isPositiveWholeNumber(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return false;
  }

  return Number(value) > 0;
}

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name:
    | "warehouse"
    | "location"
    | "arrow"
    | "plus"
    | "trash"
    | "save"
    | "close"
    | "layers"
    | "package";
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "warehouse") {
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M5 21V9l7-5 7 5v12" />
        <path d="M8 21v-8h8v8" />
        <path d="M9 10h.01" />
        <path d="M12 10h.01" />
        <path d="M15 10h.01" />
      </svg>
    );
  }

  if (name === "location") {
    return (
      <svg {...common}>
        <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (name === "arrow") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );
  }

  if (name === "plus") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 14h10l1-14" />
        <path d="M9 7V4h6v3" />
      </svg>
    );
  }

  if (name === "save") {
    return (
      <svg {...common}>
        <path d="M5 4h11l3 3v13H5z" />
        <path d="M8 4v6h8V4" />
        <path d="M8 20v-6h8v6" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg {...common}>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </svg>
    );
  }

  if (name === "layers") {
    return (
      <svg {...common}>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 16 9 5 9-5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="m4 7 8-4 8 4v10l-8 4-8-4V7Z" />
      <path d="m4 7 8 4 8-4" />
      <path d="M12 11v10" />
    </svg>
  );
}

export default function NewTransferPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [items, setItems] = useState<TransferItem[]>([
    { ...emptyItem },
  ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be signed in to create a transfer."
        );
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

      const currentCompanyId =
        membership.company_id;

      setCompanyId(currentCompanyId);

      const [
        warehousesResult,
        locationsResult,
        productsResult,
        variantsResult,
      ] = await Promise.all([
        supabase
          .from("warehouses")
          .select(
            "id,name,code,is_active,is_default"
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("warehouse_locations")
          .select(
            "id,warehouse_id,name,code,is_active"
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),

        /*
         * IMPORTANT:
         * products does NOT have a sku column.
         */
        supabase
          .from("products")
          .select(
            "id,name,tracking_mode"
          )
          .eq("company_id", currentCompanyId)
          .order("name", {
            ascending: true,
          }),

        /*
         * IMPORTANT:
         * product_variants does NOT have tracking_mode.
         * It DOES have sku.
         */
        supabase
          .from("product_variants")
          .select(
            "id,product_id,name,sku"
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (warehousesResult.error) {
        throw warehousesResult.error;
      }

      if (locationsResult.error) {
        throw locationsResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (variantsResult.error) {
        throw variantsResult.error;
      }

      const loadedWarehouses =
        (warehousesResult.data ??
          []) as Warehouse[];

      const loadedLocations =
        (locationsResult.data ??
          []) as Location[];

      const loadedProducts =
        (productsResult.data ??
          []) as Product[];

      const loadedVariants =
        (variantsResult.data ??
          []) as Variant[];

      setWarehouses(
        loadedWarehouses
      );

      setLocations(
        loadedLocations
      );

      setProducts(
        loadedProducts
      );

      setVariants(
        loadedVariants
      );

      const defaultWarehouse =
        loadedWarehouses.find(
          (warehouse) =>
            warehouse.is_default
        ) ??
        loadedWarehouses[0];

      if (defaultWarehouse) {
        const defaultLocation =
          loadedLocations.find(
            (location) =>
              location.warehouse_id ===
              defaultWarehouse.id
          ) ?? null;

        setForm((current) => ({
          ...current,
          source_warehouse_id:
            current.source_warehouse_id ||
            defaultWarehouse.id,
          source_location_id:
            current.source_location_id ||
            defaultLocation?.id ||
            "",
        }));
      }
    } catch (error) {
      console.error(
        "New transfer load error:",
        error
      );

      if (error instanceof Error) {
        setErrorMessage(
          error.message
        );
      } else if (
        typeof error === "object" &&
        error !== null
      ) {
        const supabaseError =
          error as {
            message?: string;
            details?: string;
            hint?: string;
            code?: string;
          };

        setErrorMessage(
          [
            supabaseError.message,
            supabaseError.details,
            supabaseError.hint,
            supabaseError.code
              ? `Code: ${supabaseError.code}`
              : null,
          ]
            .filter(Boolean)
            .join(" — ") ||
            "Failed to load the transfer form."
        );
      } else {
        setErrorMessage(
          "Failed to load the transfer form."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const sourceLocations = useMemo(() => {
    if (!form.source_warehouse_id) {
      return [];
    }

    return locations.filter(
      (location) =>
        location.warehouse_id ===
        form.source_warehouse_id
    );
  }, [
    locations,
    form.source_warehouse_id,
  ]);

  const destinationLocations =
    useMemo(() => {
      if (
        !form.destination_warehouse_id
      ) {
        return [];
      }

      return locations.filter(
        (location) =>
          location.warehouse_id ===
          form.destination_warehouse_id
      );
    }, [
      locations,
      form.destination_warehouse_id,
    ]);

  const totalUnits = useMemo(() => {
    return items.reduce(
      (total, item) => {
        const quantity = Number(
          item.quantity
        );

        if (
          !Number.isFinite(quantity)
        ) {
          return total;
        }

        return total + quantity;
      },
      0
    );
  }, [items]);

  const activeProductOptions =
    useMemo(() => {
      return products.filter(
        (product) =>
          product.tracking_mode ===
          "quantity"
      );
    }, [products]);

  const getProductVariants =
    useCallback(
      (productId: string) => {
        return variants.filter(
          (variant) =>
            variant.product_id ===
            productId
        );
      },
      [variants]
    );

  const updateForm = (
    field: keyof FormState,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateItem = (
    index: number,
    field: keyof TransferItem,
    value: string
  ) => {
    setItems((current) =>
      current.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
                ...(field ===
                "product_id"
                  ? {
                      variant_id: "",
                    }
                  : {}),
              }
            : item
      )
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      { ...emptyItem },
    ]);
  };

  const removeItem = (
    index: number
  ) => {
    setItems((current) => {
      if (current.length === 1) {
        return [
          { ...emptyItem },
        ];
      }

      return current.filter(
        (_, itemIndex) =>
          itemIndex !== index
      );
    });
  };

  const handleSourceWarehouseChange = (
    warehouseId: string
  ) => {
    const firstLocation =
      locations.find(
        (location) =>
          location.warehouse_id ===
          warehouseId
      ) ?? null;

    setForm((current) => ({
      ...current,
      source_warehouse_id:
        warehouseId,
      source_location_id:
        firstLocation?.id || "",
    }));
  };

  const handleDestinationWarehouseChange =
    (warehouseId: string) => {
      const firstLocation =
        locations.find(
          (location) =>
            location.warehouse_id ===
            warehouseId
        ) ?? null;

      setForm((current) => ({
        ...current,
        destination_warehouse_id:
          warehouseId,
        destination_location_id:
          firstLocation?.id || "",
      }));
    };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!companyId) {
      setErrorMessage(
        "Company information is not available."
      );
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (
      !form.source_warehouse_id
    ) {
      setErrorMessage(
        "Select a source warehouse."
      );
      return;
    }

    if (
      !form.source_location_id
    ) {
      setErrorMessage(
        "Select a source location."
      );
      return;
    }

    if (
      !form.destination_warehouse_id
    ) {
      setErrorMessage(
        "Select a destination warehouse."
      );
      return;
    }

    if (
      !form.destination_location_id
    ) {
      setErrorMessage(
        "Select a destination location."
      );
      return;
    }

    if (
      form.source_warehouse_id ===
        form.destination_warehouse_id &&
      form.source_location_id ===
        form.destination_location_id
    ) {
      setErrorMessage(
        "Source and destination cannot be the same location."
      );
      return;
    }

    if (items.length === 0) {
      setErrorMessage(
        "Add at least one transfer item."
      );
      return;
    }

    const seenVariants =
      new Set<string>();

    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const item = items[index];

      if (!item.product_id) {
        setErrorMessage(
          `Select a product for item ${
            index + 1
          }.`
        );
        return;
      }

      if (!item.variant_id) {
        setErrorMessage(
          `Select a variant for item ${
            index + 1
          }.`
        );
        return;
      }

      if (
        !isPositiveWholeNumber(
          item.quantity
        )
      ) {
        setErrorMessage(
          `Quantity for item ${
            index + 1
          } must be a positive whole number.`
        );
        return;
      }

      const product =
        products.find(
          (candidate) =>
            candidate.id ===
            item.product_id
        );

      if (!product) {
        setErrorMessage(
          `The selected product for item ${
            index + 1
          } is no longer available.`
        );
        return;
      }

      /*
       * Quantity-only transfers are intentionally
       * restricted to quantity-tracked products.
       */
      if (
        product.tracking_mode !==
        "quantity"
      ) {
        setErrorMessage(
          `Product "${product.name}" uses ${product.tracking_mode} tracking and cannot use a quantity-only transfer. Batch and serial transfers require tracked allocation.`
        );
        return;
      }

      const variant =
        variants.find(
          (candidate) =>
            candidate.id ===
            item.variant_id
        );

      if (!variant) {
        setErrorMessage(
          `The selected variant for item ${
            index + 1
          } is no longer available.`
        );
        return;
      }

      if (
        variant.product_id !==
        item.product_id
      ) {
        setErrorMessage(
          `The selected variant for item ${
            index + 1
          } does not belong to the selected product.`
        );
        return;
      }

      if (
        seenVariants.has(
          item.variant_id
        )
      ) {
        setErrorMessage(
          "Each product variant can only appear once on a transfer."
        );
        return;
      }

      seenVariants.add(
        item.variant_id
      );
    }

    setSaving(true);

    try {
      const rpcItems =
        items.map((item) => ({
          product_id:
            item.product_id,
          variant_id:
            item.variant_id,
          quantity: Number(
            item.quantity
          ),
        }));

      const {
        data: transferId,
        error,
      } = await supabase.rpc(
        "create_stock_transfer",
        {
          p_company_id:
            companyId,

          p_source_warehouse_id:
            form.source_warehouse_id,

          p_source_location_id:
            form.source_location_id,

          p_destination_warehouse_id:
            form.destination_warehouse_id,

          p_destination_location_id:
            form.destination_location_id,

          p_items: rpcItems,

          p_notes:
            normalizeText(
              form.notes
            ) || null,
        }
      );

      if (error) {
        throw error;
      }

      if (!transferId) {
        throw new Error(
          "Transfer was created but no transfer ID was returned."
        );
      }

      window.location.href =
        `/warehouses/transfers/${transferId}`;
    } catch (error) {
      console.error(
        "Create transfer error:",
        error
      );

      if (error instanceof Error) {
        setErrorMessage(
          error.message
        );
      } else if (
        typeof error === "object" &&
        error !== null
      ) {
        const rpcError =
          error as {
            message?: string;
            details?: string;
            hint?: string;
            code?: string;
          };

        setErrorMessage(
          [
            rpcError.message,
            rpcError.details,
            rpcError.hint,
            rpcError.code
              ? `Code: ${rpcError.code}`
              : null,
          ]
            .filter(Boolean)
            .join(" — ") ||
            "Failed to create the transfer."
        );
      } else {
        setErrorMessage(
          "Failed to create the transfer."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-[1500px] px-6 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-10 w-72 rounded-lg bg-slate-200" />

              <div className="h-14 rounded-xl border border-slate-200 bg-white" />

              <div className="h-80 rounded-xl border border-slate-200 bg-white" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-[1500px] px-6 py-8">
          {/* Header */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-slate-900 p-2.5 text-white">
                <Icon
                  name="layers"
                  className="h-6 w-6"
                />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  New Transfer
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Move quantity-tracked inventory between warehouse locations.
                </p>
              </div>
            </div>

            <Link
              href="/warehouses/transfers"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Icon
                name="close"
                className="h-4 w-4"
              />
              Cancel
            </Link>
          </div>

          {/* Module Navigation */}
          <div className="mt-7 grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white md:grid-cols-3">
            <Link
              href="/warehouses"
              className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 md:border-b-0 md:border-r"
            >
              <Icon
                name="warehouse"
                className="h-5 w-5"
              />
              Warehouses
            </Link>

            <Link
              href="/warehouses/locations"
              className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 md:border-b-0 md:border-r"
            >
              <Icon
                name="location"
                className="h-5 w-5"
              />
              Locations
            </Link>

            <Link
              href="/warehouses/transfers"
              className="flex items-center gap-3 bg-slate-900 px-5 py-4 text-sm font-medium text-white"
            >
              <Icon
                name="layers"
                className="h-5 w-5"
              />
              Transfers
            </Link>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    Unable to continue
                  </p>

                  <p className="mt-1">
                    {errorMessage}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setErrorMessage("")
                  }
                  className="shrink-0 rounded-md p-1 text-red-500 transition hover:bg-red-100"
                  aria-label="Dismiss error"
                >
                  <Icon
                    name="close"
                    className="h-4 w-4"
                  />
                </button>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
              {successMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-6"
          >
            {/* Transfer Route */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                    <Icon
                      name="arrow"
                      className="h-5 w-5"
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-slate-950">
                      Transfer Route
                    </h2>

                    <p className="mt-0.5 text-sm text-slate-500">
                      Select where inventory is leaving and where it is going.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 p-6 lg:grid-cols-2">
                {/* Source */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-lg bg-white p-2 text-slate-700 shadow-sm">
                      <Icon
                        name="warehouse"
                        className="h-5 w-5"
                      />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Source
                      </p>

                      <p className="text-xs text-slate-500">
                        Inventory leaves this location.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="source_warehouse"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Warehouse
                      </label>

                      <select
                        id="source_warehouse"
                        value={
                          form.source_warehouse_id
                        }
                        onChange={(event) =>
                          handleSourceWarehouseChange(
                            event.target.value
                          )
                        }
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="">
                          Select warehouse
                        </option>

                        {warehouses.map(
                          (warehouse) => (
                            <option
                              key={warehouse.id}
                              value={warehouse.id}
                            >
                              {warehouse.name}
                              {warehouse.code
                                ? ` (${warehouse.code})`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="source_location"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Location
                      </label>

                      <select
                        id="source_location"
                        value={
                          form.source_location_id
                        }
                        onChange={(event) =>
                          updateForm(
                            "source_location_id",
                            event.target.value
                          )
                        }
                        disabled={
                          !form.source_warehouse_id
                        }
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">
                          Select location
                        </option>

                        {sourceLocations.map(
                          (location) => (
                            <option
                              key={location.id}
                              value={location.id}
                            >
                              {location.name}
                              {location.code
                                ? ` (${location.code})`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Destination */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="rounded-lg bg-white p-2 text-slate-700 shadow-sm">
                      <Icon
                        name="location"
                        className="h-5 w-5"
                      />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        Destination
                      </p>

                      <p className="text-xs text-slate-500">
                        Inventory will arrive here.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="destination_warehouse"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Warehouse
                      </label>

                      <select
                        id="destination_warehouse"
                        value={
                          form.destination_warehouse_id
                        }
                        onChange={(event) =>
                          handleDestinationWarehouseChange(
                            event.target.value
                          )
                        }
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="">
                          Select warehouse
                        </option>

                        {warehouses.map(
                          (warehouse) => (
                            <option
                              key={warehouse.id}
                              value={warehouse.id}
                            >
                              {warehouse.name}
                              {warehouse.code
                                ? ` (${warehouse.code})`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="destination_location"
                        className="mb-1.5 block text-sm font-medium text-slate-700"
                      >
                        Location
                      </label>

                      <select
                        id="destination_location"
                        value={
                          form.destination_location_id
                        }
                        onChange={(event) =>
                          updateForm(
                            "destination_location_id",
                            event.target.value
                          )
                        }
                        disabled={
                          !form.destination_warehouse_id
                        }
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="">
                          Select location
                        </option>

                        {destinationLocations.map(
                          (location) => (
                            <option
                              key={location.id}
                              value={location.id}
                            >
                              {location.name}
                              {location.code
                                ? ` (${location.code})`
                                : ""}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Transfer Items */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
                    <Icon
                      name="package"
                      className="h-5 w-5"
                    />
                  </div>

                  <div>
                    <h2 className="text-base font-semibold text-slate-950">
                      Transfer Items
                    </h2>

                    <p className="mt-0.5 text-sm text-slate-500">
                      Add quantity-tracked products and variants to move.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Icon
                    name="plus"
                    className="h-4 w-4"
                  />
                  Add Item
                </button>
              </div>

              <div className="p-6">
                {activeProductOptions.length ===
                0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                    <p className="font-semibold">
                      No quantity-tracked products are available.
                    </p>

                    <p className="mt-1">
                      Batch and serial products require their tracked allocation workflow and cannot be added to this quantity-only transfer.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map(
                      (item, index) => {
                        const itemVariants =
                          getProductVariants(
                            item.product_id
                          );

                        const selectedProduct =
                          products.find(
                            (product) =>
                              product.id ===
                              item.product_id
                          );

                        return (
                          <div
                            key={index}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_180px_auto] lg:items-end">
                              {/* Product */}
                              <div>
                                <label
                                  htmlFor={`product-${index}`}
                                  className="mb-1.5 block text-sm font-medium text-slate-700"
                                >
                                  Product
                                </label>

                                <select
                                  id={`product-${index}`}
                                  value={
                                    item.product_id
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      index,
                                      "product_id",
                                      event.target
                                        .value
                                    )
                                  }
                                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                >
                                  <option value="">
                                    Select product
                                  </option>

                                  {activeProductOptions.map(
                                    (product) => (
                                      <option
                                        key={
                                          product.id
                                        }
                                        value={
                                          product.id
                                        }
                                      >
                                        {
                                          product.name
                                        }
                                      </option>
                                    )
                                  )}
                                </select>

                                {selectedProduct && (
                                  <p className="mt-1.5 text-xs text-slate-500">
                                    Tracking:{" "}
                                    <span className="font-medium text-slate-700">
                                      {
                                        selectedProduct.tracking_mode
                                      }
                                    </span>
                                  </p>
                                )}
                              </div>

                              {/* Variant */}
                              <div>
                                <label
                                  htmlFor={`variant-${index}`}
                                  className="mb-1.5 block text-sm font-medium text-slate-700"
                                >
                                  Variant
                                </label>

                                <select
                                  id={`variant-${index}`}
                                  value={
                                    item.variant_id
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      index,
                                      "variant_id",
                                      event.target
                                        .value
                                    )
                                  }
                                  disabled={
                                    !item.product_id
                                  }
                                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                                >
                                  <option value="">
                                    Select variant
                                  </option>

                                  {itemVariants.map(
                                    (variant) => (
                                      <option
                                        key={
                                          variant.id
                                        }
                                        value={
                                          variant.id
                                        }
                                      >
                                        {
                                          variant.name
                                        }
                                        {variant.sku
                                          ? ` — ${variant.sku}`
                                          : ""}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>

                              {/* Quantity */}
                              <div>
                                <label
                                  htmlFor={`quantity-${index}`}
                                  className="mb-1.5 block text-sm font-medium text-slate-700"
                                >
                                  Quantity
                                </label>

                                <input
                                  id={`quantity-${index}`}
                                  type="number"
                                  min="1"
                                  step="1"
                                  inputMode="numeric"
                                  value={
                                    item.quantity
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateItem(
                                      index,
                                      "quantity",
                                      event.target
                                        .value
                                    )
                                  }
                                  placeholder="0"
                                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                />
                              </div>

                              {/* Remove */}
                              <button
                                type="button"
                                onClick={() =>
                                  removeItem(
                                    index
                                  )
                                }
                                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 lg:w-11"
                                aria-label={`Remove item ${
                                  index + 1
                                }`}
                                title="Remove item"
                              >
                                <Icon
                                  name="trash"
                                  className="h-4 w-4"
                                />

                                <span className="lg:hidden">
                                  Remove
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      }
                    )}

                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-500">
                        Quantity-tracked products only. Batch and serial transfers require tracked allocation.
                      </p>

                      <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                        Total units:{" "}
                        <span className="font-semibold text-slate-950">
                          {totalUnits.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Notes */}
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-base font-semibold text-slate-950">
                  Notes
                </h2>

                <p className="mt-0.5 text-sm text-slate-500">
                  Optional internal notes for this transfer.
                </p>
              </div>

              <div className="p-6">
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    updateForm(
                      "notes",
                      event.target.value
                    )
                  }
                  maxLength={2000}
                  rows={5}
                  placeholder="Add any useful internal notes..."
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />

                <div className="mt-2 text-right text-xs text-slate-400">
                  {form.notes.length}/2000
                </div>
              </div>
            </section>

            {/* Footer */}
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600">
                    <Icon
                      name="layers"
                      className="h-5 w-5"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Inventory is not moved yet
                    </p>

                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                      Creating this transfer creates a draft document only. Inventory will move out of the source location when the transfer is dispatched, and will be added to the destination when it is received.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Link
                    href="/warehouses/transfers"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Icon
                      name="close"
                      className="h-4 w-4"
                    />
                    Cancel
                  </Link>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      activeProductOptions.length ===
                        0
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon
                      name="save"
                      className="h-4 w-4"
                    />

                    {saving
                      ? "Creating Transfer..."
                      : "Create Transfer"}
                  </button>
                </div>
              </div>
            </section>
          </form>
        </div>
      </div>
    </AppShell>
  );
}