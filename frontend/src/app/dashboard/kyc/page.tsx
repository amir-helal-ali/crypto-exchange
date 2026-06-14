"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  AlertTriangle,
  Camera,
  X,
  Shield,
  User,
  CreditCard,
  Fingerprint,
  CalendarDays,
  FileType,
  FileCheck,
  Info,
  BadgeCheck,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { authGet, authPost, authUpload } from "@/lib/api";

interface KYCData {
  id: number;
  full_name: string;
  document_type: string;
  document_number: string;
  document_url: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason: string;
  created_at: string;
}

export default function KYCPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<KYCData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchKYCStatus();
  }, [router]);

  const fetchKYCStatus = async () => {
    try {
      const res = await authGet("/api/v1/kyc/status");
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setKycStatus(data.data);
          if (data.data.status === "REJECTED") {
            setFullName(data.data.full_name);
            setDocumentType(data.data.document_type);
          }
        }
      }
    } catch {
      // No KYC submitted yet - that's fine
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت");
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("نوع ملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WebP, PDF");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("document", file);

      const res = await authUpload("/api/v1/kyc/upload", formData);

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل رفع الملف");
        return;
      }

      setDocumentUrl(data.url);
      setFileName(file.name);

      // Show preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => setPreviewUrl(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl("");
      }

      toast.success("تم رفع الملف بنجاح");
    } catch {
      toast.error("حدث خطأ في الاتصال أثناء رفع الملف");
    } finally {
      setUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const clearFile = () => {
    setDocumentUrl("");
    setPreviewUrl("");
    setFileName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !documentType || !documentNumber || !documentUrl) {
      toast.error("يرجى ملء جميع الحقول ورفع المستند");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authPost("/api/v1/kyc/submit", {
        full_name: fullName,
        document_type: documentType,
        document_number: documentNumber,
        document_url: documentUrl,
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل تقديم الطلب");
        return;
      }

      toast.success(data.message || "تم تقديم الطلب بنجاح");
      fetchKYCStatus();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  };

  const getDocTypeLabel = (type: string) => {
    switch (type) {
      case "passport": return "جواز سفر";
      case "national_id": return "بطاقة وطنية";
      case "driving_license": return "رخصة قيادة";
      default: return type;
    }
  };

  const statusConfig = {
    PENDING: {
      icon: Clock,
      IconLarge: Shield,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      bgCircle: "bg-gradient-to-br from-yellow-500/20 to-amber-500/20",
      border: "border-yellow-500/20",
      label: "قيد المراجعة",
      description: "طلبك قيد المراجعة من قبل فريقنا. ستتلقى إشعاراً بالنتيجة خلال 24-48 ساعة.",
      glow: "shadow-yellow-500/10",
      statCardColor: "stat-card-yellow",
    },
    APPROVED: {
      icon: CheckCircle,
      IconLarge: ShieldCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      bgCircle: "bg-gradient-to-br from-emerald-500/20 to-teal-500/20",
      border: "border-emerald-500/20",
      label: "تم القبول",
      description: "تم التحقق من هويتك بنجاح. يمكنك الآن استخدام جميع ميزات المنصة.",
      glow: "shadow-emerald-500/10",
      statCardColor: "stat-card-emerald",
    },
    REJECTED: {
      icon: XCircle,
      IconLarge: ShieldAlert,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      label: "مرفوض",
      description: "تم رفض طلبك. يمكنك تقديم طلب جديد بعد تصحيح الملاحظات.",
      glow: "shadow-red-500/10",
      statCardColor: "stat-card-red",
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
        <p className="text-sm text-muted-foreground">جاري التحقق من حالة KYC...</p>
      </div>
    );
  }

  // Show status if KYC is pending or approved
  if (kycStatus && (kycStatus.status === "PENDING" || kycStatus.status === "APPROVED")) {
    const config = statusConfig[kycStatus.status];
    const StatusIcon = config.icon;
    const LargeIcon = config.IconLarge;

    return (
      <div className="space-y-6 max-w-2xl">
        {/* ── Header ── */}
        <div className="animate-slide-in-up">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">التحقق من الهوية (KYC)</h1>
              <p className="text-muted-foreground text-sm mt-0.5">حالة طلب التحقق من هويتك</p>
            </div>
          </div>
        </div>

        {/* ── Status Card ── */}
        <div
          className={`glass-panel rounded-2xl p-8 text-center border animated-border animate-scale-in shadow-xl ${config.glow}`}
          style={{ animationDelay: "100ms" }}
        >
          {/* Large Status Icon */}
          <div className={`w-24 h-24 mx-auto mb-6 rounded-full ${config.bgCircle} flex items-center justify-center`}>
            <LargeIcon className={`h-12 w-12 ${config.color}`} />
          </div>

          {/* Status Label */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            <h2 className="text-2xl font-bold">{config.label}</h2>
          </div>

          <p className="text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
            {config.description}
          </p>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mt-8">
            <div className="bg-background/60 rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-1.5 mb-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">الاسم</p>
              </div>
              <p className="text-sm font-semibold">{kycStatus.full_name}</p>
            </div>
            <div className="bg-background/60 rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">نوع المستند</p>
              </div>
              <p className="text-sm font-semibold">{getDocTypeLabel(kycStatus.document_type)}</p>
            </div>
            <div className="bg-background/60 rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-1.5 mb-2">
                <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">رقم المستند</p>
              </div>
              <p className="text-sm font-semibold font-mono" dir="ltr">
                {kycStatus.document_number.slice(0, 3)}***
              </p>
            </div>
            <div className="bg-background/60 rounded-xl p-4 border border-border/30">
              <div className="flex items-center gap-1.5 mb-2">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">تاريخ التقديم</p>
              </div>
              <p className="text-sm font-semibold">
                {new Date(kycStatus.created_at).toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show form if no KYC submitted or rejected
  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Header ── */}
      <div className="animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">التحقق من الهوية (KYC)</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              يرجى تقديم بياناتك ورفع صورة المستند للتحقق من هويتك
            </p>
          </div>
        </div>
      </div>

      {/* ── Rejection Notice ── */}
      {kycStatus?.status === "REJECTED" && (
        <div
          className="p-5 rounded-2xl bg-red-500/5 border border-red-500/15 animate-scale-in"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-400">تم رفض طلبك السابق</p>
              <p className="text-xs text-muted-foreground mt-0.5">يرجى تصحيح الملاحظات وإعادة التقديم</p>
            </div>
          </div>
          {kycStatus.rejection_reason && (
            <div className="bg-background/50 rounded-xl p-3 border border-border/30 mt-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">السبب: </span>
                {kycStatus.rejection_reason}
              </p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Personal Info Section ── */}
        <div
          className="glass-panel rounded-2xl p-6 space-y-5 animate-slide-in-up"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <User className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-base">البيانات الشخصية</h3>
              <p className="text-xs text-muted-foreground">أدخل بياناتك كما تظهر في المستند</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">الاسم الكامل (كما في المستند)</label>
            <input
              type="text"
              className="input-field"
              placeholder="محمد أحمد علي"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">نوع المستند</label>
              <select
                className="input-field"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                required
              >
                <option value="">اختر نوع المستند</option>
                <option value="passport">جواز سفر</option>
                <option value="national_id">بطاقة وطنية</option>
                <option value="driving_license">رخصة قيادة</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">رقم المستند</label>
              <input
                type="text"
                className="input-field"
                placeholder="A12345678"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                required
                minLength={5}
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* ── Document Upload Section ── */}
        <div
          className="glass-panel rounded-2xl p-6 space-y-5 animate-slide-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Camera className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-base">رفع المستند</h3>
              <p className="text-xs text-muted-foreground">ارفع صورة واضحة وغير مشوشة للمستند</p>
            </div>
          </div>

          {/* File info box */}
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground leading-relaxed">
              <p>يرجى رفع صورة واضحة للمستند. يجب أن تكون الصورة مقروءة وغير مشوشة.</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                <span className="inline-flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-md text-blue-300">
                  <FileType className="h-3 w-3" />
                  JPG, PNG, WebP, PDF
                </span>
                <span className="inline-flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-md text-blue-300">
                  <FileCheck className="h-3 w-3" />
                  الحد الأقصى: 10 ميجابايت
                </span>
              </div>
            </div>
          </div>

          {!documentUrl ? (
            /* Drag-and-drop styled area */
            <label
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all duration-300 ${
                dragOver
                  ? "border-emerald-500/70 bg-emerald-500/10 scale-[1.01]"
                  : "border-border/40 hover:border-emerald-500/50 hover:bg-emerald-500/5"
              }`}
            >
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileInputChange}
                className="hidden"
                disabled={uploading}
              />
              {uploading ? (
                <>
                  <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold mb-1">جاري الرفع...</p>
                  <p className="text-xs text-muted-foreground">يرجى الانتظار حتى اكتمال الرفع</p>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-semibold mb-1">
                    {dragOver ? "أفلت الملف هنا" : "اضغط أو اسحب الملف لرفعه"}
                  </p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP أو PDF — حتى 10 ميجابايت</p>
                </>
              )}
            </label>
          ) : (
            <div className="space-y-3 animate-scale-in">
              {/* Image Preview */}
              {previewUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-border/40 group">
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="w-full max-h-72 object-contain bg-black/20"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button
                    type="button"
                    onClick={clearFile}
                    className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/80 transition-all duration-200 border border-white/10"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                  <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
                    <FileCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs text-white font-medium">{fileName}</span>
                  </div>
                </div>
              ) : (
                /* PDF uploaded state */
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/15 group">
                  <div className="h-14 w-14 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <FileText className="h-7 w-7 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{fileName}</p>
                    <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" />
                      PDF تم رفعه بنجاح
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearFile}
                    className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all duration-200 border border-border/30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Submit Button ── */}
        <div
          className="animate-slide-in-up"
          style={{ animationDelay: "280ms" }}
        >
          <button
            type="submit"
            disabled={submitting || !documentUrl || !fullName || !documentType || !documentNumber}
            className="btn-primary w-full gap-2 py-3.5 text-base"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
            {submitting ? "جاري تقديم الطلب..." : "تقديم طلب التحقق"}
          </button>
        </div>
      </form>
    </div>
  );
}
