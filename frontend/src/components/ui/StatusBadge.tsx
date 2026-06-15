"use client";

interface StatusBadgeProps {
  status: string;
  label?: string;
}

const STATUS_MAP: Record<string, { color: string; defaultLabel: string }> = {
  PENDING: { color: "bg-yellow-500/10 text-yellow-500", defaultLabel: "قيد الانتظار" },
  APPROVED: { color: "bg-emerald-500/10 text-emerald-500", defaultLabel: "مقبول" },
  REJECTED: { color: "bg-red-500/10 text-red-500", defaultLabel: "مرفوض" },
  FILLED: { color: "bg-emerald-500/10 text-emerald-500", defaultLabel: "منفذ" },
  CANCELLED: { color: "bg-gray-500/10 text-gray-400", defaultLabel: "ملغي" },
  ACTIVE: { color: "bg-emerald-500/10 text-emerald-500", defaultLabel: "نشط" },
  INACTIVE: { color: "bg-gray-500/10 text-gray-400", defaultLabel: "غير نشط" },
  COMPLETED: { color: "bg-emerald-500/10 text-emerald-500", defaultLabel: "مكتمل" },
  FAILED: { color: "bg-red-500/10 text-red-500", defaultLabel: "فشل" },
  VERIFIED: { color: "bg-emerald-500/10 text-emerald-500", defaultLabel: "موثق" },
  UNVERIFIED: { color: "bg-gray-500/10 text-gray-400", defaultLabel: "غير موثق" },
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const config = STATUS_MAP[status] || { color: "bg-gray-500/10 text-gray-400", defaultLabel: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {label || config.defaultLabel}
    </span>
  );
}
