import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHeader(props: { icon: LucideIcon; title: string; description?: string; actions?: ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1>
          <Icon size={20} strokeWidth={2} />
          {props.title}
        </h1>
        {props.description && <p>{props.description}</p>}
      </div>
      {props.actions && <div className="page-header-actions">{props.actions}</div>}
    </div>
  );
}
