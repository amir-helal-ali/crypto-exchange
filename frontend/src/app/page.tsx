"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Shield,
  Globe,
  HeadphonesIcon,
  Cpu,
  TrendingUp,
  Wallet,
  Users,
  Menu,
  X,
  XCircle,
  ChevronDown,
  Rocket,
  Lock,
  Zap,
  ArrowUpRight,
  Activity,
  CreditCard,
  Star,
  Twitter,
  MessageCircle,
  Send,
} from "lucide-react";

interface Ad {
  id: number;
  title: string;
  link: string;
  image_url: string;
  button_text: string;
  button_link: string;
  position: string;
  active: boolean;
  sort_order: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const COINS = [
  { symbol: "BTCUSDT", name: "Bitcoin", arName: "بيتكوين", color: "#f7931a", desc: "أول وأكبر عملة رقمية في العالم، المخزن الرقمي الآمن للقيمة." },
  { symbol: "ETHUSDT", name: "Ethereum", arName: "إيثريوم", color: "#627eea", desc: "منصة العقود الذكية الرائدة، تدعم التطبيقات اللامركزية و DeFi." },
  { symbol: "BNBUSDT", name: "BNB", arName: "بي إن بي", color: "#f0b90b", desc: "عملة منصة بينانس، تستخدم للرسوم المخفضة والمشاريع اللامركزية." },
  { symbol: "SOLUSDT", name: "Solana", arName: "سولانا", color: "#9945ff", desc: "بلوكتشين عالي السرعة ومنخفض التكلفة، مثالي للتطبيقات اللامركزية." },
  { symbol: "XRPUSDT", name: "XRP", arName: "إكس آر بي", color: "#00aae4", desc: "حل الدفع الرقمي للتحويلات الدولية السريعة ومنخفضة التكلفة." },
  { symbol: "ADAUSDT", name: "Cardano", arName: "كاردانو", color: "#0033ad", desc: "منصة بلوكتشين مستدامة وقابلة للتطوير، تركز على الأمان والبحث الأكاديمي." },
  { symbol: "DOGEUSDT", name: "Dogecoin", arName: "دوجكوين", color: "#c2a633", desc: "عملة رقمية مجتمعية، بدأت كمزحة وأصبحت ظاهرة عالمية." },
  { symbol: "DOTUSDT", name: "Polkadot", arName: "بولكادوت", color: "#e6007a", desc: "بروتوكول يربط بين سلاسل الكتل المختلفة لتمكين التبادل الآمن للبيانات." },
];

const FEATURES = [
  { icon: TrendingUp, title: "تداول فوري", desc: "نفذ صفقاتك في لحظتها بأسعار السوق الحقيقية من Binance" },
  { icon: Shield, title: "أمان متعدد الطبقات", desc: "تشفير SSL وتخزين بارد للعملات الرقمية لحماية أموالك" },
  { icon: Globe, title: "بيانات حية", desc: "أسعار وأحجام تداول حقيقية من Binance في الوقت الفعلي" },
  { icon: HeadphonesIcon, title: "دعم عربي", desc: "فريق دعم متكامل باللغة العربية على مدار الساعة" },
  { icon: Wallet, title: "محفظة آمنة", desc: "إدارة أصولك الرقمية بسهولة مع محفظة متعددة العملات" },
  { icon: BarChart3, title: "رسوم بيانية متقدمة", desc: "تحليل فني متكامل مع شموع يابانية ومؤشرات Binance" },
];

const STEPS = [
  { step: "01", title: "إنشاء حساب", desc: "سجل ببريدك الإلكتروني وأنشئ حساباً آمناً في أقل من دقيقة", icon: CreditCard },
  { step: "02", title: "إيداع الأموال", desc: "قم بإيداع العملات الرقمية في محفظتك الآمنة بسهولة", icon: Wallet },
  { step: "03", title: "ابدأ التداول", desc: "تداول أزواج العملات مع بيانات حية وأدوات متقدمة", icon: Rocket },
];

const STATS = [
  { value: 12500, suffix: "+", label: "متداول نشط", icon: Users, color: "emerald" },
  { value: 2.8, suffix: "B$", label: "حجم التداول", icon: TrendingUp, color: "blue" },
  { value: 150, suffix: "+", label: "عملات مدعومة", icon: CreditCard, color: "purple" },
  { value: 99.9, suffix: "%", label: "أمان متعدد الطبقات", icon: Lock, color: "orange" },
];

/* ─── Intersection Observer Hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsInView(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

/* ─── Count-Up Hook ─── */
function useCountUp(target: number, duration: number, start: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    let raf: number;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return value;
}

/* ─── Animated Particles Component ─── */
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; opacity: number; color: string }[] = [];
    const colors = ["#10b981", "#14b8a6", "#627eea", "#9945ff", "#f7931a"];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      });

      // Draw lines between close particles
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.globalAlpha = 0.06 * (1 - dist / 150);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ─── Ad Banner Component ─── */
function AdBanner({ ads }: { ads: Ad[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => setCurrent((prev) => (prev + 1) % ads.length), 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (ads.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {ads.map((ad) => (
          <div key={ad.id} className="min-w-full relative">
            {ad.image_url ? (
              <a href={ad.link || "#"} target="_blank" rel="noopener noreferrer" className="block">
                <img src={ad.image_url} alt={ad.title} className="w-full h-40 sm:h-48 md:h-64 object-cover rounded-2xl" />
              </a>
            ) : (
              <div className="glass-panel rounded-2xl p-6 md:p-10 text-center">
                <h3 className="text-lg md:text-2xl font-bold gradient-text mb-3">{ad.title}</h3>
                {ad.button_text && (
                  <a href={ad.button_link || "#"} target="_blank" rel="noopener noreferrer" className="btn-primary gap-2 inline-flex">
                    {ad.button_text} <ArrowLeft className="h-4 w-4" />
                  </a>
                )}
              </div>
            )}
            {ad.button_text && ad.image_url && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <a href={ad.button_link || "#"} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm gap-1">
                  {ad.button_text} <ArrowLeft className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
      {ads.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {ads.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-2 bg-white/30"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Floating Ad Component ─── */
function FloatingAd({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg animate-slide-in-up">
      <div className="glass-panel-strong rounded-2xl p-4 shadow-2xl border-primary/20 relative">
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 shadow-lg hover:bg-red-600 transition-colors"
        >
          <XCircle className="h-5 w-5 text-white" />
        </button>
        <div className="flex items-center gap-4">
          {ad.image_url ? <img src={ad.image_url} alt="" className="h-16 w-24 rounded-xl object-cover shrink-0" /> : null}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold mb-1">{ad.title}</p>
            {ad.button_text && (
              <a href={ad.button_link || "#"} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs gap-1 inline-flex">
                {ad.button_text}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Item Component ─── */
function StatItem({ stat, index }: { stat: typeof STATS[0]; index: number }) {
  const { ref, isInView } = useInView(0.2);
  const count = useCountUp(stat.value, 2000, isInView);
  const Icon = stat.icon;

  const colorMap: Record<string, string> = {
    emerald: "stat-card-emerald",
    blue: "stat-card-blue",
    purple: "stat-card-purple",
    orange: "stat-card-orange",
  };

  const iconColorMap: Record<string, string> = {
    emerald: "text-emerald-500 bg-emerald-500/10",
    blue: "text-blue-500 bg-blue-500/10",
    purple: "text-purple-500 bg-purple-500/10",
    orange: "text-orange-500 bg-orange-500/10",
  };

  const formatValue = (v: number) => {
    if (v >= 1) return Math.floor(v).toLocaleString();
    return v.toFixed(1);
  };

  return (
    <div ref={ref} className={`stat-card ${colorMap[stat.color]} text-center card-hover`} style={{ animationDelay: `${index * 150}ms` }}>
      <div className={`inline-flex p-3 rounded-xl mb-3 ${iconColorMap[stat.color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-3xl sm:text-4xl font-bold tabular-nums">
        {isInView ? formatValue(count) : "0"}
        <span className="gradient-text">{stat.suffix}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
    </div>
  );
}

/* ─── Feature Card Component ─── */
function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const { ref, isInView } = useInView(0.1);
  const Icon = feature.icon;

  return (
    <div
      ref={ref}
      className={`glass-panel-hover animated-border rounded-2xl p-6 ${
        isInView ? "animate-slide-in-up opacity-100" : "opacity-0"
      }`}
      style={{ animationDelay: `${index * 100}ms`, transition: "opacity 0.3s" }}
    >
      <div className="inline-flex p-3 rounded-xl bg-primary/10 mb-4 animate-float" style={{ animationDelay: `${index * 200}ms` }}>
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-bold text-base mb-2">{feature.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
    </div>
  );
}

/* ─── Price Card Component ─── */
function PriceCard({
  coin,
  priceData,
  canvasRef,
  drawSparkline,
}: {
  coin: typeof COINS[0];
  priceData: { price: number; high: number; low: number; volume: string; change: string } | undefined;
  canvasRef: (el: HTMLCanvasElement | null) => void;
  drawSparkline: (symbol: string) => void;
}) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!priceData) return;
    if (prevPriceRef.current !== null && prevPriceRef.current !== priceData.price) {
      setFlash(priceData.price > prevPriceRef.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 600);
      return () => clearTimeout(t);
    }
    prevPriceRef.current = priceData.price;
  }, [priceData?.price]);

  const changeVal = priceData?.change ? parseFloat(priceData.change) : 0;
  const isPositive = changeVal >= 0;

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 card-hover group relative overflow-hidden">
      {/* Glow accent on hover */}
      <div
        className="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, ${coin.color}80, transparent)` }}
      />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ring-2 ring-offset-2 ring-offset-background"
            style={{ backgroundColor: coin.color + "20", color: coin.color, "--tw-ring-color": coin.color + "40" } as React.CSSProperties}
          >
            {coin.name.charAt(0)}
          </div>
          <div>
            <p className="font-bold text-sm">{coin.arName}</p>
            <p className="text-[11px] text-muted-foreground">{coin.name}</p>
          </div>
        </div>
        <div
          className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
            isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
          }`}
        >
          {priceData?.change ? `${isPositive ? "+" : ""}${priceData.change}%` : "—"}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p
            className={`text-xl sm:text-2xl font-bold tabular-nums transition-colors duration-300 ${
              flash === "up" ? "text-emerald-500" : flash === "down" ? "text-red-500" : ""
            }`}
          >
            {priceData?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            حجم: {priceData?.volume ? (parseFloat(priceData.volume) / 1000).toFixed(0) + "K" : "—"}
          </p>
        </div>
        <canvas
          ref={(el) => { canvasRef(el); if (el) drawSparkline(coin.symbol); }}
          className="w-24 h-12 rounded-lg"
        />
      </div>
    </div>
  );
}

/* ─── Main Landing Page ─── */
export default function LandingPage() {
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const historyRef = useRef<Record<string, number[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [prices, setPrices] = useState<Record<string, { price: number; high: number; low: number; volume: string; change: string }>>({});
  const [heroAds, setHeroAds] = useState<Ad[]>([]);
  const [sectionAds, setSectionAds] = useState<Ad[]>([]);
  const [bottomAds, setBottomAds] = useState<Ad[]>([]);
  const [floatingAds, setFloatingAds] = useState<Ad[]>([]);
  const [dismissedFloating, setDismissedFloating] = useState<Set<number>>(new Set());
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("dismissed_ads");
    if (dismissed) {
      try {
        setDismissedFloating(new Set(JSON.parse(dismissed)));
      } catch {}
    }
  }, []);

  useEffect(() => {
    fetch(`${API}/api/v1/ads`)
      .then((res) => res.json())
      .then((data: Ad[]) => {
        setHeroAds(data.filter((a) => a.active && a.position === "hero"));
        setSectionAds(data.filter((a) => a.active && a.position === "section"));
        setBottomAds(data.filter((a) => a.active && a.position === "bottom"));
        setFloatingAds(data.filter((a) => a.active && a.position === "floating"));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const dismissFloatingAd = (id: number) => {
    const next = new Set(dismissedFloating);
    next.add(id);
    setDismissedFloating(next);
    localStorage.setItem("dismissed_ads", JSON.stringify([...next]));
  };

  /* ─── Smooth Scroll ─── */
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  /* ─── WebSocket ─── */
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: number;

    const connect = () => {
      ws = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          data.forEach((t: any) => {
            const s = t.s;
            const price = parseFloat(t.c);
            if (COINS.some((c) => c.symbol === s)) {
              setPrices((prev) => {
                const next = { ...prev };
                next[s] = { price, high: parseFloat(t.h), low: parseFloat(t.l), volume: t.v, change: t.P };
                return next;
              });
              if (!historyRef.current[s]) historyRef.current[s] = [];
              const hist = historyRef.current[s];
              const last = hist[hist.length - 1];
              if (!last || Math.abs(price - last) / last > 0.0001) {
                hist.push(price);
                if (hist.length > 50) hist.shift();
                drawSparkline(s);
              }
            }
          });
        }
      };

      ws.onclose = () => {
        reconnectTimer = window.setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        ws.close();
      };
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      ws.close();
    };
  }, []);

  const drawSparkline = useCallback((symbol: string) => {
    const canvas = canvasRefs.current[symbol];
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = historyRef.current[symbol];
    if (!data || data.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const coin = COINS.find((c) => c.symbol === symbol);
    const color = coin?.color || "#10b981";

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    const step = w / (data.length - 1);
    data.forEach((p, i) => {
      const x = i * step;
      const y = h - ((p - min) / range) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + "40");
    grad.addColorStop(1, color + "05");
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }, []);

  const setCanvasRef = useCallback((symbol: string) => (el: HTMLCanvasElement | null) => {
    canvasRefs.current[symbol] = el;
  }, []);

  const btcPrice = prices["BTCUSDT"];

  return (
    <div className="min-h-screen bg-background overflow-hidden" dir="rtl">
      {/* ═══════════════ HEADER ═══════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "border-b border-border/50 bg-background/90 backdrop-blur-xl shadow-lg shadow-black/5"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">EgMoney</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#prices" className="text-sm text-muted-foreground hover:text-foreground transition-colors">الأسعار</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">المميزات</a>
            <a href="#stats" className="text-sm text-muted-foreground hover:text-foreground transition-colors">الإحصائيات</a>
            <a href="#steps" className="text-sm text-muted-foreground hover:text-foreground transition-colors">كيف تبدأ</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">تسجيل الدخول</Link>
            <Link href="/register" className="btn-primary text-sm gap-2">
              إنشاء حساب <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="btn-ghost p-2 md:hidden">
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-3">
            <a href="#prices" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground hover:text-foreground py-2">الأسعار</a>
            <a href="#features" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground hover:text-foreground py-2">المميزات</a>
            <a href="#stats" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground hover:text-foreground py-2">الإحصائيات</a>
            <a href="#steps" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground hover:text-foreground py-2">كيف تبدأ</a>
            <div className="flex gap-3 pt-2">
              <Link href="/login" onClick={() => setMobileMenu(false)} className="btn-ghost text-sm flex-1 text-center">دخول</Link>
              <Link href="/register" onClick={() => setMobileMenu(false)} className="btn-primary text-sm flex-1 text-center gap-1">
                إنشاء حساب <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Background layers */}
        <ParticleField />
        <div className="absolute inset-0 bg-grid-pattern" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[128px] animate-pulse-glow" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-teal-500/8 rounded-full blur-[100px] animate-pulse-glow delay-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 w-full py-20">
          {heroAds.length > 0 && (
            <div className="mb-8">
              <AdBanner ads={heroAds} />
            </div>
          )}

          <div className="text-center max-w-4xl mx-auto">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium mb-8 animate-slide-in-up">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              بيانات حية من Binance
            </div>

            {/* BTC Price Ticker */}
            {btcPrice && (
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl glass-panel mb-8 animate-scale-in">
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "#f7931a20", color: "#f7931a" }}>
                  B
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">BTC/USDT</span>
                  <span className="text-lg font-bold tabular-nums">
                    {btcPrice.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    parseFloat(btcPrice.change) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                  }`}>
                    {parseFloat(btcPrice.change) >= 0 ? "+" : ""}{btcPrice.change}%
                  </span>
                </div>
                <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
              </div>
            )}

            {/* Main heading */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-slide-in-up" style={{ animationDelay: "100ms" }}>
              منصة تداول
              <br />
              <span className="gradient-text">عملات رقمية</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 px-4 animate-slide-in-up" style={{ animationDelay: "200ms" }}>
              تداول العملات الرقمية بأمان مع بيانات حية من Binance، محفظة آمنة، ودعم عربي كامل
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-in-up" style={{ animationDelay: "300ms" }}>
              <Link href="/register" className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-3.5 gap-2 w-full sm:w-auto justify-center glow-emerald">
                ابدأ التداول مجاناً <ArrowLeft className="h-5 w-5" />
              </Link>
              <a href="#features" className="btn-ghost text-base sm:text-lg px-8 py-3.5 w-full sm:w-auto text-center border border-border/50 rounded-xl">
                اكتشف المميزات
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 animate-fade-in" style={{ animationDelay: "600ms" }}>
              {[
                { icon: Lock, text: "تشفير 256-bit" },
                { icon: Shield, text: "تخزين بارد" },
                { icon: Zap, text: "تنفيذ فوري" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <item.icon className="h-4 w-4 text-emerald-500" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
            <a href="#prices" className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <span className="text-xs">اكتشف المزيد</span>
              <ChevronDown className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════ LIVE PRICES SECTION ═══════════════ */}
      <section id="prices" className="py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-dots-pattern opacity-50" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium mb-4">
              <Activity className="h-3.5 w-3.5" />
              تحديث لحظي
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
              أسعار <span className="gradient-text">العملات الرقمية</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">بيانات لحظية مباشرة من Binance مع تحديثات بالمللي ثانية</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {COINS.map((coin) => (
              <PriceCard
                key={coin.symbol}
                coin={coin}
                priceData={prices[coin.symbol]}
                canvasRef={setCanvasRef(coin.symbol)}
                drawSparkline={drawSparkline}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SECTION ADS ═══════════════ */}
      {sectionAds.length > 0 && (
        <section className="py-8 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sectionAds.map((ad) => (
                <a key={ad.id} href={ad.link || "#"} target="_blank" rel="noopener noreferrer" className="block">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.title} className="w-full h-32 sm:h-40 object-cover rounded-2xl" />
                  ) : (
                    <div className="glass-panel rounded-2xl p-6 text-center">
                      <p className="font-bold gradient-text">{ad.title}</p>
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ FEATURES SECTION ═══════════════ */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <Star className="h-3.5 w-3.5" />
              لماذا EgMoney
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
              مميزات <span className="gradient-text">المنصة</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">كل ما تحتاجه لتداول العملات الرقمية باحترافية وأمان</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {FEATURES.map((feature, i) => (
              <FeatureCard key={i} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ STATS SECTION ═══════════════ */}
      <section id="stats" className="py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
              أرقام <span className="gradient-text">تتحدث</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">ثقة آلاف المتداولين حول العالم العربي</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {STATS.map((stat, i) => (
              <StatItem key={i} stat={stat} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="steps" className="py-16 sm:py-24 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-dots-pattern opacity-30" />
        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <Rocket className="h-3.5 w-3.5" />
              ابدأ الآن
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
              كيف <span className="gradient-text">تبدأ</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">انضم إلى آلاف المتداولين وابدأ رحلتك في 3 خطوات بسيطة</p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Connecting line */}
            <div className="hidden sm:block absolute top-16 right-[calc(16.67%+1.5rem)] left-[calc(16.67%+1.5rem)] h-0.5 bg-gradient-to-l from-emerald-500/30 via-primary/50 to-teal-500/30" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
              {STEPS.map((item, i) => {
                const { ref, isInView } = useInView(0.2);
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    ref={ref}
                    className={`text-center ${isInView ? "animate-slide-in-up" : "opacity-0"}`}
                    style={{ animationDelay: `${i * 200}ms` }}
                  >
                    {/* Step circle */}
                    <div className="relative inline-flex flex-col items-center mb-6">
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-float" style={{ animationDelay: `${i * 300}ms` }}>
                        <Icon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                      </div>
                      <div className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-background border-2 border-primary text-primary text-xs font-bold flex items-center justify-center">
                        {item.step}
                      </div>
                    </div>
                    <h3 className="font-bold text-lg sm:text-xl mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ BOTTOM ADS ═══════════════ */}
      {bottomAds.length > 0 && (
        <section className="py-8 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto">
            <AdBanner ads={bottomAds} />
          </div>
        </section>
      )}

      {/* ═══════════════ CTA SECTION ═══════════════ */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative glass-panel rounded-3xl sm:rounded-[2rem] p-8 sm:p-12 md:p-16 text-center overflow-hidden glow-emerald">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative">
              <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-6 animate-float">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                انضم إلى <span className="gradient-text">EgMoney</span> اليوم
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                تداول العملات الرقمية بأمان وثقة مع بيانات حية من Binance وأدوات تداول متقدمة
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/register" className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-3.5 gap-2 w-full sm:w-auto justify-center glow-emerald">
                  إنشاء حساب مجاني <ArrowLeft className="h-5 w-5" />
                </Link>
                <Link href="/login" className="btn-ghost text-base sm:text-lg px-8 py-3.5 w-full sm:w-auto text-center border border-border/50 rounded-xl">
                  تسجيل الدخول
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FLOATING ADS ═══════════════ */}
      {floatingAds.length > 0 &&
        floatingAds
          .filter((ad) => !dismissedFloating.has(ad.id))
          .slice(0, 1)
          .map((ad) => <FloatingAd key={ad.id} ad={ad} onClose={() => dismissFloatingAd(ad.id)} />)}

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold gradient-text">EgMoney</span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                منصة تداول عملات رقمية عربية آمنة وموثوقة مع بيانات حية من Binance
              </p>
              <div className="flex items-center gap-3">
                <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Twitter className="h-4 w-4" />
                </a>
                <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MessageCircle className="h-4 w-4" />
                </a>
                <a href="#" className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Send className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-sm mb-4">روابط سريعة</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "الأسعار الحية", href: "#prices" },
                  { label: "المميزات", href: "#features" },
                  { label: "كيف تبدأ", href: "#steps" },
                  { label: "الإحصائيات", href: "#stats" },
                ].map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="font-bold text-sm mb-4">الحساب</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "إنشاء حساب", href: "/register" },
                  { label: "تسجيل الدخول", href: "/login" },
                  { label: "المحفظة", href: "/wallet" },
                  { label: "الإعدادات", href: "/settings" },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="font-bold text-sm mb-4">الدعم</h4>
              <ul className="space-y-2.5">
                {[
                  { label: "مركز المساعدة", href: "#" },
                  { label: "الأسئلة الشائعة", href: "#" },
                  { label: "سياسة الخصوصية", href: "#" },
                  { label: "شروط الاستخدام", href: "#" },
                ].map((link, i) => (
                  <li key={i}>
                    <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EgMoney. جميع الحقوق محفوظة</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>مدعوم بـ</span>
              <span className="gradient-text font-bold">Binance</span>
              <span>للبيانات الحية</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
