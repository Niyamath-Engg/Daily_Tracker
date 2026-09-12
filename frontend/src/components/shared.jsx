import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm sm:text-base text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, testid, accent = "text-blue-600" }) {
  return (
    <Card data-testid={testid} className="p-4 sm:p-5 border-slate-200 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        {Icon && <Icon className={cn("h-4 w-4", accent)} />}
      </div>
      <div className="mt-2 text-2xl sm:text-3xl font-bold font-num text-slate-900 tracking-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, description, action, testid }) {
  return (
    <div data-testid={testid} className="flex flex-col items-center justify-center text-center py-14 px-6">
      {Icon && (
        <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-slate-400" />
        </div>
      )}
      <div className="text-slate-900 font-medium">{title}</div>
      {description && <div className="text-sm text-slate-500 mt-1 max-w-sm">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
