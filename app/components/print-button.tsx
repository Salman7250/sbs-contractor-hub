"use client";

type PrintButtonProps = {
  label?: string;
  className?: string;
};

export default function PrintButton({
  label = "Print",
  className = "secondary-button",
}: PrintButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}