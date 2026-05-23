import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string;
  colorClass?: string;
}

export function StatCard({ label, value, icon: Icon, subtext, colorClass = "text-primary" }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 transition-all hover:border-primary/40">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 font-display text-3xl font-bold">{value}</div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {subtext && <div className="mt-3 text-xs text-muted-foreground">{subtext}</div>}
    </div>
  );
}
