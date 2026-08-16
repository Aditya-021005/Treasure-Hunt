"use client";

import { forwardRef } from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Shows the spinner, swaps the label and blocks further presses. */
  loading?: boolean;
  /** Label shown while loading. Defaults to the idle label. */
  loadingLabel?: string;
  variant?: "solid" | "ghost";
};

/**
 * Every button in the app goes through here, so a press always produces
 * the same feedback: spinner, sweeping progress band, disabled input.
 */
const Btn = forwardRef<HTMLButtonElement, Props>(function Btn(
  {
    loading = false,
    loadingLabel,
    variant = "solid",
    className = "",
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn notch ${variant === "ghost" ? "btn-ghost" : ""} ${
        loading ? "is-loading" : ""
      } ${className}`}
    >
      {loading && <span aria-hidden className="spinner" />}
      <span>{loading ? (loadingLabel ?? children) : children}</span>
    </button>
  );
});

export default Btn;
