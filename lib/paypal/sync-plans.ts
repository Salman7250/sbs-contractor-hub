import "server-only";

import { createClient } from "@/lib/supabase/server";

import {
  createPayPalProduct,
  createPayPalBillingPlan,
  getPayPalProduct,
  getPayPalBillingPlan,
  findMatchingPayPalBillingPlan,
  activatePayPalBillingPlan,
} from "./catalog";

type SBSPlan = {
  id: string;
  name: string;
  slug: string;

  monthly_price:
    | number
    | null;

  yearly_price:
    | number
    | null;

  is_active: boolean;

  paypal_product_id:
    | string
    | null;

  paypal_monthly_plan_id:
    | string
    | null;

  paypal_yearly_plan_id:
    | string
    | null;
};

type SyncSource =
  | "existing"
  | "reconciled"
  | "created";

function getPrice(
  value: number | null
): number {
  const price =
    Number(value ?? 0);

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    throw new Error(
      "SBS plan contains an invalid price."
    );
  }

  return price;
}

async function savePlanIds(
  planId: string,
  values: {
    paypal_product_id?: string;

    paypal_monthly_plan_id?:
      string;

    paypal_yearly_plan_id?:
      string;
  }
) {
  const supabase =
    await createClient();

  const {
    error,
  } = await supabase
    .from("plans")
    .update(values)
    .eq("id", planId);

  if (error) {
    throw new Error(
      error.message ||
        "Unable to save PayPal IDs to SBS."
    );
  }
}

async function verifyProduct(
  productId: string
) {
  try {
    return await getPayPalProduct(
      productId
    );
  } catch (error) {
    throw new Error(
      `The PayPal Product ${productId} could not be verified. ${
        error instanceof Error
          ? error.message
          : "Unknown PayPal error."
      }`
    );
  }
}

async function verifyBillingPlan(
  planId: string
) {
  try {
    return await getPayPalBillingPlan(
      planId
    );
  } catch (error) {
    throw new Error(
      `The PayPal Billing Plan ${planId} could not be verified. ${
        error instanceof Error
          ? error.message
          : "Unknown PayPal error."
      }`
    );
  }
}

async function ensurePayPalProduct(
  sbsPlan: SBSPlan
): Promise<{
  productId: string;
  source: SyncSource;
}> {
  if (
    sbsPlan.paypal_product_id
  ) {
    const product =
      await verifyProduct(
        sbsPlan.paypal_product_id
      );

    if (
      product.name !==
      `SBS ${sbsPlan.name}`
    ) {
      throw new Error(
        `Stored PayPal Product ${sbsPlan.paypal_product_id} belongs to "${product.name}", not "SBS ${sbsPlan.name}".`
      );
    }

    return {
      productId:
        sbsPlan.paypal_product_id,

      source: "existing",
    };
  }

  /*
   * Product ID is missing.
   *
   * Before creating a new Product,
   * we cannot safely query PayPal's
   * product catalog by arbitrary name
   * with the current helper layer.
   *
   * Therefore creation happens here,
   * and the ID is immediately persisted.
   *
   * Future production hardening can add
   * a dedicated product reconciliation
   * endpoint if needed.
   */
  const product =
    await createPayPalProduct({
      name:
        `SBS ${sbsPlan.name}`,

      description:
        `Sharif Business Solutions ${sbsPlan.name} subscription.`,
    });

  await savePlanIds(
    sbsPlan.id,
    {
      paypal_product_id:
        product.id,
    }
  );

  return {
    productId:
      product.id,

    source: "created",
  };
}

async function ensurePayPalPlan(
  sbsPlan: SBSPlan,
  input: {
    existingPlanId:
      | string
      | null;

    name: string;

    amount: number;

    billingInterval:
      | "MONTH"
      | "YEAR";
  }
): Promise<{
  planId: string;
  source: SyncSource;
}> {
  const productId =
    sbsPlan.paypal_product_id;

  if (!productId) {
    throw new Error(
      "PayPal Product ID is missing."
    );
  }

  /*
   * --------------------------------------------------------
   * 1. Existing ID in SBS
   * --------------------------------------------------------
   */

  if (input.existingPlanId) {
    const existing =
      await verifyBillingPlan(
        input.existingPlanId
      );

    if (
      existing.product_id !==
      productId
    ) {
      throw new Error(
        `Stored PayPal plan ${input.existingPlanId} belongs to Product ${existing.product_id}, not ${productId}.`
      );
    }

    /*
     * Verify the important commercial
     * properties as well.
     */

    const matching =
      findPlanConfigurationMatch(
        existing,
        {
          productId,

          name:
            input.name,

          amount:
            input.amount,

          currency:
            "USD",

          billingInterval:
            input.billingInterval,
        }
      );

    if (!matching) {
      throw new Error(
        `Stored PayPal plan ${input.existingPlanId} does not match the SBS ${input.billingInterval.toLowerCase()} configuration for ${sbsPlan.name}.`
      );
    }

    if (
      existing.status !==
      "ACTIVE"
    ) {
      await activatePayPalBillingPlan(
        input.existingPlanId
      );
    }

    return {
      planId:
        input.existingPlanId,

      source: "existing",
    };
  }

  /*
   * --------------------------------------------------------
   * 2. Reconcile against PayPal
   * --------------------------------------------------------
   */

  const matchingPlan =
    await findMatchingPayPalBillingPlan({
      productId,

      name:
        input.name,

      amount:
        input.amount,

      currency:
        "USD",

      billingInterval:
        input.billingInterval,
    });

  if (matchingPlan) {
    if (
      matchingPlan.status !==
      "ACTIVE"
    ) {
      await activatePayPalBillingPlan(
        matchingPlan.id
      );
    }

    return {
      planId:
        matchingPlan.id,

      source: "reconciled",
    };
  }

  /*
   * --------------------------------------------------------
   * 3. Nothing exists → create
   * --------------------------------------------------------
   */

  const created =
    await createPayPalBillingPlan({
      productId,

      name:
        input.name,

      description:
        `${sbsPlan.name} ${
          input.billingInterval ===
          "MONTH"
            ? "monthly"
            : "yearly"
        } subscription for Sharif Business Solutions.`,

      amount:
        input.amount,

      currency:
        "USD",

      billingInterval:
        input.billingInterval,
    });

  if (
    created.status !==
    "ACTIVE"
  ) {
    await activatePayPalBillingPlan(
      created.id
    );
  }

  return {
    planId:
      created.id,

    source: "created",
  };
}

