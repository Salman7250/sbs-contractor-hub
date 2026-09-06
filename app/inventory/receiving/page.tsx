"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  tracking_mode: "none" | "quantity" | "batch" | "serial";
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  cost_price: number | null;
  is_active: boolean;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type WarehouseLocation = {
  id: string;
  warehouse_id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type ReceiptLine = {
  product_id: string;
  variant_id: string;
  quantity: string;
  unit_cost: string;
  warehouse_id: string;
  location_id: string;
};

type CompanyCurrency = {
  currency: string | null;
};

const supabase = createClient();

const emptyLine: ReceiptLine = {
  product_id: "",
  variant_id: "",
  quantity: "",
  unit_cost: "",
  warehouse_id: "",
  location_id: "",
};

export default function InventoryReceivingPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("AED");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  const [supplierName, setSupplierName] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<ReceiptLine[]>([
    {
      ...emptyLine,
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: {
          user,
        },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("You must be signed in.");
      }

      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error("No company membership was found.");
      }

      const currentCompanyId = membership.company_id;
      setCompanyId(currentCompanyId);

      const [
        companyResult,
        productsResult,
        variantsResult,
        warehousesResult,
        locationsResult,
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("currency")
          .eq("id", currentCompanyId)
          .maybeSingle(),

        supabase
          .from("products")
          .select("id,name,tracking_mode")
          .eq("company_id", currentCompanyId)
          .eq("status", "active")
          .eq("tracking_mode", "quantity")
          .order("name"),

        supabase
          .from("product_variants")
          .select(
            "id,product_id,name,sku,cost_price,is_active"
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("warehouses")
          .select("id,name,code,is_active")
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("warehouse_locations")
          .select(
            "id,warehouse_id,name,code,is_active"
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (companyResult.error) {
        throw companyResult.error;
      }

      if (productsResult.error) {
        throw productsResult.error;
      }

      if (variantsResult.error) {
        throw variantsResult.error;
      }

      if (warehousesResult.error) {
        throw warehousesResult.error;
      }

      if (locationsResult.error) {
        throw locationsResult.error;
      }

      const companyData = companyResult.data as CompanyCurrency | null;

      setCurrency(companyData?.currency || "AED");
      setProducts((productsResult.data || []) as Product[]);
      setVariants((variantsResult.data || []) as ProductVariant[]);
      setWarehouses((warehousesResult.data || []) as Warehouse[]);
      setLocations(
        (locationsResult.data || []) as WarehouseLocation[]
      );

      const defaultWarehouse =
        (warehousesResult.data || []).find(
          (warehouse) => warehouse.is_active
        ) || null;

      const defaultLocation = defaultWarehouse
        ? (locationsResult.data || []).find(
            (location) =>
              location.warehouse_id === defaultWarehouse.id &&
              location.is_active
          )
        : null;

      setLines([
        {
          ...emptyLine,
          warehouse_id: defaultWarehouse?.id || "",
          location_id: defaultLocation?.id || "",
        },
      ]);
    } catch (error) {
      console.error("Unable to load receiving data:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load receiving data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial receiving data load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const getProductVariants = useCallback(
    (productId: string) => {
      return variants.filter(
        (variant) =>
          variant.product_id === productId &&
          variant.is_active
      );
    },
    [variants]
  );

  const getWarehouseLocations = useCallback(
    (warehouseId: string) => {
      return locations.filter(
        (location) =>
          location.warehouse_id === warehouseId &&
          location.is_active
      );
    },
    [locations]
  );

  const updateLine = (
    index: number,
    updates: Partial<ReceiptLine>
  ) => {
    setLines((currentLines) =>
      currentLines.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              ...updates,
            }
          : line
      )
    );
  };

  const handleProductChange = (
    index: number,
    productId: string
  ) => {
    const productVariants = getProductVariants(productId);

    const defaultVariant =
      productVariants.find(
        (variant) => variant.is_active
      ) || productVariants[0];

    updateLine(index, {
      product_id: productId,
      variant_id: defaultVariant?.id || "",
      unit_cost:
        defaultVariant?.cost_price !== null &&
        defaultVariant?.cost_price !== undefined
          ? String(defaultVariant.cost_price)
          : "",
    });
  };

  const handleWarehouseChange = (
    index: number,
    warehouseId: string
  ) => {
    const warehouseLocations =
      getWarehouseLocations(warehouseId);

    const defaultLocation =
      warehouseLocations[0] || null;

    updateLine(index, {
      warehouse_id: warehouseId,
      location_id: defaultLocation?.id || "",
    });
  };

  const addLine = () => {
    const firstWarehouse = warehouses[0];

    const firstLocation = firstWarehouse
      ? getWarehouseLocations(firstWarehouse.id)[0]
      : null;

    setLines((currentLines) => [
      ...currentLines,
      {
        ...emptyLine,
        warehouse_id: firstWarehouse?.id || "",
        location_id: firstLocation?.id || "",
      },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((currentLines) => {
      if (currentLines.length === 1) {
        return currentLines;
      }

      return currentLines.filter(
        (_, lineIndex) => lineIndex !== index
      );
    });
  };

  const totals = useMemo(() => {
    let units = 0;
    let estimatedCost = 0;

    for (const line of lines) {
      const quantity = Number(line.quantity) || 0;
      const unitCost = Number(line.unit_cost) || 0;

      units += quantity;
      estimatedCost += quantity * unitCost;
    }

    return {
      units,
      estimatedCost,
    };
  }, [lines]);

  const validateLines = () => {
    if (!companyId) {
      return "Company information is not available.";
    }

    if (lines.length === 0) {
      return "Add at least one receipt line.";
    }

    if (!supplierName.trim()) {
      return "Enter a supplier name.";
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNumber = index + 1;

      if (!line.product_id) {
        return `Line ${lineNumber}: select a product.`;
      }

      if (!line.variant_id) {
        return `Line ${lineNumber}: select a product variant.`;
      }

      const quantity = Number(line.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return `Line ${lineNumber}: quantity must be a whole number greater than zero.`;
      }

      const unitCost = Number(line.unit_cost);

      if (!Number.isFinite(unitCost) || unitCost < 0) {
        return `Line ${lineNumber}: enter a valid unit cost.`;
      }

      if (!line.warehouse_id) {
        return `Line ${lineNumber}: select a warehouse.`;
      }

      if (!line.location_id) {
        return `Line ${lineNumber}: select a location.`;
      }
    }

    return null;
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const validationError = validateLines();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!companyId) {
      setErrorMessage(
        "Company information is not available."
      );
      return;
    }

    setSubmitting(true);

    try {
      const receiptNumber = `GRN-${Date.now()}`;

      const { data: receipt, error: receiptError } =
        await supabase
          .from("stock_receipts")
          .insert({
            company_id: companyId,
            receipt_number: receiptNumber,
            supplier_name: supplierName.trim(),
            reference_number:
              referenceNumber.trim() || null,
            notes: notes.trim() || null,
            status: "draft",
          })
          .select("id")
          .single();

      if (receiptError) {
        throw receiptError;
      }

      if (!receipt?.id) {
        throw new Error(
          "The stock receipt was created but no receipt ID was returned."
        );
      }

      const receiptItems = lines.map((line) => ({
        company_id: companyId,
        receipt_id: receipt.id,
        product_id: line.product_id,
        variant_id: line.variant_id,
        quantity: Number(line.quantity),
        unit_cost: Number(line.unit_cost),
        warehouse_id: line.warehouse_id,
        location_id: line.location_id,
      }));

      const { error: itemsError } = await supabase
        .from("stock_receipt_items")
        .insert(receiptItems);

      if (itemsError) {
        throw itemsError;
      }

      const {
        data: completionData,
        error: completionError,
      } = await supabase.rpc(
        "complete_stock_receipt",
        {
          p_company_id: companyId,
          p_receipt_id: receipt.id,
        }
      );

      console.log("COMPLETE STOCK RECEIPT DATA:", completionData);

if (completionError) {
  console.error("COMPLETE STOCK RECEIPT ERROR MESSAGE:", completionError.message);
  console.error("COMPLETE STOCK RECEIPT ERROR CODE:", completionError.code);
  console.error("COMPLETE STOCK RECEIPT ERROR DETAILS:", completionError.details);
  console.error("COMPLETE STOCK RECEIPT ERROR HINT:", completionError.hint);
  console.error(
    "COMPLETE STOCK RECEIPT ERROR JSON:",
    JSON.stringify(completionError, null, 2)
  );

  throw new Error(
    completionError.message || "Unable to complete stock receipt."
  );
}

console.log("COMPLETE STOCK RECEIPT SUCCESS:", completionData);

      if (completionError) {
        console.error(
          "COMPLETE STOCK RECEIPT ERROR:",
          completionError
        );

        throw completionError;
      }

      console.log(
        "COMPLETE STOCK RECEIPT SUCCESS:",
        completionData
      );

      setSuccessMessage(
        `Receipt ${receiptNumber} completed successfully.`
      );

      setSupplierName("");
      setReferenceNumber("");
      setNotes("");

      const firstWarehouse = warehouses[0];

      const firstLocation = firstWarehouse
        ? getWarehouseLocations(firstWarehouse.id)[0]
        : null;

      setLines([
        {
          ...emptyLine,
          warehouse_id: firstWarehouse?.id || "",
          location_id: firstLocation?.id || "",
        },
      ]);
    } catch (error) {
      console.error(
        "Unable to complete stock receipt:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete stock receipt."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6">
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            Loading receiving...
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-full bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                <Link
                  href="/inventory"
                  className="hover:text-gray-900"
                >
                  Inventory
                </Link>
                <span>/</span>
                <span>Receiving</span>
              </div>

              <h1 className="text-2xl font-semibold text-gray-900">
                Receive Stock
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Receive quantity-tracked inventory into a warehouse
                and location.
              </p>
            </div>

            <Link
              href="/inventory"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Back to Inventory
            </Link>
          </div>

          {errorMessage ? (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="font-semibold">
                Unable to receive stock
              </div>

              <div className="mt-1">
                {errorMessage}
              </div>
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-5 py-4">
                    <h2 className="text-base font-semibold text-gray-900">
                      Receipt Details
                    </h2>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="supplier"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Supplier
                      </label>

                      <input
                        id="supplier"
                        type="text"
                        value={supplierName}
                        onChange={(event) =>
                          setSupplierName(event.target.value)
                        }
                        placeholder="e.g. ITAD Resellers"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reference"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Reference Number
                      </label>

                      <input
                        id="reference"
                        type="text"
                        value={referenceNumber}
                        onChange={(event) =>
                          setReferenceNumber(
                            event.target.value
                          )
                        }
                        placeholder="e.g. PO-10045"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor="notes"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Notes
                      </label>

                      <textarea
                        id="notes"
                        value={notes}
                        onChange={(event) =>
                          setNotes(event.target.value)
                        }
                        rows={3}
                        placeholder="Optional receiving notes..."
                        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">
                        Receipt Items
                      </h2>

                      <p className="mt-1 text-xs text-gray-500">
                        Quantity-tracked products only.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addLine}
                      className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                      Add Item
                    </button>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {lines.map((line, index) => {
                      const productVariants =
                        getProductVariants(
                          line.product_id
                        );

                      const warehouseLocations =
                        getWarehouseLocations(
                          line.warehouse_id
                        );

                      return (
                        <div
                          key={`${index}-${line.product_id}`}
                          className="p-5"
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">
                              Item {index + 1}
                            </h3>

                            {lines.length > 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  removeLine(index)
                                }
                                className="text-sm font-medium text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Product
                              </label>

                              <select
                                value={line.product_id}
                                onChange={(event) =>
                                  handleProductChange(
                                    index,
                                    event.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                              >
                                <option value="">
                                  Select product
                                </option>

                                {products.map(
                                  (product) => (
                                    <option
                                      key={product.id}
                                      value={product.id}
                                    >
                                      {product.name}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Variant
                              </label>

                              <select
                                value={line.variant_id}
                                onChange={(event) =>
                                  updateLine(
                                    index,
                                    {
                                      variant_id:
                                        event.target
                                          .value,
                                    }
                                  )
                                }
                                disabled={
                                  !line.product_id
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none disabled:bg-gray-100 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                              >
                                <option value="">
                                  Select variant
                                </option>

                                {productVariants.map(
                                  (variant) => (
                                    <option
                                      key={variant.id}
                                      value={variant.id}
                                    >
                                      {variant.name}
                                      {variant.sku
                                        ? ` — ${variant.sku}`
                                        : ""}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Quantity
                              </label>

                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(
                                    index,
                                    {
                                      quantity:
                                        event.target
                                          .value,
                                    }
                                  )
                                }
                                placeholder="0"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Unit Cost
                              </label>

                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                                  {currency}
                                </span>

                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={line.unit_cost}
                                  onChange={(event) =>
                                    updateLine(
                                      index,
                                      {
                                        unit_cost:
                                          event.target
                                            .value,
                                      }
                                    )
                                  }
                                  placeholder="0.00"
                                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-14 pr-3 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Warehouse
                              </label>

                              <select
                                value={line.warehouse_id}
                                onChange={(event) =>
                                  handleWarehouseChange(
                                    index,
                                    event.target
                                      .value
                                  )
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
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
                                      {warehouse.name} (
                                      {warehouse.code})
                                    </option>
                                  )
                                )}
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Location
                              </label>

                              <select
                                value={line.location_id}
                                onChange={(event) =>
                                  updateLine(
                                    index,
                                    {
                                      location_id:
                                        event.target
                                          .value,
                                    }
                                  )
                                }
                                disabled={
                                  !line.warehouse_id
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none disabled:bg-gray-100 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                              >
                                <option value="">
                                  Select location
                                </option>

                                {warehouseLocations.map(
                                  (location) => (
                                    <option
                                      key={location.id}
                                      value={location.id}
                                    >
                                      {location.name} (
                                      {location.code})
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-6 rounded-xl border border-gray-200 bg-white shadow-sm">
                  <div className="border-b border-gray-200 px-5 py-4">
                    <h2 className="text-base font-semibold text-gray-900">
                      Receipt Summary
                    </h2>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Items
                      </span>

                      <span className="text-sm font-medium text-gray-900">
                        {lines.length}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Total Units
                      </span>

                      <span className="text-sm font-medium text-gray-900">
                        {totals.units}
                      </span>
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Estimated Cost
                      </div>

                      <div className="mt-1 text-2xl font-semibold text-gray-900">
                        {currency}{" "}
                        {totals.estimatedCost.toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-600">
                      Completing this receipt will create the
                      inventory stock-in movements and mark the
                      receipt as completed.
                    </div>

                    <button
                      type="submit"
                      disabled={
                        submitting || !companyId
                      }
                      className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting
                        ? "Completing Receipt..."
                        : "Complete Receipt"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}