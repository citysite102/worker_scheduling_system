import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, User, AlertCircle, Loader2, DollarSign, CheckCircle2, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  getTaiwanTodayStr,
  getTaiwanWeekStartStr,
  addDaysToDateStr,
  getWeekdayLabel,
  formatTaiwanDate,
  generateDateRange,
} from "@/lib/dateUtils";
import { WorkerAvatar, formatWorkerId } from "@/components/WorkerAvatar";

type PayType = "hourly" | "unit" | "fixed";

export default function ActualTime() {
  // 當週週一日期字串（週視圖的錨點）
  const [weekStart, setWeekStart] = useState(() => getTaiwanWeekStartStr());
  // 選取的單日篩選（null = 顯示全週）
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"time" | "payroll">("time");

  // 薪資回填表單狀態
  const [payType, setPayType] = useState<PayType>("hourly");
  const [unitCount, setUnitCount] = useState("");
  const [unitType, setUnitType] = useState("間");
  const [payRate, setPayRate] = useState("");
  const [payAmount, setPayAmount] = useState("");

  // 週視圖 API：一次載入整週資料
  const { data: weekAssignments, isLoading, refetch } = (trpc.assignments as any).listByWeek.useQuery(
    { weekStartStr: weekStart },
    { refetchOnWindowFocus: false }
  );

  // 計算週內七天的日期字串陣列
  const weekDays = useMemo(() => generateDateRange(weekStart, addDaysToDateStr(weekStart, 6)), [weekStart]);
  const todayStr = useMemo(() => getTaiwanTodayStr(), []);

  // 依日期分組
  const assignmentsByDate = useMemo(() => {
    if (!weekAssignments) return {} as Record<string, any[]>;
    const map: Record<string, any[]> = {};
    for (const a of weekAssignments) {
      const key = a.taiwanDateStr as string;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [weekAssignments]);

  // 根據單日篩選決定要顯示的日期列表
  const visibleDays = selectedDay ? [selectedDay] : weekDays;

  // 週導覽
  const goPrevWeek = () => {
    setWeekStart(prev => addDaysToDateStr(prev, -7));
    setSelectedDay(null);
  };
  const goNextWeek = () => {
    setWeekStart(prev => addDaysToDateStr(prev, 7));
    setSelectedDay(null);
  };
  const goThisWeek = () => {
    setWeekStart(getTaiwanWeekStartStr());
    setSelectedDay(null);
  };

  const toggleDayFilter = (dateStr: string) => {
    setSelectedDay(prev => prev === dateStr ? null : dateStr);
  };

  const fillActualTimeMutation = trpc.assignments.fillActualTime.useMutation({
    onSuccess: () => {
      const isEdit = editingAssignment?.actualStartTime;
      toast.success(isEdit ? "工時已更新" : "實際工時已回填");
      setIsDialogOpen(false);
      setEditingAssignment(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`工時回填失敗：${error.message}`);
    },
  });

  const fillPayrollMutation = (trpc.assignments as any).fillPayroll.useMutation({
    onSuccess: () => {
      toast.success("薪資資料已儲存");
      setIsDialogOpen(false);
      setEditingAssignment(null);
      refetch();
    },
    onError: (error: { message: string }) => {
      toast.error(`薪資回填失敗：${error.message}`);
    },
  });

  const handleOpenTimeDialog = (assignment: any) => {
    setEditingAssignment(assignment);
    setDialogMode("time");
    setIsDialogOpen(true);
  };

  const handleOpenPayrollDialog = (assignment: any) => {
    setEditingAssignment(assignment);
    setDialogMode("payroll");
    setPayType((assignment.payType as PayType) || "hourly");
    setUnitCount(assignment.unitCount?.toString() || "");
    setUnitType(assignment.unitType || "間");
    setPayRate(assignment.payRate?.toString() || "");
    setPayAmount(assignment.payAmount?.toString() || "");
    setIsDialogOpen(true);
  };

  const handleTimeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingAssignment) return;
    const formData = new FormData(e.currentTarget);
    fillActualTimeMutation.mutate({
      assignmentId: editingAssignment.id,
      actualStartTime: formData.get("actualStartTime") as string,
      actualEndTime: formData.get("actualEndTime") as string,
    });
  };

  const handlePayrollSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingAssignment) return;
    const amount = parseInt(payAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error("請輸入有效的薪資金額");
      return;
    }
    fillPayrollMutation.mutate({
      assignmentId: editingAssignment.id,
      payType,
      unitCount: unitCount ? parseInt(unitCount) : undefined,
      unitType: unitType || undefined,
      payRate: payRate ? parseInt(payRate) : undefined,
      payAmount: amount,
    });
  };

  const handleAutoCalculate = () => {
    if (payType === "unit" && unitCount && payRate) {
      const calculated = parseInt(unitCount) * parseInt(payRate);
      if (!isNaN(calculated)) setPayAmount(calculated.toString());
    } else if (payType === "hourly" && payRate && editingAssignment?.actualStartTime && editingAssignment?.actualEndTime) {
      const [sh, sm] = editingAssignment.actualStartTime.split(":").map(Number);
      const [eh, em] = editingAssignment.actualEndTime.split(":").map(Number);
      const minutes = (eh * 60 + em) - (sh * 60 + sm);
      const hours = minutes / 60;
      const calculated = Math.round(hours * parseInt(payRate));
      if (!isNaN(calculated)) setPayAmount(calculated.toString());
    }
  };

  const calculateHours = (startTime: string, endTime: string) => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;
    return ((end - start) / 60).toFixed(1);
  };

  const payTypeLabel = (pt: string) => {
    if (pt === "hourly") return "時薪";
    if (pt === "unit") return "件薪";
    if (pt === "fixed") return "固定";
    return pt;
  };

  // 週統計
  const weekStats = useMemo(() => {
    if (!weekAssignments) return { total: 0, completed: 0, pending: 0, payrollPending: 0 };
    const total = weekAssignments.length;
    const completed = weekAssignments.filter((a: any) => a.status === "completed" || a.status === "disputed").length;
    const pending = total - completed;
    const payrollPending = weekAssignments.filter((a: any) => a.role !== "intern" && (a.payAmount === null || a.payAmount === undefined)).length;
    return { total, completed, pending, payrollPending };
  }, [weekAssignments]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">實際工時回填</h1>
        <p className="text-sm text-muted-foreground mt-1">回填員工的實際出勤時間與薪資資料</p>
      </div>

      {/* 週導覽列 */}
      <Card className="mb-5 shadow-md border-border/40">
        <CardContent className="p-4">
          {/* 週切換控制 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={goPrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[160px] text-center">
                {formatTaiwanDate(weekStart)} – {formatTaiwanDate(addDaysToDateStr(weekStart, 6))}
              </span>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={goNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {weekStart !== getTaiwanWeekStartStr() && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goThisWeek}>
                  <CalendarDays className="h-3 w-3 mr-1" />
                  本週
                </Button>
              )}
              {selectedDay && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setSelectedDay(null)}>
                  顯示全週
                </Button>
              )}
            </div>
          </div>

          {/* 七天日期格 */}
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((dateStr) => {
              const count = assignmentsByDate[dateStr]?.length || 0;
              const isToday = dateStr === todayStr;
              const isSelected = selectedDay === dateStr;
              const weekday = getWeekdayLabel(dateStr);
              const [, m, d] = dateStr.split("-").map(Number);
              const isWeekend = weekday === "六" || weekday === "日";

              return (
                <button
                  key={dateStr}
                  onClick={() => toggleDayFilter(dateStr)}
                  className={`
                    flex flex-col items-center py-2.5 px-1 rounded-lg border transition-all text-center
                    ${isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : isToday
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "border-border/50 hover:bg-muted/60 hover:border-border"
                    }
                  `}
                >
                  <span className={`text-[10px] font-medium mb-0.5 ${isSelected ? "text-primary-foreground/80" : isWeekend ? "text-rose-500" : "text-muted-foreground"}`}>
                    週{weekday}
                  </span>
                  <span className={`text-sm font-semibold leading-none ${isSelected ? "" : isToday ? "text-blue-700" : ""}`}>
                    {m}/{d}
                  </span>
                  {count > 0 ? (
                    <span className={`mt-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-primary/10 text-primary"
                    }`}>
                      {count}
                    </span>
                  ) : (
                    <span className="mt-1.5 h-4 w-4" />
                  )}
                </button>
              );
            })}
          </div>

          {/* 週統計 */}
          {!isLoading && weekStats.total > 0 && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40 text-xs text-muted-foreground">
              <span>本週共 <strong className="text-foreground">{weekStats.total}</strong> 筆排班</span>
              <span className="text-emerald-600">已完成 {weekStats.completed} 筆</span>
              {weekStats.pending > 0 && <span className="text-amber-600">待回填 {weekStats.pending} 筆</span>}
              {weekStats.payrollPending > 0 && <span className="text-rose-600">薪資待填 {weekStats.payrollPending} 筆</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 內容區：依日期分組顯示 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : weekStats.total === 0 ? (
        <Card className="shadow-md border-border/40">
          <CardContent className="py-14 text-center text-muted-foreground text-sm">
            本週無排班記錄
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleDays.map((dateStr) => {
            const dayAssignments = assignmentsByDate[dateStr] || [];
            if (dayAssignments.length === 0 && selectedDay === null) return null;

            const weekday = getWeekdayLabel(dateStr);
            const isToday = dateStr === todayStr;
            const [, m, d] = dateStr.split("-").map(Number);

            return (
              <Card key={dateStr} className="shadow-md border-border/40">
                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className={`text-base font-medium ${isToday ? "text-blue-700" : ""}`}>
                        {m}月{d}日（週{weekday}）
                        {isToday && <span className="ml-2 text-xs font-normal bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">今天</span>}
                      </CardTitle>
                    </div>
                    <span className="text-xs text-muted-foreground">{dayAssignments.length} 筆記錄</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {dayAssignments.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">該日期無排班記錄</div>
                  ) : (
                    <div className="space-y-2">
                      {dayAssignments.map((assignment: any) => {
                        const plannedHours = calculateHours(assignment.demand.startTime, assignment.demand.endTime);
                        const actualHours = assignment.actualStartTime && assignment.actualEndTime
                          ? calculateHours(assignment.actualStartTime, assignment.actualEndTime)
                          : null;
                        const variance = actualHours ? (parseFloat(actualHours) - parseFloat(plannedHours)).toFixed(1) : null;
                        const isIntern = assignment.role === "intern";
                        const hasPayroll = assignment.payAmount !== null && assignment.payAmount !== undefined;
                        const timeCompleted = assignment.status === "completed" || assignment.status === "disputed";

                        return (
                          <div
                            key={assignment.id}
                            className="p-4 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                          >
                            {/* 上方：員工資訊與狀態 */}
                            <div className="flex items-start justify-between gap-3">
                              {/* 員工頭像 */}
                              <WorkerAvatar
                                workerId={assignment.worker?.id || assignment.workerId}
                                name={assignment.worker?.name || "?"}
                                avatarUrl={assignment.worker?.avatarUrl}
                                size="md"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  {/* 員工姓名 + 工號 */}
                                  <span className="font-medium text-sm">{assignment.worker?.name || "未知員工"}</span>
                                  <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                    {formatWorkerId(assignment.worker?.id || assignment.workerId)}
                                  </span>
                                  <span className="text-muted-foreground">·</span>
                                  <span className="text-sm text-muted-foreground">{assignment.demand.client?.name || "未知客戶"}</span>
                                  {isIntern ? (
                                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">實習生</Badge>
                                  ) : (
                                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">正職</Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${
                                      assignment.status === "completed"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : assignment.status === "disputed"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                    }`}
                                  >
                                    {assignment.status === "assigned" && "已指派"}
                                    {assignment.status === "completed" && "已完成"}
                                    {assignment.status === "disputed" && "有爭議"}
                                  </Badge>
                                  {assignment.status === "disputed" && (
                                    <Badge variant="destructive" className="gap-1 text-xs">
                                      <AlertCircle className="h-3 w-3" />
                                      時段重疊
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  {assignment.worker?.idNumber && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      證號：{assignment.worker.idNumber.slice(-4).padStart(assignment.worker.idNumber.length, "*")}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    預計：{assignment.demand.startTime} - {assignment.demand.endTime} ({plannedHours}h)
                                  </span>
                                  {actualHours && (
                                    <>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        實際：{assignment.actualStartTime} - {assignment.actualEndTime} ({actualHours}h)
                                      </span>
                                      {variance && (
                                        <span className={`font-medium ${parseFloat(variance) > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                          差異：{parseFloat(variance) > 0 ? "+" : ""}{variance}h
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* 工時回填按鈕 */}
                              <Button
                                variant={timeCompleted ? "ghost" : "default"}
                                size="sm"
                                className={`shrink-0 text-xs ${timeCompleted ? "text-muted-foreground" : ""}`}
                                onClick={() => handleOpenTimeDialog(assignment)}
                              >
                                {timeCompleted ? "修改工時" : "回填工時"}
                              </Button>
                            </div>

                            {/* 下方：薪資資訊（僅正職顯示） */}
                            {!isIntern && (
                              <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                  {hasPayroll ? (
                                    <>
                                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                        <CheckCircle2 className="h-3 w-3" />
                                        薪資已回填
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" />
                                        {payTypeLabel(assignment.payType || "hourly")}
                                        {assignment.payType === "unit" && assignment.unitCount !== null && (
                                          <> · {assignment.unitCount} {assignment.unitType || "件"}</>
                                        )}
                                        {assignment.payRate !== null && (
                                          <> · ${assignment.payRate}/{assignment.payType === "unit" ? (assignment.unitType || "件") : "hr"}</>
                                        )}
                                      </span>
                                      <span className="font-semibold text-foreground">
                                        薪資：${assignment.payAmount?.toLocaleString()}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-amber-600 flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" />
                                      薪資尚未回填
                                    </span>
                                  )}
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0 text-xs"
                                  onClick={() => handleOpenPayrollDialog(assignment)}
                                >
                                  {hasPayroll ? "修改薪資" : "填入薪資"}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 工時回填 Dialog */}
      <Dialog open={isDialogOpen && dialogMode === "time"} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleTimeSubmit}>
            <DialogHeader>
              <DialogTitle>{editingAssignment?.actualStartTime ? "修改實際工時" : "回填實際工時"}</DialogTitle>
              <DialogDescription>
                {editingAssignment && (
                  <>
                    {editingAssignment.worker?.name} - {editingAssignment.demand.client?.name}
                    <br />
                    預計時間：{editingAssignment.demand.startTime} - {editingAssignment.demand.endTime}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="actualStartTime">實際開始時間 *</Label>
                <Input
                  id="actualStartTime"
                  name="actualStartTime"
                  type="time"
                  defaultValue={editingAssignment?.actualStartTime || editingAssignment?.demand.startTime}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualEndTime">實際結束時間 *</Label>
                <Input
                  id="actualEndTime"
                  name="actualEndTime"
                  type="time"
                  defaultValue={editingAssignment?.actualEndTime || editingAssignment?.demand.endTime}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={fillActualTimeMutation.isPending}>
                {fillActualTimeMutation.isPending ? "儲存中..." : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 薪資回填 Dialog */}
      <Dialog open={isDialogOpen && dialogMode === "payroll"} onOpenChange={(open) => { if (!open) setIsDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <form onSubmit={handlePayrollSubmit}>
            <DialogHeader>
              <DialogTitle>填入薪資資料</DialogTitle>
              <DialogDescription>
                {editingAssignment && (
                  <>
                    {editingAssignment.worker?.name} - {editingAssignment.demand.client?.name}
                    <br />
                    此薪資資料僅用於內部計算，不對客戶顯示。
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* 計薪方式 */}
              <div className="space-y-2">
                <Label>計薪方式 *</Label>
                <Select value={payType} onValueChange={(v) => setPayType(v as PayType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">時薪（元 / 小時）</SelectItem>
                    <SelectItem value="unit">件薪（元 / 件）</SelectItem>
                    <SelectItem value="fixed">固定薪資</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 件薪：件數與單位 */}
              {payType === "unit" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="unitCount">完成件數 *</Label>
                    <Input
                      id="unitCount"
                      type="number"
                      min="0"
                      placeholder="如：10"
                      value={unitCount}
                      onChange={(e) => setUnitCount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitType">件數單位</Label>
                    <Input
                      id="unitType"
                      placeholder="如：間、件、箱"
                      value={unitType}
                      onChange={(e) => setUnitType(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* 單價（時薪或件薪時顯示） */}
              {(payType === "hourly" || payType === "unit") && (
                <div className="space-y-2">
                  <Label htmlFor="payRate">
                    {payType === "hourly" ? "時薪單價（元/小時）" : "件薪單價（元/件）"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="payRate"
                      type="number"
                      min="0"
                      placeholder="如：200"
                      value={payRate}
                      onChange={(e) => setPayRate(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={handleAutoCalculate}
                    >
                      自動計算
                    </Button>
                  </div>
                </div>
              )}

              {/* 最終薪資金額 */}
              <div className="space-y-2">
                <Label htmlFor="payAmount">最終薪資金額（元）*</Label>
                <Input
                  id="payAmount"
                  type="number"
                  min="0"
                  placeholder="如：1600"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {payType === "hourly" && "可輸入單價後點「自動計算」，或直接填入最終金額"}
                  {payType === "unit" && "可輸入件數與單價後點「自動計算」，或直接填入最終金額"}
                  {payType === "fixed" && "直接填入本次固定薪資金額"}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={fillPayrollMutation.isPending}>
                {fillPayrollMutation.isPending ? "儲存中..." : "儲存薪資"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