function findPlanConfigurationMatch(
  plan: Awaited<
    ReturnType<
      typeof getPayPalBillingPlan
    >
  >,
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
    plan.billing_cycles?.find(
      (item) =>
        item.tenure_type ===
        "REGULAR"
    ) ??
    plan.billing_cycles?.[0];

  if (!cycle) {
    return false;
  }

  if (
    cycle.frequency
      ?.interval_unit !==
    input.billingInterval
  ) {
    return false;
  }

  if (
    Number(
      cycle.frequency
        ?.interval_count ?? 0
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
    Number(
      fixedPrice.value
    ) ===
    Number(input.amount)
  );
}

export async function syncSBSPlanToPayPal(
  planId: string
) {
  const supabase =
    await createClient();

  const {
    data: plan,
    error: planError,
  } = await supabase
    .from("plans")
    .select(
      `
        id,
        name,
        slug,
        monthly_price,
        yearly_price,
        is_active,
        paypal_product_id,
        paypal_monthly_plan_id,
        paypal_yearly_plan_id
      `
    )
    .eq("id", planId)
    .maybeSingle();

  if (planError) {
    throw new Error(
      planError.message ||
        "Unable to load SBS plan."
    );
  }

  if (!plan) {
    throw new Error(
      "SBS plan was not found."
    );
  }

  if (!plan.is_active) {
    throw new Error(
      "Cannot sync an inactive SBS plan."
    );
  }

  const sbsPlan =
    plan as SBSPlan;

  /*
   * --------------------------------------------------------
   * PRODUCT
   * --------------------------------------------------------
   */

  const productResult =
    await ensurePayPalProduct(
      sbsPlan
    );

  const productId =
    productResult.productId;

  /*
   * Make sure the local object has
   * the Product ID for subsequent
   * reconciliation.
   */

  sbsPlan.paypal_product_id =
    productId;

  /*
   * --------------------------------------------------------
   * MONTHLY
   * --------------------------------------------------------
   */

  const monthlyResult =
    await ensurePayPalPlan(
      sbsPlan,
      {
        existingPlanId:
          sbsPlan.paypal_monthly_plan_id,

        name:
          `SBS ${sbsPlan.name} Monthly`,

        amount:
          getPrice(
            sbsPlan.monthly_price
          ),

        billingInterval:
          "MONTH",
      }
    );

  if (
    monthlyResult.source !==
      "existing" ||
    sbsPlan.paypal_monthly_plan_id !==
      monthlyResult.planId
  ) {
    await savePlanIds(
      sbsPlan.id,
      {
        paypal_monthly_plan_id:
          monthlyResult.planId,
      }
    );
  }

  /*
   * --------------------------------------------------------
   * YEARLY
   * --------------------------------------------------------
   */

  const yearlyResult =
    await ensurePayPalPlan(
      sbsPlan,
      {
        existingPlanId:
          sbsPlan.paypal_yearly_plan_id,

        name:
          `SBS ${sbsPlan.name} Yearly`,

        amount:
          getPrice(
            sbsPlan.yearly_price
          ),

        billingInterval:
          "YEAR",
      }
    );

  if (
    yearlyResult.source !==
      "existing" ||
    sbsPlan.paypal_yearly_plan_id !==
      yearlyResult.planId
  ) {
    await savePlanIds(
      sbsPlan.id,
      {
        paypal_yearly_plan_id:
          yearlyResult.planId,
      }
    );
  }

  return {
    success: true,

    plan: {
      id:
        sbsPlan.id,

      name:
        sbsPlan.name,

      slug:
        sbsPlan.slug,
    },

    paypal: {
      productId,

      monthlyPlanId:
        monthlyResult.planId,

      yearlyPlanId:
        yearlyResult.planId,
    },

    sync: {
      product:
        productResult.source,

      monthly:
        monthlyResult.source,

      yearly:
        yearlyResult.source,
    },
  };
}