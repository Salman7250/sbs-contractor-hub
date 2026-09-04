import "server-only";

const PAYPAL_ENVIRONMENT =
  process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox";

const PAYPAL_BASE_URL =
  PAYPAL_ENVIRONMENT === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

if (!PAYPAL_CLIENT_ID) {
  throw new Error("Missing PAYPAL_CLIENT_ID environment variable.");
}

if (!PAYPAL_CLIENT_SECRET) {
  throw new Error("Missing PAYPAL_CLIENT_SECRET environment variable.");
}

type PayPalAccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

let cachedToken: {
  accessToken: string;
  expiresAt: number;
} | null = null;

export function getPayPalBaseUrl() {
  return PAYPAL_BASE_URL;
}

export function getPayPalEnvironment() {
  return PAYPAL_ENVIRONMENT;
}

export async function getPayPalAccessToken(): Promise<string> {
  const now = Date.now();

  // Reuse the token while it is still valid.
  // Refresh slightly early to avoid using a token right at expiry.
  if (
    cachedToken &&
    cachedToken.expiresAt > now + 60_000
  ) {
    return cachedToken.accessToken;
  }

  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
        Accept: "application/json",
        "Accept-Language": "en_US",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error("PayPal OAuth error:", {
      status: response.status,
      body: errorText,
    });

    throw new Error(
      `PayPal authentication failed (${response.status}).`
    );
  }

  const data =
    (await response.json()) as PayPalAccessTokenResponse;

  if (!data.access_token) {
    throw new Error(
      "PayPal authentication succeeded but no access token was returned."
    );
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt:
      now + Math.max(data.expires_in - 60, 60) * 1000,
  };

  return data.access_token;
}

type PayPalRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export async function paypalRequest<T>(
  path: string,
  options: PayPalRequestOptions = {}
): Promise<T> {
  const accessToken = await getPayPalAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...options.headers,
  };

  let body: string | undefined;

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(
    `${PAYPAL_BASE_URL}${path}`,
    {
      method: options.method ?? "GET",
      headers,
      body,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error("PayPal API error:", {
      path,
      status: response.status,
      body: errorText,
    });

    throw new Error(
      `PayPal API request failed (${response.status}): ${errorText}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType =
    response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return (await response.text()) as T;
  }

  return (await response.json()) as T;
}