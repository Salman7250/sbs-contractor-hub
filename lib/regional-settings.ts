import { createClient } from "@/lib/supabase/client";

export type ExchangeRate = {
  id?: string;
  company_id?: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

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

  exchange_rate_mode: "manual" | "automatic";

  exchange_rates: ExchangeRate[];
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

  exchange_rate_mode: "manual",
  exchange_rates: [],
};

/**
 * Load the current company's complete regional configuration.
 *
 * Supports both:
 *
 * 1. Employee/company users
 *    company_members -> company_id
 *
 * 2. B2B customer portal users
 *    customer_portal_users -> company_id
 *
 * Customer portal users intentionally do not need a
 * company_members record.
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

  /*
   * -------------------------------------------------------
   * Resolve the company.
   * -------------------------------------------------------
   *
   * Normal employees are connected through company_members.
   *
   * B2B customer portal users are connected through
   * customer_portal_users instead.
   */

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

  let companyId =
    membership?.company_id ?? null;

  /*
   * -------------------------------------------------------
   * B2B CUSTOMER PORTAL FALLBACK
   * -------------------------------------------------------
   *
   * A customer portal user normally does not have a
   * company_members row.
   *
   * Resolve their company through customer_portal_users.
   */

  if (!companyId) {
    const {
      data: portalUser,
      error: portalUserError,
    } = await supabase
      .from("customer_portal_users")
      .select("company_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (portalUserError) {
      throw portalUserError;
    }

    if (portalUser) {
      const status = String(
        portalUser.status ?? ""
      ).toLowerCase();

      /*
       * Suspended/revoked portal users should not receive
       * company-level regional settings.
       */
      if (
        status !== "suspended" &&
        status !== "revoked"
      ) {
        companyId =
          portalUser.company_id ?? null;
      }
    }
  }

  if (!companyId) {
    throw new Error(
      "No company was found for this account."
    );
  }

  /*
   * -------------------------------------------------------
   * REGIONAL SETTINGS
   * -------------------------------------------------------
   */

  const {
    data: regionalData,
    error: regionalError,
  } = await supabase
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
        time_format,
        exchange_rate_mode
      `
    )
    .eq("company_id", companyId)
    .maybeSingle();

  if (regionalError) {
    throw regionalError;
  }

  /*
   * -------------------------------------------------------
   * EXCHANGE RATES
   * -------------------------------------------------------
   */

  const {
    data: exchangeRates,
    error: exchangeRatesError,
  } = await supabase
    .from("company_exchange_rates")
    .select(
      `
        id,
        company_id,
        from_currency,
        to_currency,
        rate,
        is_active,
        notes,
        created_at,
        updated_at
      `
    )
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("from_currency", {
      ascending: true,
    })
    .order("to_currency", {
      ascending: true,
    });

  if (exchangeRatesError) {
    throw exchangeRatesError;
  }

  return {
    ...DEFAULT_REGIONAL_SETTINGS,
    ...(regionalData || {}),
    company_id: companyId,
    exchange_rates:
      (exchangeRates || []) as ExchangeRate[],
  };
}

/**
 * Find a configured exchange rate.
 */
export function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): number | null {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return 1;
  }

  const directRate = settings.exchange_rates.find(
    (item) =>
      item.is_active &&
      item.from_currency.toUpperCase() === from &&
      item.to_currency.toUpperCase() === to
  );

  if (directRate) {
    return Number(directRate.rate);
  }

  /*
   * If only the reverse rate exists,
   * calculate the inverse automatically.
   *
   * Example:
   * AED -> USD = 0.2723
   *
   * Then:
   * USD -> AED = 1 / 0.2723
   */
  const reverseRate = settings.exchange_rates.find(
    (item) =>
      item.is_active &&
      item.from_currency.toUpperCase() === to &&
      item.to_currency.toUpperCase() === from
  );

  if (
    reverseRate &&
    Number(reverseRate.rate) > 0
  ) {
    return 1 / Number(reverseRate.rate);
  }

  return null;
}

/**
 * Convert an amount using the company's
 * configured manual exchange rates.
 */
export function convertCurrency(
  amount: number | string | null | undefined,
  fromCurrency: string,
  toCurrency: string,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): number {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : Number(amount ?? 0);

  const safeAmount = Number.isFinite(
    numericAmount
  )
    ? numericAmount
    : 0;

  const rate = getExchangeRate(
    fromCurrency,
    toCurrency,
    settings
  );

  if (rate === null) {
    return safeAmount;
  }

  return safeAmount * rate;
}

/**
 * Convert an amount into the company's base currency.
 */
export function convertToBaseCurrency(
  amount: number | string | null | undefined,
  currency: string,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): number {
  return convertCurrency(
    amount,
    currency,
    settings.base_currency,
    settings
  );
}

/**
 * Format money using the company's regional configuration.
 */
export function formatMoney(
  amount: number | string | null | undefined,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : Number(amount ?? 0);

  const safeAmount = Number.isFinite(
    numericAmount
  )
    ? numericAmount
    : 0;

  const decimals = Math.max(
    0,
    Math.min(
      6,
      Number(settings.decimal_places) || 0
    )
  );

  const fixed = Math.abs(safeAmount).toFixed(
    decimals
  );

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

  const sign =
    safeAmount < 0 ? "-" : "";

  const symbol =
    settings.currency_symbol ||
    settings.base_currency;

  if (
    settings.currency_symbol_position ===
    "after"
  ) {
    return `${sign}${number} ${symbol}`;
  }

  return `${sign}${symbol}${number}`;
}

/**
 * Format a plain number without a currency symbol.
 */
export function formatNumber(
  amount: number | string | null | undefined,
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : Number(amount ?? 0);

  const safeAmount = Number.isFinite(
    numericAmount
  )
    ? numericAmount
    : 0;

  const decimals = Math.max(
    0,
    Math.min(
      6,
      Number(settings.decimal_places) || 0
    )
  );

  const fixed = safeAmount.toFixed(
    decimals
  );

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
 * Return the configured currency symbol.
 */
export function getCurrencySymbol(
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  return (
    settings.currency_symbol ||
    settings.base_currency ||
    "$"
  );
}

/**
 * Return the configured currency code.
 */
export function getCurrencyCode(
  settings: RegionalSettings = DEFAULT_REGIONAL_SETTINGS
): string {
  return settings.base_currency || "USD";
}