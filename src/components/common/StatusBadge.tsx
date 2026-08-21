import { AlertCircle, CheckCircle2, MinusCircle, SkipForward } from "lucide-react";
import type { ImportRowStatus } from "@/lib/types";

const CONFIG: Record<
  ImportRowStatus,
  { className: string; Icon: typeof CheckCircle2 }
> = {
  new: { className: "badge-success", Icon: CheckCircle2 },
  existing: { className: "badge-info", Icon: MinusCircle },
  skip: { className: "badge-warning", Icon: SkipForward },
  error: { className: "badge-danger", Icon: AlertCircle },
};

export function StatusBadge({ status, label }: { status: ImportRowStatus; label: string }) {
  const { className, Icon } = CONFIG[status];
  return (
    <span className={className}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
