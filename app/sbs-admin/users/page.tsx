import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import UsersPageClient from "./user-management";

type AuthUser = {
  id: string;
  email?: string | null;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string | null;
  email_confirmed_at?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown>;
};

type Company = {
  id: string;
  name: string;
  slug: string;
  status?: string | null;
  created_at?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type Membership = {
  id: string;
  company_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

export default async function AdminUsersPage() {
  await requirePlatformAdmin();

  const supabase = await createClient();

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error(
      "Supabase service-role configuration is missing."
    );
  }

  const adminClient = createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const [
    companiesResult,
    profilesResult,
    membershipsResult,
    platformAdminsResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, slug, status, created_at"
      )
      .order("name", {
        ascending: true,
      }),

    supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, created_at, updated_at"
      ),

    supabase
      .from("company_members")
      .select(
        "id, company_id, user_id, role, created_at"
      ),

    supabase
      .from("platform_admins")
      .select(
        "user_id, role, created_at"
      ),
  ]);

  if (companiesResult.error) {
    throw new Error(
      companiesResult.error.message
    );
  }

  if (profilesResult.error) {
    throw new Error(
      profilesResult.error.message
    );
  }

  if (membershipsResult.error) {
    throw new Error(
      membershipsResult.error.message
    );
  }

  if (platformAdminsResult.error) {
    throw new Error(
      platformAdminsResult.error.message
    );
  }

  const companies =
    (companiesResult.data ?? []) as Company[];

  const profiles =
    (profilesResult.data ?? []) as Profile[];

  const memberships =
    (membershipsResult.data ?? []) as Membership[];

  const platformAdmins =
    platformAdminsResult.data ?? [];

  const authUsers: AuthUser[] = [];

  let page = 1;

  while (true) {
    const {
      data,
      error,
    } =
      await adminClient.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

    if (error) {
      throw new Error(error.message);
    }

    authUsers.push(
      ...(data.users as AuthUser[])
    );

    if (data.users.length < 1000) {
      break;
    }

    page += 1;
  }

  const companyMap = new Map(
    companies.map((company) => [
      company.id,
      company,
    ])
  );

  const profileMap = new Map(
    profiles.map((profile) => [
      profile.id,
      profile,
    ])
  );

  const authUserMap = new Map(
    authUsers.map((user) => [
      user.id,
      user,
    ])
  );

  const platformAdminMap = new Map(
    platformAdmins.map((admin) => [
      admin.user_id,
      admin,
    ])
  );

  const companyUsers = companies.map(
    (company) => {
      const companyMemberships =
        memberships.filter(
          (membership) =>
            membership.company_id ===
            company.id
        );

      const users =
        companyMemberships
          .map((membership) => {
            const authUser =
              authUserMap.get(
                membership.user_id
              );

            const profile =
              profileMap.get(
                membership.user_id
              );

            if (!authUser) {
              return null;
            }

            return {
              membershipId:
                membership.id,

              userId:
                membership.user_id,

              fullName:
                profile?.full_name ??
                getMetadataName(
                  authUser.user_metadata
                ) ??
                "Unnamed User",

              avatarUrl:
                profile?.avatar_url ??
                null,

              email:
                authUser.email ?? "",

              role:
                membership.role,

              createdAt:
                membership.created_at,

              lastSignInAt:
                authUser.last_sign_in_at ??
                null,

              emailConfirmedAt:
                authUser.email_confirmed_at ??
                null,

              bannedUntil:
                authUser.banned_until ??
                null,

              isPlatformAdmin:
                platformAdminMap.has(
                  membership.user_id
                ),
            };
          })
          .filter(
            (
              user
            ): user is NonNullable<
              typeof user
            > =>
              Boolean(user)
          );

      return {
        ...company,
        users,
      };
    }
  );

  const companyUserCount =
    companyUsers.reduce(
      (total, company) =>
        total + company.users.length,
      0
    );

  const activeUserCount =
    companyUsers.reduce(
      (total, company) =>
        total +
        company.users.filter(
          (user) =>
            !user.bannedUntil
        ).length,
      0
    );

  const pendingUserCount =
    companyUsers.reduce(
      (total, company) =>
        total +
        company.users.filter(
          (user) =>
            !user.emailConfirmedAt
        ).length,
      0
    );

  const unassignedUsers =
    authUsers.filter(
      (authUser) =>
        !memberships.some(
          (membership) =>
            membership.user_id ===
            authUser.id
        ) &&
        !platformAdminMap.has(
          authUser.id
        )
    );

  const platformAdminUsers =
    authUsers.filter((authUser) =>
      platformAdminMap.has(
        authUser.id
      )
    );

  const companiesWithUsers =
    companyUsers.filter(
      (company) =>
        company.users.length > 0
    ).length;

  return (
    <UsersPageClient
      companies={companyUsers}
      stats={{
        totalCompanies:
          companies.length,

        companiesWithUsers,

        totalUsers:
          companyUserCount,

        activeUsers:
          activeUserCount,

        pendingUsers:
          pendingUserCount,

        platformAdmins:
          platformAdminUsers.length,

        unassignedUsers:
          unassignedUsers.length,
      }}
      platformAdmins={platformAdminUsers.map(
        (authUser) => {
          const profile =
            profileMap.get(
              authUser.id
            );

          const admin =
            platformAdminMap.get(
              authUser.id
            );

          return {
            id: authUser.id,

            fullName:
              profile?.full_name ??
              getMetadataName(
                authUser.user_metadata
              ) ??
              "Platform Administrator",

            avatarUrl:
              profile?.avatar_url ??
              null,

            email:
              authUser.email ?? "",

            role:
              admin?.role ??
              "admin",

            lastSignInAt:
              authUser.last_sign_in_at ??
              null,

            emailConfirmedAt:
              authUser.email_confirmed_at ??
              null,

            createdAt:
              authUser.created_at,

            bannedUntil:
              authUser.banned_until ??
              null,
          };
        }
      )}
    />
  );
}

function getMetadataName(
  metadata?: Record<string, unknown>
) {
  if (!metadata) {
    return null;
  }

  const value =
    metadata.full_name ??
    metadata.name;

  return typeof value === "string"
    ? value
    : null;
}