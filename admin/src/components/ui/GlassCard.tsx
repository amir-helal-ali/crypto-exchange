"use client";

import { ReactNode } from "react";

interface GlassCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export default function GlassCard({ title, children, className = "", actions }: GlassCardProps) {
  return (
    <div className={`glass-panel rounded-2xl ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between p-5 border-b border-border/30">
          {title && <h3 className="font-bold text-base">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={title || actions ? "" : ""}>{children}</div>
    </div>
  );
}
