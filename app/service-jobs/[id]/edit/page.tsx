"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type Provider = {
  id: string;
  name: string;
  company_name: string | null;
  status: "active" | "inactive" | "blocked";
};

type Customer = {
  id: string;
  name: string;
};

type ServiceJob = {
  id: string;
  company_id: string;
  job_number: string;
  provider_id: string;
  customer_id: string | null;
  source:
    | "internal"
    | "repair"
    | "warranty"
    | "rma"
    | "purchase"
    | "other";
  service_type: string;
  status:
    | "draft"
    | "open"
    | "in_progress"
    | "awaiting_return"
    | "partially_returned"
    | "completed"
    | "cancelled";
  priority:
    | "low"
    | "normal"
    | "high"
    | "urgent";
  dispatched_date: string | null;
  expected_return_date: string | null;
  completed_date: string | null;
  notes: string | null;
  internal_notes: string | null;
  estimated_cost: number;
  actual_cost: number;
};

type JobItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  serialized_unit_id: string | null;
  quantity: number;
  quantity_completed: number;
  quantity_failed: number;
  quantity_damaged: number;
  service_description: string | null;
  unit_service_cost: number;
  notes: string | null;
};

type Product = {
  id: string;
  name: string;
};

type Variant = {
  id: string;
  product_id: string;
  name: string | null;
  sku: string | null;
};

function statusLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase(),
    );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function EditServiceJobPage() {
  const params = useParams();
  const router = useRouter();

  const serviceJobId = String(
    params?.id ?? "",
  );

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [companyId, setCompanyId] =
    useState("");

  const [job, setJob] =
    useState<ServiceJob | null>(null);

  const [providers, setProviders] =
    useState<Provider[]>([]);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [items, setItems] =
    useState<JobItem[]>([]);

  const [products, setProducts] =
    useState<Record<string, Product>>({});

  const [variants, setVariants] =
    useState<Record<string, Variant>>({});

  const [hasDispatches, setHasDispatches] =
    useState(false);

  const [hasReturns, setHasReturns] =
    useState(false);

  const [providerId, setProviderId] =
    useState("");

  const [customerId, setCustomerId] =
    useState("");

  const [source, setSource] =
    useState<ServiceJob["source"]>(
      "internal",
    );

  const [serviceType, setServiceType] =
    useState("");

  const [status, setStatus] =
    useState<ServiceJob["status"]>(
      "open",
    );

  const [priority, setPriority] =
    useState<ServiceJob["priority"]>(
      "normal",
    );

  const [expectedReturnDate, setExpectedReturnDate] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [internalNotes, setInternalNotes] =
    useState("");

  const [estimatedCost, setEstimatedCost] =
    useState("0");

  const loadData = useCallback(
    async () => {
      if (!serviceJobId) return;

      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        const {
          data: memberships,
          error: membershipError,
        } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1);

        if (membershipError) {
          throw new Error(
            membershipError.message,
          );
        }

        const currentCompanyId =
          memberships?.[0]?.company_id;

        if (!currentCompanyId) {
          throw new Error(
            "No company membership was found.",
          );
        }

        setCompanyId(
          currentCompanyId,
        );

        const [
          jobResult,
          providerResult,
          customerResult,
          itemResult,
          dispatchResult,
          returnResult,
        ] = await Promise.all([
          supabase
            .from("service_jobs")
            .select(
              "id,company_id,job_number,provider_id,customer_id,source,service_type,status,priority,dispatched_date,expected_return_date,completed_date,notes,internal_notes,estimated_cost,actual_cost",
            )
            .eq(
              "id",
              serviceJobId,
            )
            .eq(
              "company_id",
              currentCompanyId,
            )
            .maybeSingle(),

          supabase
            .from("service_providers")
            .select(
              "id,name,company_name,status",
            )
            .eq(
              "company_id",
              currentCompanyId,
            )
            .order("name"),

          supabase
            .from("customers")
            .select("id,name")
            .eq(
              "company_id",
              currentCompanyId,
            )
            .order("name"),

          supabase
            .from("service_job_items")
            .select(
              "id,product_id,variant_id,serialized_unit_id,quantity,quantity_completed,quantity_failed,quantity_damaged,service_description,unit_service_cost,notes",
            )
            .eq(
              "company_id",
              currentCompanyId,
            )
            .eq(
              "service_job_id",
              serviceJobId,
            )
            .order("created_at"),

          supabase
            .from("service_dispatches")
            .select("id")
            .eq(
              "company_id",
              currentCompanyId,
            )
            .eq(
              "service_job_id",
              serviceJobId,
            )
            .limit(1),

          supabase
            .from("service_returns")
            .select("id")
            .eq(
              "company_id",
              currentCompanyId,
            )
            .eq(
              "service_job_id",
              serviceJobId,
            )
            .limit(1),
        ]);

        if (jobResult.error) {
          throw new Error(
            jobResult.error.message,
          );
        }

        if (!jobResult.data) {
          throw new Error(
            "Service job not found.",
          );
        }

        if (providerResult.error) {
          throw new Error(
            providerResult.error.message,
          );
        }

        if (customerResult.error) {
          throw new Error(
            customerResult.error.message,
          );
        }

        if (itemResult.error) {
          throw new Error(
            itemResult.error.message,
          );
        }

        if (dispatchResult.error) {
          throw new Error(
            dispatchResult.error.message,
          );
        }

        if (returnResult.error) {
          throw new Error(
            returnResult.error.message,
          );
        }

        const jobData =
          jobResult.data as ServiceJob;

        const itemData =
          (itemResult.data ??
            []) as JobItem[];

        setJob(jobData);
        setProviders(
          providerResult.data ?? [],
        );
        setCustomers(
          customerResult.data ?? [],
        );
        setItems(itemData);

        setHasDispatches(
          (dispatchResult.data ??
            []).length > 0,
        );

        setHasReturns(
          (returnResult.data ??
            []).length > 0,
        );

        setProviderId(
          jobData.provider_id,
        );

        setCustomerId(
          jobData.customer_id ?? "",
        );

        setSource(jobData.source);
        setServiceType(
          jobData.service_type,
        );
        setStatus(jobData.status);
        setPriority(jobData.priority);

        setExpectedReturnDate(
          jobData.expected_return_date ??
            "",
        );

        setNotes(jobData.notes ?? "");
        setInternalNotes(
          jobData.internal_notes ?? "",
        );

        setEstimatedCost(
          String(
            jobData.estimated_cost ??
              0,
          ),
        );

        const productIds =
          Array.from(
            new Set(
              itemData.map(
                (item) =>
                  item.product_id,
              ),
            ),
          );

        const variantIds =
          Array.from(
            new Set(
              itemData
                .map(
                  (item) =>
                    item.variant_id,
                )
                .filter(Boolean),
            ),
          ) as string[];

        const [
          productResult,
          variantResult,
        ] = await Promise.all([
          productIds.length
            ? supabase
                .from("products")
                .select("id,name")
                .eq(
                  "company_id",
                  currentCompanyId,
                )
                .in(
                  "id",
                  productIds,
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),

          variantIds.length
            ? supabase
                .from(
                  "product_variants",
                )
                .select(
                  "id,product_id,name,sku",
                )
                .eq(
                  "company_id",
                  currentCompanyId,
                )
                .in(
                  "id",
                  variantIds,
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

        if (productResult.error) {
          throw new Error(
            productResult.error.message,
          );
        }

        if (variantResult.error) {
          throw new Error(
            variantResult.error.message,
          );
        }

        const productMap: Record<
          string,
          Product
        > = {};

        for (const product of
          productResult.data ?? []) {
          productMap[product.id] =
            product;
        }

        const variantMap: Record<
          string,
          Variant
        > = {};

        for (const variant of
          variantResult.data ?? []) {
          variantMap[variant.id] =
            variant;
        }

        setProducts(productMap);
        setVariants(variantMap);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load service job.",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      router,
      serviceJobId,
      supabase,
    ],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dispatchedQuantity =
    useMemo(
      () =>
        items.reduce(
          (sum, item) =>
            sum +
            Number(
              item.quantity_completed ||
                0,
            ) +
            Number(
              item.quantity_failed ||
                0,
            ) +
            Number(
              item.quantity_damaged ||
                0,
            ),
          0,
        ),
      [items],
    );

  const itemCount = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity || 0),
        0,
      ),
    [items],
  );

  const canChangeProvider =
    !hasDispatches &&
    !hasReturns;

  const canChangeCustomer =
    !hasDispatches &&
    !hasReturns;

  const canChangeStatus =
    !hasReturns &&
    status !== "completed" &&
    status !== "cancelled";

  const handleSave = async (
    event: React.FormEvent,
  ) => {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (!job) {
        throw new Error(
          "Service job was not loaded.",
        );
      }

      if (!companyId) {
        throw new Error(
          "Company could not be resolved.",
        );
      }

      if (!serviceType.trim()) {
        throw new Error(
          "Service type is required.",
        );
      }

      if (!providerId) {
        throw new Error(
          "Service provider is required.",
        );
      }

      const parsedEstimatedCost =
        Number(
          estimatedCost || 0,
        );

      if (
        Number.isNaN(
          parsedEstimatedCost,
        ) ||
        parsedEstimatedCost < 0
      ) {
        throw new Error(
          "Estimated cost must be a valid non-negative number.",
        );
      }

      if (
        expectedReturnDate &&
        job.dispatched_date &&
        expectedReturnDate <
          job.dispatched_date
      ) {
        throw new Error(
          "Expected return date cannot be before the dispatch date.",
        );
      }

      if (
        hasReturns &&
        status !== job.status
      ) {
        throw new Error(
          "Status cannot be changed after a return has been recorded.",
        );
      }

      if (
        job.status === "completed" &&
        status !== "completed"
      ) {
        throw new Error(
          "A completed service job cannot be reopened from this page.",
        );
      }

      if (
        job.status === "cancelled" &&
        status !== "cancelled"
      ) {
        throw new Error(
          "A cancelled service job cannot be reopened from this page.",
        );
      }

      const updatePayload: Record<
        string,
        unknown
      > = {
        service_type:
          serviceType.trim(),
        source,
        priority,
        expected_return_date:
          expectedReturnDate ||
          null,
        notes:
          notes.trim() || null,
        internal_notes:
          internalNotes.trim() ||
          null,
        estimated_cost:
          parsedEstimatedCost,
      };

      if (canChangeProvider) {
        updatePayload.provider_id =
          providerId;
      }

      if (canChangeCustomer) {
        updatePayload.customer_id =
          customerId || null;
      }

      if (canChangeStatus) {
        updatePayload.status =
          status;
      }

      const {
        error: updateError,
      } = await supabase
        .from("service_jobs")
        .update(updatePayload)
        .eq(
          "id",
          serviceJobId,
        )
        .eq(
          "company_id",
          companyId,
        );

      if (updateError) {
        throw new Error(
          updateError.message,
        );
      }

      await supabase
        .from("service_provider_activity")
        .insert({
          company_id: companyId,
          provider_id:
            providerId,
          service_job_id:
            serviceJobId,
          action: "job_updated",
          message: `Service job ${job.job_number} was updated.`,
        });

      setSuccessMessage(
        "Service job updated successfully.",
      );

      setTimeout(() => {
        router.push(
          `/service-jobs/${serviceJobId}`,
        );
      }, 600);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update service job.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="sje-page">
          <div className="sje-loading">
            Loading service job...
          </div>
        </div>

        <style jsx>{`
          .sje-page {
            padding: 28px;
          }

          .sje-loading {
            min-height: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b7280;
            font-size: 14px;
          }
        `}</style>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <div className="sje-page">
          <div className="sje-error-card">
            {errorMessage ||
              "Service job not found."}
          </div>
        </div>

        <style jsx>{`
          .sje-page {
            padding: 28px;
          }

          .sje-error-card {
            padding: 18px;
            border: 1px solid #fecaca;
            border-radius: 12px;
            background: #fef2f2;
            color: #991b1b;
            font-size: 13px;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="sje-page">
        <div className="sje-breadcrumb">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/service-jobs",
              )
            }
          >
            Service Jobs
          </button>

          <span>/</span>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/service-jobs/${job.id}`,
              )
            }
          >
            {job.job_number}
          </button>

          <span>/</span>

          <span>Edit</span>
        </div>

        <div className="sje-header">
          <div>
            <h1>
              Edit Service Job
            </h1>

            <p>
              Update the operational details
              for{" "}
              <strong>
                {job.job_number}
              </strong>
            </p>
          </div>

          <div className="sje-header-actions">
            <button
              type="button"
              className="sje-button"
              onClick={() =>
                router.push(
                  `/service-jobs/${job.id}`,
                )
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              form="service-job-edit-form"
              className="sje-button sje-button-primary"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="sje-alert sje-alert-error">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="sje-alert sje-alert-success">
            {successMessage}
          </div>
        )}

        {(hasDispatches ||
          hasReturns) && (
          <div className="sje-info-banner">
            <strong>
              This job has already entered
              the stock-custody workflow.
            </strong>

            <span>
              Provider/customer and inventory
              quantities are protected here.
              Use Dispatch and Receive Return
              from the Service Job page to
              change stock custody.
            </span>
          </div>
        )}

        <form
          id="service-job-edit-form"
          onSubmit={handleSave}
        >
          <div className="sje-layout">
            <div className="sje-main">
              <section className="sje-card">
                <div className="sje-card-header">
                  <div>
                    <h2>
                      Job Information
                    </h2>

                    <p>
                      Core information about
                      this service job.
                    </p>
                  </div>
                </div>

                <div className="sje-card-body">
                  <div className="sje-grid-2">
                    <div className="sje-field">
                      <label>
                        Job Number
                      </label>

                      <input
                        value={
                          job.job_number
                        }
                        disabled
                      />

                      <small>
                        Job numbers cannot be
                        changed.
                      </small>
                    </div>

                    <div className="sje-field">
                      <label>
                        Service Provider
                        <span>
                          *
                        </span>
                      </label>

                      <select
                        value={
                          providerId
                        }
                        onChange={(event) =>
                          setProviderId(
                            event.target
                              .value,
                          )
                        }
                        disabled={
                          !canChangeProvider
                        }
                        required
                      >
                        <option value="">
                          Select provider
                        </option>

                        {providers.map(
                          (provider) => (
                            <option
                              key={
                                provider.id
                              }
                              value={
                                provider.id
                              }
                              disabled={
                                provider.status !==
                                "active"
                              }
                            >
                              {
                                provider.name
                              }
                              {provider.company_name
                                ? ` — ${provider.company_name}`
                                : ""}
                            </option>
                          ),
                        )}
                      </select>

                      {!canChangeProvider && (
                        <small>
                          Provider cannot be
                          changed after stock
                          has been dispatched.
                        </small>
                      )}
                    </div>

                    <div className="sje-field">
                      <label>
                        Customer
                      </label>

                      <select
                        value={
                          customerId
                        }
                        onChange={(event) =>
                          setCustomerId(
                            event.target
                              .value,
                          )
                        }
                        disabled={
                          !canChangeCustomer
                        }
                      >
                        <option value="">
                          Internal / No Customer
                        </option>

                        {customers.map(
                          (customer) => (
                            <option
                              key={
                                customer.id
                              }
                              value={
                                customer.id
                              }
                            >
                              {
                                customer.name
                              }
                            </option>
                          ),
                        )}
                      </select>

                      {!canChangeCustomer && (
                        <small>
                          Customer cannot be
                          changed after stock
                          has entered custody.
                        </small>
                      )}
                    </div>

                    <div className="sje-field">
                      <label>
                        Service Type
                        <span>
                          *
                        </span>
                      </label>

                      <input
                        value={
                          serviceType
                        }
                        onChange={(event) =>
                          setServiceType(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Repair, refurbishing, cleaning..."
                        required
                      />
                    </div>

                    <div className="sje-field">
                      <label>
                        Source
                      </label>

                      <select
                        value={source}
                        onChange={(event) =>
                          setSource(
                            event.target
                              .value as ServiceJob["source"],
                          )
                        }
                      >
                        <option value="internal">
                          Internal
                        </option>

                        <option value="repair">
                          Repair
                        </option>

                        <option value="warranty">
                          Warranty
                        </option>

                        <option value="rma">
                          RMA
                        </option>

                        <option value="purchase">
                          Purchase
                        </option>

                        <option value="other">
                          Other
                        </option>
                      </select>
                    </div>

                    <div className="sje-field">
                      <label>
                        Priority
                      </label>

                      <select
                        value={priority}
                        onChange={(event) =>
                          setPriority(
                            event.target
                              .value as ServiceJob["priority"],
                          )
                        }
                      >
                        <option value="low">
                          Low
                        </option>

                        <option value="normal">
                          Normal
                        </option>

                        <option value="high">
                          High
                        </option>

                        <option value="urgent">
                          Urgent
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              <section className="sje-card">
                <div className="sje-card-header">
                  <div>
                    <h2>
                      Schedule & Status
                    </h2>

                    <p>
                      Control the service timeline
                      and current operational state.
                    </p>
                  </div>
                </div>

                <div className="sje-card-body">
                  <div className="sje-grid-2">
                    <div className="sje-field">
                      <label>
                        Status
                      </label>

                      <select
                        value={status}
                        onChange={(event) =>
                          setStatus(
                            event.target
                              .value as ServiceJob["status"],
                          )
                        }
                        disabled={
                          !canChangeStatus
                        }
                      >
                        <option value="draft">
                          Draft
                        </option>

                        <option value="open">
                          Open
                        </option>

                        <option value="in_progress">
                          In Progress
                        </option>

                        <option value="awaiting_return">
                          Awaiting Return
                        </option>

                        <option value="partially_returned">
                          Partially Returned
                        </option>

                        <option value="completed">
                          Completed
                        </option>

                        <option value="cancelled">
                          Cancelled
                        </option>
                      </select>

                      {!canChangeStatus && (
                        <small>
                          Status is locked because
                          this job has returned
                          stock or has reached a
                          final state.
                        </small>
                      )}
                    </div>

                    <div className="sje-field">
                      <label>
                        Expected Return
                      </label>

                      <input
                        type="date"
                        value={
                          expectedReturnDate
                        }
                        onChange={(event) =>
                          setExpectedReturnDate(
                            event.target
                              .value,
                          )
                        }
                      />

                      <small>
                        The date you expect the
                        provider to return the
                        stock.
                      </small>
                    </div>

                    <div className="sje-field">
                      <label>
                        Dispatched Date
                      </label>

                      <input
                        type="date"
                        value={
                          job.dispatched_date ||
                          ""
                        }
                        disabled
                      />

                      <small>
                        Automatically recorded by
                        the dispatch workflow.
                      </small>
                    </div>

                    <div className="sje-field">
                      <label>
                        Completed Date
                      </label>

                      <input
                        type="date"
                        value={
                          job.completed_date ||
                          ""
                        }
                        disabled
                      />

                      <small>
                        Automatically recorded when
                        the service is completed.
                      </small>
                    </div>
                  </div>
                </div>
              </section>

              <section className="sje-card">
                <div className="sje-card-header">
                  <div>
                    <h2>
                      Costing
                    </h2>

                    <p>
                      Estimated cost and actual
                      service cost.
                    </p>
                  </div>
                </div>

                <div className="sje-card-body">
                  <div className="sje-grid-2">
                    <div className="sje-field">
                      <label>
                        Estimated Service Cost
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          estimatedCost
                        }
                        onChange={(event) =>
                          setEstimatedCost(
                            event.target
                              .value,
                          )
                        }
                      />
                    </div>

                    <div className="sje-field">
                      <label>
                        Actual Service Cost
                      </label>

                      <input
                        value={formatMoney(
                          Number(
                            job.actual_cost ||
                              0,
                          ),
                        )}
                        disabled
                      />

                      <small>
                        Actual cost is updated
                        through provider returns.
                      </small>
                    </div>
                  </div>
                </div>
              </section>

              <section className="sje-card">
                <div className="sje-card-header">
                  <div>
                    <h2>
                      Instructions & Notes
                    </h2>

                    <p>
                      Information for the service
                      provider and internal staff.
                    </p>
                  </div>
                </div>

                <div className="sje-card-body">
                  <div className="sje-field">
                    <label>
                      Provider Instructions
                    </label>

                    <textarea
                      value={notes}
                      onChange={(event) =>
                        setNotes(
                          event.target
                            .value,
                        )
                      }
                      rows={5}
                      placeholder="Describe the work required..."
                    />
                  </div>

                  <div className="sje-field">
                    <label>
                      Internal Notes
                    </label>

                    <textarea
                      value={
                        internalNotes
                      }
                      onChange={(event) =>
                        setInternalNotes(
                          event.target
                            .value,
                        )
                      }
                      rows={5}
                      placeholder="Internal information, handling notes, follow-up..."
                    />
                  </div>
                </div>
              </section>
            </div>

            <aside className="sje-sidebar">
              <section className="sje-card">
                <div className="sje-card-header">
                  <div>
                    <h2>
                      Job Summary
                    </h2>
                  </div>
                </div>

                <div className="sje-summary">
                  <div className="sje-summary-row">
                    <span>
                      Status
                    </span>

                    <strong>
                      {statusLabel(
                        status,
                      )}
                    </strong>
                  </div>

                  <div className="sje-summary-row">
                    <span>
                      Priority
                    </span>

                    <strong>
                      {statusLabel(
                        priority,
                      )}
                    </strong>
                  </div>

                  <div className="sje-summary-row">
                    <span>
                      Items
                    </span>

                    <strong>
                      {itemCount}
                    </strong>
                  </div>

                  <div className="sje-summary-row">
                    <span>
                      Completed
                    </span>

                    <strong>
                      {items.reduce(
                        (
                          sum,
                          item,
                        ) =>
                          sum +
                          Number(
                            item.quantity_completed ||
                              0,
                          ),
                        0,
                      )}
                    </strong>
                  </div>

                  <div className="sje-summary-row">
                    <span>
                      Failed
                    </span>

                    <strong>
                      {items.reduce(
                        (
                          sum,
                          item,
                        ) =>
                          sum +
                          Number(
                            item.quantity_failed ||
                              0,
                          ),
                        0,
                      )}
                    </strong>
                  </div>

                  <div className="sje-summary-row">
                    <span>
                      Damaged
                    </span>

                    <strong>
                      {items.reduce(
                        (
                          sum,
                          item,
                        ) =>
                          sum +
                          Number(
                            item.quantity_damaged ||
                              0,
                          ),
                        0,
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="sje-card">
                <div className="sje-card-header">
                  <div>
                    <h2>
                      Service Items
                    </h2>

                    <p>
                      Inventory quantities are
                      managed by Dispatch and Return.
                    </p>
                  </div>
                </div>

                <div className="sje-items">
                  {items.length ===
                  0 ? (
                    <div className="sje-empty">
                      No service items.
                    </div>
                  ) : (
                    items.map(
                      (item) => {
                        const product =
                          products[
                            item.product_id
                          ];

                        const variant =
                          item.variant_id
                            ? variants[
                                item.variant_id
                              ]
                            : null;

                        const processed =
                          Number(
                            item.quantity_completed ||
                              0,
                          ) +
                          Number(
                            item.quantity_failed ||
                              0,
                          ) +
                          Number(
                            item.quantity_damaged ||
                              0,
                          );

                        return (
                          <div
                            className="sje-item"
                            key={
                              item.id
                            }
                          >
                            <div className="sje-item-top">
                              <div>
                                <strong>
                                  {product?.name ||
                                    "Product"}
                                </strong>

                                {variant && (
                                  <small>
                                    {variant.sku ||
                                      variant.name ||
                                      "Variant"}
                                  </small>
                                )}
                              </div>

                              <b>
                                {
                                  item.quantity
                                }
                              </b>
                            </div>

                            <div className="sje-item-progress">
                              <span>
                                Processed
                              </span>

                              <strong>
                                {
                                  processed
                                }{" "}
                                /{" "}
                                {
                                  item.quantity
                                }
                              </strong>
                            </div>

                            {item.service_description && (
                              <div className="sje-item-description">
                                {
                                  item.service_description
                                }
                              </div>
                            )}

                            {item.serialized_unit_id && (
                              <div className="sje-serial-badge">
                                Serialized Unit
                              </div>
                            )}
                          </div>
                        );
                      },
                    )
                  )}
                </div>
              </section>

              <div className="sje-protection">
                <div className="sje-protection-title">
                  Inventory Protection
                </div>

                <p>
                  This page does not edit
                  quantities, serialized custody,
                  dispatches, returns, or provider
                  stock.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/service-jobs/${job.id}`,
                    )
                  }
                >
                  Back to Service Job
                </button>
              </div>
            </aside>
          </div>
        </form>
      </div>

      <style jsx>{`
        .sje-page {
          padding: 28px;
          max-width: 1450px;
          margin: 0 auto;
        }

        .sje-breadcrumb {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #9ca3af;
          font-size: 12px;
        }

        .sje-breadcrumb button {
          border: 0;
          padding: 0;
          background: transparent;
          color: #6b7280;
          font-size: 12px;
          cursor: pointer;
        }

        .sje-breadcrumb button:hover {
          color: #111827;
        }

        .sje-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .sje-header h1 {
          margin: 0;
          color: #111827;
          font-size: 25px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .sje-header p {
          margin: 6px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .sje-header p strong {
          color: #374151;
        }

        .sje-header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .sje-button {
          height: 40px;
          padding: 0 15px;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          color: #374151;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .sje-button:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .sje-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .sje-button-primary {
          border-color: #111827;
          background: #111827;
          color: #fff;
        }

        .sje-button-primary:hover {
          border-color: #1f2937;
          background: #1f2937;
        }

        .sje-alert {
          margin-bottom: 18px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 12px;
        }

        .sje-alert-error {
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #991b1b;
        }

        .sje-alert-success {
          border: 1px solid #bbf7d0;
          background: #f0fdf4;
          color: #166534;
        }

        .sje-info-banner {
          display: flex;
          flex-direction: column;
          gap: 3px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          background: #eff6ff;
          color: #1e40af;
          font-size: 11px;
          line-height: 1.5;
        }

        .sje-info-banner strong {
          color: #1e3a8a;
          font-size: 12px;
        }

        .sje-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 18px;
          align-items: start;
        }

        .sje-main {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .sje-sidebar {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .sje-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .sje-card-header {
          padding: 17px 19px;
          border-bottom: 1px solid #e5e7eb;
        }

        .sje-card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 14px;
          font-weight: 700;
        }

        .sje-card-header p {
          margin: 4px 0 0;
          color: #6b7280;
          font-size: 11px;
          line-height: 1.45;
        }

        .sje-card-body {
          padding: 19px;
        }

        .sje-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .sje-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sje-field + .sje-field {
          margin-top: 0;
        }

        .sje-field label {
          color: #374151;
          font-size: 11px;
          font-weight: 600;
        }

        .sje-field label span {
          margin-left: 3px;
          color: #dc2626;
        }

        .sje-field input,
        .sje-field select,
        .sje-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 9px;
          background: #fff;
          color: #111827;
          font-family: inherit;
          font-size: 12px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .sje-field input,
        .sje-field select {
          height: 40px;
          padding: 0 11px;
        }

        .sje-field textarea {
          min-height: 105px;
          padding: 10px 11px;
          resize: vertical;
          line-height: 1.5;
        }

        .sje-field input:focus,
        .sje-field select:focus,
        .sje-field textarea:focus {
          border-color: #9ca3af;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.05);
        }

        .sje-field input:disabled,
        .sje-field select:disabled,
        .sje-field textarea:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .sje-field small {
          color: #9ca3af;
          font-size: 9px;
          line-height: 1.4;
        }

        .sje-summary {
          padding: 5px 19px 12px;
        }

        .sje-summary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 11px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .sje-summary-row:last-child {
          border-bottom: 0;
        }

        .sje-summary-row span {
          color: #6b7280;
          font-size: 11px;
        }

        .sje-summary-row strong {
          color: #111827;
          font-size: 11px;
          text-align: right;
        }

        .sje-items {
          padding: 8px 19px 14px;
        }

        .sje-item {
          padding: 13px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .sje-item:last-child {
          border-bottom: 0;
        }

        .sje-item-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .sje-item-top strong {
          display: block;
          color: #111827;
          font-size: 11px;
          line-height: 1.4;
        }

        .sje-item-top small {
          display: block;
          margin-top: 3px;
          color: #9ca3af;
          font-size: 9px;
        }

        .sje-item-top b {
          color: #111827;
          font-size: 12px;
        }

        .sje-item-progress {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 9px;
          color: #9ca3af;
          font-size: 9px;
        }

        .sje-item-progress strong {
          color: #374151;
          font-size: 9px;
        }

        .sje-item-description {
          margin-top: 8px;
          color: #6b7280;
          font-size: 10px;
          line-height: 1.45;
        }

        .sje-serial-badge {
          display: inline-flex;
          margin-top: 8px;
          padding: 4px 7px;
          border-radius: 5px;
          background: #f3f4f6;
          color: #4b5563;
          font-size: 8px;
          font-weight: 600;
        }

        .sje-empty {
          padding: 25px 0;
          color: #9ca3af;
          font-size: 11px;
          text-align: center;
        }

        .sje-protection {
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          background: #f9fafb;
        }

        .sje-protection-title {
          color: #374151;
          font-size: 11px;
          font-weight: 700;
        }

        .sje-protection p {
          margin: 6px 0 11px;
          color: #6b7280;
          font-size: 10px;
          line-height: 1.5;
        }

        .sje-protection button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #111827;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .sje-protection button:hover {
          text-decoration: underline;
        }

        @media (max-width: 1050px) {
          .sje-layout {
            grid-template-columns: 1fr;
          }

          .sje-sidebar {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            align-items: start;
          }

          .sje-protection {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .sje-page {
            padding: 18px;
          }

          .sje-header {
            flex-direction: column;
          }

          .sje-header-actions {
            width: 100%;
          }

          .sje-header-actions .sje-button {
            flex: 1;
          }

          .sje-grid-2 {
            grid-template-columns: 1fr;
          }

          .sje-sidebar {
            grid-template-columns: 1fr;
          }

          .sje-info-banner {
            font-size: 10px;
          }
        }
      `}</style>
    </AppShell>
  );
}