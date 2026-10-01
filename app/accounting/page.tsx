"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import { useRegionalSettings } from "@/app/components/regional-settings-provider";
import { formatMoney } from "@/lib/regional-settings";

type Tab = "overview" | "transactions" | "accounts" | "reports";

type Account = {
  id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  is_system: boolean;
  is_active: boolean;
  financial_account_type: string | null;
  currency: string | null;
  bank_name: string | null;
  account_last4: string | null;
  is_reconciliation_account: boolean;
};

type JournalEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  status: string;
  source: string;
  reference: string | null;
  created_at: string;
};

type JournalLine = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  line_description: string | null;
  debit: number;
  credit: number;
};

type TransactionRow = JournalEntry & {
  amount: number;
  lineCount: number;
};

const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
];

export default function AccountingPage() {
  const { settings } = useRegionalSettings();

  const supabase = useMemo(() => createClient(), []);

  const [companyId, setCompanyId] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [lines, setLines] = useState<JournalLine[]>([]);

  const [activeTab, setActiveTab] =
    useState<Tab>("overview");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [transactionFilter, setTransactionFilter] =
    useState("all");

  const [selectedEntry, setSelectedEntry] =
    useState<JournalEntry | null>(null);

  const [showNewTransaction, setShowNewTransaction] =
    useState(false);

  const [showAddFinancialAccount, setShowAddFinancialAccount] =
    useState(false);

  const [showMoneyMovement, setShowMoneyMovement] =
    useState(false);

  const [moneyMovementForm, setMoneyMovementForm] = useState({
    type: "transfer",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    accountId: "",
    counterAccountId: "",
    reference: "",
    description: "",
  });

  const [savingMoneyMovement, setSavingMoneyMovement] =
    useState(false);

  const [financialAccountForm, setFinancialAccountForm] = useState({
    name: "",
    type: "bank",
    bankName: "",
    last4: "",
    reconciliation: true,
  });

  const [savingFinancialAccount, setSavingFinancialAccount] =
    useState(false);

  const [activeReport, setActiveReport] =
    useState<"trial_balance" | "profit_loss" | "balance_sheet" | "general_ledger" | null>(null);

  const [reportAccountId, setReportAccountId] =
    useState("");

  const [transactionForm, setTransactionForm] =
    useState({
      date: new Date().toISOString().slice(0, 10),
      description: "",
      reference: "",
      source: "manual",
      debitAccountId: "",
      creditAccountId: "",
      amount: "",
    });

  const getCompany = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw authError;
    }

    if (!user) {
      throw new Error("Not authenticated.");
    }

    const { data, error: membershipError } =
      await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    if (!data?.company_id) {
      throw new Error(
        "No company membership was found."
      );
    }

    return data.company_id;
  }, [supabase]);

  const loadAccounting = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const id = await getCompany();

        const [
          companyResult,
          accountsResult,
          entriesResult,
          linesResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("id, currency")
            .eq("id", id)
            .single(),

          supabase
            .from("accounting_accounts")
            .select(
              `
                id,
                account_code,
                account_name,
                account_type,
                normal_balance,
                is_system,
                is_active,
                financial_account_type,
                currency,
                bank_name,
                account_last4,
                is_reconciliation_account
              `
            )
            .eq("company_id", id)
            .order("account_code", {
              ascending: true,
            }),

          supabase
            .from("accounting_journal_entries")
            .select(
              `
                id,
                entry_number,
                entry_date,
                reference_type,
                reference_id,
                description,
                status,
                source,
                reference,
                created_at
              `
            )
            .eq("company_id", id)
            .order("entry_date", {
              ascending: false,
            })
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("accounting_journal_lines")
            .select(
              `
                id,
                journal_entry_id,
                account_id,
                line_description,
                debit,
                credit
              `
            )
            .eq("company_id", id),
        ]);

        if (companyResult.error) {
          throw companyResult.error;
        }

        if (accountsResult.error) {
          throw accountsResult.error;
        }

        if (entriesResult.error) {
          throw entriesResult.error;
        }

        if (linesResult.error) {
          throw linesResult.error;
        }

        setCompanyId(id);

        setCurrency(
          companyResult.data?.currency || "USD"
        );

        setAccounts(
          (accountsResult.data || []) as Account[]
        );

        setEntries(
          (entriesResult.data || []) as JournalEntry[]
        );

        setLines(
          ((linesResult.data || []) as JournalLine[]).map(
            (line) => ({
              ...line,
              debit: Number(line.debit || 0),
              credit: Number(line.credit || 0),
            })
          )
        );
      } catch (err: unknown) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load accounting data."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [getCompany, supabase]
  );

  useEffect(() => {
    void loadAccounting();
  }, [loadAccounting]);

  function money(value: number) {
    return formatMoney(value, settings);
  }

  const linesByEntry = useMemo(() => {
    const result: Record<string, JournalLine[]> = {};

    for (const line of lines) {
      if (!result[line.journal_entry_id]) {
        result[line.journal_entry_id] = [];
      }

      result[line.journal_entry_id].push(line);
    }

    return result;
  }, [lines]);

  const accountsById = useMemo(() => {
    return new Map(
      accounts.map((account) => [
        account.id,
        account,
      ])
    );
  }, [accounts]);

  const transactionRows = useMemo<TransactionRow[]>(
    () => {
      return entries.map((entry) => {
        const entryLines =
          linesByEntry[entry.id] || [];

        // A journal entry is double-entry: the same transaction amount
        // appears once on the debit side and once on the credit side.
        // Use the total debit amount as the transaction amount so a
        // AED 7 expense is displayed as AED 7, not AED 14.
        const amount = entryLines.reduce(
          (sum, line) => sum + line.debit,
          0
        );

        return {
          ...entry,
          amount,
          lineCount: entryLines.length,
        };
      });
    },
    [entries, linesByEntry]
  );

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactionRows.filter((entry) => {
      if (
        transactionFilter !== "all" &&
        entry.status !== transactionFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        entry.entry_number
          .toLowerCase()
          .includes(query) ||
        entry.description
          .toLowerCase()
          .includes(query) ||
        (entry.reference || "")
          .toLowerCase()
          .includes(query) ||
        entry.source
          .toLowerCase()
          .includes(query)
      );
    });
  }, [
    transactionRows,
    search,
    transactionFilter,
  ]);

  const postedEntryIds = useMemo(() => {
    return new Set(
      entries
        .filter(
          (entry) =>
            entry.status.toLowerCase() === "posted"
        )
        .map((entry) => entry.id)
    );
  }, [entries]);

  const postedLines = useMemo(() => {
    return lines.filter((line) =>
      postedEntryIds.has(line.journal_entry_id)
    );
  }, [lines, postedEntryIds]);

  const accountBalances = useMemo(() => {
    const result: Record<string, number> = {};

    for (const line of postedLines) {
      result[line.account_id] =
        (result[line.account_id] || 0) +
        line.debit -
        line.credit;
    }

    return result;
  }, [postedLines]);

  function getBalance(account: Account) {
    const raw =
      accountBalances[account.id] || 0;

    if (account.normal_balance === "credit") {
      return -raw;
    }

    return raw;
  }

  const totals = useMemo(() => {
    const result = {
      asset: 0,
      liability: 0,
      equity: 0,
      revenue: 0,
      expense: 0,
    };

    for (const account of accounts) {
      if (!account.is_active) {
        continue;
      }

      const type = account.account_type;

      if (type in result) {
        result[type as keyof typeof result] +=
          getBalance(account);
      }
    }

    return result;
  }, [accounts, accountBalances]);

  const cashAccounts = useMemo(() => {
    return accounts.filter(
      (account) =>
        account.is_active &&
        account.account_type === "asset" &&
        Boolean(account.financial_account_type)
    );
  }, [accounts]);

  const cashBankAccounts = useMemo(() => {
    return cashAccounts.filter((account) =>
      ["cash", "petty_cash", "bank", "digital_wallet", "card", "wallet"].includes(
        account.financial_account_type || ""
      )
    );
  }, [cashAccounts]);

  const totalCash = useMemo(() => {
    return cashAccounts.reduce(
      (sum, account) =>
        sum + getBalance(account),
      0
    );
  }, [cashAccounts, accountBalances]);

  const postedEntries = useMemo(() => {
    return entries.filter(
      (entry) =>
        entry.status.toLowerCase() === "posted"
    ).length;
  }, [entries]);

  const draftEntries = useMemo(() => {
    return entries.filter(
      (entry) =>
        entry.status.toLowerCase() === "draft"
    ).length;
  }, [entries]);

  const totalDebits = useMemo(
    () =>
      postedLines.reduce(
        (sum, line) => sum + line.debit,
        0
      ),
    [postedLines]
  );

  const totalCredits = useMemo(
    () =>
      postedLines.reduce(
        (sum, line) => sum + line.credit,
        0
      ),
    [postedLines]
  );

  const trialBalanceRows = useMemo(() => {
    return accounts
      .filter((account) => account.is_active)
      .map((account) => {
        const debit = postedLines
          .filter((line) => line.account_id === account.id)
          .reduce((sum, line) => sum + line.debit, 0);
        const credit = postedLines
          .filter((line) => line.account_id === account.id)
          .reduce((sum, line) => sum + line.credit, 0);
        const net = debit - credit;

        return {
          account,
          debit: net > 0 ? net : 0,
          credit: net < 0 ? Math.abs(net) : 0,
        };
      })
      .filter((row) => row.debit > 0 || row.credit > 0);
  }, [accounts, postedLines]);

  const profitAndLoss = useMemo(() => ({
    revenue: totals.revenue,
    expenses: totals.expense,
    netProfit: totals.revenue - totals.expense,
  }), [totals]);

  const balanceSheet = useMemo(() => {
    const currentEarnings =
      totals.revenue - totals.expense;

    return {
      assets: accounts
        .filter((account) => account.is_active && account.account_type === "asset")
        .map((account) => ({ account, balance: getBalance(account) }))
        .filter((row) => Math.abs(row.balance) > 0.000001),
      liabilities: accounts
        .filter((account) => account.is_active && account.account_type === "liability")
        .map((account) => ({ account, balance: getBalance(account) }))
        .filter((row) => Math.abs(row.balance) > 0.000001),
      equity: accounts
        .filter((account) => account.is_active && account.account_type === "equity")
        .map((account) => ({ account, balance: getBalance(account) }))
        .filter((row) => Math.abs(row.balance) > 0.000001),
      currentEarnings,
    };
  }, [accounts, accountBalances, totals]);

  const generalLedgerLines = useMemo(() => {
    if (!reportAccountId) return [];

    const account = accountsById.get(reportAccountId);
    if (!account) return [];

    let runningBalance = 0;

    return postedLines
      .filter((line) => line.account_id === reportAccountId)
      .map((line) => {
        const entry = entries.find(
          (item) => item.id === line.journal_entry_id
        );

        const movement =
          account.normal_balance === "credit"
            ? line.credit - line.debit
            : line.debit - line.credit;

        runningBalance += movement;

        return {
          line,
          entry: entry || null,
          runningBalance,
        };
      })
      .sort((a, b) => {
        const aDate = a.entry?.entry_date || "";
        const bDate = b.entry?.entry_date || "";
        return bDate.localeCompare(aDate);
      });
  }, [reportAccountId, accountsById, postedLines, entries]);

  const recentTransactions =
    transactionRows.slice(0, 8);

  function getAccountName(accountId: string) {
    const account = accountsById.get(accountId);

    if (!account) {
      return "Unknown account";
    }

    return `${account.account_code} — ${account.account_name}`;
  }

  function openEntry(entry: JournalEntry) {
    setSelectedEntry(entry);
  }

  function resetTransactionForm() {
    setTransactionForm({
      date: new Date().toISOString().slice(0, 10),
      description: "",
      reference: "",
      source: "manual",
      debitAccountId: "",
      creditAccountId: "",
      amount: "",
    });
  }

  function openNewTransaction() {
    resetTransactionForm();
    setShowNewTransaction(true);
  }

  function closeNewTransaction() {
    setShowNewTransaction(false);
  }

  function resetFinancialAccountForm() {
    setFinancialAccountForm({
      name: "",
      type: "bank",
      bankName: "",
      last4: "",
      reconciliation: true,
    });
  }

  async function createFinancialAccount() {
    setError("");

    const name = financialAccountForm.name.trim();
    const bankName = financialAccountForm.bankName.trim();
    const last4 = financialAccountForm.last4.replace(/\D/g, "").slice(-4);

    if (!companyId) {
      setError("Company could not be identified.");
      return;
    }

    if (!name) {
      setError("Account name is required.");
      return;
    }

    if (financialAccountForm.type === "bank" && !bankName) {
      setError("Bank name is required for a bank account.");
      return;
    }

    setSavingFinancialAccount(true);

    try {
      const { data: codeRows, error: codeError } = await supabase
        .from("accounting_accounts")
        .select("account_code")
        .eq("company_id", companyId);

      if (codeError) {
        throw codeError;
      }

      const usedCodes = new Set(
        (codeRows || []).map((row) => String(row.account_code))
      );

      let nextCode = 1040;
      while (usedCodes.has(String(nextCode)) && nextCode < 1100) {
        nextCode += 10;
      }

      if (nextCode >= 1100) {
        throw new Error("No available financial account code is available.");
      }

      const { error: insertError } = await supabase
        .from("accounting_accounts")
        .insert({
          company_id: companyId,
          account_code: String(nextCode),
          account_name: name,
          account_type: "asset",
          normal_balance: "debit",
          is_system: false,
          is_active: true,
          financial_account_type: financialAccountForm.type,
          currency: currency || "USD",
          bank_name: financialAccountForm.type === "bank" ? bankName : null,
          account_last4: last4 || null,
          is_reconciliation_account: financialAccountForm.reconciliation,
        });

      if (insertError) {
        throw insertError;
      }

      setShowAddFinancialAccount(false);
      resetFinancialAccountForm();
      await loadAccounting(true);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create financial account."
      );
    } finally {
      setSavingFinancialAccount(false);
    }
  }

  function resetMoneyMovementForm() {
    setMoneyMovementForm({
      type: "transfer",
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      accountId: "",
      counterAccountId: "",
      reference: "",
      description: "",
    });
  }

  function openMoneyMovement() {
    resetMoneyMovementForm();
    setShowMoneyMovement(true);
  }

  function closeMoneyMovement() {
    if (!savingMoneyMovement) {
      setShowMoneyMovement(false);
    }
  }

  async function createMoneyMovement() {
    setError("");

    const amount = Number(moneyMovementForm.amount);
    const type = moneyMovementForm.type;

    if (!companyId) {
      setError("Company could not be identified.");
      return;
    }

    if (!moneyMovementForm.date) {
      setError("Transaction date is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    if (!moneyMovementForm.accountId) {
      setError("Select the cash or bank account.");
      return;
    }

    const isOwnerMovement =
      type === "owner_investment" || type === "owner_withdrawal";

    if (!isOwnerMovement && !moneyMovementForm.counterAccountId) {
      setError("Select the other account.");
      return;
    }

    if (
      !isOwnerMovement &&
      moneyMovementForm.accountId === moneyMovementForm.counterAccountId
    ) {
      setError("The two accounts must be different.");
      return;
    }

    const cashAccount = accountsById.get(moneyMovementForm.accountId);
    const counterAccount = moneyMovementForm.counterAccountId
      ? accountsById.get(moneyMovementForm.counterAccountId)
      : null;

    if (!cashAccount || (!isOwnerMovement && !counterAccount)) {
      setError("Selected account could not be found.");
      return;
    }

    if (!cashAccount.financial_account_type) {
      setError("The selected account is not configured as a cash or bank account.");
      return;
    }

    const cashLikeTypes = [
      "cash",
      "petty_cash",
      "digital_wallet",
      "card",
      "wallet",
    ];

    if (type === "bank_deposit") {
      if (cashAccount.financial_account_type === "bank") {
        setError("For a bank deposit, select the bank account as the destination and a cash account as the other account.");
        return;
      }
      if (counterAccount?.financial_account_type !== "bank") {
        setError("The other account must be a bank account for a bank deposit.");
        return;
      }
    }

    if (type === "bank_withdrawal") {
      if (cashAccount.financial_account_type !== "bank") {
        setError("For a bank withdrawal, select the bank account first.");
        return;
      }
      if (!counterAccount?.financial_account_type || !cashLikeTypes.includes(counterAccount.financial_account_type)) {
        setError("The other account must be a cash, petty cash or payment account for a bank withdrawal.");
        return;
      }
    }

    if (type === "transfer" && (!counterAccount?.is_active || !counterAccount.financial_account_type)) {
      setError("The other account must be an active financial account for a transfer.");
      return;
    }

    setSavingMoneyMovement(true);

    try {
      let transactionType = type;
      let fromAccountId = moneyMovementForm.counterAccountId;
      let toAccountId = moneyMovementForm.accountId;

      if (type === "transfer" || type === "bank_deposit") {
        fromAccountId = moneyMovementForm.counterAccountId;
        toAccountId = moneyMovementForm.accountId;
      } else if (type === "bank_withdrawal") {
        fromAccountId = moneyMovementForm.accountId;
        toAccountId = moneyMovementForm.counterAccountId;
      } else if (type === "cash_received") {
        fromAccountId = moneyMovementForm.counterAccountId;
        toAccountId = moneyMovementForm.accountId;
      } else if (type === "cash_given") {
        fromAccountId = moneyMovementForm.accountId;
        toAccountId = moneyMovementForm.counterAccountId;
      }

      if (type === "owner_investment" || type === "owner_withdrawal") {
        const { error: rpcError } = await supabase.rpc(
          "post_owner_equity_transaction",
          {
            p_company_id: companyId,
            p_transaction_type: type,
            p_cash_account_id: moneyMovementForm.accountId,
            p_amount: amount,
            p_currency: currency || "USD",
            p_transaction_date: moneyMovementForm.date,
            p_reference: moneyMovementForm.reference.trim() || null,
            p_description:
              moneyMovementForm.description.trim() ||
              (type === "owner_investment"
                ? "Owner investment"
                : "Owner withdrawal"),
            p_employee_id: null,
          }
        );

        if (rpcError) throw rpcError;
      } else {
        const { error: rpcError } = await supabase.rpc(
          "post_finance_transaction",
          {
            p_company_id: companyId,
            p_transaction_type: transactionType,
            p_from_account_id: fromAccountId,
            p_to_account_id: toAccountId,
            p_amount: amount,
            p_currency: currency || "USD",
            p_transaction_date: moneyMovementForm.date,
            p_reference: moneyMovementForm.reference.trim() || null,
            p_description:
              moneyMovementForm.description.trim() ||
              getMoneyMovementLabel(type),
            p_employee_id: null,
          }
        );

        if (rpcError) throw rpcError;
      }

      setShowMoneyMovement(false);
      resetMoneyMovementForm();
      await loadAccounting(true);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to post the finance transaction."
      );
    } finally {
      setSavingMoneyMovement(false);
    }
  }

  async function createTransaction() {
    setError("");

    const amount = Number(transactionForm.amount);

    if (!transactionForm.description.trim()) {
      setError("Transaction description is required.");
      return;
    }

    if (!transactionForm.debitAccountId) {
      setError("Select the debit account.");
      return;
    }

    if (!transactionForm.creditAccountId) {
      setError("Select the credit account.");
      return;
    }

    if (transactionForm.debitAccountId === transactionForm.creditAccountId) {
      setError("Debit and credit accounts must be different.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid transaction amount.");
      return;
    }

    if (!transactionForm.date) {
      setError("Transaction date is required.");
      return;
    }

    if (!companyId) {
      setError("Company could not be identified.");
      return;
    }

    try {
      const transactionType =
        transactionForm.source === "transfer"
          ? "transfer"
          : transactionForm.source === "payment"
            ? "cash_received"
            : transactionForm.source === "expense"
              ? "cash_given"
              : "adjustment";

      const { data, error: rpcError } =
        await supabase.rpc("post_finance_transaction", {
          p_company_id: companyId,
          p_transaction_type: transactionType,
          p_from_account_id: transactionForm.creditAccountId,
          p_to_account_id: transactionForm.debitAccountId,
          p_amount: amount,
          p_currency: currency || "USD",
          p_transaction_date: transactionForm.date,
          p_reference: transactionForm.reference.trim() || null,
          p_description: transactionForm.description.trim(),
          p_employee_id: null,
        });

      if (rpcError) {
        throw rpcError;
      }

      console.log("Finance transaction created:", data);

      setShowNewTransaction(false);
      resetTransactionForm();

      await loadAccounting(true);
    } catch (err: unknown) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create transaction."
      );
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Accounting"
        description="Financial control center"
      >
        <div className="loading">
          <div className="spinner" />
          <p>Loading accounting...</p>
        </div>

        <style>{`
          .loading {
            min-height: 520px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #64748b;
          }

          .spinner {
            width: 30px;
            height: 30px;
            border: 3px solid #e2e8f0;
            border-top-color: #0f172a;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          .loading p {
            margin-top: 12px;
            font-size: 12px;
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Accounting"
      description="Financial control center"
      actions={
        <div className="top-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              void loadAccounting(true)
            }
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              window.location.href = "/payments";
            }}
          >
            Customer Payments
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={openMoneyMovement}
          >
            Money Movement
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={openNewTransaction}
          >
            + New Transaction
          </button>
        </div>
      }
    >
      <main className="page">
        {error && (
          <div className="alert error">
            <strong>Accounting error</strong>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        <div className="tabs">
          {[
            ["overview", "Overview"],
            ["transactions", "Transactions"],
            ["accounts", "Accounts"],
            ["reports", "Reports"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                activeTab === value
                  ? "tab active"
                  : "tab"
              }
              onClick={() =>
                setActiveTab(value as Tab)
              }
            >
              {label}
            </button>
          ))}

        </div>

        {activeTab === "overview" && (
          <section>
            <div className="summary-grid">
              <SummaryCard
                label="CASH & BANK"
                value={money(totalCash)}
                detail={`${cashAccounts.length} active accounts`}
                icon="$"
              />

              <SummaryCard
                label="TOTAL ASSETS"
                value={money(totals.asset)}
                detail="Active asset accounts"
                icon="◆"
              />

              <SummaryCard
                label="LIABILITIES"
                value={money(totals.liability)}
                detail="Current liabilities"
                icon="L"
              />

              <SummaryCard
                label="EQUITY"
                value={money(totals.equity)}
                detail="Company equity"
                icon="E"
              />

              <SummaryCard
                label="REVENUE"
                value={money(totals.revenue)}
                detail="Ledger revenue"
                icon="↗"
              />

              <SummaryCard
                label="EXPENSES"
                value={money(totals.expense)}
                detail="Ledger expenses"
                icon="−"
              />
            </div>

            <section className="cash-bank-card card">
              <CardHeader
                title="Cash & Bank"
                description="Live balances across company cash, bank and payment accounts"
                action={
                  <div className="card-actions">
                    <button
                      type="button"
                      className="secondary-button small"
                      onClick={openMoneyMovement}
                    >
                      Move Money
                    </button>
                    <button
                      type="button"
                      className="primary-button small"
                      onClick={() => {
                        resetFinancialAccountForm();
                        setShowAddFinancialAccount(true);
                      }}
                    >
                      + Add Account
                    </button>
                  </div>
                }
              />

              {cashBankAccounts.length === 0 ? (
                <div className="empty cash-empty">
                  No cash or bank accounts configured yet.
                </div>
              ) : (
                <div className="cash-bank-grid">
                  {cashBankAccounts.map((account) => {
                    const balance = getBalance(account);
                    const typeLabel =
                      account.financial_account_type === "petty_cash"
                        ? "Petty Cash"
                        : account.financial_account_type === "digital_wallet"
                          ? "Digital Wallet"
                          : account.financial_account_type === "card"
                            ? "Card"
                            : account.financial_account_type === "bank"
                              ? "Bank"
                              : "Cash";

                    return (
                      <div className="cash-account-card" key={account.id}>
                        <div className="cash-account-top">
                          <div className="cash-account-icon">
                            {account.financial_account_type === "bank" ? "B" : "$"}
                          </div>
                          <div className="cash-account-heading">
                            <strong>{account.account_name}</strong>
                            <span>
                              {typeLabel}
                              {account.bank_name
                                ? ` · ${account.bank_name}`
                                : ""}
                              {account.account_last4
                                ? ` ·•••• ${account.account_last4}`
                                : ""}
                            </span>
                          </div>
                          {account.is_reconciliation_account && (
                            <span className="reconciliation-badge">
                              Reconcile
                            </span>
                          )}
                        </div>

                        <div className="cash-account-bottom">
                          <span>Available balance</span>
                          <strong className={balance < 0 ? "negative" : ""}>
                            {money(balance)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="two-column">
              <section className="card">
                <CardHeader
                  title="Recent Transactions"
                  description="Latest journal activity"
                  action={
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setActiveTab(
                          "transactions"
                        )
                      }
                    >
                      View all
                    </button>
                  }
                />

                <TransactionList
                  rows={recentTransactions}
                  currency={currency}
                  money={money}
                  onSelect={openEntry}
                />
              </section>

              <section className="card">
                <CardHeader
                  title="Ledger Status"
                  description="Current accounting activity"
                />

                <div className="status-list">
                  <StatusRow
                    label="Posted entries"
                    value={String(
                      postedEntries
                    )}
                  />

                  <StatusRow
                    label="Draft entries"
                    value={String(
                      draftEntries
                    )}
                  />

                  <StatusRow
                    label="Journal lines"
                    value={String(
                      lines.length
                    )}
                  />

                  <StatusRow
                    label="Accounts"
                    value={String(
                      accounts.length
                    )}
                  />

                  <StatusRow
                    label="Currency"
                    value={currency}
                  />

                  <StatusRow
                    label="Debits"
                    value={money(
                      totalDebits
                    )}
                  />

                  <StatusRow
                    label="Credits"
                    value={money(
                      totalCredits
                    )}
                  />
                </div>
              </section>
            </div>
          </section>
        )}

        {activeTab === "transactions" && (
          <section className="card">
            <CardHeader
              title="Transactions"
              description="Journal entries and their accounting amounts"
              action={
                <button
                  type="button"
                  className="primary-button small"
                  onClick={openNewTransaction}
                >
                  + New Transaction
                </button>
              }
            />

            <div className="filters">
              <div className="search">
                <span>⌕</span>

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search transactions..."
                />
              </div>

              <select
                value={transactionFilter}
                onChange={(event) =>
                  setTransactionFilter(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All statuses
                </option>
                <option value="posted">
                  Posted
                </option>
                <option value="draft">
                  Draft
                </option>
                <option value="void">
                  Void
                </option>
              </select>
            </div>

            <TransactionList
              rows={filteredTransactions}
              currency={currency}
              money={money}
              onSelect={openEntry}
              detailed
            />
          </section>
        )}

        {activeTab === "accounts" && (
          <section className="card">
            <CardHeader
              title="Chart of Accounts"
              description={`${accounts.length} accounts configured for this company`}
            />

            <div className="account-grid">
              {accounts.map((account) => {
                const balance =
                  getBalance(account);

                return (
                  <div
                    className={`account-card ${
                      !account.is_active
                        ? "inactive"
                        : ""
                    }`}
                    key={account.id}
                  >
                    <div className="account-icon">
                      {getAccountIcon(
                        account.account_type
                      )}
                    </div>

                    <div className="account-content">
                      <div className="account-heading">
                        <strong>
                          {account.account_name}
                        </strong>

                        {account.is_system && (
                          <span className="badge">
                            SYSTEM
                          </span>
                        )}
                      </div>

                      <div className="account-meta">
                        <span>
                          {account.account_code}
                        </span>
                        <span>•</span>
                        <span>
                          {capitalize(
                            account.account_type
                          )}
                        </span>

                        {account.bank_name && (
                          <>
                            <span>•</span>
                            <span>
                              {account.bank_name}
                              {account.account_last4
                                ? ` •••• ${account.account_last4}`
                                : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="account-balance">
                      <small>
                        BALANCE
                      </small>

                      <strong
                        className={
                          balance < 0
                            ? "negative"
                            : ""
                        }
                      >
                        {money(balance)}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "reports" && (
          <section className="reports-grid">
            <ReportCard
              title="Trial Balance"
              description="Review total debits and credits by account."
              value={money(totalDebits)}
              action={() =>
                setActiveReport("trial_balance")
              }
            />

            <ReportCard
              title="Profit & Loss"
              description="Revenue and expense summary from the ledger."
              value={money(
                totals.revenue -
                  totals.expense
              )}
              action={() =>
                setActiveReport("profit_loss")
              }
            />

            <ReportCard
              title="Balance Sheet"
              description="Assets, liabilities and equity."
              value={money(totals.asset)}
              action={() =>
                setActiveReport("balance_sheet")
              }
            />

            <ReportCard
              title="General Ledger"
              description="Account-level journal activity."
              value={`${lines.length} lines`}
              action={() => {
                const firstAccount =
                  accounts.find((account) => account.is_active);
                setReportAccountId(
                  firstAccount?.id || ""
                );
                setActiveReport("general_ledger");
              }}
            />
          </section>
        )}

        {activeReport && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setActiveReport(null);
              }
            }}
          >
            <div className="modal report-modal">
              <div className="modal-header">
                <div>
                  <span className="modal-kicker">
                    ACCOUNTING REPORT
                  </span>
                  <h2>
                    {activeReport === "trial_balance"
                      ? "Trial Balance"
                      : activeReport === "profit_loss"
                        ? "Profit & Loss"
                        : activeReport === "balance_sheet"
                          ? "Balance Sheet"
                          : "General Ledger"}
                  </h2>
                  <p>
                    Based on posted journal entries in the company ledger.
                  </p>
                </div>

                <button
                  type="button"
                  className="close"
                  onClick={() => setActiveReport(null)}
                >
                  ×
                </button>
              </div>

              {activeReport === "trial_balance" && (
                <div className="report-body">
                  <div className="report-summary">
                    <div>
                      <span>Total Debits</span>
                      <strong>{money(totalDebits)}</strong>
                    </div>
                    <div>
                      <span>Total Credits</span>
                      <strong>{money(totalCredits)}</strong>
                    </div>
                    <div>
                      <span>Difference</span>
                      <strong className={Math.abs(totalDebits - totalCredits) < 0.01 ? "balanced" : "negative"}>
                        {money(Math.abs(totalDebits - totalCredits))}
                      </strong>
                    </div>
                  </div>

                  <div className="report-table-wrap">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>ACCOUNT</th>
                          <th>TYPE</th>
                          <th className="right">DEBIT</th>
                          <th className="right">CREDIT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalanceRows.map((row) => (
                          <tr key={row.account.id}>
                            <td>
                              <strong>{row.account.account_code} — {row.account.account_name}</strong>
                            </td>
                            <td>{capitalize(row.account.account_type)}</td>
                            <td className="right">{row.debit ? money(row.debit) : "—"}</td>
                            <td className="right">{row.credit ? money(row.credit) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>TOTAL</td>
                          <td className="right">{money(totalDebits)}</td>
                          <td className="right">{money(totalCredits)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {activeReport === "profit_loss" && (
                <div className="report-body">
                  <div className="profit-hero">
                    <span>NET PROFIT / LOSS</span>
                    <strong className={profitAndLoss.netProfit < 0 ? "negative" : "balanced"}>
                      {money(profitAndLoss.netProfit)}
                    </strong>
                  </div>

                  <div className="report-table-wrap">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>ACCOUNT</th>
                          <th>TYPE</th>
                          <th className="right">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts
                          .filter((account) => account.is_active && (account.account_type === "revenue" || account.account_type === "expense"))
                          .map((account) => {
                            const balance = getBalance(account);
                            return (
                              <tr key={account.id}>
                                <td><strong>{account.account_code} — {account.account_name}</strong></td>
                                <td>{capitalize(account.account_type)}</td>
                                <td className="right">{money(balance)}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={2}>NET PROFIT / LOSS</td>
                          <td className={`right ${profitAndLoss.netProfit < 0 ? "negative" : "balanced"}`}>{money(profitAndLoss.netProfit)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {activeReport === "balance_sheet" && (
                <div className="report-body">
                  <div className="balance-columns">
                    <div className="balance-section">
                      <h3>Assets</h3>
                      {balanceSheet.assets.map((row) => (
                        <div className="balance-row" key={row.account.id}>
                          <span>{row.account.account_code} — {row.account.account_name}</span>
                          <strong>{money(row.balance)}</strong>
                        </div>
                      ))}
                      <div className="balance-total">
                        <span>Total Assets</span>
                        <strong>{money(totals.asset)}</strong>
                      </div>
                    </div>

                    <div className="balance-section">
                      <h3>Liabilities & Equity</h3>
                      {balanceSheet.liabilities.map((row) => (
                        <div className="balance-row" key={row.account.id}>
                          <span>{row.account.account_code} — {row.account.account_name}</span>
                          <strong>{money(row.balance)}</strong>
                        </div>
                      ))}
                      {balanceSheet.equity.map((row) => (
                        <div className="balance-row" key={row.account.id}>
                          <span>{row.account.account_code} — {row.account.account_name}</span>
                          <strong>{money(row.balance)}</strong>
                        </div>
                      ))}
                      <div className="balance-row">
                        <span>Current Period Earnings</span>
                        <strong>{money(balanceSheet.currentEarnings)}</strong>
                      </div>
                      <div className="balance-total">
                        <span>Total Liabilities + Equity</span>
                        <strong>{money(totals.liability + totals.equity + balanceSheet.currentEarnings)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeReport === "general_ledger" && (
                <div className="report-body">
                  <div className="ledger-selector">
                    <label>Account</label>
                    <select
                      value={reportAccountId}
                      onChange={(event) => setReportAccountId(event.target.value)}
                    >
                      <option value="">Select account</option>
                      {accounts.filter((account) => account.is_active).map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_code} — {account.account_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {reportAccountId && (
                    <div className="report-table-wrap">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th>ENTRY</th>
                            <th>DESCRIPTION</th>
                            <th className="right">DEBIT</th>
                            <th className="right">CREDIT</th>
                            <th className="right">BALANCE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generalLedgerLines.map((row) => (
                            <tr key={row.line.id}>
                              <td>{row.entry ? formatDate(row.entry.entry_date) : "—"}</td>
                              <td>{row.entry?.entry_number || "—"}</td>
                              <td><strong>{row.entry?.description || row.line.line_description || "—"}</strong></td>
                              <td className="right">{row.line.debit ? money(row.line.debit) : "—"}</td>
                              <td className="right">{row.line.credit ? money(row.line.credit) : "—"}</td>
                              <td className="right"><strong>{money(row.runningBalance)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showMoneyMovement && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeMoneyMovement();
              }
            }}
          >
            <div className="modal create-modal money-movement-modal">
              <div className="modal-header">
                <div>
                  <span className="modal-kicker">
                    CASH & BANK
                  </span>
                  <h2>Move Money</h2>
                  <p>
                    Record transfers, deposits, withdrawals and owner money movements with the correct double-entry automatically.
                  </p>
                </div>
                <button
                  type="button"
                  className="close"
                  onClick={closeMoneyMovement}
                  disabled={savingMoneyMovement}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="movement-type-grid">
                  {[
                    ["transfer", "Transfer"],
                    ["bank_deposit", "Bank Deposit"],
                    ["bank_withdrawal", "Bank Withdrawal"],
                    ["cash_received", "Cash Received"],
                    ["cash_given", "Cash Given"],
                    ["owner_investment", "Owner Investment"],
                    ["owner_withdrawal", "Owner Withdrawal"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        moneyMovementForm.type === value
                          ? "movement-type active"
                          : "movement-type"
                      }
                      onClick={() =>
                        setMoneyMovementForm((current) => ({
                          ...current,
                          type: value,
                          accountId: "",
                          counterAccountId: "",
                        }))
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>Date</label>
                    <input
                      type="date"
                      value={moneyMovementForm.date}
                      onChange={(event) =>
                        setMoneyMovementForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>Amount</label>
                    <div className="amount-input">
                      <span>{currency}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={moneyMovementForm.amount}
                        onChange={(event) =>
                          setMoneyMovementForm((current) => ({
                            ...current,
                            amount: event.target.value,
                          }))
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>Cash / Bank Account</label>
                    <select
                      value={moneyMovementForm.accountId}
                      onChange={(event) =>
                        setMoneyMovementForm((current) => ({
                          ...current,
                          accountId: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select cash or bank account</option>
                      {cashBankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_code} — {account.account_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      {moneyMovementForm.type === "owner_investment" || moneyMovementForm.type === "owner_withdrawal"
                        ? "Owner Equity Account"
                        : "Other Account"}
                    </label>
                    <select
                      value={moneyMovementForm.counterAccountId}
                      onChange={(event) =>
                        setMoneyMovementForm((current) => ({
                          ...current,
                          counterAccountId: event.target.value,
                        }))
                      }
                      disabled={
                        moneyMovementForm.type === "owner_investment" ||
                        moneyMovementForm.type === "owner_withdrawal"
                      }
                    >
                      <option value="">
                        {moneyMovementForm.type === "owner_investment" || moneyMovementForm.type === "owner_withdrawal"
                          ? "Handled automatically"
                          : "Select account"}
                      </option>
                      {accounts
                        .filter((account) =>
                          account.is_active &&
                          account.id !== moneyMovementForm.accountId
                        )
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.account_code} — {account.account_name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>Reference <span className="optional">Optional</span></label>
                    <input
                      value={moneyMovementForm.reference}
                      onChange={(event) =>
                        setMoneyMovementForm((current) => ({
                          ...current,
                          reference: event.target.value,
                        }))
                      }
                      placeholder="Receipt, bank reference, etc."
                    />
                  </div>

                  <div className="field">
                    <label>Description <span className="optional">Optional</span></label>
                    <input
                      value={moneyMovementForm.description}
                      onChange={(event) =>
                        setMoneyMovementForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder={getMoneyMovementLabel(moneyMovementForm.type)}
                    />
                  </div>
                </div>

                <div className="movement-note">
                  {getMoneyMovementHelp(moneyMovementForm.type)}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeMoneyMovement}
                  disabled={savingMoneyMovement}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void createMoneyMovement()}
                  disabled={savingMoneyMovement}
                >
                  {savingMoneyMovement ? "Posting..." : "Post Transaction"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddFinancialAccount && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setShowAddFinancialAccount(false);
              }
            }}
          >
            <div className="modal financial-account-modal">
              <div className="modal-header">
                <div>
                  <span className="modal-kicker">
                    CASH & BANK
                  </span>
                  <h2>Add Financial Account</h2>
                  <p>
                    Add a cash, bank or payment account to track its live ledger balance.
                  </p>
                </div>
                <button
                  type="button"
                  className="close"
                  onClick={() => setShowAddFinancialAccount(false)}
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="form-grid">
                  <div className="field full">
                    <label>Account Name</label>
                    <input
                      value={financialAccountForm.name}
                      onChange={(event) =>
                        setFinancialAccountForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="e.g. Emirates NBD Business Account"
                    />
                  </div>

                  <div className="field">
                    <label>Account Type</label>
                    <select
                      value={financialAccountForm.type}
                      onChange={(event) =>
                        setFinancialAccountForm((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                    >
                      <option value="bank">Bank Account</option>
                      <option value="cash">Cash</option>
                      <option value="petty_cash">Petty Cash</option>
                      <option value="digital_wallet">Digital Wallet</option>
                      <option value="card">Card</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Currency</label>
                    <input value={currency || "USD"} readOnly />
                  </div>

                  {financialAccountForm.type === "bank" && (
                    <div className="field">
                      <label>Bank Name</label>
                      <input
                        value={financialAccountForm.bankName}
                        onChange={(event) =>
                          setFinancialAccountForm((current) => ({
                            ...current,
                            bankName: event.target.value,
                          }))
                        }
                        placeholder="e.g. Emirates NBD"
                      />
                    </div>
                  )}

                  <div className="field">
                    <label>Last 4 Digits <span className="optional">Optional</span></label>
                    <input
                      value={financialAccountForm.last4}
                      maxLength={4}
                      inputMode="numeric"
                      onChange={(event) =>
                        setFinancialAccountForm((current) => ({
                          ...current,
                          last4: event.target.value.replace(/\D/g, "").slice(0, 4),
                        }))
                      }
                      placeholder="1234"
                    />
                  </div>

                  <label className="checkbox-field full">
                    <input
                      type="checkbox"
                      checked={financialAccountForm.reconciliation}
                      onChange={(event) =>
                        setFinancialAccountForm((current) => ({
                          ...current,
                          reconciliation: event.target.checked,
                        }))
                      }
                    />
                    <span>Mark this account for reconciliation</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowAddFinancialAccount(false)}
                  disabled={savingFinancialAccount}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void createFinancialAccount()}
                  disabled={savingFinancialAccount}
                >
                  {savingFinancialAccount ? "Adding..." : "Add Account"}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedEntry && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setSelectedEntry(null);
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <div>
                  <span className="modal-kicker">
                    JOURNAL ENTRY
                  </span>

                  <h2>
                    {selectedEntry.entry_number}
                  </h2>

                  <p>
                    {selectedEntry.description}
                  </p>
                </div>

                <button
                  type="button"
                  className="close"
                  onClick={() =>
                    setSelectedEntry(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="entry-summary">
                <div>
                  <small>DATE</small>
                  <strong>
                    {formatDate(
                      selectedEntry.entry_date
                    )}
                  </strong>
                </div>

                <div>
                  <small>STATUS</small>
                  <strong>
                    {capitalize(
                      selectedEntry.status
                    )}
                  </strong>
                </div>

                <div>
                  <small>SOURCE</small>
                  <strong>
                    {capitalize(
                      selectedEntry.source
                    )}
                  </strong>
                </div>

                <div>
                  <small>REFERENCE</small>
                  <strong>
                    {selectedEntry.reference ||
                      "—"}
                  </strong>
                </div>
              </div>

              <div className="entry-lines">
                <div className="entry-line header">
                  <span>ACCOUNT</span>
                  <span>DESCRIPTION</span>
                  <span>DEBIT</span>
                  <span>CREDIT</span>
                </div>

                {(
                  linesByEntry[
                    selectedEntry.id
                  ] || []
                ).map((line) => (
                  <div
                    className="entry-line"
                    key={line.id}
                  >
                    <span>
                      {getAccountName(
                        line.account_id
                      )}
                    </span>

                    <span>
                      {line.line_description ||
                        "—"}
                    </span>

                    <span>
                      {line.debit
                        ? money(
                            line.debit
                          )
                        : "—"}
                    </span>

                    <span>
                      {line.credit
                        ? money(
                            line.credit
                          )
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="entry-total">
                <span>Total</span>

                <strong>
                  {money(
                    (
                      linesByEntry[
                        selectedEntry.id
                      ] || []
                    ).reduce(
                      (sum, line) =>
                        sum +
                        Math.max(
                          line.debit,
                          line.credit
                        ),
                      0
                    )
                  )}
                </strong>
              </div>
            </div>
          </div>
        )}

        {showNewTransaction && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeNewTransaction();
              }
            }}
          >
            <div className="modal create-modal">
              <div className="modal-header">
                <div>
                  <span className="modal-kicker">
                    MANUAL ENTRY
                  </span>

                  <h2>
                    New Transaction
                  </h2>

                  <p>
                    Create a balanced double-entry
                    journal transaction.
                  </p>
                </div>

                <button
                  type="button"
                  className="close"
                  onClick={
                    closeNewTransaction
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="form-grid">
                  <div className="field">
                    <label>
                      Transaction Date
                    </label>

                    <input
                      type="date"
                      value={
                        transactionForm.date
                      }
                      onChange={(event) =>
                        setTransactionForm(
                          (current) => ({
                            ...current,
                            date:
                              event.target
                                .value,
                          })
                        )
                      }
                    />
                  </div>

                  <div className="field">
                    <label>
                      Reference
                    </label>

                    <input
                      value={
                        transactionForm.reference
                      }
                      onChange={(event) =>
                        setTransactionForm(
                          (current) => ({
                            ...current,
                            reference:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="Optional reference"
                    />
                  </div>

                  <div className="field full">
                    <label>
                      Description
                    </label>

                    <input
                      value={
                        transactionForm.description
                      }
                      onChange={(event) =>
                        setTransactionForm(
                          (current) => ({
                            ...current,
                            description:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="e.g. Laptop purchase from supplier"
                    />
                  </div>

                  <div className="field">
                    <label>
                      Debit Account
                    </label>

                    <select
                      value={
                        transactionForm.debitAccountId
                      }
                      onChange={(event) =>
                        setTransactionForm(
                          (current) => ({
                            ...current,
                            debitAccountId:
                              event.target
                                .value,
                          })
                        )
                      }
                    >
                      <option value="">
                        Select account
                      </option>

                      {accounts
                        .filter(
                          (account) =>
                            account.is_active
                        )
                        .map((account) => (
                          <option
                            key={account.id}
                            value={account.id}
                          >
                            {
                              account.account_code
                            }{" "}
                            —{" "}
                            {
                              account.account_name
                            }
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Credit Account
                    </label>

                    <select
                      value={
                        transactionForm.creditAccountId
                      }
                      onChange={(event) =>
                        setTransactionForm(
                          (current) => ({
                            ...current,
                            creditAccountId:
                              event.target
                                .value,
                          })
                        )
                      }
                    >
                      <option value="">
                        Select account
                      </option>

                      {accounts
                        .filter(
                          (account) =>
                            account.is_active
                        )
                        .map((account) => (
                          <option
                            key={account.id}
                            value={account.id}
                          >
                            {
                              account.account_code
                            }{" "}
                            —{" "}
                            {
                              account.account_name
                            }
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>
                      Amount
                    </label>

                    <div className="amount-input">
                      <span>
                        {currency}
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          transactionForm.amount
                        }
                        onChange={(event) =>
                          setTransactionForm(
                            (current) => ({
                              ...current,
                              amount:
                                event.target
                                  .value,
                            })
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label>
                      Source
                    </label>

                    <select
                      value={
                        transactionForm.source
                      }
                      onChange={(event) =>
                        setTransactionForm(
                          (current) => ({
                            ...current,
                            source:
                              event.target
                                .value,
                          })
                        )
                      }
                    >
                      <option value="manual">
                        Manual
                      </option>
                      <option value="invoice">
                        Invoice
                      </option>
                      <option value="payment">
                        Payment
                      </option>
                      <option value="expense">
                        Expense
                      </option>
                      <option value="transfer">
                        Transfer
                      </option>
                    </select>
                  </div>
                </div>

                <div className="journal-preview">
                  <div>
                    <span>
                      DEBIT
                    </span>

                    <strong>
                      {transactionForm.debitAccountId
                        ? getAccountName(
                            transactionForm.debitAccountId
                          )
                        : "Select debit account"}
                    </strong>
                  </div>

                  <div className="preview-amount">
                    {money(
                      Number(
                        transactionForm.amount ||
                          0
                      )
                    )}
                  </div>

                  <div>
                    <span>
                      CREDIT
                    </span>

                    <strong>
                      {transactionForm.creditAccountId
                        ? getAccountName(
                            transactionForm.creditAccountId
                          )
                        : "Select credit account"}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeNewTransaction
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    void createTransaction()
                  }
                >
                  Post Transaction
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .page {
          min-height: calc(100vh - 120px);
          padding: 24px 28px 40px;
          background: #f8fafc;
        }

        .top-actions {
          display: flex;
          gap: 8px;
        }

        .primary-button,
        .secondary-button {
          height: 39px;
          padding: 0 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        .primary-button {
          border: 0;
          background: #0f172a;
          color: #fff;
        }

        .primary-button:hover {
          background: #1e293b;
        }

        .secondary-button {
          border: 1px solid #dbe1e8;
          background: #fff;
          color: #475569;
        }

        .primary-button.small {
          height: 34px;
          padding: 0 11px;
        }

        .tabs {
          max-width: 1400px;
          margin: 0 auto 18px;
          padding: 4px;
          display: inline-flex;
          gap: 2px;
          background: #e9eef5;
          border-radius: 9px;
        }

        .tab {
          height: 34px;
          padding: 0 15px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          font-size: 11px;
          font-weight: 700;
        }

        .tab.active {
          background: #fff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
        }


        .alert {
          max-width: 1400px;
          margin: 0 auto 16px;
          padding: 11px 13px;
          display: flex;
          align-items: center;
          gap: 9px;
          border-radius: 8px;
          font-size: 11px;
        }

        .alert.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .alert span {
          flex: 1;
        }

        .alert button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 17px;
        }

        .summary-grid {
          max-width: 1400px;
          margin: 0 auto 18px;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
        }

        .summary-card {
          min-width: 0;
          padding: 16px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
        }

        .summary-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .summary-label {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.6px;
        }

        .summary-icon {
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 7px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        .summary-card strong {
          display: block;
          margin-top: 12px;
          color: #0f172a;
          font-size: 17px;
        }

        .summary-card small {
          display: block;
          margin-top: 5px;
          color: #94a3b8;
          font-size: 9px;
        }

        .two-column {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.75fr);
          gap: 15px;
        }

        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 13px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
        }

        .cash-bank-card {
          max-width: 1400px;
          margin: 0 auto 15px;
        }

        .cash-bank-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .cash-account-card {
          min-width: 0;
          padding: 16px 18px;
          border-right: 1px solid #eef2f7;
          border-bottom: 1px solid #eef2f7;
        }

        .cash-account-card:nth-child(3n) {
          border-right: 0;
        }

        .cash-account-top {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .cash-account-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #ecfdf5;
          color: #047857;
          font-size: 10px;
          font-weight: 800;
        }

        .cash-account-heading {
          min-width: 0;
          flex: 1;
        }

        .cash-account-heading strong {
          display: block;
          overflow: hidden;
          color: #1e293b;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cash-account-heading span {
          display: block;
          margin-top: 4px;
          overflow: hidden;
          color: #94a3b8;
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .reconciliation-badge {
          flex: 0 0 auto;
          padding: 4px 6px;
          border-radius: 5px;
          background: #f0fdf4;
          color: #15803d;
          font-size: 7px;
          font-weight: 800;
        }

        .cash-account-bottom {
          margin-top: 17px;
          padding-top: 11px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
          border-top: 1px solid #f1f5f9;
        }

        .cash-account-bottom span {
          color: #94a3b8;
          font-size: 8px;
        }

        .cash-account-bottom strong {
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
          white-space: nowrap;
        }

        .cash-empty {
          min-height: 130px;
        }

        .optional {
          color: #94a3b8;
          font-size: 8px;
          font-weight: 500;
        }

        .checkbox-field {
          min-height: 39px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          font-size: 10px;
          cursor: pointer;
        }

        .checkbox-field input {
          width: 15px;
          height: 15px;
          accent-color: #059669;
        }

        .financial-account-modal {
          width: min(620px, 100%);
        }

        .card-header {
          min-height: 67px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #eef2f7;
        }

        .card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 14px;
        }

        .card-header p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 10px;
        }

        .text-button {
          border: 0;
          background: transparent;
          color: #475569;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .transaction-list {
          width: 100%;
        }

        .transaction-header {
          min-height: 38px;
          padding: 0 18px;
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr) 125px 90px;
          align-items: center;
          gap: 14px;
          border-top: 1px solid #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .transaction-header-amount {
          text-align: right;
        }

        .transaction-row {
          min-height: 67px;
          padding: 11px 18px;
          display: grid;
          grid-template-columns: 110px minmax(0, 1fr) 125px 90px;
          align-items: center;
          gap: 14px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
        }

        .transaction-row:last-child {
          border-bottom: 0;
        }

        .transaction-row:hover {
          background: #fafcff;
        }

        .entry-number {
          min-width: 0;
          color: #475569;
          font-size: 9px;
          font-weight: 800;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .transaction-main {
          min-width: 0;
        }

        .transaction-main strong {
          display: block;
          overflow: hidden;
          color: #1e293b;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .transaction-main small {
          display: block;
          margin-top: 4px;
          color: #94a3b8;
          font-size: 9px;
        }

        .transaction-amount {
          text-align: right;
          color: #0f172a;
          font-size: 12px;
          font-weight: 800;
        }

        .transaction-status {
          justify-self: end;
          padding: 4px 7px;
          border-radius: 5px;
          background: #ecfdf5;
          color: #047857;
          font-size: 7px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .status-list {
          padding: 8px 18px 14px;
        }

        .status-row {
          min-height: 41px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #f1f5f9;
        }

        .status-row:last-child {
          border-bottom: 0;
        }

        .status-row span {
          color: #64748b;
          font-size: 10px;
        }

        .status-row strong {
          color: #1e293b;
          font-size: 11px;
        }

        .filters {
          padding: 12px 18px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 170px;
          gap: 9px;
          border-bottom: 1px solid #eef2f7;
        }

        .search {
          position: relative;
        }

        .search span {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          font-size: 17px;
        }

        .search input,
        .filters select,
        .field input,
        .field select {
          width: 100%;
          height: 39px;
          box-sizing: border-box;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #fff;
          color: #0f172a;
          outline: none;
          font: inherit;
          font-size: 11px;
        }

        .search input {
          padding: 0 11px 0 32px;
        }

        .filters select,
        .field select,
        .field input {
          padding: 0 10px;
        }

        .search input:focus,
        .filters select:focus,
        .field input:focus,
        .field select:focus {
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.1);
        }

        .account-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
        }

        .account-card {
          min-height: 78px;
          padding: 14px 18px;
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr) 130px;
          align-items: center;
          gap: 11px;
          border-bottom: 1px solid #eef2f7;
        }

        .account-card:nth-child(odd) {
          border-right: 1px solid #eef2f7;
        }

        .account-card.inactive {
          opacity: 0.55;
        }

        .account-icon {
          width: 37px;
          height: 37px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 9px;
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
        }

        .account-content {
          min-width: 0;
        }

        .account-heading {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .account-heading strong {
          overflow: hidden;
          color: #1e293b;
          font-size: 11px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .badge {
          padding: 3px 5px;
          border-radius: 4px;
          background: #f1f5f9;
          color: #64748b;
          font-size: 6px;
          font-weight: 800;
        }

        .account-meta {
          margin-top: 4px;
          display: flex;
          gap: 6px;
          color: #94a3b8;
          font-size: 8px;
        }

        .account-balance {
          text-align: right;
        }

        .account-balance small {
          display: block;
          color: #a1a1aa;
          font-size: 7px;
          font-weight: 800;
        }

        .account-balance strong {
          display: block;
          margin-top: 4px;
          color: #0f172a;
          font-size: 12px;
        }

        .negative {
          color: #dc2626 !important;
        }

        .empty {
          min-height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 11px;
        }

        .reports-grid {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .report-card {
          padding: 20px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 13px;
        }

        .report-card h3 {
          margin: 0;
          color: #0f172a;
          font-size: 13px;
        }

        .report-card p {
          min-height: 32px;
          margin: 7px 0 16px;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.5;
        }

        .report-value {
          color: #334155;
          font-size: 18px;
          font-weight: 800;
        }

        .report-card button {
          width: 100%;
          height: 34px;
          margin-top: 15px;
          border: 1px solid #dbe1e8;
          border-radius: 7px;
          background: #fff;
          color: #475569;
          cursor: pointer;
          font-size: 10px;
          font-weight: 700;
        }

        .report-modal {
          width: min(1100px, 100%);
        }

        .report-body {
          padding: 18px 20px;
          overflow: auto;
          max-height: calc(100vh - 190px);
        }

        .report-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 15px;
        }

        .report-summary > div,
        .profit-hero {
          padding: 13px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
        }

        .report-summary span,
        .profit-hero span {
          display: block;
          color: #94a3b8;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: .5px;
        }

        .report-summary strong,
        .profit-hero strong {
          display: block;
          margin-top: 5px;
          color: #0f172a;
          font-size: 14px;
        }

        .balanced {
          color: #059669 !important;
        }

        .report-table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
        }

        .report-table {
          width: 100%;
          min-width: 700px;
          border-collapse: collapse;
        }

        .report-table th {
          padding: 9px 11px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          color: #94a3b8;
          font-size: 7px;
          font-weight: 800;
          text-align: left;
          letter-spacing: .4px;
        }

        .report-table td {
          padding: 10px 11px;
          border-bottom: 1px solid #f1f5f9;
          color: #64748b;
          font-size: 9px;
        }

        .report-table td strong {
          color: #334155;
        }

        .report-table .right {
          text-align: right;
        }

        .report-table tfoot td {
          background: #f8fafc;
          color: #334155;
          font-weight: 800;
          border-bottom: 0;
        }

        .profit-hero {
          margin-bottom: 15px;
        }

        .profit-hero strong {
          font-size: 22px;
        }

        .balance-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .balance-section {
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
        }

        .balance-section h3 {
          margin: 0 0 8px;
          color: #0f172a;
          font-size: 12px;
        }

        .balance-row,
        .balance-total {
          min-height: 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #64748b;
          font-size: 9px;
        }

        .balance-row span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .balance-row strong {
          flex: 0 0 auto;
          color: #334155;
          font-size: 9px;
        }

        .balance-total {
          margin-top: 5px;
          border-bottom: 0;
          color: #334155;
          font-weight: 800;
        }

        .balance-total strong {
          color: #0f172a;
          font-size: 11px;
        }

        .ledger-selector {
          max-width: 420px;
          margin-bottom: 15px;
        }

        .ledger-selector label {
          display: block;
          margin-bottom: 6px;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
        }

        .ledger-selector select {
          width: 100%;
          height: 39px;
          padding: 0 10px;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          background: #fff;
          color: #0f172a;
          font: inherit;
          font-size: 11px;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.5);
        }

        .modal {
          width: min(760px, 100%);
          max-height: calc(100vh - 40px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 25px 70px rgba(15, 23, 42, 0.25);
        }

        .create-modal {
          width: min(700px, 100%);
        }

        .modal-header {
          padding: 18px 20px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-kicker {
          color: #94a3b8;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.8px;
        }

        .modal-header h2 {
          margin: 4px 0 0;
          color: #0f172a;
          font-size: 17px;
        }

        .modal-header p {
          margin: 4px 0 0;
          color: #94a3b8;
          font-size: 10px;
        }

        .close {
          width: 30px;
          height: 30px;
          border: 0;
          border-radius: 7px;
          background: #f1f5f9;
          color: #64748b;
          cursor: pointer;
          font-size: 18px;
        }

        .entry-summary {
          padding: 13px 20px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
        }

        .entry-summary small {
          display: block;
          color: #94a3b8;
          font-size: 7px;
          font-weight: 800;
        }

        .entry-summary strong {
          display: block;
          margin-top: 4px;
          color: #334155;
          font-size: 10px;
        }

        .entry-lines {
          padding: 0 20px;
          overflow-y: auto;
        }

        .entry-line {
          min-height: 43px;
          display: grid;
          grid-template-columns: 1.2fr 1fr 100px 100px;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 9px;
          color: #64748b;
        }

        .entry-line.header {
          min-height: 35px;
          color: #94a3b8;
          font-size: 7px;
          font-weight: 800;
        }

        .entry-line span:nth-child(3),
        .entry-line span:nth-child(4) {
          text-align: right;
        }

        .entry-total {
          padding: 13px 20px;
          display: flex;
          justify-content: space-between;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          border-top: 1px solid #e5e7eb;
        }

        .entry-total strong {
          color: #0f172a;
          font-size: 13px;
        }

        .modal-body {
          padding: 20px;
          overflow-y: auto;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          display: block;
          margin-bottom: 6px;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
        }

        .amount-input {
          display: flex;
          align-items: center;
          height: 39px;
          border: 1px solid #dbe1e8;
          border-radius: 8px;
          overflow: hidden;
        }

        .amount-input span {
          height: 100%;
          padding: 0 10px;
          display: flex;
          align-items: center;
          background: #f8fafc;
          border-right: 1px solid #dbe1e8;
          color: #64748b;
          font-size: 9px;
          font-weight: 800;
        }

        .amount-input input {
          height: 100%;
          border: 0;
          border-radius: 0;
        }

        .journal-preview {
          margin-top: 18px;
          padding: 13px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 110px minmax(0, 1fr);
          align-items: center;
          gap: 12px;
          background: #f8fafc;
          border-radius: 9px;
        }

        .journal-preview div:first-child {
          text-align: left;
        }

        .journal-preview div:last-child {
          text-align: right;
        }

        .journal-preview span {
          display: block;
          color: #94a3b8;
          font-size: 7px;
          font-weight: 800;
        }

        .journal-preview strong {
          display: block;
          margin-top: 4px;
          overflow: hidden;
          color: #334155;
          font-size: 9px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preview-amount {
          text-align: center;
          color: #0f172a;
          font-size: 14px;
          font-weight: 800;
        }

        .modal-footer {
          padding: 13px 20px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          background: #f8fafc;
          border-top: 1px solid #e5e7eb;
        }

        .card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .movement-type-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 18px;
        }

        .movement-type {
          min-height: 42px;
          padding: 8px 10px;
          border: 1px solid #dbe1e8;
          border-radius: 9px;
          background: #fff;
          color: #475569;
          cursor: pointer;
          font-size: 9px;
          font-weight: 700;
          transition: 0.15s ease;
        }

        .movement-type:hover {
          border-color: #a7f3d0;
          background: #f0fdf4;
          color: #047857;
        }

        .movement-type.active {
          border-color: #10b981;
          background: #ecfdf5;
          color: #047857;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.08);
        }

        .movement-note {
          margin-top: 16px;
          padding: 11px 13px;
          border: 1px solid #d1fae5;
          border-radius: 9px;
          background: #f0fdf4;
          color: #047857;
          font-size: 9px;
          line-height: 1.5;
        }

        .money-movement-modal {
          width: min(760px, 100%);
        }

        .field select:disabled {
          background: #f8fafc;
          color: #94a3b8;
          cursor: not-allowed;
        }

        @media (max-width: 700px) {
          .report-summary,
          .balance-columns {
            grid-template-columns: 1fr;
          }

          .report-body {
            padding: 14px;
          }
        }

        @media (max-width: 1150px) {
          .summary-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .reports-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 900px) {
          .cash-bank-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .cash-account-card:nth-child(3n) {
            border-right: 1px solid #eef2f7;
          }

          .cash-account-card:nth-child(2n) {
            border-right: 0;
          }

          .two-column {
            grid-template-columns: 1fr;
          }

          .account-grid {
            grid-template-columns: 1fr;
          }

          .account-card:nth-child(odd) {
            border-right: 0;
          }
        }

        @media (max-width: 700px) {
          .top-actions {
            width: 100%;
            flex-wrap: wrap;
          }

          .top-actions button {
            flex: 1 1 auto;
          }

          .cash-bank-grid {
            grid-template-columns: 1fr;
          }

          .cash-account-card,
          .cash-account-card:nth-child(2n),
          .cash-account-card:nth-child(3n) {
            border-right: 0;
          }

          .page {
            padding: 15px;
          }

          .summary-grid,
          .reports-grid {
            grid-template-columns: 1fr;
          }

          .tabs {
            display: flex;
            width: 100%;
            box-sizing: border-box;
            overflow-x: auto;
          }

          .tab {
            flex: 1;
            white-space: nowrap;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .transaction-header {
            display: none;
          }

          .transaction-row {
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas:
              "number amount"
              "main main";
            gap: 7px 12px;
            padding: 13px 14px;
          }

          .entry-number {
            grid-area: number;
          }

          .transaction-main {
            grid-area: main;
          }

          .transaction-main strong {
            white-space: normal;
            line-height: 1.4;
          }

          .transaction-amount {
            grid-area: amount;
            align-self: start;
            padding-top: 1px;
          }

          .transaction-status {
            display: none;
          }

          .entry-summary {
            grid-template-columns: 1fr 1fr;
          }

          .entry-line {
            grid-template-columns: 1fr 80px 80px;
          }

          .entry-line span:nth-child(2) {
            display: none;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .movement-type-grid {
            grid-template-columns: 1fr 1fr;
          }

          .card-actions {
            width: 100%;
            justify-content: stretch;
          }

          .card-actions button {
            flex: 1;
          }

          .field.full {
            grid-column: auto;
          }

          .journal-preview {
            grid-template-columns: 1fr;
          }

          .journal-preview div:last-child,
          .journal-preview div:first-child {
            text-align: left;
          }

          .preview-amount {
            text-align: left;
          }
        }
      `}</style>
    </AppShell>
  );
}

