"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
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
};

type Manager = {
  id: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
  status: string | null;
};

type Company = {
  id: string;
  name: string;
};

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contractor", label: "Contractor" },
  { value: "temporary", label: "Temporary" },
];

const EMPLOYEE_STATUSES = [
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Terminated" },
];

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

function formatEmploymentType(
  value: string | null
) {
  if (!value) return "—";

  const found = EMPLOYMENT_TYPES.find(
    (item) => item.value === value
  );

  return (
    found?.label ||
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
}

function formatStatus(
  value: string | null
) {
  if (!value) return "Unknown";

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

export default function EditEmployeePage() {
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

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [company, setCompany] =
    useState<Company | null>(null);

  const [employee, setEmployee] =
    useState<Employee | null>(null);

  const [roles, setRoles] =
    useState<EmployeeRole[]>([]);

  const [managers, setManagers] =
    useState<Manager[]>([]);

  const [currentUserIsAdmin, setCurrentUserIsAdmin] =
    useState(false);

  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [employeeNumber, setEmployeeNumber] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [jobTitle, setJobTitle] =
    useState("");

  const [department, setDepartment] =
    useState("");

  const [employmentType, setEmploymentType] =
    useState("full_time");

  const [status, setStatus] =
    useState("active");

  const [roleId, setRoleId] =
    useState("");

  const [hireDate, setHireDate] =
    useState("");

  const [managerId, setManagerId] =
    useState("");

  const [
    emergencyContactName,
    setEmergencyContactName,
  ] = useState("");

  const [
    emergencyContactPhone,
    setEmergencyContactPhone,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const loadData = useCallback(
    async () => {
      if (!employeeId) {
        setErrorMessage(
          "Employee ID is missing."
        );
        setLoading(false);
        return;
      }

      setLoading(true);
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

        const companyId =
          membership.company_id;

        const isAdmin =
          membership.role === "owner" ||
          membership.role === "admin";

        setCurrentUserIsAdmin(
          isAdmin
        );

        if (!isAdmin) {
          /*
           * Employees can only edit employee records
           * if they have the employees:edit permission.
           */

          const {
            data: hasPermission,
            error: permissionError,
          } = await supabase.rpc(
            "employee_has_permission",
            {
              p_company_id: companyId,
              p_module: "employees",
              p_action: "edit",
            }
          );

          if (permissionError) {
            throw new Error(
              permissionError.message
            );
          }

          if (!hasPermission) {
            throw new Error(
              "You do not have permission to edit employees."
            );
          }
        }

        /*
         * =====================================================
         * Load employee
         * =====================================================
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
              notes
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
         * Load company, roles and managers
         * =====================================================
         */

        const [
          { data: companyData, error: companyError },
          { data: roleData, error: rolesError },
          { data: managerData, error: managersError },
        ] = await Promise.all([
          supabase
            .from("companies")
            .select(
              "id, name"
            )
            .eq(
              "id",
              companyId
            )
            .single(),

          supabase
            .from("employee_roles")
            .select(
              "id, name, description"
            )
            .eq(
              "company_id",
              companyId
            )
            .order("name"),

          supabase
            .from("employees")
            .select(
              `
                id,
                display_name,
                first_name,
                last_name,
                status
              `
            )
            .eq(
              "company_id",
              companyId
            )
            .neq(
              "id",
              employeeId
            )
            .order("first_name"),
        ]);

        if (companyError) {
          throw new Error(
            companyError.message
          );
        }

        if (rolesError) {
          throw new Error(
            rolesError.message
          );
        }

        if (managersError) {
          throw new Error(
            managersError.message
          );
        }

        setCompany(companyData);
        setEmployee(employeeData);
        setRoles(roleData || []);
        setManagers(managerData || []);

        /*
         * =====================================================
         * Populate form
         * =====================================================
         */

        setFirstName(
          employeeData.first_name || ""
        );

        setLastName(
          employeeData.last_name || ""
        );

        setEmployeeNumber(
          employeeData.employee_number || ""
        );

        setEmail(
          employeeData.email || ""
        );

        setPhone(
          employeeData.phone || ""
        );

        setJobTitle(
          employeeData.job_title || ""
        );

        setDepartment(
          employeeData.department || ""
        );

        setEmploymentType(
          employeeData.employment_type ||
            "full_time"
        );

        setStatus(
          employeeData.status ||
            "active"
        );

        setRoleId(
          employeeData.role_id || ""
        );

        setHireDate(
          employeeData.hire_date || ""
        );

        setManagerId(
          employeeData.manager_id || ""
        );

        setEmergencyContactName(
          employeeData.emergency_contact_name ||
            ""
        );

        setEmergencyContactPhone(
          employeeData.emergency_contact_phone ||
            ""
        );

        setNotes(
          employeeData.notes || ""
        );
      } catch (error) {
        console.error(
          "Employee edit load error:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load employee."
        );
      } finally {
        setLoading(false);
      }
    },
    [employeeId, router, supabase]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedFirstName =
      firstName.trim();

    const trimmedLastName =
      lastName.trim();

    const trimmedEmail =
      email.trim().toLowerCase();

    if (!trimmedFirstName) {
      setErrorMessage(
        "First name is required."
      );
      return;
    }

    if (!trimmedLastName) {
      setErrorMessage(
        "Last name is required."
      );
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage(
        "SBS login email is required."
      );
      return;
    }

    if (
      !trimmedEmail.includes("@")
    ) {
      setErrorMessage(
        "Please enter a valid email address."
      );
      return;
    }

    if (!roleId) {
      setErrorMessage(
        "Please select an employee role."
      );
      return;
    }

    if (!employee?.company_id) {
      setErrorMessage(
        "Employee company information is unavailable."
      );
      return;
    }

    if (!currentUserIsAdmin) {
      /*
       * The backend/RLS remains the final authority.
       * This client-side check simply gives a useful message.
       */
      setErrorMessage(
        "You do not have permission to edit employees."
      );
      return;
    }

    /*
     * Prevent an employee from being their own manager.
     */

    if (
      managerId &&
      managerId === employee.id
    ) {
      setErrorMessage(
        "An employee cannot be assigned as their own manager."
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * =====================================================
       * IMPORTANT
       * =====================================================
       *
       * We update only the employee record.
       *
       * user_id is NEVER changed here.
       *
       * company_id is NEVER changed here.
       */

      const {
        error: updateError,
      } = await supabase
        .from("employees")
        .update({
          role_id: roleId,
          employee_number:
            employeeNumber.trim() ||
            null,
          first_name:
            trimmedFirstName,
          last_name:
            trimmedLastName,
          display_name:
            `${trimmedFirstName} ${trimmedLastName}`.trim(),
          email:
            trimmedEmail,
          phone:
            phone.trim() || null,
          job_title:
            jobTitle.trim() || null,
          department:
            department.trim() || null,
          employment_type:
            employmentType,
          status,
          hire_date:
            hireDate || null,
          manager_id:
            managerId || null,
          emergency_contact_name:
            emergencyContactName.trim() ||
            null,
          emergency_contact_phone:
            emergencyContactPhone.trim() ||
            null,
          notes:
            notes.trim() || null,
        })
        .eq(
          "id",
          employee.id
        )
        .eq(
          "company_id",
          employee.company_id
        );

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      setSuccessMessage(
        "Employee updated successfully."
      );

      /*
       * Give the user a moment to see the success state,
       * then return to the employee profile.
       */

      setTimeout(() => {
        router.push(
          `/employees/${employee.id}`
        );
      }, 700);
    } catch (error) {
      console.error(
        "Employee update error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update employee."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
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
              Unable to edit employee
            </h1>

            <p>
              {errorMessage ||
                "The employee could not be loaded."}
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

  if (
    !currentUserIsAdmin
  ) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="error-card">
            <div className="error-icon">
              !
            </div>

            <h1>
              Access restricted
            </h1>

            <p>
              You do not have permission to edit
              employee records.
            </p>

            <button
              type="button"
              className="button button-primary"
              onClick={() =>
                router.push(
                  `/employees/${employee.id}`
                )
              }
            >
              ← Back to Employee
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
              background: #fff7ed;
              color: #c2410c;
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

  const selectedRole =
    roles.find(
      (role) => role.id === roleId
    );

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
                  `/employees/${employee.id}`
                )
              }
            >
              ← Employee Profile
            </button>

            <div className="heading-row">
              <div className="avatar">
                {getInitials(
                  firstName ||
                    employee.first_name,
                  lastName ||
                    employee.last_name
                )}
              </div>

              <div>
                <h1>
                  Edit Employee
                </h1>

                <p>
                  Update{" "}
                  {employee.display_name ||
                    `${employee.first_name} ${employee.last_name}`}
                  {company?.name
                    ? ` · ${company.name}`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            <div className="alert-icon">
              !
            </div>

            <div>
              <strong>
                Unable to update employee
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
                Employee updated
              </strong>

              <p>
                {successMessage}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>
                    Personal Information
                  </h2>

                  <p>
                    Basic employee information.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="avatar-preview">
                  <div className="large-avatar">
                    {getInitials(
                      firstName ||
                        employee.first_name,
                      lastName ||
                        employee.last_name
                    )}
                  </div>

                  <div>
                    <div className="preview-name">
                      {firstName ||
                      lastName
                        ? `${firstName} ${lastName}`.trim()
                        : "Employee"}
                    </div>

                    <div className="preview-email">
                      {email ||
                        "No email"}
                    </div>
                  </div>
                </div>

                <div className="field-grid">
                  <Field
                    label="First Name"
                    required
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="e.g. Ahmed"
                  />

                  <Field
                    label="Last Name"
                    required
                    value={lastName}
                    onChange={setLastName}
                    placeholder="e.g. Khan"
                  />

                  <Field
                    label="Employee Number"
                    value={employeeNumber}
                    onChange={setEmployeeNumber}
                    placeholder="e.g. EMP-001"
                  />

                  <Field
                    label="Phone"
                    value={phone}
                    onChange={setPhone}
                    placeholder="e.g. +971 50 123 4567"
                  />
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>
                    SBS Login
                  </h2>

                  <p>
                    Authentication identity for this
                    employee.
                  </p>
                </div>

                <span className="login-badge">
                  {employee.user_id
                    ? "Connected"
                    : "No Login"}
                </span>
              </div>

              <div className="card-body">
                <div className="login-info">
                  <div className="info-icon">
                    ✉
                  </div>

                  <div>
                    <strong>
                      Login email
                    </strong>

                    <p>
                      This is the email address
                      associated with the employee's
                      SBS account.
                    </p>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="email">
                    SBS Login Email{" "}
                    <span>*</span>
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    placeholder="employee@company.com"
                    required
                  />

                  <small>
                    Changing this employee email here
                    updates the employee record. Auth
                    login-email synchronization will be
                    handled separately.
                  </small>
                </div>

                <div className="login-account">
                  <div>
                    <span>
                      Auth Account
                    </span>

                    <strong>
                      {employee.user_id
                        ? `${employee.user_id.slice(
                            0,
                            8
                          )}...`
                        : "Not connected"}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>
                    Employment
                  </h2>

                  <p>
                    Position and employment details.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="field-grid">
                  <Field
                    label="Job Title"
                    value={jobTitle}
                    onChange={setJobTitle}
                    placeholder="e.g. Sales Executive"
                  />

                  <Field
                    label="Department"
                    value={department}
                    onChange={setDepartment}
                    placeholder="e.g. Sales"
                  />

                  <SelectField
                    label="Employment Type"
                    value={employmentType}
                    onChange={setEmploymentType}
                    options={EMPLOYMENT_TYPES}
                  />

                  <SelectField
                    label="Status"
                    value={status}
                    onChange={setStatus}
                    options={EMPLOYEE_STATUSES}
                  />

                  <div className="field">
                    <label htmlFor="hireDate">
                      Hire Date
                    </label>

                    <input
                      id="hireDate"
                      type="date"
                      value={hireDate}
                      onChange={(event) =>
                        setHireDate(
                          event.target.value
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="managerId">
                      Manager
                    </label>

                    <select
                      id="managerId"
                      value={managerId}
                      onChange={(event) =>
                        setManagerId(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        No Manager
                      </option>

                      {managers.map(
                        (manager) => (
                          <option
                            key={
                              manager.id
                            }
                            value={
                              manager.id
                            }
                          >
                            {manager.display_name ||
                              `${manager.first_name} ${manager.last_name}`}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>
                    Access & Permissions
                  </h2>

                  <p>
                    Control the employee's SBS module
                    access through their role.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="field">
                  <label htmlFor="roleId">
                    Employee Role{" "}
                    <span>*</span>
                  </label>

                  <select
                    id="roleId"
                    value={roleId}
                    onChange={(event) =>
                      setRoleId(
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      Select employee role
                    </option>

                    {roles.map(
                      (role) => (
                        <option
                          key={role.id}
                          value={role.id}
                        >
                          {role.name}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {selectedRole && (
                  <div className="role-preview">
                    <div className="role-icon">
                      ✓
                    </div>

                    <div>
                      <strong>
                        {selectedRole.name}
                      </strong>

                      <p>
                        {selectedRole.description ||
                          "Permissions assigned to this role determine which SBS modules and actions the employee can access."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="permission-note">
                  <strong>
                    Role-based access
                  </strong>

                  <span>
                    Changing the role changes the
                    employee's effective SBS
                    permissions. All employees can
                    submit expenses when their employee
                    account is active.
                  </span>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>
                    Emergency Contact
                  </h2>

                  <p>
                    Optional emergency contact
                    information.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="field-grid">
                  <Field
                    label="Contact Name"
                    value={
                      emergencyContactName
                    }
                    onChange={
                      setEmergencyContactName
                    }
                    placeholder="e.g. Family member"
                  />

                  <Field
                    label="Contact Phone"
                    value={
                      emergencyContactPhone
                    }
                    onChange={
                      setEmergencyContactPhone
                    }
                    placeholder="e.g. +971 50 123 4567"
                  />
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>
                    Notes
                  </h2>

                  <p>
                    Internal notes about this
                    employee.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="field">
                  <label htmlFor="notes">
                    Internal Notes
                  </label>

                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    placeholder="Add any internal notes..."
                    rows={6}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                router.push(
                  `/employees/${employee.id}`
                )
              }
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button button-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="button-spinner" />
                  Saving Changes...
                </>
              ) : (
                <>
                  ✓
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>

        <style jsx>{`
          .page-content {
            padding: 28px;
            max-width: 1500px;
            margin: 0 auto;
          }

          .page-header {
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

          .heading-row {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .avatar {
            width: 52px;
            height: 52px;
            flex: 0 0 52px;
            border-radius: 50%;
            background: #111827;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            font-weight: 700;
          }

          h1 {
            margin: 0;
            color: #111827;
            font-size: 28px;
            line-height: 1.2;
            font-weight: 700;
            letter-spacing: -0.02em;
          }

          .heading-row p {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 14px;
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

          .alert-success {
            background: #f0fdf4;
            border-color: #bbf7d0;
            color: #166534;
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

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
          }

          .form-card {
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
            gap: 15px;
            padding: 19px 21px;
            border-bottom: 1px solid #e5e7eb;
          }

          .card-header h2 {
            margin: 0;
            color: #111827;
            font-size: 15px;
            font-weight: 650;
          }

          .card-header p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .card-body {
            padding: 21px;
          }

          .avatar-preview {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 13px;
            margin-bottom: 19px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 11px;
          }

          .large-avatar {
            width: 44px;
            height: 44px;
            flex: 0 0 44px;
            border-radius: 50%;
            background: #111827;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 700;
          }

          .preview-name {
            color: #111827;
            font-size: 13px;
            font-weight: 650;
          }

          .preview-email {
            margin-top: 3px;
            color: #64748b;
            font-size: 11px;
          }

          .field-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
          }

          .field {
            min-width: 0;
          }

          .field label {
            display: block;
            color: #374151;
            font-size: 12px;
            font-weight: 600;
            margin-bottom: 7px;
          }

          .field label span {
            color: #dc2626;
          }

          .field input,
          .field select,
          .field textarea {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #d1d5db;
            background: #ffffff;
            color: #111827;
            border-radius: 9px;
            font-family: inherit;
            font-size: 13px;
            outline: none;
            transition:
              border-color 0.15s ease,
              box-shadow 0.15s ease;
          }

          .field input,
          .field select {
            height: 41px;
            padding: 0 11px;
          }

          .field textarea {
            min-height: 115px;
            padding: 10px 11px;
            resize: vertical;
            line-height: 1.5;
          }

          .field input::placeholder,
          .field textarea::placeholder {
            color: #9ca3af;
          }

          .field input:focus,
          .field select:focus,
          .field textarea:focus {
            border-color: #94a3b8;
            box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.16);
          }

          .field small {
            display: block;
            margin-top: 6px;
            color: #64748b;
            font-size: 10px;
            line-height: 1.5;
          }

          .login-badge {
            white-space: nowrap;
            padding: 5px 9px;
            border-radius: 999px;
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #bbf7d0;
            font-size: 10px;
            font-weight: 650;
          }

          .login-info {
            display: flex;
            gap: 11px;
            padding: 12px;
            margin-bottom: 17px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #f8fafc;
          }

          .info-icon {
            width: 29px;
            height: 29px;
            flex: 0 0 29px;
            border-radius: 7px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #475569;
            font-size: 13px;
          }

          .login-info strong {
            display: block;
            color: #111827;
            font-size: 12px;
          }

          .login-info p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .login-account {
            margin-top: 15px;
            padding-top: 14px;
            border-top: 1px solid #e5e7eb;
          }

          .login-account div {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .login-account span {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 600;
          }

          .login-account strong {
            color: #374151;
            font-size: 11px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }

          .role-preview {
            display: flex;
            gap: 11px;
            align-items: flex-start;
            margin-top: 15px;
            padding: 12px;
            border: 1px solid #e5e7eb;
            background: #f8fafc;
            border-radius: 10px;
          }

          .role-icon {
            width: 29px;
            height: 29px;
            flex: 0 0 29px;
            border-radius: 7px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            color: #16a34a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
          }

          .role-preview strong {
            color: #111827;
            font-size: 12px;
          }

          .role-preview p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .permission-note {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 15px;
            padding: 11px 12px;
            border-left: 3px solid #cbd5e1;
            background: #f8fafc;
            color: #64748b;
            font-size: 11px;
            line-height: 1.5;
          }

          .permission-note strong {
            color: #374151;
            font-size: 11px;
          }

          .form-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 9px;
            padding: 19px 0 5px;
          }

          .button {
            height: 41px;
            padding: 0 16px;
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
            opacity: 0.6;
          }

          .button-secondary {
            background: #ffffff;
            color: #374151;
            border: 1px solid #d1d5db;
          }

          .button-secondary:hover:not(:disabled) {
            background: #f9fafb;
          }

          .button-primary {
            background: #111827;
            color: #ffffff;
            border: 1px solid #111827;
          }

          .button-primary:hover:not(:disabled) {
            background: #1f2937;
          }

          .button-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255, 255, 255, 0.35);
            border-top-color: #ffffff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
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

          .error-card h1 {
            font-size: 20px;
          }

          .error-card p {
            max-width: 500px;
            margin: 8px 0 20px;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          @media (max-width: 1050px) {
            .form-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 760px) {
            .page-content {
              padding: 20px 16px;
            }

            h1 {
              font-size: 23px;
            }

            .field-grid {
              grid-template-columns: 1fr;
              gap: 15px;
            }

            .card-header,
            .card-body {
              padding: 17px;
            }

            .form-actions {
              flex-direction: column-reverse;
              align-items: stretch;
            }

            .button {
              width: 100%;
            }

            .login-badge {
              display: none;
            }
          }
        `}</style>
      </main>
    </AppShell>
  );
}

function Field({
  label,
  required = false,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {required && (
          <span> *</span>
        )}
      </label>

      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        required={required}
      />

      <style jsx>{`
        .field {
          min-width: 0;
        }

        .field label {
          display: block;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        .field label span {
          color: #dc2626;
        }

        .field input {
          width: 100%;
          height: 41px;
          box-sizing: border-box;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .field input::placeholder {
          color: #9ca3af;
        }

        .field input:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.16);
        }
      `}</style>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: {
    value: string;
    label: string;
  }[];
}) {
  return (
    <div className="field">
      <label>
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
      >
        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          )
        )}
      </select>

      <style jsx>{`
        .field {
          min-width: 0;
        }

        .field label {
          display: block;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        .field select {
          width: 100%;
          height: 41px;
          box-sizing: border-box;
          padding: 0 11px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #111827;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          cursor: pointer;
        }

        .field select:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.16);
        }
      `}</style>
    </div>
  );
}