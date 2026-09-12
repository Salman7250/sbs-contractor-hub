"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type PortalSettings = {
  company_id: string;
  enabled: boolean;
  portal_name: string;
  welcome_message: string | null;
  support_email: string | null;
  support_phone: string | null;
  default_currency: string;
  allow_invoice_downloads: boolean;
  allow_document_downloads: boolean;
  allow_payment_history: boolean;
  allow_quote_acceptance: boolean;
  allow_service_requests: boolean;
  allow_client_messages: boolean;
};

type PortalUser = {
  id: string;
  company_id: string;
  customer_id: string;
  user_id: string;
  role: "primary" | "billing" | "manager" | "viewer";
  status: "invited" | "active" | "suspended" | "revoked";
  invited_at: string | null;
  activated_at: string | null;
  last_login_at: string | null;
  customer: Customer | null;
};

const DEFAULT_SETTINGS: Omit<PortalSettings, "company_id"> = {
  enabled: false,
  portal_name: "Client Portal",
  welcome_message:
    "Welcome to your secure customer portal. View your business information, invoices, orders, documents and service activity.",
  support_email: "",
  support_phone: "",
  default_currency: "USD",
  allow_invoice_downloads: true,
  allow_document_downloads: true,
  allow_payment_history: true,
  allow_quote_acceptance: false,
  allow_service_requests: true,
  allow_client_messages: true,
};

const roleLabels: Record<PortalUser["role"], string> = {
  primary: "Primary",
  billing: "Billing",
  manager: "Manager",
  viewer: "Viewer",
};

const statusLabels: Record<PortalUser["status"], string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  revoked: "Revoked",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function statusClass(status: PortalUser["status"]) {
  switch (status) {
    case "active":
      return "status success";
    case "invited":
      return "status warning";
    case "suspended":
      return "status danger";
    case "revoked":
      return "status neutral";
  }
}

