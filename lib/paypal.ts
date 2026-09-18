const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT =
  process.env.PAYPAL_ENVIRONMENT ?? "sandbox";

if (!PAYPAL_CLIENT_ID) {
  throw new Error("Missing PAYPAL_CLIENT_ID");
}

if (!PAYPAL_CLIENT_SECRET) {
  throw new Error("Missing PAYPAL_CLIENT_SECRET");
}

function getPayPalBaseUrl() {
  return PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function getPayPalAccessToken() {
  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `PayPal authentication failed (${response.status}): ${body}`
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!data.access_token) {
    throw new Error(
      "PayPal authentication succeeded but no access token was returned."
    );
  }

  return data.access_token;
}

export async function paypalRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getPayPalAccessToken();

  const headers = new Headers(options.headers);

  headers.set(
    "Authorization",
    `Bearer ${accessToken}`
  );

  headers.set("Content-Type", "application/json");

  headers.set(
    "Accept",
    "application/json"
  );

  const response = await fetch(
    `${getPayPalBaseUrl()}${path}`,
    {
      ...options,
      headers,
      cache: "no-store",
    }
  );

  const responseText = await response.text();

  let data: unknown = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
        ? data.message
        : `PayPal API request failed (${response.status}).`;

    throw new Error(
      `${message} ${JSON.stringify(data)}`
    );
  }

  return data as T;
}

export type PayPalSubscription = {
  id: string;
  plan_id: string;
  status: string;
  status_update_time?: string;
  start_time?: string;
  create_time?: string;
  update_time?: string;
  quantity?: string;
  subscriber?: {
    name?: {
      given_name?: string;
      surname?: string;
    };
    email_address?: string;
    payer_id?: string;
  };
  billing_info?: {
    outstanding_balance?: {
      currency_code?: string;
      value?: string;
    };
    cycle_executions?: Array<{
      tenure_type?: string;
      sequence?: number;
      cycles_completed?: number;
      cycles_remaining?: number;
      current_pricing_scheme_version?: number;
    }>;
    last_payment?: {
      amount?: {
        currency_code?: string;
        value?: string;
      };
      time?: string;
    };
    next_billing_time?: string;
    failed_payments_count?: number;
  };
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
};

export async function getPayPalSubscription(
  subscriptionId: string
) {
  return paypalRequest<PayPalSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId
    )}`,
    {
      method: "GET",
    }
  );
}

export async function cancelPayPalSubscription(
  subscriptionId: string,
  reason: string
) {
  await paypalRequest(
    `/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId
    )}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        reason,
      }),
    }
  );
}

export async function suspendPayPalSubscription(
  subscriptionId: string,
  reason: string
) {
  await paypalRequest(
    `/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId
    )}/suspend`,
    {
      method: "POST",
      body: JSON.stringify({
        reason,
      }),
    }
  );
}

export async function activatePayPalSubscription(
  subscriptionId: string,
  reason: string
) {
  await paypalRequest(
    `/v1/billing/subscriptions/${encodeURIComponent(
      subscriptionId
    )}/activate`,
    {
      method: "POST",
      body: JSON.stringify({
        reason,
      }),
    }
  );
}

export function getPayPalEnvironment() {
  return PAYPAL_ENVIRONMENT;
}