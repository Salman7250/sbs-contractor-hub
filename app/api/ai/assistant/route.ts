import { GoogleGenAI } from "@google/genai";

const SBS_SYSTEM_INSTRUCTION = `
You are the SBS Assistant for Sharif Business Solutions.

SBS is a business management SaaS platform.

SBS currently includes:

- Dashboard
- Customers
- Quotes / Estimates
- Sales & Orders
- Invoices
- Accounting
- Products
- Serial Numbers
- Inventory
- Warehouses
- Pricing
- Suppliers
- Purchase Orders
- Expenses
- Warranty
- Repairs
- RMA
- Service Providers
- Service Jobs
- B2B Client Portal
- Analytics
- Employees
- Documents
- Settings

Your responsibilities:

1. Explain SBS features and workflows clearly.
2. Help users understand what they can do in the current module.
3. Give practical step-by-step instructions.
4. Use the current page supplied by the application as context.
5. Never claim that you performed an action unless the application actually performed it.
6. Never claim that you changed, created, deleted, updated, or retrieved database information.
7. Do not invent SBS features.
8. If you are unsure whether SBS supports something, say that you are not certain.
9. Keep normal answers concise and useful.
10. When explaining a workflow, use numbered steps when useful.
11. You currently have no permission to modify company data.
`;

const MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

function isTemporaryGeminiError(error: unknown) {
  if (!error) {
    return false;
  }

  const text =
    error instanceof Error
      ? error.message
      : JSON.stringify(error);

  return (
    text.includes("503") ||
    text.includes("UNAVAILABLE") ||
    text.includes("high demand") ||
    text.includes("temporarily unavailable") ||
    text.includes("overloaded") ||
    text.includes("429") ||
    text.includes("RESOURCE_EXHAUSTED")
  );
}

export async function POST(request: Request) {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "[SBS AI] GEMINI_API_KEY is missing.",
      );

      return Response.json(
        {
          error:
            "GEMINI_API_KEY is missing. Check .env.local and restart Next.js.",
        },
        {
          status: 500,
        },
      );
    }

    const body =
      await request.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const pathname =
      typeof body.pathname === "string"
        ? body.pathname
        : "/";

    if (!message) {
      return Response.json(
        {
          error:
            "Message is required.",
        },
        {
          status: 400,
        },
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
The user is currently viewing this SBS page:

${pathname}

User's question:

${message}
`;

    let lastError: unknown = null;

    for (const model of MODELS) {
      try {
        console.log(
          `[SBS AI] Trying model: ${model}`,
        );

        const response =
          await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction:
                SBS_SYSTEM_INSTRUCTION,
            },
          });

        const text =
          response.text?.trim();

        if (!text) {
          throw new Error(
            `${model} returned an empty response.`,
          );
        }

        console.log(
          `[SBS AI] Success with model: ${model}`,
        );

        return Response.json({
          message: text,
          model,
        });
      } catch (error) {
        lastError = error;

        console.error(
          `[SBS AI] ${model} failed:`,
          error,
        );

        if (
          !isTemporaryGeminiError(error)
        ) {
          break;
        }
      }
    }

    console.error(
      "[SBS AI] All Gemini models failed:",
      lastError,
    );

    const errorMessage =
      lastError instanceof Error
        ? lastError.message
        : String(lastError);

    return Response.json(
      {
        error:
          `Gemini is temporarily unavailable. ${errorMessage}`,
      },
      {
        status: 503,
      },
    );
  } catch (error) {
    console.error(
      "[SBS AI] Unexpected error:",
      error,
    );

    const errorMessage =
      error instanceof Error
        ? error.message
        : String(error);

    return Response.json(
      {
        error:
          `SBS Assistant error: ${errorMessage}`,
      },
      {
        status: 500,
      },
    );
  }
}