export default function B2BPortalAdminPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PortalSettings | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);

  const [customerSearch, setCustomerSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [activeTab, setActiveTab] = useState<
    "overview" | "access" | "settings"
  >("overview");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCustomerId, setInviteCustomerId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<PortalUser["role"]>("primary");
  const [inviting, setInviting] = useState(false);

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [localSettings, setLocalSettings] =
    useState<Omit<PortalSettings, "company_id">>(DEFAULT_SETTINGS);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data: membership, error: membershipError } = await supabase
        .from("company_members")
        .select("company_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.company_id) {
        throw new Error("No company membership was found.");
      }

      const currentCompanyId = membership.company_id;

      setCompanyId(currentCompanyId);

      const [
        settingsResponse,
        customersResponse,
        portalUsersResponse,
      ] = await Promise.all([
        supabase
          .from("customer_portal_settings")
          .select("*")
          .eq("company_id", currentCompanyId)
          .maybeSingle(),

        supabase
          .from("customers")
          .select("id, name, email, phone")
          .eq("company_id", currentCompanyId)
          .order("name", { ascending: true }),

        supabase
          .from("customer_portal_users")
          .select(
            `
              id,
              company_id,
              customer_id,
              user_id,
              role,
              status,
              invited_at,
              activated_at,
              last_login_at,
              customers (
                id,
                name,
                email,
                phone
              )
            `,
          )
          .eq("company_id", currentCompanyId)
          .order("created_at", { ascending: false }),
      ]);

      if (settingsResponse.error) throw settingsResponse.error;
      if (customersResponse.error) throw customersResponse.error;
      if (portalUsersResponse.error) throw portalUsersResponse.error;

      const currentSettings =
        settingsResponse.data ??
        ({
          company_id: currentCompanyId,
          ...DEFAULT_SETTINGS,
        } as PortalSettings);

      setSettings(currentSettings);
      setLocalSettings({
        enabled: currentSettings.enabled,
        portal_name: currentSettings.portal_name,
        welcome_message: currentSettings.welcome_message,
        support_email: currentSettings.support_email,
        support_phone: currentSettings.support_phone,
        default_currency: currentSettings.default_currency,
        allow_invoice_downloads:
          currentSettings.allow_invoice_downloads,
        allow_document_downloads:
          currentSettings.allow_document_downloads,
        allow_payment_history:
          currentSettings.allow_payment_history,
        allow_quote_acceptance:
          currentSettings.allow_quote_acceptance,
        allow_service_requests:
          currentSettings.allow_service_requests,
        allow_client_messages:
          currentSettings.allow_client_messages,
      });

      setCustomers((customersResponse.data ?? []) as Customer[]);

      const mappedUsers = (portalUsersResponse.data ?? []).map(
        (item: any) => ({
          id: item.id,
          company_id: item.company_id,
          customer_id: item.customer_id,
          user_id: item.user_id,
          role: item.role,
          status: item.status,
          invited_at: item.invited_at,
          activated_at: item.activated_at,
          last_login_at: item.last_login_at,
          customer: Array.isArray(item.customers)
            ? item.customers[0] ?? null
            : item.customers ?? null,
        }),
      );

      setPortalUsers(mappedUsers);
    } catch (error: any) {
      console.error("B2B portal load error:", error);
      setErrorMessage(
        error?.message || "Unable to load B2B Client Portal.",
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveSettings = async () => {
    if (!companyId) return;

    try {
      setSavingSettings(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = {
        company_id: companyId,
        ...localSettings,
        portal_name:
          localSettings.portal_name.trim() || "Client Portal",
        default_currency:
          localSettings.default_currency.trim().toUpperCase() || "USD",
      };

      const { data, error } = await supabase
        .from("customer_portal_settings")
        .upsert(payload, {
          onConflict: "company_id",
        })
        .select("*")
        .single();

      if (error) throw error;

      setSettings(data as PortalSettings);
      setSuccessMessage("Client Portal settings saved.");
    } catch (error: any) {
      console.error("Save portal settings error:", error);
      setErrorMessage(
        error?.message || "Unable to save portal settings.",
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const updatePortalUser = async (
    id: string,
    changes: Partial<PortalUser>,
  ) => {
    try {
      setUpdatingUserId(id);
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase
        .from("customer_portal_users")
        .update(changes)
        .eq("id", id)
        .select(
          `
            id,
            company_id,
            customer_id,
            user_id,
            role,
            status,
            invited_at,
            activated_at,
            last_login_at,
            customers (
              id,
              name,
              email,
              phone
            )
          `,
        )
        .single();

      if (error) throw error;

      const updatedUser: PortalUser = {
        id: data.id,
        company_id: data.company_id,
        customer_id: data.customer_id,
        user_id: data.user_id,
        role: data.role,
        status: data.status,
        invited_at: data.invited_at,
        activated_at: data.activated_at,
        last_login_at: data.last_login_at,
        customer: Array.isArray((data as any).customers)
          ? (data as any).customers[0] ?? null
          : ((data as any).customers ?? null),
      };

      setPortalUsers((current) =>
        current.map((item) =>
          item.id === id ? updatedUser : item,
        ),
      );

      setSuccessMessage("Portal access updated.");
    } catch (error: any) {
      console.error("Update portal user error:", error);
      setErrorMessage(
        error?.message || "Unable to update portal access.",
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const inviteUser = async () => {
    if (!companyId) return;

    if (!inviteCustomerId) {
      setErrorMessage("Select a customer first.");
      return;
    }

    if (!inviteEmail.trim()) {
      setErrorMessage("Enter the customer's email address.");
      return;
    }

    try {
      setInviting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await fetch("/api/b2b-portal/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          customerId: inviteCustomerId,
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Unable to send portal invitation.",
        );
      }

      setShowInviteModal(false);
      setInviteCustomerId("");
      setInviteEmail("");
      setInviteRole("primary");

      setSuccessMessage(
        "Portal invitation sent successfully.",
      );

      await loadData();
    } catch (error: any) {
      console.error("Invite portal user error:", error);
      setErrorMessage(
        error?.message || "Unable to send portal invitation.",
      );
    } finally {
      setInviting(false);
    }
  };

  const filteredCustomers = customers.filter((customer) => {
    const query = customerSearch.trim().toLowerCase();

    if (!query) return true;

    return (
      customer.name.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query)
    );
  });

  const filteredPortalUsers = portalUsers.filter((user) => {
    const query = userSearch.trim().toLowerCase();

    if (!query) return true;

    return (
      user.customer?.name?.toLowerCase().includes(query) ||
      user.customer?.email?.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query) ||
      user.status.toLowerCase().includes(query)
    );
  });

  const activeUsers = portalUsers.filter(
    (user) => user.status === "active",
  ).length;

  const invitedUsers = portalUsers.filter(
    (user) => user.status === "invited",
  ).length;

  const suspendedUsers = portalUsers.filter(
    (user) => user.status === "suspended",
  ).length;

  const enabledPermissions = [
    localSettings.allow_invoice_downloads,
    localSettings.allow_document_downloads,
    localSettings.allow_payment_history,
    localSettings.allow_quote_acceptance,
    localSettings.allow_service_requests,
    localSettings.allow_client_messages,
  ].filter(Boolean).length;

  return (
    <AppShell>
      <div className="page-content">
        <div className="page-header">
          <div>
            <div className="eyebrow">CUSTOMER MANAGEMENT</div>
            <h1>B2B Client Portal</h1>
            <p>
              Give customers secure access to only the business data,
              documents and services you choose to share with them.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="secondary-button"
              onClick={loadData}
              disabled={loading}
            >
              Refresh
            </button>

            <button
              className="primary-button"
              onClick={() => setShowInviteModal(true)}
            >
              + Invite Customer
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="alert error-alert">
            <strong>Something went wrong</strong>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert success-alert">
            <strong>Done</strong>
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            Loading Client Portal…
          </div>
        ) : (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">Portal Status</div>
                <div className="stat-row">
                  <div className="stat-value">
                    {localSettings.enabled
                      ? "Enabled"
                      : "Disabled"}
                  </div>
                  <span
                    className={
                      localSettings.enabled
                        ? "status success"
                        : "status neutral"
                    }
                  >
                    {localSettings.enabled ? "Live" : "Off"}
                  </span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Portal Users</div>
                <div className="stat-value">
                  {portalUsers.length}
                </div>
                <div className="stat-sub">
                  {activeUsers} active
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Pending Invites</div>
                <div className="stat-value">
                  {invitedUsers}
                </div>
                <div className="stat-sub">
                  Waiting for activation
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Customer Coverage</div>
                <div className="stat-value">
                  {customers.length
                    ? Math.round(
                        (new Set(
                          portalUsers.map(
                            (user) => user.customer_id,
                          ),
                        ).size /
                          customers.length) *
                          100,
                      )
                    : 0}
                  %
                </div>
                <div className="stat-sub">
                  Customers with portal access
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">
                  Available Permissions
                </div>
                <div className="stat-value">
                  {enabledPermissions}/6
                </div>
                <div className="stat-sub">
                  Portal capabilities enabled
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">
                  Suspended Users
                </div>
                <div className="stat-value">
                  {suspendedUsers}
                </div>
                <div className="stat-sub">
                  Access temporarily blocked
                </div>
              </div>
            </div>

            <div className="tabs-card">
              <button
                className={
                  activeTab === "overview"
                    ? "tab active"
                    : "tab"
                }
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>

              <button
                className={
                  activeTab === "access"
                    ? "tab active"
                    : "tab"
                }
                onClick={() => setActiveTab("access")}
              >
                Customer Access
              </button>

              <button
                className={
                  activeTab === "settings"
                    ? "tab active"
                    : "tab"
                }
                onClick={() => setActiveTab("settings")}
              >
                Portal Settings
              </button>
            </div>

            {activeTab === "overview" && (
              <>
                <div className="two-column">
                  <section className="content-card">
                    <div className="card-header">
                      <div>
                        <h2>Portal Overview</h2>
                        <p>
                          The customer portal is completely
                          isolated from your internal SBS workspace.
                        </p>
                      </div>

                      <span
                        className={
                          localSettings.enabled
                            ? "status success"
                            : "status neutral"
                        }
                      >
                        {localSettings.enabled
                          ? "Portal enabled"
                          : "Portal disabled"}
                      </span>
                    </div>

                    <div className="overview-list">
                      <div>
                        <span>Customer invoices</span>
                        <strong>
                          {localSettings.allow_invoice_downloads
                            ? "View + Download"
                            : "View only"}
                        </strong>
                      </div>

                      <div>
                        <span>Documents</span>
                        <strong>
                          {localSettings.allow_document_downloads
                            ? "Shared + Download"
                            : "Shared only"}
                        </strong>
                      </div>

                      <div>
                        <span>Payment history</span>
                        <strong>
                          {localSettings.allow_payment_history
                            ? "Enabled"
                            : "Disabled"}
                        </strong>
                      </div>

                      <div>
                        <span>Quote acceptance</span>
                        <strong>
                          {localSettings.allow_quote_acceptance
                            ? "Enabled"
                            : "Disabled"}
                        </strong>
                      </div>

                      <div>
                        <span>Service requests</span>
                        <strong>
                          {localSettings.allow_service_requests
                            ? "Enabled"
                            : "Disabled"}
                        </strong>
                      </div>

                      <div>
                        <span>Client messaging</span>
                        <strong>
                          {localSettings.allow_client_messages
                            ? "Enabled"
                            : "Disabled"}
                        </strong>
                      </div>
                    </div>
                  </section>

                  <section className="content-card">
                    <div className="card-header">
                      <div>
                        <h2>Security Model</h2>
                        <p>
                          Customers only receive records belonging to
                          their assigned customer account.
                        </p>
                      </div>
                    </div>

                    <div className="security-flow">
                      <div>Authenticated portal user</div>
                      <span>↓</span>
                      <div>Assigned customer</div>
                      <span>↓</span>
                      <div>Company portal enabled</div>
                      <span>↓</span>
                      <div>Customer-owned records only</div>
                      <span>↓</span>
                      <div className="final">
                        Explicitly shared files & permissions
                      </div>
                    </div>
                  </section>
                </div>

                <section className="content-card">
                  <div className="card-header">
                    <div>
                      <h2>Recent Portal Users</h2>
                      <p>
                        Customers currently connected to the portal.
                      </p>
                    </div>

                    <button
                      className="secondary-button"
                      onClick={() => setActiveTab("access")}
                    >
                      Manage Access
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Invited</th>
                          <th>Last Login</th>
                        </tr>
                      </thead>

                      <tbody>
                        {portalUsers.slice(0, 8).map((user) => (
                          <tr key={user.id}>
                            <td>
                              <div className="customer-cell">
                                <strong>
                                  {user.customer?.name ||
                                    "Unknown customer"}
                                </strong>
                                <span>
                                  {user.customer?.email || "—"}
                                </span>
                              </div>
                            </td>

                            <td>
                              {roleLabels[user.role]}
                            </td>

                            <td>
                              <span
                                className={statusClass(
                                  user.status,
                                )}
                              >
                                {statusLabels[user.status]}
                              </span>
                            </td>

                            <td>
                              {formatDate(user.invited_at)}
                            </td>

                            <td>
                              {formatDate(user.last_login_at)}
                            </td>
                          </tr>
                        ))}

                        {!portalUsers.length && (
                          <tr>
                            <td colSpan={5}>
                              <div className="empty-state">
                                No customer portal users yet.
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}

            {activeTab === "access" && (
              <section className="content-card">
                <div className="card-header">
                  <div>
                    <h2>Customer Portal Access</h2>
                    <p>
                      Every portal account is explicitly linked to a
                      customer record.
                    </p>
                  </div>

                  <button
                    className="primary-button"
                    onClick={() => setShowInviteModal(true)}
                  >
                    + Invite Customer
                  </button>
                </div>

                <div className="toolbar">
                  <input
                    value={userSearch}
                    onChange={(event) =>
                      setUserSearch(event.target.value)
                    }
                    placeholder="Search customer, email, role or status…"
                  />
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Portal Role</th>
                        <th>Status</th>
                        <th>Invited</th>
                        <th>Last Login</th>
                        <th className="align-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPortalUsers.map((user) => {
                        const isUpdating =
                          updatingUserId === user.id;

                        return (
                          <tr key={user.id}>
                            <td>
                              <div className="customer-cell">
                                <strong>
                                  {user.customer?.name ||
                                    "Unknown"}
                                </strong>
                                <span>
                                  {user.customer?.email || "—"}
                                </span>
                              </div>
                            </td>

                            <td>
                              <select
                                value={user.role}
                                disabled={isUpdating}
                                onChange={(event) =>
                                  updatePortalUser(user.id, {
                                    role: event.target
                                      .value as PortalUser["role"],
                                  })
                                }
                              >
                                <option value="primary">
                                  Primary
                                </option>
                                <option value="billing">
                                  Billing
                                </option>
                                <option value="manager">
                                  Manager
                                </option>
                                <option value="viewer">
                                  Viewer
                                </option>
                              </select>
                            </td>

                            <td>
                              <select
                                value={user.status}
                                disabled={isUpdating}
                                onChange={(event) =>
                                  updatePortalUser(user.id, {
                                    status: event.target
                                      .value as PortalUser["status"],
                                  })
                                }
                              >
                                <option value="invited">
                                  Invited
                                </option>
                                <option value="active">
                                  Active
                                </option>
                                <option value="suspended">
                                  Suspended
                                </option>
                                <option value="revoked">
                                  Revoked
                                </option>
                              </select>
                            </td>

                            <td>
                              {formatDate(user.invited_at)}
                            </td>

                            <td>
                              {formatDate(user.last_login_at)}
                            </td>

                            <td className="align-right">
                              <button
                                className="link-button"
                                onClick={() => {
                                  if (
                                    user.status === "active"
                                  ) {
                                    updatePortalUser(user.id, {
                                      status: "suspended",
                                    });
                                  } else {
                                    updatePortalUser(user.id, {
                                      status: "active",
                                    });
                                  }
                                }}
                                disabled={isUpdating}
                              >
                                {user.status === "active"
                                  ? "Suspend"
                                  : "Activate"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {!filteredPortalUsers.length && (
                        <tr>
                          <td colSpan={6}>
                            <div className="empty-state">
                              No portal users match your search.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "settings" && (
              <section className="content-card">
                <div className="card-header">
                  <div>
                    <h2>Portal Settings</h2>
                    <p>
                      Control what customers can see and do in their
                      portal.
                    </p>
                  </div>

                  <button
                    className={
                      localSettings.enabled
                        ? "danger-button"
                        : "primary-button"
                    }
                    onClick={() =>
                      setLocalSettings((current) => ({
                        ...current,
                        enabled: !current.enabled,
                      }))
                    }
                  >
                    {localSettings.enabled
                      ? "Disable Portal"
                      : "Enable Portal"}
                  </button>
                </div>

                <div className="settings-grid">
                  <div className="field">
                    <label>Portal Name</label>
                    <input
                      value={localSettings.portal_name}
                      onChange={(event) =>
                        setLocalSettings((current) => ({
                          ...current,
                          portal_name: event.target.value,
                        }))
                      }
                      placeholder="Client Portal"
                    />
                  </div>

                  <div className="field">
                    <label>Default Currency</label>
                    <input
                      maxLength={3}
                      value={localSettings.default_currency}
                      onChange={(event) =>
                        setLocalSettings((current) => ({
                          ...current,
                          default_currency:
                            event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="USD"
                    />
                  </div>

                  <div className="field full-width">
                    <label>Welcome Message</label>
                    <textarea
                      rows={4}
                      value={
                        localSettings.welcome_message || ""
                      }
                      onChange={(event) =>
                        setLocalSettings((current) => ({
                          ...current,
                          welcome_message:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Support Email</label>
                    <input
                      type="email"
                      value={
                        localSettings.support_email || ""
                      }
                      onChange={(event) =>
                        setLocalSettings((current) => ({
                          ...current,
                          support_email:
                            event.target.value,
                        }))
                      }
                      placeholder="support@example.com"
                    />
                  </div>

                  <div className="field">
                    <label>Support Phone</label>
                    <input
                      value={
                        localSettings.support_phone || ""
                      }
                      onChange={(event) =>
                        setLocalSettings((current) => ({
                          ...current,
                          support_phone:
                            event.target.value,
                        }))
                      }
                      placeholder="+971..."
                    />
                  </div>
                </div>

                <div className="permissions-section">
                  <div className="section-title">
                    Customer Permissions
                  </div>

                  <div className="permission-grid">
                    {[
                      [
                        "allow_invoice_downloads",
                        "Invoice Downloads",
                        "Allow customers to download their invoices.",
                      ],
                      [
                        "allow_document_downloads",
                        "Document Downloads",
                        "Allow downloads for files explicitly shared with them.",
                      ],
                      [
                        "allow_payment_history",
                        "Payment History",
                        "Show invoice payment history and collections.",
                      ],
                      [
                        "allow_quote_acceptance",
                        "Quote Acceptance",
                        "Allow customers to accept quotes through the portal.",
                      ],
                      [
                        "allow_service_requests",
                        "Service Requests",
                        "Allow customers to create support and service requests.",
                      ],
                      [
                        "allow_client_messages",
                        "Client Messaging",
                        "Enable direct customer/company communication.",
                      ],
                    ].map(([key, title, description]) => {
                      const settingKey =
                        key as keyof typeof localSettings;

                      return (
                        <label
                          className="permission-card"
                          key={key}
                        >
                          <div>
                            <strong>{title}</strong>
                            <span>{description}</span>
                          </div>

                          <input
                            type="checkbox"
                            checked={
                              Boolean(
                                localSettings[settingKey],
                              )
                            }
                            onChange={(event) =>
                              setLocalSettings(
                                (current) => ({
                                  ...current,
                                  [settingKey]:
                                    event.target.checked,
                                }),
                              )
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="settings-footer">
                  <button
                    className="primary-button"
                    onClick={saveSettings}
                    disabled={savingSettings}
                  >
                    {savingSettings
                      ? "Saving…"
                      : "Save Portal Settings"}
                  </button>
                </div>
              </section>
            )}

            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>Customers</h2>
                  <p>
                    Customers available to receive portal access.
                  </p>
                </div>

                <span className="count-badge">
                  {filteredCustomers.length}
                </span>
              </div>

              <div className="toolbar">
                <input
                  value={customerSearch}
                  onChange={(event) =>
                    setCustomerSearch(event.target.value)
                  }
                  placeholder="Search customers…"
                />
              </div>

              <div className="customer-grid">
                {filteredCustomers.slice(0, 12).map((customer) => {
                  const hasPortal = portalUsers.some(
                    (user) =>
                      user.customer_id === customer.id &&
                      user.status !== "revoked",
                  );

                  return (
                    <div
                      className="customer-card"
                      key={customer.id}
                    >
                      <div className="customer-card-main">
                        <div className="customer-avatar">
                          {customer.name
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>{customer.name}</strong>
                          <span>
                            {customer.email || "No email"}
                          </span>
                        </div>
                      </div>

                      <div className="customer-card-footer">
                        <span
                          className={
                            hasPortal
                              ? "status success"
                              : "status neutral"
                          }
                        >
                          {hasPortal
                            ? "Portal Access"
                            : "No Portal"}
                        </span>

                        {!hasPortal && customer.email && (
                          <button
                            className="link-button"
                            onClick={() => {
                              setInviteCustomerId(
                                customer.id,
                              );
                              setInviteEmail(
                                customer.email || "",
                              );
                              setShowInviteModal(true);
                            }}
                          >
                            Grant Access
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>

      {showInviteModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!inviting) {
              setShowInviteModal(false);
            }
          }}
        >
          <div
            className="modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Invite Customer to Portal</h2>
                <p>
                  Create a secure customer login linked to their
                  existing SBS customer record.
                </p>
              </div>

              <button
                className="close-button"
                onClick={() => {
                  if (!inviting) {
                    setShowInviteModal(false);
                  }
                }}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="field">
                <label>Customer</label>
                <select
                  value={inviteCustomerId}
                  onChange={(event) => {
                    const customerId =
                      event.target.value;

                    setInviteCustomerId(customerId);

                    const customer =
                      customers.find(
                        (item) =>
                          item.id === customerId,
                      );

                    if (
                      customer?.email &&
                      !inviteEmail
                    ) {
                      setInviteEmail(customer.email);
                    }
                  }}
                >
                  <option value="">
                    Select customer…
                  </option>

                  {customers.map((customer) => (
                    <option
                      value={customer.id}
                      key={customer.id}
                    >
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Login Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) =>
                    setInviteEmail(event.target.value)
                  }
                  placeholder="customer@example.com"
                />
              </div>

              <div className="field">
                <label>Portal Role</label>
                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target
                        .value as PortalUser["role"],
                    )
                  }
                >
                  <option value="primary">
                    Primary — Full customer access
                  </option>
                  <option value="billing">
                    Billing — Financial access
                  </option>
                  <option value="manager">
                    Manager — Operational access
                  </option>
                  <option value="viewer">
                    Viewer — Read-only access
                  </option>
                </select>
              </div>

              <div className="invite-note">
                <strong>Access isolation</strong>
                <span>
                  This account will only be able to access records
                  connected to the selected customer. Internal SBS
                  data remains inaccessible.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() =>
                  setShowInviteModal(false)
                }
                disabled={inviting}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                onClick={inviteUser}
                disabled={inviting}
              >
                {inviting
                  ? "Sending Invitation…"
                  : "Send Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 24px;
        }

        .eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #6b7280;
          margin-bottom: 7px;
        }

        .page-header h1 {
          margin: 0;
          font-size: 29px;
          line-height: 1.15;
          font-weight: 700;
          color: #111827;
        }

        .page-header p {
          margin: 8px 0 0;
          color: #6b7280;
          font-size: 14px;
          max-width: 760px;
          line-height: 1.6;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }

        button,
        input,
        textarea,
        select {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .primary-button,
        .secondary-button,
        .danger-button {
          min-height: 40px;
          border-radius: 9px;
          padding: 0 15px;
          font-weight: 600;
          font-size: 13px;
          border: 1px solid transparent;
        }

        .primary-button {
          color: #ffffff;
          background: #111827;
        }

        .primary-button:hover {
          background: #1f2937;
        }

        .secondary-button {
          color: #111827;
          background: #ffffff;
          border-color: #d1d5db;
        }

        .secondary-button:hover {
          background: #f9fafb;
        }

        .danger-button {
          color: #b91c1c;
          background: #fff;
          border-color: #fecaca;
        }

        .danger-button:hover {
          background: #fef2f2;
        }

        .alert {
          border: 1px solid;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 18px;
          display: flex;
          gap: 8px;
          flex-direction: column;
          font-size: 13px;
        }

        .error-alert {
          background: #fef2f2;
          border-color: #fecaca;
          color: #991b1b;
        }

        .success-alert {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #166534;
        }

        .loading-state,
        .empty-state {
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          font-size: 14px;
        }

        .stat-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .stat-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 17px;
          box-shadow: 0 2px 7px rgba(15, 23, 42, 0.03);
          min-width: 0;
        }

        .stat-label {
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .stat-value {
          color: #111827;
          font-size: 22px;
          font-weight: 700;
        }

        .stat-sub {
          margin-top: 5px;
          color: #9ca3af;
          font-size: 11px;
        }

        .stat-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          border-radius: 999px;
          padding: 0 9px;
          font-size: 11px;
          font-weight: 700;
        }

        .status.success {
          color: #166534;
          background: #dcfce7;
        }

        .status.warning {
          color: #92400e;
          background: #fef3c7;
        }

        .status.danger {
          color: #991b1b;
          background: #fee2e2;
        }

        .status.neutral {
          color: #4b5563;
          background: #f3f4f6;
        }

        .tabs-card {
          display: flex;
          gap: 3px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 18px;
        }

        .tab {
          border: 0;
          background: transparent;
          padding: 11px 15px;
          color: #6b7280;
          font-size: 13px;
          font-weight: 600;
          border-bottom: 2px solid transparent;
        }

        .tab.active {
          color: #111827;
          border-bottom-color: #111827;
        }

        .two-column {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
          gap: 18px;
          margin-bottom: 18px;
        }

        .content-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 20px;
          box-shadow: 0 2px 7px rgba(15, 23, 42, 0.03);
          margin-bottom: 18px;
          min-width: 0;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }

        .card-header h2 {
          margin: 0;
          font-size: 17px;
          color: #111827;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
        }

        .overview-list {
          display: grid;
          gap: 0;
          border-top: 1px solid #f3f4f6;
        }

        .overview-list > div {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 13px 0;
          border-bottom: 1px solid #f3f4f6;
          font-size: 13px;
        }

        .overview-list span {
          color: #6b7280;
        }

        .overview-list strong {
          color: #111827;
          text-align: right;
        }

        .security-flow {
          display: grid;
          gap: 7px;
          align-items: center;
          justify-items: center;
          padding: 8px 0;
        }

        .security-flow div {
          width: 100%;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          padding: 11px;
          text-align: center;
          background: #fafafa;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
        }

        .security-flow .final {
          background: #111827;
          color: white;
          border-color: #111827;
        }

        .security-flow span {
          font-size: 13px;
          color: #9ca3af;
        }

        .toolbar {
          display: flex;
          gap: 10px;
          margin-bottom: 14px;
        }

        .toolbar input,
        .field input,
        .field textarea,
        .field select,
        td select {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: #fff;
          color: #111827;
          outline: none;
        }

        .toolbar input,
        .field input,
        .field select,
        td select {
          height: 40px;
          padding: 0 12px;
        }

        .field textarea {
          padding: 11px 12px;
          resize: vertical;
          line-height: 1.5;
        }

        .toolbar input:focus,
        .field input:focus,
        .field textarea:focus,
        .field select:focus,
        td select:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05);
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 760px;
        }

        th {
          text-align: left;
          padding: 11px 12px;
          font-size: 11px;
          color: #6b7280;
          font-weight: 700;
          border-bottom: 1px solid #e5e7eb;
          white-space: nowrap;
        }

        td {
          padding: 13px 12px;
          font-size: 13px;
          color: #374151;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }

        tr:last-child td {
          border-bottom: 0;
        }

        .customer-cell {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .customer-cell strong {
          color: #111827;
          font-size: 13px;
        }

        .customer-cell span {
          color: #9ca3af;
          font-size: 11px;
        }

        .align-right {
          text-align: right;
        }

        td select {
          width: auto;
          min-width: 125px;
          height: 34px;
          font-size: 12px;
        }

        .link-button {
          border: 0;
          background: transparent;
          color: #111827;
          font-size: 12px;
          font-weight: 700;
          padding: 3px 0;
        }

        .link-button:hover {
          text-decoration: underline;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field.full-width {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 12px;
          color: #374151;
          font-weight: 700;
        }

        .permissions-section {
          margin-top: 26px;
          padding-top: 23px;
          border-top: 1px solid #e5e7eb;
        }

        .section-title {
          font-size: 14px;
          color: #111827;
          font-weight: 700;
          margin-bottom: 13px;
        }

        .permission-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 11px;
        }

        .permission-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 14px;
          cursor: pointer;
        }

        .permission-card:hover {
          background: #fafafa;
        }

        .permission-card strong {
          display: block;
          font-size: 13px;
          color: #111827;
          margin-bottom: 4px;
        }

        .permission-card span {
          display: block;
          color: #6b7280;
          font-size: 11px;
          line-height: 1.5;
        }

        .permission-card input {
          width: 17px;
          height: 17px;
          margin-top: 1px;
          flex-shrink: 0;
        }

        .settings-footer {
          display: flex;
          justify-content: flex-end;
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .count-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #374151;
          font-size: 11px;
          font-weight: 700;
        }

        .customer-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .customer-card {
          border: 1px solid #e5e7eb;
          border-radius: 11px;
          padding: 14px;
        }

        .customer-card-main {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .customer-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          color: #111827;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }

        .customer-card-main strong {
          display: block;
          color: #111827;
          font-size: 13px;
          margin-bottom: 3px;
        }

        .customer-card-main span {
          display: block;
          color: #9ca3af;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 170px;
        }

        .customer-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px solid #f3f4f6;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(17, 24, 39, 0.42);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 100;
        }

        .modal {
          width: min(560px, 100%);
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.2);
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          color: #111827;
        }

        .modal-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.5;
        }

        .close-button {
          border: 0;
          background: transparent;
          font-size: 26px;
          line-height: 1;
          color: #9ca3af;
        }

        .modal-body {
          padding: 20px;
          display: grid;
          gap: 16px;
        }

        .invite-note {
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .invite-note strong {
          color: #111827;
          font-size: 12px;
        }

        .invite-note span {
          color: #6b7280;
          font-size: 11px;
          line-height: 1.5;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          background: #fafafa;
        }

        @media (max-width: 1250px) {
          .stat-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .customer-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .two-column {
            grid-template-columns: 1fr;
          }

          .settings-grid,
          .permission-grid {
            grid-template-columns: 1fr;
          }

          .customer-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .page-content {
            padding: 18px;
          }

          .page-header {
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .card-header {
            flex-direction: column;
          }

          .tabs-card {
            overflow-x: auto;
          }

          .tab {
            white-space: nowrap;
          }
        }

        @media (max-width: 480px) {
          .stat-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppShell>
  );
}