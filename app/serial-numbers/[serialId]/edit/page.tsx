"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  brand: string | null;
};

type Variant = {
  id: string;
  name: string;
  sku: string | null;
  cost_price: number;
  is_default: boolean;
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

const statuses: {
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

const borderStyle = {
  border: "1px solid #e2e8f0",
};

const inputClass =
  "mt-2 h-11 w-full rounded-lg bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-1 focus:ring-black";

export default function EditSerialNumberPage() {
  const router = useRouter();
  const params = useParams();

  const supabase = useMemo(() => createClient(), []);

  const serialId = Array.isArray(params.serialId)
    ? params.serialId[0]
    : params.serialId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);

  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");

  const [serialNumber, setSerialNumber] = useState("");
  const [barcode, setBarcode] = useState("");
  const [status, setStatus] =
    useState<SerialStatus>("available");

  const [costPrice, setCostPrice] = useState("0");

  const [warrantyStart, setWarrantyStart] =
    useState("");
  const [warrantyEnd, setWarrantyEnd] =
    useState("");

  const [receivedAt, setReceivedAt] =
    useState("");
  const [soldAt, setSoldAt] = useState("");

  const [notes, setNotes] = useState("");

  const loadVariants = useCallback(
    async (
      selectedProductId: string,
      selectedVariantId?: string
    ) => {
      const {
        data,
        error: variantError,
      } = await supabase
        .from("product_variants")
        .select(
          `
          id,
          name,
          sku,
          cost_price,
          is_default
        `
        )
        .eq("product_id", selectedProductId)
        .eq("is_active", true)
        .order("is_default", {
          ascending: false,
        })
        .order("name", {
          ascending: true,
        });

      if (variantError) {
        throw variantError;
      }

      const loadedVariants = (data || []) as Variant[];

      setVariants(loadedVariants);

      if (selectedVariantId) {
        const existing = loadedVariants.find(
          (item) => item.id === selectedVariantId
        );

        if (existing) {
          setVariantId(existing.id);
          setCostPrice(
            String(existing.cost_price ?? 0)
          );
          return;
        }
      }

      const defaultVariant = loadedVariants.find(
        (item) => item.is_default
      );

      if (defaultVariant) {
        setVariantId(defaultVariant.id);
        setCostPrice(
          String(defaultVariant.cost_price ?? 0)
        );
      } else {
        setVariantId("");
      }
    },
    [supabase]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!serialId) {
        setError("Serial number ID is missing.");
        return;
      }

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
        setError("No company membership found.");
        return;
      }

      const companyId = membership.company_id;

      const {
        data: company,
        error: companyError,
      } = await supabase
        .from("companies")
        .select("currency")
        .eq("id", companyId)
        .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      setCurrency(company?.currency || "USD");

      const {
        data: serial,
        error: serialError,
      } = await supabase
        .from("serialized_units")
        .select(
          `
            id,
            company_id,
            product_id,
            variant_id,
            serial_number,
            barcode,
            status,
            cost_price,
            warranty_start,
            warranty_end,
            received_at,
            sold_at,
            notes
          `
        )
        .eq("id", serialId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (serialError) {
        throw serialError;
      }

      if (!serial) {
        setError("Serial number not found.");
        return;
      }

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select("id, name, brand")
        .eq("company_id", companyId)
        .eq("tracking_mode", "serial")
        .eq("status", "active")
        .order("name", {
          ascending: true,
        });

      if (productError) {
        throw productError;
      }

      setProducts((productData || []) as Product[]);

      setProductId(serial.product_id);
      setSerialNumber(serial.serial_number || "");
      setBarcode(serial.barcode || "");
      setStatus(
        (serial.status ||
          "available") as SerialStatus
      );

      setCostPrice(
        String(serial.cost_price ?? 0)
      );

      setWarrantyStart(
        serial.warranty_start || ""
      );

      setWarrantyEnd(
        serial.warranty_end || ""
      );

      setReceivedAt(
        serial.received_at
          ? serial.received_at.substring(0, 10)
          : ""
      );

      setSoldAt(
        serial.sold_at
          ? serial.sold_at.substring(0, 10)
          : ""
      );

      setNotes(serial.notes || "");

      await loadVariants(
        serial.product_id,
        serial.variant_id || undefined
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load serial number."
      );
    } finally {
      setLoading(false);
    }
  }, [loadVariants, router, serialId, supabase]);

  useEffect(() => {
    // This effect intentionally starts the asynchronous serial-number synchronization.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleProductChange(
    newProductId: string
  ) {
    setProductId(newProductId);
    setVariantId("");
    setVariants([]);

    if (!newProductId) {
      return;
    }

    try {
      setError("");

      await loadVariants(newProductId);
    } catch (err) {
      console.error(err);

      setError(
        "Unable to load variants for this product."
      );
    }
  }

  function handleVariantChange(
    newVariantId: string
  ) {
    setVariantId(newVariantId);

    const selected = variants.find(
      (item) => item.id === newVariantId
    );

    if (selected) {
      setCostPrice(
        String(selected.cost_price ?? 0)
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const cleanSerial =
      serialNumber.trim();

    const cleanBarcode =
      barcode.trim();

    if (!cleanSerial) {
      setError("Serial number is required.");
      return;
    }

    if (!productId) {
      setError("Please select a product.");
      return;
    }

    if (
      warrantyStart &&
      warrantyEnd &&
      warrantyEnd < warrantyStart
    ) {
      setError(
        "Warranty end date cannot be before the warranty start date."
      );
      return;
    }

    const parsedCost = Number(costPrice);

    if (
      Number.isNaN(parsedCost) ||
      parsedCost < 0
    ) {
      setError(
        "Cost price must be a valid number."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(
        `/api/serial-numbers/${serialId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: productId,
            variant_id: variantId || null,
            serial_number: cleanSerial,
            barcode:
              cleanBarcode || null,
            status,
            cost_price: parsedCost,
            warranty_start:
              warrantyStart || null,
            warranty_end:
              warrantyEnd || null,
            received_at:
              receivedAt || null,
            sold_at:
              soldAt || null,
            notes:
              notes.trim() || null,
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save serial number."
        );
      }

      router.push(
        `/serial-numbers/${serialId}`
      );
      router.refresh();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save serial number."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Edit Serial Number"
        description="Update serialized asset information"
      >
        <div
          className="rounded-xl bg-white p-12 text-center text-sm text-slate-500"
          style={borderStyle}
        >
          Loading serial number...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Edit Serial Number"
      description={
        serialNumber
          ? `Update ${serialNumber}`
          : "Update serialized asset information"
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href={
            serialId
              ? `/serial-numbers/${serialId}`
              : "/serial-numbers"
          }
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-black"
        >
          <span className="mr-2">←</span>
          Back to Serial Number
        </Link>

        {error && (
          <div
            className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
            style={{
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* BASIC INFORMATION */}

          <section
            className="rounded-xl bg-white p-6"
            style={borderStyle}
          >
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Basic Information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Update the physical unit identification.
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Product
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <select
                  value={productId}
                  onChange={(event) =>
                    handleProductChange(
                      event.target.value
                    )
                  }
                  className={inputClass}
                  style={borderStyle}
                  required
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
                        {product.brand
                          ? ` — ${product.brand}`
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Variant
                </label>

                <select
                  value={variantId}
                  onChange={(event) =>
                    handleVariantChange(
                      event.target.value
                    )
                  }
                  disabled={!productId}
                  className={inputClass}
                  style={borderStyle}
                >
                  <option value="">
                    Default / No Variant
                  </option>

                  {variants.map(
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
                <label className="text-sm font-medium text-slate-700">
                  Serial Number
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <input
                  type="text"
                  value={serialNumber}
                  onChange={(event) =>
                    setSerialNumber(
                      event.target.value
                    )
                  }
                  className={inputClass}
                  style={borderStyle}
                  placeholder="Serial number"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Barcode
                </label>

                <input
                  type="text"
                  value={barcode}
                  onChange={(event) =>
                    setBarcode(
                      event.target.value
                    )
                  }
                  className={inputClass}
                  style={borderStyle}
                  placeholder="Optional barcode"
                />
              </div>
            </div>
          </section>

          {/* STATUS */}

          <section
            className="rounded-xl bg-white p-6"
            style={borderStyle}
          >
            <h2 className="text-base font-semibold text-slate-950">
              Inventory Status
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Update the current lifecycle state and cost.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target
                        .value as SerialStatus
                    )
                  }
                  className={inputClass}
                  style={borderStyle}
                >
                  {statuses.map(
                    (item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Cost Price
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(event) =>
                      setCostPrice(
                        event.target.value
                      )
                    }
                    className={`${inputClass} pr-16`}
                    style={borderStyle}
                  />

                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                    {currency}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* WARRANTY */}

          <section
            className="rounded-xl bg-white p-6"
            style={borderStyle}
          >
            <h2 className="text-base font-semibold text-slate-950">
              Warranty
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Set the warranty period for this individual unit.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Warranty Start
                </label>

                <input
                  type="date"
                  value={warrantyStart}
                  onChange={(event) =>
                    setWarrantyStart(
                      event.target.value
                    )
                  }
                  className={inputClass}
                  style={borderStyle}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Warranty End
                </label>

                <input
                  type="date"
                  value={warrantyEnd}
                  min={warrantyStart || undefined}
                  onChange={(event) =>
                    setWarrantyEnd(
                      event.target.value
                    )
                  }
                  className={inputClass}
                  style={borderStyle}
                />
              </div>
            </div>
          </section>

          {/* DATES */}

          <section
            className="rounded-xl bg-white p-6"
            style={borderStyle}
          >
            <h2 className="text-base font-semibold text-slate-950">
              Inventory Dates
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Received Date
                </label>

                <input
                  type="date"
                  value={receivedAt}
                  onChange={(event) =>
                    setReceivedAt(
                      event.target.value
                    )
                  }
                  className={inputClass}
                  style={borderStyle}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Sold Date
                </label>

                <input
                  type="date"
                  value={soldAt}
                  onChange={(event) =>
                    setSoldAt(
                      event.target.value
                    )
                  }
                  className={inputClass}
                  style={borderStyle}
                />
              </div>
            </div>
          </section>

          {/* NOTES */}

          <section
            className="rounded-xl bg-white p-6"
            style={borderStyle}
          >
            <h2 className="text-base font-semibold text-slate-950">
              Notes
            </h2>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              rows={5}
              className="mt-5 w-full rounded-lg bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
              style={borderStyle}
              placeholder="Internal notes..."
            />
          </section>

          {/* ACTIONS */}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end">
            <Link
              href={
                serialId
                  ? `/serial-numbers/${serialId}`
                  : "/serial-numbers"
              }
              className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              style={borderStyle}
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-black px-6 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}