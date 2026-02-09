import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, Clock, MapPin, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Demands() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data: demands, isLoading, refetch } = trpc.demands.list.useQuery({
    status: statusFilter,
  });

  const { data: clients } = trpc.clients.list.useQuery({});

  const createMutation = trpc.demands.create.useMutation({
    onSuccess: () => {
      toast.success("需求單建立成功");
      setIsDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const dateStr = formData.get("date") as string;
    const date = new Date(dateStr);

    createMutation.mutate({
      clientId: parseInt(formData.get("clientId") as string),
      date,
      startTime: formData.get("startTime") as string,
      endTime: formData.get("endTime") as string,
      requiredWorkers: parseInt(formData.get("requiredWorkers") as string),
      location: (formData.get("location") as string) || undefined,
      note: (formData.get("note") as string) || undefined,
      status: "confirmed",
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">用工需求管理</h1>
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">用工需求管理</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            新增需求單
          </Button>
          <DialogContent className="max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>新增用工需求</DialogTitle>
                <DialogDescription>填寫需求單基本資料</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="clientId">客戶 *</Label>
                  <Select name="clientId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇客戶" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">日期 *</Label>
                  <Input id="date" name="date" type="date" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startTime">開始時間 *</Label>
                    <Input id="startTime" name="startTime" type="time" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endTime">結束時間 *</Label>
                    <Input id="endTime" name="endTime" type="time" required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="requiredWorkers">需求人數 *</Label>
                  <Input id="requiredWorkers" name="requiredWorkers" type="number" min="1" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">地點</Label>
                  <Input id="location" name="location" placeholder="工作地點" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">備註</Label>
                  <Textarea id="note" name="note" placeholder="其他說明..." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "建立中..." : "建立"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Label>狀態篩選</Label>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="confirmed">已確認</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
                <SelectItem value="closed">已結案</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>需求單列表 ({demands?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!demands || demands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">無需求單資料</div>
          ) : (
            <div className="space-y-3">
              {demands.map((demand: any) => {
                const shortage = demand.requiredWorkers - (demand.assignedCount || 0);
                return (
                  <div
                    key={demand.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => setLocation(`/demands/${demand.id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{demand.client?.name || "未知客戶"}</span>
                        <Badge variant={demand.status === "confirmed" ? "default" : "secondary"}>
                          {demand.status === "draft" && "草稿"}
                          {demand.status === "confirmed" && "已確認"}
                          {demand.status === "cancelled" && "已取消"}
                          {demand.status === "closed" && "已結案"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(demand.date).toLocaleDateString("zh-TW")}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {demand.startTime} - {demand.endTime}
                        </div>
                        {demand.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {demand.location}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground">已指派：</span>
                        <span className="font-medium">
                          {demand.assignedCount || 0} / {demand.requiredWorkers}
                        </span>
                      </div>
                      {shortage > 0 && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          缺 {shortage} 人
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
