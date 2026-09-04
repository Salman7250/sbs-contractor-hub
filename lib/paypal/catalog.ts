import "server-only";

import { paypalRequest } from "./client";

export type PayPalProduct = {
  id: string;
  name: string;
  description?: string;
  type?: string;
  category?: string;
  create_time?: string;
  update_time?: string;
};

export type PayPalBillingPlan = {
  id: string;
  product_id: string;
  name: string;
  description?: string;
  status?: "CREATED" | "INACTIVE" | "ACTIVE";
  create_time?: string;
  update_time?: string;

  billing_cycles?: Array<{
    frequency?: {
      interval_unit?: "DAY" | "WEEK" | "MONTH" | "YEAR";
      interval_count?: number;
    };

    tenure_type?: "TRIAL" | "REGULAR";

    sequence?: number;

    total_cycles?: number;

    pricing_scheme?: {
      fixed_price?: {
        value?: string;
        currency_code?: string;
      };
    };
  }>;
};

type PayPalPlanListResponse = {
  plans?: PayPalBillingPlan[];
  total_items?: number;
  total_pages?: number;
};

type CreateProductInput = {
  name: string;
  description: string;
};

type CreateBillingPlanInput = {
  productId: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  billingInterval: "MONTH" | "YEAR";
};

function generateRequestId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function createPayPalProduct(
  input: CreateProductInput
): Promise<PayPalProduct> {
  return paypalRequest<PayPalProduct>(
    "/v1/catalogs/products",
    {
      method: "POST",

      headers: {
        "PayPal-Request-Id":
          generateRequestId("sbs-product"),

        Prefer:
          "return=representation",
      },

      body: {
        name: input.name,

        description:
          input.description,

        type: "SERVICE",

        category: "SOFTWARE",
      },
    }
  );
}

export async function getPayPalProduct(
  productId: string
): Promise<PayPalProduct> {
  if (!productId) {
    throw new Error(
      "PayPal Product ID is required."
    );
  }

  return paypalRequest<PayPalProduct>(
    `/v1/catalogs/products/${encodeURIComponent(
      productId
    )}`
  );
}

export async function createPayPalBillingPlan(
  input: CreateBillingPlanInput
): Promise<PayPalBillingPlan> {
  if (
    !Number.isFinite(input.amount) ||
    input.amount < 0
  ) {
    throw new Error(
      "PayPal billing plan amount must be a valid non-negative number."
    );
  }

  const currency =
    input.currency.toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error(
      "PayPal billing plan currency must be a 3-letter currency code."
    );
  }

  return paypalRequest<PayPalBillingPlan>(
    "/v1/billing/plans",
    {
      method: "POST",

      headers: {
        "PayPal-Request-Id":
          generateRequestId("sbs-plan"),

        Prefer:
          "return=representation",
      },

      body: {
        product_id:
          input.productId,

        name:
          input.name,

        description:
          input.description,

        billing_cycles: [
          {
            frequency: {
              interval_unit:
                input.billingInterval,

              interval_count: 1,
            },

            tenure_type:
              "REGULAR",

            sequence: 1,

            total_cycles: 0,

            pricing_scheme: {
              fixed_price: {
                value:
                  input.amount.toFixed(2),

                currency_code:
                  currency,
              },
            },
          },
        ],

        payment_preferences: {
          auto_bill_outstanding:
            true,

          payment_failure_threshold:
            1,
        },
      },
    }
  );
}

export async function getPayPalBillingPlan(
  planId: string
): Promise<PayPalBillingPlan> {
  if (!planId) {
    throw new Error(
      "PayPal billing plan ID is required."
    );
  }

  return paypalRequest<PayPalBillingPlan>(
    `/v1/billing/plans/${encodeURIComponent(
      planId
    )}`
  );
}

export async function listPayPalBillingPlans(
  productId: string
): Promise<PayPalBillingPlan[]> {
  if (!productId) {
    throw new Error(
      "PayPal Product ID is required."
    );
  }

  const result =
    await paypalRequest<PayPalPlanListResponse>(
      `/v1/billing/plans?product_id=${encodeURIComponent(
        productId
      )}&page_size=20`
    );

  return result.plans ?? [];
}

function getRegularBillingCycle(
  plan: PayPalBillingPlan
) {
  return (
    plan.billing_cycles?.find(
      (cycle) =>
        cycle.tenure_type ===
        "REGULAR"
    ) ??
    plan.billing_cycles?.[0]
  );
}

export function matchesPayPalBillingPlan(
  plan: PayPalBillingPlan,
  input: {
    productId: string;
    name: string;
    amount: number;
    currency: string;
    billingInterval:
      | "MONTH"
      | "YEAR";
  }
) {
  if (
    plan.product_id !==
    input.productId
  ) {
    return false;
  }

  if (
    plan.name.trim() !==
    input.name.trim()
  ) {
    return false;
  }

  const cycle =
    getRegularBillingCycle(plan);

  if (!cycle) {
    return false;
  }

  if (
    cycle.frequency?.interval_unit !==
    input.billingInterval
  ) {
    return false;
  }

  if (
    Number(
      cycle.frequency?.interval_count ??
        0
    ) !== 1
  ) {
    return false;
  }

  const fixedPrice =
    cycle.pricing_scheme
      ?.fixed_price;

  if (!fixedPrice) {
    return false;
  }

  if (
    fixedPrice.currency_code
      ?.toUpperCase() !==
    input.currency.toUpperCase()
  ) {
    return false;
  }

  return (
    Number(fixedPrice.value) ===
    Number(input.amount)
  );
}

export async function findMatchingPayPalBillingPlan(
  input: {
    productId: string;
    name: string;
    amount: number;
    currency: string;
    billingInterval:
      | "MONTH"
      | "YEAR";
  }
): Promise<PayPalBillingPlan | null> {
  const plans =
    await listPayPalBillingPlans(
      input.productId
    );

  const matches =
    plans.filter((plan) =>
      matchesPayPalBillingPlan(
        plan,
        input
      )
    );

  if (matches.length === 0) {
    return null;
  }

  /*
   * If duplicates exist, use the
   * oldest matching plan. This is
   * deterministic and prevents
   * switching between duplicates.
   */
  matches.sort((a, b) => {
    const aTime =
      a.create_time
        ? new Date(
            a.create_time
          ).getTime()
        : Number.MAX_SAFE_INTEGER;

    const bTime =
      b.create_time
        ? new Date(
            b.create_time
          ).getTime()
        : Number.MAX_SAFE_INTEGER;

    return aTime - bTime;
  });

  return matches[0];
}

export async function activatePayPalBillingPlan(
  planId: string
) {
  const currentPlan =
    await getPayPalBillingPlan(
      planId
    );

  if (
    currentPlan.status ===
    "ACTIVE"
  ) {
    return {
      activated: false,

      alreadyActive: true,

      status:
        "ACTIVE" as const,
    };
  }

  if (
    currentPlan.status !==
      "CREATED" &&
    currentPlan.status !==
      "INACTIVE"
  ) {
    throw new Error(
      `Cannot activate PayPal plan ${planId}. Current status: ${
        currentPlan.status ??
        "UNKNOWN"
      }.`
    );
  }

  await paypalRequest<void>(
    `/v1/billing/plans/${encodeURIComponent(
      planId
    )}/activate`,
    {
      method: "POST",

      headers: {
        "PayPal-Request-Id":
          generateRequestId(
            "sbs-activate"
          ),
      },
    }
  );

  return {
    activated: true,

    alreadyActive: false,

    status:
      "ACTIVE" as const,
  };
}