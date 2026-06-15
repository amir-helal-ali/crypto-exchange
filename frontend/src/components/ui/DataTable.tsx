"use client";

import { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  pagination,
  onRowClick,
  emptyMessage = "لا توجد بيانات",
}: DataTableProps<T>) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`text-right p-4 text-muted-foreground font-medium ${col.className || ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12">
                  <span className="spinner h-6 w-6 inline-block" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, i) => (
                <tr
                  key={item.id || i}
                  className={`border-b border-border/20 hover:bg-muted/10 transition-all ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`p-4 ${col.className || ""}`}>
                      {col.render
                        ? col.render(item)
                        : (item[col.key] as ReactNode) ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
          <button
            onClick={() => pagination.onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="btn-ghost text-xs disabled:opacity-30"
          >
            السابق
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (pagination.totalPages <= 7) {
                pageNum = i + 1;
              } else if (pagination.page <= 4) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 3) {
                pageNum = pagination.totalPages - 6 + i;
              } else {
                pageNum = pagination.page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => pagination.onPageChange(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    pageNum === pagination.page
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => pagination.onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="btn-ghost text-xs disabled:opacity-30"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}
