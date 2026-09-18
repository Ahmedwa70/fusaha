import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CrudActions } from "@/components/shared/crud-actions";
import { dateFormatter } from "@/lib/dashboard/format";

// ============================================================
// TEXT COLUMN (nullable-safe, optional truncate)
// ============================================================
interface TextColumnProps {
  field: string;
  header: string;
  maxLength?: number;
  className?: string;
}

export function createTextColumn<TData>({
  field,
  header,
  maxLength,
  className,
}: TextColumnProps): ColumnDef<TData, unknown> {
  return {
    accessorKey: field,
    header,
    cell: ({ row }) => {
      const raw = row.getValue(field);
      if (raw === null || raw === undefined || raw === "") {
        return <span className="text-muted-foreground">—</span>;
      }
      const value = String(raw);
      const display = maxLength && value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
      return <span className={className}>{display}</span>;
    },
  };
}

// ============================================================
// STATUS COLUMN (active/inactive badge — reuses StatusBadge)
// ============================================================
interface StatusColumnProps {
  field: string;
  header: string;
}

export function createStatusColumn<TData>({ field, header }: StatusColumnProps): ColumnDef<TData, unknown> {
  return {
    accessorKey: field,
    header,
    cell: ({ row }) => <StatusBadge active={row.getValue(field) as boolean} />,
  };
}

// ============================================================
// DATE COLUMN
// ============================================================
interface DateColumnProps {
  field: string;
  header: string;
}

export function createDateColumn<TData>({ field, header }: DateColumnProps): ColumnDef<TData, unknown> {
  return {
    accessorKey: field,
    header,
    cell: ({ row }) => {
      const value = row.getValue(field) as string | Date | null;
      if (!value) return <span className="text-muted-foreground">—</span>;
      const date = typeof value === "string" ? new Date(value) : value;
      return <span className="text-muted-foreground">{dateFormatter.format(date)}</span>;
    },
  };
}

// ============================================================
// BADGE COLUMN (generic label/color variants)
// ============================================================
interface BadgeColumnProps {
  field: string;
  header: string;
  variants: Record<string, { label: string; className: string }>;
}

export function createBadgeColumn<TData>({ field, header, variants }: BadgeColumnProps): ColumnDef<TData, unknown> {
  return {
    accessorKey: field,
    header,
    cell: ({ row }) => {
      const value = row.getValue(field) as string;
      const variant = variants[value];
      return (
        <Badge className={variant?.className ?? "bg-muted text-muted-foreground"}>{variant?.label ?? value}</Badge>
      );
    },
  };
}

// ============================================================
// CRUD ACTIONS COLUMN (show / edit / delete dropdown)
// Uses the shared CrudActions component with row-level callbacks.
// ============================================================
interface CrudActionsColumnProps<TData> {
  onShow: (row: TData) => void;
  onEdit: (row: TData) => void;
  onDelete: (row: TData) => void;
}

export function createCrudActionsColumn<TData>({
  onShow,
  onEdit,
  onDelete,
}: CrudActionsColumnProps<TData>): ColumnDef<TData, unknown> {
  return {
    id: "actions",
    size: 60,
    minSize: 60,
    maxSize: 60,
    enableSorting: false,
    enableHiding: false,
    header: () => null,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <CrudActions
          onShow={() => onShow(row.original)}
          onEdit={() => onEdit(row.original)}
          onDelete={() => onDelete(row.original)}
        />
      </div>
    ),
  };
}
