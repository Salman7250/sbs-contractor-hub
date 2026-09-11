"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Package,
  Save,
  UserRound,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Product = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type Warranty = {
  id: string;
  warranty_number: string;
  customer_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  serial_number: string | null;
  status: string;
  coverage_type: string;
  start_date: string;
  end_date: string;
};

type Claim = {
  id: string;
  claim_number: string;
  warranty_id: string | null;
  company_id: string;
  status: string;
  issue: string;
  claim_date: string;
};

type Repair = {
  id: string;
  repair_number: string;
  customer_id: string | null;
  product_id: string | null;
  serial_number: string | null;
  status: string;
};

type InitialValues = {
  customerId: string;
  warrantyId: string;
  claimId: string;
  repairId: string;
  orderId: string;
};

type Props = {
  customers: Customer[];
  products: Product[];
  employees: Employee[];
  warranties: Warranty[];
  claims: Claim[];
  repairs: Repair[];
  initialValues: InitialValues;
};

type RmaStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "rejected"
  | "awaiting_return"
  | "received"
  | "inspecting"
  | "resolution_pending"
  | "repair"
  | "replacement"
  | "refund"
  | "store_credit"
  | "completed"
  | "cancelled";

type RmaPriority =
  | "low"
  | "normal"
  | "high"
  | "urgent";

const statusOptions: {
  value: RmaStatus;
  label: string;
}[] = [
  {
    value: "requested",
    label: "Requested",
  },
  {
    value: "under_review",
    label: "Under Review",
  },
  {
    value: "approved",
    label: "Approved",
  },
  {
    value: "rejected",
    label: "Rejected",
  },
  {
    value: "awaiting_return",
    label: "Awaiting Return",
  },
  {
    value: "received",
    label: "Received",
  },
  {
    value: "inspecting",
    label: "Inspecting",
  },
  {
    value: "resolution_pending",
    label: "Resolution Pending",
  },
  {
    value: "repair",
    label: "Repair",
  },
  {
    value: "replacement",
    label: "Replacement",
  },
  {
    value: "refund",
    label: "Refund",
  },
  {
    value: "store_credit",
    label: "Store Credit",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

const priorityOptions: {
  value: RmaPriority;
  label: string;
}[] = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "normal",
    label: "Normal",
  },
  {
    value: "high",
    label: "High",
  },
  {
    value: "urgent",
    label: "Urgent",
  },
];

