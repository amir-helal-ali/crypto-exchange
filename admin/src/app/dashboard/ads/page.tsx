"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, Upload, Sparkles, X, Image, LayoutGrid, ToggleLeft, ToggleRight } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { authGet, authPost, authPut, authDelete, authUpload } from "@/lib/api";

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
  created_at: string;
  updated_at: string;
}

const POSITIONS = [
  { value: "hero", label: "الهيرو (أعلى الصفحة)", icon: "🏠" },
  { value: "section", label: "قسم داخلي", icon: "📄" },
  { value: "bottom", label: "أسفل الصفحة", icon: "⬇️" },
  { value: "floating", label: "عائم (يقبل الإغلاق)", icon: "💬" },
];

const POSITION_COLORS: Record<string, { bg: string; text: string }> = {
  hero: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  section: { bg: "bg-blue-500/10", text: "text-blue-400" },
  bottom: { bg: "bg-orange-500/10", text: "text-orange-400" },
  floating: { bg: "bg-purple-500/10", text: "text-purple-400" },
};

const emptyAd = { title: "", link: "", image_url: "", button_text: "", button_link: "", position: "hero", active: true, sort_order: 0 };

export default function AdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Ad[]>([]);
  const [form, setForm] = useState(emptyAd);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAds = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    try {
      const res = await authGet("/api/v1/admin/ads");
      if (res.ok) {
        const d = await res.json();
        const data = d.data;
        setAds(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAds(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await authUpload("/api/v1/admin/ads/upload", fd);
      if (res.ok) {
        const data = await res.json();
        setForm(prev => ({ ...prev, image_url: data.url }));
        toast.success("تم رفع الصورة");
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل رفع الصورة");
      }
    } catch { toast.error("حدث خطأ في الاتصال"); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestions([]);
    try {
      const res = await authPost("/api/v1/admin/ads/suggest", { topic: form.title || "", position: form.position });
      if (res.ok) {
        const d = await res.json();
        const data = d.data;
        setSuggestions(Array.isArray(data) ? data : []);
      } else {
        toast.error("فشل جلب الاقتراحات");
      }
    } catch { toast.error("حدث خطأ في الاتصال"); }
    setSuggesting(false);
  };

  const applySuggestion = (s: Ad) => {
    setForm(prev => ({
      ...prev,
      title: s.title || prev.title,
      button_text: s.button_text || prev.button_text,
      button_link: s.button_link || prev.button_link,
      position: s.position || prev.position,
    }));
    setSuggestions([]);
    toast.success("تم تطبيق الاقتراح");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localStorage.getItem("token")) return;

    try {
      const res = editing
        ? await authPut(`/api/v1/admin/ads/${editing.id}`, form)
        : await authPost("/api/v1/admin/ads", form);

      if (res.ok) {
        toast.success(editing ? "تم تحديث الإعلان" : "تم إضافة الإعلان");
        setShowForm(false);
        setEditing(null);
        setForm(emptyAd);
        setSuggestions([]);
        fetchAds();
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل العملية");
      }
    } catch { toast.error("حدث خطأ في الاتصال"); }
  };

  const handleDelete = async (id: number) => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await authDelete(`/api/v1/admin/ads/${id}`);
      if (res.ok) {
        toast.success("تم حذف الإعلان");
        fetchAds();
      } else {
        toast.error("فشل الحذف");
      }
    } catch { toast.error("حدث خطأ في الاتصال"); }
  };

  const handleEdit = (ad: Ad) => {
    setEditing(ad);
    setForm({
      title: ad.title,
      link: ad.link,
      image_url: ad.image_url,
      button_text: ad.button_text || "",
      button_link: ad.button_link || "",
      position: ad.position,
      active: ad.active,
      sort_order: ad.sort_order,
    });
    setShowForm(true);
  };

  const toggleActive = async (ad: Ad) => {
    if (!localStorage.getItem("token")) return;
    try {
      const res = await authPut(`/api/v1/admin/ads/${ad.id}`, { ...ad, active: !ad.active });
      if (res.ok) {
        toast.success(ad.active ? "تم إخفاء الإعلان" : "تم تفعيل الإعلان");
        fetchAds();
      } else {
        toast.error("فشل تحديث الحالة");
      }
    } catch { toast.error("حدث خطأ في الاتصال"); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <span className="spinner h-8 w-8" />
          <p className="text-sm text-muted-foreground">جاري تحميل الإعلانات...</p>
        </div>
      </div>
    );
  }

  // Stats
  const activeCount = ads.filter(a => a.active).length;
  const inactiveCount = ads.filter(a => !a.active).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── Header ─── */}
      <div className="animate-slide-in-down">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Image className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold">إدارة الإعلانات</h1>
              <p className="text-sm text-muted-foreground">إنشاء وإدارة الإعلانات التسويقية على المنصة</p>
            </div>
          </div>
          <button onClick={() => { setEditing(null); setForm(emptyAd); setShowForm(true); }} className="btn-primary gap-2">
            <Plus className="h-4 w-4" /> إضافة إعلان
          </button>
        </div>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-3 gap-3 animate-slide-in-up delay-100">
        <div className="stat-card stat-card-emerald">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <LayoutGrid className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ads.length}</p>
              <p className="text-[11px] text-muted-foreground">إجمالي الإعلانات</p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-teal">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10">
              <Eye className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-[11px] text-muted-foreground">نشطة</p>
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-orange">
          <div className="relative z-10 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10">
              <EyeOff className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{inactiveCount}</p>
              <p className="text-[11px] text-muted-foreground">مخفية</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Form Modal ─── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="glass-panel-strong rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  {editing ? <Pencil className="h-4 w-4 text-emerald-500" /> : <Plus className="h-4 w-4 text-emerald-500" />}
                </div>
                {editing ? "تعديل الإعلان" : "إضافة إعلان جديد"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">العنوان</label>
                <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="أدخل عنوان الإعلان" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">الصورة</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                  />
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-ghost gap-2" disabled={uploading}>
                    <Upload className="h-4 w-4" /> {uploading ? "جاري الرفع..." : "رفع صورة"}
                  </button>
                  <span className="text-xs text-muted-foreground">أو</span>
                  <input className="input-field flex-1" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="رابط الصورة" />
                </div>
                {form.image_url && (
                  <div className="relative mt-2 inline-block">
                    <img src={form.image_url} alt="" className="h-20 rounded-xl object-cover border border-border/50" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 shadow-lg"><X className="h-3 w-3 text-white" /></button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">الموضع</label>
                  <select className="input-field" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>
                    {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">الترتيب</label>
                  <input type="number" className="input-field" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">الرابط (عند النقر على الإعلان)</label>
                <input className="input-field" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://" dir="ltr" />
              </div>

              <div className="border-t border-border/50 pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                  زر الإجراء (CTA)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">نص الزر</label>
                    <input className="input-field" value={form.button_text} onChange={e => setForm({ ...form, button_text: e.target.value })} placeholder="مثال: ابدأ الآن" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">رابط الزر</label>
                    <input className="input-field" value={form.button_link} onChange={e => setForm({ ...form, button_link: e.target.value })} placeholder="https://" dir="ltr" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer glass-panel rounded-xl p-3 card-hover">
                <div className={`w-10 h-6 rounded-full transition-all duration-300 flex items-center ${form.active ? 'bg-emerald-500 justify-end' : 'bg-muted/50 justify-start'}`}>
                  <div className="w-5 h-5 rounded-full bg-white shadow-sm mx-0.5 transition-all duration-300" />
                </div>
                <div>
                  <span className="text-sm font-medium">{form.active ? "نشط" : "مخفي"}</span>
                  <p className="text-[10px] text-muted-foreground">تفعيل أو تعطيل عرض الإعلان</p>
                </div>
              </label>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={handleSuggest} className="btn-ghost gap-2 text-xs w-full" disabled={suggesting}>
                  <Sparkles className="h-3.5 w-3.5" /> {suggesting ? "جاري التوليد..." : "اقتراح محتوى بالذكاء الاصطناعي"}
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="space-y-2 bg-muted/20 rounded-xl p-3 border border-border/30">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-emerald-500" />
                    اقتراحات:
                  </p>
                  {suggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => applySuggestion(s)} className="w-full text-right glass-panel rounded-xl p-3 card-hover text-xs">
                      <p className="font-medium text-sm">{s.title}</p>
                      {s.button_text && <p className="text-muted-foreground mt-1">زر: {s.button_text}</p>}
                      {s.position && <p className="text-muted-foreground">الموضع: {POSITIONS.find(p => p.value === s.position)?.label || s.position}</p>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1 gap-2">
                  {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editing ? "تحديث" : "إضافة"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Ads Table ─── */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-in-up delay-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/10">
                <th className="text-right p-4 font-medium text-muted-foreground">الإعلان</th>
                <th className="text-right p-4 font-medium text-muted-foreground hidden md:table-cell">الموضع</th>
                <th className="text-right p-4 font-medium text-muted-foreground hidden md:table-cell">الترتيب</th>
                <th className="text-right p-4 font-medium text-muted-foreground">الحالة</th>
                <th className="text-right p-4 font-medium text-muted-foreground">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {ads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <Image className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">لا توجد إعلانات</p>
                    <p className="text-xs text-muted-foreground/60 mt-1 mb-4">أضف أول إعلان الآن لبدء الترويج على المنصة</p>
                    <button onClick={() => { setEditing(null); setForm(emptyAd); setShowForm(true); }} className="btn-primary gap-2">
                      <Plus className="h-4 w-4" /> إضافة إعلان
                    </button>
                  </td>
                </tr>
              ) : (
                ads.map(ad => {
                  const posColor = POSITION_COLORS[ad.position] || { bg: "bg-muted/30", text: "text-muted-foreground" };
                  const posInfo = POSITIONS.find(p => p.value === ad.position);
                  return (
                    <tr key={ad.id} className="border-b border-border/20 hover:bg-muted/5 transition-all">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {ad.image_url ? (
                            <div className="h-12 w-16 rounded-lg overflow-hidden bg-muted/30 border border-border/30 shrink-0">
                              <img src={ad.image_url} alt="" className="h-full w-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            </div>
                          ) : (
                            <div className="h-12 w-16 rounded-lg bg-muted/20 border border-border/30 flex items-center justify-center shrink-0">
                              <Image className="h-5 w-5 text-muted-foreground/30" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{ad.title}</p>
                            {ad.button_text && (
                              <p className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                                <Sparkles className="h-2.5 w-2.5" />
                                زر: {ad.button_text}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${posColor.bg} ${posColor.text}`}>
                          <span className="text-[11px]">{posInfo?.icon}</span>
                          {posInfo?.label || ad.position}
                        </span>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground font-mono">{ad.sort_order}</span>
                      </td>
                      <td className="p-4">
                        <button onClick={() => toggleActive(ad)} className="flex items-center gap-2 group">
                          {ad.active ? (
                            <div className="flex items-center gap-1.5">
                              <ToggleRight className="h-5 w-5 text-emerald-500 group-hover:text-emerald-400 transition-colors" />
                              <span className="text-xs text-emerald-500 font-medium">نشط</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <ToggleLeft className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                              <span className="text-xs text-muted-foreground font-medium">مخفي</span>
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleEdit(ad)} className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-all" title="تعديل">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(ad.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all" title="حذف">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="حذف الإعلان"
        message="هل أنت متأكد من حذف هذا الإعلان؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
