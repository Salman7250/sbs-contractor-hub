"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

type CreateCompanyInput = {
  companyName: string;
  ownerName: string;
  ownerEmail: string;

  slug: string;

  email: string;
  phone: string;
  website: string;

  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;

  timezone: string;
  currency: string;

  taxRegistrationNumber: string;
  tradeLicenseNumber: string;
  legalRegistrationType: string;
  authorityName: string;

  // SBS currently supports product businesses only.
  businessType: "product";

  planId: string;
  billingCycle: "monthly" | "yearly";

  trialEnabled: boolean;
  trialDays: number;

  discountEnabled: boolean;
  discountName: string;
  discountCode: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountDuration:
    | "one_month"
    | "three_months"
    | "six_months"
    | "twelve_months"
    | "lifetime"
    | "custom";
  discountBillingCycle: "monthly" | "yearly" | "both";
  discountExpiresAt: string;
  discountReason: string;
};

type CreateCompanyResult =
  | {
      success: true;
      companyId: string;
      ownerUserId: string;
      subscriptionId: string;
    }
  | {
      success: false;
      error: string;
    };

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase();
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getDiscountExpiry(
  duration:
    | "one_month"
    | "three_months"
    | "six_months"
    | "twelve_months"
    | "lifetime"
    | "custom",
  customExpiry: string,
  startedAt: Date,
) {
  switch (duration) {
    case "one_month":
      return addMonths(startedAt, 1);

    case "three_months":
      return addMonths(startedAt, 3);

    case "six_months":
      return addMonths(startedAt, 6);

    case "twelve_months":
      return addMonths(startedAt, 12);

    case "custom":
      return customExpiry
        ? new Date(`${customExpiry}T23:59:59.999Z`)
        : null;

    case "lifetime":
    default:
      return null;
  }
}

