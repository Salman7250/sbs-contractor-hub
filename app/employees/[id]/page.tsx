"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { User } from "lucide-react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type EmployeeRole = {
  id: string;
  name: string;
  description: string | null;
};

type Employee = {
  id: string;
  company_id: string;
  user_id: string | null;
  role_id: string | null;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  employment_type: string | null;
  status: string | null;
  hire_date: string | null;
  manager_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee_roles: EmployeeRole[] | null;
  profile_full_name: string | null;
  avatar_url: string | null;
  manager: {
    id: string;
    display_name: string | null;
    first_name: string;
    last_name: string;
  } | null;
};

type Company = {
  id: string;
  name: string;
};

type Permission = {
  id: string;
  module: string;
  action: string;
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Customers",
  quotes: "Quotes",
  sales_orders: "Sales & Orders",
  invoices: "Invoices",
  payments: "Payments",
  products: "Products",
  serial_numbers: "Serial Numbers",
  inventory: "Inventory",
  warehouses: "Warehouses",
  pricing: "Pricing",
  suppliers: "Suppliers",
  purchase_orders: "Purchase Orders",
  expenses: "Expenses",
  warranty: "Warranty",
  repairs: "Repairs",
  rma: "RMA",
  b2b_portal: "B2B Client Portal",
  reports: "Reports & Analytics",
  employees: "Employees",
  documents: "Documents",
  settings: "Settings",
};

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  send: "Send",
  approve: "Approve",
  reject: "Reject",
  pay: "Pay",
  close: "Close",
  adjust: "Adjust",
  manage: "Manage",
  manage_roles: "Manage Roles",
  deactivate: "Deactivate",
};

