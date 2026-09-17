"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";

import {
  requirePlatformAdmin,
} from "@/lib/auth/platform-admin";

type ActionResult = {
  success: boolean;
  error?: string;
};

async function getAdminClient() {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (
    !serviceRoleKey ||
    !supabaseUrl
  ) {
    throw new Error(
      "Supabase service-role configuration is missing."
    );
  }

  return createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function logActivity(
  action: string,
  entityId: string,
  beforeData: unknown,
  afterData: unknown,
  reason?: string
) {
  try {
    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return;
    }

    await supabase
      .from("platform_activity_logs")
      .insert({
        actor_user_id: user.id,
        action,
        entity_type: "user",
        entity_id: entityId,
        before_data:
          beforeData ?? null,
        after_data:
          afterData ?? null,
        reason:
          reason ?? null,
      });
  } catch {
    // Activity logging should never
    // prevent the main admin action.
  }
}

export async function changeCompanyMembershipRole(
  input: {
    membershipId: string;
    role: string;
  }
): Promise<ActionResult> {
  await requirePlatformAdmin();

  const role =
    input.role.trim().toLowerCase();

  const allowedRoles = [
    "owner",
    "admin",
    "manager",
    "staff",
  ];

  if (!allowedRoles.includes(role)) {
    return {
      success: false,
      error: "Invalid company role.",
    };
  }

  const supabase =
    await createClient();

  const {
    data: membership,
    error: membershipError,
  } =
    await supabase
      .from("company_members")
      .select(
        "id, company_id, user_id, role"
      )
      .eq(
        "id",
        input.membershipId
      )
      .single();

  if (
    membershipError ||
    !membership
  ) {
    return {
      success: false,
      error:
        membershipError?.message ??
        "Membership not found.",
    };
  }

  if (
    membership.role === "owner" &&
    role !== "owner"
  ) {
    const {
      count,
    } =
      await supabase
        .from("company_members")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "company_id",
          membership.company_id
        )
        .eq(
          "role",
          "owner"
        );

    if (
      (count ?? 0) <= 1
    ) {
      return {
        success: false,
        error:
          "The company must have at least one owner.",
      };
    }
  }

  const {
    error,
  } =
    await supabase
      .from("company_members")
      .update({
        role,
      })
      .eq(
        "id",
        input.membershipId
      );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  await logActivity(
    "user_membership_role_changed",
    membership.user_id,
    {
      membershipId:
        membership.id,
      companyId:
        membership.company_id,
      role:
        membership.role,
    },
    {
      membershipId:
        membership.id,
      companyId:
        membership.company_id,
      role,
    }
  );

  revalidatePath(
    "/sbs-admin/users"
  );

  revalidatePath(
    `/sbs-admin/users?company=${membership.company_id}`
  );

  return {
    success: true,
  };
}

export async function addCompanyMembership(
  input: {
    userId: string;
    companyId: string;
    role: string;
  }
): Promise<ActionResult> {
  await requirePlatformAdmin();

  const role =
    input.role.trim().toLowerCase();

  const allowedRoles = [
    "owner",
    "admin",
    "manager",
    "staff",
  ];

  if (!allowedRoles.includes(role)) {
    return {
      success: false,
      error: "Invalid company role.",
    };
  }

  const supabase =
    await createClient();

  const {
    data: existing,
  } =
    await supabase
      .from("company_members")
      .select("id")
      .eq(
        "user_id",
        input.userId
      )
      .eq(
        "company_id",
        input.companyId
      )
      .maybeSingle();

  if (existing) {
    return {
      success: false,
      error:
        "This user is already a member of this company.",
    };
  }

  const {
    error,
  } =
    await supabase
      .from("company_members")
      .insert({
        user_id:
          input.userId,
        company_id:
          input.companyId,
        role,
      });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  await logActivity(
    "user_membership_added",
    input.userId,
    null,
    {
      companyId:
        input.companyId,
      role,
    }
  );

  revalidatePath(
    "/sbs-admin/users"
  );

  revalidatePath(
    `/sbs-admin/users?company=${input.companyId}`
  );

  return {
    success: true,
  };
}

