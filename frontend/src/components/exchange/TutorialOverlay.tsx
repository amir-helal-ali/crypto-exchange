"use client";

import { useEffect, useState } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Keyboard,
  Zap,
  Target,
  Shield,
  BarChart3,
  Bell,
} from "lucide-react";

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface TutorialStep {
  title: string;
  description: string;
  icon: typeof Sparkles;
  color: string;
  bg: string;
}

const STORAGE_KEY = "exchange_tutorial_seen";

const STEPS: TutorialStep[] = [
  {
    title: "مرحباً بك في منصة التداول الاحترافية",
    description:
      "منصة تداول متكاملة بمعايير Binance و Bybit. شارت احترافي، مؤشرات متقدمة، أدوات رسم، دفتر أوامر لحظي، وأكثر من 15 أداة تداول مساعدة.",
    icon: Sparkles,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    title: "الشارت الاحترافي",
    description:
      "8 مؤشرات فنية (SMA, EMA, Bollinger, VWAP, RSI, MACD, Stochastic, Ichimoku)، 3 أنواع شارت (شموع، خط، مساحة)، 6 أدوات رسم، تكبير/تصغير، تصدير صورة.",
    icon: BarChart3,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    title: "أنواع الأوامر المتقدمة",
    description:
      "4 أنواع أساسية (سوقي، محدد، وقف محدد، جني أرباح) + أوامر متقدمة (OCO، إيقاف متتبع) + نافذة تأكيد مع SL/TP وإدارة مخاطر.",
    icon: Target,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    title: "أدوات التداول الذكية",
    description:
      "حاسبة P&L، حاسبة حجم المركز (إدارة مخاطر)، تحويل فوري بين الأصول، شراء متكرر (DCA)، حاسبة Pivot Points، تنبيهات أسعار.",
    icon: Shield,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    title: "ذكاء السوق",
    description:
      "مشاعر السوق (شراء/بيع)، التصفيات القسرية اللحظية، المركز المفتوح ومعدل التمويل، المراكز المفتوحة مع P&L، أعلى الرابحين/الخاسرين.",
    icon: Zap,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    title: "اختصارات لوحة المفاتيح",
    description:
      "Ctrl+K بحث سريع، Ctrl+B/S شراء/بيع، Ctrl+M/L نوع الأمر، Ctrl+E لقطة شارت، Ctrl+F ملء الشاشة، Space تبديل الشراء/البيع. استمتع بالتداول!",
    icon: Keyboard,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
];

/**
 * Tutorial Overlay — first-visit introduction to all features.
 *
 * Shows automatically on first visit (when localStorage flag not set).
 * User can navigate step-by-step or skip. Won't show again after completion.
 */
export default function TutorialOverlay({
  open,
  onClose,
}: TutorialOverlayProps) {
  const [step, setStep] = useState(0);

  /* Reset step when opened */
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  /* Handle keyboard navigation */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (step < STEPS.length - 1) setStep(step + 1);
        else handleComplete();
      } else if (e.key === "ArrowLeft") {
        if (step > 0) setStep(step - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  /* Mark tutorial as seen and close */
  const handleComplete = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    onClose();
  };

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
      <div
        className="glass-panel-strong rounded-2xl w-full max-w-lg overflow-hidden border border-primary/30 shadow-2xl animate-slide-in-up"
      >
        {/* Skip button (top-left) */}
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={handleComplete}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-all px-2 py-1 rounded hover:bg-muted/30"
          >
            تخطي
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={handleComplete}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1 pt-4 pb-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-primary"
                  : i < step
                    ? "w-1.5 bg-primary/50"
                    : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="p-6 pt-2 text-center">
          {/* Icon */}
          <div
            className={`h-16 w-16 rounded-2xl ${current.bg} flex items-center justify-center mx-auto mb-4`}
          >
            <Icon className={`h-8 w-8 ${current.color}`} />
          </div>

          {/* Title */}
          <h2 className="text-lg font-bold mb-3">{current.title}</h2>

          {/* Description */}
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-6">
            {current.description}
          </p>

          {/* Step indicator */}
          <div className="text-[10px] text-muted-foreground/60 mb-4">
            {step + 1} / {STEPS.length}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border/20 flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all flex items-center gap-1"
            >
              <ChevronRight className="h-3 w-3" />
              السابق
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={handleComplete}
            className="px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
          >
            تخطي الكل
          </button>
          <button
            onClick={() => {
              if (isLast) handleComplete();
              else setStep(step + 1);
            }}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary hover:brightness-110 transition-all shadow-lg shadow-primary/25 flex items-center gap-1"
          >
            {isLast ? (
              <>
                <Check className="h-3 w-3" />
                ابدأ التداول
              </>
            ) : (
              <>
                التالي
                <ChevronLeft className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if tutorial should auto-show on first visit.
 */
export function useTutorialAutoShow() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        /* Delay slightly so the page loads first */
        const id = setTimeout(() => setShouldShow(true), 800);
        return () => clearTimeout(id);
      }
    } catch {}
  }, []);

  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {}
    setShouldShow(false);
  };

  return { shouldShow, markSeen };
}
