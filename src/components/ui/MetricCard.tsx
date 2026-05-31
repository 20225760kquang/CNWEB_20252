import React from "react";

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  detail?: string;
  iconClassName?: string;
}

export default function MetricCard({
  icon,
  label,
  value,
  detail,
  iconClassName = "bg-primary/10 text-primary",
}: MetricCardProps) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-outline-variant/30">
      <div className="flex items-start justify-between">
        <span className={`material-symbols-outlined rounded-xl p-2.5 ${iconClassName}`}>
          {icon}
        </span>
        {detail && (
          <span className="text-xs font-semibold text-on-surface-variant">
            {detail}
          </span>
        )}
      </div>
      <p className="mt-5 text-sm text-on-surface-variant">{label}</p>
      <p className="mt-1 text-2xl font-bold text-on-surface">{value}</p>
    </section>
  );
}
