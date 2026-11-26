import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** A card container with shared border, padding, and background styling. */
export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
