import { createClient } from "@/lib/supabase/client";

export type RegionalSettings = {
  id?: string;
  company_id?: string;
  base_currency: string;
  currency_symbol: string;
  currency_symbol_position: "before" | "after";
  decimal_places: number;
  thousands_separator: string;
  decimal_separator: string;
  timezone: string;
  date_format: string;
  time_format: "12h" | "24h";
};

export const DEFAULT_REGIONAL_SETTINGS: RegionalSettings = {
  base_currency: "USD",
  currency_symbol: "$",
  currency_symbol_position: "before",
  decimal_places: 2,
  thousands_separator: ",",
  decimal_separator: ".",
  timezone: "UTC",
  date_format: "MM/DD/YYYY",
  time_format: "12h",
};

/**
 * Load the current company's regional settings.
 *
 * This is the single source of truth for currency formatting
 * throughout SBS.
 */
export async function getRegionalSettings(): Promise<RegionalSettings> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("You must be logged in.");
  }

  const { data: membership, error: membershipError } =
    await supabase
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
      "No company membership was found for this account."
    );
  }

  const { data, error } = await supabase
    .from("company_regional_settings")
    .select(
      `
        id,
        company_id,
        base_currency,
        currency_symbol,
        currency_symbol_position,
        decimal_places,
        thousands_separator,
        decimal_separator,
        timezone,
        date_format,
        time_format
      `
    )
    .eq("company_id", membership.company_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      ...DEFAULT_REGIONAL_SETTINGS,
      company_id: membership.company_id,
    };
  }

  return {
    ...DEFAULT_REGIONAL_SETTINGS,
    ...data,
  };
}

/**
 * Format a monetary value using the company's
 * Regional Settings configuration.
 *
 * Example:
 *
 * AED + before + 2 decimals
 * => د.إ1,250.00
 *
 * AED + after + 2 decimals
 * => 1,250.00 د.إ
 */
export function formatMoney(
  amount: number | string | null | undefined,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : Number(amount ?? 0);

  const safeAmount = Number.isFinite(numericAmount)
    ? numericAmount
    : 0;

  const decimals = Math.max(
    0,
    Math.min(6, Number(settings.decimal_places) || 0)
  );

  const fixed = Math.abs(safeAmount).toFixed(decimals);

  const [integerPart, decimalPart] =
    fixed.split(".");

  const groupedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    settings.thousands_separator
  );

  const number =
    decimals > 0
      ? `${groupedInteger}${settings.decimal_separator}${decimalPart}`
      : groupedInteger;

  const sign = safeAmount < 0 ? "-" : "";

  const symbol = settings.currency_symbol || settings.base_currency;

  if (settings.currency_symbol_position === "after") {
    return `${sign}${number} ${symbol}`;
  }

  return `${sign}${symbol}${number}`;
}

/**
 * Format a plain number using regional separators,
 * without adding a currency symbol.
 */
export function formatNumber(
  amount: number | string | null | undefined,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : Number(amount ?? 0);

  const safeAmount = Number.isFinite(numericAmount)
    ? numericAmount
    : 0;

  const decimals = Math.max(
    0,
    Math.min(6, Number(settings.decimal_places) || 0)
  );

  const fixed = safeAmount.toFixed(decimals);

  const [integerPart, decimalPart] =
    fixed.split(".");

  const groupedInteger = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    settings.thousands_separator
  );

  if (decimals === 0) {
    return groupedInteger;
  }

  return `${groupedInteger}${settings.decimal_separator}${decimalPart}`;
}

/**
 * Return the currently configured currency symbol.
 */
export function getCurrencySymbol(
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  return (
    settings.currency_symbol ||
    settings.base_currency
  );
}

/**
 * Return the currently configured currency code.
 */
export function getCurrencyCode(
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  return settings.base_currency || "USD";
}