function getMoneyMovementLabel(type: string) {
  switch (type) {
    case "bank_deposit":
      return "Bank deposit";
    case "bank_withdrawal":
      return "Bank withdrawal";
    case "cash_received":
      return "Cash received";
    case "cash_given":
      return "Cash given";
    case "owner_investment":
      return "Owner investment";
    case "owner_withdrawal":
      return "Owner withdrawal";
    default:
      return "Transfer";
  }
}

function getMoneyMovementHelp(type: string) {
  switch (type) {
    case "bank_deposit":
      return "Move money from a cash account into a bank account. Both accounts remain separate in the ledger.";
    case "bank_withdrawal":
      return "Move money from a bank account back into cash or another selected account.";
    case "cash_received":
      return "Debit the selected cash/bank account and credit the other account.";
    case "cash_given":
      return "Credit the selected cash/bank account and debit the other account.";
    case "owner_investment":
      return "Debit the selected cash/bank account and credit Owner Equity automatically.";
    case "owner_withdrawal":
      return "Debit Owner Drawings and credit the selected cash/bank account automatically.";
    default:
      return "Transfer money between two company accounts without changing profit or loss.";
  }
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
}) {
  return (
    <div className="summary-card">
      <div className="summary-top">
        <span className="summary-label">
          {label}
        </span>

        <span className="summary-icon">
          {icon}
        </span>
      </div>

      <strong>{value}</strong>

      <small>{detail}</small>
    </div>
  );
}

