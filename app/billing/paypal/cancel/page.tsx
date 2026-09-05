export default function PayPalCancelPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">
          PayPal checkout canceled
        </h1>

        <p className="mt-3 text-gray-600">
          No subscription payment was completed. You can return to
          billing and try again whenever you're ready.
        </p>

        <a
          href="/billing"
          className="mt-6 inline-block rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium text-white hover:bg-gray-800"
        >
          Return to Billing
        </a>
      </div>
    </main>
  );
}