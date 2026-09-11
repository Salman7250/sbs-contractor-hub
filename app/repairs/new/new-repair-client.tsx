"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Save,
  Wrench,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

type Product = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  name: string;
};

type Warranty = {
  id: string;
  warranty_number: string;
  customer_id?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
  serial_number?: string | null;
  status: string;
  end_date?: string | null;
};

type Claim = {
  id: string;
  claim_number: string;
  warranty_id?: string | null;
  customer_id?: string | null;
  product_id?: string | null;
  status: string;
  issue?: string | null;
};

type Props = {
  customers: Customer[];
  products: Product[];
  employees: Employee[];
  warranties: Warranty[];
  claims: Claim[];
};

type Source = "customer" | "warranty_claim" | "internal" | "rma";

type Priority = "low" | "normal" | "high" | "urgent";

function generateRepairNumber() {
  const random = Math.floor(10000 + Math.random() * 90000);
  return `REP-${random}`;
}

export default function NewRepairClient({
  customers,
  products,
  employees,
  warranties,
  claims,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [repairNumber, setRepairNumber] = useState(generateRepairNumber());
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [warrantyId, setWarrantyId] = useState("");
  const [claimId, setClaimId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [orderId, setOrderId] = useState("");
  const [jobId, setJobId] = useState("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [source, setSource] = useState<Source>("customer");
  const [priority, setPriority] = useState<Priority>("normal");

  const [issue, setIssue] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [warrantyCovered, setWarrantyCovered] = useState(false);

  const [estimatedLabor, setEstimatedLabor] = useState("");
  const [estimatedParts, setEstimatedParts] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const estimatedTotal =
    (Number(estimatedLabor) || 0) + (Number(estimatedParts) || 0);

  const customerWarranties = warranties.filter(
    (warranty) =>
      !customerId ||
      !warranty.customer_id ||
      warranty.customer_id === customerId,
  );

  const customerClaims = claims.filter(
    (claim) =>
      !customerId ||
      !claim.customer_id ||
      claim.customer_id === customerId,
  );

  function handleWarrantyChange(value: string) {
    setWarrantyId(value);

    const warranty = warranties.find((item) => item.id === value);

    if (!warranty) {
      setWarrantyCovered(false);
      return;
    }

    setWarrantyCovered(
      warranty.status === "active" || warranty.status === "expiring",
    );

    if (!customerId && warranty.customer_id) {
      setCustomerId(warranty.customer_id);
    }

    if (!productId && warranty.product_id) {
      setProductId(warranty.product_id);
    }

    if (!serialNumber && warranty.serial_number) {
      setSerialNumber(warranty.serial_number);
    }
  }

  function handleClaimChange(value: string) {
    setClaimId(value);

    const claim = claims.find((item) => item.id === value);

    if (!claim) {
      return;
    }

    if (!warrantyId && claim.warranty_id) {
      setWarrantyId(claim.warranty_id);

      const warranty = warranties.find(
        (item) => item.id === claim.warranty_id,
      );

      if (warranty) {
        setWarrantyCovered(
          warranty.status === "active" || warranty.status === "expiring",
        );

        if (!customerId && warranty.customer_id) {
          setCustomerId(warranty.customer_id);
        }

        if (!productId && warranty.product_id) {
          setProductId(warranty.product_id);
        }

        if (!serialNumber && warranty.serial_number) {
          setSerialNumber(warranty.serial_number);
        }
      }
    }

    if (!customerId && claim.customer_id) {
      setCustomerId(claim.customer_id);
    }

    if (!productId && claim.product_id) {
      setProductId(claim.product_id);
    }

    if (!issue && claim.issue) {
      setIssue(claim.issue);
    }

    setSource("warranty_claim");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
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
        throw new Error("No company membership was found.");
      }

      const companyId = membership.company_id;

      const { data: isAdmin, error: adminError } = await supabase.rpc(
        "is_company_admin",
        {
          p_company_id: companyId,
        },
      );

      if (adminError) {
        throw new Error(adminError.message);
      }

      const { data: canManage, error: permissionError } =
        await supabase.rpc("employee_has_permission", {
          p_company_id: companyId,
          p_module: "repairs",
          p_action: "manage",
        });

      if (permissionError) {
        throw new Error(permissionError.message);
      }

      if (!isAdmin && !canManage) {
        throw new Error(
          "You do not have permission to create repair records.",
        );
      }

      if (!repairNumber.trim()) {
        throw new Error("Repair number is required.");
      }

      if (!issue.trim()) {
        throw new Error("Please describe the repair issue.");
      }

      const labor = Number(estimatedLabor) || 0;
      const parts = Number(estimatedParts) || 0;

      if (labor < 0 || parts < 0) {
        throw new Error("Estimated costs cannot be negative.");
      }

      const { data: existingRepair } = await supabase
        .from("repairs")
        .select("id")
        .eq("company_id", companyId)
        .eq("repair_number", repairNumber.trim())
        .maybeSingle();

      if (existingRepair) {
        throw new Error(
          "That repair number already exists. Please generate another one.",
        );
      }

      const { data: repair, error: repairError } = await supabase
        .from("repairs")
        .insert({
          company_id: companyId,
          repair_number: repairNumber.trim(),
          warranty_id: warrantyId || null,
          warranty_claim_id: claimId || null,
          customer_id: customerId || null,
          product_id: productId || null,
          variant_id: variantId || null,
          serial_number: serialNumber.trim() || null,
          order_id: orderId.trim() || null,
          job_id: jobId.trim() || null,
          assigned_employee_id: assignedEmployeeId || null,
          source,
          status: "intake",
          priority,
          issue: issue.trim(),
          customer_notes: customerNotes.trim() || null,
          internal_notes: internalNotes.trim() || null,
          warranty_covered: warrantyCovered,
          estimated_labor: labor,
          estimated_parts: parts,
          estimated_total: labor + parts,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (repairError) {
        throw new Error(repairError.message);
      }

      if (!repair?.id) {
        throw new Error("Repair was created but no repair ID was returned.");
      }

      const { error: activityError } = await supabase
        .from("repair_activity")
        .insert({
          company_id: companyId,
          repair_id: repair.id,
          action: "created",
          message: `Repair ${repairNumber.trim()} created.`,
          created_by: user.id,
        });

      if (activityError) {
        console.error("Repair activity error:", activityError);
      }

      router.push(`/repairs/${repair.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the repair.",
      );
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
            onClick={() => router.push("/repairs")}
          >
            <ArrowLeft size={16} />
            Back to Repairs
          </button>

          <div className="title-row">
            <div className="title-icon">
              <Wrench size={22} />
            </div>

            <div>
              <h1>New Repair</h1>
              <p>Create a repair record and start the service workflow.</p>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="error-banner">
          <strong>Unable to create repair</strong>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section className="form-card">
          <div className="section-header">
            <div>
              <h2>Repair Information</h2>
              <p>Basic information about this repair.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="repair-number">Repair Number</label>
              <input
                id="repair-number"
                value={repairNumber}
                onChange={(event) => setRepairNumber(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="source">Source</label>
              <select
                id="source"
                value={source}
                onChange={(event) =>
                  setSource(event.target.value as Source)
                }
              >
                <option value="customer">Customer</option>
                <option value="warranty_claim">Warranty Claim</option>
                <option value="internal">Internal</option>
                <option value="rma">RMA</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as Priority)
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="technician">Assigned Technician</label>
              <select
                id="technician"
                value={assignedEmployeeId}
                onChange={(event) =>
                  setAssignedEmployeeId(event.target.value)
                }
              >
                <option value="">Unassigned</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="section-header">
            <div>
              <h2>Customer & Product</h2>
              <p>Connect the repair to the customer and equipment.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field field-wide">
              <label htmlFor="customer">Customer</label>
              <select
                id="customer"
                value={customerId}
                onChange={(event) => {
                  setCustomerId(event.target.value);
                  setWarrantyId("");
                  setClaimId("");
                }}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.email ? ` — ${customer.email}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field-wide">
              <label htmlFor="product">Product</label>
              <select
                id="product"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="variant">Variant ID</label>
              <input
                id="variant"
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
                placeholder="Optional variant UUID"
              />
            </div>

            <div className="field">
              <label htmlFor="serial-number">Serial Number</label>
              <input
                id="serial-number"
                value={serialNumber}
                onChange={(event) => setSerialNumber(event.target.value)}
                placeholder="e.g. ABC123XYZ"
              />
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="section-header">
            <div>
              <h2>Warranty & Claim</h2>
              <p>Link this repair to an existing warranty workflow.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field field-wide">
              <label htmlFor="warranty">Warranty</label>
              <select
                id="warranty"
                value={warrantyId}
                onChange={(event) =>
                  handleWarrantyChange(event.target.value)
                }
              >
                <option value="">No warranty</option>

                {customerWarranties.map((warranty) => (
                  <option key={warranty.id} value={warranty.id}>
                    {warranty.warranty_number}
                    {warranty.serial_number
                      ? ` — ${warranty.serial_number}`
                      : ""}
                    {warranty.end_date
                      ? ` — expires ${warranty.end_date}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field-wide">
              <label htmlFor="claim">Warranty Claim</label>
              <select
                id="claim"
                value={claimId}
                onChange={(event) =>
                  handleClaimChange(event.target.value)
                }
              >
                <option value="">No warranty claim</option>

                {customerClaims.map((claim) => (
                  <option key={claim.id} value={claim.id}>
                    {claim.claim_number}
                    {claim.issue ? ` — ${claim.issue}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="checkbox-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={warrantyCovered}
                  onChange={(event) =>
                    setWarrantyCovered(event.target.checked)
                  }
                />
                <span>
                  <strong>Warranty Covered</strong>
                  <small>
                    Mark this repair as covered by the customer's warranty.
                  </small>
                </span>
              </label>
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="section-header">
            <div>
              <h2>Repair Issue</h2>
              <p>Record the customer's reported problem.</p>
            </div>
          </div>

          <div className="field">
            <label htmlFor="issue">Issue Description</label>
            <textarea
              id="issue"
              value={issue}
              onChange={(event) => setIssue(event.target.value)}
              placeholder="Describe the problem reported by the customer..."
              rows={5}
              required
            />
          </div>

          <div className="form-grid notes-grid">
            <div className="field">
              <label htmlFor="customer-notes">Customer Notes</label>
              <textarea
                id="customer-notes"
                value={customerNotes}
                onChange={(event) =>
                  setCustomerNotes(event.target.value)
                }
                placeholder="Information that can be shared with the customer..."
                rows={4}
              />
            </div>

            <div className="field">
              <label htmlFor="internal-notes">Internal Notes</label>
              <textarea
                id="internal-notes"
                value={internalNotes}
                onChange={(event) =>
                  setInternalNotes(event.target.value)
                }
                placeholder="Internal technician or staff notes..."
                rows={4}
              />
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="section-header">
            <div>
              <h2>Estimated Cost</h2>
              <p>Set the expected labor and parts cost.</p>
            </div>
          </div>

          <div className="cost-grid">
            <div className="field">
              <label htmlFor="estimated-labor">Estimated Labor</label>
              <input
                id="estimated-labor"
                type="number"
                min="0"
                step="0.01"
                value={estimatedLabor}
                onChange={(event) =>
                  setEstimatedLabor(event.target.value)
                }
                placeholder="0.00"
              />
            </div>

            <div className="field">
              <label htmlFor="estimated-parts">Estimated Parts</label>
              <input
                id="estimated-parts"
                type="number"
                min="0"
                step="0.01"
                value={estimatedParts}
                onChange={(event) =>
                  setEstimatedParts(event.target.value)
                }
                placeholder="0.00"
              />
            </div>

            <div className="total-box">
              <span>Estimated Total</span>
              <strong>
                {estimatedTotal.toFixed(2)}
              </strong>
            </div>
          </div>
        </section>

        <section className="form-card">
          <div className="section-header">
            <div>
              <h2>Linked Records</h2>
              <p>Optional links to existing sales or service records.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label htmlFor="order-id">Order ID</label>
              <input
                id="order-id"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="Optional order UUID"
              />
            </div>

            <div className="field">
              <label htmlFor="job-id">Job ID</label>
              <input
                id="job-id"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                placeholder="Optional job UUID"
              />
            </div>
          </div>
        </section>

        <div className="form-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={() => router.push("/repairs")}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="save-button"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="spin" />
                Creating Repair...
              </>
            ) : (
              <>
                <Save size={16} />
                Create Repair
              </>
            )}
          </button>
        </div>
      </form>

      <div className="workflow-note">
        <ClipboardList size={17} />
        <div>
          <strong>Repair workflow</strong>
          <span>
            This repair starts in Intake. Diagnosis, parts, repair,
            quality check, and completion will be managed from the repair
            detail page.
          </span>
        </div>
      </div>

      <style jsx>{`
        .page-content {
          padding: 28px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border: 0;
          background: transparent;
          color: #6b7280;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          padding: 0;
          margin-bottom: 14px;
          cursor: pointer;
        }

        .back-button:hover {
          color: #111827;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .title-icon {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f3f4f6;
          color: #111827;
        }

        h1 {
          margin: 0;
          color: #111827;
          font-size: 26px;
          line-height: 1.2;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .title-row p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 13px;
        }

        .error-banner {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 20px;
          padding: 13px 15px;
          border: 1px solid #fecaca;
          border-radius: 10px;
          background: #fef2f2;
          color: #991b1b;
          font-size: 13px;
        }

        .form-card {
          margin-bottom: 18px;
          padding: 22px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .section-header h2 {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 700;
        }

        .section-header p {
          margin: 5px 0 0;
          color: #6b7280;
          font-size: 12px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .field-wide {
          grid-column: span 1;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field label {
          color: #374151;
          font-size: 12px;
          font-weight: 600;
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
          height: 42px;
          padding: 0 12px;
        }

        .field textarea {
          padding: 11px 12px;
          resize: vertical;
          min-height: 100px;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
          border-color: #111827;
          box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.06);
        }

        .field input::placeholder,
        .field textarea::placeholder {
          color: #9ca3af;
        }

        .checkbox-field {
          grid-column: span 2;
          padding-top: 3px;
        }

        .checkbox-label {
          display: inline-flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
        }

        .checkbox-label input {
          width: 17px;
          height: 17px;
          margin: 2px 0 0;
          accent-color: #111827;
          cursor: pointer;
        }

        .checkbox-label span {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .checkbox-label strong {
          color: #374151;
          font-size: 13px;
        }

        .checkbox-label small {
          color: #6b7280;
          font-size: 12px;
        }

        .notes-grid {
          margin-top: 18px;
        }

        .cost-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          align-items: end;
        }

        .total-box {
          min-height: 42px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 13px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          background: #f9fafb;
        }

        .total-box span {
          color: #6b7280;
          font-size: 12px;
          font-weight: 600;
        }

        .total-box strong {
          color: #111827;
          font-size: 15px;
          font-weight: 700;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        .cancel-button,
        .save-button {
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease;
        }

        .cancel-button {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #374151;
        }

        .cancel-button:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .save-button {
          border: 1px solid #111827;
          background: #111827;
          color: #ffffff;
        }

        .save-button:hover:not(:disabled) {
          background: #000000;
          border-color: #000000;
        }

        .cancel-button:disabled,
        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .workflow-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 18px;
          padding: 14px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #f9fafb;
          color: #6b7280;
        }

        .workflow-note svg {
          flex-shrink: 0;
          margin-top: 1px;
          color: #6b7280;
        }

        .workflow-note div {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .workflow-note strong {
          color: #374151;
          font-size: 12px;
        }

        .workflow-note span {
          font-size: 12px;
          line-height: 1.5;
        }

        .spin {
          animation: spin 0.9s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .form-grid,
          .cost-grid {
            grid-template-columns: 1fr;
          }

          .checkbox-field {
            grid-column: span 1;
          }
        }

        @media (max-width: 640px) {
          .page-content {
            padding: 20px 16px;
          }

          .form-card {
            padding: 18px;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .cancel-button,
          .save-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}