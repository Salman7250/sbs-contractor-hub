"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Globe2,
  Lock,
  Package,
  Receipt,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import styles from "./settings.module.css";

type Company = {
  id: string;
  name: string;
  country: string | null;
  state: string | null;
  currency: string | null;
  timezone: string | null;
  app_settings?: Partial<AppSettings> | null;
};

type Profile = {
  id: string;
  full_name: string | null;
};

type TeamMember = {
  user_id: string;
  role: string;
  company_id: string;
  profile?: {
    full_name: string | null;
  } | null;
};

type AppSettings = {
  invoicePrefix: string;
  estimatePrefix: string;
  salesOrderPrefix: string;
  purchaseOrderPrefix: string;
  defaultPaymentTerms: string;
  defaultTaxRate: string;
  lowStockThreshold: string;
  inventoryNegativeStock: boolean;
  inventoryAutoDeduct: boolean;
  salesRequireCustomer: boolean;
  salesAutoCreateInvoice: boolean;
  invoiceShowCompanyAddress: boolean;
  invoiceShowTax: boolean;
  invoiceShowPaymentTerms: boolean;
  notificationsEnabled: boolean;
  lowStockNotifications: boolean;
  overdueNotifications: boolean;
  automationEnabled: boolean;
  requireApprovalForDiscounts: boolean;
  requireApprovalForStockAdjustments: boolean;
  compactTables: boolean;
  confirmBeforeDelete: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  invoicePrefix: "INV-",
  estimatePrefix: "EST-",
  salesOrderPrefix: "SO-",
  purchaseOrderPrefix: "PO-",
  defaultPaymentTerms: "Due on receipt",
  defaultTaxRate: "0",
  lowStockThreshold: "5",
  inventoryNegativeStock: false,
  inventoryAutoDeduct: true,
  salesRequireCustomer: false,
  salesAutoCreateInvoice: false,
  invoiceShowCompanyAddress: true,
  invoiceShowTax: true,
  invoiceShowPaymentTerms: true,
  notificationsEnabled: true,
  lowStockNotifications: true,
  overdueNotifications: true,
  automationEnabled: true,
  requireApprovalForDiscounts: false,
  requireApprovalForStockAdjustments: true,
  compactTables: false,
  confirmBeforeDelete: true,
};

const ROLE_ORDER: Record<string, number> = {
  owner: 1,
  admin: 2,
  manager: 3,
  member: 4,
};

