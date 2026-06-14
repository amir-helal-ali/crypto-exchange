"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Filter, X, Loader2 } from "lucide-react";
import { authGet, authPost } from "@/lib/api";
import toast from "react-hot-toast";

const STATUS_TABS = [
  { value: "", label: "الكل" },
  { value: "PENDING", label: "معلق" },
  { value: "FILLED", label: "منفذ" },
  { value: "CANCELLED", label: "ملغي" },
  { value: "TRIGGERED", label: "مفعّل" },
];

export default function HistoryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const query = statusFilter ? `?status=${statusFilter}` : "";
      const r = await authGet(`/api/exchange/orders${query}`);
      const d = await r.json();
      setOrders(Array.isArray(d.data) ? d.data : []);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleCancel = async (orderId: number) => {
    try {
      const res = await authPost(`/api/exchange/order/${orderId}/cancel`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل إلغاء الأمر"); return; }
      toast.success(data.message || "تم إلغاء الأمر بنجاح");
      fetchOrders();
    } catch { toast.error("حدث خطأ في الاتصال"); }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "FILLED": return "bg-emerald-500/10 text-emerald-500";
      case "PENDING": return "bg-yellow-500/10 text-yellow-500";
      case "CANCELLED": return "bg-gray-500/10 text-gray-400";
      case "TRIGGERED": return "bg-blue-500/10 text-blue-500";
      default: return "bg-red-500/10 text-red-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "FILLED": return "منفذ";
      case "PENDING": return "معلق";
      case "CANCELLED": return "ملغي";
      case "TRIGGERED": return "مفعّل";
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "MARKET": return "سوقي";
      case "LIMIT": return "محدد";
      case "STOP_LIMIT": return "وقف خسارة";
      case "TAKE_PROFIT": return "جني أرباح";
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">سجل الصفقات</h1>
        <p className="text-muted-foreground mt-1">جميع الصفقات المنفذة والمعلقة</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === tab.value
                ? "bg-primary/10 text-primary font-medium"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-right p-4 text-muted-foreground font-medium">السوق</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">نوع الأمر</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">الاتجاه</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">الكمية</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">سعر الدخول</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">سعر التنفيذ</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">الحالة</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">التاريخ</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order: any, i: number) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-all">
                    <td className="p-4 font-medium">{order.symbol}</td>
                    <td className="p-4 text-muted-foreground">{getTypeLabel(order.type)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 ${order.side === "BUY" ? "text-emerald-500" : "text-red-500"}`}>
                        {order.side === "BUY" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {order.side === "BUY" ? "شراء" : "بيع"}
                      </span>
                    </td>
                    <td className="p-4 tabular-nums">{parseFloat(order.quantity || "0").toFixed(8)}</td>
                    <td className="p-4 tabular-nums">{order.price ? parseFloat(order.price).toFixed(2) : "—"}</td>
                    <td className="p-4 tabular-nums text-emerald-400">{order.avg_fill_price ? parseFloat(order.avg_fill_price).toFixed(2) : "—"}</td>
                    <td className="p-4">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${getStatusStyle(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs">{new Date(order.created_at || order.CreatedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="p-4">
                      {(order.status === "PENDING") && (
                        <button
                          onClick={() => handleCancel(order.id)}
                          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors"
                        >
                          إلغاء
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && orders.length === 0 && <div className="text-center py-12 text-muted-foreground">لا توجد صفقات بعد</div>}
      </div>
    </div>
  );
}
