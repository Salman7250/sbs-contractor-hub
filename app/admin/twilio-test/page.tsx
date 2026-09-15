"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TwilioTestPage() {
  const supabase = useMemo(() => createClient(), []);

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    "🚀 SBS Twilio Test — WhatsApp integration is working!"
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSending(true);
    setResult("");
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session?.access_token) {
        throw new Error("Your SBS session has expired. Please log in again.");
      }

      if (!phone.trim()) {
        throw new Error("Enter a WhatsApp phone number.");
      }

      if (!message.trim()) {
        throw new Error("Enter a message.");
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be logged in to send a test message.");
      }

      const { data: functionData, error: functionError } =
        await supabase.functions.invoke("twilio-whatsapp-sender", {
          body: {
            to: phone.trim(),
            message: message.trim(),
          },
        });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!functionData?.ok) {
        throw new Error(
          functionData?.error || "Twilio failed to send the message."
        );
      }

      setResult(
        `Message sent successfully. Twilio SID: ${
          functionData.sid || "Not returned"
        }`
      );
    } catch (error) {
      console.error("Twilio test error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to send WhatsApp message."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] px-5 py-10 text-gray-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-7">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-emerald-600">
            SBS Developer Test
          </p>

          <h1 className="text-3xl font-extrabold tracking-tight">
            Twilio WhatsApp Test
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Send one test WhatsApp message through the SBS backend.
          </p>
        </div>

        <form
          onSubmit={sendMessage}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-bold text-gray-800">
                WhatsApp Number
              </label>

              <input
                type="text"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+971501234567"
                className="h-11 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />

              <p className="mt-2 text-xs text-gray-400">
                Use the WhatsApp number that has joined your Twilio Sandbox.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold text-gray-800">
                Message
              </label>

              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-gray-300 p-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            {result && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                {result}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send WhatsApp Test"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}