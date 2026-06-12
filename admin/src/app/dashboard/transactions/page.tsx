"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Search, Check, X, Copy, CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [txInputs, setTxInputs] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchTransactions = () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    fetch(`${API}/api/admin/transactions?page=${page}&limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        setTransactions(Array.isArray(d) ? d : Array.isArray(d.transactions) ? d.transactions : []);
        if (d.total) setTotalPages(Math.ceil(d.total / 20));
      }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTransactions(); }, [page]);

  const handleReview = async (id: number, status: string) => {
    const token = localStorage.getItem("token");
    setReviewingId(id);
    try {
      const body: any = { status };
      if (status === "COMPLETED" && txInputs[id]) body.tx_id = txInputs[id];
      const res = await fetch(`${API}/api/admin/transactions/${id}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "فشل المراجعة"); return; }
      toast.success(status === "COMPLETED" ? "تمت الموافقة على المعاملة" : "تم رفض المعاملة والمبلغ مسترد");
      fetchTransactions();
    } catch { toast.error("حدث خطأ في الاتصال"); }
    finally { setReviewingId(null); }
  };

  const filtered = transactions.filter(t =>
    t.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
    t.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.currency?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">المعاملات</h1>
        <p className="text-muted-foreground mt-1">إدارة عمليات السحب والإيداع</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="text" className="input-field pr-10" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-right p-4 text-muted-foreground font-medium">المستخدم</th>
                <th className="text-right p-4 text-muted-foreground font-medium">النوع</th>
                <th className="text-right p-4 text-muted-foreground font-medium">العملة</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الكمية</th>
                <th className="text-right p-4 text-muted-foreground font-medium">العنوان</th>
                <th className="text-right p-4 text-muted-foreground font-medium">TxID</th>
                <th className="text-right p-4 text-muted-foreground font-medium">الحالة</th>
                <th className="text-right p-4 text-muted-foreground font-medium">التاريخ</th>
                <th className="text-right p-4 text-muted-foreground font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx: any, i: number) => (
                <tr key={i} className="border-b border-border/20 hover:bg-muted/10 transition-all">
                  <td className="p-4">
                    <div>
                      <p className="font-medium">{tx.user?.username || tx.username || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{tx.user?.email || tx.email || ""}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${tx.type === "DEPOSIT" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                      {tx.type === "DEPOSIT" ? "إيداع" : "سحب"}
                    </span>
                  </td>
                  <td className="p-4 font-medium">{tx.currency}</td>
                  <td className="p-4 tabular-nums">{parseFloat(tx.amount || "0").toFixed(8)}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground max-w-[100px] truncate block">{tx.address || "—"}</span>
                      {tx.address && (
                        <button onClick={() => { navigator.clipboard.writeText(tx.address); setCopiedId(tx.id); setTimeout(() => setCopiedId(null), 2000); }} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                          {copiedId === tx.id ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground max-w-[80px] truncate block">{tx.tx_id || "—"}</span>
                      {tx.tx_id && (
                        <button onClick={() => { navigator.clipboard.writeText(tx.tx_id); setCopiedId(tx.id); setTimeout(() => setCopiedId(null), 2000); }} className="text-muted-foreground hover:text-foreground flex-shrink-0">
                          {copiedId === tx.id ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                      tx.status === "COMPLETED" ? "bg-emerald-500/10 text-emerald-500" :
                      tx.status === "PENDING" ? "bg-yellow-500/10 text-yellow-500" :
                      "bg-red-500/10 text-red-500"
                    }`}>
                      {tx.status === "COMPLETED" ? "مكتمل" : tx.status === "PENDING" ? "قيد الانتظار" : "مرفوض"}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground text-xs">{tx.created_at ? new Date(tx.created_at).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" }) : "—"}</td>
                  <td className="p-4">
                    {tx.status === "PENDING" && tx.type === "WITHDRAWAL" && (
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            className="input-field text-xs py-1 px-2 w-24"
                            placeholder="TxID"
                            value={txInputs[tx.id] || ""}
                            onChange={e => setTxInputs(prev => ({ ...prev, [tx.id]: e.target.value }))}
                          />
                          <div className="flex gap-1">
                            <button onClick={() => handleReview(tx.id, "COMPLETED")} disabled={reviewingId === tx.id} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all disabled:opacity-50" title="موافقة">
                              {reviewingId === tx.id ? <span className="spinner h-3 w-3" /> : <Check className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={() => handleReview(tx.id, "REJECTED")} disabled={reviewingId === tx.id} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all disabled:opacity-50" title="رفض">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">لا توجد معاملات</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${p === page ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
