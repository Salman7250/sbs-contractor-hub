"use client";

import {
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  name: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

type Warranty = {
  id: string;
  company_id: string;
  warranty_number: string;
  customer_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  order_id: string | null;
  serial_number: string | null;
  status: string;
  coverage_type: string;
  purchase_date: string | null;
  start_date: string;
  end_date: string;
  terms: string | null;
  notes: string | null;
};

type Props = {
  warranty: Warranty;
  customers: Customer[];
  products: Product[];
  variants: ProductVariant[];
};

const statusOptions = [
  {
    value: "active",
    label: "Active",
  },
  {
    value: "expiring",
    label: "Expiring Soon",
  },
  {
    value: "expired",
    label: "Expired",
  },
  {
    value: "claimed",
    label: "Claimed",
  },
  {
    value: "void",
    label: "Void",
  },
];

const coverageOptions = [
  {
    value: "standard",
    label: "Standard",
  },
  {
    value: "extended",
    label: "Extended",
  },
  {
    value: "limited",
    label: "Limited",
  },
  {
    value: "parts_only",
    label: "Parts Only",
  },
  {
    value: "labor_only",
    label: "Labor Only",
  },
  {
    value: "custom",
    label: "Custom",
  },
];

function inputClass() {
  return "w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10";
}

function labelClass() {
  return "mb-1.5 block text-sm font-medium text-gray-700";
}

export default function WarrantyEditClient({
  warranty,
  customers,
  products,
  variants,
}: Props) {
  const router = useRouter();
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const [warrantyNumber, setWarrantyNumber] = useState(
    warranty.warranty_number,
  );

  const [customerId, setCustomerId] = useState(
    warranty.customer_id ?? "",
  );

  const [productId, setProductId] = useState(
    warranty.product_id ?? "",
  );

  const [variantId, setVariantId] = useState(
    warranty.variant_id ?? "",
  );

  const [orderId, setOrderId] = useState(
    warranty.order_id ?? "",
  );

  const [serialNumber, setSerialNumber] = useState(
    warranty.serial_number ?? "",
  );

  const [status, setStatus] = useState(
    warranty.status,
  );

  const [coverageType, setCoverageType] = useState(
    warranty.coverage_type,
  );

  const [purchaseDate, setPurchaseDate] = useState(
    warranty.purchase_date ?? "",
  );

  const [startDate, setStartDate] = useState(
    warranty.start_date,
  );

  const [endDate, setEndDate] = useState(
    warranty.end_date,
  );

  const [terms, setTerms] = useState(
    warranty.terms ?? "",
  );

  const [notes, setNotes] = useState(
    warranty.notes ?? "",
  );

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredVariants = useMemo(() => {
    if (!productId) {
      return [];
    }

    return variants.filter(
      (variant) => variant.product_id === productId,
    );
  }, [productId, variants]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedWarrantyNumber =
      warrantyNumber.trim();

    const trimmedSerialNumber =
      serialNumber.trim();

    if (!trimmedWarrantyNumber) {
      setErrorMessage(
        "Warranty number is required.",
      );
      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage(
        "Warranty start and end dates are required.",
      );
      return;
    }

    if (endDate < startDate) {
      setErrorMessage(
        "Warranty end date cannot be before the start date.",
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id, role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw new Error(
          membershipError.message,
        );
      }

      if (!membership?.company_id) {
        throw new Error(
          "Your account is not connected to a company.",
        );
      }

      const companyId =
        membership.company_id;

      const { data: isAdmin, error: adminError } =
        await supabase.rpc(
          "is_company_admin",
          {
            p_company_id: companyId,
          },
        );

      if (adminError) {
        throw new Error(adminError.message);
      }

      let canManage = Boolean(isAdmin);

      if (!canManage) {
        const { data: hasPermission, error: permissionError } =
          await supabase.rpc(
            "employee_has_permission",
            {
              p_company_id: companyId,
              p_module: "warranty",
              p_action: "manage",
            },
          );

        if (permissionError) {
          throw new Error(
            permissionError.message,
          );
        }

        canManage = Boolean(hasPermission);
      }

      if (!canManage) {
        throw new Error(
          "You do not have permission to edit warranties.",
        );
      }

      const { error: updateError } =
        await supabase
          .from("warranties")
          .update({
            warranty_number:
              trimmedWarrantyNumber,
            customer_id:
              customerId || null,
            product_id:
              productId || null,
            variant_id:
              variantId || null,
            order_id:
              orderId.trim() || null,
            serial_number:
              trimmedSerialNumber || null,
            status,
            coverage_type: coverageType,
            purchase_date:
              purchaseDate || null,
            start_date: startDate,
            end_date: endDate,
            terms:
              terms.trim() || null,
            notes:
              notes.trim() || null,
          })
          .eq("id", warranty.id)
          .eq("company_id", companyId);

      if (updateError) {
        if (
          updateError.code === "23505"
        ) {
          throw new Error(
            "That warranty number already exists in this company.",
          );
        }

        throw new Error(
          updateError.message,
        );
      }

      await supabase
        .from("warranty_activity")
        .insert({
          company_id: companyId,
          warranty_id: warranty.id,
          action: "updated",
          message: `Warranty ${trimmedWarrantyNumber} was updated.`,
          created_by: user.id,
        });

      setSuccessMessage(
        "Warranty updated successfully.",
      );

      router.refresh();

      window.setTimeout(() => {
        router.push(
          `/warranty/${params.id}`,
        );
      }, 600);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while updating the warranty.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-content">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/warranty/${warranty.id}`,
                )
              }
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
            >
              <ArrowLeft size={16} />
              Back to Warranty
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white">
                <ShieldCheck size={21} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                  Edit Warranty
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Update warranty coverage, product,
                  customer, and validity details.
                </p>
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">
                Warranty Details
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Basic warranty identification and
                coverage information.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <label className={labelClass()}>
                  Warranty Number
                </label>

                <input
                  value={warrantyNumber}
                  onChange={(event) =>
                    setWarrantyNumber(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  placeholder="WAR-00001"
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label className={labelClass()}>
                  Serial Number
                </label>

                <input
                  value={serialNumber}
                  onChange={(event) =>
                    setSerialNumber(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  placeholder="Enter serial number"
                  disabled={saving}
                />
              </div>

              <div>
                <label className={labelClass()}>
                  Coverage Type
                </label>

                <select
                  value={coverageType}
                  onChange={(event) =>
                    setCoverageType(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={saving}
                >
                  {coverageOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className={labelClass()}>
                  Status
                </label>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={saving}
                >
                  {statusOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>

                <p className="mt-1.5 text-xs text-gray-500">
                  The database automatically keeps
                  normal warranty status aligned with
                  the expiry date.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">
                Customer & Product
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Connect this warranty to the customer
                and product it covers.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-2">
              <div>
                <label className={labelClass()}>
                  Customer
                </label>

                <select
                  value={customerId}
                  onChange={(event) =>
                    setCustomerId(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={saving}
                >
                  <option value="">
                    Select customer
                  </option>

                  {customers.map(
                    (customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name ||
                          customer.email ||
                          "Unnamed Customer"}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className={labelClass()}>
                  Product
                </label>

                <select
                  value={productId}
                  onChange={(event) => {
                    setProductId(
                      event.target.value,
                    );
                    setVariantId("");
                  }}
                  className={inputClass()}
                  disabled={saving}
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
                        {product.name ||
                          "Unnamed Product"}
                      
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className={labelClass()}>
                  Variant
                </label>

                <select
                  value={variantId}
                  onChange={(event) =>
                    setVariantId(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={
                    saving || !productId
                  }
                >
                  <option value="">
                    {productId
                      ? "Select variant"
                      : "Select a product first"}
                  </option>

                  {filteredVariants.map(
                    (variant) => (
                      <option
                        key={variant.id}
                        value={variant.id}
                      >
                        {variant.name ||
                          "Unnamed Variant"}
                        {variant.sku
                          ? ` — ${variant.sku}`
                          : ""}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className={labelClass()}>
                  Order ID
                </label>

                <input
                  value={orderId}
                  onChange={(event) =>
                    setOrderId(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  placeholder="Optional order UUID"
                  disabled={saving}
                />

                <p className="mt-1.5 text-xs text-gray-500">
                  Optional. Use this when the warranty
                  is connected to an existing order.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <div className="flex items-center gap-2">
                <CalendarDays
                  size={18}
                  className="text-gray-700"
                />

                <h2 className="text-base font-semibold text-gray-900">
                  Warranty Period
                </h2>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                Set the purchase and coverage dates.
              </p>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-3">
              <div>
                <label className={labelClass()}>
                  Purchase Date
                </label>

                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) =>
                    setPurchaseDate(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={saving}
                />
              </div>

              <div>
                <label className={labelClass()}>
                  Warranty Start
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={saving}
                  required
                />
              </div>

              <div>
                <label className={labelClass()}>
                  Warranty End
                </label>

                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(event) =>
                    setEndDate(
                      event.target.value,
                    )
                  }
                  className={inputClass()}
                  disabled={saving}
                  required
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-5">
              <h2 className="text-base font-semibold text-gray-900">
                Terms & Notes
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Store the warranty conditions and
                internal notes.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className={labelClass()}>
                  Warranty Terms
                </label>

                <textarea
                  value={terms}
                  onChange={(event) =>
                    setTerms(
                      event.target.value,
                    )
                  }
                  className={`${inputClass()} min-h-32 resize-y`}
                  placeholder="Describe what this warranty covers and any exclusions..."
                  disabled={saving}
                />
              </div>

              <div>
                <label className={labelClass()}>
                  Internal Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value,
                    )
                  }
                  className={`${inputClass()} min-h-28 resize-y`}
                  placeholder="Add internal notes about this warranty..."
                  disabled={saving}
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/warranty/${warranty.id}`,
                )
              }
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={17} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}