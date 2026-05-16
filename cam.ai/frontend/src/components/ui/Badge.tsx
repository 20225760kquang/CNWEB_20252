import React from "react";

type BadgeVariant = "primary" | "secondary" | "success" | "warning" | "danger" | "neutral";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
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

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-0.5 text-xs",
};

export default function Badge({
  children,
  variant = "neutral",
  size = "md",
  className = "",
  icon,
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {icon && (
        <span
          aria-hidden="true"
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
