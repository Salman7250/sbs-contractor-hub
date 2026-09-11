"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Provider = {
  id: string;
  name: string;
  company_name: string | null;
  provider_number: string;
  status: "active" | "inactive" | "blocked";
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
  track_inventory: boolean | null;
  tracking_mode: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
};

type Warehouse = {
  id: string;
  name: string;
};

type InventoryRecord = {
  id: string;
  product_id: string;
  variant_id: string | null;
  warehouse_id: string;
  quantity: number;
};

type SerializedUnit = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serial_number: string;
  status: string;
  warehouse_id: string | null;
};

type JobItemDraft = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
  service_description: string;
  unit_service_cost: number;
  notes: string;
};

type SourceType =
  | "internal"
  | "repair"
  | "warranty"
  | "rma"
  | "purchase"
  | "other";

type PriorityType =
  | "low"
  | "normal"
  | "high"
  | "urgent";

const formatMoney = (value: number) =>
  `AED ${Number(value || 0).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getTomorrowDate = () => {
  const date = new Date();

  date.setDate(date.getDate() + 1);

  return date.toISOString().split("T")[0];
};

const getErrorMessage = (
  error: unknown,
  fallback: string
) => {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    const message = (
      error as {
        message?: unknown;
      }
    ).message;

    if (
      typeof message === "string" &&
      message.trim()
    ) {
      return message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

function NewServiceJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const initialProviderId =
    searchParams.get("provider") ||
    searchParams.get("provider_id") ||
    "";

  const initialCustomerId =
    searchParams.get("customer") ||
    searchParams.get("customer_id") ||
    "";

  /*
   * ---------------------------------------------------------
   * DATA
   * ---------------------------------------------------------
   */

  const [providers, setProviders] = useState<
    Provider[]
  >([]);

  const [customers, setCustomers] = useState<
    Customer[]
  >([]);

  const [products, setProducts] = useState<
    Product[]
  >([]);

  const [variants, setVariants] = useState<
    ProductVariant[]
  >([]);

  const [warehouses, setWarehouses] = useState<
    Warehouse[]
  >([]);

  const [inventory, setInventory] = useState<
    InventoryRecord[]
  >([]);

  const [serializedUnits, setSerializedUnits] =
    useState<SerializedUnit[]>([]);

  /*
   * ---------------------------------------------------------
   * JOB DETAILS
   * ---------------------------------------------------------
   */

  const [providerId, setProviderId] =
    useState(initialProviderId);

  const [customerId, setCustomerId] =
    useState(initialCustomerId);

  const [serviceType, setServiceType] =
    useState("");

  const [source, setSource] =
    useState<SourceType>("internal");

  const [priority, setPriority] =
    useState<PriorityType>("normal");

  const [dispatchedDate, setDispatchedDate] =
    useState("");

  const [expectedReturnDate, setExpectedReturnDate] =
    useState(getTomorrowDate());

  const [notes, setNotes] =
    useState("");

  const [internalNotes, setInternalNotes] =
    useState("");

  /*
   * ---------------------------------------------------------
   * ITEM BUILDER
   * ---------------------------------------------------------
   */

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [selectedVariantId, setSelectedVariantId] =
    useState("");

  const [selectedWarehouseId, setSelectedWarehouseId] =
    useState("");

  const [
    selectedSerializedUnitId,
    setSelectedSerializedUnitId,
  ] = useState("");

  const [selectedQuantity, setSelectedQuantity] =
    useState("1");

  const [
    selectedDescription,
    setSelectedDescription,
  ] = useState("");

  const [selectedUnitCost, setSelectedUnitCost] =
    useState("");

  const [selectedItemNotes, setSelectedItemNotes] =
    useState("");

  const [items, setItems] = useState<
    JobItemDraft[]
  >([]);

  /*
   * ---------------------------------------------------------
   * STATE
   * ---------------------------------------------------------
   */

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  /*
   * ---------------------------------------------------------
   * LOAD DATA
   * ---------------------------------------------------------
   *
   * Each query is deliberately separate.
   *
   * This means if something goes wrong we know exactly
   * which SBS table/query caused it instead of receiving
   * one generic Promise.all error.
   */

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      /*
       * AUTH
       */

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          `Authentication failed: ${authError.message}`
        );
      }

      if (!user) {
        router.push("/login");
        return;
      }

      /*
       * COMPANY
       */

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
          `Company membership query failed: ${membershipError.message}`
        );
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership was found for your account."
        );
      }

      const companyId =
        membership.company_id;

      /*
       * -----------------------------------------------------
       * SERVICE PROVIDERS
       * -----------------------------------------------------
       */

      const {
        data: providerData,
        error: providerError,
      } = await supabase
        .from("service_providers")
        .select(
          "id,name,company_name,provider_number,status"
        )
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name", {
          ascending: true,
        });

      if (providerError) {
        throw new Error(
          `Service providers query failed: ${providerError.message}`
        );
      }

      setProviders(
        (providerData || []) as Provider[]
      );

      /*
       * If URL supplied a provider, only use it if
       * it belongs to this company and is active.
       */

      if (initialProviderId) {
        const matchingProvider =
          (providerData || []).find(
            (provider) =>
              provider.id ===
              initialProviderId
          );

        setProviderId(
          matchingProvider
            ? initialProviderId
            : ""
        );
      }

      /*
       * -----------------------------------------------------
       * CUSTOMERS
       * -----------------------------------------------------
       */

      const {
        data: customerData,
        error: customerError,
      } = await supabase
        .from("customers")
        .select(
          "id,name,email,phone"
        )
        .eq("company_id", companyId)
        .order("name", {
          ascending: true,
        });

      if (customerError) {
        throw new Error(
          `Customers query failed: ${customerError.message}`
        );
      }

      setCustomers(
        (customerData || []) as Customer[]
      );

      if (initialCustomerId) {
        const matchingCustomer =
          (customerData || []).find(
            (customer) =>
              customer.id ===
              initialCustomerId
          );

        setCustomerId(
          matchingCustomer
            ? initialCustomerId
            : ""
        );
      }

      /*
       * -----------------------------------------------------
       * PRODUCTS
       * -----------------------------------------------------
       *
       * IMPORTANT:
       * products DOES NOT contain sku.
       *
       * SKU belongs to product_variants.
       */

      const {
        data: productData,
        error: productError,
      } = await supabase
        .from("products")
        .select(
          "id,name,track_inventory,tracking_mode"
        )
        .eq("company_id", companyId)
        .order("name", {
          ascending: true,
        });

      if (productError) {
        throw new Error(
          `Products query failed: ${productError.message}`
        );
      }

      setProducts(
        (productData || []) as Product[]
      );

      /*
       * -----------------------------------------------------
       * PRODUCT VARIANTS
       * -----------------------------------------------------
       */

      const {
        data: variantData,
        error: variantError,
      } = await supabase
        .from("product_variants")
        .select(
          "id,product_id,name,sku"
        )
        .eq("company_id", companyId)
        .order("name", {
          ascending: true,
        });

      if (variantError) {
        throw new Error(
          `Product variants query failed: ${variantError.message}`
        );
      }

      setVariants(
        (variantData || []) as ProductVariant[]
      );

      /*
       * -----------------------------------------------------
       * WAREHOUSES
       * -----------------------------------------------------
       */

      const {
        data: warehouseData,
        error: warehouseError,
      } = await supabase
        .from("warehouses")
        .select("id,name")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        });

      if (warehouseError) {
        throw new Error(
          `Warehouses query failed: ${warehouseError.message}`
        );
      }

      setWarehouses(
        (warehouseData || []) as Warehouse[]
      );

      /*
       * Automatically select the first warehouse.
       */

      if (
        !selectedWarehouseId &&
        warehouseData &&
        warehouseData.length > 0
      ) {
        setSelectedWarehouseId(
          warehouseData[0].id
        );
      }

      /*
       * -----------------------------------------------------
       * INVENTORY
       * -----------------------------------------------------
       */

      const {
        data: inventoryData,
        error: inventoryError,
      } = await supabase
        .from("inventory")
        .select(
          "id,product_id,variant_id,warehouse_id,quantity"
        )
        .eq("company_id", companyId)
        .gt("quantity", 0);

      if (inventoryError) {
        throw new Error(
          `Inventory query failed: ${inventoryError.message}`
        );
      }

      setInventory(
        (inventoryData || []) as InventoryRecord[]
      );

      /*
       * -----------------------------------------------------
       * SERIALIZED UNITS
       * -----------------------------------------------------
       */

      const {
        data: serializedData,
        error: serializedError,
      } = await supabase
        .from("serialized_units")
        .select(
          "id,product_id,variant_id,serial_number,status,warehouse_id"
        )
        .eq("company_id", companyId)
        .eq("status", "in_stock")
        .order("serial_number", {
          ascending: true,
        });

      if (serializedError) {
        throw new Error(
          `Serialized units query failed: ${serializedError.message}`
        );
      }

      setSerializedUnits(
        (serializedData ||
          []) as SerializedUnit[]
      );
    } catch (error) {
      console.error(
        "NEW SERVICE JOB LOAD ERROR:",
        error
      );

      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to load service job data."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [
    initialCustomerId,
    initialProviderId,
    router,
    selectedWarehouseId,
    supabase,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /*
   * ---------------------------------------------------------
   * SELECTED PRODUCT
   * ---------------------------------------------------------
   */

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) =>
          product.id ===
          selectedProductId
      ) || null,
    [
      products,
      selectedProductId,
    ]
  );

  /*
   * ---------------------------------------------------------
   * VARIANTS FOR SELECTED PRODUCT
   * ---------------------------------------------------------
   */

  const productVariants = useMemo(
    () =>
      variants.filter(
        (variant) =>
          variant.product_id ===
          selectedProductId
      ),
    [
      variants,
      selectedProductId,
    ]
  );

  /*
   * ---------------------------------------------------------
   * SERIAL TRACKING
   * ---------------------------------------------------------
   */

  const productTracksSerials =
    selectedProduct?.tracking_mode ===
      "serial" ||
    selectedProduct?.tracking_mode ===
      "serialized" ||
    selectedProduct?.tracking_mode ===
      "serial_number";

  /*
   * ---------------------------------------------------------
   * AVAILABLE SERIALIZED UNITS
   * ---------------------------------------------------------
   */

  const availableSerializedUnits =
    useMemo(() => {
      if (!selectedProductId) {
        return [];
      }

      return serializedUnits.filter(
        (unit) => {
          if (
            unit.product_id !==
            selectedProductId
          ) {
            return false;
          }

          if (
            selectedVariantId &&
            unit.variant_id !==
              selectedVariantId
          ) {
            return false;
          }

          if (
            selectedWarehouseId &&
            unit.warehouse_id !==
              selectedWarehouseId
          ) {
            return false;
          }

          return (
            unit.status ===
            "in_stock"
          );
        }
      );
    }, [
      selectedProductId,
      selectedVariantId,
      selectedWarehouseId,
      serializedUnits,
    ]);

  /*
   * ---------------------------------------------------------
   * AVAILABLE QUANTITY
   * ---------------------------------------------------------
   */

  const availableQuantity = useMemo(() => {
    if (!selectedProductId) {
      return 0;
    }

    if (productTracksSerials) {
      return availableSerializedUnits.length;
    }

    return inventory
      .filter((record) => {
        return (
          record.product_id ===
            selectedProductId &&
          record.variant_id ===
            (selectedVariantId ||
              null) &&
          record.warehouse_id ===
            selectedWarehouseId
        );
      })
      .reduce(
        (sum, record) =>
          sum +
          Number(
            record.quantity || 0
          ),
        0
      );
  }, [
    availableSerializedUnits,
    inventory,
    productTracksSerials,
    selectedProductId,
    selectedVariantId,
    selectedWarehouseId,
  ]);

  /*
   * ---------------------------------------------------------
   * TOTALS
   * ---------------------------------------------------------
   */

  const estimatedTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ) *
            Number(
              item.unit_service_cost ||
                0
            ),
        0
      ),
    [items]
  );

  const totalQuantity = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.quantity || 0
          ),
        0
      ),
    [items]
  );

  /*
   * ---------------------------------------------------------
   * ITEM HELPERS
   * ---------------------------------------------------------
   */

  const getProductName = (
    productId: string
  ) =>
    products.find(
      (product) =>
        product.id ===
        productId
    )?.name || "Unknown product";

  const getProductVariantSku = (
    productId: string,
    variantId: string | null
  ) => {
    if (!variantId) {
      return null;
    }

    return (
      variants.find(
        (variant) =>
          variant.id ===
            variantId &&
          variant.product_id ===
            productId
      )?.sku || null
    );
  };

  const getVariantName = (
    variantId: string | null
  ) => {
    if (!variantId) {
      return null;
    }

    return (
      variants.find(
        (variant) =>
          variant.id ===
          variantId
      )?.name || null
    );
  };

  const getSerialNumber = (
    serializedUnitId: string | null
  ) => {
    if (!serializedUnitId) {
      return null;
    }

    return (
      serializedUnits.find(
        (unit) =>
          unit.id ===
          serializedUnitId
      )?.serial_number || null
    );
  };

  /*
   * ---------------------------------------------------------
   * RESET ITEM FORM
   * ---------------------------------------------------------
   */

  const resetItemForm = () => {
    setSelectedProductId("");
    setSelectedVariantId("");
    setSelectedSerializedUnitId("");
    setSelectedQuantity("1");
    setSelectedDescription("");
    setSelectedUnitCost("");
    setSelectedItemNotes("");
  };

  /*
   * ---------------------------------------------------------
   * ADD ITEM
   * ---------------------------------------------------------
   */

  const addItem = () => {
    setErrorMessage("");

    if (!selectedWarehouseId) {
      setErrorMessage(
        "Select the warehouse the stock will be dispatched from."
      );
      return;
    }

    if (!selectedProductId) {
      setErrorMessage(
        "Select a product."
      );
      return;
    }

    const numericQuantity =
      Number(selectedQuantity);

    if (
      !Number.isFinite(
        numericQuantity
      ) ||
      numericQuantity <= 0
    ) {
      setErrorMessage(
        "Quantity must be greater than zero."
      );
      return;
    }

    const numericUnitCost =
      Number(
        selectedUnitCost || 0
      );

    if (
      !Number.isFinite(
        numericUnitCost
      ) ||
      numericUnitCost < 0
    ) {
      setErrorMessage(
        "Service cost cannot be negative."
      );
      return;
    }

    /*
     * Serialized product
     */

    if (productTracksSerials) {
      if (!selectedSerializedUnitId) {
        setErrorMessage(
          "Select a serial number."
        );
        return;
      }

      if (numericQuantity !== 1) {
        setErrorMessage(
          "Serialized items must have a quantity of 1."
        );
        return;
      }

      const duplicate =
        items.some(
          (item) =>
            item.serialized_unit_id ===
            selectedSerializedUnitId
        );

      if (duplicate) {
        setErrorMessage(
          "That serial number has already been added to this job."
        );
        return;
      }

      const selectedUnit =
        availableSerializedUnits.find(
          (unit) =>
            unit.id ===
            selectedSerializedUnitId
        );

      if (!selectedUnit) {
        setErrorMessage(
          "The selected serial number is no longer available in the selected warehouse."
        );
        return;
      }
    } else {
      /*
       * Quantity-tracked product
       */

      if (
        numericQuantity >
        availableQuantity
      ) {
        setErrorMessage(
          `Only ${availableQuantity} units are currently available in the selected warehouse.`
        );
        return;
      }

      /*
       * Prevent the same product/variant from being
       * accidentally added multiple times beyond stock.
       */

      const alreadyAllocated =
        items
          .filter(
            (item) =>
              item.product_id ===
                selectedProductId &&
              item.variant_id ===
                (selectedVariantId ||
                  null) &&
              !item.serialized_unit_id
          )
          .reduce(
            (sum, item) =>
              sum +
              Number(
                item.quantity || 0
              ),
            0
          );

      if (
        alreadyAllocated +
          numericQuantity >
        availableQuantity
      ) {
        setErrorMessage(
          `Only ${availableQuantity} units are available. ${alreadyAllocated} are already added to this job.`
        );
        return;
      }
    }

    const newItem: JobItemDraft = {
      id: crypto.randomUUID(),
      product_id:
        selectedProductId,
      variant_id:
        selectedVariantId ||
        null,
      serialized_unit_id:
        selectedSerializedUnitId ||
        null,
      quantity:
        productTracksSerials
          ? 1
          : numericQuantity,
      service_description:
        selectedDescription.trim(),
      unit_service_cost:
        numericUnitCost,
      notes:
        selectedItemNotes.trim(),
    };

    setItems(
      (current) => [
        ...current,
        newItem,
      ]
    );

    resetItemForm();
  };

  /*
   * ---------------------------------------------------------
   * REMOVE ITEM
   * ---------------------------------------------------------
   */

  const removeItem = (
    itemId: string
  ) => {
    setItems(
      (current) =>
        current.filter(
          (item) =>
            item.id !== itemId
        )
    );
  };

  /*
   * ---------------------------------------------------------
   * PRODUCT CHANGE
   * ---------------------------------------------------------
   */

  const handleProductChange = (
    value: string
  ) => {
    setSelectedProductId(value);
    setSelectedVariantId("");
    setSelectedSerializedUnitId("");
    setSelectedQuantity("1");
  };

  /*
   * ---------------------------------------------------------
   * VARIANT CHANGE
   * ---------------------------------------------------------
   */

  const handleVariantChange = (
    value: string
  ) => {
    setSelectedVariantId(value);
    setSelectedSerializedUnitId("");
  };

  /*
   * ---------------------------------------------------------
   * SUBMIT
   * ---------------------------------------------------------
   */

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");

    if (!providerId) {
      setErrorMessage(
        "Select a service provider."
      );
      return;
    }

    if (!serviceType.trim()) {
      setErrorMessage(
        "Service type is required."
      );
      return;
    }

    if (!items.length) {
      setErrorMessage(
        "Add at least one service item."
      );
      return;
    }

    if (
      dispatchedDate &&
      expectedReturnDate &&
      expectedReturnDate <
        dispatchedDate
    ) {
      setErrorMessage(
        "Expected return date cannot be before the dispatch date."
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * AUTH
       */

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(
          `Authentication failed: ${authError.message}`
        );
      }

      if (!user) {
        router.push("/login");
        return;
      }

      /*
       * COMPANY
       */

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
          `Company membership query failed: ${membershipError.message}`
        );
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership was found for your account."
        );
      }

      const companyId =
        membership.company_id;

      /*
       * -----------------------------------------------------
       * VALIDATE PROVIDER
       * -----------------------------------------------------
       */

      const {
        data: provider,
        error: providerError,
      } = await supabase
        .from("service_providers")
        .select("id,status")
        .eq("id", providerId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (providerError) {
        throw new Error(
          `Provider validation failed: ${providerError.message}`
        );
      }

      if (!provider) {
        throw new Error(
          "The selected service provider could not be found."
        );
      }

      if (
        provider.status !==
        "active"
      ) {
        throw new Error(
          "The selected service provider is not active."
        );
      }

      /*
       * -----------------------------------------------------
       * VALIDATE CUSTOMER
       * -----------------------------------------------------
       */

      if (customerId) {
        const {
          data: customer,
          error: customerError,
        } = await supabase
          .from("customers")
          .select("id")
          .eq("id", customerId)
          .eq(
            "company_id",
            companyId
          )
          .maybeSingle();

        if (customerError) {
          throw new Error(
            `Customer validation failed: ${customerError.message}`
          );
        }

        if (!customer) {
          throw new Error(
            "The selected customer could not be found."
          );
        }
      }

      /*
       * -----------------------------------------------------
       * VALIDATE WAREHOUSE
       * -----------------------------------------------------
       */

      const warehouseIds =
        Array.from(
          new Set(
            [
              selectedWarehouseId,
              ...items.map(
                () =>
                  selectedWarehouseId
              ),
            ].filter(Boolean)
          )
        );

      if (
        warehouseIds.length
      ) {
        const {
          data: validWarehouses,
          error: warehouseValidationError,
        } = await supabase
          .from("warehouses")
          .select(
            "id,name"
          )
          .eq(
            "company_id",
            companyId
          )
          .in(
            "id",
            warehouseIds
          );

        if (
          warehouseValidationError
        ) {
          throw new Error(
            `Warehouse validation failed: ${warehouseValidationError.message}`
          );
        }

        if (
          (validWarehouses || [])
            .length !==
          warehouseIds.length
        ) {
          throw new Error(
            "The selected warehouse could not be found."
          );
        }
      }

      /*
       * -----------------------------------------------------
       * VALIDATE PRODUCTS
       * -----------------------------------------------------
       */

      const productIds =
        Array.from(
          new Set(
            items.map(
              (item) =>
                item.product_id
            )
          )
        );

      const {
        data: validProducts,
        error: validProductsError,
      } = await supabase
        .from("products")
        .select(
          "id,track_inventory,tracking_mode"
        )
        .eq(
          "company_id",
          companyId
        )
        .in(
          "id",
          productIds
        );

      if (validProductsError) {
        throw new Error(
          `Product validation failed: ${validProductsError.message}`
        );
      }

      if (
        (validProducts || [])
          .length !==
        productIds.length
      ) {
        throw new Error(
          "One or more selected products could not be found."
        );
      }

      /*
       * -----------------------------------------------------
       * VALIDATE VARIANTS
       * -----------------------------------------------------
       */

      const variantIds =
        Array.from(
          new Set(
            items
              .map(
                (item) =>
                  item.variant_id
              )
              .filter(Boolean) as string[]
          )
        );

      if (variantIds.length) {
        const {
          data: validVariants,
          error: validVariantsError,
        } = await supabase
          .from(
            "product_variants"
          )
          .select(
            "id,product_id"
          )
          .eq(
            "company_id",
            companyId
          )
          .in(
            "id",
            variantIds
          );

        if (
          validVariantsError
        ) {
          throw new Error(
            `Variant validation failed: ${validVariantsError.message}`
          );
        }

        if (
          (validVariants || [])
            .length !==
          variantIds.length
        ) {
          throw new Error(
            "One or more selected variants could not be found."
          );
        }
      }

      /*
       * -----------------------------------------------------
       * VALIDATE SERIALIZED UNITS
       * -----------------------------------------------------
       */

      const serializedIds =
        Array.from(
          new Set(
            items
              .map(
                (item) =>
                  item.serialized_unit_id
              )
              .filter(Boolean) as string[]
          )
        );

      if (serializedIds.length) {
        const {
          data: validSerializedUnits,
          error: serializedValidationError,
        } = await supabase
          .from(
            "serialized_units"
          )
          .select(
            "id,product_id,variant_id,status,warehouse_id"
          )
          .eq(
            "company_id",
            companyId
          )
          .in(
            "id",
            serializedIds
          );

        if (
          serializedValidationError
        ) {
          throw new Error(
            `Serial number validation failed: ${serializedValidationError.message}`
          );
        }

        if (
          (validSerializedUnits ||
            [])
            .length !==
          serializedIds.length
        ) {
          throw new Error(
            "One or more selected serial numbers could not be found."
          );
        }

        const invalidUnit =
          (
            validSerializedUnits ||
            []
          ).find(
            (unit) =>
              unit.status !==
                "in_stock" ||
              unit.warehouse_id !==
                selectedWarehouseId
          );

        if (invalidUnit) {
          throw new Error(
            "One or more selected serial numbers are no longer available in the selected warehouse."
          );
        }
      }

      /*
       * -----------------------------------------------------
       * GENERATE JOB NUMBER
       * -----------------------------------------------------
       */

      const {
        data: latestJob,
        error: latestJobError,
      } = await supabase
        .from("service_jobs")
        .select(
          "job_number"
        )
        .eq(
          "company_id",
          companyId
        )
        .like(
          "job_number",
          "SJ-%"
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1)
        .maybeSingle();

      if (latestJobError) {
        throw new Error(
          `Job number lookup failed: ${latestJobError.message}`
        );
      }

      let nextNumber = 1;

      if (
        latestJob?.job_number
      ) {
        const match =
          latestJob.job_number.match(
            /^SJ-(\d+)$/
          );

        if (match) {
          nextNumber =
            Number(
              match[1]
            ) + 1;
        }
      }

      let jobNumber =
        `SJ-${String(
          nextNumber
        ).padStart(5, "0")}`;

      /*
       * -----------------------------------------------------
       * CREATE JOB
       * -----------------------------------------------------
       *
       * IMPORTANT:
       *
       * Creating a service job DOES NOT deduct inventory.
       *
       * Inventory custody changes when the separate Dispatch
       * transaction is created.
       */

      const jobPayload = {
        company_id:
          companyId,
        job_number:
          jobNumber,
        provider_id:
          providerId,
        customer_id:
          customerId || null,
        source,
        service_type:
          serviceType.trim(),
        status:
          "open",
        priority,
        dispatched_date:
          dispatchedDate ||
          null,
        expected_return_date:
          expectedReturnDate ||
          null,
        completed_date:
          null,
        notes:
          notes.trim() ||
          null,
        internal_notes:
          internalNotes.trim() ||
          null,
        estimated_cost:
          estimatedTotal,
        actual_cost:
          0,
        created_by:
          user.id,
      };

      let job: {
        id: string;
        job_number: string;
      } | null = null;

      /*
       * First attempt.
       */

      const {
        data: createdJob,
        error: jobError,
      } = await supabase
        .from("service_jobs")
        .insert(
          jobPayload
        )
        .select(
          "id,job_number"
        )
        .single();

      if (
        jobError &&
        jobError.code ===
          "23505"
      ) {
        /*
         * Another request may have created the same
         * job number. Retry with a new number.
         */

        jobNumber =
          `SJ-${String(
            nextNumber + 1
          ).padStart(5, "0")}`;

        const {
          data: retryJob,
          error: retryError,
        } = await supabase
          .from(
            "service_jobs"
          )
          .insert({
            ...jobPayload,
            job_number:
              jobNumber,
          })
          .select(
            "id,job_number"
          )
          .single();

        if (retryError) {
          throw new Error(
            `Service job creation failed: ${retryError.message}`
          );
        }

        job = retryJob;
      } else if (jobError) {
        throw new Error(
          `Service job creation failed: ${jobError.message}`
        );
      } else {
        job = createdJob;
      }

      if (!job) {
        throw new Error(
          "The service job could not be created."
        );
      }

      /*
       * -----------------------------------------------------
       * CREATE JOB ITEMS
       * -----------------------------------------------------
       */

      const itemRows =
        items.map(
          (item) => ({
            company_id:
              companyId,
            service_job_id:
              job!.id,
            product_id:
              item.product_id,
            variant_id:
              item.variant_id,
            serialized_unit_id:
              item.serialized_unit_id,
            quantity:
              item.quantity,
            quantity_completed:
              0,
            quantity_failed:
              0,
            quantity_damaged:
              0,
            service_description:
              item.service_description ||
              null,
            unit_service_cost:
              item.unit_service_cost,
            notes:
              item.notes ||
              null,
          })
        );

      const {
        error: itemsError,
      } = await supabase
        .from(
          "service_job_items"
        )
        .insert(
          itemRows
        );

      if (itemsError) {
        /*
         * Roll back the parent job if the items could not
         * be created.
         */

        await supabase
          .from("service_jobs")
          .delete()
          .eq(
            "id",
            job.id
          )
          .eq(
            "company_id",
            companyId
          );

        throw new Error(
          `Service job items could not be created: ${itemsError.message}`
        );
      }

      /*
       * -----------------------------------------------------
       * ACTIVITY LOG
       * -----------------------------------------------------
       */

      const {
        error: activityError,
      } = await supabase
        .from(
          "service_provider_activity"
        )
        .insert({
          company_id:
            companyId,
          provider_id:
            providerId,
          service_job_id:
            job.id,
          action:
            "job_created",
          message:
            `Service job ${job.job_number} created.`,
          created_by:
            user.id,
        });

      /*
       * Activity failure should NOT make us delete an
       * otherwise valid service job.
       */

      if (activityError) {
        console.warn(
          "SERVICE JOB ACTIVITY ERROR:",
          activityError
        );
      }

      /*
       * -----------------------------------------------------
       * DONE
       * -----------------------------------------------------
       */

      router.push(
        `/service-jobs/${job.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        "CREATE SERVICE JOB ERROR:",
        error
      );

      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to create service job."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <AppShell>
        <div className="page-content">
          <div className="loading-state">
            <div className="loading-spinner" />

            <p>
              Loading service job form...
            </p>
          </div>
        </div>

        <style jsx>{`
          .page-content {
            padding: 28px;
          }

          .loading-state {
            min-height: 500px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 12px;
            color: #6b7280;
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

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </AppShell>
    );
  }

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */

  return (
    <AppShell>
      <div className="page-content">
        {/* HEADER */}

        <div className="page-header">
          <div>
            <Link
              href="/service-jobs"
              className="back-link"
            >
              ← Service Jobs
            </Link>

            <h1>
              New Service Job
            </h1>

            <p className="page-description">
              Assign company-owned stock to an
              external service provider and
              define the work to be completed.
            </p>
          </div>
        </div>

        {/* ERROR */}

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

        <form
          onSubmit={
            handleSubmit
          }
          className="service-job-form"
        >
          {/* =====================================================
              JOB DETAILS
          ====================================================== */}

          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Job Details
                </h2>

                <p>
                  Define the provider, work
                  type and job priority.
                </p>
              </div>
            </div>

            <div className="form-content">
              <div className="form-grid">
                {/* PROVIDER */}

                <div className="form-field">
                  <label htmlFor="provider">
                    Service Provider
                    <span className="required">
                      *
                    </span>
                  </label>

                  <select
                    id="provider"
                    value={
                      providerId
                    }
                    onChange={(
                      event
                    ) =>
                      setProviderId(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                    required
                  >
                    <option value="">
                      Select provider
                    </option>

                    {providers.map(
                      (
                        provider
                      ) => (
                        <option
                          key={
                            provider.id
                          }
                          value={
                            provider.id
                          }
                        >
                          {
                            provider.name
                          }

                          {provider.company_name
                            ? ` — ${provider.company_name}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>

                  {providers.length ===
                    0 && (
                    <span className="field-help field-error">
                      No active service
                      providers were found.
                      <Link href="/service-providers/new">
                        Add a provider
                      </Link>
                    </span>
                  )}
                </div>

                {/* SERVICE TYPE */}

                <div className="form-field">
                  <label htmlFor="serviceType">
                    Service Type
                    <span className="required">
                      *
                    </span>
                  </label>

                  <input
                    id="serviceType"
                    type="text"
                    value={
                      serviceType
                    }
                    onChange={(
                      event
                    ) =>
                      setServiceType(
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. Repair, Refurbishment, Cleaning"
                    required
                    disabled={
                      saving
                    }
                  />

                  <span className="field-help">
                    The actual work type
                    belongs to the job.
                  </span>
                </div>

                {/* SOURCE */}

                <div className="form-field">
                  <label htmlFor="source">
                    Source
                  </label>

                  <select
                    id="source"
                    value={
                      source
                    }
                    onChange={(
                      event
                    ) =>
                      setSource(
                        event.target
                          .value as SourceType
                      )
                    }
                    disabled={
                      saving
                    }
                  >
                    <option value="internal">
                      Internal
                    </option>

                    <option value="repair">
                      Repair
                    </option>

                    <option value="warranty">
                      Warranty
                    </option>

                    <option value="rma">
                      RMA
                    </option>

                    <option value="purchase">
                      Purchase
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </div>

                {/* CUSTOMER */}

                <div className="form-field">
                  <label htmlFor="customer">
                    Customer
                  </label>

                  <select
                    id="customer"
                    value={
                      customerId
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomerId(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  >
                    <option value="">
                      Internal / No Customer
                    </option>

                    {customers.map(
                      (
                        customer
                      ) => (
                        <option
                          key={
                            customer.id
                          }
                          value={
                            customer.id
                          }
                        >
                          {
                            customer.name
                          }
                        </option>
                      )
                    )}
                  </select>

                  <span className="field-help">
                    Optional.
                  </span>
                </div>

                {/* PRIORITY */}

                <div className="form-field">
                  <label htmlFor="priority">
                    Priority
                  </label>

                  <select
                    id="priority"
                    value={
                      priority
                    }
                    onChange={(
                      event
                    ) =>
                      setPriority(
                        event.target
                          .value as PriorityType
                      )
                    }
                    disabled={
                      saving
                    }
                  >
                    <option value="low">
                      Low
                    </option>

                    <option value="normal">
                      Normal
                    </option>

                    <option value="high">
                      High
                    </option>

                    <option value="urgent">
                      Urgent
                    </option>
                  </select>
                </div>

                {/* DISPATCH DATE */}

                <div className="form-field">
                  <label htmlFor="dispatchedDate">
                    Dispatch Date
                  </label>

                  <input
                    id="dispatchedDate"
                    type="date"
                    value={
                      dispatchedDate
                    }
                    onChange={(
                      event
                    ) =>
                      setDispatchedDate(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  />

                  <span className="field-help">
                    This does not move
                    inventory. Actual stock
                    custody changes during
                    Dispatch.
                  </span>
                </div>

                {/* EXPECTED RETURN */}

                <div className="form-field">
                  <label htmlFor="expectedReturnDate">
                    Expected Return
                  </label>

                  <input
                    id="expectedReturnDate"
                    type="date"
                    value={
                      expectedReturnDate
                    }
                    min={
                      dispatchedDate ||
                      undefined
                    }
                    onChange={(
                      event
                    ) =>
                      setExpectedReturnDate(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              SERVICE ITEMS
          ====================================================== */}

          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Service Items
                </h2>

                <p>
                  Select company-owned stock
                  that will be assigned to this
                  service job.
                </p>
              </div>

              <div className="header-total">
                {totalQuantity}{" "}
                {totalQuantity ===
                1
                  ? "unit"
                  : "units"}
              </div>
            </div>

            <div className="item-builder">
              <div className="item-builder-header">
                <h3>
                  Add Stock
                </h3>

                <span>
                  Availability is checked before
                  adding an item.
                </span>
              </div>

              <div className="form-grid">
                {/* WAREHOUSE */}

                <div className="form-field">
                  <label htmlFor="warehouse">
                    Warehouse
                    <span className="required">
                      *
                    </span>
                  </label>

                  <select
                    id="warehouse"
                    value={
                      selectedWarehouseId
                    }
                    onChange={(
                      event
                    ) => {
                      setSelectedWarehouseId(
                        event.target
                          .value
                      );

                      setSelectedSerializedUnitId(
                        ""
                      );
                    }}
                    disabled={
                      saving
                    }
                    required
                  >
                    <option value="">
                      Select warehouse
                    </option>

                    {warehouses.map(
                      (
                        warehouse
                      ) => (
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
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* PRODUCT */}

                <div className="form-field">
                  <label htmlFor="product">
                    Product
                    <span className="required">
                      *
                    </span>
                  </label>

                  <select
                    id="product"
                    value={
                      selectedProductId
                    }
                    onChange={(
                      event
                    ) =>
                      handleProductChange(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  >
                    <option value="">
                      Select product
                    </option>

                    {products
                      .filter(
                        (
                          product
                        ) =>
                          product.track_inventory !==
                            false
                      )
                      .map(
                        (
                          product
                        ) => (
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
                    <span className="field-help">
                      Tracking mode:{" "}
                      <strong>
                        {selectedProduct.tracking_mode ||
                          "quantity"}
                      </strong>
                    </span>
                  )}
                </div>

                {/* VARIANT */}

                {productVariants.length >
                  0 && (
                  <div className="form-field">
                    <label htmlFor="variant">
                      Variant
                    </label>

                    <select
                      id="variant"
                      value={
                        selectedVariantId
                      }
                      onChange={(
                        event
                      ) =>
                        handleVariantChange(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                    >
                      <option value="">
                        Select variant
                      </option>

                      {productVariants.map(
                        (
                          variant
                        ) => (
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
                )}

                {/* SERIAL OR QUANTITY */}

                {productTracksSerials ? (
                  <div className="form-field">
                    <label htmlFor="serial">
                      Serial Number
                      <span className="required">
                        *
                      </span>
                    </label>

                    <select
                      id="serial"
                      value={
                        selectedSerializedUnitId
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedSerializedUnitId(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving ||
                        !selectedProductId ||
                        !selectedWarehouseId
                      }
                    >
                      <option value="">
                        Select serial number
                      </option>

                      {availableSerializedUnits.map(
                        (
                          unit
                        ) => (
                          <option
                            key={
                              unit.id
                            }
                            value={
                              unit.id
                            }
                          >
                            {
                              unit.serial_number
                            }
                          </option>
                        )
                      )}
                    </select>

                    <span className="field-help">
                      {
                        availableSerializedUnits.length
                      }{" "}
                      serialized unit
                      {availableSerializedUnits.length ===
                      1
                        ? ""
                        : "s"}{" "}
                      available.
                    </span>
                  </div>
                ) : (
                  <div className="form-field">
                    <label htmlFor="quantity">
                      Quantity
                      <span className="required">
                        *
                      </span>
                    </label>

                    <input
                      id="quantity"
                      type="number"
                      min="1"
                      step="1"
                      value={
                        selectedQuantity
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedQuantity(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        saving
                      }
                    />

                    <span className="field-help">
                      Available:{" "}
                      {
                        availableQuantity
                      }
                    </span>
                  </div>
                )}

                {/* SERVICE COST */}

                <div className="form-field">
                  <label htmlFor="unitCost">
                    Service Cost / Unit
                  </label>

                  <div className="input-with-suffix">
                    <input
                      id="unitCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        selectedUnitCost
                      }
                      onChange={(
                        event
                      ) =>
                        setSelectedUnitCost(
                          event.target
                            .value
                        )
                      }
                      placeholder="0.00"
                      disabled={
                        saving
                      }
                    />

                    <span>
                      AED
                    </span>
                  </div>
                </div>

                {/* WORK DESCRIPTION */}

                <div className="form-field full-width">
                  <label htmlFor="serviceDescription">
                    Work Description
                  </label>

                  <input
                    id="serviceDescription"
                    type="text"
                    value={
                      selectedDescription
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedDescription(
                        event.target
                          .value
                      )
                    }
                    placeholder="Describe the work required for this item"
                    disabled={
                      saving
                    }
                  />
                </div>

                {/* ITEM NOTES */}

                <div className="form-field full-width">
                  <label htmlFor="itemNotes">
                    Item Notes
                  </label>

                  <textarea
                    id="itemNotes"
                    value={
                      selectedItemNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedItemNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Condition, instructions, special requirements..."
                    rows={3}
                    disabled={
                      saving
                    }
                  />
                </div>
              </div>

              <div className="item-builder-footer">
                <div className="availability">
                  {selectedProductId ? (
                    <>
                      <span className="availability-dot" />

                      {productTracksSerials
                        ? `${availableSerializedUnits.length} serialized units available`
                        : `${availableQuantity} units available`}
                    </>
                  ) : (
                    "Select a product to check availability"
                  )}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    addItem
                  }
                  disabled={
                    saving
                  }
                >
                  + Add Item
                </button>
              </div>
            </div>

            {/* ITEM LIST */}

            {items.length ===
            0 ? (
              <div className="items-empty">
                <div className="empty-icon">
                  IT
                </div>

                <div>
                  <strong>
                    No stock items added
                  </strong>

                  <p>
                    Add the products or
                    serialized units that
                    will be sent to the
                    provider.
                  </p>
                </div>
              </div>
            ) : (
              <div className="items-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Product
                      </th>

                      <th>
                        Serial
                      </th>

                      <th>
                        Quantity
                      </th>

                      <th>
                        Work
                      </th>

                      <th>
                        Service Cost
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {items.map(
                      (
                        item
                      ) => {
                        const variantName =
                          getVariantName(
                            item.variant_id
                          );

                        const variantSku =
                          getProductVariantSku(
                            item.product_id,
                            item.variant_id
                          );

                        const serialNumber =
                          getSerialNumber(
                            item.serialized_unit_id
                          );

                        const lineTotal =
                          Number(
                            item.quantity ||
                              0
                          ) *
                          Number(
                            item.unit_service_cost ||
                              0
                          );

                        return (
                          <tr
                            key={
                              item.id
                            }
                          >
                            <td>
                              <div className="table-primary">
                                {getProductName(
                                  item.product_id
                                )}
                              </div>

                              {(variantName ||
                                variantSku) && (
                                <div className="table-secondary">
                                  {variantName ||
                                    variantSku}
                                </div>
                              )}
                            </td>

                            <td>
                              {serialNumber ||
                                "—"}
                            </td>

                            <td>
                              <strong>
                                {
                                  item.quantity
                                }
                              </strong>
                            </td>

                            <td>
                              <div className="table-primary">
                                {item.service_description ||
                                  "—"}
                              </div>

                              {item.notes && (
                                <div className="table-secondary">
                                  {
                                    item.notes
                                  }
                                </div>
                              )}
                            </td>

                            <td>
                              <div className="table-primary">
                                {formatMoney(
                                  lineTotal
                                )}
                              </div>

                              <div className="table-secondary">
                                {formatMoney(
                                  item.unit_service_cost
                                )}{" "}
                                / unit
                              </div>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="remove-button"
                                onClick={() =>
                                  removeItem(
                                    item.id
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {items.length >
              0 && (
              <div className="items-summary">
                <span>
                  Estimated Service Cost
                </span>

                <strong>
                  {formatMoney(
                    estimatedTotal
                  )}
                </strong>
              </div>
            )}
          </div>

          {/* =====================================================
              NOTES
          ====================================================== */}

          <div className="content-card">
            <div className="content-card-header">
              <div>
                <h2>
                  Job Notes
                </h2>

                <p>
                  Add information for the
                  provider and internal team.
                </p>
              </div>
            </div>

            <div className="form-content">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="notes">
                    Provider Notes
                  </label>

                  <textarea
                    id="notes"
                    value={
                      notes
                    }
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Instructions or information for the service provider"
                    rows={5}
                    disabled={
                      saving
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="internalNotes">
                    Internal Notes
                  </label>

                  <textarea
                    id="internalNotes"
                    value={
                      internalNotes
                    }
                    onChange={(
                      event
                    ) =>
                      setInternalNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Internal information not intended for the provider"
                    rows={5}
                    disabled={
                      saving
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================
              SUMMARY
          ====================================================== */}

          <div className="summary-card">
            <div>
              <span className="summary-label">
                Service Provider
              </span>

              <strong>
                {providers.find(
                  (
                    provider
                  ) =>
                    provider.id ===
                    providerId
                )?.name ||
                  "Not selected"}
              </strong>
            </div>

            <div>
              <span className="summary-label">
                Stock Items
              </span>

              <strong>
                {totalQuantity}
              </strong>
            </div>

            <div>
              <span className="summary-label">
                Estimated Cost
              </span>

              <strong>
                {formatMoney(
                  estimatedTotal
                )}
              </strong>
            </div>

            <div className="summary-actions">
              <Link
                href="/service-jobs"
                className="secondary-button"
              >
                Cancel
              </Link>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  saving ||
                  !providerId ||
                  !serviceType.trim() ||
                  items.length ===
                    0
                }
              >
                {saving
                  ? "Creating Job..."
                  : "Create Service Job"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 24px;
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

        h1 {
          margin: 0;
          color: #111827;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 700;
        }

        .page-description {
          max-width: 760px;
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
        }

        .service-job-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .content-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px
            rgba(0, 0, 0, 0.03);
          overflow: hidden;
        }

        .content-card-header {
          min-height: 70px;
          padding: 18px 20px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .content-card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .content-card-header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .form-content {
          padding: 22px 20px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(
            2,
            minmax(0, 1fr)
          );
          gap: 20px;
        }

        .form-field {
          min-width: 0;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .form-field label {
          display: block;
          margin-bottom: 7px;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
        }

        .required {
          margin-left: 3px;
          color: #dc2626;
        }

        .form-field input,
        .form-field select,
        .form-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #111827;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .form-field input,
        .form-field select {
          height: 42px;
          padding: 0 12px;
        }

        .form-field textarea {
          min-height: 100px;
          padding: 11px 12px;
          resize: vertical;
          line-height: 1.5;
        }

        .form-field input:focus,
        .form-field select:focus,
        .form-field textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px
            rgba(17, 24, 39, 0.05);
        }

        .form-field input:disabled,
        .form-field select:disabled,
        .form-field textarea:disabled {
          background: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .field-help {
          display: block;
          margin-top: 6px;
          color: #9ca3af;
          font-size: 11px;
          line-height: 1.4;
        }

        .field-help a {
          margin-left: 5px;
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
        }

        .field-error {
          color: #b91c1c;
        }

        .input-with-suffix {
          position: relative;
        }

        .input-with-suffix input {
          padding-right: 58px;
        }

        .input-with-suffix span {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          pointer-events: none;
        }

        .item-builder {
          padding: 20px;
          background: #fafafa;
          border-bottom: 1px solid #e5e7eb;
        }

        .item-builder-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .item-builder-header h3 {
          margin: 0;
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .item-builder-header span {
          color: #9ca3af;
          font-size: 11px;
        }

        .item-builder-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 18px;
        }

        .availability {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #6b7280;
          font-size: 11px;
        }

        .availability-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #22c55e;
        }

        .header-total {
          color: #374151;
          font-size: 12px;
          font-weight: 700;
        }

        .secondary-button,
        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          box-sizing: border-box;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: white;
        }

        .primary-button:hover {
          background: #1f2937;
        }

        .primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: white;
          color: #374151;
        }

        .secondary-button:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .items-empty {
          min-height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 24px;
          color: #6b7280;
        }

        .empty-icon {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 10px;
          font-weight: 800;
        }

        .items-empty strong {
          display: block;
          color: #374151;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .items-empty p {
          margin: 0;
          color: #9ca3af;
          font-size: 11px;
        }

        .items-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
        }

        th {
          padding: 12px 20px;
          text-align: left;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }

        td {
          padding: 14px 20px;
          border-bottom: 1px solid #f0f1f3;
          color: #374151;
          font-size: 13px;
          vertical-align: middle;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        tbody tr:hover {
          background: #fafafa;
        }

        .table-primary {
          color: #111827;
          font-weight: 600;
        }

        .table-secondary {
          margin-top: 3px;
          color: #9ca3af;
          font-size: 10px;
        }

        .remove-button {
          border: none;
          background: transparent;
          color: #dc2626;
          font-family: inherit;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }

        .remove-button:hover {
          text-decoration: underline;
        }

        .remove-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .items-summary {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 20px;
          padding: 16px 20px;
          background: #fafafa;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }

        .items-summary strong {
          color: #111827;
          font-size: 15px;
        }

        .summary-card {
          display: grid;
          grid-template-columns: 1fr 140px 180px auto;
          align-items: center;
          gap: 20px;
          padding: 18px 20px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          box-shadow: 0 1px 2px
            rgba(0, 0, 0, 0.03);
          margin-bottom: 20px;
        }

        .summary-label {
          display: block;
          margin-bottom: 4px;
          color: #9ca3af;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .summary-card strong {
          color: #111827;
          font-size: 14px;
        }

        .summary-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .alert {
          display: flex;
          flex-direction: column;
          gap: 3px;
          padding: 12px 14px;
          margin-bottom: 18px;
          border-radius: 9px;
          font-size: 13px;
          line-height: 1.4;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .loading-state {
          min-height: 420px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
          color: #6b7280;
          font-size: 13px;
        }

        .loading-spinner {
          width: 26px;
          height: 26px;
          border: 3px solid #e5e7eb;
          border-top-color: #111827;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1100px) {
          .summary-card {
            grid-template-columns: 1fr 1fr;
          }

          .summary-actions {
            grid-column: 1 / -1;
            justify-content: flex-end;
          }
        }

        @media (max-width: 800px) {
          .page-content {
            padding: 18px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .item-builder-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .item-builder-footer {
            align-items: flex-start;
            flex-direction: column;
          }

          .item-builder-footer .secondary-button {
            width: 100%;
          }

          .summary-card {
            grid-template-columns: 1fr;
          }

          .summary-actions {
            grid-column: auto;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .summary-actions a,
          .summary-actions button {
            width: 100%;
          }
        }

        @media (max-width: 500px) {
          .summary-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppShell>
    );
}

function ServiceJobPageLoading() {
  return (
    <AppShell>
      <div className="page-content">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading service job form...</p>
        </div>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .loading-state {
          min-height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
          color: #6b7280;
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

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </AppShell>
  );
}

export default function NewServiceJobPage() {
  return (
    <Suspense fallback={<ServiceJobPageLoading />}>
      <NewServiceJobPageContent />
    </Suspense>
  );
}