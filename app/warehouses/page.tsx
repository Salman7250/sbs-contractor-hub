"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  CircleOff,
  Edit3,
  FolderTree,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Star,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";

import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Warehouse = {
  id: string;
  company_id: string;
  name: string;
  code: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_default: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type WarehouseLocation = {
  id: string;
  company_id: string;
  warehouse_id: string;
  parent_location_id: string | null;
  name: string;
  code: string;
  location_type: LocationType;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LocationType =
  | "zone"
  | "aisle"
  | "rack"
  | "shelf"
  | "bin"
  | "staging"
  | "receiving"
  | "shipping"
  | "returns"
  | "quarantine"
  | "other";

type LocationForm = {
  name: string;
  code: string;
  location_type: LocationType;
  parent_location_id: string;
  is_active: boolean;
  notes: string;
};

const LOCATION_TYPES: {
  value: LocationType;
  label: string;
}[] = [
  { value: "zone", label: "Zone" },
  { value: "aisle", label: "Aisle" },
  { value: "rack", label: "Rack" },
  { value: "shelf", label: "Shelf" },
  { value: "bin", label: "Bin" },
  { value: "staging", label: "Staging" },
  { value: "receiving", label: "Receiving" },
  { value: "shipping", label: "Shipping" },
  { value: "returns", label: "Returns" },
  { value: "quarantine", label: "Quarantine" },
  { value: "other", label: "Other" },
];

const EMPTY_LOCATION_FORM: LocationForm = {
  name: "",
  code: "",
  location_type: "bin",
  parent_location_id: "",
  is_active: true,
  notes: "",
};

function locationTypeLabel(type: LocationType) {
  return (
    LOCATION_TYPES.find((item) => item.value === type)?.label ?? type
  );
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function formatAddress(warehouse: Warehouse) {
  return [
    warehouse.address_line1,
    warehouse.address_line2,
    warehouse.city,
    warehouse.state,
    warehouse.postal_code,
    warehouse.country,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function WarehousesPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [expandedWarehouses, setExpandedWarehouses] = useState<
    Record<string, boolean>
  >({});

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] =
    useState<Warehouse | null>(null);
  const [editingLocation, setEditingLocation] =
    useState<WarehouseLocation | null>(null);
  const [locationForm, setLocationForm] =
    useState<LocationForm>(EMPTY_LOCATION_FORM);

  const [warehouseMenuId, setWarehouseMenuId] = useState<string | null>(
    null
  );

  const getCompanyId = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Your session has expired. Please sign in again.");
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
      throw new Error("No company workspace is available for your account.");
    }

    return membership.company_id;
  }, [supabase]);

  const loadData = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }

      setErrorMessage("");

      try {
        const currentCompanyId = await getCompanyId();
        setCompanyId(currentCompanyId);

        const [
          { data: warehouseData, error: warehouseError },
          { data: locationData, error: locationError },
        ] = await Promise.all([
          supabase
            .from("warehouses")
            .select(
              `
                id,
                company_id,
                name,
                code,
                address_line1,
                address_line2,
                city,
                state,
                postal_code,
                country,
                phone,
                email,
                is_active,
                is_default,
                notes,
                created_at,
                updated_at
              `
            )
            .eq("company_id", currentCompanyId)
            .order("is_default", { ascending: false })
            .order("name", { ascending: true }),

          supabase
            .from("warehouse_locations")
            .select(
              `
                id,
                company_id,
                warehouse_id,
                parent_location_id,
                name,
                code,
                location_type,
                is_active,
                notes,
                created_at,
                updated_at
              `
            )
            .eq("company_id", currentCompanyId)
            .order("name", { ascending: true }),
        ]);

        if (warehouseError) {
          throw new Error(warehouseError.message);
        }

        if (locationError) {
          throw new Error(locationError.message);
        }

        setWarehouses((warehouseData ?? []) as Warehouse[]);
        setLocations((locationData ?? []) as WarehouseLocation[]);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load warehouses."
        );
      } finally {
        setLoading(false);
      }
    },
    [getCompanyId, supabase]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const filteredWarehouses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return warehouses.filter((warehouse) => {
      const matchesSearch =
        !query ||
        warehouse.name.toLowerCase().includes(query) ||
        warehouse.code.toLowerCase().includes(query) ||
        (warehouse.city ?? "").toLowerCase().includes(query) ||
        (warehouse.country ?? "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && warehouse.is_active) ||
        (statusFilter === "inactive" && !warehouse.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [warehouses, search, statusFilter]);

  const activeWarehouses = warehouses.filter(
    (warehouse) => warehouse.is_active
  ).length;

  const defaultWarehouses = warehouses.filter(
    (warehouse) => warehouse.is_default
  ).length;

  const activeLocations = locations.filter(
    (location) => location.is_active
  ).length;

  const warehousesWithLocations = warehouses.filter((warehouse) =>
    locations.some((location) => location.warehouse_id === warehouse.id)
  ).length;

  function getWarehouseLocations(warehouseId: string) {
    return locations.filter(
      (location) => location.warehouse_id === warehouseId
    );
  }

  function toggleWarehouseExpanded(warehouseId: string) {
    setExpandedWarehouses((current) => ({
      ...current,
      [warehouseId]: !current[warehouseId],
    }));
  }

  function openLocationManager(warehouse: Warehouse) {
    setSelectedWarehouse(warehouse);
    setEditingLocation(null);
    setLocationForm(EMPTY_LOCATION_FORM);
    setLocationModalOpen(true);
    setWarehouseMenuId(null);
  }

  function closeLocationManager() {
    if (saving) return;

    setLocationModalOpen(false);
    setSelectedWarehouse(null);
    setEditingLocation(null);
    setLocationForm(EMPTY_LOCATION_FORM);
  }

  function openNewLocation() {
    setEditingLocation(null);
    setLocationForm(EMPTY_LOCATION_FORM);
  }

  function openEditLocation(location: WarehouseLocation) {
    setEditingLocation(location);

    setLocationForm({
      name: location.name,
      code: location.code,
      location_type: location.location_type,
      parent_location_id: location.parent_location_id ?? "",
      is_active: location.is_active,
      notes: location.notes ?? "",
    });
  }

  function getDescendantIds(locationId: string) {
    const descendantIds = new Set<string>();

    function walk(parentId: string) {
      locations
        .filter(
          (location) => location.parent_location_id === parentId
        )
        .forEach((child) => {
          descendantIds.add(child.id);
          walk(child.id);
        });
    }

    walk(locationId);

    return descendantIds;
  }

  const availableParentLocations = useMemo(() => {
    if (!selectedWarehouse) return [];

    const warehouseLocations = getWarehouseLocations(
      selectedWarehouse.id
    );

    if (!editingLocation) {
      return warehouseLocations;
    }

    const excludedIds = new Set([
      editingLocation.id,
      ...getDescendantIds(editingLocation.id),
    ]);

    return warehouseLocations.filter(
      (location) => !excludedIds.has(location.id)
    );
  }, [selectedWarehouse, editingLocation, locations]);

  function buildLocationTree(
    parentId: string | null,
    warehouseLocations: WarehouseLocation[]
  ): WarehouseLocation[] {
    return warehouseLocations
      .filter(
        (location) =>
          location.parent_location_id === parentId
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderLocationTree(
    parentId: string | null,
    warehouseLocations: WarehouseLocation[],
    depth = 0
  ): React.ReactNode {
    const nodes = buildLocationTree(parentId, warehouseLocations);

    if (!nodes.length) return null;

    return nodes.map((location) => {
      const children = warehouseLocations.filter(
        (child) =>
          child.parent_location_id === location.id
      );

      return (
        <div key={location.id}>
          <div
            className="location-tree-row"
            style={{ paddingLeft: `${16 + depth * 28}px` }}
          >
            <div className="location-tree-main">
              <div className="location-tree-icon">
                <FolderTree size={16} />
              </div>

              <div className="location-tree-content">
                <div className="location-tree-name">
                  {location.name}
                </div>

                <div className="location-tree-meta">
                  <span>{location.code}</span>
                  <span>•</span>
                  <span>
                    {locationTypeLabel(location.location_type)}
                  </span>
                </div>
              </div>
            </div>

            <div className="location-tree-actions">
              <span
                className={`status-pill ${
                  location.is_active
                    ? "status-active"
                    : "status-inactive"
                }`}
              >
                {location.is_active ? "Active" : "Inactive"}
              </span>

              <button
                type="button"
                className="icon-button"
                title="Edit location"
                onClick={() => openEditLocation(location)}
              >
                <Edit3 size={15} />
              </button>
            </div>
          </div>

          {children.length > 0 &&
            renderLocationTree(
              location.id,
              warehouseLocations,
              depth + 1
            )}
        </div>
      );
    });
  }

  async function saveLocation() {
    if (!companyId || !selectedWarehouse) {
      setErrorMessage("Unable to determine the active company.");
      return;
    }

    const name = locationForm.name.trim();
    const code = normalizeCode(locationForm.code);

    if (!name) {
      setErrorMessage("Location name is required.");
      return;
    }

    if (!code) {
      setErrorMessage("Location code is required.");
      return;
    }

    if (
      locationForm.parent_location_id ===
      editingLocation?.id
    ) {
      setErrorMessage("A location cannot be its own parent.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const duplicate = locations.find(
        (location) =>
          location.warehouse_id === selectedWarehouse.id &&
          location.code.toUpperCase() === code &&
          location.id !== editingLocation?.id
      );

      if (duplicate) {
        throw new Error(
          `Location code "${code}" is already used in this warehouse.`
        );
      }

      if (editingLocation) {
        const { error } = await supabase
          .from("warehouse_locations")
          .update({
            name,
            code,
            location_type: locationForm.location_type,
            parent_location_id:
              locationForm.parent_location_id || null,
            is_active: locationForm.is_active,
            notes: locationForm.notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingLocation.id)
          .eq("warehouse_id", selectedWarehouse.id)
          .eq("company_id", companyId);

        if (error) {
          throw new Error(error.message);
        }

        setSuccessMessage("Location updated successfully.");
      } else {
        const { error } = await supabase
          .from("warehouse_locations")
          .insert({
            company_id: companyId,
            warehouse_id: selectedWarehouse.id,
            name,
            code,
            location_type: locationForm.location_type,
            parent_location_id:
              locationForm.parent_location_id || null,
            is_active: locationForm.is_active,
            notes: locationForm.notes.trim() || null,
          });

        if (error) {
          throw new Error(error.message);
        }

        setSuccessMessage("Location created successfully.");
      }

      setEditingLocation(null);
      setLocationForm(EMPTY_LOCATION_FORM);

      await loadData(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save location."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleWarehouseStatus(warehouse: Warehouse) {
    if (!companyId) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("warehouses")
        .update({
          is_active: !warehouse.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", warehouse.id)
        .eq("company_id", companyId);

      if (error) {
        throw new Error(error.message);
      }

      setSuccessMessage(
        warehouse.is_active
          ? "Warehouse deactivated."
          : "Warehouse activated."
      );

      await loadData(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update warehouse status."
      );
    } finally {
      setSaving(false);
      setWarehouseMenuId(null);
    }
  }

  async function setDefaultWarehouse(warehouse: Warehouse) {
    if (!companyId) return;

    if (!warehouse.is_active) {
      setErrorMessage(
        "Only an active warehouse can be made the default."
      );
      setWarehouseMenuId(null);
      return;
    }

    if (warehouse.is_default) {
      setWarehouseMenuId(null);
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error: clearError } = await supabase
        .from("warehouses")
        .update({
          is_default: false,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId)
        .eq("is_default", true);

      if (clearError) {
        throw new Error(clearError.message);
      }

      const { error: setError } = await supabase
        .from("warehouses")
        .update({
          is_default: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", warehouse.id)
        .eq("company_id", companyId);

      if (setError) {
        throw new Error(setError.message);
      }

      setSuccessMessage(
        `${warehouse.name} is now the default warehouse.`
      );

      await loadData(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to set the default warehouse."
      );
    } finally {
      setSaving(false);
      setWarehouseMenuId(null);
    }
  }

  return (
    <AppShell>
      <div className="page-content warehouses-page">
        <div className="page-header">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Inventory Infrastructure
            </div>

            <h1 className="page-title">Warehouses</h1>

            <p className="page-subtitle">
              Manage physical warehouses and their internal
              storage hierarchy.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => router.push("/warehouses/new")}
          >
            <Plus size={17} />
            New Warehouse
          </button>
        </div>

        {successMessage && (
          <div className="alert success-alert">
            <Check size={17} />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="alert error-alert">
            <X size={17} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <WarehouseIcon size={19} />
            </div>
            <div>
              <div className="stat-label">Total Warehouses</div>
              <div className="stat-value">{warehouses.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Check size={19} />
            </div>
            <div>
              <div className="stat-label">Active</div>
              <div className="stat-value">
                {activeWarehouses}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Star size={19} />
            </div>
            <div>
              <div className="stat-label">Default</div>
              <div className="stat-value">
                {defaultWarehouses}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <MapPin size={19} />
            </div>
            <div>
              <div className="stat-label">Total Locations</div>
              <div className="stat-value">{locations.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FolderTree size={19} />
            </div>
            <div>
              <div className="stat-label">Active Locations</div>
              <div className="stat-value">
                {activeLocations}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Package size={19} />
            </div>
            <div>
              <div className="stat-label">
                Warehouses with Locations
              </div>
              <div className="stat-value">
                {warehousesWithLocations}
              </div>
            </div>
          </div>
        </div>

        <div className="toolbar-card">
          <div className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search warehouses..."
            />
            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch("")}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "all"
                  | "active"
                  | "inactive"
              )
            }
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <div className="toolbar-spacer" />

          <div className="result-count">
            {filteredWarehouses.length} warehouse
            {filteredWarehouses.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="content-card">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <span>Loading warehouses...</span>
            </div>
          ) : filteredWarehouses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <WarehouseIcon size={26} />
              </div>

              <h3>
                {warehouses.length === 0
                  ? "No warehouses yet"
                  : "No warehouses found"}
              </h3>

              <p>
                {warehouses.length === 0
                  ? "Create your first warehouse to start managing physical inventory locations."
                  : "Try changing your search or status filter."}
              </p>

              {warehouses.length === 0 && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    router.push("/warehouses/new")
                  }
                >
                  <Plus size={17} />
                  Create Warehouse
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th>Code</th>
                    <th>Location</th>
                    <th>Storage Locations</th>
                    <th>Status</th>
                    <th>Default</th>
                    <th className="actions-column">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredWarehouses.map((warehouse) => {
                    const warehouseLocations =
                      getWarehouseLocations(warehouse.id);

                    const isExpanded =
                      !!expandedWarehouses[warehouse.id];

                    return (
                      <tr key={warehouse.id}>
                        <td>
                          <div className="warehouse-name-cell">
                            <button
                              type="button"
                              className="expand-button"
                              onClick={() =>
                                toggleWarehouseExpanded(
                                  warehouse.id
                                )
                              }
                              title={
                                isExpanded
                                  ? "Collapse locations"
                                  : "Show locations"
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              )}
                            </button>

                            <div className="warehouse-avatar">
                              <WarehouseIcon size={18} />
                            </div>

                            <div>
                              <div className="warehouse-name">
                                {warehouse.name}
                              </div>

                              {formatAddress(warehouse) && (
                                <div className="warehouse-address">
                                  {formatAddress(warehouse)}
                                </div>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="inline-location-panel">
                              {warehouseLocations.length ===
                              0 ? (
                                <div className="inline-empty">
                                  <MapPin size={15} />
                                  <span>
                                    No storage locations
                                    configured.
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openLocationManager(
                                        warehouse
                                      )
                                    }
                                  >
                                    Add location
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-location-list">
                                  {renderLocationTree(
                                    null,
                                    warehouseLocations
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className="code-badge">
                            {warehouse.code}
                          </span>
                        </td>

                        <td>
                          <div className="location-cell">
                            <MapPin size={15} />
                            <span>
                              {warehouse.city ||
                              warehouse.country ||
                              "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="location-count">
                            <FolderTree size={15} />
                            <span>
                              {warehouseLocations.length}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`status-pill ${
                              warehouse.is_active
                                ? "status-active"
                                : "status-inactive"
                            }`}
                          >
                            {warehouse.is_active
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        <td>
                          {warehouse.is_default ? (
                            <span className="default-badge">
                              <Star size={13} />
                              Default
                            </span>
                          ) : (
                            <span className="muted-text">
                              —
                            </span>
                          )}
                        </td>

                        <td className="actions-column">
                          <div className="action-menu-wrap">
                            <button
                              type="button"
                              className="icon-button"
                              title="Warehouse actions"
                              onClick={() =>
                                setWarehouseMenuId(
                                  warehouseMenuId ===
                                    warehouse.id
                                    ? null
                                    : warehouse.id
                                )
                              }
                            >
                              <MoreHorizontal size={17} />
                            </button>

                            {warehouseMenuId ===
                              warehouse.id && (
                              <div className="action-menu">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWarehouseMenuId(
                                      null
                                    );
                                    openLocationManager(
                                      warehouse
                                    );
                                  }}
                                >
                                  <FolderTree size={15} />
                                  Manage Locations
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setWarehouseMenuId(
                                      null
                                    );
                                    router.push(
                                      `/warehouses/${warehouse.id}/edit`
                                    );
                                  }}
                                >
                                  <Edit3 size={15} />
                                  Edit Warehouse
                                </button>

                                {!warehouse.is_default && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void setDefaultWarehouse(
                                        warehouse
                                      )
                                    }
                                  >
                                    <Star size={15} />
                                    Make Default
                                  </button>
                                )}

                                <div className="menu-divider" />

                                <button
                                  type="button"
                                  className={
                                    warehouse.is_active
                                      ? "danger-menu-item"
                                      : ""
                                  }
                                  onClick={() =>
                                    void toggleWarehouseStatus(
                                      warehouse
                                    )
                                  }
                                >
                                  {warehouse.is_active ? (
                                    <>
                                      <CircleOff
                                        size={15}
                                      />
                                      Deactivate
                                    </>
                                  ) : (
                                    <>
                                      <Check size={15} />
                                      Activate
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {locationModalOpen && selectedWarehouse && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeLocationManager();
              }
            }}
          >
            <div className="location-modal">
              <div className="modal-header">
                <div>
                  <div className="modal-eyebrow">
                    Warehouse Locations
                  </div>

                  <h2>{selectedWarehouse.name}</h2>

                  <p>
                    Build and maintain the internal storage
                    hierarchy for this warehouse.
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-button modal-close"
                  onClick={closeLocationManager}
                  disabled={saving}
                >
                  <X size={19} />
                </button>
              </div>

              <div className="modal-body">
                <div className="location-manager-grid">
                  <div className="location-tree-card">
                    <div className="section-header">
                      <div>
                        <h3>Location Hierarchy</h3>
                        <p>
                          Warehouse storage structure
                        </p>
                      </div>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={openNewLocation}
                      >
                        <Plus size={15} />
                        Add Location
                      </button>
                    </div>

                    <div className="location-tree-container">
                      {getWarehouseLocations(
                        selectedWarehouse.id
                      ).length === 0 ? (
                        <div className="tree-empty">
                          <FolderTree size={25} />
                          <strong>
                            No locations configured
                          </strong>
                          <span>
                            Add a zone, receiving area,
                            bin, rack, or another storage
                            location.
                          </span>
                        </div>
                      ) : (
                        renderLocationTree(
                          null,
                          getWarehouseLocations(
                            selectedWarehouse.id
                          )
                        )
                      )}
                    </div>
                  </div>

                  <div className="location-form-card">
                    <div className="section-header">
                      <div>
                        <h3>
                          {editingLocation
                            ? "Edit Location"
                            : "New Location"}
                        </h3>

                        <p>
                          {editingLocation
                            ? "Update this storage location."
                            : "Add a location to the hierarchy."}
                        </p>
                      </div>
                    </div>

                    <div className="form-grid">
                      <div className="field full-width">
                        <label>Location Name *</label>
                        <input
                          value={locationForm.name}
                          onChange={(event) =>
                            setLocationForm(
                              (current) => ({
                                ...current,
                                name: event.target.value,
                              })
                            )
                          }
                          placeholder="e.g. Rack A"
                        />
                      </div>

                      <div className="field">
                        <label>Location Code *</label>
                        <input
                          value={locationForm.code}
                          onChange={(event) =>
                            setLocationForm(
                              (current) => ({
                                ...current,
                                code: event.target.value.toUpperCase(),
                              })
                            )
                          }
                          placeholder="e.g. RACK-A"
                        />
                      </div>

                      <div className="field">
                        <label>Location Type *</label>
                        <select
                          value={locationForm.location_type}
                          onChange={(event) =>
                            setLocationForm(
                              (current) => ({
                                ...current,
                                location_type:
                                  event.target.value as LocationType,
                              })
                            )
                          }
                        >
                          {LOCATION_TYPES.map((type) => (
                            <option
                              key={type.value}
                              value={type.value}
                            >
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="field full-width">
                        <label>Parent Location</label>
                        <select
                          value={
                            locationForm.parent_location_id
                          }
                          onChange={(event) =>
                            setLocationForm(
                              (current) => ({
                                ...current,
                                parent_location_id:
                                  event.target.value,
                              })
                            )
                          }
                        >
                          <option value="">
                            Top Level Location
                          </option>

                          {availableParentLocations.map(
                            (location) => (
                              <option
                                key={location.id}
                                value={location.id}
                              >
                                {location.name} (
                                {location.code})
                              </option>
                            )
                          )}
                        </select>

                        <span className="field-help">
                          Leave empty for a top-level
                          location.
                        </span>
                      </div>

                      <div className="field full-width">
                        <label>Notes</label>
                        <textarea
                          value={locationForm.notes}
                          onChange={(event) =>
                            setLocationForm(
                              (current) => ({
                                ...current,
                                notes: event.target.value,
                              })
                            )
                          }
                          rows={4}
                          placeholder="Optional notes about this location..."
                        />
                      </div>

                      <div className="checkbox-field full-width">
                        <label>
                          <input
                            type="checkbox"
                            checked={locationForm.is_active}
                            onChange={(event) =>
                              setLocationForm(
                                (current) => ({
                                  ...current,
                                  is_active:
                                    event.target.checked,
                                })
                              )
                            }
                          />
                          <span>
                            <strong>Active location</strong>
                            <small>
                              Inventory can use this
                              location when it is active.
                            </small>
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="form-actions">
                      {editingLocation && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={openNewLocation}
                          disabled={saving}
                        >
                          Cancel Edit
                        </button>
                      )}

                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void saveLocation()}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <span className="button-spinner" />
                            Saving...
                          </>
                        ) : editingLocation ? (
                          <>
                            <Check size={16} />
                            Save Changes
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            Create Location
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <div className="footer-info">
                  <Archive size={15} />
                  Locations are managed inside the warehouse
                  and remain available to Inventory V2.
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeLocationManager}
                  disabled={saving}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .warehouses-page {
            width: 100%;
          }

          .page-header {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 24px;
            margin-bottom: 22px;
          }

          .eyebrow {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 7px;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .eyebrow-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #166534;
          }

          .page-title {
            margin: 0;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.15;
            font-weight: 750;
            letter-spacing: -0.03em;
          }

          .page-subtitle {
            margin: 7px 0 0;
            color: #64748b;
            font-size: 14px;
            line-height: 1.6;
          }

          .primary-button,
          .secondary-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            min-height: 40px;
            padding: 0 15px;
            border-radius: 9px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition:
              background 0.15s ease,
              border-color 0.15s ease,
              opacity 0.15s ease;
          }

          .primary-button {
            border: 1px solid #166534;
            background: #166534;
            color: white;
          }

          .primary-button:hover {
            background: #14532d;
            border-color: #14532d;
          }

          .primary-button:disabled,
          .secondary-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .secondary-button {
            border: 1px solid #d1d5db;
            background: white;
            color: #334155;
          }

          .secondary-button:hover {
            background: #f8fafc;
            border-color: #94a3b8;
          }

          .alert {
            display: flex;
            align-items: center;
            gap: 9px;
            padding: 11px 14px;
            margin-bottom: 16px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 600;
          }

          .success-alert {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #166534;
          }

          .error-alert {
            border: 1px solid #fecaca;
            background: #fef2f2;
            color: #b91c1c;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 16px;
          }

          .stat-card {
            display: flex;
            align-items: center;
            gap: 12px;
            min-height: 86px;
            padding: 15px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: white;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
          }

          .stat-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
            border: 1px solid #dcfce7;
            border-radius: 10px;
            background: #f0fdf4;
            color: #166534;
          }

          .stat-label {
            margin-bottom: 4px;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.3;
          }

          .stat-value {
            color: #0f172a;
            font-size: 22px;
            line-height: 1;
            font-weight: 750;
          }

          .toolbar-card {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 13px;
            margin-bottom: 16px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: white;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
          }

          .search-box {
            position: relative;
            display: flex;
            align-items: center;
            width: min(430px, 100%);
            height: 40px;
            padding: 0 11px;
            gap: 8px;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            background: white;
            color: #94a3b8;
          }

          .search-box:focus-within {
            border-color: #86a68f;
            box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
          }

          .search-box input {
            width: 100%;
            border: 0;
            outline: 0;
            color: #0f172a;
            background: transparent;
            font-size: 13px;
          }

          .search-box input::placeholder {
            color: #94a3b8;
          }

          .clear-search {
            display: flex;
            align-items: center;
            justify-content: center;
            border: 0;
            padding: 3px;
            background: transparent;
            color: #94a3b8;
            cursor: pointer;
          }

          .filter-select,
          .field select,
          .field input,
          .field textarea {
            width: 100%;
            border: 1px solid #d1d5db;
            border-radius: 9px;
            outline: none;
            background: white;
            color: #0f172a;
            font-size: 13px;
          }

          .filter-select {
            width: auto;
            min-width: 150px;
            height: 40px;
            padding: 0 11px;
          }

          .filter-select:focus,
          .field select:focus,
          .field input:focus,
          .field textarea:focus {
            border-color: #86a68f;
            box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
          }

          .toolbar-spacer {
            flex: 1;
          }

          .result-count {
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
          }

          .content-card {
            overflow: visible;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: white;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035);
          }

          .table-wrap {
            overflow-x: auto;
          }

          table {
            width: 100%;
            min-width: 1100px;
            border-collapse: separate;
            border-spacing: 0;
          }

          th {
            padding: 13px 16px;
            border-bottom: 1px solid #e5e7eb;
            background: #f8fafc;
            color: #64748b;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.04em;
            text-align: left;
            text-transform: uppercase;
            white-space: nowrap;
          }

          th:first-child {
            border-top-left-radius: 14px;
          }

          th:last-child {
            border-top-right-radius: 14px;
          }

          td {
            position: relative;
            padding: 15px 16px;
            border-bottom: 1px solid #eef2f7;
            color: #334155;
            font-size: 13px;
            vertical-align: middle;
          }

          tbody tr:last-child td {
            border-bottom: 0;
          }

          tbody tr:hover {
            background: #fafdfb;
          }

          .warehouse-name-cell {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 260px;
          }

          .expand-button,
          .icon-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: white;
            color: #64748b;
            cursor: pointer;
          }

          .expand-button {
            width: 28px;
            height: 28px;
            flex: 0 0 28px;
          }

          .icon-button {
            width: 34px;
            height: 34px;
          }

          .expand-button:hover,
          .icon-button:hover {
            border-color: #cbd5e1;
            background: #f8fafc;
            color: #334155;
          }

          .warehouse-avatar {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
            border-radius: 10px;
            background: #f0fdf4;
            color: #166534;
          }

          .warehouse-name {
            color: #0f172a;
            font-size: 13px;
            font-weight: 750;
          }

          .warehouse-address {
            max-width: 270px;
            margin-top: 3px;
            overflow: hidden;
            color: #94a3b8;
            font-size: 11px;
            line-height: 1.4;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .code-badge {
            display: inline-flex;
            align-items: center;
            min-height: 26px;
            padding: 0 8px;
            border: 1px solid #e2e8f0;
            border-radius: 7px;
            background: #f8fafc;
            color: #334155;
            font-family: ui-monospace, SFMono-Regular, Menlo,
              Monaco, Consolas, monospace;
            font-size: 11px;
            font-weight: 700;
          }

          .location-cell,
          .location-count {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            color: #64748b;
          }

          .status-pill,
          .default-badge {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-height: 25px;
            padding: 0 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
          }

          .status-active {
            border: 1px solid #bbf7d0;
            background: #f0fdf4;
            color: #166534;
          }

          .status-inactive {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            color: #64748b;
          }

          .default-badge {
            border: 1px solid #fde68a;
            background: #fffbeb;
            color: #92400e;
          }

          .muted-text {
            color: #cbd5e1;
          }

          .actions-column {
            width: 70px;
            text-align: right;
          }

          .action-menu-wrap {
            position: relative;
            display: flex;
            justify-content: flex-end;
          }

          .action-menu {
            position: absolute;
            z-index: 20;
            top: calc(100% + 7px);
            right: 0;
            width: 190px;
            padding: 6px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            background: white;
            box-shadow:
              0 12px 30px rgba(15, 23, 42, 0.12),
              0 2px 8px rgba(15, 23, 42, 0.06);
          }

          .action-menu button {
            display: flex;
            align-items: center;
            width: 100%;
            gap: 9px;
            padding: 9px 10px;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: #334155;
            font-size: 12px;
            font-weight: 600;
            text-align: left;
            cursor: pointer;
          }

          .action-menu button:hover {
            background: #f8fafc;
          }

          .action-menu .danger-menu-item {
            color: #b91c1c;
          }

          .menu-divider {
            height: 1px;
            margin: 5px 0;
            background: #eef2f7;
          }

          .inline-location-panel {
            margin: 13px 0 0 38px;
            padding: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #f8fafc;
          }

          .inline-empty {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #64748b;
            font-size: 12px;
          }

          .inline-empty button {
            margin-left: auto;
            border: 0;
            background: transparent;
            color: #166534;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
          }

          .inline-location-list {
            overflow: hidden;
            border-radius: 7px;
            background: white;
          }

          .location-tree-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 48px;
            padding-top: 6px;
            padding-right: 8px;
            padding-bottom: 6px;
            border-bottom: 1px solid #eef2f7;
            gap: 12px;
          }

          .location-tree-row:last-child {
            border-bottom: 0;
          }

          .location-tree-main {
            display: flex;
            align-items: center;
            gap: 9px;
            min-width: 0;
          }

          .location-tree-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            flex: 0 0 28px;
            border-radius: 7px;
            background: #f0fdf4;
            color: #166534;
          }

          .location-tree-content {
            min-width: 0;
          }

          .location-tree-name {
            color: #334155;
            font-size: 12px;
            font-weight: 700;
          }

          .location-tree-meta {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-top: 2px;
            color: #94a3b8;
            font-size: 10px;
          }

          .location-tree-actions {
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 360px;
            gap: 10px;
            color: #64748b;
            font-size: 13px;
          }

          .spinner,
          .button-spinner {
            border: 2px solid #dcfce7;
            border-top-color: #166534;
            border-radius: 999px;
            animation: spin 0.75s linear infinite;
          }

          .spinner {
            width: 18px;
            height: 18px;
          }

          .button-spinner {
            width: 14px;
            height: 14px;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 390px;
            padding: 40px;
            text-align: center;
          }

          .empty-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            margin-bottom: 14px;
            border-radius: 14px;
            background: #f0fdf4;
            color: #166534;
          }

          .empty-state h3 {
            margin: 0 0 6px;
            color: #0f172a;
            font-size: 16px;
          }

          .empty-state p {
            max-width: 430px;
            margin: 0 0 18px;
            color: #64748b;
            font-size: 13px;
            line-height: 1.6;
          }

          .modal-backdrop {
            position: fixed;
            z-index: 100;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: rgba(15, 23, 42, 0.42);
          }

          .location-modal {
            display: flex;
            flex-direction: column;
            width: min(1120px, 100%);
            max-height: calc(100vh - 48px);
            overflow: hidden;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            background: white;
            box-shadow:
              0 25px 70px rgba(15, 23, 42, 0.2),
              0 5px 20px rgba(15, 23, 42, 0.08);
          }

          .modal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            padding: 22px 24px;
            border-bottom: 1px solid #e5e7eb;
          }

          .modal-eyebrow {
            margin-bottom: 5px;
            color: #166534;
            font-size: 11px;
            font-weight: 750;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .modal-header h2 {
            margin: 0;
            color: #0f172a;
            font-size: 21px;
            letter-spacing: -0.02em;
          }

          .modal-header p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          .modal-close {
            flex: 0 0 34px;
          }

          .modal-body {
            min-height: 0;
            overflow-y: auto;
            padding: 20px 24px;
          }

          .location-manager-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.75fr);
            gap: 16px;
          }

          .location-tree-card,
          .location-form-card {
            border: 1px solid #e5e7eb;
            border-radius: 13px;
            background: white;
          }

          .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 16px;
            border-bottom: 1px solid #eef2f7;
          }

          .section-header h3 {
            margin: 0;
            color: #0f172a;
            font-size: 14px;
          }

          .section-header p {
            margin: 3px 0 0;
            color: #94a3b8;
            font-size: 11px;
          }

          .location-tree-container {
            max-height: 500px;
            overflow-y: auto;
            padding: 8px;
          }

          .tree-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 270px;
            padding: 30px;
            color: #94a3b8;
            text-align: center;
          }

          .tree-empty strong {
            margin-top: 12px;
            color: #334155;
            font-size: 13px;
          }

          .tree-empty span {
            max-width: 300px;
            margin-top: 5px;
            font-size: 11px;
            line-height: 1.5;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            padding: 17px;
          }

          .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .field.full-width {
            grid-column: 1 / -1;
          }

          .field label {
            color: #334155;
            font-size: 11px;
            font-weight: 750;
          }

          .field input,
          .field select {
            height: 40px;
            padding: 0 11px;
          }

          .field textarea {
            padding: 10px 11px;
            resize: vertical;
          }

          .field-help {
            color: #94a3b8;
            font-size: 10px;
            line-height: 1.4;
          }

          .checkbox-field {
            padding-top: 2px;
          }

          .checkbox-field label {
            display: flex;
            align-items: flex-start;
            gap: 9px;
            cursor: pointer;
          }

          .checkbox-field input {
            width: 16px;
            height: 16px;
            margin: 1px 0 0;
            accent-color: #166534;
          }

          .checkbox-field span {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .checkbox-field strong {
            color: #334155;
            font-size: 12px;
          }

          .checkbox-field small {
            color: #94a3b8;
            font-size: 10px;
          }

          .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 15px 17px;
            border-top: 1px solid #eef2f7;
          }

          .modal-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 13px 24px;
            border-top: 1px solid #e5e7eb;
            background: #f8fafc;
          }

          .footer-info {
            display: flex;
            align-items: center;
            gap: 7px;
            color: #64748b;
            font-size: 11px;
          }

          @media (max-width: 1200px) {
            .stats-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }

          @media (max-width: 900px) {
            .page-header {
              align-items: flex-start;
              flex-direction: column;
            }

            .location-manager-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 700px) {
            .stats-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .toolbar-card {
              align-items: stretch;
              flex-direction: column;
            }

            .search-box,
            .filter-select {
              width: 100%;
            }

            .toolbar-spacer {
              display: none;
            }

            .result-count {
              align-self: flex-start;
            }

            .modal-backdrop {
              padding: 10px;
            }

            .location-modal {
              max-height: calc(100vh - 20px);
            }

            .modal-header,
            .modal-body,
            .modal-footer {
              padding-left: 15px;
              padding-right: 15px;
            }

            .form-grid {
              grid-template-columns: 1fr;
            }

            .field.full-width {
              grid-column: auto;
            }

            .modal-footer {
              align-items: flex-start;
              flex-direction: column;
            }
          }

          @media (max-width: 480px) {
            .stats-grid {
              grid-template-columns: 1fr;
            }

            .page-title {
              font-size: 26px;
            }
          }
        `}</style>
      </div>
    </AppShell>
  );
}