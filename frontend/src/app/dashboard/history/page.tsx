"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function HistoryPage() {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API}/api/exchange/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : Array.isArray(d.orders) ? d.orders : [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">سجل الصفقات</h1>
        <p className="text-muted-foreground mt-1">جميع الصفقات المنفذة والمعلقة</p>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right p-4 text-muted-foreground font-medium">السوق</th>
                <th className="text-right p-4 text-muted-foreground font-medium">النوع</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الاتجاه</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الكمية</th>
                <th className="text-right p-4 text-muted-foreground font-medium">السعر</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الحالة</th>
                <th className="text-right p-4 text-muted-foreground font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: any, i: number) => (
                <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-all">
                  <td className="p-4 font-medium">{order.symbol}</td>
                  <td className="p-4 text-muted-foreground">{order.type}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 ${order.side === "BUY" ? "text-emerald-500" : "text-red-500"}`}>
                      {order.side === "BUY" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {order.side === "BUY" ? "شراء" : "بيع"}
                    </span>
                  </td>
                  <td className="p-4 tabular-nums">{parseFloat(order.quantity || "0").toFixed(8)}</td>
                  <td className="p-4 tabular-nums">{order.price ? parseFloat(order.price).toFixed(8) : "—"}</td>
                  <td className="p-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                      order.status === "FILLED" ? "bg-emerald-500/10 text-emerald-500" :
                      order.status === "OPEN" ? "bg-blue-500/10 text-blue-500" :
                      order.status === "CANCELLED" ? "bg-gray-500/10 text-gray-400" :
                      "bg-red-500/10 text-red-500"
                    }`}>
                      {order.status === "FILLED" ? "منفذ" : order.status === "OPEN" ? "مفتوح" : order.status === "CANCELLED" ? "ملغي" : "مرفوض"}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground text-xs">{new Date(order.created_at || order.CreatedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && <div className="text-center py-12 text-muted-foreground">لا توجد صفقات بعد</div>}
      </div>
    </div>
  );
}
