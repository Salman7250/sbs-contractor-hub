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
          }

          .page-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
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
            margin: 8px 0 0;
            color: #64748b;
            font-size: 14px;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 9px;
            flex-wrap: wrap;
          }

          .button {
            height: 40px;
            padding: 0 14px;
            border-radius: 9px;
            border: 1px solid transparent;
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            cursor: pointer;
            transition:
              background 0.15s ease,
              border-color 0.15s ease,
              opacity 0.15s ease;
          }

          .button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .button-primary {
            color: #ffffff;
            background: #111827;
            border-color: #111827;
          }

          .button-primary:hover:not(:disabled) {
            background: #1f2937;
          }

          .button-secondary {
            color: #374151;
            background: #ffffff;
            border-color: #d1d5db;
          }

          .button-secondary:hover:not(:disabled) {
            background: #f9fafb;
          }

          .small-spinner {
            width: 13px;
            height: 13px;
            border: 2px solid #d1d5db;
            border-top-color: #374151;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 20px;
          }

          .stat-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 18px 20px;
            min-height: 112px;
            box-sizing: border-box;
            box-shadow: 0 2px 8px
              rgba(15, 23, 42, 0.03);
          }

          .stat-label {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .stat-value {
            color: #111827;
            font-size: 26px;
            line-height: 1.2;
            font-weight: 700;
            margin-top: 7px;
            letter-spacing: -0.02em;
          }

          .stat-meta {
            color: #94a3b8;
            font-size: 11px;
            margin-top: 5px;
          }

          .content-card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 2px 8px
              rgba(15, 23, 42, 0.03);
          }

          .content-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 20px 22px;
            border-bottom: 1px solid #e5e7eb;
          }

          .content-header h2 {
            margin: 0;
            color: #111827;
            font-size: 16px;
            font-weight: 650;
          }

          .content-header p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          .result-count {
            color: #64748b;
            font-size: 12px;
            white-space: nowrap;
          }

          .filters {
            display: grid;
            grid-template-columns: minmax(260px, 1fr)
              170px 180px 170px;
            gap: 10px;
            padding: 16px 22px;
            border-bottom: 1px solid #e5e7eb;
            background: #ffffff;
          }

          .search-box {
            position: relative;
          }

          .search-box input,
          .filters select {
            width: 100%;
            height: 40px;
            box-sizing: border-box;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: #ffffff;
            color: #111827;
            font-family: inherit;
            font-size: 13px;
            outline: none;
          }

          .search-box input {
            padding: 0 12px 0 36px;
          }

          .search-box input::placeholder {
            color: #9ca3af;
          }

          .filters select {
            padding: 0 11px;
          }

          .search-box input:focus,
          .filters select:focus {
            border-color: #94a3b8;
            box-shadow: 0 0 0 3px
              rgba(148, 163, 184, 0.14);
          }

          .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            font-size: 16px;
            pointer-events: none;
          }

          .table-wrapper {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            min-width: 1120px;
          }

          th {
            height: 43px;
            padding: 0 14px;
            text-align: left;
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            white-space: nowrap;
          }

          td {
            padding: 14px;
            border-bottom: 1px solid #eef2f7;
            color: #374151;
            font-size: 13px;
            vertical-align: middle;
          }

          tbody tr:last-child td {
            border-bottom: 0;
          }

          tbody tr:hover {
            background: #fafafa;
          }

          .employee-cell {
            display: flex;
            align-items: center;
            gap: 11px;
            min-width: 220px;
          }

          .avatar {
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #111827;
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
          }

          .employee-info {
            min-width: 0;
          }

          .employee-name {
            color: #111827;
            font-size: 13px;
            font-weight: 650;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 220px;
          }

          .employee-email {
            color: #64748b;
            font-size: 11px;
            margin-top: 3px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 220px;
          }

          .employee-number {
            color: #94a3b8;
            font-size: 10px;
            margin-top: 2px;
          }

          .role-badge {
            display: inline-flex;
            align-items: center;
            min-height: 26px;
            padding: 0 9px;
            border-radius: 999px;
            background: #f1f5f9;
            color: #475569;
            font-size: 11px;
            font-weight: 650;
            white-space: nowrap;
          }

          .table-primary {
            color: #374151;
            font-size: 12px;
          }

          .table-muted {
            color: #64748b;
            font-size: 12px;
            white-space: nowrap;
          }

          .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 26px;
            padding: 0 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 650;
            white-space: nowrap;
          }

          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
          }

          .status-active {
            color: #166534;
            background: #f0fdf4;
          }

          .status-invited {
            color: #92400e;
            background: #fffbeb;
          }

          .status-inactive {
            color: #475569;
            background: #f1f5f9;
          }

          .status-terminated {
            color: #991b1b;
            background: #fef2f2;
          }

          .login-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-height: 26px;
            padding: 0 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 650;
            white-space: nowrap;
          }

          .login-active {
            color: #166534;
            background: #f0fdf4;
          }

          .login-pending {
            color: #92400e;
            background: #fffbeb;
          }

          .login-none {
            color: #64748b;
            background: #f8fafc;
          }

          .row-action {
            height: 32px;
            padding: 0 10px;
            border: 1px solid #d1d5db;
            border-radius: 7px;
            background: #ffffff;
            color: #374151;
            font-family: inherit;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          }

          .row-action:hover {
            background: #f9fafb;
          }

          .empty-state {
            min-height: 330px;
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
            border-radius: 14px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            margin-bottom: 14px;
          }

          .empty-state h3 {
            margin: 0;
            color: #111827;
            font-size: 15px;
            font-weight: 650;
          }

          .empty-state p {
            max-width: 430px;
            margin: 7px 0 17px;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
          }

          .error-card {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 14px 16px;
            margin-bottom: 20px;
            border: 1px solid #fecaca;
            border-radius: 12px;
            background: #fef2f2;
          }

          .error-icon {
            width: 24px;
            height: 24px;
            flex: 0 0 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            color: #b91c1c;
            font-size: 12px;
            font-weight: 700;
          }

          .error-card strong {
            display: block;
            color: #991b1b;
            font-size: 13px;
          }

          .error-card p {
            margin: 3px 0 0;
            color: #b91c1c;
            font-size: 12px;
            line-height: 1.5;
          }

          .error-card button {
            margin-left: auto;
            border: 0;
            background: transparent;
            color: #991b1b;
            font-family: inherit;
            font-size: 12px;
            font-weight: 650;
            cursor: pointer;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 1200px) {
            .stats-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .filters {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 760px) {
            .page-content {
              padding: 20px 16px;
            }

            .page-header {
              flex-direction: column;
            }

            h1 {
              font-size: 24px;
            }

            .header-actions {
              width: 100%;
            }

            .header-actions .button {
              flex: 1;
            }

            .stats-grid {
              grid-template-columns: 1fr;
            }

            .filters {
              grid-template-columns: 1fr;
              padding: 14px 16px;
            }

            .content-header {
              padding: 17px;
            }

            .result-count {
              display: none;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}