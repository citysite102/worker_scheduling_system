import { useRoute, Link } from "wouter";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  // 使用 UTC 方法避免時區影響
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
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
  
  // 時間篩選狀態
  const [dateFilter, setDateFilter] = useState<"all" | "this_week" | "next_week" | "this_month" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const { data, isLoading, error } = trpc.workers.detail.useQuery(
    { id: workerId },
    { enabled: !isNaN(workerId) && workerId > 0 }
  );
  
  // 篩選指派記錄（必須在最上層定義，不能在條件判斷後）
  const filteredAssignments = useMemo(() => {
    if (!data?.assignments) return [];
    if (dateFilter === "all") return data.assignments;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate: Date;
    let endDate: Date;
    
    if (dateFilter === "this_week") {
      // 本週：從今天到週日
      startDate = new Date(today);
      endDate = new Date(today);
      const dayOfWeek = today.getUTCDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      endDate.setDate(endDate.getDate() + daysUntilSunday);
    } else if (dateFilter === "next_week") {
      // 下週：下個週一到下個週日
      startDate = new Date(today);
      const dayOfWeek = today.getUTCDay();
      const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      startDate.setDate(startDate.getDate() + daysUntilNextMonday);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else if (dateFilter === "this_month") {
      // 本月：從今天到月底
      startDate = new Date(today);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (dateFilter === "custom" && customStartDate && customEndDate) {
      // 自訂區間
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
    } else {
      return data.assignments;
    }
    
    return data.assignments.filter((a: any) => {
      if (!a.demand?.date) return false;
      const assignmentDate = new Date(a.demand.date);
      assignmentDate.setHours(0, 0, 0, 0);
      return assignmentDate >= startDate && assignmentDate <= endDate;
    });
  }, [data?.assignments, dateFilter, customStartDate, customEndDate]);
  
  // 統計篩選後的工時
  const filteredStats = useMemo(() => {
    const totalHours = filteredAssignments.reduce((sum: number, a: any) => {
      if (a.status === "completed" && a.actualHours) {
        return sum + (a.actualHours / 60);
      } else if (a.status === "assigned" && a.demand) {
        // 尚未完成的使用預排工時
        return sum + (a.demand.estimatedHours / 60);
      }
      return sum;
    }, 0);
    
    return {
      count: filteredAssignments.length,
      totalHours: totalHours.toFixed(1)
    };
  }, [filteredAssignments]);

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
        <div className="flex items-center gap-4">
          <Link href="/workers">
            <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
          </Link>
          <div className="h-6 w-px bg-gray-200" />
          {/* 大頭像 */}
          <div className="shrink-0">
            {worker.avatarUrl ? (
              <img
                src={worker.avatarUrl}
                alt={worker.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-border/60"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl border-2 border-border/60">
                {worker.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{worker.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={worker.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}>
                {worker.status === "active" ? "啟用" : "停用"}
              </Badge>
              {worker.city && (
                <span className="text-sm text-muted-foreground">{worker.city}</span>
              )}
            </div>
          </div>
        </div>
        <Link href={`/availability?workerId=${workerId}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Clock className="h-4 w-4" /> 前往排班時間設置
          </Button>
        </Link>
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
            {worker.lineId && (
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <svg className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Line ID</p>
                  <p className="text-sm font-medium text-gray-700">{worker.lineId}</p>
                </div>
              </div>
            )}
            {worker.whatsappId && (
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                  <svg className="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-400">WhatsApp ID</p>
                  <p className="text-sm font-medium text-gray-700">{worker.whatsappId}</p>
                </div>
              </div>
            )}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-700">
                  歷史指派清單
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    {dateFilter === "all" ? `全部 ${data.assignments.length} 筆` : `篩選後 ${filteredStats.count} 筆 · 共 ${filteredStats.totalHours} 小時`}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部時間</SelectItem>
                      <SelectItem value="this_week">本週</SelectItem>
                      <SelectItem value="next_week">下週</SelectItem>
                      <SelectItem value="this_month">本月</SelectItem>
                      <SelectItem value="custom">自訂區間</SelectItem>
                    </SelectContent>
                  </Select>
                  {dateFilter === "custom" && (
                    <>
                      <Input 
                        type="date" 
                        value={customStartDate} 
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-[130px] h-8 text-xs"
                      />
                      <span className="text-xs text-gray-400">至</span>
                      <Input 
                        type="date" 
                        value={customEndDate} 
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-[130px] h-8 text-xs"
                      />
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAssignments.length === 0 ? (
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
                        <th className="text-center px-4 py-3 font-medium text-gray-500">角色</th>
                        <th className="text-center px-4 py-3 font-medium text-gray-500">狀態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignments.map((a: any) => (
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
                            {a.role === "intern" ? (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">實習生</Badge>
                            ) : (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">正職</Badge>
                            )}
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
