"use client";

import {
  Check,
  Copy,
} from "lucide-react";
import { useState } from "react";

export default function CopyDiscountCode({
  code,
}: {
  code: string;
}) {
  const [copied, setCopied] =
    useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        code,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={
        copied
          ? "Copied"
          : "Copy discount code"
      }
      aria-label={
        copied
          ? "Discount code copied"
          : "Copy discount code"
      }
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}