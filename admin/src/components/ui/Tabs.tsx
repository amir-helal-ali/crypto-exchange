"use client";

import { ReactNode } from "react";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function Tabs({ items, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`tabs-bar ${className}`}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className={`tab-btn ${active === item.id ? "tab-btn-active" : ""}`}
        >
          {item.icon}
          <span>{item.label}</span>
          {item.badge}
        </button>
      ))}
    </div>
  );
}
