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
  name: string;
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
  status: string;
  hire_date: string | null;
  manager_id: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee_roles: EmployeeRole[] | null;
};

type Company = {
  id: string;
  name: string;
};

const EMPLOYEE_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Terminated" },
];

function formatEmploymentType(value: string | null) {
  if (!value) return "—";

  return value
    .split("_")
    .map(
      (part) =>
        part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getEmployeeName(employee: Employee) {
  return (
    employee.display_name ||
    `${employee.first_name} ${employee.last_name}`.trim() ||
    "Unnamed Employee"
  );
}

function getInitials(employee: Employee) {
  const first =
    employee.first_name?.trim().charAt(0) || "";
  const last =
    employee.last_name?.trim().charAt(0) || "";

  return (
    `${first}${last}`.toUpperCase() || "E"
  );
}

function getRoleName(employee: Employee) {
  return employee.employee_roles?.[0]?.name || "Employee";
}

function getStatusLabel(status: string) {
  const found = EMPLOYEE_STATUSES.find(
    (item) => item.value === status
  );

  return found?.label || status;
}

export default function EmployeesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [company, setCompany] = useState<Company | null>(
    null
  );

  const [employees, setEmployees] = useState<Employee[]>(
    []
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [departmentFilter, setDepartmentFilter] =
    useState("all");
  const [roleFilter, setRoleFilter] =
    useState("all");

  const loadEmployees = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          router.push("/login");
          return;
        }

        const { data: membership, error: membershipError } =
          await supabase
            .from("company_members")
            .select("company_id")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

        if (membershipError) {
          throw new Error(membershipError.message);
        }

        if (!membership?.company_id) {
          throw new Error(
            "No company membership was found for your account."
          );
        }

        const companyId = membership.company_id;

        const [
          { data: companyData, error: companyError },
          {
            data: employeeData,
            error: employeeError,
          },
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("id, name")
            .eq("id", companyId)
            .single(),

          supabase
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
                  name
                )
              `
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (companyError) {
          throw new Error(companyError.message);
        }

        if (employeeError) {
          throw new Error(employeeError.message);
        }

        setCompany(companyData);

        /*
         * Supabase returns employee_roles as an array
         * for this relationship. We normalize the result
         * into the Employee type instead of using
         * "as unknown as Employee[]".
         */
        const normalizedEmployees: Employee[] = (
          employeeData || []
        ).map((employee) => ({
          ...employee,
          employee_roles:
            employee.employee_roles || [],
        }));

        setEmployees(normalizedEmployees);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load employees."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const departments = useMemo(() => {
    const values = employees
      .map((employee) => employee.department?.trim())
      .filter(Boolean) as string[];

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [employees]);

  const roles = useMemo(() => {
    const values = employees
      .map((employee) => getRoleName(employee))
      .filter(Boolean);

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [employees]);

  const stats = useMemo(() => {
    const total = employees.length;

    const active = employees.filter(
      (employee) => employee.status === "active"
    ).length;

    const invited = employees.filter(
      (employee) => employee.status === "invited"
    ).length;

    const inactive = employees.filter(
      (employee) =>
        employee.status === "inactive" ||
        employee.status === "terminated"
    ).length;

    const departmentCount = new Set(
      employees
        .map((employee) => employee.department?.trim())
        .filter(Boolean)
    ).size;

    const withLogin = employees.filter(
      (employee) => Boolean(employee.user_id)
    ).length;

    return {
      total,
      active,
      invited,
      inactive,
      departmentCount,
      withLogin,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      const employeeName =
        getEmployeeName(employee).toLowerCase();

      const email =
        employee.email?.toLowerCase() || "";

      const employeeNumber =
        employee.employee_number?.toLowerCase() || "";

      const jobTitle =
        employee.job_title?.toLowerCase() || "";

      const department =
        employee.department?.toLowerCase() || "";

      const role =
        getRoleName(employee).toLowerCase();

      const matchesSearch =
        !query ||
        employeeName.includes(query) ||
        email.includes(query) ||
        employeeNumber.includes(query) ||
        jobTitle.includes(query) ||
        department.includes(query) ||
        role.includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        employee.status === statusFilter;

      const matchesDepartment =
        departmentFilter === "all" ||
        employee.department === departmentFilter;

      const matchesRole =
        roleFilter === "all" ||
        getRoleName(employee) === roleFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepartment &&
        matchesRole
      );
    });
  }, [
    employees,
    search,
    statusFilter,
    departmentFilter,
    roleFilter,
  ]);

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="loading-state">
            <div className="spinner" />
            <p>Loading employees...</p>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .loading-state {
              min-height: 420px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 14px;
              color: #64748b;
              font-size: 14px;
            }

            .loading-state p {
              margin: 0;
            }

            .spinner {
              width: 30px;
              height: 30px;
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
            <h1>Employees</h1>
            <p>
              Manage your team, SBS access, roles and
              employee records.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => loadEmployees(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="small-spinner" />
                  Refreshing
                </>
              ) : (
                <>
                  <span>↻</span>
                  Refresh
                </>
              )}
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                router.push("/employees/roles")
              }
            >
              Manage Roles
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                router.push("/employees/new")
              }
            >
              <span>+</span>
              Add Employee
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="error-card">
            <div className="error-icon">!</div>
            <div>
              <strong>Unable to load employees</strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={() => loadEmployees()}
            >
              Try Again
            </button>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Employees
            </div>

            <div className="stat-value">
              {stats.total}
            </div>

            <div className="stat-meta">
              All employee records
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Active Employees
            </div>

            <div className="stat-value">
              {stats.active}
            </div>

            <div className="stat-meta">
              Currently active
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Pending Invites
            </div>

            <div className="stat-value">
              {stats.invited}
            </div>

            <div className="stat-meta">
              Awaiting account setup
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Inactive Employees
            </div>

            <div className="stat-value">
              {stats.inactive}
            </div>

            <div className="stat-meta">
              Inactive or terminated
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Departments
            </div>

            <div className="stat-value">
              {stats.departmentCount}
            </div>

            <div className="stat-meta">
              Departments represented
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Employees With Login
            </div>

            <div className="stat-value">
              {stats.withLogin}
            </div>

            <div className="stat-meta">
              SBS accounts connected
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="content-header">
            <div>
              <h2>Employee Directory</h2>

              <p>
                {company?.name
                  ? `Employees for ${company.name}`
                  : "Manage your company employees"}
              </p>
            </div>

            <div className="result-count">
              {filteredEmployees.length}{" "}
              {filteredEmployees.length === 1
                ? "employee"
                : "employees"}
            </div>
          </div>

          <div className="filters">
            <div className="search-box">
              <span className="search-icon">
                ⌕
              </span>

              <input
                type="text"
                placeholder="Search employees..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              {EMPLOYEE_STATUSES.map((status) => (
                <option
                  key={status.value}
                  value={status.value}
                >
                  {status.label}
                </option>
              ))}
            </select>

            <select
              value={departmentFilter}
              onChange={(event) =>
                setDepartmentFilter(event.target.value)
              }
            >
              <option value="all">
                All Departments
              </option>

              {departments.map((department) => (
                <option
                  key={department}
                  value={department}
                >
                  {department}
                </option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
            >
              <option value="all">
                All Roles
              </option>

              {roles.map((role) => (
                <option
                  key={role}
                  value={role}
                >
                  {role}
                </option>
              ))}
            </select>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>

              <h3>
                {employees.length === 0
                  ? "No employees yet"
                  : "No employees found"}
              </h3>

              <p>
                {employees.length === 0
                  ? "Create your first employee and send them an SBS login invitation."
                  : "Try changing your search or filters."}
              </p>

              {employees.length === 0 && (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() =>
                    router.push("/employees/new")
                  }
                >
                  <span>+</span>
                  Add Employee
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Job Title</th>
                    <th>Employment</th>
                    <th>Status</th>
                    <th>SBS Login</th>
                    <th>Hire Date</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.map(
                    (employee) => {
                      const roleName =
                        getRoleName(employee);

                      const employeeName =
                        getEmployeeName(employee);

                      return (
                        <tr key={employee.id}>
                          <td>
                            <div className="employee-cell">
                              <div className="avatar">
                                {getInitials(
                                  employee
                                )}
                              </div>

                              <div className="employee-info">
                                <div className="employee-name">
                                  {employeeName}
                                </div>

                                <div className="employee-email">
                                  {employee.email ||
                                    "No email"}
                                </div>

                                {employee.employee_number && (
                                  <div className="employee-number">
                                    {
                                      employee.employee_number
                                    }
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="role-badge">
                              {roleName}
                            </span>
                          </td>

                          <td>
                            <span className="table-muted">
                              {employee.department ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <span className="table-primary">
                              {employee.job_title ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <span className="table-muted">
                              {formatEmploymentType(
                                employee.employment_type
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`status-badge status-${employee.status}`}
                            >
                              <span className="status-dot" />
                              {getStatusLabel(
                                employee.status
                              )}
                            </span>
                          </td>

                          <td>
                            {employee.user_id ? (
                              <span className="login-badge login-active">
                                <span>✓</span>
                                Active
                              </span>
                            ) : employee.status ===
                              "invited" ? (
                              <span className="login-badge login-pending">
                                <span>◷</span>
                                Invited
                              </span>
                            ) : (
                              <span className="login-badge login-none">
                                <span>—</span>
                                Not Linked
                              </span>
                            )}
                          </td>

                          <td>
                            <span className="table-muted">
                              {formatDate(
                                employee.hire_date
                              )}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="row-action"
                              onClick={() =>
                                router.push(
                                  `/employees/${employee.id}`
                                )
                              }
                            >
                              View
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
        </section>

        <style jsx>{`
  .page-content {
    padding: 28px;
    background: #f8fafc;
    min-height: 100%;
  }

  /* =========================
     PAGE HEADER
     ========================= */

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }

  h1 {
    margin: 0;
    color: #0f172a;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 750;
    letter-spacing: -0.6px;
  }

  .page-header p {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.5;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* =========================
     BUTTONS
     ========================= */

  .button {
    height: 38px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid transparent;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.15s ease;
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .button-primary {
    color: #ffffff;
    background: #059669;
    border-color: #059669;
    box-shadow: 0 1px 2px rgba(5, 150, 105, 0.12);
  }

  .button-primary:hover:not(:disabled) {
    background: #047857;
    border-color: #047857;
    box-shadow: 0 3px 8px rgba(5, 150, 105, 0.16);
  }

  .button-primary:active:not(:disabled) {
    transform: translateY(1px);
  }

  .button-primary:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 3px #d1fae5,
      0 2px 6px rgba(5, 150, 105, 0.14);
  }

  .button-secondary {
    color: #475569;
    background: #ffffff;
    border-color: #dbe3ea;
  }

  .button-secondary:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .button-secondary:focus-visible {
    outline: none;
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .small-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid #d1fae5;
    border-top-color: #059669;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  /* =========================
     ERROR CARD
     ========================= */

  .error-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 13px 15px;
    margin-bottom: 20px;
    border: 1px solid #fecaca;
    border-radius: 10px;
    background: #fef2f2;
  }

  .error-icon {
    width: 25px;
    height: 25px;
    flex: 0 0 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #ffffff;
    color: #b91c1c;
    font-size: 12px;
    font-weight: 800;
  }

  .error-card strong {
    display: block;
    color: #991b1b;
    font-size: 13px;
    line-height: 1.35;
  }

  .error-card p {
    margin: 3px 0 0;
    color: #b91c1c;
    font-size: 12px;
    line-height: 1.45;
  }

  .error-card button {
    margin-left: auto;
    padding: 4px 6px;
    border: 0;
    background: transparent;
    color: #991b1b;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
  }

  .error-card button:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* =========================
     KPI CARDS
     ========================= */

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 22px;
  }

  .stat-card {
    position: relative;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px 20px;
    min-height: 112px;
    box-sizing: border-box;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease;
  }



  .stat-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
    transform: translateY(-1px);
  }

  .stat-label {
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.45px;
  }

  .stat-value {
    margin-top: 7px;
    color: #0f172a;
    font-size: 25px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.6px;
  }

  .stat-meta {
    margin-top: 6px;
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.4;
  }

  /* =========================
     MAIN CONTENT CARD
     ========================= */

  .content-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }

  .content-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
  }

  .content-header h2 {
    margin: 0;
    color: #0f172a;
    font-size: 17px;
    line-height: 1.3;
    font-weight: 750;
    letter-spacing: -0.2px;
  }

  .content-header p {
    margin: 5px 0 0;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.4;
  }

  .result-count {
    color: #64748b;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  /* =========================
     FILTER BAR
     ========================= */

  .filters {
    display: grid;
    grid-template-columns: minmax(260px, 1fr)
      170px 180px 170px;
    gap: 8px;
    padding: 14px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
  }

  .search-box {
    position: relative;
    min-width: 0;
  }

  .search-box input,
  .filters select {
    width: 100%;
    height: 38px;
    box-sizing: border-box;
    border: 1px solid #dbe3ea;
    border-radius: 8px;
    outline: none;
    background: #ffffff;
    color: #0f172a;
    font-family: inherit;
    font-size: 12px;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .search-box input {
    padding: 0 12px 0 35px;
  }

  .search-box input::placeholder {
    color: #94a3b8;
  }

  .filters select {
    padding: 0 11px;
    color: #475569;
    font-weight: 600;
    cursor: pointer;
  }

  .search-box input:focus,
  .filters select:focus {
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  .search-box input:hover,
  .filters select:hover {
    border-color: #cbd5e1;
  }

  .search-icon {
    position: absolute;
    left: 11px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 16px;
    line-height: 1;
    pointer-events: none;
  }

  /* =========================
     TABLE
     ========================= */

  .table-wrapper {
    width: 100%;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  table {
    width: 100%;
    min-width: 1160px;
    border-collapse: separate;
    border-spacing: 0;
  }

  th {
    height: 42px;
    padding: 0 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 10px;
    font-weight: 750;
    line-height: 1.2;
    text-align: left;
    text-transform: uppercase;
    letter-spacing: 0.55px;
    white-space: nowrap;
  }

  td {
    padding: 14px 16px;
    border-bottom: 1px solid #eef2f7;
    color: #334155;
    font-size: 12px;
    line-height: 1.45;
    vertical-align: middle;
    background: #ffffff;
  }

  tbody tr {
    transition: background 0.14s ease;
  }

  tbody tr:hover td {
    background: #f8fffc;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  /* =========================
     EMPLOYEE CELL
     ========================= */

  .employee-cell {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 230px;
  }

  .avatar {
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #d1fae5;
    border-radius: 10px;
    background: #ecfdf5;
    color: #047857;
    font-size: 11px;
    font-weight: 800;
  }

  .employee-info {
    min-width: 0;
  }

  .employee-name {
    max-width: 230px;
    overflow: hidden;
    color: #0f172a;
    font-size: 13px;
    line-height: 1.3;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .employee-email {
    max-width: 230px;
    margin-top: 3px;
    overflow: hidden;
    color: #64748b;
    font-size: 11px;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .employee-number {
    margin-top: 2px;
    color: #94a3b8;
    font-size: 10px;
    line-height: 1.3;
  }

  /* =========================
     TABLE TEXT
     ========================= */

  .table-primary {
    color: #0f172a;
    font-size: 12px;
    font-weight: 650;
  }

  .table-muted {
    color: #64748b;
    font-size: 12px;
    white-space: nowrap;
  }

  /* =========================
     ROLE BADGE
     ========================= */

  .role-badge {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 4px 9px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: #f8fafc;
    color: #475569;
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    white-space: nowrap;
  }

  /* =========================
     STATUS BADGES
     ========================= */

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 24px;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 10px;
    line-height: 1;
    font-weight: 750;
    white-space: nowrap;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .status-active {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #d1fae5;
  }

  .status-invited {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fef3c7;
  }

  .status-inactive {
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }

  .status-terminated {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fee2e2;
  }

  /* =========================
     LOGIN BADGES
     ========================= */

  .login-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 24px;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 10px;
    line-height: 1;
    font-weight: 700;
    white-space: nowrap;
  }

  .login-active {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #d1fae5;
  }

  .login-pending {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fef3c7;
  }

  .login-none {
    background: #f8fafc;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }

  /* =========================
     ROW ACTION
     ========================= */

  .row-action {
    height: 30px;
    padding: 0 10px;
    border: 1px solid #dbe3ea;
    border-radius: 7px;
    background: #ffffff;
    color: #475569;
    font-family: inherit;
    font-size: 11px;
    font-weight: 650;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .row-action:hover {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #047857;
  }

  .row-action:focus-visible {
    outline: none;
    border-color: #6ee7b7;
    box-shadow: 0 0 0 3px #ecfdf5;
  }

  /* =========================
     EMPTY STATE
     ========================= */

  .empty-state {
    min-height: 340px;
    padding: 40px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .empty-icon {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    border: 1px solid #d1fae5;
    border-radius: 13px;
    background: #ecfdf5;
    font-size: 21px;
  }

  .empty-state h3 {
    margin: 0;
    color: #0f172a;
    font-size: 16px;
    line-height: 1.35;
    font-weight: 750;
  }

  .empty-state p {
    max-width: 440px;
    margin: 7px 0 18px;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.5;
  }

  /* =========================
     LOADING STATE
     ========================= */

  .loading-state {
    min-height: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 13px;
    color: #64748b;
    font-size: 13px;
  }

  .loading-state p {
    margin: 0;
  }

  .spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #d1fae5;
    border-top-color: #059669;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* =========================
     RESPONSIVE
     ========================= */

  @media (max-width: 1200px) {
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .page-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .filters {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    .page-content {
      padding: 18px 16px;
    }

    h1 {
      font-size: 24px;
    }

    .header-actions {
      display: grid;
      grid-template-columns: 1fr;
    }

    .header-actions .button {
      width: 100%;
    }

    .stats-grid {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .filters {
      grid-template-columns: 1fr;
      padding: 14px 16px;
    }

    .content-header {
      padding: 16px;
      align-items: flex-start;
    }

    .result-count {
      display: none;
    }

    .error-card {
      flex-wrap: wrap;
    }

    .error-card button {
      margin-left: 37px;
    }
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