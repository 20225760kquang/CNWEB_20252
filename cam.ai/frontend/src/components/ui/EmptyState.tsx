import React from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export default function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className = "",
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center bg-surface-variant/20 rounded-3xl border border-dashed border-outline-variant/50 ${compact ? "p-5" : "p-8"} ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-surface-variant/50 flex items-center justify-center mb-4">
        <span
          aria-hidden="true"
          className="material-symbols-outlined text-on-surface-variant"
          style={{ fontSize: "32px" }}
        >
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-medium text-on-surface mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-on-surface-variant max-w-md mb-6">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
