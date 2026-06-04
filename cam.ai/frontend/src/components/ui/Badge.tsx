import React from "react";

type BadgeVariant = "primary" | "secondary" | "success" | "warning" | "danger" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  icon?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-primary text-on-primary",
  secondary: "bg-secondary-container text-on-secondary-container",
  success: "bg-tertiary-container text-on-tertiary-container", // green-ish in some themes
  warning: "bg-accent-orange-alpha text-accent-orange",
  danger: "bg-error-container text-on-error-container",
  neutral: "bg-surface-variant text-on-surface-variant",
};

export default function Badge({ children, variant = "neutral", className = "", icon }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {icon && (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "14px", fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
