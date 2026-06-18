"use client";

import { useState, useEffect } from "react";
import {
  CandlestickChart,
  BookOpen,
  ArrowLeftRight,
  ListOrdered,
  Search,
} from "lucide-react";

export type MobileTab = "chart" | "orderbook" | "trade" | "orders";

interface MobileTabBarProps {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  onOpenSearch: () => void;
  openOrdersCount: number;
}

/**
 * Bottom tab bar for mobile view.
 * Switches between Chart / Order Book / Trade / Orders.
 * Hidden on lg+ screens.
 */
export default function MobileTabBar({
  active,
  onChange,
  onOpenSearch,
  openOrdersCount,
}: MobileTabBarProps) {
  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isMobile) return null;

  const tabs: { id: MobileTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "chart", label: "الشارت", icon: <CandlestickChart className="h-4 w-4" /> },
    { id: "orderbook", label: "الطلبات", icon: <BookOpen className="h-4 w-4" /> },
    {
      id: "trade",
      label: "تداول",
      icon: <ArrowLeftRight className="h-4 w-4" />,
    },
    {
      id: "orders",
      label: "أوامري",
      icon: <ListOrdered className="h-4 w-4" />,
      badge: openOrdersCount,
    },
  ];

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-panel-strong border-t border-border/40 backdrop-blur-lg">
      <div className="flex items-center justify-around px-2 py-1.5">
        {/* Search shortcut on the left */}
        <button
          onClick={onOpenSearch}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="بحث سريع"
        >
          <Search className="h-4 w-4" />
          <span className="text-[9px] mt-0.5">بحث</span>
        </button>

        {/* Tabs */}
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
              active === t.id
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            <span className="text-[9px] mt-0.5">{t.label}</span>
            {t.badge && t.badge > 0 ? (
              <span className="absolute top-0 right-2 min-w-[14px] h-[14px] rounded-full bg-primary text-[8px] font-bold flex items-center justify-center text-white px-0.5">
                {t.badge > 99 ? "99+" : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
