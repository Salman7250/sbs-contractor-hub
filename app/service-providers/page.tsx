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

type ServiceProvider = {
  id: string;
  company_id: string;
  provider_number: string;
  name: string;
  company_name: string | null;
  service_types: string[];
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  payment_terms: string | null;
  default_rate: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ProviderStock = {
  provider_id: string;
  quantity: number;
};

type ServiceJob = {
  id: string;
  provider_id: string;
  status: string;
};

const PROVIDER_STATUSES = [
  "active",
  "inactive",
  "blocked",
];

const SERVICE_TYPES = [
  "Laptop Repair",
  "Screen Replacement",
  "Keyboard Replacement",
  "Painting",
  "Cleaning",
  "Refurbishment",
  "Data Destruction",
  "Soldering",
  "Diagnostics",
  "Other",
];

export default function ServiceProvidersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [providerStock, setProviderStock] = useState<ProviderStock[]>([]);
  const [serviceJobs, setServiceJobs] = useState<ServiceJob[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          router.replace("/login");
          return;
        }

        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership?.company_id) {
          throw new Error("No company membership found.");
        }

        const companyId = membership.company_id;

        const [
          providersResult,
          stockResult,
          jobsResult,
        ] = await Promise.all([
          supabase
            .from("service_providers")
            .select("*")
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("service_provider_stock")
            .select("provider_id, quantity")
            .eq("company_id", companyId),

          supabase
            .from("service_jobs")
            .select("id, provider_id, status")
            .eq("company_id", companyId),
        ]);

        if (providersResult.error) {
          throw providersResult.error;
        }

        if (stockResult.error) {
          throw stockResult.error;
        }

        if (jobsResult.error) {
          throw jobsResult.error;
        }

        setProviders(providersResult.data || []);
        setProviderStock(stockResult.data || []);
        setServiceJobs(jobsResult.data || []);
      } catch (err: unknown) {
        console.error(
          "Service providers page load error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Could not load service providers."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    // Load service provider data after the component mounts.
     
    void loadData();
  }, [loadData]);

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return providers.filter((provider) => {
      const matchesSearch =
        !query ||
        provider.provider_number
          .toLowerCase()
          .includes(query) ||
        provider.name
          .toLowerCase()
          .includes(query) ||
        provider.company_name
          ?.toLowerCase()
          .includes(query) ||
        provider.email
          ?.toLowerCase()
          .includes(query) ||
        provider.phone
          ?.toLowerCase()
          .includes(query) ||
        provider.whatsapp
          ?.toLowerCase()
          .includes(query) ||
        provider.service_types.some((type) =>
          type.toLowerCase().includes(query)
        );

      const matchesStatus =
        statusFilter === "all" ||
        provider.status === statusFilter;

      const matchesServiceType =
        serviceTypeFilter === "all" ||
        provider.service_types.includes(
          serviceTypeFilter
        );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesServiceType
      );
    });
  }, [
    providers,
    search,
    statusFilter,
    serviceTypeFilter,
  ]);

  const stats = useMemo(() => {
    const activeProviders = providers.filter(
      (provider) => provider.status === "active"
    ).length;

    const inactiveProviders = providers.filter(
      (provider) => provider.status === "inactive"
    ).length;

    const blockedProviders = providers.filter(
      (provider) => provider.status === "blocked"
    ).length;

    const totalUnitsWithProviders =
      providerStock.reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0
      );

    const providersHoldingStock = new Set(
      providerStock
        .filter(
          (item) => Number(item.quantity || 0) > 0
        )
        .map((item) => item.provider_id)
    ).size;

    const openJobs = serviceJobs.filter(
      (job) =>
        ![
          "completed",
          "cancelled",
        ].includes(job.status)
    ).length;

    return {
      activeProviders,
      inactiveProviders,
      blockedProviders,
      totalUnitsWithProviders,
      providersHoldingStock,
      openJobs,
    };
  }, [providers, providerStock, serviceJobs]);

  function getProviderStock(providerId: string) {
    return providerStock
      .filter(
        (item) => item.provider_id === providerId
      )
      .reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0
      );
  }

  function getProviderJobs(providerId: string) {
    return serviceJobs.filter(
      (job) =>
        job.provider_id === providerId
    ).length;
  }

  function getOpenProviderJobs(providerId: string) {
    return serviceJobs.filter(
      (job) =>
        job.provider_id === providerId &&
        ![
          "completed",
          "cancelled",
        ].includes(job.status)
    ).length;
  }

  function formatStatus(status: string) {
    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function getStatusClass(status: string) {
    switch (status) {
      case "active":
        return "status-active";

      case "inactive":
        return "status-inactive";

      case "blocked":
        return "status-blocked";

      default:
        return "status-inactive";
    }
  }

  function formatServiceTypes(
    serviceTypes: string[]
  ) {
    if (!serviceTypes?.length) {
      return "—";
    }

    if (serviceTypes.length <= 2) {
      return serviceTypes.join(", ");
    }

    return `${serviceTypes
      .slice(0, 2)
      .join(", ")} +${serviceTypes.length - 2}`;
  }

  function formatQuantity(quantity: number) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 3,
    }).format(quantity);
  }

  function createProvider() {
    router.push("/service-providers/new");
  }

  function openProvider(providerId: string) {
    router.push(
      `/service-providers/${providerId}`
    );
  }

  async function deleteProvider(
    provider: ServiceProvider
  ) {
    const stockCount = getProviderStock(
      provider.id
    );

    const jobCount = getProviderJobs(
      provider.id
    );

    if (stockCount > 0) {
      setError(
        `Cannot delete ${provider.name} because ${formatQuantity(
          stockCount
        )} unit${
          stockCount === 1 ? "" : "s"
        } are currently held by this provider.`
      );

      return;
    }

    if (jobCount > 0) {
      setError(
        `Cannot delete ${provider.name} because this provider has service job history. Set the provider to inactive instead.`
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete service provider ${provider.name}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership?.company_id) {
        throw new Error(
          "No company membership found."
        );
      }

      const { error: deleteError } =
        await supabase
          .from("service_providers")
          .delete()
          .eq("id", provider.id)
          .eq(
            "company_id",
            membership.company_id
          );

      if (deleteError) {
        throw deleteError;
      }

      setProviders((current) =>
        current.filter(
          (item) => item.id !== provider.id
        )
      );

      setSuccess(
        "Service provider deleted successfully."
      );

      setTimeout(() => {
        setSuccess("");
      }, 2500);
    } catch (err: unknown) {
      console.error(
        "Service provider delete error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not delete service provider."
      );
    }
  }

  return (
    <AppShell
      title="Service Providers"
      description="Manage repair shops, painters, refurbishers and other external service providers."
      actions={
        <button
          type="button"
          className="primary-button"
          onClick={createProvider}
        >
          + Add Service Provider
        </button>
      }
    >
      <section className="page-content">
        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">
              Total Providers
            </div>

            <div className="stat-value">
              {providers.length}
            </div>

            <div className="stat-description">
              All service provider records
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Active Providers
            </div>

            <div className="stat-value">
              {stats.activeProviders}
            </div>

            <div className="stat-description">
              Available for service work
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Stock With Providers
            </div>

            <div className="stat-value">
              {formatQuantity(
                stats.totalUnitsWithProviders
              )}
            </div>

            <div className="stat-description">
              Company-owned units currently outside
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Open Service Jobs
            </div>

            <div className="stat-value">
              {stats.openJobs}
            </div>

            <div className="stat-description">
              Work currently in progress
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Holding Stock
            </div>

            <div className="stat-value">
              {stats.providersHoldingStock}
            </div>

            <div className="stat-description">
              Providers currently holding units
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              Blocked
            </div>

            <div className="stat-value">
              {stats.blockedProviders}
            </div>

            <div className="stat-description">
              Providers unavailable for service
            </div>
          </div>
        </div>

        <section className="content-card">
          <div className="content-card-header">
            <div>
              <h2>All Service Providers</h2>

              <p>
                {filteredProviders.length}{" "}
                provider
                {filteredProviders.length ===
                1
                  ? ""
                  : "s"}{" "}
                found
              </p>
            </div>

            <div className="filters">
              <div className="search-box">
                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search providers..."
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All statuses
                </option>

                {PROVIDER_STATUSES.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {formatStatus(status)}
                    </option>
                  )
                )}
              </select>

              <select
                value={serviceTypeFilter}
                onChange={(event) =>
                  setServiceTypeFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All service types
                </option>

                {SERVICE_TYPES.map(
                  (serviceType) => (
                    <option
                      key={serviceType}
                      value={serviceType}
                    >
                      {serviceType}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void loadData(true)
                }
                disabled={refreshing}
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="loading-spinner" />

              <p>
                Loading service providers...
              </p>
            </div>
          ) : filteredProviders.length ===
            0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                ⚒
              </div>

              <h3>
                {search ||
                statusFilter !== "all" ||
                serviceTypeFilter !==
                  "all"
                  ? "No service providers found"
                  : "No service providers yet"}
              </h3>

              <p>
                {search ||
                statusFilter !== "all" ||
                serviceTypeFilter !==
                  "all"
                  ? "Try changing your search or filters."
                  : "Add your first service provider to start tracking outsourced work and company-owned stock."}
              </p>

              {!search &&
                statusFilter ===
                  "all" &&
                serviceTypeFilter ===
                  "all" && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={
                      createProvider
                    }
                  >
                    + Add Service Provider
                  </button>
                )}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Service Types</th>
                    <th>Contact</th>
                    <th>Stock With Provider</th>
                    <th>Jobs</th>
                    <th>Open Jobs</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProviders.map(
                    (provider) => {
                      const stock =
                        getProviderStock(
                          provider.id
                        );

                      const jobs =
                        getProviderJobs(
                          provider.id
                        );

                      const openJobs =
                        getOpenProviderJobs(
                          provider.id
                        );

                      return (
                        <tr
                          key={
                            provider.id
                          }
                        >
                          <td>
                            <div
                              style={{
                                display:
                                  "flex",
                                flexDirection:
                                  "column",
                                gap: 3,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  openProvider(
                                    provider.id
                                  )
                                }
                                style={{
                                  border:
                                    "none",
                                  background:
                                    "transparent",
                                  padding:
                                    0,
                                  margin:
                                    0,
                                  textAlign:
                                    "left",
                                  fontWeight:
                                    600,
                                  cursor:
                                    "pointer",
                                }}
                              >
                                {
                                  provider.name
                                }
                              </button>

                              <span
                                style={{
                                  fontSize:
                                    12,
                                  color:
                                    "#6b7280",
                                }}
                              >
                                {
                                  provider.provider_number
                                }
                                {provider.company_name
                                  ? ` · ${provider.company_name}`
                                  : ""}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              style={{
                                fontSize:
                                  13,
                                color:
                                  "#374151",
                              }}
                            >
                              {formatServiceTypes(
                                provider.service_types
                              )}
                            </span>
                          </td>

                          <td>
                            <div
                              style={{
                                display:
                                  "flex",
                                flexDirection:
                                  "column",
                                gap: 3,
                              }}
                            >
                              <span>
                                {provider.phone ||
                                  provider.whatsapp ||
                                  "—"}
                              </span>

                              {provider.email && (
                                <span
                                  style={{
                                    fontSize:
                                      12,
                                    color:
                                      "#6b7280",
                                  }}
                                >
                                  {
                                    provider.email
                                  }
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            <strong>
                              {formatQuantity(
                                stock
                              )}
                            </strong>
                          </td>

                          <td>
                            {jobs}
                          </td>

                          <td>
                            {openJobs}
                          </td>

                          <td>
                            <span
                              className={`status-badge ${getStatusClass(
                                provider.status
                              )}`}
                            >
                              {formatStatus(
                                provider.status
                              )}
                            </span>
                          </td>

                          <td>
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 8,
                              }}
                            >
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  openProvider(
                                    provider.id
                                  )
                                }
                              >
                                View
                              </button>

                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  router.push(
                                    `/service-providers/${provider.id}/edit`
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  void deleteProvider(
                                    provider
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
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
      </section>
    </AppShell>
  );
}