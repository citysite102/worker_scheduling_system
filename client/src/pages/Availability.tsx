import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Loader2, Clock, AlertTriangle, Copy } from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useSearch } from "wouter";

const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // 週日為 0，需要往前 6 天
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** 檢查兩個時段是否重疊 */
function timeSlotsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const aStart = toMin(a.startTime);
  const aEnd = toMin(a.endTime);
  const bStart = toMin(b.startTime);
  const bEnd = toMin(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

/** 驗證所有時段，回傳重疊的索引對 */
function findOverlaps(slots: { startTime: string; endTime: string }[]): [number, number][] {
  const overlaps: [number, number][] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (timeSlotsOverlap(slots[i], slots[j])) {
        overlaps.push([i, j]);
      }
    }
  }
  return overlaps;
}

export default function Availability() {
  const searchParams = new URLSearchParams(useSearch());
  const workerIdFromUrl = searchParams.get("workerId");
  
  const [selectedWeek, setSelectedWeek] = useState(() => getWeekStart(new Date()));
  const [selectedWorker, setSelectedWorker] = useState<number | null>(
    workerIdFromUrl ? Number(workerIdFromUrl) : null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [timeSlots, setTimeSlots] = useState<{ startTime: string; endTime: string }[]>([
    { startTime: "09:00", endTime: "17:00" },
  ]);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  // 追蹤正在載入上週設定的具體天
  const [loadingDay, setLoadingDay] = useState<number | null>(null);
  // 追蹤正在儲存的具體天
  const [savingDay, setSavingDay] = useState<number | null>(null);
  // 追蹤一鍵沿用上週全部設定的載入狀態
  const [isCopyingAll, setIsCopyingAll] = useState(false);

  const { data: workers } = trpc.workers.list.useQuery({ status: "active" });

  const weekQueryInput = useMemo(() => ({
    workerId: selectedWorker!,
    weekStart: selectedWeek,
  }), [selectedWorker, selectedWeek]);

  const { data: availabilities, refetch } = trpc.availability.getByWeek.useQuery(
    weekQueryInput,
    { enabled: !!selectedWorker }
  );

  const upsertMutation = trpc.availability.upsert.useMutation({
    onSuccess: (data: any) => {
      // 檢查是否有衝突
      if (data.conflicts && data.conflicts.length > 0) {
        const conflictMessages = data.conflicts.map((c: any) => 
          `需求單 #${c.demandId}（${new Date(c.date).toLocaleDateString()} ${c.time}）：${c.reason}`
        ).join("\n");
        
        toast.warning(
          `排班時間已更新，但發現以下衝突：\n${conflictMessages}\n\n請至用工需求頁面重新指派員工。`,
          { duration: 10000 }
        );
      }
    },
    onError: (error: any) => {
      toast.error(`儲存失敗：${error.message}`);
      setSavingDay(null);
    },
  });

  const confirmMutation = trpc.availability.confirm.useMutation({
    onSuccess: () => {
      toast.success("已確認本週排班時間設置");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`確認失敗：${error.message}`);
    },
  });

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  const handlePrevWeek = () => {
    const newWeek = new Date(selectedWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    setSelectedWeek(getWeekStart(newWeek));
  };

  const handleNextWeek = () => {
    const newWeek = new Date(selectedWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    setSelectedWeek(getWeekStart(newWeek));
  };

  const handleAddTimeSlot = () => {
    setTimeSlots([...timeSlots, { startTime: "09:00", endTime: "17:00" }]);
  };

  const handleRemoveTimeSlot = (index: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index));
  };

  const handleTimeSlotChange = (index: number, field: "startTime" | "endTime", value: string) => {
    const newSlots = [...timeSlots];
    newSlots[index][field] = value;
    setTimeSlots(newSlots);
  };

  const utils = trpc.useUtils();

  const handleOpenDialog = useCallback(async (dayOfWeek: number) => {
    const existing = availabilities?.find((a: any) => a.dayOfWeek === dayOfWeek);
    if (existing && existing.timeSlots && existing.timeSlots.length > 0) {
      setTimeSlots(
        existing.timeSlots.map((ts: any) => ({
          startTime: ts.startTime,
          endTime: ts.endTime,
        }))
      );
      setSelectedDayOfWeek(dayOfWeek);
      setIsDialogOpen(true);
      return;
    }

    // 嘗試載入上週設定
    setLoadingDay(dayOfWeek);
    const lastWeek = new Date(selectedWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStart = getWeekStart(lastWeek);

    try {
      const lastWeekData = await utils.availability.getByWeek.fetch({
        workerId: selectedWorker!,
        weekStart: lastWeekStart,
      });

      const lastWeekDay = lastWeekData?.find((a: any) => a.dayOfWeek === dayOfWeek);
      if (lastWeekDay && lastWeekDay.timeSlots && lastWeekDay.timeSlots.length > 0) {
        const slotsToSave = lastWeekDay.timeSlots.map((ts: any) => ({
          startTime: ts.startTime,
          endTime: ts.endTime,
        }));

        setSavingDay(dayOfWeek);
        await upsertMutation.mutateAsync({
          workerId: selectedWorker!,
          weekStart: selectedWeek,
          dayOfWeek: dayOfWeek,
          timeSlots: slotsToSave,
        });

        await refetch();
        toast.success(`已沿用上週${WEEKDAYS[dayOfWeek - 1]}的設定`);
        setLoadingDay(null);
        setSavingDay(null);
        return;
      }
    } catch (error) {
      // 查詢失敗，忽略
    }

    setLoadingDay(null);
    setSavingDay(null);
    setTimeSlots([{ startTime: "09:00", endTime: "17:00" }]);
    setSelectedDayOfWeek(dayOfWeek);
    setIsDialogOpen(true);
  }, [availabilities, selectedWeek, selectedWorker, utils, upsertMutation, refetch]);

  // 計算重疊
  const overlaps = useMemo(() => findOverlaps(timeSlots), [timeSlots]);
  const hasOverlaps = overlaps.length > 0;
  const overlapIndices = useMemo(() => {
    const set = new Set<number>();
    overlaps.forEach(([a, b]) => { set.add(a); set.add(b); });
    return set;
  }, [overlaps]);

  // 驗證時間邏輯
  const invalidSlots = useMemo(() => {
    const set = new Set<number>();
    timeSlots.forEach((slot, i) => {
      const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
      if (toMin(slot.startTime) >= toMin(slot.endTime)) {
        set.add(i);
      }
    });
    return set;
  }, [timeSlots]);

  const hasInvalidSlots = invalidSlots.size > 0;

  const handleClearTimeSlots = async () => {
    if (!selectedWorker || selectedDayOfWeek === null) return;

    setSavingDay(selectedDayOfWeek);
    await upsertMutation.mutateAsync({
      workerId: selectedWorker,
      weekStart: selectedWeek,
      dayOfWeek: selectedDayOfWeek,
      timeSlots: [],
    });

    toast.success("已清除該日的排班時段");
    setIsDialogOpen(false);
    setSavingDay(null);
    await refetch();
  };

  const handleSaveTimeSlots = async () => {
    if (!selectedWorker || selectedDayOfWeek === null) return;

    // 驗證時間重疊
    if (hasOverlaps) {
      toast.error("有時段重疊，請調整後再儲存");
      return;
    }

    // 驗證開始時間 < 結束時間
    if (hasInvalidSlots) {
      toast.error("開始時間必須早於結束時間");
      return;
    }

    setSavingDay(selectedDayOfWeek);
    await upsertMutation.mutateAsync({
      workerId: selectedWorker,
      weekStart: selectedWeek,
      dayOfWeek: selectedDayOfWeek,
      timeSlots: timeSlots.map((ts) => ({
        startTime: ts.startTime,
        endTime: ts.endTime,
      })),
    });

    toast.success("排班時間設置已儲存");
    setIsDialogOpen(false);
    setSavingDay(null);
    await refetch();
  };

  const handleConfirmWeek = () => {
    if (!selectedWorker) return;
    confirmMutation.mutate({
      workerId: selectedWorker,
      weekStart: selectedWeek,
    });
  };

  const weekStart = getWeekStart(selectedWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const isConfirmed = availabilities?.some((a: any) => a.confirmed);
  const hasAnySlots = availabilities?.some((a: any) => a.timeSlots && a.timeSlots.length > 0);

  /** 一鍵沿用上週全部設定 */
  const handleCopyAllFromLastWeek = useCallback(async () => {
    if (!selectedWorker) return;

    setIsCopyingAll(true);
    const lastWeek = new Date(selectedWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStart = getWeekStart(lastWeek);

    try {
      const lastWeekData = await utils.availability.getByWeek.fetch({
        workerId: selectedWorker,
        weekStart: lastWeekStart,
      });

      if (!lastWeekData || lastWeekData.length === 0) {
        toast.warning("上週沒有任何排班設定可以沿用");
        setIsCopyingAll(false);
        return;
      }

      const daysWithSlots = lastWeekData.filter(
        (a: any) => a.timeSlots && a.timeSlots.length > 0
      );

      if (daysWithSlots.length === 0) {
        toast.warning("上週沒有任何排班設定可以沿用");
        setIsCopyingAll(false);
        return;
      }

      let savedCount = 0;
      for (const dayData of daysWithSlots) {
        const slotsToSave = dayData.timeSlots.map((ts: any) => ({
          startTime: ts.startTime,
          endTime: ts.endTime,
        }));

        await upsertMutation.mutateAsync({
          workerId: selectedWorker,
          weekStart: selectedWeek,
          dayOfWeek: dayData.dayOfWeek,
          timeSlots: slotsToSave,
        });
        savedCount++;
      }

      await refetch();
      toast.success(`已沿用上週 ${savedCount} 天的排班設定`);
    } catch (error) {
      toast.error("沿用上週設定時發生錯誤，請稍後再試");
    } finally {
      setIsCopyingAll(false);
    }
  }, [selectedWorker, selectedWeek, utils, upsertMutation, refetch]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">排班時間設置管理</h1>
        <p className="text-sm text-muted-foreground mt-1">管理員工每週可排班的時段</p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-md border-border/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">選擇員工與週次</CardTitle>
            <CardDescription>選擇員工後，設定該週的可排班時段</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">員工</Label>
                <Select
                  value={selectedWorker?.toString() || ""}
                  onValueChange={(value) => setSelectedWorker(parseInt(value))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="請選擇員工" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers?.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id.toString()}>
                        {worker.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">週次</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Button variant="outline" size="icon" onClick={handlePrevWeek} className="h-9 w-9 shrink-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center font-medium text-sm">
                    {formatDate(weekStart)} - {formatDate(weekEnd)}
                  </div>
                  <Button variant="outline" size="icon" onClick={handleNextWeek} className="h-9 w-9 shrink-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedWorker && (
          <Card className="shadow-md border-border/40">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">本週可排班時段</CardTitle>
                  <CardDescription>點擊日期設定該日的可排班時段（可設定多個時段）</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAllFromLastWeek}
                    disabled={isCopyingAll || isConfirmed}
                    className="text-muted-foreground"
                  >
                    {isCopyingAll ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        沿用中...
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        沿用上週全部
                      </>
                    )}
                  </Button>
                  {isConfirmed ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      已確認
                    </Badge>
                  ) : (
                    <Button
                      onClick={handleConfirmWeek}
                      disabled={confirmMutation.isPending || !hasAnySlots}
                      size="sm"
                    >
                      確認本週時間
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {WEEKDAYS.map((day, index) => {
                  const dayOfWeek = index + 1;
                  const availability = availabilities?.find((a: any) => a.dayOfWeek === dayOfWeek);
                  const hasSlots = availability && availability.timeSlots && availability.timeSlots.length > 0;
                  const isDayLoading = loadingDay === dayOfWeek || savingDay === dayOfWeek;

                  // 計算該日對應的實際日期
                  const actualDate = new Date(weekStart);
                  actualDate.setDate(actualDate.getDate() + index);
                  const dateStr = `${actualDate.getMonth() + 1}/${actualDate.getDate()}`;

                  return (
                    <div
                      key={index}
                      className={`border rounded-xl p-3 transition-all ${
                        hasSlots
                          ? "bg-blue-50/50 border-blue-200/60"
                          : "bg-card border-border/60 hover:border-border"
                      }`}
                    >
                      <div className="text-sm font-semibold mb-0.5 text-center">{day}</div>
                      <div className="text-xs text-muted-foreground mb-1.5 text-center">{dateStr}</div>
                      {hasSlots ? (
                        <div className="space-y-0.5 mb-2">
                          {availability.timeSlots.map((slot: any, idx: number) => (
                            <div key={idx} className="text-xs text-blue-700 text-center font-medium">
                              {slot.startTime} - {slot.endTime}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center mb-2">未設定</div>
                      )}
                      <Button
                        variant={hasSlots ? "outline" : "ghost"}
                        size="sm"
                        className={`w-full text-xs h-7 ${hasSlots ? "border-blue-200 text-blue-700 hover:bg-blue-100/50" : ""}`}
                        onClick={() => handleOpenDialog(dayOfWeek)}
                        disabled={isDayLoading}
                      >
                        {isDayLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          hasSlots ? "編輯" : "設定"
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              設定可排班時段
            </DialogTitle>
            <DialogDescription>
              {selectedDayOfWeek !== null && `${WEEKDAYS[selectedDayOfWeek - 1]} 的可排班時段`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {timeSlots.map((slot, index) => {
              const isOverlap = overlapIndices.has(index);
              const isInvalid = invalidSlots.has(index);
              const hasError = isOverlap || isInvalid;

              return (
                <div key={index}>
                  <div className={`flex items-end gap-2 p-3 rounded-lg border ${hasError ? "border-destructive/50 bg-destructive/5" : "border-border/60 bg-muted/30"}`}>
                    <div className="flex-1 space-y-2">
              <Label className="text-xs text-muted-foreground">開始時間</Label>
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => handleTimeSlotChange(index, "startTime", e.target.value)}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
              <Label className="text-xs text-muted-foreground">結束時間</Label>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => handleTimeSlotChange(index, "endTime", e.target.value)}
                        className="mt-1 h-9"
                      />
                    </div>
                    {timeSlots.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveTimeSlot(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isOverlap && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1 pl-1">
                      <AlertTriangle className="h-3 w-3" />
                      此時段與其他時段重疊
                    </p>
                  )}
                  {isInvalid && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1 pl-1">
                      <AlertTriangle className="h-3 w-3" />
                      開始時間必須早於結束時間
                    </p>
                  )}
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="w-full" onClick={handleAddTimeSlot}>
              <Plus className="mr-2 h-4 w-4" />
              新增時段
            </Button>
          </div>
          <DialogFooter className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleClearTimeSlots}
              disabled={upsertMutation.isPending}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              清除時段
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSaveTimeSlots}
                disabled={upsertMutation.isPending || hasOverlaps || hasInvalidSlots}
              >
                {upsertMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    儲存中...
                  </>
                ) : "儲存"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
