"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, Upload, Sparkles, X } from "lucide-react";
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
  { value: "hero", label: "الهيرو (أعلى الصفحة)" },
  { value: "section", label: "قسم داخلي" },
  { value: "bottom", label: "أسفل الصفحة" },
  { value: "floating", label: "عائم (يقبل الإغلاق)" },
];

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

  if (loading) return <div className="flex items-center justify-center py-20"><span className="spinner h-8 w-8" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">إدارة الإعلانات التسويقية</h1>
        <button onClick={() => { setEditing(null); setForm(emptyAd); setShowForm(true); }} className="btn-primary gap-2">
          <Plus className="h-4 w-4" /> إضافة إعلان
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div className="glass-panel-strong rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? "تعديل الإعلان" : "إضافة إعلان جديد"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">العنوان</label>
                <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">الصورة</label>
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
                    <img src={form.image_url} alt="" className="h-20 rounded-xl object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5"><X className="h-3 w-3 text-white" /></button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">الموضع</label>
                  <select className="input-field" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>
                    {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">الترتيب</label>
                  <input type="number" className="input-field" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">الرابط (عند النقر على الإعلان)</label>
                <input className="input-field" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://" />
              </div>

              <div className="border-t border-border/50 pt-4">
                <p className="text-sm font-medium text-muted-foreground mb-3">زر الإجراء (CTA)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">نص الزر</label>
                    <input className="input-field" value={form.button_text} onChange={e => setForm({ ...form, button_text: e.target.value })} placeholder="مثال: ابدأ الآن" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1">رابط الزر</label>
                    <input className="input-field" value={form.button_link} onChange={e => setForm({ ...form, button_link: e.target.value })} placeholder="https://" />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="rounded" />
                <span className="text-sm">نشط</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleSuggest} className="btn-ghost gap-2 text-xs" disabled={suggesting}>
                  <Sparkles className="h-3.5 w-3.5" /> {suggesting ? "جاري التوليد..." : "اقتراح محتوى"}
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="space-y-2 bg-muted/30 rounded-xl p-3">
                  <p className="text-xs font-medium text-muted-foreground">اقتراحات:</p>
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
                <button type="submit" className="btn-primary flex-1">{editing ? "تحديث" : "إضافة"}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground text-xs">
                <th className="text-right p-4">العنوان</th>
                <th className="text-right p-4 hidden md:table-cell">الموضع</th>
                <th className="text-right p-4 hidden md:table-cell">الترتيب</th>
                <th className="text-right p-4">الحالة</th>
                <th className="text-right p-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {ads.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">لا توجد إعلانات. أضف أول إعلان الآن.</td></tr>
              )}
              {ads.map(ad => (
                <tr key={ad.id} className="border-b border-border/20 card-hover">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {ad.image_url && (
                        <img src={ad.image_url} alt="" className="h-10 w-16 rounded-lg object-cover bg-muted" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <div>
                        <p className="font-medium">{ad.title}</p>
                        {ad.button_text && <p className="text-[10px] text-emerald-500">زر: {ad.button_text}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-lg ${ad.position === "floating" ? "bg-purple-500/10 text-purple-500" : "bg-muted/50 text-muted-foreground"}`}>
                      {POSITIONS.find(p => p.value === ad.position)?.label || ad.position}
                    </span>
                  </td>
                  <td className="p-4 hidden md:table-cell text-muted-foreground">{ad.sort_order}</td>
                  <td className="p-4">
                    <button onClick={() => toggleActive(ad)} className="flex items-center gap-1">
                      {ad.active ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-500"><Eye className="h-3 w-3" /> نشط</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><EyeOff className="h-3 w-3" /> مخفي</span>
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(ad)} className="btn-ghost p-1.5 text-xs"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setDeleteTarget(ad.id)} className="btn-ghost p-1.5 text-xs text-red-500 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
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
