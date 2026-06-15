"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Megaphone,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  Upload,
  X,
  Eye,
  ExternalLink,
  Inbox,
  Sparkles,
  Image as ImageIcon,
  Link as LinkIcon,
  Type,
  FileText,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import { authGet, authPost, authPut, authDelete, authUpload } from "@/lib/api";

interface Ad {
  id: number;
  title: string;
  description: string;
  image_url: string;
  link_url: string;
  position: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  created_at: string;
}

const POSITION_OPTIONS = [
  { value: "home_banner", label: "بانر الصفحة الرئيسية" },
  { value: "sidebar", label: "الشريط الجانبي" },
  { value: "popup", label: "نافذة منبثقة" },
  { value: "footer", label: "التذييل" },
  { value: "exchange_top", label: "أعلى صفحة التداول" },
];

export default function AdminAdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [position, setPosition] = useState("home_banner");
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    setLoading(true);
    try {
      const res = await authGet("/api/v1/admin/ads");
      if (res.ok) {
        const data = await res.json();
        setAds(Array.isArray(data.data) ? data.data : []);
      } else {
        toast.error("فشل تحميل الإعلانات");
      }
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setImageUrl("");
    setLinkUrl("");
    setPosition("home_banner");
    setIsActive(true);
    setStartDate("");
    setEndDate("");
    setEditingAd(null);
    setShowForm(false);
  };

  const openEdit = (ad: Ad) => {
    setEditingAd(ad);
    setTitle(ad.title);
    setDescription(ad.description || "");
    setImageUrl(ad.image_url || "");
    setLinkUrl(ad.link_url || "");
    setPosition(ad.position || "home_banner");
    setIsActive(ad.is_active);
    setStartDate(ad.start_date ? ad.start_date.slice(0, 16) : "");
    setEndDate(ad.end_date ? ad.end_date.slice(0, 16) : "");
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await authUpload("/api/v1/admin/ads/upload", formData);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل رفع الصورة");
        return;
      }
      setImageUrl(data.url || data.data?.url || "");
      toast.success("تم رفع الصورة بنجاح");
    } catch {
      toast.error("حدث خطأ أثناء رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("يرجى إدخال عنوان الإعلان");
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        title,
        description,
        image_url: imageUrl,
        link_url: linkUrl,
        position,
        is_active: isActive,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      let res;
      if (editingAd) {
        res = await authPut(`/api/v1/admin/ads/${editingAd.id}`, body);
      } else {
        res = await authPost("/api/v1/admin/ads", body);
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل حفظ الإعلان");
        return;
      }
      toast.success(data.message || `تم ${editingAd ? "تحديث" : "إنشاء"} الإعلان بنجاح`);
      resetForm();
      fetchAds();
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الإعلان؟")) return;
    setDeleting(id);
    try {
      const res = await authDelete(`/api/v1/admin/ads/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل حذف الإعلان");
        return;
      }
      toast.success(data.message || "تم حذف الإعلان بنجاح");
      setAds(prev => prev.filter(a => a.id !== id));
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setDeleting(null);
    }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await authPost("/api/v1/admin/ads/suggest");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "فشل اقتراح الإعلان");
        return;
      }
      const suggestion = data.data || data;
      if (suggestion) {
        setTitle(suggestion.title || "");
        setDescription(suggestion.description || "");
        setImageUrl(suggestion.image_url || "");
        setLinkUrl(suggestion.link_url || "");
        setPosition(suggestion.position || "home_banner");
        setShowForm(true);
      }
      toast.success(data.message || "تم اقتراح إعلان جديد");
    } catch {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setSuggesting(false);
    }
  };

  const getPositionLabel = (pos: string) => {
    const option = POSITION_OPTIONS.find(o => o.value === pos);
    return option?.label || pos;
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-slide-in-up">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Megaphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">إدارة الإعلانات</h1>
            <p className="text-muted-foreground text-sm mt-0.5">إنشاء وتعديل وحذف الإعلانات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="btn-ghost gap-2 text-sm"
          >
            {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            اقتراح إعلان
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="btn-primary gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            إعلان جديد
          </button>
        </div>
      </div>

      {/* ── Create/Edit Form ── */}
      {showForm && (
        <div className="glass-panel rounded-2xl p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                {editingAd ? <Edit3 className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
              </div>
              <h3 className="font-bold">{editingAd ? "تعديل الإعلان" : "إنشاء إعلان جديد"}</h3>
            </div>
            <button onClick={resetForm} className="btn-ghost p-1.5 rounded-lg">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <div className="flex items-center gap-1.5"><Type className="h-3.5 w-3.5 text-muted-foreground" /> عنوان الإعلان *</div>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="عنوان الإعلان"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium mb-2">الموضع</label>
                <select
                  className="input-field"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  {POSITION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <div className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5 text-muted-foreground" /> رابط الإعلان</div>
                </label>
                <input
                  type="url"
                  className="input-field"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  dir="ltr"
                />
              </div>

              {/* Active Status */}
              <div>
                <label className="block text-sm font-medium mb-2">الحالة</label>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsActive(true)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-all duration-200 ${
                      isActive ? "bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20" : "text-muted-foreground hover:bg-muted/20"
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> نشط
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsActive(false)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm transition-all duration-200 ${
                      !isActive ? "bg-red-500/15 text-red-400 font-semibold border border-red-500/20" : "text-muted-foreground hover:bg-muted/20"
                    }`}
                  >
                    <X className="h-3.5 w-3.5" /> معطل
                  </button>
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> تاريخ البدء</div>
                </label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /> تاريخ الانتهاء</div>
                </label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" /> الوصف</div>
              </label>
              <textarea
                className="input-field min-h-[80px] resize-none"
                placeholder="وصف الإعلان..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                <div className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> صورة الإعلان</div>
              </label>
              {imageUrl ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-border/30 max-h-48">
                    <img src={imageUrl} alt="Ad preview" className="w-full object-contain bg-black/10" />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="absolute top-2 left-2 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/80 transition-all duration-200 border border-white/10"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input-field flex-1"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      dir="ltr"
                      placeholder="رابط الصورة"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:border-emerald-500/50 hover:bg-emerald-500/5 ${
                    uploading ? "border-emerald-500/70 bg-emerald-500/10" : "border-border/40"
                  }`}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <>
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
                        <p className="text-sm text-muted-foreground">جاري الرفع...</p>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">اضغط لرفع صورة</p>
                      </>
                    )}
                  </label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>أو أدخل رابط الصورة يدوياً:</span>
                    <input
                      type="url"
                      className="input-field flex-1 text-xs"
                      placeholder="https://example.com/image.jpg"
                      onBlur={(e) => e.target.value && setImageUrl(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || uploading}
                className="btn-primary gap-2 flex-1"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingAd ? "تحديث الإعلان" : "إنشاء الإعلان"}
              </button>
              <button type="button" onClick={resetForm} className="btn-ghost flex-1">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Ads List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">جاري تحميل الإعلانات...</p>
        </div>
      ) : ads.length === 0 ? (
        <div className="glass-panel rounded-2xl flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="h-20 w-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-5">
            <Inbox className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-lg font-bold mb-2">لا توجد إعلانات</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-4">ابدأ بإنشاء إعلان جديد أو اطلب اقتراحاً ذكياً</p>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary gap-2 text-sm">
            <Plus className="h-4 w-4" />
            إنشاء إعلان
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad, i) => (
            <div
              key={ad.id}
              className="glass-panel rounded-2xl overflow-hidden glass-panel-hover animate-slide-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Image */}
              {ad.image_url && (
                <div className="relative h-40 overflow-hidden">
                  <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      ad.is_active
                        ? "bg-emerald-500/90 text-white"
                        : "bg-red-500/90 text-white"
                    }`}>
                      {ad.is_active ? "نشط" : "معطل"}
                    </span>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{ad.title}</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{getPositionLabel(ad.position)}</p>
                  </div>
                  <div className="flex items-center gap-1 mr-2">
                    <button
                      onClick={() => openEdit(ad)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-all duration-200"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(ad.id)}
                      disabled={deleting === ad.id}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                    >
                      {deleting === ad.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {ad.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ad.description}</p>
                )}

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {ad.link_url && (
                    <a
                      href={ad.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      رابط
                    </a>
                  )}
                  {ad.start_date && (
                    <span>{new Date(ad.start_date).toLocaleDateString("ar-EG")}</span>
                  )}
                  {ad.end_date && (
                    <span>→ {new Date(ad.end_date).toLocaleDateString("ar-EG")}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