function getInitials(name: string) {
  const clean = name.trim();

  if (!clean) {
    return "U";
  }

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatRole(role: string) {
  if (!role) {
    return "Owner";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getCountryName(code: string | null) {
  if (!code) {
    return "Not configured";
  }

  try {
    const displayNames = new Intl.DisplayNames(["en"], {
      type: "region",
    });

    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

type SettingCardProps = {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  accent:
    | "green"
    | "blue"
    | "purple"
    | "amber"
    | "slate";
  summary?: React.ReactNode;
};

function SettingCard({
  icon,
  eyebrow,
  title,
  description,
  href,
  accent,
  summary,
}: SettingCardProps) {
  return (
    <Link
      href={href}
      className={styles.settingsLinkCard}
    >
      <div className={styles.settingsLinkCardTop}>
        <div
          className={`${styles.settingsLinkIcon} ${styles[accent]}`}
        >
          {icon}
        </div>

        <span className={styles.settingsLinkBadge}>
          Open
        </span>
      </div>

      <span className={styles.settingsLinkEyebrow}>
        {eyebrow}
      </span>

      <h3>{title}</h3>

      <p>{description}</p>

      {summary && (
        <div className={styles.settingsLinkSummary}>
          {summary}
        </div>
      )}

      <div className={styles.settingsLinkFooter}>
        <span>Open settings</span>
        <ChevronRight size={15} />
      </div>
    </Link>
  );
}

type SettingSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

function SettingSection({
  eyebrow,
  title,
  description,
  icon,
  children,
}: SettingSectionProps) {
  return (
    <section className={styles.settingsSectionCard}>
      <div className={styles.settingsSectionHeader}>
        <div className={styles.settingsSectionIcon}>
          {icon}
        </div>

        <div>
          <span>{eyebrow}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <div className={styles.settingsSectionBody}>
        {children}
      </div>
    </section>
  );
}

type ToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  return (
    <div
      className={`${styles.settingsToggleRow} ${
        disabled ? styles.disabled : ""
      }`}
    >
      <div className={styles.settingsToggleCopy}>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>

      <button
        type="button"
        className={`${styles.settingsToggle} ${
          checked ? styles.active : ""
        }`}
        aria-pressed={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [team, setTeam] =
    useState<TeamMember[]>([]);

  const [settings, setSettings] =
    useState<AppSettings>(DEFAULT_SETTINGS);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("company_members")
        .select("company_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership) {
        throw new Error(
          "No company membership was found for this account."
        );
      }

      const {
        data: companyData,
        error: companyError,
      } = await supabase
        .from("companies")
        .select(
          "id, name, country, state, currency, timezone, app_settings"
        )
        .eq("id", membership.company_id)
        .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      if (!companyData) {
        throw new Error(
          "The company associated with your account could not be found."
        );
      }

      setCompany(companyData);

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profileData) {
        setProfile(profileData);
      }

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("company_members")
        .select("user_id, role, company_id")
        .eq(
          "company_id",
          membership.company_id
        );

      if (teamError) {
        throw teamError;
      }

      const members = teamData || [];

      if (members.length > 0) {
        const userIds = members.map(
          (member) => member.user_id
        );

        const {
          data: profilesData,
          error: profilesError,
        } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);

        if (profilesError) {
          throw profilesError;
        }

        const profileMap = new Map(
          (profilesData || []).map((item) => [
            item.id,
            item,
          ])
        );

        const normalizedTeam = members
          .map((member) => ({
            ...member,
            profile:
              profileMap.get(member.user_id) ||
              null,
          }))
          .sort(
            (a, b) =>
              (ROLE_ORDER[
                String(a.role).toLowerCase()
              ] || 99) -
              (ROLE_ORDER[
                String(b.role).toLowerCase()
              ] || 99)
          );

        setTeam(normalizedTeam);
      } else {
        setTeam([]);
      }

      let savedSettings: Partial<AppSettings> = {};

      if (
        companyData.app_settings &&
        typeof companyData.app_settings === "object"
      ) {
        savedSettings =
          companyData.app_settings;
      } else {
        try {
          const stored =
            window.localStorage.getItem(
              "sbs-settings"
            );

          if (stored) {
            savedSettings = JSON.parse(
              stored
            ) as Partial<AppSettings>;
          }
        } catch {
          savedSettings = {};
        }
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...savedSettings,
      });
    } catch (err: unknown) {
      console.error(
        "Settings load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load your settings."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveSettings(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!company) {
      setError(
        "No active company was found."
      );
      return;
    }

    if (!isAdmin) {
      setError(
        "Only company owners and admins can save workspace settings."
      );
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const {
        error: updateError,
      } = await supabase
        .from("companies")
        .update({
          app_settings: settings,
          updated_at: new Date().toISOString(),
        })
        .eq("id", company.id);

      if (updateError) {
        throw updateError;
      }

      setCompany((current) =>
        current
          ? {
              ...current,
              app_settings: settings,
            }
          : current
      );

      try {
        window.localStorage.setItem(
          "sbs-settings",
          JSON.stringify(settings)
        );
      } catch {
        // Supabase is the source of truth.
      }

      window.dispatchEvent(
        new CustomEvent(
          "sbs-settings-updated",
          {
            detail: settings,
          }
        )
      );

      setMessage(
        "Settings saved successfully."
      );
    } catch (err: unknown) {
      console.error(
        "Settings save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not save your settings."
      );
    } finally {
      setSaving(false);
    }
  }

  const companyInitials = useMemo(
    () =>
      getInitials(company?.name || ""),
    [company?.name]
  );

  const profileInitials = useMemo(
    () =>
      getInitials(
        profile?.full_name || ""
      ),
    [profile?.full_name]
  );

  const currentMember = useMemo(
    () =>
      team.find(
        (member) =>
          member.user_id === profile?.id
      ),
    [team, profile?.id]
  );

  const currentRole =
    currentMember?.role || "owner";

  const isAdmin =
    currentRole === "owner" ||
    currentRole === "admin";

  if (loading) {
    return (
      <AppShell
        title="Settings"
        description="Manage your SBS workspace configuration."
      >
        <div className={styles.settingsLoading}>
          <div className={styles.settingsLoadingCard}>
            <div className={styles.settingsSpinner} />

            <strong>
              Loading settings...
            </strong>

            <span>
              Preparing your workspace configuration.
            </span>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Settings"
      description="Manage your SBS workspace, business configuration, users, documents, and account."
    >
      <div className={styles.settingsPage}>
        {message && (
          <div
            className={`${styles.settingsAlert} ${styles.success}`}
          >
            <CheckCircle2 size={17} />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div
            className={`${styles.settingsAlert} ${styles.error}`}
          >
            <span className={styles.alertSymbol}>
              !
            </span>

            <span>{error}</span>
          </div>
        )}

        <section className={styles.settingsHero}>
          <div className={styles.settingsHeroMain}>
            <div className={styles.settingsHeroIcon}>
              <Settings2 size={25} />
            </div>

            <div>
              <span className={styles.settingsEyebrow}>
                Workspace configuration
              </span>

              <h2>
                Settings & Administration
              </h2>

              <p>
                Configure how your SBS workspace
                operates. Core business settings stay
                here, while regional, billing, expenses,
                and your personal profile have their own
                dedicated pages.
              </p>
            </div>
          </div>

          <div className={styles.workspaceChip}>
            <div className={styles.workspaceAvatar}>
              {companyInitials}
            </div>

            <div className={styles.workspaceChipCopy}>
              <span>Active workspace</span>

              <strong>
                {company?.name || "Workspace"}
              </strong>
            </div>
          </div>
        </section>

        <div className={styles.settingsSectionHeading}>
          <div>
            <span>Account</span>

            <h3>
              Workspace & account pages
            </h3>

            <p>
              These areas have their own dedicated
              settings pages.
            </p>
          </div>
        </div>

        <div className={styles.settingsLinkGrid}>
          <SettingCard
            href="/settings/regional"
            icon={<Globe2 size={20} />}
            eyebrow="Regional"
            title="Regional & Currency"
            description="Manage currency, timezone, date formats, number formats, and regional preferences."
            accent="blue"
            summary={
              <>
                <div>
                  <span>Currency</span>
                  <strong>
                    {company?.currency || "USD"}
                  </strong>
                </div>

                <div>
                  <span>Timezone</span>
                  <strong>
                    {company?.timezone ||
                      "Not configured"}
                  </strong>
                </div>
              </>
            }
          />

          <SettingCard
            href="/settings/billing"
            icon={<CreditCard size={20} />}
            eyebrow="Account"
            title="Billing & Subscription"
            description="Manage your SBS subscription, plan, billing information, and account billing status."
            accent="purple"
            summary={
              <div className={styles.summaryStatus}>
                <span className={styles.statusDot} />
                <strong>
                  Subscription management
                </strong>
              </div>
            }
          />

          <SettingCard
            href="/settings/expenses"
            icon={<WalletCards size={20} />}
            eyebrow="Finance"
            title="Expenses"
            description="Manage expense categories, approvals, defaults, and expense-related financial settings."
            accent="amber"
            summary={
              <div className={styles.summaryStatus}>
                <span className={styles.statusDot} />
                <strong>
                  Expense configuration
                </strong>
              </div>
            }
          />

          <SettingCard
            href="/settings/profile"
            icon={<Users size={20} />}
            eyebrow="Personal"
            title="My Profile"
            description="Update your personal account information and profile details."
            accent="green"
            summary={
              <div className={styles.profileCardSummary}>
                <div className={styles.miniAvatar}>
                  {profileInitials}
                </div>

                <div>
                  <strong>
                    {profile?.full_name ||
                      "Your Profile"}
                  </strong>

                  <span>
                    {formatRole(currentRole)}
                  </span>
                </div>
              </div>
            }
          />
        </div>

        <form onSubmit={saveSettings}>
          <div
            className={`${styles.settingsSectionHeading} ${styles.spaced}`}
          >
            <div>
              <span>Business</span>

              <h3>
                Core business configuration
              </h3>

              <p>
                These settings control how SBS handles
                your day-to-day product business.
              </p>
            </div>
          </div>

          <div className={styles.settingsSectionGrid}>
            <SettingSection
              eyebrow="Documents"
              title="Document Defaults"
              description="Control the default numbering and payment behavior used by your business documents."
              icon={<FileText size={19} />}
            >
              <div className={styles.settingsFieldsGrid}>
                <label className={styles.settingsField}>
                  <span>Invoice prefix</span>
                  <input
                    value={settings.invoicePrefix}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateSetting(
                        "invoicePrefix",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className={styles.settingsField}>
                  <span>Estimate prefix</span>
                  <input
                    value={settings.estimatePrefix}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateSetting(
                        "estimatePrefix",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className={styles.settingsField}>
                  <span>Sales order prefix</span>
                  <input
                    value={settings.salesOrderPrefix}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateSetting(
                        "salesOrderPrefix",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className={styles.settingsField}>
                  <span>Purchase order prefix</span>
                  <input
                    value={settings.purchaseOrderPrefix}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateSetting(
                        "purchaseOrderPrefix",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className={styles.settingsField}>
                  <span>Default payment terms</span>
                  <select
                    value={
                      settings.defaultPaymentTerms
                    }
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateSetting(
                        "defaultPaymentTerms",
                        event.target.value
                      )
                    }
                  >
                    <option>
                      Due on receipt
                    </option>
                    <option>Net 7</option>
                    <option>Net 15</option>
                    <option>Net 30</option>
                    <option>Net 60</option>
                  </select>
                </label>

                <label className={styles.settingsField}>
                  <span>Default tax rate (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      settings.defaultTaxRate
                    }
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateSetting(
                        "defaultTaxRate",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Company"
              title="Company Overview"
              description="Your primary company information comes from the workspace record."
              icon={<Building2 size={19} />}
            >
              <div className={styles.companyOverview}>
                <div className={styles.companyOverviewAvatar}>
                  {companyInitials}
                </div>

                <div className={styles.companyOverviewMain}>
                  <strong>
                    {company?.name ||
                      "Not configured"}
                  </strong>

                  <span>
                    {getCountryName(
                      company?.country || null
                    )}
                    {company?.state
                      ? ` · ${company.state}`
                      : ""}
                  </span>
                </div>
              </div>

              <div className={styles.settingsInfoGrid}>
                <div>
                  <span>Currency</span>
                  <strong>
                    {company?.currency || "USD"}
                  </strong>
                </div>

                <div>
                  <span>Timezone</span>
                  <strong>
                    {company?.timezone ||
                      "Not configured"}
                  </strong>
                </div>

                <div>
                  <span>Members</span>
                  <strong>{team.length}</strong>
                </div>

                <div>
                  <span>Your role</span>
                  <strong>
                    {formatRole(currentRole)}
                  </strong>
                </div>
              </div>

              <div className={styles.settingsNote}>
                <Globe2 size={15} />

                <span>
                  Currency and regional behavior are
                  managed from Regional Settings.
                </span>
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Sales"
              title="Sales & Orders"
              description="Set defaults for the sales workflow and order handling."
              icon={<Receipt size={19} />}
            >
              <div className={styles.settingsToggleList}>
                <Toggle
                  label="Require a customer on sales orders"
                  description="Prevent sales orders from being saved without a customer."
                  checked={
                    settings.salesRequireCustomer
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "salesRequireCustomer",
                      value
                    )
                  }
                />

                <Toggle
                  label="Automatically create invoices"
                  description="Allow the sales workflow to create an invoice when configured to do so."
                  checked={
                    settings.salesAutoCreateInvoice
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "salesAutoCreateInvoice",
                      value
                    )
                  }
                />

                <Toggle
                  label="Require approval for discounts"
                  description="Require an approval step when discounts are applied to sales."
                  checked={
                    settings.requireApprovalForDiscounts
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "requireApprovalForDiscounts",
                      value
                    )
                  }
                />
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Invoices"
              title="Invoice & Document Display"
              description="Choose which standard information appears on generated documents."
              icon={<FileText size={19} />}
            >
              <div className={styles.settingsToggleList}>
                <Toggle
                  label="Show company address"
                  description="Display your company address on invoices and supported documents."
                  checked={
                    settings.invoiceShowCompanyAddress
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "invoiceShowCompanyAddress",
                      value
                    )
                  }
                />

                <Toggle
                  label="Show tax information"
                  description="Display tax amounts and tax-related information on documents."
                  checked={
                    settings.invoiceShowTax
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "invoiceShowTax",
                      value
                    )
                  }
                />

                <Toggle
                  label="Show payment terms"
                  description="Display payment terms on invoices and supported documents."
                  checked={
                    settings.invoiceShowPaymentTerms
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "invoiceShowPaymentTerms",
                      value
                    )
                  }
                />
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Inventory"
              title="Inventory Behavior"
              description="Control the basic stock rules used throughout SBS."
              icon={<Package size={19} />}
            >
              <div
                className={`${styles.settingsFieldsGrid} ${styles.single}`}
              >
                <label className={styles.settingsField}>
                  <span>
                    Low stock threshold
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      settings.lowStockThreshold
                    }
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateSetting(
                        "lowStockThreshold",
                        event.target.value
                      )
                    }
                  />

                  <small>
                    Items at or below this quantity
                    can be considered low stock.
                  </small>
                </label>
              </div>

              <div className={styles.settingsToggleList}>
                <Toggle
                  label="Automatically deduct stock"
                  description="Allow completed sales workflows to deduct inventory automatically."
                  checked={
                    settings.inventoryAutoDeduct
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "inventoryAutoDeduct",
                      value
                    )
                  }
                />

                <Toggle
                  label="Allow negative inventory"
                  description="Allow transactions to reduce available stock below zero."
                  checked={
                    settings.inventoryNegativeStock
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "inventoryNegativeStock",
                      value
                    )
                  }
                />

                <Toggle
                  label="Require approval for stock adjustments"
                  description="Require approval before manual inventory adjustments are finalized."
                  checked={
                    settings.requireApprovalForStockAdjustments
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "requireApprovalForStockAdjustments",
                      value
                    )
                  }
                />
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Notifications"
              title="Notifications & Alerts"
              description="Control the operational alerts SBS should surface to users."
              icon={<Bell size={19} />}
            >
              <div className={styles.settingsToggleList}>
                <Toggle
                  label="Enable notifications"
                  description="Enable SBS application notifications and workspace alerts."
                  checked={
                    settings.notificationsEnabled
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "notificationsEnabled",
                      value
                    )
                  }
                />

                <Toggle
                  label="Low stock alerts"
                  description="Show notifications when inventory reaches the low-stock threshold."
                  checked={
                    settings.lowStockNotifications
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "lowStockNotifications",
                      value
                    )
                  }
                />

                <Toggle
                  label="Overdue reminders"
                  description="Show reminders for overdue financial or sales-related items."
                  checked={
                    settings.overdueNotifications
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "overdueNotifications",
                      value
                    )
                  }
                />
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Automation"
              title="Automation Defaults"
              description="Control whether automated business workflows are allowed to run."
              icon={<Wrench size={19} />}
            >
              <div className={styles.settingsToggleList}>
                <Toggle
                  label="Enable business automation"
                  description="Allow configured SBS automations and recurring workflows to run."
                  checked={
                    settings.automationEnabled
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "automationEnabled",
                      value
                    )
                  }
                />
              </div>

              <div className={styles.settingsNote}>
                <Settings2 size={15} />

                <span>
                  Automation rules can be expanded later
                  as more SBS workflows are connected.
                </span>
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Interface"
              title="Application Preferences"
              description="Small interface preferences for day-to-day use of SBS."
              icon={
                <SlidersHorizontal size={19} />
              }
            >
              <div className={styles.settingsToggleList}>
                <Toggle
                  label="Compact tables"
                  description="Use a denser row layout in supported data tables."
                  checked={
                    settings.compactTables
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "compactTables",
                      value
                    )
                  }
                />

                <Toggle
                  label="Confirm before deleting"
                  description="Ask for confirmation before supported destructive actions."
                  checked={
                    settings.confirmBeforeDelete
                  }
                  disabled={!isAdmin}
                  onChange={(value) =>
                    updateSetting(
                      "confirmBeforeDelete",
                      value
                    )
                  }
                />
              </div>
            </SettingSection>

            <SettingSection
              eyebrow="Security"
              title="Workspace Access"
              description="Review the current access level and workspace protection."
              icon={<ShieldCheck size={19} />}
            >
              <div className={styles.securityList}>
                <div className={styles.securityItem}>
                  <div className={styles.securityStatus}>
                    <CheckCircle2 size={15} />
                  </div>

                  <div>
                    <strong>
                      Authentication enabled
                    </strong>

                    <span>
                      Your account is authenticated
                      through Supabase.
                    </span>
                  </div>
                </div>

                <div className={styles.securityItem}>
                  <div className={styles.securityStatus}>
                    <CheckCircle2 size={15} />
                  </div>

                  <div>
                    <strong>
                      Company isolation enabled
                    </strong>

                    <span>
                      Workspace data is separated by
                      company-level access policies.
                    </span>
                  </div>
                </div>

                <div className={styles.securityItem}>
                  <div
                    className={
                      isAdmin
                        ? styles.securityStatus
                        : `${styles.securityStatus} ${styles.neutral}`
                    }
                  >
                    {isAdmin ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <Lock size={14} />
                    )}
                  </div>

                  <div>
                    <strong>
                      Administrative access
                    </strong>

                    <span>
                      {isAdmin
                        ? "You can manage company-level settings."
                        : "You currently have member-level access."}
                    </span>
                  </div>
                </div>
              </div>
            </SettingSection>
          </div>

          <div className={styles.settingsSaveBar}>
            <div>
              <strong>
                {isAdmin
                  ? "Save your configuration"
                  : "Workspace settings are read-only"}
              </strong>

              <span>
                {isAdmin
                  ? "Changes are stored securely in your SBS workspace."
                  : "Only company owners and admins can change workspace settings."}
              </span>
            </div>

            <button
              type="submit"
              className={styles.settingsSaveButton}
              disabled={saving || !isAdmin}
            >
              <Save size={16} />

              {saving
                ? "Saving..."
                : "Save Settings"}
            </button>
          </div>
        </form>

        <div className={styles.settingsBottomGrid}>
          <section className={styles.settingsPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}>
                <Users size={18} />
              </div>

              <div>
                <span>Workspace access</span>

                <h3>
                  Team & permissions
                </h3>
              </div>

              <span className={styles.panelCount}>
                {team.length}
              </span>
            </div>

            <div className={styles.teamList}>
              {team.length === 0 ? (
                <div className={styles.emptyTeam}>
                  <Users size={20} />

                  <span>
                    No workspace members found.
                  </span>
                </div>
              ) : (
                team.slice(0, 5).map((member) => {
                  const memberName =
                    member.profile?.full_name ||
                    "Unnamed User";

                  return (
                    <div
                      key={`${member.company_id}-${member.user_id}`}
                      className={styles.teamRow}
                    >
                      <div className={styles.teamPerson}>
                        <div className={styles.teamAvatar}>
                          {getInitials(memberName)}
                        </div>

                        <div>
                          <strong>
                            {memberName}
                          </strong>

                          <span>
                            {member.user_id ===
                            profile?.id
                              ? "You"
                              : "Workspace member"}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`${styles.teamRole} ${
                          styles[
                            `teamRole${formatRole(
                              member.role
                            )}`
                          ] || ""
                        }`}
                      >
                        {formatRole(member.role)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className={styles.settingsPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelIcon}>
                <Building2 size={18} />
              </div>

              <div>
                <span>Workspace</span>

                <h3>
                  Current configuration
                </h3>
              </div>

              <div className={styles.currencyBadge}>
                {company?.currency || "USD"}
              </div>
            </div>

            <div className={styles.workspaceSummaryGrid}>
              <div>
                <span>Company</span>

                <strong>
                  {company?.name ||
                    "Not configured"}
                </strong>
              </div>

              <div>
                <span>Country</span>

                <strong>
                  {getCountryName(
                    company?.country || null
                  )}
                </strong>
              </div>

              <div>
                <span>State / Region</span>

                <strong>
                  {company?.state ||
                    "Not configured"}
                </strong>
              </div>

              <div>
                <span>Currency</span>

                <strong>
                  {company?.currency || "USD"}
                </strong>
              </div>

              <div>
                <span>Timezone</span>

                <strong>
                  {company?.timezone ||
                    "Not configured"}
                </strong>
              </div>

              <div>
                <span>Your role</span>

                <strong>
                  {formatRole(currentRole)}
                </strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}