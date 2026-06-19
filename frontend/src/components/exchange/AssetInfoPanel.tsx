"use client";

import { useState } from "react";
import {
  Info,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Globe,
  Twitter,
  Github,
  FileText,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  CURRENCY_NAMES,
  CURRENCY_ICONS,
  formatPrice,
  formatVolume,
  pricePrecision,
} from "./constants";
import type { TickerData } from "./types";

/* ═══════════════════════════════════════════
   Asset metadata (static reference data)
   ═══════════════════════════════════════════ */

interface AssetMeta {
  website?: string;
  twitter?: string;
  github?: string;
  whitepaper?: string;
  description: string;
  circulatingSupply: string;
  maxSupply: string;
  rank: number;
  launched: number;
}

const ASSET_META: Record<string, AssetMeta> = {
  BTC: {
    website: "https://bitcoin.org",
    twitter: "https://twitter.com/Bitcoin",
    whitepaper: "https://bitcoin.org/bitcoin.pdf",
    description:
      "بيتكوين هو أول وأكبر عملة رقمية لامركزية في العالم، تعمل على شبكة بلوكتشين نظير إلى نظير دون الحاجة لوسيط مالي. أُطلق عام 2009 من قبل شخص أو مجموعة مجهولة تعرف باسم ساتوشي ناكاموتو، ويُستخدم كأداة لتخزين القيمة ووسيلة للتبادل خارج النظام المالي التقليدي.",
    circulatingSupply: "19.7M BTC",
    maxSupply: "21M BTC",
    rank: 1,
    launched: 2009,
  },
  ETH: {
    website: "https://ethereum.org",
    twitter: "https://twitter.com/ethereum",
    github: "https://github.com/ethereum",
    whitepaper: "https://ethereum.org/en/whitepaper",
    description:
      "إيثريوم هو منصة بلوكتشين مفتوحة المصدر تدعم العقود الذكية والتطبيقات اللامركزية (DApps). أُطلق عام 2015 بواسطة فيتاليك بوتيرين وفريقه، ويُعد الأساس الذي بُنيت عليه معظم مشاريع DeFi وNFT. عملته الأصلية ETH تُستخدم لدفع رسوم المعاملات والتحقق.",
    circulatingSupply: "120M ETH",
    maxSupply: "غير محدود",
    rank: 2,
    launched: 2015,
  },
  BNB: {
    website: "https://www.bnbchain.org",
    twitter: "https://twitter.com/BNBCHAIN",
    description:
      "BNB هي العملة الأصلية لمنصة Binance Chain، تُستخدم لدفع رسوم المعاملات على منصة بينانس والمشاركة في فعاليات المنصة. تُحرق دورياً لتقليل المعروض ورفع قيمتها.",
    circulatingSupply: "147M BNB",
    maxSupply: "200M BNB",
    rank: 3,
    launched: 2017,
  },
  SOL: {
    website: "https://solana.com",
    twitter: "https://twitter.com/solana",
    description:
      "سولانا هي بلوكتشين عالي الأداء يوفر معاملات سريعة وبتكلفة منخفضة، يدعم آلاف المعاملات في الثانية. تُستخدم بشكل واسع في تطبيقات DeFi وNFT بفضل سرعتها وكفاءتها.",
    circulatingSupply: "470M SOL",
    maxSupply: "غير محدود",
    rank: 4,
    launched: 2020,
  },
  XRP: {
    website: "https://xrpl.org",
    twitter: "https://twitter.com/Ripple",
    description:
      "XRP هي العملة الرقمية لشبكة Ripple، مصممة للمدفوعات الدولية السريعة والرخيصة بين المؤسسات المالية. تختلف عن باقي العملات بتركيزها على قطاع البنوك والتحويلات الحدودية.",
    circulatingSupply: "55B XRP",
    maxSupply: "100B XRP",
    rank: 5,
    launched: 2012,
  },
  ADA: {
    website: "https://cardano.org",
    twitter: "https://twitter.com/Cardano_CF",
    description:
      "كاردانو هي منصة بلوكتشين من الجيل الثالث مطورة بنهج علمي محكم. تدعم العقود الذكية والتطبيقات اللامركزية مع تركيز قوي على الأمان والاستدامة والحوكمة.",
    circulatingSupply: "35B ADA",
    maxSupply: "45B ADA",
    rank: 6,
    launched: 2017,
  },
  DOGE: {
    website: "https://dogecoin.com",
    twitter: "https://twitter.com/dogecoin",
    description:
      "دوجكوين بدأت كمزحة على الإنترنت عام 2013 لكنها تطورت لتصبح واحدة من أشهر العملات الرقمية بفضل مجتمعها النشط ودعم المشاهير. تُستخدم للإكراميات والمدفوعات الصغيرة عبر الإنترنت.",
    circulatingSupply: "144B DOGE",
    maxSupply: "غير محدود",
    rank: 7,
    launched: 2013,
  },
  DOT: {
    website: "https://polkadot.network",
    twitter: "https://twitter.com/Polkadot",
    description:
      "بولكادوت هو بروتوكول يربط عدة بلوكتشينات معاً في شبكة موحدة، مما يتيح تبادل البيانات والأصول بينها. طورها غافين وود، أحد مؤسسي إيثريوم.",
    circulatingSupply: "1.4B DOT",
    maxSupply: "غير محدود",
    rank: 8,
    launched: 2020,
  },
};

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

