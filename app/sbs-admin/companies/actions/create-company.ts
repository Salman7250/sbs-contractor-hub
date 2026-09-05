"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";

type CreateCompanyInput = {
  name: string;
  slug: string;
  businessType: "product" | "service";
  ownerEmail: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  status?: "active" | "trial" | "suspended" | "cancelled";
  domain?: string;
};

function clean(value: string | undefined) {
  return value?.trim() || null;
}

function normalizeDomain(value: string | undefined) {
  if (!value) {
    return null;
  }

  let domain = value.trim().toLowerCase();

  if (!domain) {
    return null;
  }

  try {
    if (
      !domain.startsWith("http://") &&
      !domain.startsWith("https://")
    ) {
      domain = `https://${domain}`;
    }

    const url = new URL(domain);

    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function createCompany(input: CreateCompanyInput) {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  const businessType = input.businessType;

  if (!name) {
    return {
      success: false,
      error: "Company name is required.",
    };
  }

  if (!slug) {
    return {
      success: false,
      error: "Company slug is required.",
    };
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      success: false,
      error:
        "Slug can only contain lowercase letters, numbers, and hyphens.",
    };
  }

  if (
    businessType !== "product" &&
    businessType !== "service"
  ) {
    return {
      success: false,
      error:
        "Please select a valid business type.",
    };
  }

  if (!ownerEmail || !isValidEmail(ownerEmail)) {
    return {
      success: false,
      error: "A valid owner email address is required.",
    };
  }

  const status = input.status || "trial";
  const domain = normalizeDomain(input.domain);

  if (input.domain && !domain) {
    return {
      success: false,
      error: "Please enter a valid website domain.",
    };
  }

  const { data: existingSlug } = await supabase
    .from("companies")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingSlug) {
    return {
      success: false,
      error: "That company slug is already in use.",
    };
  }

  if (domain) {
    const { data: existingDomain } = await supabase
      .from("company_domains")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    if (existingDomain) {
      return {
        success: false,
        error: "That domain is already connected to an SBS company.",
      };
    }
  }

  /*
   * Create the company first using the authenticated
   * platform-admin session.
   */
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      name,
      slug,
      business_type: businessType,
      email: clean(input.email),
      phone: clean(input.phone),
      website: clean(input.website),
      address_line1: clean(input.addressLine1),
      address_line2: clean(input.addressLine2),
      city: clean(input.city),
      state: clean(input.state),
      postal_code: clean(input.postalCode),
      country: clean(input.country),
      timezone: clean(input.timezone) || "UTC",
      currency: clean(input.currency) || "USD",
      status,
    })
    .select("id, name, slug, business_type")
    .single();

  if (companyError || !company) {
    return {
      success: false,
      error: companyError?.message || "Unable to create company.",
    };
  }

  /*
   * Add the company's primary domain if supplied.
   */
  if (domain) {
    const { error: domainError } = await supabase
      .from("company_domains")
      .insert({
        company_id: company.id,
        domain,
        is_primary: true,
        is_verified: false,
      });

    if (domainError) {
      await supabase
        .from("companies")
        .delete()
        .eq("id", company.id);

      return {
        success: false,
        error:
          "Company could not be connected to the supplied domain.",
      };
    }
  }

  /*
   * The service-role key is ONLY used on the server.
   * It must never be exposed through NEXT_PUBLIC_*.
   */
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    await supabase
      .from("company_domains")
      .delete()
      .eq("company_id", company.id);

    await supabase
      .from("companies")
      .delete()
      .eq("id", company.id);

    return {
      success: false,
      error:
        "Server configuration is incomplete: SUPABASE_SERVICE_ROLE_KEY is missing.",
    };
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  /*
   * Invite the owner through Supabase Auth.
   *
   * No password is created or handled by SBS.
   * The owner receives the invitation and sets their own password.
   */
  const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const { data: invitation, error: invitationError } =
  await adminClient.auth.admin.inviteUserByEmail(
    ownerEmail,
    {
      redirectTo: `${appUrl}/auth/confirm?next=/set-password`,
    }
  );

  if (invitationError || !invitation.user) {
    /*
     * Roll back the company because the owner onboarding
     * could not be completed.
     */
    await supabase
      .from("company_domains")
      .delete()
      .eq("company_id", company.id);

    await supabase
      .from("companies")
      .delete()
      .eq("id", company.id);

    return {
      success: false,
      error:
        invitationError?.message ||
        "Unable to send the owner invitation.",
    };
  }

  const ownerUserId = invitation.user.id;

  /*
   * Create the tenant membership.
   */
  const { error: membershipError } = await supabase
    .from("company_members")
    .insert({
      company_id: company.id,
      user_id: ownerUserId,
      role: "owner",
    });

  if (membershipError) {
    /*
     * Remove the company because its owner membership
     * could not be created.
     *
     * We deliberately do NOT delete the Supabase Auth user.
     * The user may already have received the invitation.
     */
    await supabase
      .from("company_domains")
      .delete()
      .eq("company_id", company.id);

    await supabase
      .from("companies")
      .delete()
      .eq("id", company.id);

    return {
      success: false,
      error:
        "Owner account was invited, but the company membership could not be created. The owner invitation may need to be handled manually.",
    };
  }

  revalidatePath("/sbs-admin/companies");
  revalidatePath("/sbs-admin");
  revalidatePath("/");

  return {
    success: true,
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      businessType: company.business_type,
    },
    owner: {
      email: ownerEmail,
      userId: ownerUserId,
    },
  };
}