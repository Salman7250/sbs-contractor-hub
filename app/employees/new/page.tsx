"use client";

import {
  FormEvent,
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
  description?: string | null;
};

type Employee = {
  id: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
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
];

function getInitials(firstName: string, lastName: string) {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);

  return `${first}${last}`.toUpperCase() || "E";
}

export default function NewEmployeePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [company, setCompany] = useState<Company | null>(null);
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [status, setStatus] = useState("invited");
  const [roleId, setRoleId] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [managerId, setManagerId] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
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

      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      if (!membership?.company_id) {
        throw new Error("No company membership was found for your account.");
      }

      const companyId = membership.company_id;

      const [
        { data: companyData, error: companyError },
        { data: roleData, error: rolesError },
        { data: employeeData, error: employeesError },
      ] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name")
          .eq("id", companyId)
          .single(),

        supabase
          .from("employee_roles")
          .select("id, name, description")
          .eq("company_id", companyId)
          .order("name"),

        supabase
          .from("employees")
          .select(
            "id, display_name, first_name, last_name, email"
          )
          .eq("company_id", companyId)
          .order("first_name"),
      ]);

      if (companyError) {
        throw new Error(companyError.message);
      }

      if (rolesError) {
        throw new Error(rolesError.message);
      }

      if (employeesError) {
        throw new Error(employeesError.message);
      }

      setCompany(companyData);
      setRoles(roleData || []);
      setEmployees(employeeData || []);

      const defaultRole =
        roleData?.find(
          (role) => role.name.toLowerCase() === "employee"
        ) || roleData?.[0];

      if (defaultRole) {
        setRoleId(defaultRole.id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the employee form."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedFirstName) {
      setErrorMessage("First name is required.");
      return;
    }

    if (!trimmedLastName) {
      setErrorMessage("Last name is required.");
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage("SBS login email is required.");
      return;
    }

    if (!trimmedEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!roleId) {
      setErrorMessage("Please select an employee role.");
      return;
    }

    if (!company?.id) {
      setErrorMessage("Company information is unavailable.");
      return;
    }

    setSaving(true);

    try {
      /*
       * IMPORTANT:
       * The browser does NOT create the Supabase Auth user directly.
       *
       * The API route will:
       * 1. Authenticate the current SBS user.
       * 2. Resolve their company membership server-side.
       * 3. Check employee-management permission.
       * 4. Invite the employee through Supabase Auth.
       * 5. Create company_members.
       * 6. Create the employees row.
       * 7. Assign the selected employee role.
       *
       * We intentionally do not send company_id from the form.
       */

      const response = await fetch("/api/employees/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          employee_number: employeeNumber.trim() || null,
          email: trimmedEmail,
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
          department: department.trim() || null,
          employment_type: employmentType,
          status,
          role_id: roleId,
          hire_date: hireDate || null,
          manager_id: managerId || null,
          emergency_contact_name:
            emergencyContactName.trim() || null,
          emergency_contact_phone:
            emergencyContactPhone.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || "Unable to create the employee."
        );
      }

      setSuccessMessage(
        result?.message ||
          "Employee created successfully. An SBS login invitation has been sent."
      );

      if (result?.employee?.id) {
        setTimeout(() => {
          router.push(`/employees/${result.employee.id}`);
        }, 900);
      } else {
        setTimeout(() => {
          router.push("/employees");
        }, 900);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create the employee."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <main className="page-content">
          <div className="page-header">
            <div>
              <div className="skeleton-title" />
              <div className="skeleton-subtitle" />
            </div>
          </div>

          <div className="loading-card">
            <div className="spinner" />
            <p>Loading employee form...</p>
          </div>

          <style jsx>{`
            .page-content {
              padding: 28px;
            }

            .page-header {
              margin-bottom: 24px;
            }

            .skeleton-title {
              width: 210px;
              height: 28px;
              border-radius: 8px;
              background: #e5e7eb;
            }

            .skeleton-subtitle {
              width: 330px;
              height: 16px;
              border-radius: 6px;
              background: #f1f5f9;
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

  return (
    <AppShell>
      <main className="page-content">
        <div className="page-header">
          <div>
            <button
              type="button"
              className="back-link"
              onClick={() => router.push("/employees")}
            >
              ← Employees
            </button>

            <h1>Add Employee</h1>

            <p>
              Create an employee profile and send them an SBS login
              invitation.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-error">
            <div className="alert-icon">!</div>
            <div>
              <strong>Unable to create employee</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success">
            <div className="alert-icon">✓</div>
            <div>
              <strong>Employee created</strong>
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>Personal Information</h2>
                  <p>Basic employee information.</p>
                </div>
              </div>

              <div className="card-body">
                <div className="avatar-preview">
                  <div className="avatar">
                    {getInitials(firstName, lastName)}
                  </div>

                  <div>
                    <div className="preview-name">
                      {firstName || lastName
                        ? `${firstName} ${lastName}`.trim()
                        : "New Employee"}
                    </div>
                    <div className="preview-email">
                      {email || "SBS login email"}
                    </div>
                  </div>
                </div>

                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="firstName">
                      First Name <span>*</span>
                    </label>
                    <input
                      id="firstName"
                      value={firstName}
                      onChange={(event) =>
                        setFirstName(event.target.value)
                      }
                      placeholder="e.g. Ahmed"
                      autoComplete="given-name"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="lastName">
                      Last Name <span>*</span>
                    </label>
                    <input
                      id="lastName"
                      value={lastName}
                      onChange={(event) =>
                        setLastName(event.target.value)
                      }
                      placeholder="e.g. Khan"
                      autoComplete="family-name"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="employeeNumber">
                      Employee Number
                    </label>
                    <input
                      id="employeeNumber"
                      value={employeeNumber}
                      onChange={(event) =>
                        setEmployeeNumber(event.target.value)
                      }
                      placeholder="e.g. EMP-001"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="phone">Phone</label>
                    <input
                      id="phone"
                      value={phone}
                      onChange={(event) =>
                        setPhone(event.target.value)
                      }
                      placeholder="e.g. +971 50 123 4567"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>SBS Login</h2>
                  <p>
                    Every employee receives an individual SBS account.
                  </p>
                </div>

                <div className="login-badge">
                  Login Required
                </div>
              </div>

              <div className="card-body">
                <div className="login-info">
                  <div className="info-icon">✉</div>
                  <div>
                    <strong>Invitation email</strong>
                    <p>
                      SBS will send an invitation to this address.
                      The employee will use it to set up their login.
                    </p>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="email">
                    SBS Login Email <span>*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="employee@company.com"
                    autoComplete="email"
                    required
                  />
                  <small>
                    This email becomes the employee&apos;s SBS login
                    identity.
                  </small>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>Employment</h2>
                  <p>Position, department and employment details.</p>
                </div>
              </div>

              <div className="card-body">
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="jobTitle">Job Title</label>
                    <input
                      id="jobTitle"
                      value={jobTitle}
                      onChange={(event) =>
                        setJobTitle(event.target.value)
                      }
                      placeholder="e.g. Sales Executive"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="department">Department</label>
                    <input
                      id="department"
                      value={department}
                      onChange={(event) =>
                        setDepartment(event.target.value)
                      }
                      placeholder="e.g. Sales"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="employmentType">
                      Employment Type
                    </label>
                    <select
                      id="employmentType"
                      value={employmentType}
                      onChange={(event) =>
                        setEmploymentType(event.target.value)
                      }
                    >
                      {EMPLOYMENT_TYPES.map((type) => (
                        <option
                          key={type.value}
                          value={type.value}
                        >
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="status">Status</label>
                    <select
                      id="status"
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value)
                      }
                    >
                      {EMPLOYEE_STATUSES.map((item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="hireDate">Hire Date</label>
                    <input
                      id="hireDate"
                      type="date"
                      value={hireDate}
                      onChange={(event) =>
                        setHireDate(event.target.value)
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="managerId">Manager</label>
                    <select
                      id="managerId"
                      value={managerId}
                      onChange={(event) =>
                        setManagerId(event.target.value)
                      }
                    >
                      <option value="">No Manager</option>

                      {employees.map((employee) => (
                        <option
                          key={employee.id}
                          value={employee.id}
                        >
                          {employee.display_name ||
                            `${employee.first_name} ${employee.last_name}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>Access & Permissions</h2>
                  <p>
                    The employee role controls which SBS modules and
                    actions they can access.
                  </p>
                </div>
              </div>

              <div className="card-body">
                <div className="field">
                  <label htmlFor="roleId">
                    Employee Role <span>*</span>
                  </label>

                  <select
                    id="roleId"
                    value={roleId}
                    onChange={(event) =>
                      setRoleId(event.target.value)
                    }
                    required
                  >
                    <option value="">
                      Select employee role
                    </option>

                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                {roleId && (
                  <div className="role-preview">
                    <div className="role-preview-icon">✓</div>
                    <div>
                      <strong>
                        {roles.find(
                          (role) => role.id === roleId
                        )?.name || "Selected Role"}
                      </strong>

                      <p>
                        {roles.find(
                          (role) => role.id === roleId
                        )?.description ||
                          "Permissions assigned to this role will determine the employee's access to SBS."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="permission-note">
                  <strong>Important</strong>
                  <span>
                    Employees do not receive every SBS module
                    automatically. Their role determines their access.
                    Expense submission is available to active
                    employees.
                  </span>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>Emergency Contact</h2>
                  <p>Optional emergency contact information.</p>
                </div>
              </div>

              <div className="card-body">
                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="emergencyContactName">
                      Contact Name
                    </label>
                    <input
                      id="emergencyContactName"
                      value={emergencyContactName}
                      onChange={(event) =>
                        setEmergencyContactName(
                          event.target.value
                        )
                      }
                      placeholder="e.g. Family member"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="emergencyContactPhone">
                      Contact Phone
                    </label>
                    <input
                      id="emergencyContactPhone"
                      value={emergencyContactPhone}
                      onChange={(event) =>
                        setEmergencyContactPhone(
                          event.target.value
                        )
                      }
                      placeholder="e.g. +971 50 123 4567"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="form-card">
              <div className="card-header">
                <div>
                  <h2>Notes</h2>
                  <p>Internal notes about this employee.</p>
                </div>
              </div>

              <div className="card-body">
                <div className="field">
                  <label htmlFor="notes">Internal Notes</label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    placeholder="Add any internal notes..."
                    rows={5}
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => router.push("/employees")}
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
                  Creating Employee...
                </>
              ) : (
                <>
                  <span>+</span>
                  Create Employee & Send Invite
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
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 24px;
          }

          .back-link {
            border: 0;
            background: transparent;
            padding: 0;
            margin: 0 0 8px;
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
            font-size: 28px;
            line-height: 1.2;
            font-weight: 700;
            color: #111827;
            letter-spacing: -0.02em;
          }

          .page-header p {
            margin: 8px 0 0;
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
            font-size: 13px;
            font-weight: 700;
            background: rgba(255, 255, 255, 0.65);
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
            padding: 20px 22px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
          }

          .card-header h2 {
            margin: 0;
            font-size: 16px;
            line-height: 1.4;
            color: #111827;
            font-weight: 650;
          }

          .card-header p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 13px;
            line-height: 1.5;
          }

          .card-body {
            padding: 22px;
          }

          .avatar-preview {
            display: flex;
            align-items: center;
            gap: 13px;
            padding: 14px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            margin-bottom: 20px;
          }

          .avatar {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background: #111827;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
          }

          .preview-name {
            color: #111827;
            font-size: 14px;
            font-weight: 650;
          }

          .preview-email {
            color: #64748b;
            font-size: 12px;
            margin-top: 3px;
          }

          .field-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 17px;
          }

          .field {
            min-width: 0;
          }

          .field + .field {
            margin-top: 0;
          }

          .field label {
            display: block;
            color: #374151;
            font-size: 13px;
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
            font-size: 14px;
            outline: none;
            transition:
              border-color 0.15s ease,
              box-shadow 0.15s ease;
          }

          .field input,
          .field select {
            height: 42px;
            padding: 0 12px;
          }

          .field textarea {
            padding: 11px 12px;
            resize: vertical;
            min-height: 110px;
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
            color: #64748b;
            font-size: 11px;
            margin-top: 6px;
            line-height: 1.4;
          }

          .login-badge {
            white-space: nowrap;
            border: 1px solid #dbeafe;
            background: #eff6ff;
            color: #1d4ed8;
            border-radius: 999px;
            padding: 5px 9px;
            font-size: 11px;
            font-weight: 650;
          }

          .login-info {
            display: flex;
            gap: 12px;
            padding: 13px;
            margin-bottom: 18px;
            border: 1px solid #e5e7eb;
            background: #f8fafc;
            border-radius: 10px;
          }

          .info-icon {
            width: 30px;
            height: 30px;
            flex: 0 0 30px;
            border-radius: 8px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #475569;
            font-size: 14px;
          }

          .login-info strong {
            display: block;
            color: #111827;
            font-size: 13px;
          }

          .login-info p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .role-preview {
            display: flex;
            gap: 11px;
            align-items: flex-start;
            margin-top: 16px;
            padding: 13px;
            border-radius: 10px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
          }

          .role-preview-icon {
            width: 28px;
            height: 28px;
            flex: 0 0 28px;
            border-radius: 7px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            color: #16a34a;
            font-size: 13px;
            font-weight: 700;
          }

          .role-preview strong {
            color: #111827;
            font-size: 13px;
          }

          .role-preview p {
            margin: 4px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .permission-note {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-top: 16px;
            padding: 12px 13px;
            border-left: 3px solid #cbd5e1;
            background: #f8fafc;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .permission-note strong {
            color: #374151;
            font-size: 12px;
          }

          .form-actions {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;
            margin-top: 20px;
            padding: 18px 0 6px;
          }

          .button {
            height: 42px;
            border-radius: 9px;
            padding: 0 16px;
            border: 1px solid transparent;
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
            border-color: #d1d5db;
          }

          .button-secondary:hover:not(:disabled) {
            background: #f9fafb;
          }

          .button-primary {
            background: #111827;
            color: #ffffff;
            border-color: #111827;
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

          @media (max-width: 1100px) {
            .form-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 760px) {
            .page-content {
              padding: 20px 16px;
            }

            h1 {
              font-size: 24px;
            }

            .card-header,
            .card-body {
              padding: 17px;
            }

            .field-grid {
              grid-template-columns: 1fr;
              gap: 15px;
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