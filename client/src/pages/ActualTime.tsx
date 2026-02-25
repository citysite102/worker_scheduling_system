import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, User, AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ActualTime() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: assignments, isLoading, refetch } = trpc.assignments.listByDate.useQuery({
    date: new Date(selectedDate),
  });

  const fillActualTimeMutation = trpc.assignments.fillActualTime.useMutation({
    onSuccess: () => {
      toast.success("實際工時已回填");
      setIsDialogOpen(false);
      setEditingAssignment(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`回填失敗：${error.message}`);
    },
  });

  const handleOpenDialog = (assignment: any) => {
    setEditingAssignment(assignment);
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingAssignment) return;

    const formData = new FormData(e.currentTarget);
    const actualStartTime = formData.get("actualStartTime") as string;
    const actualEndTime = formData.get("actualEndTime") as string;

    fillActualTimeMutation.mutate({
      assignmentId: editingAssignment.id,
      actualStartTime,
      actualEndTime,
    });
  };

  const calculateHours = (startTime: string, endTime: string) => {
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;
    return ((end - start) / 60).toFixed(1);
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
        <p className="text-sm text-muted-foreground mt-1">回填員工的實際出勤時間</p>
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

                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-sm">{assignment.demand.client?.name || "未知客戶"}</span>
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
                    <Button
                      variant={assignment.status === "completed" ? "ghost" : "default"}
                      size="sm"
                      className={`shrink-0 ml-3 text-xs ${assignment.status === "completed" ? "text-muted-foreground" : ""}`}
                      onClick={() => handleOpenDialog(assignment)}
                    >
                      {assignment.status === "completed" ? "修改工時" : "回填工時"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>回填實際工時</DialogTitle>
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
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={fillActualTimeMutation.isPending}>
                {fillActualTimeMutation.isPending ? "儲存中..." : "儲存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
