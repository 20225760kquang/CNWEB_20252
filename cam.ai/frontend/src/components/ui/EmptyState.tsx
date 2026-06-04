import React from "react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-surface-variant/20 rounded-3xl border border-dashed border-outline-variant/50 ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-surface-variant/50 flex items-center justify-center mb-4">
        <span
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
      {action}
    </div>
  );
}
