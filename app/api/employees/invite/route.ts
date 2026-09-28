import { NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type InviteEmployeePayload = {
  first_name: string;
  last_name: string;
  employee_number?: string | null;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  employment_type?: string | null;
  status?: string | null;
  role_id: string;
  hire_date?: string | null;
  manager_id?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  notes?: string | null;
};

const ALLOWED_EMPLOYMENT_TYPES = new Set([
  "full_time",
  "part_time",
  "contractor",
  "temporary",
]);

const ALLOWED_STATUSES = new Set([
  "invited",
  "active",
  "inactive",
]);

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function cleanEmail(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonError(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
    },
  );
}

function getAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  let serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  /*
   * SBS already uses SUPABASE_SECRET_KEYS in some
   * server-side environments, so support that format too.
   */
  if (
    !serviceRoleKey &&
    process.env.SUPABASE_SECRET_KEYS
  ) {
    try {
      const secretKeys = JSON.parse(
        process.env.SUPABASE_SECRET_KEYS,
      );

      if (
        secretKeys &&
        typeof secretKeys.default === "string"
      ) {
        serviceRoleKey = secretKeys.default;
      }
    } catch (error) {
      console.error(
        "Unable to parse SUPABASE_SECRET_KEYS:",
        error,
      );
    }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase server credentials are not configured.",
    );
  }

  return createSupabaseAdminClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function getAppUrl(request: Request): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  let invitedAuthUserId: string | null = null;
  let companyId: string | null = null;
  let createdEmployeeId: string | null = null;
  let createdMembership = false;

  try {
    /*
     * =========================================================
     * 1. Parse request
     * =========================================================
     */

    let body: InviteEmployeePayload;

    try {
      body =
        (await request.json()) as InviteEmployeePayload;
    } catch {
      return jsonError("Invalid request body.");
    }

    /*
     * =========================================================
     * 2. Authenticate current SBS user
     * =========================================================
     */

    const supabase = await createClient();

    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !currentUser) {
      return jsonError(
        "You must be signed in to invite an employee.",
        401,
      );
    }

    /*
     * =========================================================
     * 3. Resolve company from authenticated user
     * =========================================================
     *
     * IMPORTANT:
     *
     * We NEVER trust company_id from the browser.
     */

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", currentUser.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error(
        "Employee invite membership lookup failed:",
        membershipError,
      );

      return jsonError(
        "Unable to determine your company membership.",
        500,
      );
    }

    if (!membership?.company_id) {
      return jsonError(
        "Your account is not associated with a company.",
        403,
      );
    }

    companyId = membership.company_id;

    /*
     * =========================================================
     * 4. Authorization
     * =========================================================
     *
     * Company owner/admin:
     *     allowed
     *
     * OR
     *
     * Employee role has:
     *     employees:create
     *
     * This is enforced server-side.
     */

    const isCompanyAdmin =
      membership.role === "owner" ||
      membership.role === "admin";

    let hasEmployeeCreatePermission = false;

    if (!isCompanyAdmin) {
      const {
        data: permissionResult,
        error: permissionError,
      } = await supabase.rpc(
        "employee_has_permission",
        {
          p_company_id: companyId,
          p_module: "employees",
          p_action: "create",
        },
      );

      if (permissionError) {
        console.error(
          "Employee invite permission check failed:",
          permissionError,
        );

        return jsonError(
          "Unable to verify employee-management permission.",
          500,
        );
      }

      hasEmployeeCreatePermission =
        permissionResult === true;
    }

    if (
      !isCompanyAdmin &&
      !hasEmployeeCreatePermission
    ) {
      return jsonError(
        "You do not have permission to create employees.",
        403,
      );
    }

    /*
     * =========================================================
     * 5. Validate and normalize input
     * =========================================================
     */

    const firstName = cleanString(
      body.first_name,
    );

    const lastName = cleanString(
      body.last_name,
    );

    const employeeNumber = cleanString(
      body.employee_number,
    );

    const email = cleanEmail(body.email);

    const phone = cleanString(
      body.phone,
    );

    const jobTitle = cleanString(
      body.job_title,
    );

    const department = cleanString(
      body.department,
    );

    const employmentType =
      cleanString(body.employment_type) ||
      "full_time";

    const requestedStatus =
      cleanString(body.status) ||
      "invited";

    const roleId = cleanString(
      body.role_id,
    );

    const hireDate = cleanString(
      body.hire_date,
    );

    const managerId = cleanString(
      body.manager_id,
    );

    const emergencyContactName =
      cleanString(
        body.emergency_contact_name,
      );

    const emergencyContactPhone =
      cleanString(
        body.emergency_contact_phone,
      );

    const notes = cleanString(
      body.notes,
    );

    if (!firstName) {
      return jsonError(
        "First name is required.",
      );
    }

    if (!lastName) {
      return jsonError(
        "Last name is required.",
      );
    }

    if (!email) {
      return jsonError(
        "SBS login email is required.",
      );
    }

    if (!isValidEmail(email)) {
      return jsonError(
        "Please enter a valid email address.",
      );
    }

    if (!roleId) {
      return jsonError(
        "Employee role is required.",
      );
    }

    if (
      !ALLOWED_EMPLOYMENT_TYPES.has(
        employmentType,
      )
    ) {
      return jsonError(
        "Invalid employment type.",
      );
    }

    if (
      !ALLOWED_STATUSES.has(
        requestedStatus,
      )
    ) {
      return jsonError(
        "Invalid employee status.",
      );
    }

    /*
     * =========================================================
     * 6. Validate employee role
     * =========================================================
     *
     * The selected role MUST belong to the current company.
     */

    const {
      data: role,
      error: roleError,
    } = await supabase
      .from("employee_roles")
      .select(
        "id, company_id, name, description",
      )
      .eq("id", roleId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (roleError) {
      console.error(
        "Employee role lookup failed:",
        roleError,
      );

      return jsonError(
        "Unable to verify the selected employee role.",
        500,
      );
    }

    if (!role) {
      return jsonError(
        "The selected employee role does not belong to this company.",
      );
    }

    /*
     * =========================================================
     * 7. Validate manager
     * =========================================================
     */

    if (managerId) {
      const {
        data: manager,
        error: managerError,
      } = await supabase
        .from("employees")
        .select(
          "id, company_id, status",
        )
        .eq("id", managerId)
        .eq("company_id", companyId)
        .maybeSingle();

      if (managerError) {
        console.error(
          "Employee manager lookup failed:",
          managerError,
        );

        return jsonError(
          "Unable to verify the selected manager.",
          500,
        );
      }

      if (!manager) {
        return jsonError(
          "The selected manager does not belong to this company.",
        );
      }

      if (
        manager.status === "inactive" ||
        manager.status === "terminated"
      ) {
        return jsonError(
          "An inactive or terminated employee cannot be assigned as manager.",
        );
      }
    }

    /*
     * =========================================================
     * 8. Check employee number
     * =========================================================
     */

    if (employeeNumber) {
      const {
        data: existingNumber,
        error: numberError,
      } = await supabase
        .from("employees")
        .select("id")
        .eq("company_id", companyId)
        .eq(
          "employee_number",
          employeeNumber,
        )
        .maybeSingle();

      if (numberError) {
        console.error(
          "Employee number lookup failed:",
          numberError,
        );

        return jsonError(
          "Unable to verify the employee number.",
          500,
        );
      }

      if (existingNumber) {
        return jsonError(
          `Employee number "${employeeNumber}" is already in use.`,
          409,
        );
      }
    }

    /*
     * =========================================================
     * 9. Check existing employee email
     * =========================================================
     */

    const {
      data: existingEmployee,
      error: existingEmployeeError,
    } = await supabase
      .from("employees")
      .select(
        "id, user_id, email",
      )
      .eq("company_id", companyId)
      .ilike("email", email)
      .maybeSingle();

    if (existingEmployeeError) {
      console.error(
        "Existing employee lookup failed:",
        existingEmployeeError,
      );

      return jsonError(
        "Unable to check for an existing employee.",
        500,
      );
    }

    if (existingEmployee) {
      return jsonError(
        "An employee with this email already exists in your company.",
        409,
      );
    }

    /*
     * =========================================================
     * 10. Create Admin Supabase client
     * =========================================================
     */

    const adminSupabase =
      getAdminClient();

    /*
     * =========================================================
     * 11. Check whether Auth account already exists
     * =========================================================
     *
     * We search Auth users server-side.
     *
     * We do NOT automatically attach an existing Auth account
     * because that could accidentally connect an unrelated
     * account to this company.
     */

    let existingAuthUser:
      | {
          id: string;
          email?: string | null;
        }
      | null = null;

    const perPage = 1000;
    let page = 1;

    while (!existingAuthUser) {
      const {
        data: usersPage,
        error: usersError,
      } =
        await adminSupabase.auth.admin.listUsers({
          page,
          perPage,
        });

      if (usersError) {
        console.error(
          "Auth user lookup failed:",
          usersError,
        );

        return jsonError(
          "Unable to verify the employee login account.",
          500,
        );
      }

      const matchedUser =
        usersPage.users.find(
          (authUser) =>
            authUser.email?.toLowerCase() ===
            email,
        );

      if (matchedUser) {
        existingAuthUser = {
          id: matchedUser.id,
          email: matchedUser.email,
        };

        break;
      }

      if (
        !usersPage.users ||
        usersPage.users.length < perPage
      ) {
        break;
      }

      page += 1;
    }

    if (existingAuthUser) {
      return jsonError(
        "A Supabase login account already exists with this email. Use a different email or manage the existing SBS user.",
        409,
      );
    }

    /*
     * =========================================================
     * 12. Build employee invitation redirect
     * =========================================================
     *
     * IMPORTANT:
     *
     * Supabase's invitation link handles the invitation
     * verification itself.
     *
     * Once the invitation is accepted, the employee MUST
     * land directly on /set-password.
     *
     * We intentionally do NOT send employees through:
     *
     *     /onboarding
     *     /auth/confirm
     *
     * because those routes belong to the company signup /
     * normal authentication flow.
     */

    const appUrl = getAppUrl(
      request,
    );

    const inviteRedirectUrl =
      new URL(
        "/set-password",
        `${appUrl}/`,
      );

    /*
     * =========================================================
     * 13. Invite Auth user
     * =========================================================
     */

    const {
      data: invitedUserData,
      error: inviteError,
    } =
      await adminSupabase.auth.admin.inviteUserByEmail(
        email,
        {
          /*
           * Employee identity metadata.
           *
           * account_type is important because the
           * /set-password flow uses it to distinguish an
           * employee invitation from a normal company signup.
           */
          data: {
            account_type: "employee",
            first_name: firstName,
            last_name: lastName,
            display_name:
              `${firstName} ${lastName}`.trim(),
            company_id: companyId,
            employee_role_id: roleId,
            employee_role_name: role.name,
          },

          /*
           * IMPORTANT:
           *
           * Explicitly control the post-invitation redirect.
           *
           * This prevents Supabase from falling back to the
           * project Site URL and sending the employee into
           * company onboarding.
           */
          redirectTo:
            inviteRedirectUrl.toString(),
        },
      );

    if (
      inviteError ||
      !invitedUserData.user
    ) {
      console.error(
        "Supabase employee invitation failed:",
        inviteError,
      );

      return jsonError(
        inviteError?.message ||
          "Unable to send the employee invitation.",
        500,
      );
    }

    invitedAuthUserId =
      invitedUserData.user.id;

    /*
     * =========================================================
     * 14. Create company membership
     * =========================================================
     *
     * company_members.role is intentionally separate from
     * employee_roles.
     *
     * company_members.role:
     *     owner / admin / manager / member
     *
     * employee_roles:
     *     SBS application permissions
     */

    const {
      error: companyMemberError,
    } = await adminSupabase
      .from("company_members")
      .insert({
        company_id: companyId,
        user_id: invitedAuthUserId,
        role: "member",
      });

    if (companyMemberError) {
      console.error(
        "Employee company membership creation failed:",
        companyMemberError,
      );

      throw new Error(
        "The employee invitation was created, but the company membership could not be created.",
      );
    }

    createdMembership = true;

    /*
     * =========================================================
     * 15. Create employee record
     * =========================================================
     */

    const displayName =
      `${firstName} ${lastName}`.trim();

    const {
      data: createdEmployee,
      error: createEmployeeError,
    } = await adminSupabase
      .from("employees")
      .insert({
        company_id: companyId,
        user_id: invitedAuthUserId,
        role_id: roleId,
        employee_number:
          employeeNumber,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        email,
        phone,
        job_title: jobTitle,
        department,
        employment_type:
          employmentType,
        status: requestedStatus,
        hire_date: hireDate,
        manager_id: managerId,
        emergency_contact_name:
          emergencyContactName,
        emergency_contact_phone:
          emergencyContactPhone,
        notes,
      })
      .select(
        `
          id,
          company_id,
          user_id,
          role_id,
          employee_number,
          first_name,
          last_name,
          display_name,
          email,
          phone,
          job_title,
          department,
          employment_type,
          status,
          hire_date,
          manager_id,
          emergency_contact_name,
          emergency_contact_phone,
          notes,
          created_at,
          updated_at
        `,
      )
      .single();

    if (
      createEmployeeError ||
      !createdEmployee
    ) {
      console.error(
        "Employee record creation failed:",
        createEmployeeError,
      );

      throw new Error(
        "The employee login was created, but the employee record could not be created.",
      );
    }

    createdEmployeeId =
      createdEmployee.id;

    /*
     * =========================================================
     * 16. Create notification
     * =========================================================
     *
     * Best effort only.
     *
     * Employee creation must not fail merely because the
     * notification system is unavailable.
     */

    try {
      const {
        error: notificationError,
      } = await supabase.rpc(
        "create_app_notification",
        {
          p_company_id: companyId,
          p_type: "employee_created",
          p_title: "Employee added",
          p_message: `${displayName} was added to your employee directory.`,
          p_href: `/employees/${createdEmployee.id}`,
          p_entity_type: "employee",
          p_entity_id:
            createdEmployee.id,
          p_user_id: currentUser.id,
          p_metadata: {
            employee_id:
              createdEmployee.id,
            employee_role_id:
              roleId,
          },
        },
      );

      if (notificationError) {
        console.error(
          "Employee notification failed:",
          notificationError,
        );
      }
    } catch (notificationError) {
      console.error(
        "Employee notification exception:",
        notificationError,
      );
    }

    /*
     * =========================================================
     * 17. Success
     * =========================================================
     */

    return NextResponse.json(
      {
        success: true,
        message:
          "Employee created successfully. An SBS login invitation has been sent.",
        employee: createdEmployee,
        role: {
          id: role.id,
          name: role.name,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    /*
     * =========================================================
     * COMPENSATING CLEANUP
     * =========================================================
     *
     * Supabase Auth and Postgres inserts cannot be wrapped
     * into one normal transaction from this route.
     *
     * If something fails after Auth creation, clean up the
     * partial records.
     */

    try {
      if (invitedAuthUserId) {
        const adminSupabase =
          getAdminClient();

        /*
         * Delete employee first.
         */
        if (createdEmployeeId) {
          const {
            error: employeeCleanupError,
          } = await adminSupabase
            .from("employees")
            .delete()
            .eq(
              "id",
              createdEmployeeId,
            );

          if (employeeCleanupError) {
            console.error(
              "Employee cleanup failed:",
              employeeCleanupError,
            );
          }
        }

        /*
         * Delete company membership.
         */
        if (
          createdMembership &&
          companyId
        ) {
          const {
            error: membershipCleanupError,
          } = await adminSupabase
            .from("company_members")
            .delete()
            .eq(
              "company_id",
              companyId,
            )
            .eq(
              "user_id",
              invitedAuthUserId,
            );

          if (membershipCleanupError) {
            console.error(
              "Company membership cleanup failed:",
              membershipCleanupError,
            );
          }
        }

        /*
         * Finally delete the Auth account.
         */
        const {
          error: authCleanupError,
        } =
          await adminSupabase.auth.admin.deleteUser(
            invitedAuthUserId,
          );

        if (authCleanupError) {
          console.error(
            "Auth user cleanup failed:",
            authCleanupError,
          );
        }
      }
    } catch (cleanupError) {
      console.error(
        "Employee invite cleanup encountered an error:",
        cleanupError,
      );
    }

    console.error(
      "Employee invitation request failed:",
      error,
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to create the employee.",
      500,
    );
  }
}