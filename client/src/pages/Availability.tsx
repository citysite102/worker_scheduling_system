import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];

/**
 * 取得指定日期所在週的週一，時間設為 UTC 00:00:00
 * 這確保前後端使用一致的 weekStartDate
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Availability() {
  const [selectedWeek, setSelectedWeek] = useState(() => getWeekStart(new Date()));
  const [selectedWorker, setSelectedWorker] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [timeSlots, setTimeSlots] = useState<{ startTime: string; endTime: string }[]>([
    { startTime: "09:00", endTime: "17:00" },
  ]);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const [isLoadingLastWeek, setIsLoadingLastWeek] = useState(false);

  const { data: workers } = trpc.workers.list.useQuery({ status: "active" });

  // 穩定化 query input 避免無限重新查詢
  const weekQueryInput = useMemo(() => ({
    workerId: selectedWorker!,
    weekStart: selectedWeek,
  }), [selectedWorker, selectedWeek]);

  const { data: availabilities, refetch } = trpc.availability.getByWeek.useQuery(
    weekQueryInput,
    {
      enabled: !!selectedWorker,
    }
  );

  const upsertMutation = trpc.availability.upsert.useMutation({
    onError: (error) => {
      toast.error(`儲存失敗：${error.message}`);
    },
  });

  const confirmMutation = trpc.availability.confirm.useMutation({
    onSuccess: () => {
      toast.success("已確認本週排班時間設置");
      refetch();
    },
    onError: (error) => {
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

  const handleOpenDialog = async (dayOfWeek: number) => {
    const existing = availabilities?.find((a: any) => a.dayOfWeek === dayOfWeek);
    if (existing && existing.timeSlots && existing.timeSlots.length > 0) {
      // 已有設定，直接載入到編輯對話框
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

    // 尚未設定，嘗試載入上週設定
    setIsLoadingLastWeek(true);
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
        // 沿用上週設定，直接儲存到資料庫
        const slotsToSave = lastWeekDay.timeSlots.map((ts: any) => ({
          startTime: ts.startTime,
          endTime: ts.endTime,
        }));

        await upsertMutation.mutateAsync({
          workerId: selectedWorker!,
          weekStart: selectedWeek,
          dayOfWeek: dayOfWeek,
          timeSlots: slotsToSave,
        });

        await refetch();
        toast.success(`已沿用上週${WEEKDAYS[dayOfWeek - 1]}的設定`);
        setIsLoadingLastWeek(false);
        return;
      }
    } catch (error) {
      // 查詢失敗，忽略
    }

    setIsLoadingLastWeek(false);
    // 上週也沒設定或查詢失敗，開啟對話框使用預設值
    setTimeSlots([{ startTime: "09:00", endTime: "17:00" }]);
    setSelectedDayOfWeek(dayOfWeek);
    setIsDialogOpen(true);
  };

  const handleSaveTimeSlots = async () => {
    if (!selectedWorker || selectedDayOfWeek === null) return;

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

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">排班時間設置管理</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>選擇員工與週次</CardTitle>
            <CardDescription>選擇員工後，設定該週的可排班時段</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div>
                <Label className="text-base font-medium">員工</Label>
                <Select
                  value={selectedWorker?.toString() || ""}
                  onValueChange={(value) => setSelectedWorker(parseInt(value))}
                >
                  <SelectTrigger className="mt-2">
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
              <div>
                <Label className="text-base font-medium">週次</Label>
                <div className="flex items-center gap-3 mt-2">
                  <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center font-medium text-lg">
                    {formatDate(weekStart)} - {formatDate(weekEnd)}
                  </div>
                  <Button variant="outline" size="icon" onClick={handleNextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedWorker && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>本週可排班時段</CardTitle>
                  <CardDescription>點擊日期設定該日的可排班時段（可設定多個時段）</CardDescription>
                </div>
                {isConfirmed ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    已確認
                  </Badge>
                ) : (
                  <Button onClick={handleConfirmWeek} disabled={confirmMutation.isPending || !hasAnySlots}>
                    確認本週時間
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-3">
                {WEEKDAYS.map((day, index) => {
                  const dayOfWeek = index + 1;
                  const availability = availabilities?.find((a: any) => a.dayOfWeek === dayOfWeek);
                  const hasSlots = availability && availability.timeSlots && availability.timeSlots.length > 0;

                  return (
                    <div key={index} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                      <div className="text-sm font-medium mb-2 text-center">{day}</div>
                      {hasSlots ? (
                        <div className="space-y-1">
                          {availability.timeSlots.map((slot: any, idx: number) => (
                            <div key={idx} className="text-xs text-muted-foreground text-center">
                              {slot.startTime} - {slot.endTime}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center">未設定</div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => handleOpenDialog(dayOfWeek)}
                        disabled={isLoadingLastWeek || upsertMutation.isPending}
                      >
                        {(isLoadingLastWeek || upsertMutation.isPending) ? (
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
            <DialogTitle>設定可排班時段</DialogTitle>
            <DialogDescription>
              {selectedDayOfWeek !== null && `${WEEKDAYS[selectedDayOfWeek - 1]} 的可排班時段`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {timeSlots.map((slot, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  <Label className="text-xs">開始時間</Label>
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => handleTimeSlotChange(index, "startTime", e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">結束時間</Label>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => handleTimeSlotChange(index, "endTime", e.target.value)}
                  />
                </div>
                {timeSlots.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-5"
                    onClick={() => handleRemoveTimeSlot(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={handleAddTimeSlot}>
              <Plus className="mr-2 h-4 w-4" />
              新增時段
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTimeSlots} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
