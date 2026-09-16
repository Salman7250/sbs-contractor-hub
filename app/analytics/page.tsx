"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Company = {
  id: string;
  name: string | null;
  currency: string | null;
};

type Order = {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  total_amount: number | null;
  status: string | null;
  payment_status: string | null;
  currency: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_name: string | null;
  variant_name: string | null;
  sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  unit_cost: number | null;
  line_total: number | null;
};

type Invoice = {
  id: string;
  invoice_number: string | null;
  customer_id: string | null;
  total: number | null;
  amount_paid: number | null;
  status: string | null;
  due_date: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  invoice_id: string | null;
  amount: number | null;
  paid_at: string | null;
  created_at: string;
};

type Customer = {
  id: string;
  name: string | null;
  created_at: string;
};

type Expense = {
  id: string;
  expense_date: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  category_id: string | null;
  vendor_name: string | null;
  employee_id: string | null;
};

type ExpenseCategory = {
  id: string;
  name: string | null;
};

type PurchaseOrder = {
  id: string;
  supplier_id: string | null;
  po_number: string | null;
  status: string | null;
  total_amount: number | null;
  currency: string | null;
  order_date: string;
  expected_date: string | null;
};

type Product = {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string | null;
  cost_price: number | null;
  selling_price: number | null;
  is_active: boolean | null;
};

type Warehouse = {
  id: string;
  name: string;
};

type InventoryBatchStock = {
  id: string;
  product_id: string;
  variant_id: string | null;
  warehouse_id: string | null;
  quantity: number | null;
  reserved_quantity: number | null;
};

type InventoryBatch = {
  id: string;
  product_id: string;
  variant_id: string | null;
  unit_cost: number | null;
};

type Supplier = {
  id: string;
  display_name: string | null;
  legal_name: string | null;
};

type AnalyticsData = {
  orders: Order[];
  orderItems: OrderItem[];
  invoices: Invoice[];
  payments: Payment[];
  customers: Customer[];
  expenses: Expense[];
  expenseCategories: ExpenseCategory[];
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  variants: ProductVariant[];
  warehouses: Warehouse[];
  batchStock: InventoryBatchStock[];
  batches: InventoryBatch[];
  suppliers: Supplier[];
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const PERIODS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return startOfDay(date);
}

function isWithinRange(
  value: string | null | undefined,
  start: Date,
  end: Date,
) {
  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= start && date <= end;
}

function normalizeStatus(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[\s-]+/g, "_");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatMoney(value: number, currency = "AED") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${Number(value || 0).toFixed(0)}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function getInitials(name: string | null | undefined) {
  if (!name) return "SBS";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

/* -------------------------------------------------------------------------- */
/* Small UI components                                                        */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  helper,
  icon,
  trend,
  trendLabel,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  trend?: number | null;
  trendLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            {icon}
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              {label}
            </p>

            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {value}
            </p>
          </div>
        </div>

        {typeof trend === "number" && (
          <div
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
              trend >= 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {trend >= 0 ? (
              <ArrowUpRight size={13} />
            ) : (
              <ArrowDownRight size={13} />
            )}

            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {trendLabel || helper}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
              {icon}
            </div>
          )}

          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {title}
            </h2>

            {description && (
              <p className="mt-0.5 text-xs text-slate-500">
                {description}
              </p>
            )}
          </div>
        </div>

        {action}
      </div>

      {children}
    </section>
  );
}

function EmptyState({
  message,
}: {
  message: string;
}) {
  return (
    <div className="flex min-h-[180px] items-center justify-center px-5 text-center">
      <div>
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400">
          <BarChart3 size={18} />
        </div>

        <p className="mt-3 text-sm font-medium text-slate-600">
          {message}
        </p>
      </div>
    </div>
  );
}