function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {action}
    </div>
  );
}

function StatusRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TransactionList({
  rows,
  money,
  onSelect,
  detailed = false,
}: {
  rows: TransactionRow[];
  currency: string;
  money: (value: number) => string;
  onSelect: (entry: JournalEntry) => void;
  detailed?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="empty">
        No transactions found.
      </div>
    );
  }

  return (
    <div className={detailed ? "transaction-list detailed" : "transaction-list"}>
      {detailed && (
        <div className="transaction-header" aria-hidden="true">
          <div>ENTRY</div>
          <div>DESCRIPTION</div>
          <div className="transaction-header-amount">AMOUNT</div>
          <div>STATUS</div>
        </div>
      )}
      {rows.map((entry) => (
        <div
          className="transaction-row"
          key={entry.id}
          onClick={() => onSelect(entry)}
        >
          <div className="entry-number">
            {entry.entry_number}
          </div>

          <div className="transaction-main">
            <strong>
              {entry.description}
            </strong>

            <small>
              {formatDate(entry.entry_date)}
              {" • "}
              {capitalize(entry.source)}
              {entry.reference
                ? ` • ${entry.reference}`
                : ""}
            </small>
          </div>

          <div className="transaction-amount">
            {money(entry.amount)}
          </div>

          <div className="transaction-status">
            {entry.status}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportCard({
  title,
  description,
  value,
  action,
}: {
  title: string;
  description: string;
  value: string;
  action: () => void;
}) {
  return (
    <div className="report-card">
      <h3>{title}</h3>

      <p>{description}</p>

      <div className="report-value">
        {value}
      </div>

      <button
        type="button"
        onClick={action}
      >
        Open Report
      </button>
    </div>
  );
}

function getAccountIcon(type: string) {
  switch (type) {
    case "asset":
      return "◆";
    case "liability":
      return "L";
    case "equity":
      return "E";
    case "revenue":
      return "↗";
    case "expense":
      return "−";
    default:
      return "•";
  }
}

function capitalize(value: string) {
  if (!value) {
    return "";
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(new Date(`${value}T00:00:00`));
}