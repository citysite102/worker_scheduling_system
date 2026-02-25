import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function ClientDashboard() {
  const { data: demandsData, isLoading } = trpc.demands.list.useQuery({});
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <ClientPortalLayout>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="text-muted-foreground">載入中...</p>
          </div>
        </div>
      </ClientPortalLayout>
    );
  }

  const demands = demandsData?.demands || [];
  
  // 統計各狀態的需求單數量
  const pendingCount = demands.filter(d => d.status === "pending").length;
  const confirmedCount = demands.filter(d => d.status === "confirmed").length;
  const assignedCount = demands.filter(d => d.status === "assigned").length;
  const completedCount = demands.filter(d => d.status === "completed").length;

  // 近期需求單（最新 5 筆）
  const recentDemands = demands.slice(0, 5);

  const stats = [
    {
      title: "待審核",
      value: pendingCount,
      icon: AlertCircle,
      description: "等待內部審核的需求單",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "已確認",
      value: confirmedCount,
      icon: Clock,
      description: "已審核通過，待指派員工",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "進行中",
      value: assignedCount,
      icon: FileText,
      description: "已指派員工，進行中",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "已完成",
      value: completedCount,
      icon: CheckCircle2,
      description: "已完成的需求單",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  return (
    <ClientPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">儀表板</h1>
            <p className="text-muted-foreground mt-1">
              {new Date().toLocaleDateString("zh-TW", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </p>
          </div>
          <Link href="/client-portal/demands/new">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              建立需求單
            </Button>
          </Link>
        </div>

        {/* 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className={`rounded-full p-2 ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 近期需求單 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>近期需求單</CardTitle>
              <Link href="/client-portal/demands">
                <Button variant="outline" size="sm">
                  查看全部
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentDemands.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  尚無需求單
                </p>
                <Link href="/client-portal/demands/create">
                  <Button variant="outline" size="sm" className="mt-4">
                    建立第一筆需求單
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentDemands.map((demand) => (
                    <div 
                      key={demand.id}
                      onClick={() => setLocation(`/client-portal/demands/${demand.id}`)}
                      className="flex items-center justify-between rounded-lg border p-5 mb-4 hover:bg-accent hover:shadow-md transition-all cursor-pointer bg-card"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-base">
                            {new Date(demand.date).toLocaleDateString("zh-TW", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                          <span className="text-sm text-muted-foreground font-medium">
                            {demand.startTime} - {demand.endTime}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          需求人數：{demand.requiredWorkers} 人 | 已指派：
                          {demand.assignedCount} 人
                        </p>
                      </div>
                      <div>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            demand.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : demand.status === "confirmed"
                              ? "bg-blue-100 text-blue-800"
                              : demand.status === "assigned"
                              ? "bg-purple-100 text-purple-800"
                              : demand.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {demand.status === "pending"
                            ? "待審核"
                            : demand.status === "confirmed"
                            ? "已確認"
                            : demand.status === "assigned"
                            ? "進行中"
                            : demand.status === "completed"
                            ? "已完成"
                            : demand.status}
                        </span>
                      </div>
                    </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