function formatEmploymentType(value: string | null) {
  if (!value) return "—";

  const labels: Record<string, string> = {
    full_time: "Full Time",
    part_time: "Part Time",
    contractor: "Contractor",
    temporary: "Temporary",
  };

  return (
    labels[value] ||
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function formatStatus(value: string | null) {
  if (!value) return "Unknown";

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getInitials(
  firstName: string,
  lastName: string
) {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);

  return (
    `${first}${last}`.toUpperCase() || "E"
  );
}

function getRoleName(employee: Employee) {
  return (
    employee.employee_roles?.[0]?.name ||
    "Employee"
  );
}

function groupPermissionsByModule(
  permissions: Permission[]
) {
  const grouped: Record<string, Permission[]> = {};

  for (const permission of permissions) {
    if (!grouped[permission.module]) {
      grouped[permission.module] = [];
    }

    grouped[permission.module].push(permission);
  }

  return grouped;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();

  const employeeId =
    typeof params.id === "string"
      ? params.id
      : "";

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [permissions, setPermissions] =
    useState<Permission[]>([]);

  const [currentUserIsAdmin, setCurrentUserIsAdmin] =
    useState(false);

  const loadEmployee = useCallback(
    async (showRefresh = false) => {
      if (!employeeId) {
        setErrorMessage(
          "Employee ID is missing."
        );
        setLoading(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        /*
         * =====================================================
         * Current authenticated user
         * =====================================================
         */

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(
            userError.message
          );
        }

        if (!user) {
          router.push("/login");
          return;
        }

        /*
         * =====================================================
         * Current company membership
         * =====================================================
         */

        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select(
            "company_id, role"
          )
          .eq(
            "user_id",
            user.id
          )
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw new Error(
            membershipError.message
          );
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership was found for your account."
          );
        }

        const companyId =
          membership.company_id;

        setCurrentUserIsAdmin(
          membership.role === "owner" ||
            membership.role === "admin"
        );

        /*
         * =====================================================
         * Employee
         * =====================================================
         *
         * The company_id filter is intentional.
         * It prevents accidentally loading an employee
         * belonging to another company.
         */

        const {
          data: employeeData,
          error: employeeError,
        } = await supabase
          .from("employees")
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
              updated_at,
              employee_roles (
                id,
                name,
                description
              )
            `
          )
          .eq(
            "id",
            employeeId
          )
          .eq(
            "company_id",
            companyId
          )
          .maybeSingle();

        if (employeeError) {
          throw new Error(
            employeeError.message
          );
        }

        if (!employeeData) {
          throw new Error(
            "Employee not found or you do not have access to this employee."
          );
        }

        /*
         * =====================================================
         * Current Profile
         * =====================================================
         *
         * The employee record contains the original HR name.
         * The profile contains the employee's current SBS name
         * and profile photo, so the detail header stays in sync
         * with the employee's own account.
         */

        let profileFullName: string | null = null;
        let avatarUrl: string | null = null;

        if (employeeData.user_id) {
          const {
            data: profileData,
            error: profileError,
          } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", employeeData.user_id)
            .maybeSingle();

          if (profileError) {
            throw new Error(profileError.message);
          }

          profileFullName = profileData?.full_name || null;
          avatarUrl = profileData?.avatar_url || null;
        }

        /*
         * =====================================================
         * Manager
         * =====================================================
         */

        let managerData:
          | Employee["manager"]
          | null = null;

        if (employeeData.manager_id) {
          const {
            data: manager,
            error: managerError,
          } = await supabase
            .from("employees")
            .select(
              `
                id,
                display_name,
                first_name,
                last_name
              `
            )
            .eq(
              "id",
              employeeData.manager_id
            )
            .eq(
              "company_id",
              companyId
            )
            .maybeSingle();

          if (managerError) {
            throw new Error(
              managerError.message
            );
          }

          managerData = manager;
        }

        /*
         * =====================================================
         * Company
         * =====================================================
         */

        const {
          data: companyData,
          error: companyError,
        } = await supabase
          .from("companies")
          .select(
            "id, name"
          )
          .eq(
            "id",
            companyId
          )
          .single();

        if (companyError) {
          throw new Error(
            companyError.message
          );
        }

        /*
         * =====================================================
         * Role permissions
         * =====================================================
         */

        let rolePermissions: Permission[] =
          [];

        if (employeeData.role_id) {
          const {
            data: rolePermissionData,
            error: rolePermissionError,
          } = await supabase
            .from(
              "employee_role_permissions"
            )
            .select(
              `
                permission_id,
                employee_permissions (
                  id,
                  module,
                  action
                )
              `
            )
            .eq(
              "role_id",
              employeeData.role_id
            );

          if (rolePermissionError) {
            throw new Error(
              rolePermissionError.message
            );
          }

          rolePermissions =
            (rolePermissionData || [])
              .map((item) => {
                const permission =
                  item.employee_permissions;

                if (
                  Array.isArray(permission)
                ) {
                  return permission[0] || null;
                }

                return permission || null;
              })
              .filter(
                (
                  permission
                ): permission is Permission =>
                  Boolean(permission)
              );
        }

        setEmployee({
          ...employeeData,
          employee_roles:
            employeeData.employee_roles ||
            [],
          profile_full_name: profileFullName,
          avatar_url: avatarUrl,
          manager: managerData,
        });

        setCompany(companyData);
        setPermissions(
          rolePermissions
        );
      } catch (error) {
        console.error(
          "Employee detail load error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load employee."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [employeeId, router, supabase]
  );

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="page-header">
            <div>
              <div className="skeleton-back" />
              <div className="skeleton-title" />
              <div className="skeleton-subtitle" />
            </div>
          </div>

          <div className="loading-card">
            <div className="spinner" />
            <p>
              Loading employee...
            </p>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .page-header {
              margin-bottom: 24px;
            }

            .skeleton-back {
              width: 90px;
              height: 14px;
              background: #e5e7eb;
              border-radius: 5px;
              margin-bottom: 12px;
            }

            .skeleton-title {
              width: 240px;
              height: 28px;
              background: #e5e7eb;
              border-radius: 8px;
            }

            .skeleton-subtitle {
              width: 340px;
              height: 15px;
              background: #f1f5f9;
              border-radius: 6px;
              margin-top: 10px;
            }

            .loading-card {
              min-height: 360px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: #64748b;
              gap: 14px;
            }

            .loading-card p {
              margin: 0;
              font-size: 14px;
            }

            .spinner {
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
        </main>
      </AppShell>
    );
  }

  if (!employee) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="error-card">
            <div className="error-icon">
              !
            </div>

            <h1>
              Employee not found
            </h1>

            <p>
              {errorMessage ||
                "The employee could not be found or you do not have access to this record."}
            </p>

            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                router.push("/employees")
              }
            >
              ← Back to Employees
            </button>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .error-card {
              min-height: 360px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              border-radius: 14px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              padding: 30px;
            }

            .error-icon {
              width: 44px;
              height: 44px;
              border-radius: 50%;
              background: #fef2f2;
              color: #dc2626;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              margin-bottom: 15px;
            }

            h1 {
              margin: 0;
              color: #111827;
              font-size: 20px;
            }

            p {
              max-width: 500px;
              margin: 8px 0 20px;
              color: #64748b;
              font-size: 14px;
              line-height: 1.6;
            }

            .button {
              height: 40px;
              padding: 0 15px;
              border-radius: 9px;
              border: 1px solid #111827;
              background: #111827;
              color: #ffffff;
              font-size: 13px;
              font-weight: 650;
              cursor: pointer;
            }
          `}</style>
        </main>
      </AppShell>
    );
  }

  const roleName =
    getRoleName(employee);

  const groupedPermissions =
    groupPermissionsByModule(
      permissions
    );

  const employeeName =
    employee.profile_full_name?.trim() ||
    employee.display_name ||
    `${employee.first_name} ${employee.last_name}`.trim();

  const isInvited =
    employee.status === "invited";

  const isActive =
    employee.status === "active";

  const isInactive =
    employee.status === "inactive" ||
    employee.status === "terminated";

  const loginStatus =
    !employee.user_id
      ? "No Login"
      : isInvited
        ? "Invitation Sent"
        : isActive
          ? "Active"
          : isInactive
            ? "Disabled"
            : "Created";

  return (
    <AppShell>
      <main className="page-content">
        {errorMessage && (
          <div className="alert alert-error">
            <div className="alert-icon">
              !
            </div>

            <div>
              <strong>
                Unable to load employee
              </strong>

              <p>
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        <div className="page-header">
          <div>
            <button
              type="button"
              className="back-link"
              onClick={() =>
                router.push("/employees")
              }
            >
              ← Employees
            </button>

            <div className="employee-heading">
              <div className="large-avatar">
                {employee.avatar_url ? (
                  <img
                    src={employee.avatar_url}
                    alt={employeeName || "Employee"}
                    className="large-avatar-image"
                  />
                ) : (
                  <User
                    size={24}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div>
                <div className="title-row">
                  <h1>
                    {employeeName}
                  </h1>

                  <span
                    className={`status-badge status-${employee.status || "unknown"}`}
                  >
                    {formatStatus(
                      employee.status
                    )}
                  </span>
                </div>

                <p>
                  {employee.job_title ||
                    "Employee"}
                  {employee.department
                    ? ` · ${employee.department}`
                    : ""}
                  {company?.name
                    ? ` · ${company.name}`
                    : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                loadEmployee(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            {currentUserIsAdmin && (
              <button
                type="button"
                className="button button-primary"
                onClick={() =>
                  router.push(
                    `/employees/${employee.id}/edit`
                  )
                }
              >
                Edit Employee
              </button>
            )}
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">
              Employee Number
            </div>

            <div className="summary-value">
              {employee.employee_number ||
                "—"}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Role
            </div>

            <div className="summary-value">
              {roleName}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              SBS Login
            </div>

            <div className="summary-value">
              {loginStatus}
            </div>

            <div
              className={`summary-sub ${employee.user_id ? "success-text" : ""}`}
            >
              {employee.user_id
                ? "Login account connected"
                : "No login account"}
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">
              Hire Date
            </div>

            <div className="summary-value">
              {formatDate(
                employee.hire_date
              )}
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="main-column">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Personal Information
                  </h2>

                  <p>
                    Employee contact and identity
                    details.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="detail-grid">
                  <DetailItem
                    label="First Name"
                    value={
                      employee.first_name
                    }
                  />

                  <DetailItem
                    label="Last Name"
                    value={
                      employee.last_name
                    }
                  />

                  <DetailItem
                    label="Email"
                    value={
                      employee.email
                    }
                  />

                  <DetailItem
                    label="Phone"
                    value={
                      employee.phone
                    }
                  />

                  <DetailItem
                    label="Employee Number"
                    value={
                      employee.employee_number
                    }
                  />

                  <DetailItem
                    label="Department"
                    value={
                      employee.department
                    }
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Employment
                  </h2>

                  <p>
                    Position and reporting
                    information.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="detail-grid">
                  <DetailItem
                    label="Job Title"
                    value={
                      employee.job_title
                    }
                  />

                  <DetailItem
                    label="Employment Type"
                    value={formatEmploymentType(
                      employee.employment_type
                    )}
                  />

                  <DetailItem
                    label="Status"
                    value={formatStatus(
                      employee.status
                    )}
                  />

                  <DetailItem
                    label="Hire Date"
                    value={formatDate(
                      employee.hire_date
                    )}
                  />

                  <DetailItem
                    label="Manager"
                    value={
                      employee.manager
                        ? employee.manager
                            .display_name ||
                          `${employee.manager.first_name} ${employee.manager.last_name}`
                        : "No Manager"
                    }
                  />

                  <DetailItem
                    label="SBS Role"
                    value={roleName}
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    SBS Access & Permissions
                  </h2>

                  <p>
                    Permissions inherited from
                    the employee role.
                  </p>
                </div>

                <div className="permission-count">
                  {permissions.length} permissions
                </div>
              </div>

              <div className="card-body">
                {permissions.length === 0 ? (
                  <div className="empty-permissions">
                    <div className="empty-icon">
                      —
                    </div>

                    <strong>
                      No permissions assigned
                    </strong>

                    <p>
                      This employee's role
                      currently has no SBS
                      permissions.
                    </p>
                  </div>
                ) : (
                  <div className="permission-list">
                    {Object.entries(
                      groupedPermissions
                    ).map(
                      ([
                        module,
                        modulePermissions,
                      ]) => (
                        <div
                          className="permission-module"
                          key={module}
                        >
                          <div className="permission-module-header">
                            <div>
                              <strong>
                                {MODULE_LABELS[
                                  module
                                ] ||
                                  module}
                              </strong>

                              <span>
                                {
                                  modulePermissions.length
                                }{" "}
                                permission
                                {modulePermissions.length !==
                                1
                                  ? "s"
                                  : ""}
                              </span>
                            </div>
                          </div>

                          <div className="permission-chips">
                            {modulePermissions
                              .sort(
                                (
                                  a,
                                  b
                                ) =>
                                  a.action.localeCompare(
                                    b.action
                                  )
                              )
                              .map(
                                (
                                  permission
                                ) => (
                                  <span
                                    className="permission-chip"
                                    key={
                                      permission.id
                                    }
                                  >
                                    {
                                      ACTION_LABELS[
                                        permission
                                          .action
                                      ] ||
                                        permission.action
                                    }
                                  </span>
                                )
                              )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Emergency Contact
                  </h2>

                  <p>
                    Emergency contact information.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="detail-grid">
                  <DetailItem
                    label="Contact Name"
                    value={
                      employee.emergency_contact_name
                    }
                  />

                  <DetailItem
                    label="Contact Phone"
                    value={
                      employee.emergency_contact_phone
                    }
                  />
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Internal Notes
                  </h2>

                  <p>
                    Private notes associated with
                    this employee.
                  </p>
                </div>
              </div>

              <div className="card-body">
                {employee.notes ? (
                  <div className="notes">
                    {employee.notes}
                  </div>
                ) : (
                  <div className="empty-state">
                    No internal notes have been
                    added.
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="side-column">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    SBS Login
                  </h2>

                  <p>
                    Authentication account status.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="login-status-box">
                  <div
                    className={`login-status-icon ${employee.user_id ? "connected" : "missing"}`}
                  >
                    {employee.user_id
                      ? "✓"
                      : "!"}
                  </div>

                  <div>
                    <strong>
                      {loginStatus}
                    </strong>

                    <p>
                      {isInvited
                        ? "The employee has been invited and must complete the SBS account setup."
                        : employee.user_id
                          ? "This employee has a connected SBS authentication account."
                          : "This employee does not currently have an SBS login account."}
                    </p>
                  </div>
                </div>

                <div className="login-detail">
                  <span>
                    Login Email
                  </span>

                  <strong>
                    {employee.email ||
                      "—"}
                  </strong>
                </div>

                <div className="login-detail">
                  <span>
                    Auth Account
                  </span>

                  <strong className="mono">
                    {employee.user_id
                      ? `${employee.user_id.slice(
                          0,
                          8
                        )}...`
                      : "Not connected"}
                  </strong>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Role
                  </h2>

                  <p>
                    Current SBS permission role.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="role-box">
                  <div className="role-icon">
                    ✓
                  </div>

                  <div>
                    <strong>
                      {roleName}
                    </strong>

                    <p>
                      {employee.employee_roles?.[0]
                        ?.description ||
                        "Permissions for this employee are inherited from this role."}
                    </p>
                  </div>
                </div>

                <div className="role-stat">
                  <span>
                    Total Permissions
                  </span>

                  <strong>
                    {permissions.length}
                  </strong>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Record Information
                  </h2>

                  <p>
                    Employee record timestamps.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="record-row">
                  <span>
                    Created
                  </span>

                  <strong>
                    {formatDateTime(
                      employee.created_at
                    )}
                  </strong>
                </div>

                <div className="record-row">
                  <span>
                    Last Updated
                  </span>

                  <strong>
                    {formatDateTime(
                      employee.updated_at
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="quick-actions">
              <div className="quick-actions-title">
                Quick Actions
              </div>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/employees/${employee.id}/edit`
                  )
                }
                disabled={!currentUserIsAdmin}
              >
                <span>✎</span>
                Edit Employee
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push("/employees")
                }
              >
                <span>←</span>
                Back to Employees
              </button>
            </section>
          </aside>
        </div>

        <style jsx>{`
          .page-content {
            padding: 28px;
            max-width: 1500px;
            margin: 0 auto;
          }

          .alert {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 20px;
            border: 1px solid;
          }

          .alert-error {
            background: #fef2f2;
            border-color: #fecaca;
            color: #991b1b;
          }

          .alert-icon {
            width: 24px;
            height: 24px;
            flex: 0 0 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            font-weight: 700;
          }

          .alert strong {
            display: block;
            font-size: 13px;
            margin-bottom: 3px;
          }

          .alert p {
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
          }

          .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 20px;
            margin-bottom: 24px;
          }

          .back-link {
            border: 0;
            background: transparent;
            padding: 0;
            margin: 0 0 12px;
            color: #64748b;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
          }

          .back-link:hover {
            color: #111827;
          }

          .employee-heading {
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .large-avatar {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: #111827;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            font-size: 16px;
            font-weight: 700;
            flex: 0 0 56px;
          }

          .large-avatar-image {
            width: 100%;
            height: 100%;
            display: block;
            object-fit: cover;
          }

          .title-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
          }

          h1 {
            margin: 0;
            color: #111827;
            font-size: 28px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: -0.02em;
          }

          .employee-heading p {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 14px;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            padding: 0 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 650;
          }

          .status-active {
            background: #ecfdf5;
            color: #047857;
          }

          .status-invited {
            background: #eff6ff;
            color: #1d4ed8;
          }

          .status-inactive,
          .status-terminated {
            background: #fef2f2;
            color: #b91c1c;
          }

          .status-unknown {
            background: #f1f5f9;
            color: #475569;
          }

          .header-actions {
            display: flex;
            gap: 9px;
            flex-shrink: 0;
          }

          .button {
            height: 40px;
            padding: 0 14px;
            border-radius: 9px;
            font-family: inherit;
            font-size: 13px;
            font-weight: 650;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            transition:
              background 0.15s ease,
              border-color 0.15s ease,
              opacity 0.15s ease;
          }

          .button:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }

          .button-secondary {
            color: #374151;
            background: #ffffff;
            border: 1px solid #d1d5db;
          }

          .button-secondary:hover:not(:disabled) {
            background: #f9fafb;
          }

          .button-primary {
            color: #ffffff;
            background: #111827;
            border: 1px solid #111827;
          }

          .button-primary:hover:not(:disabled) {
            background: #1f2937;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 20px;
          }

          .summary-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 18px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
          }

          .summary-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .summary-value {
            color: #111827;
            font-size: 17px;
            line-height: 1.3;
            font-weight: 700;
          }

          .summary-sub {
            margin-top: 5px;
            color: #94a3b8;
            font-size: 11px;
          }

          .success-text {
            color: #059669;
          }

          .content-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 340px;
            gap: 20px;
            align-items: start;
          }

          .main-column,
          .side-column {
            display: flex;
            flex-direction: column;
            gap: 20px;
            min-width: 0;
          }

          .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
            overflow: hidden;
          }

          .card-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 18px 20px;
            border-bottom: 1px solid #e5e7eb;
          }

          .card-header h2 {
            margin: 0;
            color: #111827;
            font-size: 15px;
            line-height: 1.4;
            font-weight: 650;
          }

          .card-header p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .card-body {
            padding: 20px;
          }

          .detail-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
          }

          .detail-item {
            min-width: 0;
          }

          .detail-label {
            color: #64748b;
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 5px;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }

          .detail-value {
            color: #111827;
            font-size: 13px;
            line-height: 1.5;
            word-break: break-word;
          }

          .permission-count {
            white-space: nowrap;
            color: #64748b;
            font-size: 11px;
            font-weight: 600;
            padding: 5px 8px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 7px;
          }

          .permission-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
          }

          .permission-module {
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            overflow: hidden;
          }

          .permission-module-header {
            padding: 11px 13px;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
          }

          .permission-module-header > div {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .permission-module-header strong {
            color: #111827;
            font-size: 13px;
          }

          .permission-module-header span {
            color: #94a3b8;
            font-size: 11px;
          }

          .permission-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
            padding: 12px;
          }

          .permission-chip {
            display: inline-flex;
            align-items: center;
            min-height: 27px;
            padding: 0 9px;
            border-radius: 7px;
            background: #ffffff;
            border: 1px solid #dbe1e8;
            color: #475569;
            font-size: 11px;
            font-weight: 600;
          }

          .empty-permissions {
            padding: 30px 15px;
            text-align: center;
          }

          .empty-icon {
            width: 38px;
            height: 38px;
            margin: 0 auto 10px;
            border-radius: 50%;
            background: #f8fafc;
            color: #94a3b8;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
          }

          .empty-permissions strong {
            color: #374151;
            font-size: 13px;
          }

          .empty-permissions p {
            max-width: 400px;
            margin: 5px auto 0;
            color: #64748b;
            font-size: 12px;
          }

          .empty-state {
            padding: 8px 0;
            color: #94a3b8;
            font-size: 13px;
          }

          .notes {
            white-space: pre-wrap;
            color: #374151;
            font-size: 13px;
            line-height: 1.7;
          }

          .login-status-box {
            display: flex;
            gap: 11px;
            align-items: flex-start;
            padding: 13px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
          }

          .login-status-icon {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
          }

          .login-status-icon.connected {
            background: #ecfdf5;
            color: #059669;
          }

          .login-status-icon.missing {
            background: #fef2f2;
            color: #dc2626;
          }

          .login-status-box strong {
            display: block;
            color: #111827;
            font-size: 13px;
          }

          .login-status-box p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .login-detail {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 12px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .login-detail:last-child {
            border-bottom: 0;
            padding-bottom: 0;
          }

          .login-detail span {
            color: #94a3b8;
            font-size: 11px;
            font-weight: 600;
          }

          .login-detail strong {
            color: #374151;
            font-size: 12px;
            word-break: break-word;
          }

          .mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }

          .role-box {
            display: flex;
            gap: 11px;
            align-items: flex-start;
            padding: 13px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
          }

          .role-icon {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
            border-radius: 8px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            color: #16a34a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
          }

          .role-box strong {
            display: block;
            color: #111827;
            font-size: 13px;
          }

          .role-box p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .role-stat {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1px solid #e5e7eb;
          }

          .role-stat span {
            color: #64748b;
            font-size: 12px;
          }

          .role-stat strong {
            color: #111827;
            font-size: 14px;
          }

          .record-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 11px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .record-row:first-child {
            padding-top: 0;
          }

          .record-row:last-child {
            border-bottom: 0;
            padding-bottom: 0;
          }

          .record-row span {
            color: #94a3b8;
            font-size: 11px;
            font-weight: 600;
          }

          .record-row strong {
            color: #374151;
            font-size: 12px;
            font-weight: 600;
          }

          .quick-actions {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            overflow: hidden;
          }

          .quick-actions-title {
            padding: 14px 16px;
            color: #111827;
            font-size: 13px;
            font-weight: 650;
            border-bottom: 1px solid #e5e7eb;
          }

          .quick-actions button {
            width: 100%;
            min-height: 43px;
            padding: 0 16px;
            display: flex;
            align-items: center;
            gap: 9px;
            border: 0;
            border-bottom: 1px solid #f1f5f9;
            background: #ffffff;
            color: #374151;
            font-family: inherit;
            font-size: 12px;
            font-weight: 600;
            text-align: left;
            cursor: pointer;
          }

          .quick-actions button:last-child {
            border-bottom: 0;
          }

          .quick-actions button:hover:not(:disabled) {
            background: #f8fafc;
          }

          .quick-actions button:disabled {
            color: #cbd5e1;
            cursor: not-allowed;
          }

          .quick-actions button span {
            width: 20px;
            color: #64748b;
            text-align: center;
          }

          @media (max-width: 1200px) {
            .content-grid {
              grid-template-columns: minmax(0, 1fr) 300px;
            }
          }

          @media (max-width: 1000px) {
            .summary-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .content-grid {
              grid-template-columns: 1fr;
            }

            .side-column {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              align-items: start;
            }

            .quick-actions {
              grid-column: 1 / -1;
            }
          }

          @media (max-width: 760px) {
            .page-content {
              padding: 20px 16px;
            }

            .page-header {
              flex-direction: column;
              align-items: stretch;
            }

            .header-actions {
              width: 100%;
            }

            .header-actions .button {
              flex: 1;
            }

            .employee-heading {
              align-items: flex-start;
            }

            h1 {
              font-size: 23px;
            }

            .summary-grid {
              grid-template-columns: 1fr;
            }

            .detail-grid {
              grid-template-columns: 1fr;
              gap: 16px;
            }

            .side-column {
              display: flex;
            }

            .card-header,
            .card-body {
              padding: 16px;
            }

            .permission-module-header > div {
              align-items: flex-start;
              flex-direction: column;
              gap: 3px;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="detail-item">
      <div className="detail-label">
        {label}
      </div>

      <div className="detail-value">
        {value || "—"}
      </div>

      <style jsx>{`
        .detail-item {
          min-width: 0;
        }

        .detail-label {
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .detail-value {
          color: #111827;
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}