export async function removeCompanyMembership(
  input: {
    membershipId: string;
  }
): Promise<ActionResult> {
  await requirePlatformAdmin();

  const supabase =
    await createClient();

  const {
    data: membership,
    error: membershipError,
  } =
    await supabase
      .from("company_members")
      .select(
        "id, company_id, user_id, role"
      )
      .eq(
        "id",
        input.membershipId
      )
      .single();

  if (
    membershipError ||
    !membership
  ) {
    return {
      success: false,
      error:
        membershipError?.message ??
        "Membership not found.",
    };
  }

  if (
    membership.role === "owner"
  ) {
    const {
      count,
    } =
      await supabase
        .from("company_members")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "company_id",
          membership.company_id
        )
        .eq(
          "role",
          "owner"
        );

    if (
      (count ?? 0) <= 1
    ) {
      return {
        success: false,
        error:
          "You cannot remove the only owner of a company.",
      };
    }
  }

  const {
    error,
  } =
    await supabase
      .from("company_members")
      .delete()
      .eq(
        "id",
        input.membershipId
      );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  await logActivity(
    "user_membership_removed",
    membership.user_id,
    {
      membershipId:
        membership.id,
      companyId:
        membership.company_id,
      role:
        membership.role,
    },
    null
  );

  revalidatePath(
    "/sbs-admin/users"
  );

  revalidatePath(
    `/sbs-admin/users?company=${membership.company_id}`
  );

  return {
    success: true,
  };
}

export async function toggleUserBan(
  input: {
    userId: string;
    banned: boolean;
  }
): Promise<ActionResult> {
  await requirePlatformAdmin();

  const adminClient =
    await getAdminClient();

  const {
    data: authUserData,
    error: userError,
  } =
    await adminClient.auth.admin.getUserById(
      input.userId
    );

  if (
    userError ||
    !authUserData.user
  ) {
    return {
      success: false,
      error:
        userError?.message ??
        "User not found.",
    };
  }

  const user =
    authUserData.user;

  const {
    data: platformAdmin,
  } =
    await adminClient
      .from("platform_admins")
      .select("user_id")
      .eq(
        "user_id",
        input.userId
      )
      .maybeSingle();

  if (
    platformAdmin &&
    input.banned
  ) {
    return {
      success: false,
      error:
        "Platform administrators cannot be banned from this interface.",
    };
  }

  const banDuration =
    input.banned
      ? "876000h"
      : "none";

  const {
    error,
  } =
    await adminClient.auth.admin.updateUserById(
      input.userId,
      {
        ban_duration:
          banDuration,
      }
    );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  await logActivity(
    input.banned
      ? "user_banned"
      : "user_unbanned",
    input.userId,
    {
      bannedUntil:
        user.banned_until ??
        null,
    },
    {
      banned:
        input.banned,
    }
  );

  revalidatePath(
    "/sbs-admin/users"
  );

  return {
    success: true,
  };
}

export async function resendUserInvite(
  input: {
    userId: string;
  }
): Promise<ActionResult> {
  await requirePlatformAdmin();

  const adminClient =
    await getAdminClient();

  const {
    data,
    error,
  } =
    await adminClient.auth.admin.getUserById(
      input.userId
    );

  if (
    error ||
    !data.user
  ) {
    return {
      success: false,
      error:
        error?.message ??
        "User not found.",
    };
  }

  if (
    !data.user.email
  ) {
    return {
      success: false,
      error:
        "This user does not have an email address.",
    };
  }

  if (
    data.user.email_confirmed_at
  ) {
    return {
      success: false,
      error:
        "This user's email is already confirmed.",
    };
  }

  const {
    error: inviteError,
  } =
    await adminClient.auth.admin.inviteUserByEmail(
      data.user.email,
      {
        redirectTo:
          `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/set-password`,
      }
    );

  if (inviteError) {
    return {
      success: false,
      error:
        inviteError.message,
    };
  }

  await logActivity(
    "user_invite_resent",
    input.userId,
    null,
    {
      email:
        data.user.email,
    }
  );

  revalidatePath(
    "/sbs-admin/users"
  );

  return {
    success: true,
  };
}