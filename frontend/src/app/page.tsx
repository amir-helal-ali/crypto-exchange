"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Shield, Globe, HeadphonesIcon, Cpu, TrendingUp, Wallet, Users, Menu, X } from "lucide-react";

interface Ad {
  id: number;
  title: string;
  link: string;
  image_url: string;
  position: string;
  active: boolean;
  sort_order: number;
}

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

function AdBanner({ ads }: { ads: Ad[] }) {
  if (ads.length === 0) return null;
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => setCurrent(prev => (prev + 1) % ads.length), 5000);
    return () => clearInterval(timer);
  }, [ads.length]);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="flex transition-transform duration-700 ease-in-out" style={{ transform: `translateX(${current * 100}%)` }}>
        {ads.map(ad => (
          <div key={ad.id} className="min-w-full">
            {ad.image_url ? (
              <a href={ad.link || "#"} target="_blank" rel="noopener noreferrer" className="block">
                <img src={ad.image_url} alt={ad.title} className="w-full h-40 sm:h-48 md:h-64 object-cover rounded-2xl" />
              </a>
            ) : (
              <a href={ad.link || "#"} target="_blank" rel="noopener noreferrer" className="block glass-panel rounded-2xl p-8 md:p-12 text-center">
                <h3 className="text-xl md:text-2xl font-bold gradient-text">{ad.title}</h3>
              </a>
            )}
          </div>
        ))}
      </div>
      {ads.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {ads.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-primary" : "w-2 bg-white/30"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const historyRef = useRef<Record<string, number[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [prices, setPrices] = useState<Record<string, { price: number; high: number; low: number; volume: string; change: string }>>({});
  const [heroAds, setHeroAds] = useState<Ad[]>([]);
  const [sectionAds, setSectionAds] = useState<Ad[]>([]);
  const [bottomAds, setBottomAds] = useState<Ad[]>([]);

  useEffect(() => {
    fetch("https://api.eg-money.local/api/ads")
      .then(res => res.json())
      .then((data: Ad[]) => {
        setHeroAds(data.filter(a => a.active && a.position === "hero"));
        setSectionAds(data.filter(a => a.active && a.position === "section"));
        setBottomAds(data.filter(a => a.active && a.position === "bottom"));
      })
      .catch(() => {});
  }, []);

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
            if (COINS.some(c => c.symbol === s)) {
              setPrices(prev => {
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

      ws.onclose = () => { reconnectTimer = window.setTimeout(connect, 3000); };
      ws.onerror = () => { ws.close(); };
    };

    connect();
    return () => { clearTimeout(reconnectTimer); ws.close(); };
  }, []);

  const drawSparkline = (symbol: string) => {
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
    const coin = COINS.find(c => c.symbol === symbol);
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
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold gradient-text">EgMoney</Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#prices" className="text-sm text-muted-foreground hover:text-foreground transition-colors">الأسعار</a>
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">المميزات</a>
            <a href="#steps" className="text-sm text-muted-foreground hover:text-foreground transition-colors">كيف تبدأ</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">دخول</Link>
            <Link href="/register" className="btn-primary text-sm">إنشاء حساب</Link>
          </div>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="btn-ghost p-2 md:hidden">
            {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl px-4 py-4 space-y-3">
            <a href="#prices" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground hover:text-foreground">الأسعار</a>
            <a href="#features" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground hover:text-foreground">المميزات</a>
            <a href="#steps" onClick={() => setMobileMenu(false)} className="block text-sm text-muted-foreground hover:text-foreground">كيف تبدأ</a>
            <div className="flex gap-3 pt-2">
              <Link href="/login" onClick={() => setMobileMenu(false)} className="btn-ghost text-sm flex-1 text-center">دخول</Link>
              <Link href="/register" onClick={() => setMobileMenu(false)} className="btn-primary text-sm flex-1 text-center">إنشاء حساب</Link>
            </div>
          </div>
        )}
      </header>

      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-20 px-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          {heroAds.length > 0 && (
            <div className="mb-8">
              <AdBanner ads={heroAds} />
            </div>
          )}

          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              بيانات حية من Binance
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6">
              منصة تداول
              <br />
              <span className="gradient-text">عملات رقمية</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 px-2">
              تداول العملات الرقمية بأمان مع بيانات حية من Binance، محفظة آمنة، ودعم عربي كامل
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link href="/register" className="btn-primary text-base sm:text-lg px-8 py-3 gap-2 w-full sm:w-auto justify-center">
                ابدأ التداول مجاناً <ArrowLeft className="h-5 w-5" />
              </Link>
              <Link href="/login" className="btn-ghost text-base sm:text-lg px-8 py-3 w-full sm:w-auto text-center">تسجيل الدخول</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="prices" className="py-12 sm:py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-2">أسعار العملات الرقمية</h2>
          <p className="text-muted-foreground text-center mb-8 max-w-xl mx-auto text-sm sm:text-base">بيانات لحظية مباشرة من Binance</p>
          <div className="glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              {COINS.map((coin) => {
                const p = prices[coin.symbol];
                return (
                  <div key={coin.symbol} className="p-3 sm:p-4 rounded-2xl bg-muted/20 card-hover">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-sm">{coin.arName}</p>
                        <p className="text-[10px] text-muted-foreground">{coin.name}</p>
                      </div>
                      <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: coin.color + "20", color: coin.color }}>
                        {coin.name.charAt(0)}
                      </div>
                    </div>
                    <p className="text-lg sm:text-xl font-bold tabular-nums">{p?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "—"}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs font-medium ${p?.change && parseFloat(p.change) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {p?.change ? `${parseFloat(p.change) >= 0 ? "+" : ""}${p.change}%` : "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{p?.volume ? (parseFloat(p.volume) / 1000).toFixed(0) + "K" : "—"}</span>
                    </div>
                    <canvas ref={(el) => { canvasRefs.current[coin.symbol] = el; if (el && historyRef.current[coin.symbol]?.length > 0) drawSparkline(coin.symbol); }} className="w-full h-12 mt-3 rounded-lg" />
                    <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{coin.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {sectionAds.length > 0 && (
        <section className="py-8 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sectionAds.map(ad => (
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

      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: Cpu, label: "محرك Go", desc: "معالجة سريعة للطلبات" },
              { icon: Shield, label: "أمان", desc: "SSL وتشفير متقدم" },
              { icon: Globe, label: "بيانات Binance", desc: "أسعار حية مباشرة" },
              { icon: Users, label: "دعم عربي", desc: "خدمة عملاء 24/7" },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="glass-panel rounded-2xl p-4 sm:p-6 text-center card-hover">
                  <div className="inline-flex p-2 sm:p-3 rounded-xl bg-primary/10 mb-3 sm:mb-4"><Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /></div>
                  <h3 className="font-bold text-xs sm:text-sm mb-1">{item.label}</h3>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="features" className="py-12 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-2">مميزات المنصة</h2>
          <p className="text-muted-foreground text-center mb-8 sm:mb-12 max-w-xl mx-auto text-sm sm:text-base">كل ما تحتاجه لتداول العملات الرقمية باحترافية</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="glass-panel rounded-2xl p-4 sm:p-6 card-hover">
                  <div className="inline-flex p-2 sm:p-3 rounded-xl bg-primary/10 mb-3 sm:mb-4"><Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /></div>
                  <h3 className="font-bold text-sm sm:text-base mb-1 sm:mb-2">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="steps" className="py-12 sm:py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-2">ابدأ في 3 خطوات</h2>
          <p className="text-muted-foreground text-center mb-8 sm:mb-12 max-w-xl mx-auto text-sm sm:text-base">انضم إلى آلاف المتداولين وابدأ رحلتك الآن</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              { step: "01", title: "إنشاء حساب", desc: "سجل ببريدك الإلكتروني وأنشئ حساباً آمناً" },
              { step: "02", title: "إيداع الأموال", desc: "قم بإيداع العملات الرقمية في محفظتك الآمنة" },
              { step: "03", title: "ابدأ التداول", desc: "تداول أزواج العملات مع بيانات حية وأدوات متقدمة" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 text-primary font-bold text-lg sm:text-xl mb-3 sm:mb-4">{item.step}</div>
                <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2">{item.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {bottomAds.length > 0 && (
        <section className="py-8 px-4">
          <div className="max-w-7xl mx-auto">
            <AdBanner ads={bottomAds} />
          </div>
        </section>
      )}

      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center glass-panel rounded-2xl sm:rounded-3xl p-8 sm:p-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">انضم إلى EgMoney اليوم</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">تداول العملات الرقمية بأمان وثقة مع بيانات حية من Binance</p>
          <Link href="/register" className="btn-primary text-base sm:text-lg px-8 sm:px-10 py-3 gap-2">
            إنشاء حساب مجاني <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/50 py-6 sm:py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-bold gradient-text">EgMoney</span>
          <p className="text-xs text-muted-foreground">© 2024 EgMoney. جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
}
