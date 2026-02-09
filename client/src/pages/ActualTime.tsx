import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, User, AlertCircle, Loader2 } from "lucide-react";
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
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">實際工時回填</h1>
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">實際工時回填</h1>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label>選擇日期</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-[200px]"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {new Date(selectedDate).toLocaleDateString("zh-TW")} 的排班記錄 ({assignments?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!assignments || assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">該日期無排班記錄</div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment: any) => {
                const plannedHours = calculateHours(assignment.demand.startTime, assignment.demand.endTime);
                const actualHours = assignment.actualStartTime && assignment.actualEndTime
                  ? calculateHours(assignment.actualStartTime, assignment.actualEndTime)
                  : null;
                const variance = actualHours ? (parseFloat(actualHours) - parseFloat(plannedHours)).toFixed(1) : null;

                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{assignment.demand.client?.name || "未知客戶"}</span>
                        <Badge variant={assignment.status === "completed" ? "default" : "secondary"}>
                          {assignment.status === "assigned" && "已指派"}
                          {assignment.status === "completed" && "已完成"}
                          {assignment.status === "disputed" && "有爭議"}
                        </Badge>
                        {assignment.status === "disputed" && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            時段重疊
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {assignment.worker?.name || "未知員工"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          預計：{assignment.demand.startTime} - {assignment.demand.endTime} ({plannedHours}h)
                        </div>
                        {actualHours && (
                          <>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              實際：{assignment.actualStartTime} - {assignment.actualEndTime} ({actualHours}h)
                            </div>
                            {variance && parseFloat(variance) !== 0 && (
                              <div className={`flex items-center gap-1 ${parseFloat(variance) > 0 ? "text-orange-600" : "text-green-600"}`}>
                                差異：{parseFloat(variance) > 0 ? "+" : ""}{variance}h
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={assignment.status === "completed" ? "outline" : "default"}
                      size="sm"
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
              <div className="grid gap-2">
                <Label htmlFor="actualStartTime">實際開始時間 *</Label>
                <Input
                  id="actualStartTime"
                  name="actualStartTime"
                  type="time"
                  defaultValue={editingAssignment?.actualStartTime || editingAssignment?.demand.startTime}
                  required
                />
              </div>
              <div className="grid gap-2">
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
