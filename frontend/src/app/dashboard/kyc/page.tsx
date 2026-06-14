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
      const res = await authGet("/api/kyc/status");
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setKycStatus(data.data);
          if (data.data.status === "REJECTED") {
            // Allow resubmission on rejection
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

      const res = await authUpload("/api/kyc/upload", formData);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !documentType || !documentNumber || !documentUrl) {
      toast.error("يرجى ملء جميع الحقول ورفع المستند");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authPost("/api/kyc/submit", {
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

  const statusConfig = {
    PENDING: {
      icon: Clock,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      label: "قيد المراجعة",
      description: "طلبك قيد المراجعة من قبل فريقنا. ستتلقى إشعاراً بالنتيجة خلال 24-48 ساعة.",
    },
    APPROVED: {
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      label: "تم القبول",
      description: "تم التحقق من هويتك بنجاح. يمكنك الآن استخدام جميع ميزات المنصة.",
    },
    REJECTED: {
      icon: XCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      label: "مرفوض",
      description: "تم رفض طلبك. يمكنك تقديم طلب جديد بعد تصحيح الملاحظات.",
    },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Show status if KYC is pending or approved
  if (kycStatus && (kycStatus.status === "PENDING" || kycStatus.status === "APPROVED")) {
    const config = statusConfig[kycStatus.status];
    const StatusIcon = config.icon;

    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="h-7 w-7 text-emerald-500" />
            التحقق من الهوية (KYC)
          </h1>
          <p className="text-muted-foreground mt-1">حالة طلب التحقق من هويتك</p>
        </div>

        <div className={`glass-panel rounded-2xl p-8 text-center border ${config.border}`}>
          <div className={`w-20 h-20 mx-auto mb-6 rounded-full ${config.bg} flex items-center justify-center`}>
            <StatusIcon className={`h-10 w-10 ${config.color}`} />
          </div>
          <h2 className="text-2xl font-bold mb-2">{config.label}</h2>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">{config.description}</p>

          <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto mt-6">
            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">الاسم</p>
              <p className="text-sm font-medium">{kycStatus.full_name}</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">نوع المستند</p>
              <p className="text-sm font-medium">
                {kycStatus.document_type === "passport" ? "جواز سفر" :
                 kycStatus.document_type === "national_id" ? "بطاقة وطنية" : "رخصة قيادة"}
              </p>
            </div>
            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">رقم المستند</p>
              <p className="text-sm font-medium font-mono" dir="ltr">{kycStatus.document_number.slice(0, 3)}***</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">تاريخ التقديم</p>
              <p className="text-sm font-medium">{new Date(kycStatus.created_at).toLocaleDateString("ar-EG")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show form if no KYC submitted or rejected
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <FileText className="h-7 w-7 text-emerald-500" />
          التحقق من الهوية (KYC)
        </h1>
        <p className="text-muted-foreground mt-1">
          يرجى تقديم بياناتك ورفع صورة المستند للتحقق من هويتك
        </p>
      </div>

      {/* Rejection notice */}
      {kycStatus?.status === "REJECTED" && (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
          <p className="text-sm text-red-400 flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            تم رفض طلبك السابق
          </p>
          {kycStatus.rejection_reason && (
            <p className="text-sm text-muted-foreground">السبب: {kycStatus.rejection_reason}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Full Name */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-500" />
            البيانات الشخصية
          </h3>

          <div>
            <label className="block text-sm font-medium mb-1.5">الاسم الكامل (كما في المستند)</label>
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
              <label className="block text-sm font-medium mb-1.5">نوع المستند</label>
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
              <label className="block text-sm font-medium mb-1.5">رقم المستند</label>
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

        {/* Document Upload */}
        <div className="glass-panel rounded-2xl p-6 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Camera className="h-5 w-5 text-emerald-500" />
            رفع المستند
          </h3>

          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
            <p className="text-sm text-muted-foreground">
              يرجى رفع صورة واضحة للمستند. يجب أن تكون الصورة مقروءة وغير مشوشة.
              الأنواع المسموحة: JPG, PNG, WebP, PDF — الحد الأقصى: 10 ميجابايت
            </p>
          </div>

          {!documentUrl ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-2xl p-8 cursor-pointer hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors">
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              {uploading ? (
                <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mb-3" />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              )}
              <p className="text-sm font-medium">
                {uploading ? "جاري الرفع..." : "اضغط لرفع المستند"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WebP أو PDF — حتى 10 ميجابايت
              </p>
            </label>
          ) : (
            <div className="space-y-3">
              {/* Preview */}
              {previewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border/50">
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    className="w-full max-h-64 object-contain bg-black/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentUrl("");
                      setPreviewUrl("");
                      setFileName("");
                    }}
                    className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-500/80 transition-colors"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <FileText className="h-8 w-8 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fileName}</p>
                    <p className="text-xs text-muted-foreground">PDF تم رفعه بنجاح</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentUrl("");
                      setPreviewUrl("");
                      setFileName("");
                    }}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !documentUrl || !fullName || !documentType || !documentNumber}
          className="btn-primary w-full gap-2"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          {submitting ? "جاري تقديم الطلب..." : "تقديم طلب التحقق"}
        </button>
      </form>
    </div>
  );
}