function getEmployeeName(employee: Employee) {
  if (employee.display_name) {
    return employee.display_name;
  }

  const name = [
    employee.first_name,
    employee.last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return name || employee.email || "Employee";
}

function formatWarrantyStatus(status: string) {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export default function RmaForm({
  customers,
  products,
  employees,
  warranties,
  claims,
  repairs,
  initialValues,
}: Props) {
  const router = useRouter();

  const [rmaNumber, setRmaNumber] = useState("");
  const [customerId, setCustomerId] = useState(
    initialValues.customerId,
  );
  const [orderId, setOrderId] = useState(
    initialValues.orderId,
  );
  const [invoiceId, setInvoiceId] = useState("");
  const [productId, setProductId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [warrantyId, setWarrantyId] = useState(
    initialValues.warrantyId,
  );
  const [claimId, setClaimId] = useState(
    initialValues.claimId,
  );
  const [repairId, setRepairId] = useState(
    initialValues.repairId,
  );
  const [assignedEmployeeId, setAssignedEmployeeId] =
    useState("");

  const [status, setStatus] =
    useState<RmaStatus>("requested");

  const [priority, setPriority] =
    useState<RmaPriority>("normal");

  const [reason, setReason] = useState("");
  const [customerDescription, setCustomerDescription] =
    useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [returnTrackingNumber, setReturnTrackingNumber] =
    useState("");

  const [returnCarrier, setReturnCarrier] = useState("");

  const [conditionReceived, setConditionReceived] =
    useState("");

  const [inspectionResult, setInspectionResult] =
    useState("");

  const [resolutionNotes, setResolutionNotes] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const selectedWarranty = useMemo(() => {
    if (!warrantyId) {
      return null;
    }

    return (
      warranties.find(
        (warranty) => warranty.id === warrantyId,
      ) ?? null
    );
  }, [warrantyId, warranties]);

  const selectedClaim = useMemo(() => {
    if (!claimId) {
      return null;
    }

    return (
      claims.find((claim) => claim.id === claimId) ??
      null
    );
  }, [claimId, claims]);

  const filteredWarranties = useMemo(() => {
    if (!customerId) {
      return warranties;
    }

    return warranties.filter(
      (warranty) =>
        warranty.customer_id === customerId,
    );
  }, [customerId, warranties]);

  const filteredClaims = useMemo(() => {
    if (!warrantyId) {
      return claims;
    }

    return claims.filter(
      (claim) => claim.warranty_id === warrantyId,
    );
  }, [claims, warrantyId]);

  const filteredRepairs = useMemo(() => {
    if (!customerId) {
      return repairs;
    }

    return repairs.filter(
      (repair) =>
        repair.customer_id === customerId,
    );
  }, [customerId, repairs]);

  function handleCustomerChange(value: string) {
    setCustomerId(value);

    if (
      warrantyId &&
      !warranties.some(
        (warranty) =>
          warranty.id === warrantyId &&
          (!value || warranty.customer_id === value),
      )
    ) {
      setWarrantyId("");
      setClaimId("");
    }

    if (
      repairId &&
      !repairs.some(
        (repair) =>
          repair.id === repairId &&
          (!value || repair.customer_id === value),
      )
    ) {
      setRepairId("");
    }
  }

  function handleWarrantyChange(value: string) {
    setWarrantyId(value);

    if (value) {
      const warranty = warranties.find(
        (item) => item.id === value,
      );

      if (warranty) {
        if (warranty.customer_id) {
          setCustomerId(warranty.customer_id);
        }

        if (warranty.product_id) {
          setProductId(warranty.product_id);
        }

        if (warranty.serial_number) {
          setSerialNumber(
            warranty.serial_number,
          );
        }
      }

      if (
        claimId &&
        !claims.some(
          (claim) =>
            claim.id === claimId &&
            claim.warranty_id === value,
        )
      ) {
        setClaimId("");
      }
    } else {
      setClaimId("");
    }
  }

  function handleClaimChange(value: string) {
    setClaimId(value);

    if (!value) {
      return;
    }

    const claim = claims.find(
      (item) => item.id === value,
    );

    if (claim?.warranty_id) {
      setWarrantyId(claim.warranty_id);

      const warranty = warranties.find(
        (item) => item.id === claim.warranty_id,
      );

      if (warranty) {
        if (warranty.customer_id) {
          setCustomerId(warranty.customer_id);
        }

        if (warranty.product_id) {
          setProductId(warranty.product_id);
        }

        if (warranty.serial_number) {
          setSerialNumber(
            warranty.serial_number,
          );
        }
      }
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      if (
        membershipError ||
        !membership?.company_id
      ) {
        throw new Error(
          "Your company membership could not be verified.",
        );
      }

      const companyId = membership.company_id;

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_company_admin", {
          p_company_id: companyId,
        });

      if (adminError) {
        throw adminError;
      }

      let hasPermission = Boolean(isAdmin);

      if (!hasPermission) {
        const { data: permissionResult, error } =
          await supabase.rpc(
            "employee_has_permission",
            {
              p_company_id: companyId,
              p_module: "rma",
              p_action: "manage",
            },
          );

        if (error) {
          throw error;
        }

        hasPermission = Boolean(permissionResult);
      }

      if (!hasPermission) {
        throw new Error(
          "You do not have permission to create RMAs.",
        );
      }

      const trimmedRmaNumber =
        rmaNumber.trim();

      if (!trimmedRmaNumber) {
        throw new Error(
          "RMA number is required.",
        );
      }

      if (!reason.trim()) {
        throw new Error(
          "Return reason is required.",
        );
      }

      if (customerId) {
        const { data: customer, error } =
          await supabase
            .from("customers")
            .select("id")
            .eq("id", customerId)
            .eq("company_id", companyId)
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (!customer) {
          throw new Error(
            "The selected customer could not be verified.",
          );
        }
      }

      if (productId) {
        const { data: product, error } =
          await supabase
            .from("products")
            .select("id")
            .eq("id", productId)
            .eq("company_id", companyId)
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (!product) {
          throw new Error(
            "The selected product could not be verified.",
          );
        }
      }

      if (warrantyId) {
        const { data: warranty, error } =
          await supabase
            .from("warranties")
            .select(
              "id, customer_id, product_id, variant_id, serial_number",
            )
            .eq("id", warrantyId)
            .eq("company_id", companyId)
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (!warranty) {
          throw new Error(
            "The selected warranty could not be verified.",
          );
        }

        if (
          warranty.customer_id &&
          customerId &&
          warranty.customer_id !== customerId
        ) {
          throw new Error(
            "The selected warranty belongs to a different customer.",
          );
        }

        if (
          warranty.product_id &&
          productId &&
          warranty.product_id !== productId
        ) {
          throw new Error(
            "The selected warranty belongs to a different product.",
          );
        }
      }

      if (claimId) {
        const { data: claim, error } =
          await supabase
            .from("warranty_claims")
            .select(
              "id, warranty_id",
            )
            .eq("id", claimId)
            .eq("company_id", companyId)
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (!claim) {
          throw new Error(
            "The selected warranty claim could not be verified.",
          );
        }

        if (
          claim.warranty_id &&
          warrantyId &&
          claim.warranty_id !== warrantyId
        ) {
          throw new Error(
            "The selected claim belongs to a different warranty.",
          );
        }
      }

      if (repairId) {
        const { data: repair, error } =
          await supabase
            .from("repairs")
            .select("id, customer_id")
            .eq("id", repairId)
            .eq("company_id", companyId)
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (!repair) {
          throw new Error(
            "The selected repair could not be verified.",
          );
        }

        if (
          repair.customer_id &&
          customerId &&
          repair.customer_id !== customerId
        ) {
          throw new Error(
            "The selected repair belongs to a different customer.",
          );
        }
      }

      if (assignedEmployeeId) {
        const { data: employee, error } =
          await supabase
            .from("employees")
            .select("id")
            .eq("id", assignedEmployeeId)
            .eq("company_id", companyId)
            .eq("status", "active")
            .maybeSingle();

        if (error) {
          throw error;
        }

        if (!employee) {
          throw new Error(
            "The selected employee could not be verified.",
          );
        }
      }

      const { data: existingRma, error: duplicateError } =
        await supabase
          .from("rmas")
          .select("id")
          .eq("company_id", companyId)
          .eq("rma_number", trimmedRmaNumber)
          .maybeSingle();

      if (duplicateError) {
        throw duplicateError;
      }

      if (existingRma) {
        throw new Error(
          "That RMA number already exists.",
        );
      }

      const { data: rma, error: insertError } =
        await supabase
          .from("rmas")
          .insert({
            company_id: companyId,
            rma_number: trimmedRmaNumber,
            customer_id:
              customerId || null,
            order_id: orderId.trim() || null,
            invoice_id:
              invoiceId.trim() || null,
            product_id:
              productId || null,
            serial_number:
              serialNumber.trim() || null,
            warranty_id:
              warrantyId || null,
            warranty_claim_id:
              claimId || null,
            repair_id:
              repairId || null,
            assigned_employee_id:
              assignedEmployeeId || null,
            status,
            priority,
            reason: reason.trim(),
            customer_description:
              customerDescription.trim() || null,
            customer_notes:
              customerNotes.trim() || null,
            internal_notes:
              internalNotes.trim() || null,
            return_tracking_number:
              returnTrackingNumber.trim() || null,
            return_carrier:
              returnCarrier.trim() || null,
            condition_received:
              conditionReceived.trim() || null,
            inspection_result:
              inspectionResult.trim() || null,
            resolution_notes:
              resolutionNotes.trim() || null,
            created_by: user.id,
          })
          .select("id")
          .single();

      if (insertError || !rma) {
        throw insertError ?? new Error(
          "The RMA could not be created.",
        );
      }

      const { error: activityError } =
        await supabase
          .from("rma_activity")
          .insert({
            company_id: companyId,
            rma_id: rma.id,
            action: "created",
            message: `RMA ${trimmedRmaNumber} created.`,
            created_by: user.id,
          });

      if (activityError) {
        console.error(
          "RMA activity error:",
          activityError,
        );
      }

      router.push(`/rma/${rma.id}`);
      router.refresh();
    } catch (error) {
      console.error(
        "RMA creation error:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the RMA.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <button
            type="button"
            className="back-button"
            onClick={() => router.push("/rma")}
          >
            <ArrowLeft size={16} />
            Back to RMA
          </button>

          <div className="eyebrow">SERVICE</div>

          <h1>New RMA</h1>

          <p>
            Create a return authorization for a
            customer product.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="error-banner">
          <AlertCircle size={18} />

          <div>
            <strong>Unable to create RMA</strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      <form
        className="form-layout"
        onSubmit={handleSubmit}
      >
        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>RMA Details</h2>
              <p>
                Basic return authorization information.
              </p>
            </div>

            <FileText size={20} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="rmaNumber">
                RMA Number <span>*</span>
              </label>

              <input
                id="rmaNumber"
                value={rmaNumber}
                onChange={(event) =>
                  setRmaNumber(event.target.value)
                }
                placeholder="RMA-00001"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="status">
                Status
              </label>

              <select
                id="status"
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as RmaStatus,
                  )
                }
              >
                {statusOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="priority">
                Priority
              </label>

              <select
                id="priority"
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value as RmaPriority,
                  )
                }
              >
                {priorityOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="reason">
                Return Reason <span>*</span>
              </label>

              <input
                id="reason"
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="Defective, damaged, wrong item..."
                required
              />
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Customer & Product</h2>
              <p>
                Identify the customer and product being
                returned.
              </p>
            </div>

            <Package size={20} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="customer">
                Customer
              </label>

              <select
                id="customer"
                value={customerId}
                onChange={(event) =>
                  handleCustomerChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select customer
                </option>

                {customers.map((customer) => (
                  <option
                    key={customer.id}
                    value={customer.id}
                  >
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="product">
                Product
              </label>

              <select
                id="product"
                value={productId}
                onChange={(event) =>
                  setProductId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select product
                </option>

                {products.map((product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="serialNumber">
                Serial Number
              </label>

              <input
                id="serialNumber"
                value={serialNumber}
                onChange={(event) =>
                  setSerialNumber(
                    event.target.value,
                  )
                }
                placeholder="Device serial number"
              />
            </div>

            <div className="field">
              <label htmlFor="orderId">
                Order ID
              </label>

              <input
                id="orderId"
                value={orderId}
                onChange={(event) =>
                  setOrderId(event.target.value)
                }
                placeholder="Order UUID"
              />
            </div>

            <div className="field">
              <label htmlFor="invoiceId">
                Invoice ID
              </label>

              <input
                id="invoiceId"
                value={invoiceId}
                onChange={(event) =>
                  setInvoiceId(event.target.value)
                }
                placeholder="Invoice UUID"
              />
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Warranty & Service Links</h2>
              <p>
                Connect this RMA to an existing warranty,
                claim, or repair.
              </p>
            </div>

            <CheckCircle2 size={20} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="warranty">
                Warranty
              </label>

              <select
                id="warranty"
                value={warrantyId}
                onChange={(event) =>
                  handleWarrantyChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  No warranty linked
                </option>

                {filteredWarranties.map(
                  (warranty) => (
                    <option
                      key={warranty.id}
                      value={warranty.id}
                    >
                      {warranty.warranty_number} —{" "}
                      {formatWarrantyStatus(
                        warranty.status,
                      )}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="field">
              <label htmlFor="claim">
                Warranty Claim
              </label>

              <select
                id="claim"
                value={claimId}
                onChange={(event) =>
                  handleClaimChange(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  No claim linked
                </option>

                {filteredClaims.map((claim) => (
                  <option
                    key={claim.id}
                    value={claim.id}
                  >
                    {claim.claim_number} —{" "}
                    {formatWarrantyStatus(
                      claim.status,
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="repair">
                Repair
              </label>

              <select
                id="repair"
                value={repairId}
                onChange={(event) =>
                  setRepairId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  No repair linked
                </option>

                {filteredRepairs.map((repair) => (
                  <option
                    key={repair.id}
                    value={repair.id}
                  >
                    {repair.repair_number} —{" "}
                    {formatWarrantyStatus(
                      repair.status,
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(selectedWarranty ||
            selectedClaim) && (
            <div className="linked-info">
              <div className="linked-icon">
                <CheckCircle2 size={18} />
              </div>

              <div>
                {selectedWarranty && (
                  <strong>
                    Warranty{" "}
                    {selectedWarranty.warranty_number}
                  </strong>
                )}

                {selectedWarranty && (
                  <span>
                    Coverage:{" "}
                    {formatWarrantyStatus(
                      selectedWarranty.coverage_type,
                    )}{" "}
                    · Valid until{" "}
                    {selectedWarranty.end_date}
                  </span>
                )}

                {selectedClaim && (
                  <span>
                    Claim:{" "}
                    {selectedClaim.claim_number} ·{" "}
                    {selectedClaim.issue}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Return Handling</h2>
              <p>
                Record shipment and assignment information.
              </p>
            </div>

            <Package size={20} />
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="returnCarrier">
                Return Carrier
              </label>

              <input
                id="returnCarrier"
                value={returnCarrier}
                onChange={(event) =>
                  setReturnCarrier(
                    event.target.value,
                  )
                }
                placeholder="DHL, FedEx, Emirates Post..."
              />
            </div>

            <div className="field">
              <label htmlFor="tracking">
                Return Tracking Number
              </label>

              <input
                id="tracking"
                value={returnTrackingNumber}
                onChange={(event) =>
                  setReturnTrackingNumber(
                    event.target.value,
                  )
                }
                placeholder="Tracking number"
              />
            </div>

            <div className="field">
              <label htmlFor="assignedEmployee">
                Assigned Employee
              </label>

              <select
                id="assignedEmployee"
                value={assignedEmployeeId}
                onChange={(event) =>
                  setAssignedEmployeeId(
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Unassigned
                </option>

                {employees.map((employee) => (
                  <option
                    key={employee.id}
                    value={employee.id}
                  >
                    {getEmployeeName(employee)}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="conditionReceived">
                Condition Received
              </label>

              <input
                id="conditionReceived"
                value={conditionReceived}
                onChange={(event) =>
                  setConditionReceived(
                    event.target.value,
                  )
                }
                placeholder="Good, damaged, incomplete..."
              />
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Return Information</h2>
              <p>
                Capture the customer's explanation and
                internal handling notes.
              </p>
            </div>

            <UserRound size={20} />
          </div>

          <div className="form-grid single">
            <div className="field">
              <label htmlFor="customerDescription">
                Customer Description
              </label>

              <textarea
                id="customerDescription"
                value={customerDescription}
                onChange={(event) =>
                  setCustomerDescription(
                    event.target.value,
                  )
                }
                placeholder="Describe the customer's reported issue..."
                rows={4}
              />
            </div>

            <div className="field">
              <label htmlFor="customerNotes">
                Customer Notes
              </label>

              <textarea
                id="customerNotes"
                value={customerNotes}
                onChange={(event) =>
                  setCustomerNotes(
                    event.target.value,
                  )
                }
                placeholder="Notes that may be shared with the customer..."
                rows={3}
              />
            </div>

            <div className="field">
              <label htmlFor="internalNotes">
                Internal Notes
              </label>

              <textarea
                id="internalNotes"
                value={internalNotes}
                onChange={(event) =>
                  setInternalNotes(
                    event.target.value,
                  )
                }
                placeholder="Internal staff notes..."
                rows={4}
              />
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="card-header">
            <div>
              <h2>Inspection & Resolution</h2>
              <p>
                These fields can be completed as the RMA
                progresses.
              </p>
            </div>

            <FileText size={20} />
          </div>

          <div className="form-grid single">
            <div className="field">
              <label htmlFor="inspectionResult">
                Inspection Result
              </label>

              <textarea
                id="inspectionResult"
                value={inspectionResult}
                onChange={(event) =>
                  setInspectionResult(
                    event.target.value,
                  )
                }
                placeholder="Inspection findings..."
                rows={4}
              />
            </div>

            <div className="field">
              <label htmlFor="resolutionNotes">
                Resolution Notes
              </label>

              <textarea
                id="resolutionNotes"
                value={resolutionNotes}
                onChange={(event) =>
                  setResolutionNotes(
                    event.target.value,
                  )
                }
                placeholder="Repair, replacement, refund, store credit, or rejection details..."
                rows={4}
              />
            </div>
          </div>
        </section>

        <div className="form-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={() => router.push("/rma")}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={saving}
          >
            <Save size={16} />

            {saving
              ? "Creating RMA..."
              : "Create RMA"}
          </button>
        </div>
      </form>

      <style jsx>{`
        .page-content {
          padding: 28px;
        }

        .page-header {
          margin-bottom: 22px;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 16px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #6b7280;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .back-button:hover {
          color: #111827;
        }

        .eyebrow {
          margin-bottom: 6px;
          color: #6b7280;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 28px;
          line-height: 1.2;
        }

        .page-header p {
          margin: 7px 0 0;
          color: #6b7280;
          font-size: 14px;
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 18px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
        }

        .error-banner svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .error-banner div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .error-banner strong {
          font-size: 13px;
        }

        .error-banner span {
          font-size: 12px;
          line-height: 1.5;
        }

        .form-layout {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .form-card {
          overflow: hidden;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow:
            0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 19px 20px;
          border-bottom: 1px solid #f0f1f3;
        }

        .card-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .card-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .card-header > svg {
          flex-shrink: 0;
          color: #9ca3af;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
          padding: 20px;
        }

        .form-grid.single {
          grid-template-columns: 1fr;
        }

        .field {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          color: #374151;
          font-size: 12px;
          font-weight: 600;
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
          border-radius: 9px;
          background: #ffffff;
          color: #111827;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .field input,
        .field select {
          height: 40px;
          padding: 0 11px;
        }

        .field textarea {
          min-height: 90px;
          padding: 10px 11px;
          resize: vertical;
          line-height: 1.5;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #9ca3af;
          box-shadow:
            0 0 0 3px
            rgba(17, 24, 39, 0.05);
        }

        .linked-info {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin: 0 20px 20px;
          padding: 12px 13px;
          border: 1px solid #d1fae5;
          border-radius: 10px;
          background: #f0fdf4;
        }

        .linked-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: #dcfce7;
          color: #15803d;
        }

        .linked-info > div:last-child {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .linked-info strong {
          color: #166534;
          font-size: 12px;
        }

        .linked-info span {
          color: #4d7c5a;
          font-size: 11px;
          line-height: 1.4;
        }

        .form-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding-bottom: 8px;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 40px;
          padding: 0 15px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease;
        }

        .primary-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .primary-button:hover:not(:disabled) {
          border-color: #1f2937;
          background: #1f2937;
        }

        .secondary-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .secondary-button:hover:not(:disabled) {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        @media (max-width: 760px) {
          .page-content {
            padding: 18px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .form-footer {
            flex-direction: column-reverse;
            align-items: stretch;
          }

          .form-footer button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}