export async function createCompany(
  input: CreateCompanyInput,
): Promise<CreateCompanyResult> {
  let companyId: string | null = null;
  let ownerUserId: string | null = null;
  let subscriptionId: string | null = null;

  try {
    // ------------------------------------------------------------
    // PLATFORM ADMIN
    // ------------------------------------------------------------

    const platformAdmin = await requirePlatformAdmin();

    if (!platformAdmin?.user?.id) {
      throw new Error(
        "Platform administrator session is invalid.",
      );
    }

    const supabase = await createClient();

    // ------------------------------------------------------------
    // SUPABASE SERVER CONFIG
    // ------------------------------------------------------------

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase server configuration is missing SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    const adminClient = createAdminClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // ------------------------------------------------------------
    // NORMALIZE INPUT
    // ------------------------------------------------------------

    const companyName =
      input.companyName.trim();

    const ownerName =
      input.ownerName.trim();

    const ownerEmail =
      input.ownerEmail.trim().toLowerCase();

    const slug = normalizeSlug(
      input.slug.trim() || companyName,
    );

    /*
     * IMPORTANT:
     *
     * Company currency comes from the company's settings/form.
     * It is NOT taken from the SBS subscription plan.
     * It is NOT hardcoded to AED.
     */
    const companyCurrency =
      normalizeCurrency(input.currency);

    const companyTimezone =
      input.timezone.trim();

    if (!companyName) {
      throw new Error(
        "Company name is required.",
      );
    }

    if (!ownerName) {
      throw new Error(
        "Owner name is required.",
      );
    }

    if (!ownerEmail) {
      throw new Error(
        "Owner email is required.",
      );
    }

    if (!slug) {
      throw new Error(
        "A valid company slug is required.",
      );
    }

    if (!input.planId) {
      throw new Error(
        "A subscription plan is required.",
      );
    }

    if (!/^[A-Z]{3}$/.test(companyCurrency)) {
      throw new Error(
        "Please select a valid 3-letter company currency.",
      );
    }

    if (!companyTimezone) {
      throw new Error(
        "Company timezone is required.",
      );
    }

    // ------------------------------------------------------------
    // PRODUCT BUSINESS ONLY
    // ------------------------------------------------------------

    if (input.businessType !== "product") {
      throw new Error(
        "SBS currently supports product businesses only.",
      );
    }

    // ------------------------------------------------------------
    // TRIAL VALIDATION
    // ------------------------------------------------------------

    if (
      input.trialEnabled &&
      input.trialDays < 0
    ) {
      throw new Error(
        "Trial days cannot be negative.",
      );
    }

    // ------------------------------------------------------------
    // DISCOUNT VALIDATION
    // ------------------------------------------------------------

    if (
      input.discountEnabled &&
      input.discountType === "percentage" &&
      (input.discountValue < 0 ||
        input.discountValue > 100)
    ) {
      throw new Error(
        "Percentage discount must be between 0 and 100.",
      );
    }

    if (
      input.discountEnabled &&
      input.discountType === "fixed" &&
      input.discountValue < 0
    ) {
      throw new Error(
        "Fixed discount cannot be negative.",
      );
    }

    if (
      input.discountEnabled &&
      !input.discountName.trim()
    ) {
      throw new Error(
        "Discount name is required.",
      );
    }

    if (
      input.discountEnabled &&
      input.discountDuration === "custom" &&
      !input.discountExpiresAt
    ) {
      throw new Error(
        "Please provide a custom discount expiry date.",
      );
    }

    // ------------------------------------------------------------
    // LOAD SBS SUBSCRIPTION PLAN
    // ------------------------------------------------------------

    const {
      data: plan,
      error: planError,
    } = await supabase
      .from("plans")
      .select(
        "id, name, slug, monthly_price, yearly_price, currency, is_active",
      )
      .eq("id", input.planId)
      .maybeSingle();

    if (planError) {
      throw new Error(
        `Unable to load subscription plan: ${planError.message}`,
      );
    }

    if (!plan) {
      throw new Error(
        "The selected subscription plan does not exist.",
      );
    }

    if (!plan.is_active) {
      throw new Error(
        "The selected subscription plan is inactive.",
      );
    }

    /*
     * The plan currency is the currency used for the SBS
     * subscription price.
     *
     * The company currency remains companyCurrency above.
     */
    const subscriptionCurrency: string =
      plan.currency;

    // ------------------------------------------------------------
    // CHECK DUPLICATE COMPANY SLUG
    // ------------------------------------------------------------

    const {
      data: existingCompany,
      error: existingCompanyError,
    } = await supabase
      .from("companies")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existingCompanyError) {
      throw new Error(
        `Unable to check company slug: ${existingCompanyError.message}`,
      );
    }

    if (existingCompany) {
      throw new Error(
        "A company with this slug already exists. Please choose another slug.",
      );
    }

    // ------------------------------------------------------------
    // WEBSITE / DOMAIN
    // ------------------------------------------------------------

    let normalizedWebsiteDomain:
      | string
      | null = null;

    if (input.website.trim()) {
      try {
        const websiteValue =
          input.website.trim().startsWith("http")
            ? input.website.trim()
            : `https://${input.website.trim()}`;

        normalizedWebsiteDomain =
          new URL(websiteValue)
            .hostname
            .toLowerCase()
            .replace(/^www\./, "");
      } catch {
        throw new Error(
          "Please enter a valid website address.",
        );
      }
    }

    if (normalizedWebsiteDomain) {
      const {
        data: existingDomain,
        error: domainCheckError,
      } = await supabase
        .from("company_domains")
        .select("id, company_id")
        .eq(
          "domain",
          normalizedWebsiteDomain,
        )
        .maybeSingle();

      if (domainCheckError) {
        throw new Error(
          `Unable to check company domain: ${domainCheckError.message}`,
        );
      }

      if (existingDomain) {
        throw new Error(
          "This domain is already connected to another SBS company.",
        );
      }
    }

    // ------------------------------------------------------------
    // CREATE COMPANY
    // ------------------------------------------------------------

    const {
      data: company,
      error: companyError,
    } = await supabase
      .from("companies")
      .insert({
        name: companyName,
        slug,

        email:
          input.email.trim() || null,

        phone:
          input.phone.trim() || null,

        website:
          input.website.trim() || null,

        address_line1:
          input.addressLine1.trim() || null,

        address_line2:
          input.addressLine2.trim() || null,

        city:
          input.city.trim() || null,

        state:
          input.state.trim() || null,

        postal_code:
          input.postalCode.trim() || null,

        country:
          input.country.trim() || null,

        /*
         * This is the customer's business currency.
         * It comes from the company creation form/settings.
         */
        currency: companyCurrency,

        timezone: companyTimezone,

        status:
          input.trialEnabled
            ? "trial"
            : "active",

        // PRODUCT ONLY.
        business_type: "product",

        tax_registration_number:
          input.taxRegistrationNumber.trim() ||
          null,

        trade_license_number:
          input.tradeLicenseNumber.trim() ||
          null,

        legal_registration_type:
          input.legalRegistrationType.trim() ||
          null,

        authority_name:
          input.authorityName.trim() ||
          null,
      })
      .select("id")
      .single();

    if (
      companyError ||
      !company
    ) {
      throw new Error(
        `Unable to create company: ${
          companyError?.message ||
          "Unknown database error."
        }`,
      );
    }

    companyId = company.id;

    // ------------------------------------------------------------
    // CREATE COMPANY REGIONAL SETTINGS
    // ------------------------------------------------------------

    /*
     * Initialize the company's regional settings using the
     * currency and timezone selected during company creation.
     *
     * We do NOT use AED/USD as a hardcoded company default here.
     */
    const {
      error: regionalSettingsError,
    } = await supabase
      .from("company_regional_settings")
      .insert({
        company_id: company.id,
        base_currency: companyCurrency,
        timezone: companyTimezone,
      });

    if (regionalSettingsError) {
      throw new Error(
        `Unable to create company regional settings: ${regionalSettingsError.message}`,
      );
    }

    // ------------------------------------------------------------
    // CREATE PRIMARY DOMAIN
    // ------------------------------------------------------------

    if (normalizedWebsiteDomain) {
      const {
        error: domainInsertError,
      } = await supabase
        .from("company_domains")
        .insert({
          company_id: company.id,
          domain:
            normalizedWebsiteDomain,
          is_primary: true,
          is_verified: false,
        });

      if (domainInsertError) {
        throw new Error(
          `Unable to create company domain: ${domainInsertError.message}`,
        );
      }
    }

    // ------------------------------------------------------------
    // INVITE COMPANY OWNER
    // ------------------------------------------------------------

    const {
      data: invitedUser,
      error: inviteError,
    } =
      await adminClient.auth.admin.inviteUserByEmail(
        ownerEmail,
        {
          data: {
            full_name: ownerName,
          },
        },
      );

    if (
      inviteError ||
      !invitedUser?.user
    ) {
      throw new Error(
        `Unable to invite company owner: ${
          inviteError?.message ||
          "Unknown authentication error."
        }`,
      );
    }

    // IMPORTANT:
    // This is now a local string, not a nullable variable.
    const createdOwnerUserId: string =
      invitedUser.user.id;

    ownerUserId =
      createdOwnerUserId;

    // ------------------------------------------------------------
    // OWNER PROFILE
    // ------------------------------------------------------------

    const {
      error: profileError,
    } = await supabase
      .from("profiles")
      .upsert({
        id: createdOwnerUserId,
        full_name: ownerName,
      });

    if (profileError) {
      throw new Error(
        `Unable to create owner profile: ${profileError.message}`,
      );
    }

    // ------------------------------------------------------------
    // COMPANY MEMBERSHIP
    // ------------------------------------------------------------

    const {
      error: membershipError,
    } = await supabase
      .from("company_members")
      .insert({
        company_id: company.id,
        user_id: createdOwnerUserId,
        role: "owner",
      });

    if (membershipError) {
      throw new Error(
        `Unable to create company membership: ${membershipError.message}`,
      );
    }

    // ------------------------------------------------------------
    // SUBSCRIPTION DATES
    // ------------------------------------------------------------

    const startedAt =
      new Date();

    const trialEndsAt =
      input.trialEnabled
        ? new Date(
            startedAt.getTime() +
              Math.max(
                input.trialDays,
                0,
              ) *
                24 *
                60 *
                60 *
                1000,
          )
        : null;

    const currentPeriodStart =
      startedAt;

    const currentPeriodEnd =
      input.billingCycle ===
      "monthly"
        ? addMonths(
            startedAt,
            1,
          )
        : addMonths(
            startedAt,
            12,
          );

    // ------------------------------------------------------------
    // SUBSCRIPTION PRICE
    // ------------------------------------------------------------

    const subscriptionAmount =
      input.billingCycle ===
      "monthly"
        ? Number(
            plan.monthly_price ?? 0,
          )
        : Number(
            plan.yearly_price ?? 0,
          );

    // ------------------------------------------------------------
    // CREATE SUBSCRIPTION
    // ------------------------------------------------------------

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabase
      .from("subscriptions")
      .insert({
        company_id:
          company.id,

        plan_id:
          plan.id,

        status:
          input.trialEnabled
            ? "trialing"
            : "active",

        billing_cycle:
          input.billingCycle,

        amount:
          subscriptionAmount,

        /*
         * Subscription currency belongs to the SBS plan.
         * Company/business currency remains companyCurrency.
         */
        currency:
          subscriptionCurrency,

        started_at:
          startedAt.toISOString(),

        trial_ends_at:
          trialEndsAt
            ? trialEndsAt.toISOString()
            : null,

        current_period_start:
          currentPeriodStart.toISOString(),

        current_period_end:
          currentPeriodEnd.toISOString(),

        cancel_at_period_end:
          false,

        canceled_at:
          null,

        provider:
          null,

        provider_customer_id:
          null,

        provider_subscription_id:
          null,
      })
      .select("id")
      .single();

    if (
      subscriptionError ||
      !subscription
    ) {
      throw new Error(
        `Unable to create subscription: ${
          subscriptionError?.message ||
          "Unknown database error."
        }`,
      );
    }

    // Local guaranteed string.
    const createdSubscriptionId: string =
      subscription.id;

    subscriptionId =
      createdSubscriptionId;

    // ------------------------------------------------------------
    // SYNC PLAN ENTITLEMENTS
    // ------------------------------------------------------------

    const {
      error: entitlementError,
    } = await supabase.rpc(
      "sync_subscription_entitlements",
      {
        p_subscription_id:
          createdSubscriptionId,
      },
    );

    if (entitlementError) {
      throw new Error(
        `Unable to sync company entitlements: ${entitlementError.message}`,
      );
    }

    // ------------------------------------------------------------
    // CREATE DISCOUNT
    // ------------------------------------------------------------

    if (input.discountEnabled) {
      const discountExpiresAt =
        getDiscountExpiry(
          input.discountDuration,
          input.discountExpiresAt,
          startedAt,
        );

      const {
        error: discountError,
      } = await supabase
        .from("company_discounts")
        .insert({
          company_id:
            company.id,

          plan_id:
            plan.id,

          name:
            input.discountName.trim(),

          code:
            input.discountCode.trim() ||
            null,

          discount_type:
            input.discountType,

          discount_value:
            input.discountValue,

          duration_type:
            input.discountDuration,

          starts_at:
            startedAt.toISOString(),

          expires_at:
            discountExpiresAt
              ? discountExpiresAt.toISOString()
              : null,

          /*
           * Database currently supports monthly/yearly/null.
           *
           * "both" means no billing-cycle restriction.
           */
          billing_cycle:
            input.discountBillingCycle ===
            "both"
              ? null
              : input.discountBillingCycle,

          is_active:
            true,

          reason:
            input.discountReason.trim() ||
            null,

          created_by:
            platformAdmin.user.id,
        });

      if (discountError) {
        throw new Error(
          `Unable to create discount: ${discountError.message}`,
        );
      }
    }

    // ------------------------------------------------------------
    // REFRESH ADMIN PAGES
    // ------------------------------------------------------------

    revalidatePath(
      "/sbs-admin",
    );

    revalidatePath(
      "/sbs-admin/companies",
    );

    revalidatePath(
      `/sbs-admin/companies/${company.id}`,
    );

    // ------------------------------------------------------------
    // SUCCESS
    //
    // Return the guaranteed local string values.
    // This eliminates the string | null TypeScript problem.
    // ------------------------------------------------------------

    return {
      success: true,
      companyId: company.id,
      ownerUserId: createdOwnerUserId,
      subscriptionId:
        createdSubscriptionId,
    };
  } catch (error) {
    // ------------------------------------------------------------
    // BEST-EFFORT CLEANUP
    // ------------------------------------------------------------

    try {
      const cleanupClient =
        await createClient();

      if (subscriptionId) {
        await cleanupClient
          .from("subscriptions")
          .delete()
          .eq(
            "id",
            subscriptionId,
          );
      }

      if (ownerUserId) {
        await cleanupClient
          .from("company_members")
          .delete()
          .eq(
            "user_id",
            ownerUserId,
          );

        await cleanupClient
          .from("profiles")
          .delete()
          .eq(
            "id",
            ownerUserId,
          );

        const supabaseUrl =
          process.env
            .NEXT_PUBLIC_SUPABASE_URL;

        const serviceRoleKey =
          process.env
            .SUPABASE_SERVICE_ROLE_KEY;

        if (
          supabaseUrl &&
          serviceRoleKey
        ) {
          const adminClient =
            createAdminClient(
              supabaseUrl,
              serviceRoleKey,
              {
                auth: {
                  autoRefreshToken:
                    false,
                  persistSession:
                    false,
                },
              },
            );

          await adminClient.auth.admin.deleteUser(
            ownerUserId,
          );
        }
      }

      if (companyId) {
        await cleanupClient
          .from("company_regional_settings")
          .delete()
          .eq(
            "company_id",
            companyId,
          );

        await cleanupClient
          .from("company_domains")
          .delete()
          .eq(
            "company_id",
            companyId,
          );

        await cleanupClient
          .from("company_discounts")
          .delete()
          .eq(
            "company_id",
            companyId,
          );

        await cleanupClient
          .from("companies")
          .delete()
          .eq(
            "id",
            companyId,
          );
      }
    } catch {
      // Preserve the original error.
    }

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the company.",
    };
  }
}