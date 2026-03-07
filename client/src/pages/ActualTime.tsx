import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, User, AlertCircle, Loader2, DollarSign, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PayType = "hourly" | "unit" | "fixed";

export default function ActualTime() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"time" | "payroll">("time");

  // 薪資回填表單狀態
  const [payType, setPayType] = useState<PayType>("hourly");
  const [unitCount, setUnitCount] = useState("");
  const [unitType, setUnitType] = useState("間");
  const [payRate, setPayRate] = useState("");
  const [payAmount, setPayAmount] = useState("");

  // 修正時區偵移問題：new Date("2026-02-15") 在 UTC+8 環境會被解析為 2026-02-14T16:00Z
  // 需要补上 UTC+8 偵移，讓後端收到的 UTC 時間對應台灣正確日期
  const queryDate = new Date(selectedDate + "T00:00:00+08:00");

  const { data: assignments, isLoading, refetch } = trpc.assignments.listByDate.useQuery({
    date: queryDate,
  });

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // 預填現有薪資資料
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

  // 件薪自動計算金額
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

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">實際工時回填</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">實際工時回填</h1>
        <p className="text-sm text-muted-foreground mt-1">回填員工的實際出勤時間與薪資資料</p>
      </div>

      <Card className="mb-6 shadow-md border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 space-y-2">
            <Label className="text-sm text-muted-foreground shrink-0">選擇日期</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[180px] h-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">
              {new Date(selectedDate).toLocaleDateString("zh-TW")} 的排班記錄
            </CardTitle>
            <span className="text-xs text-muted-foreground">{assignments?.length || 0} 筆記錄</span>
          </div>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">該日期無排班記錄</div>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment: any) => {
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
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="font-medium text-sm">{assignment.demand.client?.name || "未知客戶"}</span>
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
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {assignment.worker?.name || "未知員工"}
                          </span>
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
                              {variance && parseFloat(variance) !== 0 && (
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
