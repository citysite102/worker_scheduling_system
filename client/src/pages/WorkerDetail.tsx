import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  GraduationCap,
  ShieldCheck,
  HeartPulse,
  Clock,
  CalendarDays,
  Briefcase,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";

const DAY_NAMES = ["", "週一", "週二", "週三", "週四", "週五", "週六", "週日"];

function formatDate(date: string | Date) {
  const d = new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekRange(start: string | Date, end: string | Date) {
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">已完成</Badge>;
    case "assigned":
      return <Badge className="bg-blue-50 text-blue-700 border-blue-200">已指派</Badge>;
    case "cancelled":
      return <Badge className="bg-gray-100 text-gray-500 border-gray-200">已取消</Badge>;
    case "disputed":
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">爭議中</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function WorkerDetail() {
  const [, params] = useRoute("/workers/:id");
  const workerId = Number(params?.id);

  const { data, isLoading, error } = trpc.workers.detail.useQuery(
    { id: workerId },
    { enabled: !isNaN(workerId) && workerId > 0 }
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/workers">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> 返回員工列表
            </Button>
          </Link>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center text-red-600">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-60" />
            <p className="text-lg font-medium">找不到此員工</p>
            <p className="text-sm mt-1 opacity-70">該員工可能已被刪除或 ID 不正確</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { worker, assignments, availability, stats } = data;

  return (
    <div className="p-6 space-y-6">
      {/* 頂部導航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/workers">
            <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
          </Link>
          <div className="h-6 w-px bg-gray-200" />
          <h1 className="text-2xl font-bold text-gray-900">{worker.name}</h1>
          <Badge className={worker.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
            {worker.status === "active" ? "啟用" : "停用"}
          </Badge>
        </div>
      </div>

      {/* 基本資料卡片 */}
      <Card className="border border-gray-100 shadow-sm">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Phone className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">電話</p>
                <p className="text-sm font-medium text-gray-700">{worker.phone || "未填寫"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <Mail className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="text-sm font-medium text-gray-700 truncate max-w-[140px]">{worker.email || "未填寫"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">學校</p>
                <p className="text-sm font-medium text-gray-700">{worker.school || "未填寫"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">工作簽證</p>
                <p className="text-sm font-medium">
                  {worker.hasWorkPermit ? (
                    <span className="text-emerald-600">已取得</span>
                  ) : (
                    <span className="text-gray-400">未取得</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-rose-50 flex items-center justify-center">
                <HeartPulse className="h-4 w-4 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">體檢</p>
                <p className="text-sm font-medium">
                  {worker.hasHealthCheck ? (
                    <span className="text-emerald-600">已完成</span>
                  ) : (
                    <span className="text-gray-400">未完成</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400">工作許可到期</p>
                <p className="text-sm font-medium">
                  {worker.workPermitExpiryDate ? (() => {
                    const expiryDate = new Date(worker.workPermitExpiryDate);
                    const today = new Date();
                    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const dateStr = formatDate(worker.workPermitExpiryDate);
                    
                    if (daysUntilExpiry < 0) {
                      return <span className="text-red-600">{dateStr} (已過期)</span>;
                    } else if (daysUntilExpiry <= 30) {
                      return <span className="text-orange-600">{dateStr} ({daysUntilExpiry}天)</span>;
                    }
                    return <span className="text-gray-700">{dateStr}</span>;
                  })() : <span className="text-gray-400">無期限</span>}
                </p>
              </div>
            </div>
            {worker.note && (
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">備註</p>
                  <p className="text-sm font-medium text-gray-700 truncate max-w-[140px]">{worker.note}</p>
                </div>
              </div>
            )}
            {worker.attendanceNotes && (
              <div className="flex items-center gap-2.5 col-span-full">
                <div className="h-9 w-9 rounded-lg bg-yellow-50 flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400">出勤記錄</p>
                  <p className="text-sm font-medium text-gray-700">{worker.attendanceNotes}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 工時統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-400">總指派次數</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalAssignments}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-gray-400">已完成</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{stats.completedAssignments}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-400">已取消</span>
            </div>
            <p className="text-2xl font-bold text-gray-500">{stats.cancelledAssignments}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-gray-400">預排工時</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalScheduledHours}<span className="text-sm font-normal text-gray-400 ml-1">hr</span></p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-gray-400">實際工時</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalActualHours}<span className="text-sm font-normal text-gray-400 ml-1">hr</span></p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              {stats.totalVarianceHours >= 0 ? (
                <TrendingUp className="h-4 w-4 text-amber-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs text-gray-400">工時差異</span>
            </div>
            <p className={`text-2xl font-bold ${stats.totalVarianceHours >= 0 ? "text-amber-600" : "text-red-600"}`}>
              {stats.totalVarianceHours > 0 ? "+" : ""}{stats.totalVarianceHours}
              <span className="text-sm font-normal text-gray-400 ml-1">hr</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 分頁內容 */}
      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="bg-gray-50 border border-gray-100 p-1">
          <TabsTrigger value="assignments" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Briefcase className="h-3.5 w-3.5" /> 歷史指派清單
          </TabsTrigger>
          <TabsTrigger value="availability" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <CalendarDays className="h-3.5 w-3.5" /> 排班紀錄
          </TabsTrigger>
        </TabsList>

        {/* 歷史指派清單 */}
        <TabsContent value="assignments" className="mt-4">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-700">
                歷史指派清單
                <span className="text-sm font-normal text-gray-400 ml-2">共 {assignments.length} 筆</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {assignments.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>尚無指派紀錄</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">日期</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">客戶</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">地點</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">預排時段</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">實際時段</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">預排工時</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">實際工時</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignments.map((a: any) => (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-gray-700">
                            {a.demand ? formatDate(a.demand.date) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-800">{a.clientName}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {a.demand?.location || "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {a.demand ? `${a.demand.startTime} - ${a.demand.endTime}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {a.actualStartTime && a.actualEndTime
                              ? `${a.actualStartTime} - ${a.actualEndTime}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {((a.scheduledHours || 0) / 60).toFixed(1)}h
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {a.actualHours ? `${(a.actualHours / 60).toFixed(1)}h` : "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={a.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 排班紀錄 */}
        <TabsContent value="availability" className="mt-4">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-gray-700">
                排班紀錄
                <span className="text-sm font-normal text-gray-400 ml-2">共 {availability.length} 週</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {availability.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>尚無排班紀錄</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {availability.map((av: any) => (
                    <div key={av.id} className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-gray-700">
                            {formatWeekRange(av.weekStartDate, av.weekEndDate)}
                          </span>
                        </div>
                        <Badge className={av.confirmed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                          {av.confirmed ? "已確認" : "未確認"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
                          const dayData = av.days.find((d: any) => d.dayOfWeek === dow);
                          return (
                            <div key={dow} className={`rounded-lg p-2 text-center text-xs ${dayData && dayData.timeSlots.length > 0 ? "bg-blue-50 border border-blue-100" : "bg-gray-50 border border-gray-100"}`}>
                              <p className="font-medium text-gray-600 mb-1">{DAY_NAMES[dow]}</p>
                              {dayData && dayData.timeSlots.length > 0 ? (
                                dayData.timeSlots.map((ts: any, i: number) => (
                                  <p key={i} className="text-blue-600 text-[11px] leading-tight">
                                    {ts.startTime}-{ts.endTime}
                                  </p>
                                ))
                              ) : (
                                <p className="text-gray-400 text-[11px]">休息</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
