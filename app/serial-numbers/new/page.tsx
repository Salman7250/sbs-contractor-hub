"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  brand: string | null;
  tracking_mode: "serial";
};

type Variant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  cost_price: number;
  selling_price: number;
  is_default: boolean;
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
  location_type: string;
  is_active: boolean;
};

type SerialStatus =
  | "available"
  | "reserved"
  | "sold"
  | "returned"
  | "repair"
  | "rma"
  | "damaged"
  | "lost"
  | "disposed";

const STATUS_OPTIONS: {
  value: SerialStatus;
  label: string;
}[] = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "returned", label: "Returned" },
  { value: "repair", label: "Repair" },
  { value: "rma", label: "RMA" },
  { value: "damaged", label: "Damaged" },
  { value: "lost", label: "Lost" },
  { value: "disposed", label: "Disposed" },
];

const inputStyle = {
  border: "1px solid #cbd5e1",
};

const selectStyle = {
  border: "1px solid #cbd5e1",
};

const textareaStyle = {
  border: "1px solid #cbd5e1",
};

export default function NewSerialNumberPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");

  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");

  const [serialNumber, setSerialNumber] = useState("");
  const [barcode, setBarcode] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [status, setStatus] =
    useState<SerialStatus>("available");

  const [warrantyStart, setWarrantyStart] = useState("");
  const [warrantyEnd, setWarrantyEnd] = useState("");
  const [notes, setNotes] = useState("");

  const [errorMessage, setErrorMessage] = useState("");

  // ----------------------------------------------------------
  // Load company + serial-tracked products + warehouses
  // ----------------------------------------------------------

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setErrorMessage("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
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
          throw membershipError;
        }

        if (!membership?.company_id) {
          setErrorMessage(
            "No company membership was found for this account."
          );
          return;
        }

        const currentCompanyId = membership.company_id;

        setCompanyId(currentCompanyId);

        // ------------------------------------------------------
        // Company currency
        // ------------------------------------------------------

        const {
          data: company,
          error: companyError,
        } = await supabase
          .from("companies")
          .select("id, currency")
          .eq("id", currentCompanyId)
          .maybeSingle();

        if (companyError) {
          throw companyError;
        }

        setCurrency(company?.currency || "USD");

        // ------------------------------------------------------
        // Serial-tracked products
        // ------------------------------------------------------

        const {
          data: productData,
          error: productError,
        } = await supabase
          .from("products")
          .select(
            `
              id,
              name,
              brand,
              tracking_mode
            `
          )
          .eq("company_id", currentCompanyId)
          .eq("tracking_mode", "serial")
          .eq("status", "active")
          .order("name", {
            ascending: true,
          });

        if (productError) {
          throw productError;
        }

        setProducts(
          (productData || []) as Product[]
        );

        // ------------------------------------------------------
        // Active warehouses
        // ------------------------------------------------------

        const {
          data: warehouseData,
          error: warehouseError,
        } = await supabase
          .from("warehouses")
          .select(
            `
              id,
              name,
              code,
              is_active
            `
          )
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("is_default", {
            ascending: false,
          })
          .order("name", {
            ascending: true,
          });

        if (warehouseError) {
          throw warehouseError;
        }

        const loadedWarehouses =
          (warehouseData || []) as Warehouse[];

        setWarehouses(loadedWarehouses);

        // ------------------------------------------------------
        // Active warehouse locations
        // ------------------------------------------------------

        const {
          data: locationData,
          error: locationError,
        } = await supabase
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
          .eq("company_id", currentCompanyId)
          .eq("is_active", true)
          .order("name", {
            ascending: true,
          });

        if (locationError) {
          throw locationError;
        }

        const loadedLocations =
          (locationData || []) as WarehouseLocation[];

        setLocations(loadedLocations);

        // ------------------------------------------------------
        // Default warehouse + first location
        // ------------------------------------------------------

        const defaultWarehouse =
          loadedWarehouses[0];

        if (defaultWarehouse) {
          setWarehouseId(defaultWarehouse.id);

          const defaultLocation =
            loadedLocations.find(
              (location) =>
                location.warehouse_id ===
                defaultWarehouse.id
            );

          setLocationId(
            defaultLocation?.id || ""
          );
        }
      } catch (error) {
        console.error(
          "New serial number load error:",
          error
        );

        setErrorMessage(
          "Unable to load the serial number form. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [router, supabase]);

  // ----------------------------------------------------------
  // Locations available for selected warehouse
  // ----------------------------------------------------------

  const availableLocations = useMemo(() => {
    if (!warehouseId) {
      return [];
    }

    return locations.filter(
      (location) =>
        location.warehouse_id === warehouseId &&
        location.is_active
    );
  }, [locations, warehouseId]);

  // ----------------------------------------------------------
  // Load variants when product changes
  // ----------------------------------------------------------

  useEffect(() => {
    async function loadVariants() {
      if (!productId || !companyId) {
        setVariants([]);
        setVariantId("");
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("product_variants")
        .select(
          `
            id,
            product_id,
            name,
            sku,
            cost_price,
            selling_price,
            is_default,
            is_active
          `
        )
        .eq("product_id", productId)
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("is_default", {
          ascending: false,
        })
        .order("name", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Variant loading error:",
          error
        );

        setVariants([]);
        setVariantId("");
        return;
      }

      const loadedVariants =
        (data || []) as Variant[];

      setVariants(loadedVariants);

      const defaultVariant =
        loadedVariants.find(
          (variant) => variant.is_default
        ) || loadedVariants[0];

      if (defaultVariant) {
        setVariantId(defaultVariant.id);

        setCostPrice((currentCostPrice) => {
          if (currentCostPrice) {
            return currentCostPrice;
          }

          return String(
            defaultVariant.cost_price || 0
          );
        });
      } else {
        setVariantId("");
      }
    }

    loadVariants();
  }, [
    productId,
    companyId,
    supabase,
  ]);

  // ----------------------------------------------------------
  // Update cost when variant changes
  // ----------------------------------------------------------

  useEffect(() => {
    if (!variantId) return;

    const selectedVariant = variants.find(
      (variant) => variant.id === variantId
    );

    if (selectedVariant) {
      // This effect intentionally synchronizes the selected variant's cost price.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCostPrice(
        String(
          selectedVariant.cost_price || 0
        )
      );
    }
  }, [variantId, variants]);

  // ----------------------------------------------------------
  // Selected data
  // ----------------------------------------------------------

  const selectedProduct = products.find(
    (product) => product.id === productId
  );

  const selectedVariant = variants.find(
    (variant) => variant.id === variantId
  );

  const selectedWarehouse = warehouses.find(
    (warehouse) => warehouse.id === warehouseId
  );

  const selectedLocation = locations.find(
    (location) => location.id === locationId
  );

  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    setErrorMessage("");

    const cleanSerialNumber =
      serialNumber.trim();

    const cleanBarcode =
      barcode.trim();

    const parsedCost = Number(costPrice);

    // ------------------------------------------------------
    // Basic validation
    // ------------------------------------------------------

    if (!productId) {
      setErrorMessage(
        "Please select a product."
      );
      return;
    }

    if (!cleanSerialNumber) {
      setErrorMessage(
        "Serial number is required."
      );
      return;
    }

    if (
      !Number.isFinite(parsedCost) ||
      parsedCost < 0
    ) {
      setErrorMessage(
        "Please enter a valid cost price."
      );
      return;
    }

    if (!warehouseId) {
      setErrorMessage(
        "Please select a warehouse."
      );
      return;
    }

    if (!locationId) {
      setErrorMessage(
        "Please select a location."
      );
      return;
    }

    if (
      warrantyStart &&
      warrantyEnd &&
      warrantyEnd < warrantyStart
    ) {
      setErrorMessage(
        "Warranty end date cannot be before the warranty start date."
      );
      return;
    }

    try {
      setSaving(true);

      // ------------------------------------------------------
      // Re-authenticate
      // ------------------------------------------------------

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push("/login");
        return;
      }

      // ------------------------------------------------------
      // Verify company membership
      // ------------------------------------------------------

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
        setErrorMessage(
          "No company membership was found for this account."
        );
        return;
      }

      const currentCompanyId =
        membership.company_id;

      // ------------------------------------------------------
      // Verify selected product is serial tracked
      // ------------------------------------------------------

      const {
        data: verifiedProduct,
        error: productError,
      } = await supabase
        .from("products")
        .select(
          `
            id,
            name,
            tracking_mode
          `
        )
        .eq("id", productId)
        .eq("company_id", currentCompanyId)
        .eq("tracking_mode", "serial")
        .maybeSingle();

      if (productError) {
        throw productError;
      }

      if (!verifiedProduct) {
        setErrorMessage(
          "The selected product is not configured for serial-number tracking."
        );
        return;
      }

      // ------------------------------------------------------
      // Verify variant belongs to product/company
      // ------------------------------------------------------

      if (variantId) {
        const {
          data: verifiedVariant,
          error: verifiedVariantError,
        } = await supabase
          .from("product_variants")
          .select("id")
          .eq("id", variantId)
          .eq("product_id", productId)
          .eq("company_id", currentCompanyId)
          .maybeSingle();

        if (verifiedVariantError) {
          throw verifiedVariantError;
        }

        if (!verifiedVariant) {
          setErrorMessage(
            "The selected variant is invalid."
          );
          return;
        }
      }

      // ------------------------------------------------------
      // Verify warehouse
      // ------------------------------------------------------

      const {
        data: verifiedWarehouse,
        error: verifiedWarehouseError,
      } = await supabase
        .from("warehouses")
        .select(
          `
            id,
            name,
            code,
            is_active
          `
        )
        .eq("id", warehouseId)
        .eq("company_id", currentCompanyId)
        .eq("is_active", true)
        .maybeSingle();

      if (verifiedWarehouseError) {
        throw verifiedWarehouseError;
      }

      if (!verifiedWarehouse) {
        setErrorMessage(
          "The selected warehouse is invalid or inactive."
        );
        return;
      }

      // ------------------------------------------------------
      // Verify location belongs to warehouse/company
      // ------------------------------------------------------

      const {
        data: verifiedLocation,
        error: verifiedLocationError,
      } = await supabase
        .from("warehouse_locations")
        .select(
          `
            id,
            warehouse_id,
            name,
            code,
            is_active
          `
        )
        .eq("id", locationId)
        .eq("warehouse_id", warehouseId)
        .eq("company_id", currentCompanyId)
        .eq("is_active", true)
        .maybeSingle();

      if (verifiedLocationError) {
        throw verifiedLocationError;
      }

      if (!verifiedLocation) {
        setErrorMessage(
          "The selected location is invalid, inactive, or does not belong to the selected warehouse."
        );
        return;
      }

      // ------------------------------------------------------
      // Duplicate serial check
      // ------------------------------------------------------

      const {
        data: duplicateSerial,
        error: duplicateError,
      } = await supabase
        .from("serialized_units")
        .select("id, serial_number")
        .eq("company_id", currentCompanyId)
        .ilike(
          "serial_number",
          cleanSerialNumber
        )
        .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (duplicateSerial) {
        setErrorMessage(
          `Serial number "${cleanSerialNumber}" already exists in your company.`
        );
        return;
      }

      // ------------------------------------------------------
      // Duplicate barcode check
      // ------------------------------------------------------

      if (cleanBarcode) {
        const {
          data: duplicateBarcode,
          error: barcodeError,
        } = await supabase
          .from("serialized_units")
          .select("id, barcode")
          .eq("company_id", currentCompanyId)
          .eq("barcode", cleanBarcode)
          .maybeSingle();

        if (barcodeError) {
          throw barcodeError;
        }

        if (duplicateBarcode) {
          setErrorMessage(
            `Barcode "${cleanBarcode}" is already assigned to another serialized unit.`
          );
          return;
        }
      }

      // ------------------------------------------------------
      // Create serialized unit
      // ------------------------------------------------------

      const now = new Date().toISOString();

      const {
        data: createdUnit,
        error: insertError,
      } = await supabase
        .from("serialized_units")
        .insert({
          company_id: currentCompanyId,
          product_id: productId,
          variant_id: variantId || null,
          serial_number: cleanSerialNumber,
          barcode: cleanBarcode || null,
          status,
          warehouse_id: warehouseId,
          location_id: locationId,
          cost_price: parsedCost,
          warranty_start:
            warrantyStart || null,
          warranty_end:
            warrantyEnd || null,
          received_at: now,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(
          "Serialized unit insert error:",
          insertError
        );

        if (
          insertError.code === "23505"
        ) {
          setErrorMessage(
            "That serial number already exists in your company."
          );
          return;
        }

        throw insertError;
      }

      if (!createdUnit?.id) {
        throw new Error(
          "Serialized unit was created but no ID was returned."
        );
      }

      // ------------------------------------------------------
      // Create initial history event
      // ------------------------------------------------------

      const {
        error: historyError,
      } = await supabase
        .from("serial_number_history")
        .insert({
          company_id: currentCompanyId,
          serialized_unit_id:
            createdUnit.id,
          event_type: "created",
          from_status: null,
          to_status: status,
          from_warehouse_id: null,
          to_warehouse_id: warehouseId,
          reference_type: "serialized_unit",
          reference_id: createdUnit.id,
          notes: `Serialized unit created in ${verifiedWarehouse.name} / ${verifiedLocation.name}.`,
          created_by: user.id,
        });

      if (historyError) {
        console.error(
          "Serial history insert error:",
          historyError
        );

        // Roll back the serialized unit if
        // its initial history cannot be created.
        await supabase
          .from("serialized_units")
          .delete()
          .eq("id", createdUnit.id)
          .eq(
            "company_id",
            currentCompanyId
          );

        setErrorMessage(
          "The serial number could not be completed because its history record failed to save."
        );

        return;
      }

      // ------------------------------------------------------
      // Success
      // ------------------------------------------------------

      router.push(
        `/serial-numbers/${createdUnit.id}`
      );
      router.refresh();
    } catch (error: unknown) {
      console.error(
        "Create serial number error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the serial number. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title="Add Serial Number"
      description="Register an individual physical unit for serial tracking."
    >
      <div className="mx-auto max-w-4xl">
        {/* Back */}
        <Link
          href="/serial-numbers"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-600 hover:text-black"
        >
          <span className="mr-2">←</span>
          Back to Serial Numbers
        </Link>

        {/* Error */}
        {errorMessage && (
          <div
            className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700"
            style={{
              border: "1px solid #fecaca",
            }}
          >
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* ------------------------------------------------ */}
          {/* Product Information */}
          {/* ------------------------------------------------ */}

          <section
            className="rounded-xl bg-white p-6"
            style={{
              border: "1px solid #e2e8f0",
            }}
          >
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-950">
                Product Information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Select the serial-tracked product and
                variant this physical unit belongs to.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Product */}
              <div className="md:col-span-2">
                <label
                  htmlFor="product"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Product{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <select
                  id="product"
                  value={productId}
                  onChange={(event) => {
                    setProductId(
                      event.target.value
                    );
                    setCostPrice("");
                  }}
                  disabled={loading || saving}
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  style={selectStyle}
                >
                  <option value="">
                    Select a serial-tracked product
                  </option>

                  {products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name}
                      {product.brand
                        ? ` — ${product.brand}`
                        : ""}
                    </option>
                  ))}
                </select>

                {!loading &&
                  products.length === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      No active products are configured
                      for Serial Numbers tracking.
                    </p>
                  )}
              </div>

              {/* Variant */}
              <div>
                <label
                  htmlFor="variant"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Variant
                </label>

                <select
                  id="variant"
                  value={variantId}
                  onChange={(event) =>
                    setVariantId(
                      event.target.value
                    )
                  }
                  disabled={
                    !productId ||
                    variants.length === 0 ||
                    saving
                  }
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  style={selectStyle}
                >
                  <option value="">
                    {productId
                      ? variants.length > 0
                        ? "Select variant"
                        : "No variants found"
                      : "Select product first"}
                  </option>

                  {variants.map((variant) => (
                    <option
                      key={variant.id}
                      value={variant.id}
                    >
                      {variant.name}
                      {variant.sku
                        ? ` — ${variant.sku}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected product info */}
              <div className="flex items-end">
                {selectedProduct && (
                  <div className="w-full rounded-lg bg-slate-50 px-4 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Tracking
                    </div>

                    <div className="mt-1 text-sm font-medium text-slate-900">
                      Serial Numbers
                    </div>

                    {selectedVariant && (
                      <div className="mt-1 text-xs text-slate-500">
                        SKU:{" "}
                        {selectedVariant.sku ||
                          "—"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ */}
          {/* Warehouse & Location */}
          {/* ------------------------------------------------ */}

          <section
            className="rounded-xl bg-white p-6"
            style={{
              border: "1px solid #e2e8f0",
            }}
          >
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-950">
                Inventory Location
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Assign this physical unit to the warehouse
                and specific location where it is currently
                stored.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Warehouse */}
              <div>
                <label
                  htmlFor="warehouse"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Warehouse{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <select
                  id="warehouse"
                  value={warehouseId}
                  onChange={(event) => {
                    const nextWarehouseId =
                      event.target.value;

                    setWarehouseId(
                      nextWarehouseId
                    );

                    const firstLocation =
                      locations.find(
                        (location) =>
                          location.warehouse_id ===
                            nextWarehouseId &&
                          location.is_active
                      );

                    setLocationId(
                      firstLocation?.id || ""
                    );
                  }}
                  disabled={
                    loading ||
                    saving ||
                    warehouses.length === 0
                  }
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  style={selectStyle}
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

                {warehouses.length === 0 &&
                  !loading && (
                    <p className="mt-2 text-xs text-amber-600">
                      No active warehouses are available.
                      Create a warehouse before registering
                      inventory.
                    </p>
                  )}
              </div>

              {/* Location */}
              <div>
                <label
                  htmlFor="location"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Location / Bin{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <select
                  id="location"
                  value={locationId}
                  onChange={(event) =>
                    setLocationId(
                      event.target.value
                    )
                  }
                  disabled={
                    !warehouseId ||
                    availableLocations.length === 0 ||
                    saving
                  }
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
                  style={selectStyle}
                >
                  <option value="">
                    {!warehouseId
                      ? "Select warehouse first"
                      : availableLocations.length > 0
                        ? "Select location"
                        : "No locations found"}
                  </option>

                  {availableLocations.map(
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

                {warehouseId &&
                  availableLocations.length === 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      This warehouse has no active
                      locations yet.
                    </p>
                  )}
              </div>
            </div>

            {selectedWarehouse &&
              selectedLocation && (
                <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Current Inventory Location
                  </div>

                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {selectedWarehouse.name}{" "}
                    <span className="font-normal text-slate-400">
                      /
                    </span>{" "}
                    {selectedLocation.name}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {selectedWarehouse.code} •{" "}
                    {selectedLocation.code}
                  </div>
                </div>
              )}
          </section>

          {/* ------------------------------------------------ */}
          {/* Serial Details */}
          {/* ------------------------------------------------ */}

          <section
            className="rounded-xl bg-white p-6"
            style={{
              border: "1px solid #e2e8f0",
            }}
          >
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-950">
                Serial Details
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Enter the identifiers for this individual
                physical unit.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Serial Number */}
              <div>
                <label
                  htmlFor="serial_number"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Serial Number{" "}
                  <span className="text-red-500">
                    *
                  </span>
                </label>

                <input
                  id="serial_number"
                  type="text"
                  value={serialNumber}
                  onChange={(event) =>
                    setSerialNumber(
                      event.target.value
                    )
                  }
                  placeholder="e.g. SN-ABC-123456"
                  disabled={saving}
                  autoComplete="off"
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
                  style={inputStyle}
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  This must be unique within your company.
                </p>
              </div>

              {/* Barcode */}
              <div>
                <label
                  htmlFor="barcode"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Barcode
                </label>

                <input
                  id="barcode"
                  type="text"
                  value={barcode}
                  onChange={(event) =>
                    setBarcode(
                      event.target.value
                    )
                  }
                  placeholder="Scan or enter barcode"
                  disabled={saving}
                  autoComplete="off"
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
                  style={inputStyle}
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  You can use a hardware barcode scanner here.
                </p>
              </div>

              {/* Status */}
              <div>
                <label
                  htmlFor="status"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Status
                </label>

                <select
                  id="status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value as SerialStatus
                    )
                  }
                  disabled={saving}
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200"
                  style={selectStyle}
                >
                  {STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Cost */}
              <div>
                <label
                  htmlFor="cost_price"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Cost Price
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {currency}
                  </span>

                  <input
                    id="cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(event) =>
                      setCostPrice(
                        event.target.value
                      )
                    }
                    placeholder="0.00"
                    disabled={saving}
                    className="h-11 w-full rounded-lg bg-white pl-14 pr-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
                    style={inputStyle}
                  />
                </div>

                <p className="mt-1.5 text-xs text-slate-400">
                  Cost assigned to this individual unit.
                </p>
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ */}
          {/* Warranty */}
          {/* ------------------------------------------------ */}

          <section
            className="rounded-xl bg-white p-6"
            style={{
              border: "1px solid #e2e8f0",
            }}
          >
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-950">
                Warranty
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Optionally record the warranty period for
                this specific unit.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Start */}
              <div>
                <label
                  htmlFor="warranty_start"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Warranty Start
                </label>

                <input
                  id="warranty_start"
                  type="date"
                  value={warrantyStart}
                  onChange={(event) =>
                    setWarrantyStart(
                      event.target.value
                    )
                  }
                  disabled={saving}
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200"
                  style={inputStyle}
                />
              </div>

              {/* End */}
              <div>
                <label
                  htmlFor="warranty_end"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Warranty End
                </label>

                <input
                  id="warranty_end"
                  type="date"
                  value={warrantyEnd}
                  onChange={(event) =>
                    setWarrantyEnd(
                      event.target.value
                    )
                  }
                  disabled={saving}
                  className="h-11 w-full rounded-lg bg-white px-3.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-slate-200"
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          {/* ------------------------------------------------ */}
          {/* Notes */}
          {/* ------------------------------------------------ */}

          <section
            className="rounded-xl bg-white p-6"
            style={{
              border: "1px solid #e2e8f0",
            }}
          >
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-950">
                Notes
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Add any internal notes about this physical
                unit.
              </p>
            </div>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Optional notes..."
              rows={4}
              disabled={saving}
              className="w-full resize-y rounded-lg bg-white px-3.5 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:ring-2 focus:ring-slate-200"
              style={textareaStyle}
            />
          </section>

          {/* ------------------------------------------------ */}
          {/* Actions */}
          {/* ------------------------------------------------ */}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/serial-numbers"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              style={{
                border: "1px solid #cbd5e1",
              }}
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={
                saving ||
                loading ||
                !productId ||
                !serialNumber.trim() ||
                !warehouseId ||
                !locationId
              }
              className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Creating..."
                : "Create Serial Number"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}