function TrendChart({
  data,
  currency,
  period,
  onPeriodChange,
  hoveredIndex,
  onHover,
}: {
  data: {
    date: Date;
    revenue: number;
    cogs: number;
    expenses: number;
  }[];
  currency: string;
  period: string;
  onPeriodChange: (value: string) => void;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  const periodOptions = [
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "365", label: "Last 12 months" },
  ];

  if (!data.length) {
    return (
      <div>
        <div className="flex justify-end border-b border-slate-100 px-5 py-3">
          <select
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            aria-label="Financial chart period"
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <EmptyState message="No financial activity in this period." />
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.flatMap((item) => [
      item.revenue,
      item.cogs,
      item.expenses,
      Math.max(item.revenue - item.cogs - item.expenses, 0),
    ]),
    1,
  );

  const width = 900;
  const height = 300;
  const paddingLeft = 56;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 42;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (data.length === 1) {
      return paddingLeft + chartWidth / 2;
    }

    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (value: number) =>
    paddingTop + chartHeight - (value / maxValue) * chartHeight;

  const buildPath = (key: "revenue" | "cogs" | "expenses") =>
    data
      .map((item, index) => {
        const x = getX(index);
        const y = getY(item[key]);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const activeIndex =
    hoveredIndex !== null && hoveredIndex >= 0 && hoveredIndex < data.length
      ? hoveredIndex
      : null;
  const activeItem = activeIndex !== null ? data[activeIndex] : null;
  const activeX = activeIndex !== null ? getX(activeIndex) : null;
  const tooltipWidth = 190;
  const tooltipX =
    activeX === null
      ? 0
      : Math.min(
          Math.max(activeX - tooltipWidth / 2, paddingLeft),
          width - paddingRight - tooltipWidth,
        );
  const tooltipY = 10;

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Revenue
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            COGS
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
            Expenses
          </div>
        </div>

        <select
          value={period}
          onChange={(event) => onPeriodChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-auto"
          aria-label="Financial chart period"
        >
          {periodOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="p-4 sm:p-5">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[680px] w-full"
            role="img"
            aria-label="Revenue, cost of goods sold and expenses trend"
            onMouseLeave={() => onHover(null)}
          >
            {gridLines.map((ratio) => {
              const y = paddingTop + chartHeight - ratio * chartHeight;
              return (
                <g key={ratio}>
                  <line
                    x1={paddingLeft}
                    x2={width - paddingRight}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-100"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px]"
                  >
                    {formatMoney(maxValue * ratio, currency)}
                  </text>
                </g>
              );
            })}

            <path
              d={buildPath("revenue")}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-500"
            />
            <path
              d={buildPath("cogs")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400"
            />
            <path
              d={buildPath("expenses")}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-orange-400"
            />

            {data.map((item, index) => {
              if (
                index !== 0 &&
                index !== data.length - 1 &&
                index % Math.max(Math.floor(data.length / 6), 1) !== 0
              ) {
                return null;
              }

              const x = getX(index);
              return (
                <text
                  key={`${item.date.toISOString()}-${index}`}
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {formatShortDate(item.date)}
                </text>
              );
            })}

            {activeIndex !== null && activeX !== null && activeItem && (
              <g pointerEvents="none">
                <line
                  x1={activeX}
                  x2={activeX}
                  y1={paddingTop}
                  y2={paddingTop + chartHeight}
                  stroke="currentColor"
                  strokeDasharray="4 4"
                  className="text-slate-300"
                />

                <circle
                  cx={activeX}
                  cy={getY(activeItem.revenue)}
                  r="5"
                  fill="white"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-emerald-500"
                />
                <circle
                  cx={activeX}
                  cy={getY(activeItem.cogs)}
                  r="4"
                  fill="white"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-slate-400"
                />
                <circle
                  cx={activeX}
                  cy={getY(activeItem.expenses)}
                  r="4"
                  fill="white"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-orange-400"
                />

                <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                  <rect
                    width={tooltipWidth}
                    height="126"
                    rx="10"
                    fill="white"
                    stroke="currentColor"
                    className="text-slate-200"
                    filter="drop-shadow(0 4px 10px rgba(15, 23, 42, 0.10))"
                  />
                  <text x="14" y="23" className="fill-slate-900 text-[12px] font-bold">
                    {formatDate(activeItem.date.toISOString())}
                  </text>
                  <text x="14" y="47" className="fill-slate-500 text-[10px]">Revenue</text>
                  <text x={tooltipWidth - 14} y="47" textAnchor="end" className="fill-slate-900 text-[11px] font-semibold">
                    {formatMoney(activeItem.revenue, currency)}
                  </text>
                  <text x="14" y="69" className="fill-slate-500 text-[10px]">COGS</text>
                  <text x={tooltipWidth - 14} y="69" textAnchor="end" className="fill-slate-900 text-[11px] font-semibold">
                    {formatMoney(activeItem.cogs, currency)}
                  </text>
                  <text x="14" y="91" className="fill-slate-500 text-[10px]">Expenses</text>
                  <text x={tooltipWidth - 14} y="91" textAnchor="end" className="fill-slate-900 text-[11px] font-semibold">
                    {formatMoney(activeItem.expenses, currency)}
                  </text>
                  <text x="14" y="113" className="fill-slate-500 text-[10px]">Net profit</text>
                  <text x={tooltipWidth - 14} y="113" textAnchor="end" className="fill-emerald-700 text-[11px] font-bold">
                    {formatMoney(
                      activeItem.revenue - activeItem.cogs - activeItem.expenses,
                      currency,
                    )}
                  </text>
                </g>
              </g>
            )}

            {data.map((item, index) => {
              const x = getX(index);
              const nextX =
                index < data.length - 1
                  ? getX(index + 1)
                  : index > 0
                    ? getX(index - 1)
                    : x;
              const previousX =
                index > 0 ? getX(index - 1) : x;
              const left =
                index === 0
                  ? paddingLeft
                  : (previousX + x) / 2;
              const right =
                index === data.length - 1
                  ? width - paddingRight
                  : (x + nextX) / 2;

              return (
                <rect
                  key={`hover-${item.date.toISOString()}-${index}`}
                  x={left}
                  y={paddingTop}
                  width={Math.max(right - left, 1)}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => onHover(index)}
                  onFocus={() => onHover(index)}
                  tabIndex={0}
                  aria-label={`${formatDate(item.date.toISOString())}: revenue ${formatMoney(item.revenue, currency)}, COGS ${formatMoney(item.cogs, currency)}, expenses ${formatMoney(item.expenses, currency)}`}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

function DonutChart({
  values,
}: {
  values: {
    label: string;
    value: number;
  }[];
}) {
  const total = values.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  if (!total) {
    return <EmptyState message="No expense data available." />;
  }

  let currentOffset = 0;

  const segments = values
    .filter((item) => item.value > 0)
    .map((item, index) => {
      const percentage =
        (item.value / total) * 100;

      const segment = {
        ...item,
        percentage,
        offset: currentOffset,
        index,
      };

      currentOffset += percentage;

      return segment;
    });

  return (
    <div className="flex flex-col items-center gap-6 p-5 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <svg
          viewBox="0 0 42 42"
          className="h-full w-full -rotate-90"
        >
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-slate-100"
          />

          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeDasharray={`${segment.percentage} ${
                100 - segment.percentage
              }`}
              strokeDashoffset={-segment.offset}
              pathLength="100"
              className={
                [
                  "text-emerald-500",
                  "text-slate-400",
                  "text-orange-400",
                  "text-blue-400",
                  "text-violet-400",
                ][segment.index % 5]
              }
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900">
            {formatMoney(total)}
          </span>

          <span className="text-[11px] text-slate-500">
            Total
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {segments.slice(0, 6).map((segment) => (
          <div
            key={segment.label}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  [
                    "bg-emerald-500",
                    "bg-slate-400",
                    "bg-orange-400",
                    "bg-blue-400",
                    "bg-violet-400",
                  ][segment.index % 5]
                }`}
              />

              <span className="truncate text-xs font-medium text-slate-600">
                {segment.label}
              </span>
            </div>

            <span className="shrink-0 text-xs font-semibold text-slate-900">
              {segment.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function AnalyticsPage() {
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [company, setCompany] =
    useState<Company | null>(null);

  const [analytics, setAnalytics] =
    useState<AnalyticsData | null>(null);

  const [period, setPeriod] = useState("30");
  const [financialPeriod, setFinancialPeriod] = useState("30");
  const [financialHoveredIndex, setFinancialHoveredIndex] = useState<number | null>(null);

  const [customStart, setCustomStart] =
    useState("");

  const [customEnd, setCustomEnd] =
    useState("");

  const [compare, setCompare] =
    useState("previous");

  const [showFilters, setShowFilters] =
    useState(false);

  const [warehouseFilter, setWarehouseFilter] =
    useState("all");

  const [currencyFilter, setCurrencyFilter] =
    useState("all");

  /* ------------------------------------------------------------------------ */
  /* Date range                                                               */
  /* ------------------------------------------------------------------------ */

  const dateRange = useMemo(() => {
    const today = endOfDay(new Date());

    if (period === "custom") {
      const start = customStart
        ? startOfDay(new Date(`${customStart}T00:00:00`))
        : daysAgo(29);

      const end = customEnd
        ? endOfDay(new Date(`${customEnd}T23:59:59`))
        : today;

      return {
        start,
        end,
      };
    }

    const days = Number(period) || 30;

    return {
      start: daysAgo(days - 1),
      end: today,
    };
  }, [period, customStart, customEnd]);

  const financialDateRange = useMemo(() => {
    const today = endOfDay(new Date());
    const days = Number(financialPeriod) || 30;

    return {
      start: daysAgo(days - 1),
      end: today,
    };
  }, [financialPeriod]);

  const comparisonRange = useMemo(() => {
    if (compare === "none") {
      return null;
    }

    const currentStart = dateRange.start;
    const currentEnd = dateRange.end;

    const duration =
      currentEnd.getTime() -
      currentStart.getTime() +
      24 * 60 * 60 * 1000;

    if (compare === "year") {
      const start = new Date(currentStart);
      const end = new Date(currentEnd);

      start.setFullYear(start.getFullYear() - 1);
      end.setFullYear(end.getFullYear() - 1);

      return {
        start,
        end,
      };
    }

    const end = new Date(
      currentStart.getTime() - 1,
    );

    const start = new Date(
      end.getTime() - duration + 1,
    );

    return {
      start: startOfDay(start),
      end: endOfDay(end),
    };
  }, [dateRange, compare]);

  /* ------------------------------------------------------------------------ */
  /* Load data                                                                */
  /* ------------------------------------------------------------------------ */

  const loadAnalytics = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setErrorMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
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
          throw new Error(
            "No company workspace is associated with this account.",
          );
        }

        const companyId =
          membership.company_id;

        const [
          companyResult,
          ordersResult,
          orderItemsResult,
          invoicesResult,
          paymentsResult,
          customersResult,
          expensesResult,
          expenseCategoriesResult,
          purchaseOrdersResult,
          productsResult,
          variantsResult,
          warehousesResult,
          batchStockResult,
          batchesResult,
          suppliersResult,
        ] = await Promise.all([
          supabase
            .from("companies")
            .select("id,name,currency")
            .eq("id", companyId)
            .single(),

          supabase
            .from("orders")
            .select(
              "id,order_number,customer_id,total_amount,status,payment_status,currency,created_at",
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("order_items")
            .select(
              "id,order_id,product_name,variant_name,sku,quantity,unit_price,unit_cost,line_total",
            )
            .eq("company_id", companyId),

          supabase
            .from("invoices")
            .select(
              "id,invoice_number,customer_id,total,amount_paid,status,due_date,created_at",
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("invoice_payments")
            .select(
              "id,invoice_id,amount,paid_at,created_at",
            )
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("customers")
            .select("id,name,created_at")
            .eq("company_id", companyId)
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("expenses")
            .select(
              "id,expense_date,description,amount,currency,status,category_id,vendor_name,employee_id",
            )
            .eq("company_id", companyId)
            .order("expense_date", {
              ascending: false,
            }),

          supabase
            .from("expense_categories")
            .select("id,name")
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("purchase_orders")
            .select(
              "id,supplier_id,po_number,status,total_amount,currency,order_date,expected_date",
            )
            .eq("company_id", companyId)
            .order("order_date", {
              ascending: false,
            }),

          supabase
            .from("products")
            .select("id,name,brand,category")
            .eq("company_id", companyId),

          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,cost_price,selling_price,is_active",
            )
            .eq("company_id", companyId),

          supabase
            .from("warehouses")
            .select("id,name")
            .eq("company_id", companyId)
            .order("name"),

          supabase
            .from("inventory_batch_stock")
            .select(
              "id,product_id,variant_id,warehouse_id,quantity,reserved_quantity",
            )
            .eq("company_id", companyId),

          supabase
            .from("inventory_batches")
            .select(
              "id,product_id,variant_id,unit_cost",
            )
            .eq("company_id", companyId),

          supabase
            .from("suppliers")
            .select(
              "id,display_name,legal_name",
            )
            .eq("company_id", companyId)
            .order("display_name"),
        ]);

        const results = [
          companyResult,
          ordersResult,
          orderItemsResult,
          invoicesResult,
          paymentsResult,
          customersResult,
          expensesResult,
          expenseCategoriesResult,
          purchaseOrdersResult,
          productsResult,
          variantsResult,
          warehousesResult,
          batchStockResult,
          batchesResult,
          suppliersResult,
        ];

        const failed = results.find(
          (result) => result.error,
        );

        if (failed?.error) {
          throw failed.error;
        }

        setCompany(
          (companyResult.data as Company) ||
            null,
        );

        setAnalytics({
          orders:
            (ordersResult.data || []) as Order[],
          orderItems:
            (orderItemsResult.data ||
              []) as OrderItem[],
          invoices:
            (invoicesResult.data ||
              []) as Invoice[],
          payments:
            (paymentsResult.data ||
              []) as Payment[],
          customers:
            (customersResult.data ||
              []) as Customer[],
          expenses:
            (expensesResult.data ||
              []) as Expense[],
          expenseCategories:
            (expenseCategoriesResult.data ||
              []) as ExpenseCategory[],
          purchaseOrders:
            (purchaseOrdersResult.data ||
              []) as PurchaseOrder[],
          products:
            (productsResult.data ||
              []) as Product[],
          variants:
            (variantsResult.data ||
              []) as ProductVariant[],
          warehouses:
            (warehousesResult.data ||
              []) as Warehouse[],
          batchStock:
            (batchStockResult.data ||
              []) as InventoryBatchStock[],
          batches:
            (batchesResult.data ||
              []) as InventoryBatch[],
          suppliers:
            (suppliersResult.data ||
              []) as Supplier[],
        });
      } catch (error) {
        console.error(
          "Analytics load error:",
          error,
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load analytics.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase],
  );

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  /* ------------------------------------------------------------------------ */
  /* Derived data                                                             */
  /* ------------------------------------------------------------------------ */

  const currency =
    company?.currency || "AED";

  const filteredOrders = useMemo(() => {
    if (!analytics) return [];

    return analytics.orders.filter((order) => {
      if (
        !isWithinRange(
          order.created_at,
          dateRange.start,
          dateRange.end,
        )
      ) {
        return false;
      }

      if (
        currencyFilter !== "all" &&
        (order.currency || currency) !==
          currencyFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    analytics,
    dateRange,
    currency,
    currencyFilter,
  ]);

  const filteredOrderIds = useMemo(
    () =>
      new Set(
        filteredOrders.map(
          (order) => order.id,
        ),
      ),
    [filteredOrders],
  );

  const filteredOrderItems = useMemo(() => {
    if (!analytics) return [];

    return analytics.orderItems.filter(
      (item) =>
        filteredOrderIds.has(item.order_id),
    );
  }, [analytics, filteredOrderIds]);

  const filteredInvoices = useMemo(() => {
    if (!analytics) return [];

    return analytics.invoices.filter(
      (invoice) =>
        isWithinRange(
          invoice.created_at,
          dateRange.start,
          dateRange.end,
        ),
    );
  }, [analytics, dateRange]);

  const filteredPayments = useMemo(() => {
    if (!analytics) return [];

    return analytics.payments.filter(
      (payment) =>
        isWithinRange(
          payment.paid_at ||
            payment.created_at,
          dateRange.start,
          dateRange.end,
        ),
    );
  }, [analytics, dateRange]);

  const filteredExpenses = useMemo(() => {
    if (!analytics) return [];

    return analytics.expenses.filter(
      (expense) =>
        isWithinRange(
          expense.expense_date,
          dateRange.start,
          dateRange.end,
        ),
    );
  }, [analytics, dateRange]);

  const filteredPurchaseOrders =
    useMemo(() => {
      if (!analytics) return [];

      return analytics.purchaseOrders.filter(
        (po) =>
          isWithinRange(
            po.order_date,
            dateRange.start,
            dateRange.end,
          ),
      );
    }, [analytics, dateRange]);

  const revenue = useMemo(
    () =>
      filteredOrders.reduce(
        (sum, order) =>
          sum +
          Number(order.total_amount || 0),
        0,
      ),
    [filteredOrders],
  );

  const cogs = useMemo(
    () =>
      filteredOrderItems.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity || 0) *
            Number(item.unit_cost || 0),
        0,
      ),
    [filteredOrderItems],
  );

  const grossProfit = revenue - cogs;

  const grossMargin =
    revenue > 0
      ? (grossProfit / revenue) * 100
      : 0;

  const totalExpenses = useMemo(
    () =>
      filteredExpenses
        .filter(
          (expense) =>
            normalizeStatus(
              expense.status,
            ) !== "cancelled",
        )
        .reduce(
          (sum, expense) =>
            sum +
            Number(expense.amount || 0),
          0,
        ),
    [filteredExpenses],
  );

  const netProfit =
    grossProfit - totalExpenses;

  const collected = useMemo(
    () =>
      filteredPayments.reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount || 0),
        0,
      ),
    [filteredPayments],
  );

  const receivables = useMemo(
    () =>
      filteredInvoices.reduce(
        (sum, invoice) => {
          const total =
            Number(invoice.total || 0);

          const paid =
            Number(
              invoice.amount_paid || 0,
            );

          return sum + Math.max(total - paid, 0);
        },
        0,
      ),
    [filteredInvoices],
  );

  const inventoryValue = useMemo(() => {
    if (!analytics) return 0;

    const batchCostMap = new Map<
      string,
      number
    >();

    analytics.batches.forEach((batch) => {
      batchCostMap.set(
        batch.id,
        Number(batch.unit_cost || 0),
      );
    });

    const variantCostMap = new Map<
      string,
      number
    >();

    analytics.variants.forEach(
      (variant) => {
        variantCostMap.set(
          variant.id,
          Number(variant.cost_price || 0),
        );
      },
    );

    return analytics.batchStock.reduce(
      (sum, row) => {
        if (
          warehouseFilter !== "all" &&
          row.warehouse_id !==
            warehouseFilter
        ) {
          return sum;
        }

        const quantity =
          Number(row.quantity || 0);

        const reserved =
          Number(
            row.reserved_quantity || 0,
          );

        const available = Math.max(
          quantity - reserved,
          0,
        );

        const variantCost =
          row.variant_id
            ? variantCostMap.get(
                row.variant_id,
              )
            : undefined;

        return (
          sum +
          available *
            Number(variantCost || 0)
        );
      },
      0,
    );
  }, [
    analytics,
    warehouseFilter,
  ]);

  const lowStockCount = useMemo(() => {
    if (!analytics) return 0;

    const stockByVariant =
      new Map<string, number>();

    analytics.batchStock.forEach(
      (row) => {
        if (
          warehouseFilter !== "all" &&
          row.warehouse_id !==
            warehouseFilter
        ) {
          return;
        }

        const key =
          row.variant_id ||
          row.product_id;

        stockByVariant.set(
          key,
          (stockByVariant.get(key) || 0) +
            Math.max(
              Number(row.quantity || 0) -
                Number(
                  row.reserved_quantity || 0,
                ),
              0,
            ),
        );
      },
    );

    let count = 0;

    stockByVariant.forEach(
      (quantity) => {
        if (quantity > 0 && quantity <= 5) {
          count += 1;
        }
      },
    );

    return count;
  }, [analytics, warehouseFilter]);

  const orderCount =
    filteredOrders.length;

  const invoiceCount =
    filteredInvoices.length;

  const customerCount =
    analytics?.customers.filter(
      (customer) =>
        isWithinRange(
          customer.created_at,
          dateRange.start,
          dateRange.end,
        ),
    ).length || 0;

  const purchaseValue =
    filteredPurchaseOrders.reduce(
      (sum, po) =>
        sum +
        Number(po.total_amount || 0),
      0,
    );

  /* ------------------------------------------------------------------------ */
  /* Comparison                                                               */
  /* ------------------------------------------------------------------------ */

  const comparisonMetrics = useMemo(() => {
    if (!analytics || !comparisonRange) {
      return null;
    }

    const previousOrders =
      analytics.orders.filter((order) =>
        isWithinRange(
          order.created_at,
          comparisonRange.start,
          comparisonRange.end,
        ),
      );

    const previousOrderIds = new Set(
      previousOrders.map(
        (order) => order.id,
      ),
    );

    const previousItems =
      analytics.orderItems.filter(
        (item) =>
          previousOrderIds.has(
            item.order_id,
          ),
      );

    const previousRevenue =
      previousOrders.reduce(
        (sum, order) =>
          sum +
          Number(order.total_amount || 0),
        0,
      );

    const previousCogs =
      previousItems.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity || 0) *
            Number(item.unit_cost || 0),
        0,
      );

    const previousExpenses =
      analytics.expenses
        .filter((expense) =>
          isWithinRange(
            expense.expense_date,
            comparisonRange.start,
            comparisonRange.end,
          ),
        )
        .filter(
          (expense) =>
            normalizeStatus(
              expense.status,
            ) !== "cancelled",
        )
        .reduce(
          (sum, expense) =>
            sum +
            Number(expense.amount || 0),
          0,
        );

    const previousGrossProfit =
      previousRevenue -
      previousCogs;

    const previousNetProfit =
      previousGrossProfit -
      previousExpenses;

    const pctChange = (
      current: number,
      previous: number,
    ) => {
      if (previous === 0) {
        return current === 0
          ? 0
          : 100;
      }

      return (
        ((current - previous) /
          Math.abs(previous)) *
        100
      );
    };

    return {
      revenue: pctChange(
        revenue,
        previousRevenue,
      ),
      grossProfit: pctChange(
        grossProfit,
        previousGrossProfit,
      ),
      expenses: pctChange(
        totalExpenses,
        previousExpenses,
      ),
      netProfit: pctChange(
        netProfit,
        previousNetProfit,
      ),
    };
  }, [
    analytics,
    comparisonRange,
    revenue,
    grossProfit,
    totalExpenses,
    netProfit,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Trend data                                                               */
  /* ------------------------------------------------------------------------ */

  const trendData = useMemo(() => {
    if (!analytics) return [];

    const totalDays = Math.max(
      Math.ceil(
        (financialDateRange.end.getTime() -
          financialDateRange.start.getTime()) /
          (24 * 60 * 60 * 1000),
      ) + 1,
      1,
    );

    const bucketCount =
      totalDays <= 31
        ? totalDays
        : totalDays <= 120
          ? Math.ceil(totalDays / 7)
          : 12;

    const buckets = Array.from(
      { length: bucketCount },
      (_, index) => ({
        date: new Date(
          financialDateRange.start,
        ),
        revenue: 0,
        cogs: 0,
        expenses: 0,
        start: new Date(
          financialDateRange.start,
        ),
        end: new Date(
          financialDateRange.start,
        ),
      }),
    );

    if (bucketCount === totalDays) {
      buckets.forEach(
        (bucket, index) => {
          const date = new Date(
            financialDateRange.start,
          );

          date.setDate(
            date.getDate() + index,
          );

          bucket.date = date;
          bucket.start = startOfDay(date);
          bucket.end = endOfDay(date);
        },
      );
    } else {
      const bucketDuration =
        totalDays / bucketCount;

      buckets.forEach(
        (bucket, index) => {
          const startOffset =
            Math.floor(
              index * bucketDuration,
            );

          const endOffset =
            Math.min(
              Math.floor(
                (index + 1) *
                  bucketDuration,
              ) - 1,
              totalDays - 1,
            );

          const start = new Date(
            financialDateRange.start,
          );

          start.setDate(
            start.getDate() +
              startOffset,
          );

          const end = new Date(
            financialDateRange.start,
          );

          end.setDate(
            end.getDate() +
              endOffset,
          );

          bucket.date = start;
          bucket.start =
            startOfDay(start);
          bucket.end =
            endOfDay(end);
        },
      );
    }

    const findBucket = (
      value: string,
    ) =>
      buckets.find(
        (bucket) =>
          isWithinRange(
            value,
            bucket.start,
            bucket.end,
          ),
      );

    analytics.orders.forEach(
      (order) => {
        const bucket =
          findBucket(order.created_at);

        if (!bucket) return;

        bucket.revenue += Number(
          order.total_amount || 0,
        );
      },
    );

    analytics.orderItems.forEach(
      (item) => {
        const order =
          analytics.orders.find(
            (candidate) =>
              candidate.id ===
              item.order_id,
          );

        if (!order) return;

        const bucket =
          findBucket(
            order.created_at,
          );

        if (!bucket) return;

        bucket.cogs +=
          Number(item.quantity || 0) *
          Number(item.unit_cost || 0);
      },
    );

    analytics.expenses.forEach(
      (expense) => {
        const bucket =
          findBucket(
            expense.expense_date,
          );

        if (!bucket) return;

        if (
          normalizeStatus(
            expense.status,
          ) === "cancelled"
        ) {
          return;
        }

        bucket.expenses += Number(
          expense.amount || 0,
        );
      },
    );

    return buckets;
  }, [analytics, financialDateRange]);

  /* ------------------------------------------------------------------------ */
  /* Top products                                                             */
  /* ------------------------------------------------------------------------ */

  const topProducts = useMemo(() => {
    if (!analytics) return [];

    const productMap = new Map<
      string,
      {
        name: string;
        units: number;
        revenue: number;
        cogs: number;
        profit: number;
      }
    >();

    filteredOrderItems.forEach(
      (item) => {
        const name =
          item.product_name ||
          "Unknown product";

        const current =
          productMap.get(name) || {
            name,
            units: 0,
            revenue: 0,
            cogs: 0,
            profit: 0,
          };

        const quantity =
          Number(item.quantity || 0);

        const lineRevenue =
          Number(
            item.line_total ||
              item.unit_price ||
              0,
          ) * (item.line_total ? 1 : quantity);

        const lineCogs =
          quantity *
          Number(item.unit_cost || 0);

        current.units += quantity;
        current.revenue += lineRevenue;
        current.cogs += lineCogs;
        current.profit +=
          lineRevenue - lineCogs;

        productMap.set(
          name,
          current,
        );
      },
    );

    return Array.from(
      productMap.values(),
    )
      .sort(
        (a, b) =>
          b.revenue - a.revenue,
      )
      .slice(0, 8);
  }, [filteredOrderItems]);

  /* ------------------------------------------------------------------------ */
  /* Expense breakdown                                                        */
  /* ------------------------------------------------------------------------ */

  const expenseBreakdown =
    useMemo(() => {
      if (!analytics) return [];

      const categoryMap = new Map<
        string,
        number
      >();

      const categoryNames = new Map(
        analytics.expenseCategories.map(
          (category) => [
            category.id,
            category.name ||
              "Uncategorized",
          ],
        ),
      );

      filteredExpenses.forEach(
        (expense) => {
          if (
            normalizeStatus(
              expense.status,
            ) === "cancelled"
          ) {
            return;
          }

          const category =
            expense.category_id
              ? categoryNames.get(
                  expense.category_id,
                ) ||
                "Uncategorized"
              : "Uncategorized";

          categoryMap.set(
            category,
            (categoryMap.get(category) ||
              0) +
              Number(
                expense.amount || 0,
              ),
          );
        },
      );

      return Array.from(
        categoryMap.entries(),
      )
        .map(
          ([label, value]) => ({
            label,
            value,
          }),
        )
        .sort(
          (a, b) =>
            b.value - a.value,
        )
        .slice(0, 5);
    }, [analytics, filteredExpenses]);

  /* ------------------------------------------------------------------------ */
  /* Top customers                                                            */
  /* ------------------------------------------------------------------------ */

  const topCustomers = useMemo(() => {
    if (!analytics) return [];

    const customerMap = new Map<
      string,
      {
        id: string;
        name: string;
        orders: number;
        revenue: number;
      }
    >();

    filteredOrders.forEach(
      (order) => {
        const customerId =
          order.customer_id;

        if (!customerId) return;

        const customer =
          analytics.customers.find(
            (item) =>
              item.id ===
              customerId,
          );

        const current =
          customerMap.get(
            customerId,
          ) || {
            id: customerId,
            name:
              customer?.name ||
              "Unnamed customer",
            orders: 0,
            revenue: 0,
          };

        current.orders += 1;
        current.revenue += Number(
          order.total_amount || 0,
        );

        customerMap.set(
          customerId,
          current,
        );
      },
    );

    return Array.from(
      customerMap.values(),
    )
      .sort(
        (a, b) =>
          b.revenue - a.revenue,
      )
      .slice(0, 6);
  }, [
    analytics,
    filteredOrders,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Recent activity                                                          */
  /* ------------------------------------------------------------------------ */

  const recentActivity = useMemo(() => {
    if (!analytics) return [];

    const activities: {
      id: string;
      type: string;
      title: string;
      subtitle: string;
      amount: number;
      date: string;
    }[] = [];

    filteredOrders
      .slice(0, 6)
      .forEach((order) => {
        activities.push({
          id: `order-${order.id}`,
          type: "sale",
          title:
            order.order_number ||
            "Sales order",
          subtitle:
            normalizeStatus(
              order.status,
            ) || "Order",
          amount: Number(
            order.total_amount || 0,
          ),
          date: order.created_at,
        });
      });

    filteredInvoices
      .slice(0, 5)
      .forEach((invoice) => {
        activities.push({
          id: `invoice-${invoice.id}`,
          type: "invoice",
          title:
            invoice.invoice_number ||
            "Invoice",
          subtitle:
            normalizeStatus(
              invoice.status,
            ) || "Invoice",
          amount: Number(
            invoice.total || 0,
          ),
          date: invoice.created_at,
        });
      });

    analytics.customers
      .filter((customer) =>
        isWithinRange(
          customer.created_at,
          dateRange.start,
          dateRange.end,
        ),
      )
      .slice(0, 5)
      .forEach((customer) => {
        activities.push({
          id: `customer-${customer.id}`,
          type: "customer",
          title:
            customer.name ||
            "New customer",
          subtitle: "New customer",
          amount: 0,
          date: customer.created_at,
        });
      });

    return activities
      .sort(
        (a, b) =>
          new Date(b.date).getTime() -
          new Date(a.date).getTime(),
      )
      .slice(0, 8);
  }, [
    analytics,
    filteredOrders,
    filteredInvoices,
    dateRange,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Export                                                                   */
  /* ------------------------------------------------------------------------ */

  const exportOverview = useCallback(() => {
    const rows = [
      [
        "Metric",
        "Value",
      ],
      [
        "Period",
        `${formatDate(
          dateRange.start.toISOString(),
        )} - ${formatDate(
          dateRange.end.toISOString(),
        )}`,
      ],
      ["Revenue", revenue],
      ["COGS", cogs],
      ["Gross Profit", grossProfit],
      ["Gross Margin %", grossMargin],
      ["Expenses", totalExpenses],
      ["Net Profit", netProfit],
      ["Collected", collected],
      ["Receivables", receivables],
      ["Orders", orderCount],
      ["Invoices", invoiceCount],
      ["New Customers", customerCount],
      ["Inventory Value", inventoryValue],
      ["Purchase Value", purchaseValue],
      ["Low Stock Items", lowStockCount],
    ];

    const csv = rows
      .map((row) =>
        row.map(escapeCsv).join(","),
      )
      .join("\n");

    const blob = new Blob(
      [`\uFEFF${csv}`],
      {
        type: "text/csv;charset=utf-8;",
      },
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download = `sbs-analytics-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }, [
    dateRange,
    revenue,
    cogs,
    grossProfit,
    grossMargin,
    totalExpenses,
    netProfit,
    collected,
    receivables,
    orderCount,
    invoiceCount,
    customerCount,
    inventoryValue,
    purchaseValue,
    lowStockCount,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (loading && !analytics) {
    return (
      <AppShell
        title="Analytics"
        description="Business intelligence and performance analytics."
      >
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <RefreshCw
                size={22}
                className="animate-spin"
              />
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-700">
              Loading analytics...
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Preparing your business overview.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error                                                                    */
  /* ------------------------------------------------------------------------ */

  if (errorMessage && !analytics) {
    return (
      <AppShell
        title="Analytics"
        description="Business intelligence and performance analytics."
      >
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-800">
            Unable to load analytics
          </p>

          <p className="mt-1 text-sm text-red-700">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={() =>
              void loadAnalytics()
            }
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw size={15} />
            Try again
          </button>
        </div>
      </AppShell>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <AppShell
      title="Analytics"
      description={
        company?.name
          ? `Business intelligence for ${company.name}.`
          : "Business intelligence and performance analytics."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              void loadAnalytics(true)
            }
            disabled={refreshing}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            <span className="hidden sm:inline">
              Refresh
            </span>
          </button>

          <button
            type="button"
            onClick={exportOverview}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            <Download size={15} />
            Export
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ---------------------------------------------------------------- */}
        {/* Controls                                                         */}
        {/* ---------------------------------------------------------------- */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-600">
                  Executive Overview
                </p>

                <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  Business performance
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Track sales, profitability, expenses,
                  inventory and cash flow from one place.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    value={period}
                    onChange={(event) =>
                      setPeriod(
                        event.target.value,
                      )
                    }
                    className="h-10 appearance-none rounded-lg border border-slate-200 bg-white py-0 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    {PERIODS.map(
                      (item) => (
                        <option
                          key={item.value}
                          value={
                            item.value
                          }
                        >
                          {item.label}
                        </option>
                      ),
                    )}
                  </select>

                  <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                <div className="relative">
                  <select
                    value={compare}
                    onChange={(event) =>
                      setCompare(
                        event.target.value,
                      )
                    }
                    className="h-10 appearance-none rounded-lg border border-slate-200 bg-white py-0 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="previous">
                      Compare previous period
                    </option>

                    <option value="year">
                      Compare previous year
                    </option>

                    <option value="none">
                      No comparison
                    </option>
                  </select>

                  <ChevronDown
                    size={15}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowFilters(
                      (current) =>
                        !current,
                    )
                  }
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                    showFilters
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Filter size={15} />
                  Filters
                </button>
              </div>
            </div>

            {period === "custom" && (
              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Start date
                  </span>

                  <input
                    type="date"
                    value={customStart}
                    onChange={(event) =>
                      setCustomStart(
                        event.target.value,
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                    End date
                  </span>

                  <input
                    type="date"
                    value={customEnd}
                    onChange={(event) =>
                      setCustomEnd(
                        event.target.value,
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            )}

            {showFilters && (
              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Warehouse
                  </label>

                  <div className="relative">
                    <select
                      value={
                        warehouseFilter
                      }
                      onChange={(event) =>
                        setWarehouseFilter(
                          event.target.value,
                        )
                      }
                      className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="all">
                        All warehouses
                      </option>

                      {analytics?.warehouses.map(
                        (warehouse) => (
                          <option
                            key={
                              warehouse.id
                            }
                            value={
                              warehouse.id
                            }
                          >
                            {warehouse.name}
                          </option>
                        ),
                      )}
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Currency
                  </label>

                  <div className="relative">
                    <select
                      value={
                        currencyFilter
                      }
                      onChange={(event) =>
                        setCurrencyFilter(
                          event.target.value,
                        )
                      }
                      className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="all">
                        All currencies
                      </option>

                      {Array.from(
                        new Set(
                          analytics?.orders.map(
                            (order) =>
                              order.currency ||
                              currency,
                          ) || [],
                        ),
                      ).map(
                        (item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item}
                          </option>
                        ),
                      )}
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="font-medium">
                Showing:
              </span>

              <span className="rounded-full bg-slate-50 px-2.5 py-1 font-semibold text-slate-600">
                {formatDate(
                  dateRange.start.toISOString(),
                )}{" "}
                —{" "}
                {formatDate(
                  dateRange.end.toISOString(),
                )}
              </span>

              {compare !== "none" &&
                comparisonRange && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                    Comparison enabled
                  </span>
                )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* KPI grid                                                         */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Revenue"
            value={formatMoney(
              revenue,
              currency,
            )}
            helper="Sales generated during the selected period."
            trend={
              comparisonMetrics?.revenue ??
              null
            }
            icon={
              <CircleDollarSign
                size={20}
              />
            }
          />

          <StatCard
            label="Gross Profit"
            value={formatMoney(
              grossProfit,
              currency,
            )}
            helper={`${grossMargin.toFixed(
              1,
            )}% gross margin after product costs.`}
            trend={
              comparisonMetrics?.grossProfit ??
              null
            }
            icon={
              <TrendingUp size={20} />
            }
          />

          <StatCard
            label="Net Profit"
            value={formatMoney(
              netProfit,
              currency,
            )}
            helper="Gross profit less recorded expenses."
            trend={
              comparisonMetrics?.netProfit ??
              null
            }
            icon={
              <Wallet size={20} />
            }
          />

          <StatCard
            label="Expenses"
            value={formatMoney(
              totalExpenses,
              currency,
            )}
            helper="Approved, paid and other non-cancelled expenses."
            trend={
              comparisonMetrics?.expenses ??
              null
            }
            icon={
              <ArrowDownRight
                size={20}
              />
            }
          />

          <StatCard
            label="Receivables"
            value={formatMoney(
              receivables,
              currency,
            )}
            helper="Outstanding invoice balance in the period."
            icon={
              <FileText size={20} />
            }
          />

          <StatCard
            label="Collected"
            value={formatMoney(
              collected,
              currency,
            )}
            helper="Invoice payments recorded in the period."
            icon={
              <CircleDollarSign
                size={20}
              />
            }
          />

          <StatCard
            label="Orders"
            value={formatNumber(
              orderCount,
            )}
            helper="Sales orders created in the selected period."
            icon={
              <ShoppingCart
                size={20}
              />
            }
          />

          <StatCard
            label="Inventory Value"
            value={formatMoney(
              inventoryValue,
              currency,
            )}
            helper="Estimated available inventory value at cost."
            icon={
              <Boxes size={20} />
            }
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Financial trend                                                  */}
        {/* ---------------------------------------------------------------- */}

        <SectionCard
          title="Financial performance"
          description="Revenue, cost of goods sold and operating expenses over time."
          icon={
            <Activity size={18} />
          }
        >
          <TrendChart
            data={trendData}
            currency={currency}
            period={financialPeriod}
            onPeriodChange={setFinancialPeriod}
            hoveredIndex={financialHoveredIndex}
            onHover={setFinancialHoveredIndex}
          />
        </SectionCard>

        {/* ---------------------------------------------------------------- */}
        {/* Secondary KPI row                                                */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <ClipboardList
                size={16}
              />

              <span className="text-xs font-semibold uppercase tracking-[0.06em]">
                Invoices
              </span>
            </div>

            <p className="mt-3 text-xl font-bold text-slate-900">
              {formatNumber(
                invoiceCount,
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Created in period
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Users size={16} />

              <span className="text-xs font-semibold uppercase tracking-[0.06em]">
                New Customers
              </span>
            </div>

            <p className="mt-3 text-xl font-bold text-slate-900">
              {formatNumber(
                customerCount,
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Added in period
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <Package size={16} />

              <span className="text-xs font-semibold uppercase tracking-[0.06em]">
                Low Stock
              </span>
            </div>

            <p className="mt-3 text-xl font-bold text-slate-900">
              {formatNumber(
                lowStockCount,
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Items with ≤ 5 available
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500">
              <ShoppingCart
                size={16}
              />

              <span className="text-xs font-semibold uppercase tracking-[0.06em]">
                Purchases
              </span>
            </div>

            <p className="mt-3 text-xl font-bold text-slate-900">
              {formatMoney(
                purchaseValue,
                currency,
              )}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Purchase orders in period
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Product + expense analytics                                     */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            title="Top products"
            description="Products generating the most sales revenue."
            icon={
              <Package size={18} />
            }
            action={
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/products",
                  )
                }
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View products
              </button>
            }
          >
            {topProducts.length === 0 ? (
              <EmptyState message="No product sales found in this period." />
            ) : (
              <div className="divide-y divide-slate-100">
                {topProducts.map(
                  (
                    product,
                    index,
                  ) => {
                    const margin =
                      product.revenue >
                      0
                        ? (product.profit /
                            product.revenue) *
                          100
                        : 0;

                    return (
                      <div
                        key={
                          product.name
                        }
                        className="flex items-center gap-4 px-5 py-4"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-xs font-bold text-slate-500">
                          {index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {
                              product.name
                            }
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatNumber(
                              product.units,
                            )}{" "}
                            units ·{" "}
                            {margin.toFixed(
                              1,
                            )}
                            % margin
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">
                            {formatMoney(
                              product.revenue,
                              currency,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-emerald-600">
                            {formatMoney(
                              product.profit,
                              currency,
                            )}{" "}
                            profit
                          </p>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Expense breakdown"
            description="Where operating expenses are being allocated."
            icon={
              <Wallet size={18} />
            }
          >
            <DonutChart
              values={
                expenseBreakdown
              }
            />
          </SectionCard>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Customers + activity                                             */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            title="Top customers"
            description="Customers ranked by sales revenue in the selected period."
            icon={
              <Users size={18} />
            }
            action={
              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/customers",
                  )
                }
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                View customers
              </button>
            }
          >
            {topCustomers.length === 0 ? (
              <EmptyState message="No customer sales found in this period." />
            ) : (
              <div className="divide-y divide-slate-100">
                {topCustomers.map(
                  (
                    customer,
                    index,
                  ) => (
                    <div
                      key={
                        customer.id
                      }
                      className="flex items-center gap-3 px-5 py-4"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                        {getInitials(
                          customer.name,
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {
                            customer.name
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatNumber(
                            customer.orders,
                          )}{" "}
                          order
                          {customer.orders ===
                          1
                            ? ""
                            : "s"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">
                          {formatMoney(
                            customer.revenue,
                            currency,
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          #{index + 1}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Recent activity"
            description="Latest sales, invoices and customer activity."
            icon={
              <Activity size={18} />
            }
          >
            {recentActivity.length ===
            0 ? (
              <EmptyState message="No recent activity in this period." />
            ) : (
              <div className="divide-y divide-slate-100">
                {recentActivity.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                        {item.type ===
                        "sale" ? (
                          <ShoppingCart
                            size={15}
                          />
                        ) : item.type ===
                          "invoice" ? (
                          <FileText
                            size={15}
                          />
                        ) : (
                          <Users
                            size={15}
                          />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {
                            item.title
                          }
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {
                            item.subtitle
                          }{" "}
                          ·{" "}
                          {formatDate(
                            item.date,
                          )}
                        </p>
                      </div>

                      {item.amount >
                        0 && (
                        <span className="shrink-0 text-sm font-semibold text-slate-800">
                          {formatMoney(
                            item.amount,
                            currency,
                          )}
                        </span>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Inventory snapshot                                               */}
        {/* ---------------------------------------------------------------- */}

        <SectionCard
          title="Inventory snapshot"
          description="Current inventory position across the selected warehouse."
          icon={
            <Boxes size={18} />
          }
          action={
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/inventory",
                )
              }
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Open inventory
            </button>
          }
        >
          <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                Available value
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {formatMoney(
                  inventoryValue,
                  currency,
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Based on available stock at cost
              </p>
            </div>

            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                Low stock
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {formatNumber(
                  lowStockCount,
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Products or variants with limited stock
              </p>
            </div>

            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
                Warehouses
              </p>

              <p className="mt-2 text-xl font-bold text-slate-900">
                {formatNumber(
                  analytics?.warehouses
                    .length || 0,
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Active workspace warehouses
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ---------------------------------------------------------------- */}
        {/* Error banner                                                     */}
        {/* ---------------------------------------------------------------- */}

        {errorMessage && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <X
              size={17}
              className="mt-0.5 shrink-0 text-red-500"
            />

            <div>
              <p className="text-sm font-semibold text-red-800">
                Some analytics data could not be refreshed.
              </p>

              <p className="mt-0.5 text-xs text-red-700">
                {errorMessage}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}