import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Users, ClipboardList, Loader2, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

const CHART_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6"];

export default function Dashboard() {
  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const tomorrow = useMemo(() => new Date(today.getTime() + 24 * 60 * 60 * 1000), [today]);

  const { data: todayDemandsData, isLoading: demandsLoading } = trpc.demands.list.useQuery({
    date: today,
  });
  const todayDemands = todayDemandsData?.demands || [];

  // 查詢待審核的需求單
  const { data: pendingDemandsData, isLoading: pendingLoading } = trpc.demands.list.useQuery({
    status: "pending",
  });
  const pendingDemands = pendingDemandsData?.demands || [];

  const { data: todayAssignments, isLoading: assignmentsLoading } = trpc.assignments.getByDateRange.useQuery({
    startDate: today,
    endDate: tomorrow,
  });

  // 圖表資料
  const { data: assignmentTrend } = trpc.dashboard.dailyAssignmentTrend.useQuery({ days: 14 });
  const { data: demandTrend } = trpc.dashboard.clientDemandTrend.useQuery({ days: 14 });
  const { data: clientDistribution } = trpc.dashboard.clientDemandDistribution.useQuery({ days: 30 });

  // 合併趨勢圖表資料 (hooks 必須在 early return 之前)
  const trendData = useMemo(() => {
    if (!assignmentTrend || !demandTrend) return [];
    return assignmentTrend.map((item, i) => ({
      date: item.date.slice(5), // MM-DD
      fullDate: item.date,
      派工人數: item.count,
      需求人數: demandTrend[i]?.count || 0,
    }));
  }, [assignmentTrend, demandTrend]);

  if (demandsLoading || assignmentsLoading || pendingLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">儀表板</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const confirmedDemands = todayDemands.filter((d: any) => d.status === "confirmed");
  const totalRequired = confirmedDemands.reduce((sum: number, d: any) => sum + d.requiredWorkers, 0);
  // 只計算非 cancelled 狀態的指派，避免已取消的指派影響完成度
  const totalAssigned = todayAssignments?.filter(a => a.status !== "cancelled").length || 0;
  const completionRate = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 0;

  const statCards = [
    {
      title: "今日需求",
      value: confirmedDemands.length,
      subtitle: "已確認的用工需求",
      icon: ClipboardList,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      title: "今日排班",
      value: totalAssigned,
      subtitle: "已指派的員工人次",
      icon: Users,
      accent: "bg-indigo-50 text-indigo-600",
    },
    {
      title: "需求總人數",
      value: totalRequired,
      subtitle: "今日所需員工總數",
      icon: Users,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      title: "指派完成度",
      value: `${completionRate}%`,
      subtitle: "已指派 / 需求人數",
      icon: TrendingUp,
      accent: completionRate >= 80 ? "bg-emerald-50 text-emerald-600" : completionRate >= 50 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-500",
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">儀表板</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="shadow-md border-border/40 hover:shadow-lg transition-all hover:border-accent/30">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{stat.title}</span>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${stat.accent} transition-transform hover:scale-110`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="text-3xl font-bold tracking-tight mb-1">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 圖表區域 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 每日派工 vs 需求趨勢 */}
        <Card className="shadow-md border-border/40 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">近兩週派工與需求趨勢</CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                    labelFormatter={(label) => {
                      const item = trendData.find(d => d.date === label);
                      return item?.fullDate || label;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="派工人數" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="需求人數" fill="#c7d2fe" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">暫無資料</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 待審核需求單 */}
      {pendingDemands.length > 0 && (
        <Card className="shadow-md border-amber-300/50 bg-amber-50/40 hover:shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                待審核需求單
              </CardTitle>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                {pendingDemands.length} 筆
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingDemands.slice(0, 5).map((demand: any) => (
                <Link key={demand.id} href={`/demands/${demand.id}`}>
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-amber-200 bg-white hover:bg-amber-50/50 cursor-pointer transition-colors group">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-medium text-sm">{demand.client?.name || "未指定客戶"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(demand.date).toLocaleDateString("zh-TW", { month: "short", day: "numeric" })}
                        {" "}·{" "}
                        {demand.startTime} - {demand.endTime}
                        {demand.location && ` · ${demand.location}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {demand.requiredWorkers} 人
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {pendingDemands.length > 5 && (
              <div className="mt-3 text-center">
                <Link href="/demands?status=pending">
                  <Button variant="ghost" size="sm" className="text-xs">
                    查看全部 {pendingDemands.length} 筆待審核需求單
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 需求列表 + 指派清單 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-md border-border/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">今日需求列表</CardTitle>
              <span className="text-xs text-muted-foreground">
                {confirmedDemands.length} 筆需求
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {confirmedDemands.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">今日無需求</div>
            ) : (
              <div className="space-y-2">
                {confirmedDemands.map((demand: any) => {
                  const shortage = demand.requiredWorkers - demand.assignedCount;
                  return (
                    <Link key={demand.id} href={`/demands/${demand.id}`}>
                      <div className="flex items-center justify-between p-3.5 rounded-lg border border-border/60 bg-card hover:bg-muted/40 cursor-pointer transition-colors group">
                        <div className="min-w-0 flex-1 mr-3">
                          <div className="font-medium text-sm">{demand.client?.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {demand.startTime} - {demand.endTime}
                            {demand.location && ` · ${demand.location}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-sm tabular-nums">
                            <span className="font-semibold">{demand.assignedCount}</span>
                            <span className="text-muted-foreground"> / {demand.requiredWorkers}</span>
                          </span>
                          {shortage > 0 ? (
                            <Badge variant="destructive" className="gap-1 text-xs font-medium">
                              <AlertCircle className="h-3 w-3" />
                              缺 {shortage} 人
                            </Badge>
                          ) : (
                            <Badge className="gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                              <CheckCircle2 className="h-3 w-3" />
                              已滿
                            </Badge>
                          )}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base font-medium">今日已指派清單</CardTitle>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                共 {todayAssignments?.length || 0} 筆
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {!todayAssignments || todayAssignments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">今日無排班</div>
            ) : (
              <div className="space-y-2">
                {todayAssignments.slice(0, 10).map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-3.5 rounded-lg border border-border/60">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-medium text-sm">{assignment.worker?.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {assignment.demand?.client?.name || "未知客戶"} · {new Date(assignment.scheduledStart).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} - {new Date(assignment.scheduledEnd).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${
                        assignment.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : assignment.status === "cancelled"
                          ? "bg-red-50 text-red-600 border-red-200"
                          : assignment.status === "disputed"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {assignment.status === "assigned" && "已指派"}
                      {assignment.status === "completed" && "已完成"}
                      {assignment.status === "cancelled" && "已取消"}
                      {assignment.status === "disputed" && "有爭議"}
                    </Badge>
                  </div>
                ))}
                {todayAssignments.length > 10 && (
                  <div className="text-center pt-2">
                    <Button variant="ghost" size="sm" className="text-xs" asChild>
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
