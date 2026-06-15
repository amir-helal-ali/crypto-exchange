"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    try {
      const userData = localStorage.getItem("user");
      if (!userData) {
        router.push("/dashboard");
        return;
      }
      const user = JSON.parse(userData);
      if (user.role !== "ADMIN") {
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);
    } catch {
      router.push("/dashboard");
    } finally {
      setChecking(false);
    }
  }, [router]);

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
        <p className="text-sm text-muted-foreground">جاري التحقق من الصلاحيات...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-scale-in">
        <div className="h-20 w-20 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <ShieldAlert className="h-10 w-10 text-red-500" />
        </div>
        <h2 className="text-xl font-bold">غير مصرح بالوصول</h2>
        <p className="text-sm text-muted-foreground">ليس لديك صلاحيات للوصول إلى لوحة الإدارة</p>
        <button onClick={() => router.push("/dashboard")} className="btn-primary gap-2">
          العودة للوحة التحكم
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
