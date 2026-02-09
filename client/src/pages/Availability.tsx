import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Trash2, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];

export default function Availability() {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [selectedWorker, setSelectedWorker] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [timeSlots, setTimeSlots] = useState<{ startTime: string; endTime: string }[]>([
    { startTime: "09:00", endTime: "17:00" },
  ]);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);

  const { data: workers } = trpc.workers.list.useQuery({ status: "active" });

  const { data: availabilities, refetch } = trpc.availability.getByWeek.useQuery(
    {
      workerId: selectedWorker!,
      weekStart: selectedWeek,
    },
    {
      enabled: !!selectedWorker,
    }
  );

  const upsertMutation = trpc.availability.upsert.useMutation({
    onSuccess: () => {
      toast.success("排班時間設置已儲存");
      setIsDialogOpen(false);
      refetch();
    },
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

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

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
    if (existing) {
      // 已有設定，直接載入
      setTimeSlots(
        existing.timeSlots.map((ts: any) => ({
          startTime: ts.startTime,
          endTime: ts.endTime,
        }))
      );
    } else {
      // 尚未設定，嘗試載入上週設定
      const lastWeek = new Date(selectedWeek);
      lastWeek.setDate(lastWeek.getDate() - 7);
      
      try {
        const lastWeekData = await utils.availability.getByWeek.fetch({
          workerId: selectedWorker!,
          weekStart: lastWeek,
        });
        
        const lastWeekDay = lastWeekData?.find((a: any) => a.dayOfWeek === dayOfWeek);
        if (lastWeekDay && lastWeekDay.timeSlots.length > 0) {
          // 沿用上週設定
          setTimeSlots(
            lastWeekDay.timeSlots.map((ts: any) => ({
              startTime: ts.startTime,
              endTime: ts.endTime,
            }))
          );
          toast.info("已載入上週設定");
        } else {
          // 上週也沒設定，使用預設值
          setTimeSlots([{ startTime: "09:00", endTime: "17:00" }]);
        }
      } catch (error) {
        // 查詢失敗，使用預設值
        setTimeSlots([{ startTime: "09:00", endTime: "17:00" }]);
      }
    }
    setSelectedDayOfWeek(dayOfWeek);
    setIsDialogOpen(true);
  };

  const handleSaveTimeSlots = () => {
    if (!selectedWorker || selectedDayOfWeek === null) return;

    upsertMutation.mutate({
      workerId: selectedWorker,
      weekStart: selectedWeek,
      dayOfWeek: selectedDayOfWeek,
      timeSlots: timeSlots.map((ts) => ({
        startTime: ts.startTime,
        endTime: ts.endTime,
      })),
    });
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

  const isConfirmed = availabilities?.some((a) => a.confirmed);

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
                  <Button onClick={handleConfirmWeek} disabled={confirmMutation.isPending}>
                    確認本週時間
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-3">
                {WEEKDAYS.map((day, index) => {
                  const dayOfWeek = index + 1;
                  const availability = availabilities?.find((a) => a.dayOfWeek === dayOfWeek);
                  const hasSlots = availability && availability.timeSlots.length > 0;

                  return (
                    <div key={index} className="border rounded-lg p-3 hover:bg-accent transition-colors">
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
                      >
                        {hasSlots ? "編輯" : "設定"}
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
