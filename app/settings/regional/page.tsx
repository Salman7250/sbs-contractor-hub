"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  Clock3,
  Globe2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import AppShell from "@/app/components/app-shell";
import { createClient } from "@/lib/supabase/client";

type RegionalSettings = {
  id: string;
  company_id: string;
  base_currency: string;
  currency_symbol: string;
  currency_symbol_position: "before" | "after";
  decimal_places: number;
  thousands_separator: string;
  decimal_separator: string;
  timezone: string;
  date_format: string;
  time_format: "12h" | "24h";
  exchange_rate_mode: "manual";
};

type ExchangeRate = {
  id: string;
  company_id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Currency = {
  code: string;
  name: string;
  symbol: string;
};

const CURRENCIES: Currency[] = [
  { code: "AED", name: "United Arab Emirates Dirham", symbol: "د.إ" },
  { code: "AFN", name: "Afghan Afghani", symbol: "؋" },
  { code: "ALL", name: "Albanian Lek", symbol: "Lek" },
  { code: "AMD", name: "Armenian Dram", symbol: "֏" },
  { code: "ANG", name: "Netherlands Antillean Guilder", symbol: "ƒ" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz" },
  { code: "ARS", name: "Argentine Peso", symbol: "$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "AWG", name: "Aruban Florin", symbol: "ƒ" },
  { code: "AZN", name: "Azerbaijani Manat", symbol: "₼" },
  { code: "BAM", name: "Bosnia and Herzegovina Convertible Mark", symbol: "KM" },
  { code: "BBD", name: "Barbadian Dollar", symbol: "Bds$" },
  { code: "BDT", name: "Bangladeshi Taka", symbol: "৳" },
  { code: "BGN", name: "Bulgarian Lev", symbol: "лв" },
  { code: "BHD", name: "Bahraini Dinar", symbol: ".د.ب" },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu" },
  { code: "BND", name: "Brunei Dollar", symbol: "B$" },
  { code: "BOB", name: "Bolivian Boliviano", symbol: "Bs." },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "BSD", name: "Bahamian Dollar", symbol: "B$" },
  { code: "BTN", name: "Bhutanese Ngultrum", symbol: "Nu." },
  { code: "BWP", name: "Botswana Pula", symbol: "P" },
  { code: "BYN", name: "Belarusian Ruble", symbol: "Br" },
  { code: "BZD", name: "Belize Dollar", symbol: "BZ$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CDF", name: "Congolese Franc", symbol: "FC" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CLP", name: "Chilean Peso", symbol: "$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "COP", name: "Colombian Peso", symbol: "$" },
  { code: "CRC", name: "Costa Rican Colón", symbol: "₡" },
  { code: "CUP", name: "Cuban Peso", symbol: "$" },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "$" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "DOP", name: "Dominican Peso", symbol: "RD$" },
  { code: "DZD", name: "Algerian Dinar", symbol: "دج" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "FJD", name: "Fijian Dollar", symbol: "FJ$" },
  { code: "GBP", name: "British Pound Sterling", symbol: "£" },
  { code: "GEL", name: "Georgian Lari", symbol: "₾" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "HNL", name: "Honduran Lempira", symbol: "L" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "ILS", name: "Israeli New Shekel", symbol: "₪" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "IQD", name: "Iraqi Dinar", symbol: "ع.د" },
  { code: "IRR", name: "Iranian Rial", symbol: "﷼" },
  { code: "ISK", name: "Icelandic Króna", symbol: "kr" },
  { code: "JMD", name: "Jamaican Dollar", symbol: "J$" },
  { code: "JOD", name: "Jordanian Dinar", symbol: "د.ا" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "KHR", name: "Cambodian Riel", symbol: "៛" },
  { code: "KMF", name: "Comorian Franc", symbol: "CF" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "د.ك" },
  { code: "KZT", name: "Kazakhstani Tenge", symbol: "₸" },
  { code: "LAK", name: "Lao Kip", symbol: "₭" },
  { code: "LBP", name: "Lebanese Pound", symbol: "ل.ل" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "د.م." },
  { code: "MDL", name: "Moldovan Leu", symbol: "L" },
  { code: "MKD", name: "Macedonian Denar", symbol: "ден" },
  { code: "MMK", name: "Myanmar Kyat", symbol: "K" },
  { code: "MNT", name: "Mongolian Tögrög", symbol: "₮" },
  { code: "MOP", name: "Macanese Pataca", symbol: "MOP$" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "₨" },
  { code: "MVR", name: "Maldivian Rufiyaa", symbol: "Rf" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
  { code: "NAD", name: "Namibian Dollar", symbol: "N$" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "NIO", name: "Nicaraguan Córdoba", symbol: "C$" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "NPR", name: "Nepalese Rupee", symbol: "₨" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "OMR", name: "Omani Rial", symbol: "﷼" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱" },
  { code: "PKR", name: "Pakistani Rupee", symbol: "₨" },
  { code: "PLN", name: "Polish Złoty", symbol: "zł" },
  { code: "PYG", name: "Paraguayan Guaraní", symbol: "₲" },
  { code: "QAR", name: "Qatari Riyal", symbol: "﷼" },
  { code: "RON", name: "Romanian Leu", symbol: "lei" },
  { code: "RSD", name: "Serbian Dinar", symbol: "дин" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "TND", name: "Tunisian Dinar", symbol: "د.ت" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "UAH", name: "Ukrainian Hryvnia", symbol: "₴" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "USD", name: "United States Dollar", symbol: "$" },
  { code: "UYU", name: "Uruguayan Peso", symbol: "$U" },
  { code: "UZS", name: "Uzbekistani Som", symbol: "лв" },
  { code: "VND", name: "Vietnamese Đồng", symbol: "₫" },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA" },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
];

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY — 09/14/2026" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY — 14/09/2026" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD — 2026-09-14" },
  { value: "DD-MMM-YYYY", label: "DD-MMM-YYYY — 14-Sep-2026" },
];

function getCurrency(code: string) {
  return (
    CURRENCIES.find((currency) => currency.code === code) || {
      code,
      name: code,
      symbol: code,
    }
  );
}

function getTimezoneList() {
  try {
    if (
      typeof Intl !== "undefined" &&
      typeof Intl.supportedValuesOf === "function"
    ) {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // Compatibility fallback below.
  }

  return [
    "UTC",
    "Asia/Dubai",
    "Asia/Karachi",
    "Asia/Riyadh",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
  ];
}

function formatPreviewAmount(
  amount: number,
  settings: RegionalSettings
) {
  const fixed = amount.toFixed(settings.decimal_places);

  const [integerPart, decimalPart] = fixed.split(".");

  const grouped = integerPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    settings.thousands_separator
  );

  const number =
    settings.decimal_places > 0
      ? `${grouped}${settings.decimal_separator}${decimalPart}`
      : grouped;

  return settings.currency_symbol_position === "before"
    ? `${settings.currency_symbol}${number}`
    : `${number} ${settings.currency_symbol}`;
}

export default function RegionalSettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRate, setSavingRate] = useState(false);

  const [companyId, setCompanyId] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [settings, setSettings] =
    useState<RegionalSettings | null>(null);

  const [rates, setRates] = useState<ExchangeRate[]>([]);

  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [symbolPosition, setSymbolPosition] =
    useState<"before" | "after">("before");
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [thousandsSeparator, setThousandsSeparator] = useState(",");
  const [decimalSeparator, setDecimalSeparator] = useState(".");
  const [timezone, setTimezone] = useState("UTC");
  const [dateFormat, setDateFormat] =
    useState("MM/DD/YYYY");
  const [timeFormat, setTimeFormat] =
    useState<"12h" | "24h">("12h");

  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("AED");
  const [rateValue, setRateValue] = useState("");
  const [rateNotes, setRateNotes] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const timezones = useMemo(() => getTimezoneList(), []);

  const selectedCurrency = useMemo(
    () => getCurrency(baseCurrency),
    [baseCurrency]
  );

  const previewSettings = useMemo<RegionalSettings>(
    () => ({
      id: settings?.id || "",
      company_id: companyId,
      base_currency: baseCurrency,
      currency_symbol: currencySymbol,
      currency_symbol_position: symbolPosition,
      decimal_places: decimalPlaces,
      thousands_separator: thousandsSeparator,
      decimal_separator: decimalSeparator,
      timezone,
      date_format: dateFormat,
      time_format: timeFormat,
      exchange_rate_mode: "manual",
    }),
    [
      settings?.id,
      companyId,
      baseCurrency,
      currencySymbol,
      symbolPosition,
      decimalPlaces,
      thousandsSeparator,
      decimalSeparator,
      timezone,
      dateFormat,
      timeFormat,
    ]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership?.company_id) {
        throw new Error(
          "No company membership was found for this account."
        );
      }

      setCompanyId(membership.company_id);

      const { data: company, error: companyError } =
        await supabase
          .from("companies")
          .select("id, name, currency, timezone")
          .eq("id", membership.company_id)
          .maybeSingle();

      if (companyError) throw companyError;

      if (!company) {
        throw new Error(
          "The company associated with your account could not be found."
        );
      }

      setCompanyName(company.name || "");

      const { data: regional, error: regionalError } =
        await supabase
          .from("company_regional_settings")
          .select(
            "id, company_id, base_currency, currency_symbol, currency_symbol_position, decimal_places, thousands_separator, decimal_separator, timezone, date_format, time_format, exchange_rate_mode"
          )
          .eq("company_id", membership.company_id)
          .maybeSingle();

      if (regionalError) throw regionalError;

      if (regional) {
        setSettings(regional);
        setBaseCurrency(regional.base_currency);
        setCurrencySymbol(regional.currency_symbol);
        setSymbolPosition(regional.currency_symbol_position);
        setDecimalPlaces(regional.decimal_places);
        setThousandsSeparator(regional.thousands_separator);
        setDecimalSeparator(regional.decimal_separator);
        setTimezone(regional.timezone);
        setDateFormat(regional.date_format);
        setTimeFormat(regional.time_format);
      } else {
        const fallbackCurrency = company.currency || "USD";
        const fallbackCurrencyData =
          getCurrency(fallbackCurrency);

        setBaseCurrency(fallbackCurrency);
        setCurrencySymbol(fallbackCurrencyData.symbol);
        setTimezone(company.timezone || "UTC");
      }

      const { data: exchangeRates, error: ratesError } =
        await supabase
          .from("company_exchange_rates")
          .select(
            "id, company_id, from_currency, to_currency, rate, is_active, notes, created_at, updated_at"
          )
          .eq("company_id", membership.company_id)
          .order("from_currency", {
            ascending: true,
          })
          .order("to_currency", {
            ascending: true,
          });

      if (ratesError) throw ratesError;

      setRates(exchangeRates || []);
    } catch (err: unknown) {
      console.error("Regional settings load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not load regional settings."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleCurrencyChange(value: string) {
    setBaseCurrency(value);

    const currency = getCurrency(value);
    setCurrencySymbol(currency.symbol);
  }

  async function saveRegionalSettings() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      if (!companyId) {
        throw new Error("Company information is unavailable.");
      }

      if (!currencySymbol.trim()) {
        throw new Error("Currency symbol is required.");
      }

      if (
        thousandsSeparator === decimalSeparator
      ) {
        throw new Error(
          "Thousands separator and decimal separator must be different."
        );
      }

      const payload = {
        company_id: companyId,
        base_currency: baseCurrency,
        currency_symbol: currencySymbol.trim(),
        currency_symbol_position: symbolPosition,
        decimal_places: decimalPlaces,
        thousands_separator: thousandsSeparator,
        decimal_separator: decimalSeparator,
        timezone,
        date_format: dateFormat,
        time_format: timeFormat,
        exchange_rate_mode: "manual",
      };

      const { data, error: saveError } = await supabase
        .from("company_regional_settings")
        .upsert(payload, {
          onConflict: "company_id",
        })
        .select(
          "id, company_id, base_currency, currency_symbol, currency_symbol_position, decimal_places, thousands_separator, decimal_separator, timezone, date_format, time_format, exchange_rate_mode"
        )
        .single();

      if (saveError) throw saveError;

      setSettings(data);

      const { error: companyError } = await supabase
        .from("companies")
        .update({
          currency: baseCurrency,
          timezone,
        })
        .eq("id", companyId);

      if (companyError) throw companyError;

      window.dispatchEvent(
        new CustomEvent("sbs-company-updated", {
          detail: {
            id: companyId,
            currency: baseCurrency,
            timezone,
          },
        })
      );

      window.dispatchEvent(
        new CustomEvent("sbs-regional-settings-updated", {
          detail: data,
        })
      );

      setMessage(
        "Regional and currency settings saved successfully."
      );
    } catch (err: unknown) {
      console.error(
        "Regional settings save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not save regional settings."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveExchangeRate() {
    try {
      setSavingRate(true);
      setMessage("");
      setError("");

      if (!companyId) {
        throw new Error("Company information is unavailable.");
      }

      if (fromCurrency === toCurrency) {
        throw new Error(
          "From and To currencies must be different."
        );
      }

      const parsedRate = Number(rateValue);

      if (
        !Number.isFinite(parsedRate) ||
        parsedRate <= 0
      ) {
        throw new Error(
          "Enter a valid exchange rate greater than zero."
        );
      }

      const { data, error: saveError } = await supabase
        .from("company_exchange_rates")
        .upsert(
          {
            company_id: companyId,
            from_currency: fromCurrency,
            to_currency: toCurrency,
            rate: parsedRate,
            is_active: true,
            notes: rateNotes.trim() || null,
          },
          {
            onConflict:
              "company_id,from_currency,to_currency",
          }
        )
        .select(
          "id, company_id, from_currency, to_currency, rate, is_active, notes, created_at, updated_at"
        )
        .single();

      if (saveError) throw saveError;

      setRates((current) => {
        const existing = current.find(
          (item) => item.id === data.id
        );

        if (existing) {
          return current.map((item) =>
            item.id === data.id ? data : item
          );
        }

        return [...current, data].sort((a, b) =>
          `${a.from_currency}${a.to_currency}`.localeCompare(
            `${b.from_currency}${b.to_currency}`
          )
        );
      });

      setRateValue("");
      setRateNotes("");

      setMessage(
        `Exchange rate saved: 1 ${fromCurrency} = ${parsedRate} ${toCurrency}.`
      );
    } catch (err: unknown) {
      console.error(
        "Exchange rate save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not save exchange rate."
      );
    } finally {
      setSavingRate(false);
    }
  }

  async function toggleRate(rate: ExchangeRate) {
    try {
      setMessage("");
      setError("");

      const { data, error: updateError } = await supabase
        .from("company_exchange_rates")
        .update({
          is_active: !rate.is_active,
        })
        .eq("id", rate.id)
        .eq("company_id", companyId)
        .select(
          "id, company_id, from_currency, to_currency, rate, is_active, notes, created_at, updated_at"
        )
        .single();

      if (updateError) throw updateError;

      setRates((current) =>
        current.map((item) =>
          item.id === rate.id ? data : item
        )
      );

      setMessage(
        data.is_active
          ? "Exchange rate activated."
          : "Exchange rate disabled."
      );
    } catch (err: unknown) {
      console.error(
        "Exchange rate toggle error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not update exchange rate."
      );
    }
  }

  async function deleteRate(rate: ExchangeRate) {
    const confirmed = window.confirm(
      `Delete the exchange rate 1 ${rate.from_currency} = ${rate.rate} ${rate.to_currency}?`
    );

    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      const { error: deleteError } = await supabase
        .from("company_exchange_rates")
        .delete()
        .eq("id", rate.id)
        .eq("company_id", companyId);

      if (deleteError) throw deleteError;

      setRates((current) =>
        current.filter((item) => item.id !== rate.id)
      );

      setMessage("Exchange rate deleted.");
    } catch (err: unknown) {
      console.error(
        "Exchange rate delete error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not delete exchange rate."
      );
    }
  }

  function swapCurrencies() {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }

  if (loading) {
    return (
      <AppShell
        title="Regional Settings"
        description="Configure currency, exchange rates, numbers, dates, and regional behavior."
      >
        <div className="loading-state">
          <RefreshCw size={22} className="spin" />
          <strong>Loading regional settings...</strong>
          <span>
            Preparing your currency and regional configuration.
          </span>
        </div>

        <style jsx>{`
          .loading-state {
            min-height: 500px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            color: #64748b;
          }

          .loading-state strong {
            color: #172033;
            font-size: 15px;
          }

          .loading-state span {
            font-size: 13px;
          }

          .spin {
            animation: spin 0.9s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Regional Settings"
      description="Configure currency, exchange rates, numbers, dates, and regional behavior."
    >
      <div className="regional-page">
        <button
          type="button"
          className="back-button"
          onClick={() => router.push("/settings")}
        >
          <ArrowLeft size={17} />
          Settings
        </button>

        {message && (
          <div className="alert success">
            <span className="alert-icon">
              <Check size={14} />
            </span>
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="alert error">
            <span className="alert-icon">!</span>
            <span>{error}</span>
          </div>
        )}

        <section className="hero">
          <div className="hero-main">
            <div className="hero-icon">
              <Globe2 size={25} />
            </div>

            <div>
              <span className="eyebrow">
                Global workspace configuration
              </span>

              <h1>Currency & Regional Settings</h1>

              <p>
                Configure how SBS displays money, numbers,
                dates, times, and exchange rates for{" "}
                <strong>{companyName}</strong>.
              </p>
            </div>
          </div>

          <div className="hero-currency">
            <span>Base currency</span>
            <strong>
              {selectedCurrency.code}
            </strong>
            <small>
              {selectedCurrency.name}
            </small>
          </div>
        </section>

        <div className="layout">
          <main className="main-column">
            <section className="card">
              <div className="card-header">
                <div className="section-icon">
                  <CircleDollarSign size={19} />
                </div>

                <div>
                  <span className="section-label">
                    Currency
                  </span>

                  <h2>Base Currency & Display</h2>

                  <p>
                    This controls the primary currency and
                    how monetary amounts are displayed
                    throughout SBS.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <label className="field field-wide">
                  <span>Base currency</span>

                  <select
                    value={baseCurrency}
                    onChange={(event) =>
                      handleCurrencyChange(
                        event.target.value
                      )
                    }
                  >
                    {CURRENCIES.map((item) => (
                      <option
                        key={item.code}
                        value={item.code}
                      >
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>

                  <small>
                    The workspace's primary accounting and
                    display currency.
                  </small>
                </label>

                <label className="field">
                  <span>Currency symbol</span>

                  <input
                    value={currencySymbol}
                    onChange={(event) =>
                      setCurrencySymbol(
                        event.target.value
                      )
                    }
                    placeholder="$"
                  />

                  <small>
                    You can customize this symbol.
                  </small>
                </label>

                <label className="field">
                  <span>Symbol position</span>

                  <select
                    value={symbolPosition}
                    onChange={(event) =>
                      setSymbolPosition(
                        event.target.value as
                          | "before"
                          | "after"
                      )
                    }
                  >
                    <option value="before">
                      Before amount — {currencySymbol} 1,250.00
                    </option>

                    <option value="after">
                      After amount — 1,250.00 {currencySymbol}
                    </option>
                  </select>
                </label>

                <label className="field">
                  <span>Decimal places</span>

                  <select
                    value={decimalPlaces}
                    onChange={(event) =>
                      setDecimalPlaces(
                        Number(event.target.value)
                      )
                    }
                  >
                    <option value={0}>0 — 1,250</option>
                    <option value={1}>1 — 1,250.0</option>
                    <option value={2}>2 — 1,250.00</option>
                    <option value={3}>3 — 1,250.000</option>
                    <option value={4}>4 — 1,250.0000</option>
                  </select>
                </label>

                <label className="field">
                  <span>Thousands separator</span>

                  <select
                    value={thousandsSeparator}
                    onChange={(event) =>
                      setThousandsSeparator(
                        event.target.value
                      )
                    }
                  >
                    <option value=",">
                      Comma — 1,234,567
                    </option>

                    <option value=".">
                      Period — 1.234.567
                    </option>

                    <option value=" ">
                      Space — 1 234 567
                    </option>
                  </select>
                </label>

                <label className="field">
                  <span>Decimal separator</span>

                  <select
                    value={decimalSeparator}
                    onChange={(event) =>
                      setDecimalSeparator(
                        event.target.value
                      )
                    }
                  >
                    <option value=".">
                      Period — 1,234.56
                    </option>

                    <option value=",">
                      Comma — 1.234,56
                    </option>
                  </select>
                </label>
              </div>

              <div className="preview-box">
                <div>
                  <span>Live display preview</span>
                  <strong>
                    {formatPreviewAmount(
                      125000.5,
                      previewSettings
                    )}
                  </strong>
                </div>

                <div className="preview-examples">
                  <span>Example</span>
                  <strong>
                    {formatPreviewAmount(
                      1500,
                      previewSettings
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div className="section-icon">
                  <RefreshCw size={19} />
                </div>

                <div>
                  <span className="section-label">
                    Exchange Rates
                  </span>

                  <h2>Manual Exchange Rates</h2>

                  <p>
                    You control the exchange rate SBS uses
                    for currency conversion. SBS does not
                    automatically override your rate.
                  </p>
                </div>

                <span className="manual-badge">
                  Manual
                </span>
              </div>

              <div className="rate-form">
                <label className="field">
                  <span>From currency</span>

                  <select
                    value={fromCurrency}
                    onChange={(event) =>
                      setFromCurrency(
                        event.target.value
                      )
                    }
                  >
                    {CURRENCIES.map((item) => (
                      <option
                        key={item.code}
                        value={item.code}
                      >
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="swap-button"
                  onClick={swapCurrencies}
                  title="Swap currencies"
                >
                  <RefreshCw size={17} />
                </button>

                <label className="field">
                  <span>To currency</span>

                  <select
                    value={toCurrency}
                    onChange={(event) =>
                      setToCurrency(
                        event.target.value
                      )
                    }
                  >
                    {CURRENCIES.map((item) => (
                      <option
                        key={item.code}
                        value={item.code}
                      >
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Exchange rate</span>

                  <input
                    type="number"
                    min="0.0000000001"
                    step="0.0000000001"
                    value={rateValue}
                    onChange={(event) =>
                      setRateValue(
                        event.target.value
                      )
                    }
                    placeholder="3.6725"
                  />
                </label>

                <label className="field">
                  <span>Notes</span>

                  <input
                    value={rateNotes}
                    onChange={(event) =>
                      setRateNotes(
                        event.target.value
                      )
                    }
                    placeholder="Optional note"
                  />
                </label>

                <button
                  type="button"
                  className="primary-button add-rate-button"
                  onClick={saveExchangeRate}
                  disabled={savingRate}
                >
                  <Plus size={17} />

                  {savingRate
                    ? "Saving..."
                    : "Save Rate"}
                </button>
              </div>

              <div className="rate-example">
                <CircleDollarSign size={17} />

                <span>
                  Example:
                </span>

                <strong>
                  1 {fromCurrency} ={" "}
                  {rateValue || "0"} {toCurrency}
                </strong>
              </div>

              <div className="rate-table-wrapper">
                {rates.length === 0 ? (
                  <div className="empty-rates">
                    <RefreshCw size={24} />

                    <strong>
                      No exchange rates configured
                    </strong>

                    <span>
                      Add a manual currency pair above when
                      your business needs conversion.
                    </span>
                  </div>
                ) : (
                  <div className="rate-table">
                    <div className="rate-table-head">
                      <span>Currency Pair</span>
                      <span>Rate</span>
                      <span>Status</span>
                      <span>Updated</span>
                      <span>Actions</span>
                    </div>

                    {rates.map((rate) => (
                      <div
                        className="rate-row"
                        key={rate.id}
                      >
                        <div className="pair-cell">
                          <strong>
                            {rate.from_currency}
                          </strong>

                          <span>→</span>

                          <strong>
                            {rate.to_currency}
                          </strong>
                        </div>

                        <strong className="rate-value">
                          {rate.rate}
                        </strong>

                        <button
                          type="button"
                          className={`status-button ${
                            rate.is_active
                              ? "active"
                              : "inactive"
                          }`}
                          onClick={() =>
                            toggleRate(rate)
                          }
                        >
                          {rate.is_active
                            ? "Active"
                            : "Disabled"}
                        </button>

                        <span className="updated-cell">
                          {new Date(
                            rate.updated_at
                          ).toLocaleDateString()}
                        </span>

                        <button
                          type="button"
                          className="icon-button danger"
                          onClick={() =>
                            deleteRate(rate)
                          }
                          title="Delete exchange rate"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-header">
                <div className="section-icon">
                  <Clock3 size={19} />
                </div>

                <div>
                  <span className="section-label">
                    Regional Format
                  </span>

                  <h2>Date, Time & Timezone</h2>

                  <p>
                    Control how SBS presents dates and times
                    across the workspace.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <label className="field field-wide">
                  <span>Timezone</span>

                  <select
                    value={timezone}
                    onChange={(event) =>
                      setTimezone(
                        event.target.value
                      )
                    }
                  >
                    {timezones.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Date format</span>

                  <select
                    value={dateFormat}
                    onChange={(event) =>
                      setDateFormat(
                        event.target.value
                      )
                    }
                  >
                    {DATE_FORMATS.map((item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Time format</span>

                  <select
                    value={timeFormat}
                    onChange={(event) =>
                      setTimeFormat(
                        event.target.value as
                          | "12h"
                          | "24h"
                      )
                    }
                  >
                    <option value="12h">
                      12-hour — 2:30 PM
                    </option>

                    <option value="24h">
                      24-hour — 14:30
                    </option>
                  </select>
                </label>
              </div>
            </section>

            <div className="save-bar">
              <div>
                <strong>
                  Ready to save your regional configuration?
                </strong>

                <span>
                  These settings become the workspace defaults
                  for future SBS activity.
                </span>
              </div>

              <button
                type="button"
                className="primary-button save-button"
                onClick={saveRegionalSettings}
                disabled={saving}
              >
                <Save size={17} />

                {saving
                  ? "Saving..."
                  : "Save Regional Settings"}
              </button>
            </div>
          </main>

          <aside className="side-column">
            <section className="side-card current-card">
              <span className="side-label">
                Current Configuration
              </span>

              <div className="current-currency">
                <div className="currency-symbol">
                  {currencySymbol}
                </div>

                <div>
                  <strong>
                    {baseCurrency}
                  </strong>

                  <span>
                    {selectedCurrency.name}
                  </span>
                </div>
              </div>

              <div className="info-list">
                <div>
                  <span>Symbol</span>
                  <strong>{currencySymbol}</strong>
                </div>

                <div>
                  <span>Position</span>
                  <strong>
                    {symbolPosition === "before"
                      ? "Before"
                      : "After"}
                  </strong>
                </div>

                <div>
                  <span>Decimals</span>
                  <strong>{decimalPlaces}</strong>
                </div>

                <div>
                  <span>Timezone</span>
                  <strong>{timezone}</strong>
                </div>

                <div>
                  <span>Exchange rates</span>
                  <strong>Manual</strong>
                </div>
              </div>
            </section>

            <section className="side-card protection-card">
              <div className="protection-icon">
                <Check size={18} />
              </div>

              <div>
                <strong>
                  Historical transactions stay protected
                </strong>

                <p>
                  Changing the current exchange rate will not
                  rewrite historical transaction values or
                  their original conversion rate.
                </p>
              </div>
            </section>

            <section className="side-card">
              <span className="side-label">
                Currency Example
              </span>

              <div className="example-box">
                <span>
                  1 {fromCurrency}
                </span>

                <strong>
                  {rateValue || "0"} {toCurrency}
                </strong>
              </div>

              <p className="side-help">
                Enter the rate according to your business's
                preferred conversion method.
              </p>
            </section>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .regional-page {
          width: 100%;
          max-width: 1480px;
          margin: 0 auto;
          padding-bottom: 40px;
        }

        .back-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 18px;
          padding: 9px 13px;
          border: 1px solid #dfe5eb;
          border-radius: 9px;
          background: #ffffff;
          color: #475569;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .back-button:hover {
          border-color: #b9c5d2;
          color: #166534;
          transform: translateY(-1px);
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 16px;
          margin-bottom: 18px;
          border-radius: 12px;
          border: 1px solid transparent;
          font-size: 13px;
          font-weight: 600;
        }

        .alert.success {
          background: #ecfdf3;
          border-color: #bbf7d0;
          color: #166534;
        }

        .alert.error {
          background: #fff1f2;
          border-color: #fecdd3;
          color: #be123c;
        }

        .alert-icon {
          width: 23px;
          height: 23px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: currentColor;
          color: white;
          font-size: 12px;
          font-weight: 800;
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 26px;
          margin-bottom: 22px;
          border: 1px solid #e4e9ef;
          border-radius: 20px;
          background: linear-gradient(
            135deg,
            #ffffff 0%,
            #f7faff 100%
          );
          box-shadow:
            0 8px 30px rgba(15, 23, 42, 0.045);
        }

        .hero-main {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .hero-icon {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 15px;
          background: #ecfdf3;
          color: #166534;
        }

        .eyebrow {
          display: block;
          margin-bottom: 5px;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h1 {
          margin: 0;
          color: #172033;
          font-size: 28px;
          line-height: 1.2;
          letter-spacing: -0.03em;
        }

        .hero p {
          max-width: 760px;
          margin: 7px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.65;
        }

        .hero p strong {
          color: #334155;
        }

        .hero-currency {
          min-width: 190px;
          padding: 15px 17px;
          border: 1px solid #e3e8ee;
          border-radius: 13px;
          background: #ffffff;
        }

        .hero-currency span,
        .hero-currency small {
          display: block;
          color: #64748b;
          font-size: 11px;
        }

        .hero-currency strong {
          display: block;
          margin: 2px 0;
          color: #172033;
          font-size: 22px;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 310px;
          gap: 20px;
          align-items: start;
        }

        .main-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .side-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .card,
        .side-card {
          border: 1px solid #e5eaf0;
          border-radius: 15px;
          background: #ffffff;
          box-shadow:
            0 5px 20px rgba(15, 23, 42, 0.035);
        }

        .card {
          padding: 21px;
        }

        .side-card {
          padding: 19px;
        }

        .card-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 21px;
        }

        .section-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #f0fdf4;
          color: #166534;
        }

        .section-label,
        .side-label {
          display: block;
          margin-bottom: 4px;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0;
          color: #172033;
          font-size: 17px;
        }

        .card-header p {
          max-width: 720px;
          margin: 5px 0 0;
          color: #718096;
          font-size: 12px;
          line-height: 1.55;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field-wide {
          grid-column: span 2;
        }

        .field > span {
          color: #334155;
          font-size: 12px;
          font-weight: 700;
        }

        .field small {
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.4;
        }

        input,
        select {
          width: 100%;
          min-height: 42px;
          box-sizing: border-box;
          padding: 10px 12px;
          border: 1px solid #dce3ea;
          border-radius: 9px;
          outline: none;
          background: #ffffff;
          color: #172033;
          font-family: inherit;
          font-size: 13px;
          transition: 0.18s ease;
        }

        input:focus,
        select:focus {
          border-color: #86a98f;
          box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
        }

        .preview-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 18px;
          padding: 17px;
          border: 1px dashed #cbd5e1;
          border-radius: 12px;
          background: #f8fafc;
        }

        .preview-box span,
        .preview-examples span {
          display: block;
          color: #64748b;
          font-size: 11px;
        }

        .preview-box strong {
          display: block;
          margin-top: 3px;
          color: #166534;
          font-size: 22px;
        }

        .preview-examples {
          min-width: 150px;
          text-align: right;
        }

        .preview-examples strong {
          font-size: 15px;
          color: #172033;
        }

        .manual-badge {
          margin-left: auto;
          padding: 6px 9px;
          border-radius: 999px;
          background: #ecfdf3;
          color: #166534;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .rate-form {
          display: grid;
          grid-template-columns:
            minmax(145px, 1fr)
            38px
            minmax(145px, 1fr)
            minmax(130px, 0.8fr)
            minmax(150px, 1fr)
            auto;
          gap: 10px;
          align-items: end;
        }

        .swap-button {
          width: 38px;
          height: 42px;
          display: grid;
          place-items: center;
          margin-bottom: 0;
          border: 1px solid #dce3ea;
          border-radius: 9px;
          background: #ffffff;
          color: #64748b;
          cursor: pointer;
        }

        .swap-button:hover {
          color: #166534;
          border-color: #b7c7bb;
        }

        .primary-button {
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 10px 15px;
          border: 1px solid #166534;
          border-radius: 9px;
          background: #166534;
          color: white;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.18s ease;
          white-space: nowrap;
        }

        .primary-button:hover:not(:disabled) {
          background: #14532d;
          transform: translateY(-1px);
        }

        .primary-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .rate-example {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          padding: 11px 13px;
          border-radius: 9px;
          background: #f8fafc;
          color: #64748b;
          font-size: 12px;
        }

        .rate-example svg {
          color: #166534;
        }

        .rate-example strong {
          color: #172033;
        }

        .rate-table-wrapper {
          margin-top: 18px;
          overflow-x: auto;
          border: 1px solid #e5eaf0;
          border-radius: 11px;
        }

        .rate-table {
          min-width: 720px;
        }

        .rate-table-head,
        .rate-row {
          display: grid;
          grid-template-columns:
            1.4fr
            1fr
            0.9fr
            1fr
            65px;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
        }

        .rate-table-head {
          background: #f8fafc;
          border-bottom: 1px solid #e5eaf0;
          color: #64748b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .rate-row {
          border-bottom: 1px solid #eef2f6;
        }

        .rate-row:last-child {
          border-bottom: 0;
        }

        .pair-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #172033;
          font-size: 13px;
        }

        .pair-cell span {
          color: #94a3b8;
        }

        .rate-value {
          color: #166534;
          font-size: 13px;
        }

        .updated-cell {
          color: #64748b;
          font-size: 11px;
        }

        .status-button {
          width: fit-content;
          padding: 5px 9px;
          border: 1px solid transparent;
          border-radius: 999px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .status-button.active {
          background: #ecfdf3;
          border-color: #bbf7d0;
          color: #166534;
        }

        .status-button.inactive {
          background: #f1f5f9;
          border-color: #e2e8f0;
          color: #64748b;
        }

        .icon-button {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          cursor: pointer;
        }

        .icon-button.danger {
          color: #be123c;
        }

        .icon-button.danger:hover {
          background: #fff1f2;
          border-color: #fecdd3;
        }

        .empty-rates {
          min-height: 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          color: #94a3b8;
          text-align: center;
        }

        .empty-rates strong {
          color: #475569;
          font-size: 13px;
        }

        .empty-rates span {
          max-width: 420px;
          font-size: 11px;
        }

        .save-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 17px 19px;
          border: 1px solid #dbe8df;
          border-radius: 13px;
          background: #f6fbf7;
        }

        .save-bar strong,
        .save-bar span {
          display: block;
        }

        .save-bar strong {
          color: #172033;
          font-size: 13px;
        }

        .save-bar span {
          margin-top: 3px;
          color: #64748b;
          font-size: 11px;
        }

        .save-button {
          min-width: 190px;
        }

        .current-card {
          position: sticky;
          top: 20px;
        }

        .current-currency {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 12px 0 18px;
          padding-bottom: 17px;
          border-bottom: 1px solid #edf1f5;
        }

        .currency-symbol {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #ecfdf3;
          color: #166534;
          font-size: 19px;
          font-weight: 800;
        }

        .current-currency strong,
        .current-currency span {
          display: block;
        }

        .current-currency strong {
          color: #172033;
          font-size: 17px;
        }

        .current-currency span {
          margin-top: 2px;
          color: #64748b;
          font-size: 11px;
        }

        .info-list {
          display: flex;
          flex-direction: column;
        }

        .info-list > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 9px 0;
          border-bottom: 1px solid #f0f2f5;
        }

        .info-list > div:last-child {
          border-bottom: 0;
        }

        .info-list span {
          color: #64748b;
          font-size: 11px;
        }

        .info-list strong {
          max-width: 155px;
          overflow: hidden;
          color: #334155;
          font-size: 11px;
          text-align: right;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .protection-card {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          background: #f7fcf8;
          border-color: #dcecdf;
        }

        .protection-icon {
          width: 32px;
          height: 32px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #dcfce7;
          color: #166534;
        }

        .protection-card strong {
          display: block;
          color: #172033;
          font-size: 12px;
        }

        .protection-card p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.55;
        }

        .example-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding: 14px;
          border-radius: 10px;
          background: #f8fafc;
        }

        .example-box span {
          color: #64748b;
          font-size: 12px;
        }

        .example-box strong {
          color: #166534;
          font-size: 13px;
        }

        .side-help {
          margin: 10px 0 0;
          color: #94a3b8;
          font-size: 10px;
          line-height: 1.5;
        }

        @media (max-width: 1250px) {
          .rate-form {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .swap-button {
            display: none;
          }

          .add-rate-button {
            width: 100%;
          }
        }

        @media (max-width: 1050px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .current-card {
            position: static;
          }

          .side-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .side-column .current-card {
            grid-column: span 2;
          }
        }

        @media (max-width: 760px) {
          .hero {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero-currency {
            width: 100%;
            box-sizing: border-box;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .field-wide {
            grid-column: span 1;
          }

          .rate-form {
            grid-template-columns: 1fr;
          }

          .side-column {
            grid-template-columns: 1fr;
          }

          .side-column .current-card {
            grid-column: span 1;
          }

          .save-bar {
            align-items: stretch;
            flex-direction: column;
          }

          .save-button {
            width: 100%;
          }

          .preview-box {
            align-items: flex-start;
            flex-direction: column;
          }

          .preview-examples {
            text-align: left;
          }
        }
      `}</style>
    </AppShell>
  );
}
