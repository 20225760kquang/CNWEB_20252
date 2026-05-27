import React from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  isLoading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90",
  secondary: "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/90",
  outline: "border border-outline text-primary hover:bg-primary/5",
  danger: "bg-error text-on-error hover:bg-error/90",
  ghost: "text-on-surface-variant hover:bg-surface-variant",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  isLoading,
  fullWidth = false,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const iconName = isLoading ? "progress_activity" : icon;

  return (
    <button
      type={type}
      aria-busy={isLoading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? "w-full" : ""} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {iconName ? (
        <span
          aria-hidden="true"
          className={`material-symbols-outlined ${isLoading ? "animate-spin" : ""}`}
          style={{ fontSize: "20px" }}
        >
          {iconName}
        </span>
      ) : null}
      {children}
    </button>
  );
}
