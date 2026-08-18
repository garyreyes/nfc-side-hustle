"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  // Only for genuinely irreversible actions (e.g. permanently deleting a
  // plate) — every other action in this app is a single click by design,
  // matching the rest of its confirm-free admin forms. Native
  // window.confirm() rather than a custom modal: this is the only place
  // that needs one, so a whole dialog component would be overkill.
  confirmMessage,
}: {
  children: string;
  pendingLabel?: string;
  className?: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={
        confirmMessage
          ? (e) => {
              if (!window.confirm(confirmMessage)) e.preventDefault();
            }
          : undefined
      }
    >
      {pending ? (pendingLabel ?? `${children}…`) : children}
    </button>
  );
}
