import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  FileText, 
  LogOut 
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { ClientOnboarding } from "@/components/ClientOnboarding";

export function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation();

  // 查詢客戶資料
  const { data: clientData } = trpc.clients.getById.useQuery(
    { id: user?.clientId || 0 },
    { enabled: !!user?.clientId }
  );

  // 查詢 Onboarding 狀態
  const { data: onboardingData } = trpc.auth.onboardingStatus.useQuery(
    undefined,
    { enabled: !!user && user.role === "client" }
  );

  // 當 onboarding 狀態載入後，判斷是否顯示引導
  useEffect(() => {
    if (onboardingData && !onboardingData.onboardingCompleted) {
      setShowOnboarding(true);
    }
  }, [onboardingData]);

  // 如果未登入，重新導向到登入頁面
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = getLoginUrl();
    }
  }, [user, loading]);

  // 如果是 admin 角色，重新導向到內部管理介面
  useEffect(() => {
    if (user && user.role === "admin") {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = getLoginUrl();
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  // 確保是客戶角色
  if (user.role !== "client") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-destructive">您沒有權限訪問此頁面</p>
          <Button className="mt-4" onClick={() => setLocation("/")}>
            返回首頁
          </Button>
        </div>
      </div>
    );
  }

  const navItems = [
    { icon: LayoutDashboard, label: "儀表板", path: "/client-portal/dashboard" },
    { icon: FileText, label: "需求管理", path: "/client-portal/demands" },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Onboarding Modal */}
      {showOnboarding && (
        <ClientOnboarding
          clientName={clientData?.name || ""}
          userName={user.name || ""}
          onComplete={(navigateToDemand) => {
            setShowOnboarding(false);
            if (navigateToDemand) {
              setLocation("/client-portal/demands/create");
            }
          }}
        />
      )}
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-16 items-center border-b px-6">
          <h1 className="text-xl font-bold">{clientData?.name || "客戶入口"}</h1>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-6">
          <div>
            <h2 className="text-lg font-semibold">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            登出
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
