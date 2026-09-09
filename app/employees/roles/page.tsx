"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type EmployeeRole = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  employee_count?: number;
};

type Permission = {
  id: string;
  module: string;
  action: string;
};

type RolePermissionRow = {
  permission_id: string;
  employee_permissions:
    | Permission
    | Permission[]
    | null;
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

const SYSTEM_ROLE_NAMES = new Set([
  "Employee",
  "Manager",
  "Company Admin",
]);

function formatModuleName(
  module: string
) {
  return (
    MODULE_LABELS[module] ||
    module
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
}

function formatActionName(
  action: string
) {
  return (
    ACTION_LABELS[action] ||
    action
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
}

export default function EmployeeRolesPage() {
  const router = useRouter();
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [companyId, setCompanyId] =
    useState("");

  const [companyName, setCompanyName] =
    useState("");

  const [roles, setRoles] =
    useState<EmployeeRole[]>([]);

  const [permissions, setPermissions] =
    useState<Permission[]>([]);

  const [selectedRoleId, setSelectedRoleId] =
    useState("");

  const [selectedPermissionIds, setSelectedPermissionIds] =
    useState<Set<string>>(
      new Set()
    );

  const [permissionLoading, setPermissionLoading] =
    useState(false);

  const [showRoleModal, setShowRoleModal] =
    useState(false);

  const [editingRole, setEditingRole] =
    useState<EmployeeRole | null>(null);

  const [roleName, setRoleName] =
    useState("");

  const [roleDescription, setRoleDescription] =
    useState("");

  const [roleSearch, setRoleSearch] =
    useState("");

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        /*
         * =====================================================
         * Current user
         * =====================================================
         */

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

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
         * Company membership
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

        const currentCompanyId =
          membership.company_id;

        setCompanyId(
          currentCompanyId
        );

        /*
         * =====================================================
         * Authorization
         * =====================================================
         */

        const isAdmin =
          membership.role === "owner" ||
          membership.role === "admin";

        if (!isAdmin) {
          const {
            data: hasPermission,
            error: permissionError,
          } = await supabase.rpc(
            "employee_has_permission",
            {
              p_company_id:
                currentCompanyId,
              p_module:
                "employees",
              p_action:
                "manage_roles",
            }
          );

          if (permissionError) {
            throw new Error(
              permissionError.message
            );
          }

          if (!hasPermission) {
            throw new Error(
              "You do not have permission to manage employee roles."
            );
          }
        }

        /*
         * =====================================================
         * Load company
         * =====================================================
         */

        const {
          data: company,
          error: companyError,
        } = await supabase
          .from("companies")
          .select(
            "id, name"
          )
          .eq(
            "id",
            currentCompanyId
          )
          .single();

        if (companyError) {
          throw new Error(
            companyError.message
          );
        }

        /*
         * =====================================================
         * Load roles
         * =====================================================
         */

        const {
          data: roleData,
          error: rolesError,
        } = await supabase
          .from("employee_roles")
          .select(
            `
              id,
              company_id,
              name,
              description
            `
          )
          .eq(
            "company_id",
            currentCompanyId
          )
          .order("name");

        if (rolesError) {
          throw new Error(
            rolesError.message
          );
        }

        /*
         * =====================================================
         * Load permission catalog
         * =====================================================
         */

        const {
          data: permissionData,
          error: permissionsError,
        } = await supabase
          .from(
            "employee_permissions"
          )
          .select(
            "id, module, action"
          )
          .order("module")
          .order("action");

        if (permissionsError) {
          throw new Error(
            permissionsError.message
          );
        }

        /*
         * =====================================================
         * Employee counts
         * =====================================================
         */

        const {
          data: employeeData,
          error: employeesError,
        } = await supabase
          .from("employees")
          .select(
            "id, role_id"
          )
          .eq(
            "company_id",
            currentCompanyId
          );

        if (employeesError) {
          throw new Error(
            employeesError.message
          );
        }

        const employeeCounts =
          new Map<string, number>();

        for (
          const employee
          of employeeData || []
        ) {
          if (!employee.role_id) {
            continue;
          }

          employeeCounts.set(
            employee.role_id,
            (employeeCounts.get(
              employee.role_id
            ) || 0) + 1
          );
        }

        const rolesWithCounts =
          (roleData || []).map(
            (role) => ({
              ...role,
              employee_count:
                employeeCounts.get(
                  role.id
                ) || 0,
            })
          );

        setCompanyName(
          company.name
        );

        setRoles(
          rolesWithCounts
        );

        setPermissions(
          permissionData || []
        );

        /*
         * Preserve selected role if possible.
         */

        setSelectedRoleId(
          (currentSelected) => {
            if (
              currentSelected &&
              rolesWithCounts.some(
                (role) =>
                  role.id ===
                  currentSelected
              )
            ) {
              return currentSelected;
            }

            return (
              rolesWithCounts[0]?.id ||
              ""
            );
          }
        );
      } catch (error) {
        console.error(
          "Employee roles load error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load employee roles."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  const loadRolePermissions =
    useCallback(
      async (roleId: string) => {
        if (!roleId) {
          setSelectedPermissionIds(
            new Set()
          );
          return;
        }

        setPermissionLoading(
          true
        );

        try {
          const {
            data,
            error,
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
              roleId
            );

          if (error) {
            throw new Error(
              error.message
            );
          }

          const ids =
            new Set<string>();

          for (
            const row of
              (data ||
                []) as RolePermissionRow[]
          ) {
            if (
              row.permission_id
            ) {
              ids.add(
                row.permission_id
              );
            }
          }

          setSelectedPermissionIds(
            ids
          );
        } catch (error) {
          console.error(
            "Role permission load error:",
            error
          );

          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load role permissions."
          );
        } finally {
          setPermissionLoading(
            false
          );
        }
      },
      [supabase]
    );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedRoleId) {
      loadRolePermissions(
        selectedRoleId
      );
    }
  }, [
    selectedRoleId,
    loadRolePermissions,
  ]);

  const filteredRoles =
    useMemo(() => {
      const query =
        roleSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return roles;
      }

      return roles.filter(
        (role) =>
          role.name
            .toLowerCase()
            .includes(query) ||
          role.description
            ?.toLowerCase()
            .includes(query)
      );
    }, [roles, roleSearch]);

  const groupedPermissions =
    useMemo(() => {
      const grouped: Record<
        string,
        Permission[]
      > = {};

      for (const permission of permissions) {
        if (
          !grouped[
            permission.module
          ]
        ) {
          grouped[
            permission.module
          ] = [];
        }

        grouped[
          permission.module
        ].push(permission);
      }

      return grouped;
    }, [permissions]);

  const selectedRole =
    roles.find(
      (role) =>
        role.id ===
        selectedRoleId
    ) || null;

  const totalPermissionCount =
    selectedPermissionIds.size;

  const totalModules =
    Object.keys(
      groupedPermissions
    ).length;

  const selectedModuleCount =
    Object.entries(
      groupedPermissions
    ).filter(
      ([, modulePermissions]) =>
        modulePermissions.some(
          (permission) =>
            selectedPermissionIds.has(
              permission.id
            )
        )
    ).length;

  function openCreateModal() {
    setEditingRole(null);
    setRoleName("");
    setRoleDescription("");
    setShowRoleModal(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function openEditModal(
    role: EmployeeRole
  ) {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(
      role.description || ""
    );
    setShowRoleModal(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSaveRole() {
    const trimmedName =
      roleName.trim();

    const trimmedDescription =
      roleDescription.trim();

    if (!trimmedName) {
      setErrorMessage(
        "Role name is required."
      );
      return;
    }

    if (!companyId) {
      setErrorMessage(
        "Company information is unavailable."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (editingRole) {
        const {
          error,
        } = await supabase
          .from("employee_roles")
          .update({
            name: trimmedName,
            description:
              trimmedDescription ||
              null,
          })
          .eq(
            "id",
            editingRole.id
          )
          .eq(
            "company_id",
            companyId
          );

        if (error) {
          if (
            error.code ===
            "23505"
          ) {
            throw new Error(
              "A role with this name already exists."
            );
          }

          throw new Error(
            error.message
          );
        }

        setSuccessMessage(
          "Employee role updated successfully."
        );
      } else {
        const {
          data: createdRole,
          error,
        } = await supabase
          .from("employee_roles")
          .insert({
            company_id:
              companyId,
            name: trimmedName,
            description:
              trimmedDescription ||
              null,
          })
          .select(
            `
              id,
              company_id,
              name,
              description
            `
          )
          .single();

        if (error) {
          if (
            error.code ===
            "23505"
          ) {
            throw new Error(
              "A role with this name already exists."
            );
          }

          throw new Error(
            error.message
          );
        }

        setSelectedRoleId(
          createdRole.id
        );

        setSuccessMessage(
          "Employee role created successfully."
        );
      }

      setShowRoleModal(false);

      await loadData(true);
    } catch (error) {
      console.error(
        "Role save error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save employee role."
      );
    } finally {
      setSaving(false);
    }
  }

  function togglePermission(
    permissionId: string
  ) {
    setSelectedPermissionIds(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(permissionId)
        ) {
          next.delete(
            permissionId
          );
        } else {
          next.add(
            permissionId
          );
        }

        return next;
      }
    );
  }

  function toggleModule(
    module: string
  ) {
    const modulePermissions =
      groupedPermissions[
        module
      ] || [];

    const allSelected =
      modulePermissions.length >
        0 &&
      modulePermissions.every(
        (permission) =>
          selectedPermissionIds.has(
            permission.id
          )
      );

    setSelectedPermissionIds(
      (current) => {
        const next =
          new Set(current);

        for (
          const permission of
            modulePermissions
        ) {
          if (allSelected) {
            next.delete(
              permission.id
            );
          } else {
            next.add(
              permission.id
            );
          }
        }

        return next;
      }
    );
  }

  async function handleSavePermissions() {
    if (!selectedRoleId) {
      setErrorMessage(
        "Please select a role first."
      );
      return;
    }

    if (!companyId) {
      setErrorMessage(
        "Company information is unavailable."
      );
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      /*
       * We delete the role's existing permission
       * mappings and recreate them from the current
       * selection.
       *
       * The database RLS policy still determines
       * whether the authenticated user is allowed
       * to perform these operations.
       */

      const {
        error: deleteError,
      } = await supabase
        .from(
          "employee_role_permissions"
        )
        .delete()
        .eq(
          "role_id",
          selectedRoleId
        );

      if (deleteError) {
        throw new Error(
          deleteError.message
        );
      }

      if (
        selectedPermissionIds.size >
        0
      ) {
        const rows =
          Array.from(
            selectedPermissionIds
          ).map(
            (permissionId) => ({
              role_id:
                selectedRoleId,
              permission_id:
                permissionId,
            })
          );

        const {
          error: insertError,
        } = await supabase
          .from(
            "employee_role_permissions"
          )
          .insert(rows);

        if (insertError) {
          throw new Error(
            insertError.message
          );
        }
      }

      setSuccessMessage(
        "Role permissions saved successfully."
      );

      await loadRolePermissions(
        selectedRoleId
      );
    } catch (error) {
      console.error(
        "Role permission save error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save role permissions."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRole(
    role: EmployeeRole
  ) {
    const isSystemRole =
      SYSTEM_ROLE_NAMES.has(
        role.name
      );

    if (isSystemRole) {
      setErrorMessage(
        "System roles cannot be deleted."
      );
      return;
    }

    if (
      (role.employee_count || 0) >
      0
    ) {
      setErrorMessage(
        `This role is assigned to ${role.employee_count} employee${role.employee_count === 1 ? "" : "s"}. Reassign those employees before deleting the role.`
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete the "${role.name}" role? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      /*
       * Remove permission mappings first.
       */

      const {
        error: permissionDeleteError,
      } = await supabase
        .from(
          "employee_role_permissions"
        )
        .delete()
        .eq(
          "role_id",
          role.id
        );

      if (
        permissionDeleteError
      ) {
        throw new Error(
          permissionDeleteError.message
        );
      }

      const {
        error: roleDeleteError,
      } = await supabase
        .from("employee_roles")
        .delete()
        .eq(
          "id",
          role.id
        )
        .eq(
          "company_id",
          companyId
        );

      if (roleDeleteError) {
        throw new Error(
          roleDeleteError.message
        );
      }

      if (
        selectedRoleId ===
        role.id
      ) {
        setSelectedRoleId("");
        setSelectedPermissionIds(
          new Set()
        );
      }

      setSuccessMessage(
        "Employee role deleted successfully."
      );

      await loadData(true);
    } catch (error) {
      console.error(
        "Role delete error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete employee role."
      );
    } finally {
      setSaving(false);
    }
  }

  function selectRole(
    roleId: string
  ) {
    if (
      roleId ===
      selectedRoleId
    ) {
      return;
    }

    setSelectedRoleId(
      roleId
    );

    setErrorMessage("");
    setSuccessMessage("");
  }

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="loading-card">
            <div className="spinner" />

            <p>
              Loading roles & permissions...
            </p>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .loading-card {
              min-height: 400px;
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

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-header">
          <div>
            <button
              type="button"
              className="back-link"
              onClick={() =>
                router.push(
                  "/employees"
                )
              }
            >
              ← Employees
            </button>

            <h1>
              Roles & Permissions
            </h1>

            <p>
              Control which SBS modules and
              actions employees can access.
              {companyName
                ? ` · ${companyName}`
                : ""}
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                loadData(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={
                openCreateModal
              }
            >
              + Create Role
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            <div className="alert-icon">
              !
            </div>

            <div>
              <strong>
                Action failed
              </strong>

              <p>
                {errorMessage}
              </p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <div className="alert-icon">
              ✓
            </div>

            <div>
              <strong>
                Success
              </strong>

              <p>
                {successMessage}
              </p>
            </div>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Roles
            </div>

            <div className="stat-value">
              {roles.length}
            </div>

            <div className="stat-sub">
              Company employee roles
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              System Roles
            </div>

            <div className="stat-value">
              {
                roles.filter(
                  (role) =>
                    SYSTEM_ROLE_NAMES.has(
                      role.name
                    )
                ).length
              }
            </div>

            <div className="stat-sub">
              Built-in SBS roles
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Custom Roles
            </div>

            <div className="stat-value">
              {
                roles.filter(
                  (role) =>
                    !SYSTEM_ROLE_NAMES.has(
                      role.name
                    )
                ).length
              }
            </div>

            <div className="stat-sub">
              Company-created roles
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Permission Catalog
            </div>

            <div className="stat-value">
              {permissions.length}
            </div>

            <div className="stat-sub">
              Available permissions
            </div>
          </div>
        </div>

        <div className="workspace">
          <section className="roles-panel">
            <div className="panel-header">
              <div>
                <h2>
                  Employee Roles
                </h2>

                <p>
                  Select a role to manage its
                  permissions.
                </p>
              </div>
            </div>

            <div className="role-search">
              <input
                value={roleSearch}
                onChange={(event) =>
                  setRoleSearch(
                    event.target.value
                  )
                }
                placeholder="Search roles..."
              />
            </div>

            <div className="role-list">
              {filteredRoles.length ===
              0 ? (
                <div className="empty-list">
                  <div className="empty-icon">
                    —
                  </div>

                  <strong>
                    No roles found
                  </strong>

                  <p>
                    Create a role to get
                    started.
                  </p>
                </div>
              ) : (
                filteredRoles.map(
                  (role) => {
                    const selected =
                      role.id ===
                      selectedRoleId;

                    const isSystemRole =
                      SYSTEM_ROLE_NAMES.has(
                        role.name
                      );

                    return (
                      <div
                        key={role.id}
                        className={`role-item ${
                          selected
                            ? "selected"
                            : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="role-select"
                          onClick={() =>
                            selectRole(
                              role.id
                            )
                          }
                        >
                          <div className="role-icon">
                            {role.name
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </div>

                          <div className="role-content">
                            <div className="role-title-row">
                              <strong>
                                {
                                  role.name
                                }
                              </strong>

                              {isSystemRole && (
                                <span className="system-badge">
                                  System
                                </span>
                              )}
                            </div>

                            <p>
                              {role.description ||
                                "No description"}
                            </p>

                            <span className="employee-count">
                              {
                                role.employee_count
                              }{" "}
                              employee
                              {role.employee_count !==
                              1
                                ? "s"
                                : ""}
                            </span>
                          </div>
                        </button>

                        <div className="role-actions">
                          <button
                            type="button"
                            className="icon-button"
                            title="Edit role"
                            onClick={() =>
                              openEditModal(
                                role
                              )
                            }
                          >
                            ✎
                          </button>

                          {!isSystemRole && (
                            <button
                              type="button"
                              className="icon-button danger"
                              title="Delete role"
                              onClick={() =>
                                handleDeleteRole(
                                  role
                                )
                              }
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </section>

          <section className="permissions-panel">
            <div className="panel-header permission-header">
              <div>
                <h2>
                  {selectedRole
                    ? selectedRole.name
                    : "Permissions"}
                </h2>

                <p>
                  {selectedRole
                    ? "Configure the modules and actions available to this role."
                    : "Select a role to manage permissions."}
                </p>
              </div>

              {selectedRole && (
                <div className="permission-summary">
                  <div>
                    <strong>
                      {
                        totalPermissionCount
                      }
                    </strong>

                    <span>
                      Permissions
                    </span>
                  </div>

                  <div>
                    <strong>
                      {
                        selectedModuleCount
                      }
                    </strong>

                    <span>
                      Modules
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!selectedRole ? (
              <div className="empty-permissions">
                <div className="empty-icon large">
                  ✓
                </div>

                <h3>
                  Select an employee role
                </h3>

                <p>
                  Choose a role from the left to
                  view and configure its SBS
                  permissions.
                </p>
              </div>
            ) : permissionLoading ? (
              <div className="permission-loading">
                <div className="spinner" />

                <p>
                  Loading permissions...
                </p>
              </div>
            ) : (
              <>
                <div className="permission-toolbar">
                  <div>
                    <span>
                      {totalModules} modules
                    </span>

                    <span>
                      ·
                    </span>

                    <span>
                      {permissions.length} available
                      permissions
                    </span>
                  </div>

                  <button
                    type="button"
                    className="button button-primary"
                    onClick={
                      handleSavePermissions
                    }
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Permissions"}
                  </button>
                </div>

                <div className="permission-grid">
                  {Object.entries(
                    groupedPermissions
                  ).map(
                    ([
                      module,
                      modulePermissions,
                    ]) => {
                      const selectedCount =
                        modulePermissions.filter(
                          (
                            permission
                          ) =>
                            selectedPermissionIds.has(
                              permission.id
                            )
                        ).length;

                      const allSelected =
                        modulePermissions.length >
                          0 &&
                        selectedCount ===
                          modulePermissions.length;

                      const someSelected =
                        selectedCount >
                          0 &&
                        !allSelected;

                      return (
                        <div
                          className="permission-module"
                          key={module}
                        >
                          <div className="module-header">
                            <div>
                              <div className="module-title-row">
                                <div className="module-icon">
                                  {formatModuleName(
                                    module
                                  )
                                    .charAt(
                                      0
                                    )
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <strong>
                                    {formatModuleName(
                                      module
                                    )}
                                  </strong>

                                  <span>
                                    {
                                      selectedCount
                                    }{" "}
                                    /{" "}
                                    {
                                      modulePermissions.length
                                    }{" "}
                                    selected
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`module-toggle ${
                                allSelected
                                  ? "checked"
                                  : someSelected
                                    ? "partial"
                                    : ""
                              }`}
                              onClick={() =>
                                toggleModule(
                                  module
                                )
                              }
                              aria-label={`Toggle all ${formatModuleName(
                                module
                              )} permissions`}
                            >
                              {allSelected
                                ? "✓"
                                : someSelected
                                  ? "−"
                                  : ""}
                            </button>
                          </div>

                          <div className="permission-options">
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
                                ) => {
                                  const checked =
                                    selectedPermissionIds.has(
                                      permission.id
                                    );

                                  return (
                                    <label
                                      className={`permission-option ${
                                        checked
                                          ? "checked"
                                          : ""
                                      }`}
                                      key={
                                        permission.id
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          checked
                                        }
                                        onChange={() =>
                                          togglePermission(
                                            permission.id
                                          )
                                        }
                                      />

                                      <span className="custom-checkbox">
                                        {checked
                                          ? "✓"
                                          : ""}
                                      </span>

                                      <span className="permission-label">
                                        {formatActionName(
                                          permission.action
                                        )}
                                      </span>
                                    </label>
                                  );
                                }
                              )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {showRoleModal && (
          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowRoleModal(false);
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <div>
                  <h2>
                    {editingRole
                      ? "Edit Employee Role"
                      : "Create Employee Role"}
                  </h2>

                  <p>
                    Define a role for controlling
                    SBS module access.
                  </p>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setShowRoleModal(
                      false
                    )
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="field">
                  <label htmlFor="roleName">
                    Role Name{" "}
                    <span>*</span>
                  </label>

                  <input
                    id="roleName"
                    value={roleName}
                    onChange={(event) =>
                      setRoleName(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Sales Manager"
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label htmlFor="roleDescription">
                    Description
                  </label>

                  <textarea
                    id="roleDescription"
                    value={
                      roleDescription
                    }
                    onChange={(event) =>
                      setRoleDescription(
                        event.target.value
                      )
                    }
                    placeholder="Describe what this role is responsible for..."
                    rows={4}
                  />
                </div>

                {editingRole &&
                  SYSTEM_ROLE_NAMES.has(
                    editingRole.name
                  ) && (
                    <div className="system-warning">
                      <strong>
                        System role
                      </strong>

                      <span>
                        This is a built-in SBS role.
                        Its name can be changed, but
                        the role cannot be deleted.
                      </span>
                    </div>
                  )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() =>
                    setShowRoleModal(
                      false
                    )
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="button button-primary"
                  onClick={
                    handleSaveRole
                  }
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingRole
                      ? "Save Role"
                      : "Create Role"}
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .page-content {
            padding: 28px;
            max-width: 1600px;
            margin: 0 auto;
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
            margin: 0 0 10px;
            color: #64748b;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
          }

          .back-link:hover {
            color: #111827;
          }

          h1 {
            margin: 0;
            color: #111827;
            font-size: 28px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: -0.02em;
          }

          .page-header p {
            margin: 7px 0 0;
            color: #64748b;
            font-size: 14px;
          }

          .header-actions {
            display: flex;
            gap: 9px;
          }

          .button {
            height: 40px;
            padding: 0 14px;
            border-radius: 9px;
            border: 1px solid transparent;
            font-family: inherit;
            font-size: 13px;
            font-weight: 650;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            white-space: nowrap;
          }

          .button:disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }

          .button-primary {
            background: #111827;
            color: #ffffff;
            border-color: #111827;
          }

          .button-primary:hover:not(:disabled) {
            background: #1f2937;
          }

          .button-secondary {
            background: #ffffff;
            color: #374151;
            border-color: #d1d5db;
          }

          .button-secondary:hover:not(:disabled) {
            background: #f9fafb;
          }

          .alert {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            padding: 14px 16px;
            margin-bottom: 20px;
            border: 1px solid;
            border-radius: 12px;
          }

          .alert-error {
            background: #fef2f2;
            border-color: #fecaca;
            color: #991b1b;
          }

          .alert-success {
            background: #f0fdf4;
            border-color: #bbf7d0;
            color: #166534;
          }

          .alert-icon {
            width: 24px;
            height: 24px;
            flex: 0 0 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            font-weight: 700;
          }

          .alert strong {
            display: block;
            margin-bottom: 3px;
            font-size: 13px;
          }

          .alert p {
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 20px;
          }

          .stat-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 17px 18px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
          }

          .stat-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 8px;
          }

          .stat-value {
            color: #111827;
            font-size: 23px;
            line-height: 1.2;
            font-weight: 700;
          }

          .stat-sub {
            margin-top: 5px;
            color: #94a3b8;
            font-size: 11px;
          }

          .workspace {
            display: grid;
            grid-template-columns: 350px minmax(0, 1fr);
            gap: 20px;
            align-items: start;
          }

          .roles-panel,
          .permissions-panel {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
            overflow: hidden;
            min-width: 0;
          }

          .panel-header {
            padding: 18px 20px;
            border-bottom: 1px solid #e5e7eb;
          }

          .panel-header h2 {
            margin: 0;
            color: #111827;
            font-size: 15px;
            font-weight: 650;
          }

          .panel-header p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .role-search {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
          }

          .role-search input {
            width: 100%;
            height: 39px;
            box-sizing: border-box;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            padding: 0 11px;
            color: #111827;
            font-family: inherit;
            font-size: 13px;
            outline: none;
          }

          .role-search input:focus {
            border-color: #94a3b8;
            box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.14);
          }

          .role-list {
            max-height: 720px;
            overflow-y: auto;
          }

          .role-item {
            display: flex;
            align-items: stretch;
            border-bottom: 1px solid #f1f5f9;
            transition: background 0.15s ease;
          }

          .role-item:last-child {
            border-bottom: 0;
          }

          .role-item.selected {
            background: #f8fafc;
          }

          .role-select {
            min-width: 0;
            flex: 1;
            display: flex;
            gap: 11px;
            align-items: flex-start;
            padding: 15px 12px 15px 15px;
            border: 0;
            background: transparent;
            color: inherit;
            text-align: left;
            cursor: pointer;
          }

          .role-select:hover {
            background: #f8fafc;
          }

          .role-icon {
            width: 36px;
            height: 36px;
            flex: 0 0 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 9px;
            background: #f1f5f9;
            color: #475569;
            font-size: 13px;
            font-weight: 700;
          }

          .role-item.selected .role-icon {
            background: #111827;
            color: #ffffff;
          }

          .role-content {
            min-width: 0;
          }

          .role-title-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
          }

          .role-content strong {
            color: #111827;
            font-size: 13px;
          }

          .role-content p {
            margin: 4px 0 5px;
            color: #64748b;
            font-size: 11px;
            line-height: 1.45;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .employee-count {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 600;
          }

          .system-badge {
            padding: 3px 6px;
            border-radius: 5px;
            background: #f1f5f9;
            color: #64748b;
            font-size: 9px;
            font-weight: 650;
          }

          .role-actions {
            display: flex;
            align-items: center;
            gap: 3px;
            padding: 0 8px 0 0;
          }

          .icon-button {
            width: 29px;
            height: 29px;
            border: 1px solid #e5e7eb;
            border-radius: 7px;
            background: #ffffff;
            color: #64748b;
            cursor: pointer;
            font-size: 13px;
          }

          .icon-button:hover {
            background: #f8fafc;
            color: #111827;
          }

          .icon-button.danger:hover {
            color: #dc2626;
            border-color: #fecaca;
            background: #fef2f2;
          }

          .permission-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 15px;
          }

          .permission-summary {
            display: flex;
            gap: 18px;
          }

          .permission-summary > div {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
          }

          .permission-summary strong {
            color: #111827;
            font-size: 16px;
          }

          .permission-summary span {
            color: #94a3b8;
            font-size: 10px;
            margin-top: 2px;
          }

          .permission-toolbar {
            min-height: 62px;
            padding: 11px 16px 11px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            border-bottom: 1px solid #e5e7eb;
            background: #fafafa;
          }

          .permission-toolbar > div {
            display: flex;
            gap: 6px;
            color: #94a3b8;
            font-size: 11px;
          }

          .permission-grid {
            padding: 18px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 15px;
          }

          .permission-module {
            border: 1px solid #e5e7eb;
            border-radius: 11px;
            overflow: hidden;
          }

          .module-header {
            min-height: 57px;
            padding: 10px 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
          }

          .module-title-row {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .module-icon {
            width: 31px;
            height: 31px;
            flex: 0 0 31px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            color: #475569;
            font-size: 11px;
            font-weight: 700;
          }

          .module-title-row strong {
            display: block;
            color: #111827;
            font-size: 12px;
          }

          .module-title-row span {
            display: block;
            margin-top: 2px;
            color: #94a3b8;
            font-size: 9px;
          }

          .module-toggle {
            width: 26px;
            height: 26px;
            flex: 0 0 26px;
            border: 1px solid #d1d5db;
            border-radius: 7px;
            background: #ffffff;
            color: #64748b;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
          }

          .module-toggle:hover {
            border-color: #94a3b8;
          }

          .module-toggle.checked {
            background: #111827;
            border-color: #111827;
            color: #ffffff;
          }

          .module-toggle.partial {
            background: #f1f5f9;
            color: #475569;
          }

          .permission-options {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            padding: 10px;
            gap: 6px;
          }

          .permission-option {
            min-height: 34px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 0 8px;
            border: 1px solid transparent;
            border-radius: 7px;
            cursor: pointer;
            transition:
              background 0.12s ease,
              border-color 0.12s ease;
          }

          .permission-option:hover {
            background: #f8fafc;
            border-color: #e5e7eb;
          }

          .permission-option.checked {
            background: #f8fafc;
            border-color: #e2e8f0;
          }

          .permission-option input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
          }

          .custom-checkbox {
            width: 16px;
            height: 16px;
            flex: 0 0 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            background: #ffffff;
            color: #ffffff;
            font-size: 9px;
            font-weight: 700;
          }

          .permission-option.checked .custom-checkbox {
            background: #111827;
            border-color: #111827;
          }

          .permission-label {
            color: #475569;
            font-size: 11px;
            font-weight: 550;
          }

          .empty-list,
          .empty-permissions {
            min-height: 300px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 30px;
          }

          .empty-permissions {
            min-height: 430px;
          }

          .empty-icon {
            width: 38px;
            height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
            border-radius: 50%;
            background: #f8fafc;
            color: #94a3b8;
            font-weight: 700;
          }

          .empty-icon.large {
            width: 48px;
            height: 48px;
            color: #64748b;
            font-size: 17px;
          }

          .empty-list strong,
          .empty-permissions h3 {
            color: #374151;
            font-size: 13px;
            margin: 0;
          }

          .empty-permissions h3 {
            font-size: 15px;
          }

          .empty-list p,
          .empty-permissions p {
            max-width: 420px;
            margin: 5px 0 0;
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.5;
          }

          .permission-loading {
            min-height: 430px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #64748b;
            gap: 13px;
          }

          .permission-loading p {
            margin: 0;
            font-size: 13px;
          }

          .permission-loading .spinner {
            width: 27px;
            height: 27px;
            border: 3px solid #e5e7eb;
            border-top-color: #111827;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .modal-overlay {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(15, 23, 42, 0.38);
          }

          .modal {
            width: 100%;
            max-width: 500px;
            background: #ffffff;
            border-radius: 14px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
            overflow: hidden;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding: 19px 20px;
            border-bottom: 1px solid #e5e7eb;
          }

          .modal-header h2 {
            margin: 0;
            color: #111827;
            font-size: 16px;
          }

          .modal-header p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          .modal-close {
            width: 30px;
            height: 30px;
            border: 0;
            border-radius: 7px;
            background: #f8fafc;
            color: #64748b;
            font-size: 20px;
            line-height: 1;
            cursor: pointer;
          }

          .modal-close:hover {
            background: #f1f5f9;
            color: #111827;
          }

          .modal-body {
            padding: 20px;
          }

          .field + .field {
            margin-top: 17px;
          }

          .field label {
            display: block;
            margin-bottom: 7px;
            color: #374151;
            font-size: 12px;
            font-weight: 600;
          }

          .field label span {
            color: #dc2626;
          }

          .field input,
          .field textarea {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #ffffff;
            color: #111827;
            font-family: inherit;
            font-size: 13px;
            outline: none;
          }

          .field input {
            height: 41px;
            padding: 0 11px;
          }

          .field textarea {
            padding: 10px 11px;
            resize: vertical;
            line-height: 1.5;
          }

          .field input:focus,
          .field textarea:focus {
            border-color: #94a3b8;
            box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.14);
          }

          .system-warning {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 17px;
            padding: 11px 12px;
            border-left: 3px solid #cbd5e1;
            background: #f8fafc;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .system-warning strong {
            color: #374151;
            font-size: 11px;
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 9px;
            padding: 15px 20px;
            border-top: 1px solid #e5e7eb;
            background: #fafafa;
          }

          @media (max-width: 1250px) {
            .workspace {
              grid-template-columns: 300px minmax(0, 1fr);
            }

            .permission-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 950px) {
            .stats-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .workspace {
              grid-template-columns: 1fr;
            }

            .role-list {
              max-height: none;
            }
          }

          @media (max-width: 700px) {
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

            h1 {
              font-size: 24px;
            }

            .stats-grid {
              grid-template-columns: 1fr;
            }

            .permission-options {
              grid-template-columns: 1fr;
            }

            .permission-header {
              flex-direction: column;
            }

            .permission-summary {
              align-self: stretch;
              justify-content: space-between;
            }

            .permission-summary > div {
              align-items: flex-start;
            }

            .permission-toolbar {
              align-items: stretch;
              flex-direction: column;
            }

            .permission-toolbar .button {
              width: 100%;
            }

            .modal-actions {
              flex-direction: column-reverse;
            }

            .modal-actions .button {
              width: 100%;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}