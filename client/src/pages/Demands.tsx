import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, Clock, MapPin, AlertTriangle, Loader2, ArrowRight, Copy, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Demands() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "thisWeek" | "nextWeek" | "thisMonth" | "custom">("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<number | undefined>(undefined);

  // 計算日期範圍
  const getDateRange = (filter: typeof dateFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case "today":
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      
      case "thisWeek": {
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(today.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: monday, end: sunday };
      }
      
      case "nextWeek": {
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const thisMonday = new Date(today.getTime() + mondayOffset * 24 * 60 * 60 * 1000);
        const nextMonday = new Date(thisMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextSunday = new Date(nextMonday.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: nextMonday, end: nextSunday };
      }
      
      case "thisMonth": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        return { start: firstDay, end: lastDay };
      }
      
      case "custom": {
        if (!customStartDate || !customEndDate) return null;
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59);
        return { start, end };
      }
      
      default:
        return null;
    }
  };

  const { data: demands, isLoading, refetch } = trpc.demands.list.useQuery({
    status: statusFilter,
  });

  const { data: clients } = trpc.clients.list.useQuery({});

  const createMutation = trpc.demands.create.useMutation({
    onSuccess: () => {
      toast.success("需求單建立成功");
      setIsDialogOpen(false);
      setEditingDemand(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const updateMutation = trpc.demands.update.useMutation({
    onSuccess: () => {
      toast.success("需求單更新成功");
      setIsDialogOpen(false);
      setEditingDemand(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const cancelMutation = trpc.demands.cancel.useMutation({
    onSuccess: () => {
      toast.success("需求單已取消");
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const duplicateMutation = trpc.demands.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success("需求單複製成功");
      // 直接跳轉，不需要 refetch 避免競態條件
      setLocation(`/demands/${data.newDemandId}`);
    },
    onError: (error) => {
      toast.error(`複製失敗：${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dateStr = formData.get("date") as string;
    const date = new Date(dateStr);

    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;

    // 驗證結束時間不能於開始時間
    if (startTime && endTime && endTime <= startTime) {
      toast.error("結束時間必須晚於開始時間");
      return;
    }

    const data = {
      clientId: parseInt(formData.get("clientId") as string),
      date,
      startTime,
      endTime,
      requiredWorkers: parseInt(formData.get("requiredWorkers") as string),
      breakHours: parseFloat(formData.get("breakHours") as string) || 0,
      location: (formData.get("location") as string) || undefined,
      note: (formData.get("note") as string) || undefined,
    };

    if (editingDemand) {
      updateMutation.mutate({ id: editingDemand.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCancel = (id: number) => {
    if (confirm("確定要取消這個需求單嗎？取消後需求單狀態將變為「已取消」。")) {
      cancelMutation.mutate({ id });
    }
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: "草稿", className: "bg-gray-50 text-gray-600 border-gray-200" },
    confirmed: { label: "已確認", className: "bg-blue-50 text-blue-700 border-blue-200" },
    cancelled: { label: "已取消", className: "bg-red-50 text-red-600 border-red-200" },
    closed: { label: "已結案", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">用工需求管理</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">用工需求管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理客戶的用工需求單與人力指派</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingDemand(null);
        }}>
          <Button onClick={() => {
            setEditingDemand(null);
            setIsDialogOpen(true);
          }} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            新增需求單
          </Button>
          <DialogContent className="max-w-md">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingDemand ? "編輯用工需求" : "新增用工需求"}</DialogTitle>
                <DialogDescription>填寫需求單基本資料</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="clientId">客戶 *</Label>
                  <Select name="clientId" defaultValue={editingDemand?.clientId?.toString()} required>
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
                  <Input 
                    id="date" 
                    name="date" 
                    type="date" 
                    defaultValue={editingDemand?.date ? new Date(editingDemand.date).toISOString().split('T')[0] : ''}
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startTime">開始時間 *</Label>
                    <Input id="startTime" name="startTime" type="time" defaultValue={editingDemand?.startTime} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endTime">結束時間 *</Label>
                    <Input id="endTime" name="endTime" type="time" defaultValue={editingDemand?.endTime} required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="requiredWorkers">需求人數 *</Label>
                  <Input id="requiredWorkers" name="requiredWorkers" type="number" min="1" defaultValue={editingDemand?.requiredWorkers} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="breakHours">休息時間（小時）</Label>
                  <Input 
                    id="breakHours" 
                    name="breakHours" 
                    type="number" 
                    step="0.25" 
                    min="0" 
                    placeholder="例如：0.75 小時 = 45 分鐘" 
                    defaultValue={editingDemand?.breakHours ? (editingDemand.breakHours / 60).toString() : "0"} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="location">地點</Label>
                  <Input id="location" name="location" placeholder="工作地點" defaultValue={editingDemand?.location} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">備註</Label>
                  <Textarea id="note" name="note" placeholder="其他說明..." rows={3} defaultValue={editingDemand?.note} />
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

      {/* 篩選 */}
      <Card className="mb-6 shadow-sm border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm text-muted-foreground shrink-0">狀態篩選</Label>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value)}
            >
              <SelectTrigger className="w-[140px] h-9">
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
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant={dateFilter === "all" ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setDateFilter("all")}
              >
                全部
              </Button>
              <Button
                variant={dateFilter === "today" ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setDateFilter("today")}
              >
                今日
              </Button>
              <Button
                variant={dateFilter === "thisWeek" ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setDateFilter("thisWeek")}
              >
                本週
              </Button>
              <Button
                variant={dateFilter === "nextWeek" ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setDateFilter("nextWeek")}
              >
                下週
              </Button>
              <Button
                variant={dateFilter === "thisMonth" ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setDateFilter("thisMonth")}
              >
                本月
              </Button>
              <Button
                variant={dateFilter === "custom" ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setDateFilter("custom")}
              >
                自訂區間
              </Button>
            </div>
            
            {/* 自訂日期區間選擇器 */}
            {dateFilter === "custom" && (
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-sm text-muted-foreground shrink-0">開始日期</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-[150px] h-9"
                />
                <Label className="text-sm text-muted-foreground shrink-0">結束日期</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-[150px] h-9"
                />
              </div>
            )}
            
            <Label className="text-sm text-muted-foreground shrink-0">客戶篩選</Label>
            <Select
              value={clientFilter?.toString() || "all"}
              onValueChange={(value) => setClientFilter(value === "all" ? undefined : parseInt(value))}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="全部客戶" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部客戶</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 需求單列表 */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">需求單列表</CardTitle>
            <span className="text-xs text-muted-foreground">{demands?.length || 0} 筆需求</span>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            if (!demands || demands.length === 0) {
              return <div className="text-center py-10 text-muted-foreground text-sm">無需求單資料</div>;
            }

            // 根據日期和客戶篩選過濾需求單
            const dateRange = getDateRange(dateFilter);
            let filteredDemands = dateRange
              ? demands.filter((demand: any) => {
                  const demandDate = new Date(demand.date);
                  return demandDate >= dateRange.start && demandDate < dateRange.end;
                })
              : demands;
            
            // 根據客戶篩選
            if (clientFilter) {
              filteredDemands = filteredDemands.filter((demand: any) => demand.clientId === clientFilter);
            }

            if (filteredDemands.length === 0) {
              return <div className="text-center py-10 text-muted-foreground text-sm">無符合條件的需求單</div>;
            }

            return (
              <div className="space-y-2">
                {filteredDemands.map((demand: any) => {
                const shortage = demand.requiredWorkers - (demand.assignedCount || 0);
                const sc = statusConfig[demand.status] || statusConfig.draft;
                return (
                  <div
                    key={demand.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => setLocation(`/demands/${demand.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-sm">{demand.client?.name || "未知客戶"}</span>
                        <Badge variant="outline" className={`text-xs ${sc.className}`}>
                          {sc.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(demand.date).toLocaleDateString("zh-TW")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {demand.startTime} - {demand.endTime}
                        </span>
                        {demand.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {demand.location}
                          </span>
                        )}
                        {demand.createdAt && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                            建立於 {new Date(demand.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 ml-3">
                      <span className="text-sm tabular-nums">
                        <span className="font-semibold">{demand.assignedCount || 0}</span>
                        <span className="text-muted-foreground"> / {demand.requiredWorkers}</span>
                      </span>
                      {shortage > 0 && (
                        <Badge variant="destructive" className="gap-1 text-xs font-medium">
                          <AlertTriangle className="h-3 w-3" />
                          缺 {shortage} 人
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingDemand(demand);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateMutation.mutate({ id: demand.id });
                        }}
                        disabled={duplicateMutation.isPending}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(demand.id);
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                  </div>
                );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
