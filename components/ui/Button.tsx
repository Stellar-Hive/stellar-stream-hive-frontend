"use client";

import React from "react";
import { Spinner } from "@/components/ui/Spinner";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  isLoading?: boolean;
  children: React.ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
};

/**
 * A reusable button component with primary, secondary, and danger variants,
 * loading state support, and focus-visible styles.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      isLoading = false,
      disabled = false,
      children,
      className = "",
      ...props
    },
    ref,
  ) => {
    const variantClass = VARIANT_CLASSES[variant] ?? "btn-primary";
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${variantClass} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <Spinner size="sm" decorative />
            {typeof children === "string" ? children : <span>{children}</span>}
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
