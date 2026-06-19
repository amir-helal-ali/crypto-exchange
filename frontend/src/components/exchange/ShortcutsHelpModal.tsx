"use client";

import { useEffect } from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string;
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  /* Trading */
  { keys: "Ctrl+B", description: "تعيين جانب الشراء", category: "التداول" },
  { keys: "Ctrl+S", description: "تعيين جانب البيع", category: "التداول" },
  { keys: "Ctrl+M", description: "نوع الأمر: سوقي", category: "التداول" },
  { keys: "Ctrl+L", description: "نوع الأمر: محدد", category: "التداول" },
  { keys: "Ctrl+Enter", description: "تنفيذ الأمر", category: "التداول" },
  { keys: "Space", description: "تبديل الشراء/البيع", category: "التداول" },

  /* Navigation */
  { keys: "Ctrl+K", description: "بحث سريع عن زوج", category: "التنقل" },
  { keys: "Ctrl+H", description: "خريطة الأسواق الحرارية", category: "التنقل" },
  { keys: "Ctrl+J", description: "فرز الأسواق (Screener)", category: "التنقل" },
  { keys: "Ctrl+W", description: "قوائم المراقبة", category: "التنقل" },

  /* Tools */
  { keys: "Ctrl+V", description: "تحويل فوري بين الأصول", category: "الأدوات" },
  { keys: "Ctrl+E", description: "تصدير صورة الشارت", category: "الأدوات" },
  { keys: "Ctrl+F", description: "ملء الشاشة للشارت", category: "الأدوات" },

  /* Help */
  { keys: "Ctrl+N", description: "صندوق الإشعارات", category: "المساعدة" },
  { keys: "Ctrl+T", description: "دليل الميزات التعليمي", category: "المساعدة" },
  { keys: "Esc", description: "إغلاق النوافذ المنبثقة", category: "المساعدة" },
];

/**
 * Shortcuts Help Modal — comprehensive list of all keyboard shortcuts.
 *
 * Groups shortcuts by category (Trading, Navigation, Tools, Help).
 * Opens via Ctrl+? or by clicking the keyboard icon.
 */
export default function ShortcutsHelpModal({
  open,
  onClose,
}: ShortcutsHelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  /* Group by category */
  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-strong rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden border-2 border-primary/20 shadow-2xl animate-slide-in-up flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/30 bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-white">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-primary">اختصارات لوحة المفاتيح</h3>
              <p className="text-[10px] text-muted-foreground">
                {SHORTCUTS.length} اختصار متاح
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcuts list grouped by category */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {categories.map((category) => (
            <div key={category}>
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                {category}
              </h4>
              <div className="space-y-0.5">
                {SHORTCUTS.filter((s) => s.category === category).map((s, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/10 transition-colors"
                  >
                    <span className="text-[11px] text-muted-foreground">
                      {s.description}
                    </span>
                    <kbd className="px-2 py-0.5 rounded bg-muted/40 border border-border/40 text-[10px] font-bold tabular-nums">
                      {s.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="p-2 border-t border-border/20 bg-muted/5 text-center text-[10px] text-muted-foreground">
          تعمل اختصارات <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30 text-[9px]">Ctrl</kbd> أيضاً مع مفتاح <kbd className="px-1 py-0.5 rounded bg-muted/30 border border-border/30 text-[9px]">⌘</kbd> على نظام Mac
        </div>
      </div>
    </div>
  );
}
