import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Users, ClipboardList, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayDemands, isLoading: demandsLoading } = trpc.demands.list.useQuery({
    date: today,
  });

  const { data: todayAssignments, isLoading: assignmentsLoading } = trpc.assignments.getByDateRange.useQuery({
    startDate: today,
    endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
  });

  if (demandsLoading || assignmentsLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">儀表板</h1>
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  const confirmedDemands = todayDemands?.filter(d => d.status === "confirmed") || [];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">儀表板</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日需求</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{confirmedDemands.length}</div>
            <p className="text-xs text-muted-foreground">已確認的用工需求</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日排班</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAssignments?.length || 0}</div>
            <p className="text-xs text-muted-foreground">已指派的員工人次</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">需求總人數</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {confirmedDemands.reduce((sum, d) => sum + d.requiredWorkers, 0)}
            </div>
            <p className="text-xs text-muted-foreground">今日所需員工總數</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">指派完成度</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {confirmedDemands.reduce((sum, d) => sum + d.requiredWorkers, 0) > 0
                ? Math.round(
                    ((todayAssignments?.length || 0) /
                      confirmedDemands.reduce((sum, d) => sum + d.requiredWorkers, 0)) *
                      100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">已指派 / 需求人數</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>今日需求列表</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString("zh-TW", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {confirmedDemands.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">今日無需求</div>
            ) : (
              <div className="flex flex-col gap-3">
                {confirmedDemands.map((demand) => {
                  const shortage = demand.requiredWorkers - demand.assignedCount;
                  return (
                    <Link key={demand.id} href={`/demands/${demand.id}`}>
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                        <div className="min-w-0 flex-1 mr-4">
                          <div className="font-medium truncate">{demand.client?.name}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {demand.startTime} - {demand.endTime}
                            {demand.location && ` · ${demand.location}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-sm">
                            <span className="font-medium">{demand.assignedCount}</span>
                            <span className="text-muted-foreground"> / {demand.requiredWorkers}</span>
                          </div>
                          {shortage > 0 ? (
                            <Badge variant="destructive" className="gap-1 whitespace-nowrap">
                              <AlertCircle className="h-3 w-3" />
                              缺 {shortage} 人
                            </Badge>
                          ) : (
                            <Badge variant="default" className="gap-1 whitespace-nowrap">
                              <CheckCircle2 className="h-3 w-3" />
                              已滿
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今日已指派清單</CardTitle>
            <CardDescription>共 {todayAssignments?.length || 0} 筆排班</CardDescription>
          </CardHeader>
          <CardContent>
            {!todayAssignments || todayAssignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">今日無排班</div>
            ) : (
              <div className="flex flex-col gap-3">
                {todayAssignments.slice(0, 10).map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-medium truncate">{assignment.worker?.name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {assignment.demand?.client?.name || "未知客戶"} · {new Date(assignment.scheduledStart).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })} - {new Date(assignment.scheduledEnd).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <Badge variant={assignment.status === "assigned" ? "outline" : "default"} className="shrink-0">
                      {assignment.status === "assigned" && "已指派"}
                      {assignment.status === "completed" && "已完成"}
                      {assignment.status === "cancelled" && "已取消"}
                      {assignment.status === "disputed" && "有爭議"}
                    </Badge>
                  </div>
                ))}
                {todayAssignments.length > 10 && (
                  <div className="text-center pt-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/actual-time">查看全部</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