interface AssetInfoPanelProps {
  base: string; // e.g. "BTC"
  pair: string; // e.g. "BTCUSDT"
  ticker?: TickerData;
}

export default function AssetInfoPanel({ base, pair, ticker }: AssetInfoPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = ASSET_META[base];
  const name = CURRENCY_NAMES[base] || base;
  const icon = CURRENCY_ICONS[base] || "●";

  if (!meta) return null;

  const change = ticker?.change ? parseFloat(String(ticker.change)) : 0;
  const isUp = change >= 0;
  const precision = ticker?.price ? pricePrecision(ticker.price) : 2;

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-bold text-xs">معلومات الأصل</h3>
          <span className="text-[10px] text-muted-foreground">
            {name} ({base})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/20 pt-3">
          {/* Asset identity */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center text-2xl font-bold text-primary border border-primary/30">
              {icon}
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm">
                {base}
                <span className="text-muted-foreground text-xs font-normal"> / USDT</span>
              </div>
              <div className="text-[11px] text-muted-foreground">{name}</div>
            </div>
            <div className="text-left">
              <div className={`text-sm font-mono font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                {ticker?.price ? formatPrice(ticker.price) : "—"}
              </div>
              <div className={`text-[10px] flex items-center gap-0.5 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(change).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <Stat label="الترتيب" value={`#${meta.rank}`} />
            <Stat label="سنة الإطلاق" value={String(meta.launched)} />
            <Stat label="المعروض المتداول" value={meta.circulatingSupply} />
            <Stat label="الحد الأقصى" value={meta.maxSupply} />
            <Stat
              label="أعلى 24س"
              value={ticker?.high ? formatPrice(ticker.high) : "—"}
            />
            <Stat
              label="أدنى 24س"
              value={ticker?.low ? formatPrice(ticker.low) : "—"}
            />
            <Stat
              label="حجم التداول 24س"
              value={
                ticker?.quoteVolume
                  ? `$${formatVolume(parseFloat(String(ticker.quoteVolume)))}`
                  : "—"
              }
              full
            />
          </div>

          {/* Description */}
          <div>
            <div className="text-[10px] text-muted-foreground mb-1 font-medium">
              عن المشروع
            </div>
            <p className="text-[11px] leading-relaxed text-foreground/80">
              {meta.description}
            </p>
          </div>

          {/* Useful links */}
          {(meta.website ||
            meta.twitter ||
            meta.github ||
            meta.whitepaper) && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {meta.website && (
                <SocialLink href={meta.website} icon={<Globe className="h-3 w-3" />} label="الموقع" />
              )}
              {meta.whitepaper && (
                <SocialLink href={meta.whitepaper} icon={<FileText className="h-3 w-3" />} label="الورقة البيضاء" />
              )}
              {meta.twitter && (
                <SocialLink href={meta.twitter} icon={<Twitter className="h-3 w-3" />} label="تويتر" />
              )}
              {meta.github && (
                <SocialLink href={meta.github} icon={<Github className="h-3 w-3" />} label="جيت هاب" />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function Stat({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`px-2 py-1.5 rounded-md bg-muted/20 border border-border/10 ${full ? "col-span-2" : ""}`}>
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="font-mono font-medium text-foreground">{value}</div>
    </div>
  );
}

function SocialLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/20 border border-border/20 hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-[10px] transition-all"
    >
      {icon}
      <span>{label}</span>
      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
    </a>
  );
}
