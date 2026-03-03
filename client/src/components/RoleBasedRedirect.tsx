import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { getLoginUrl } from "@/const";

export function RoleBasedRedirect() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // 未登入，跳轉到 Manus OAuth 登入頁面
      window.location.href = getLoginUrl();
      return;
    }

    // 根據使用者角色跳轉到對應的 Dashboard
    if (user.role === "admin" || user.role === "user") {
      setLocation("/dashboard");
    } else if (user.role === "client") {
      setLocation("/client-portal/dashboard");
    } else {
      // 未知角色，跳轉到 404
      setLocation("/404");
    }
  }, [user, loading, setLocation]);

  // 顯示 Loading 畫面
  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
