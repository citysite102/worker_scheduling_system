import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Building2, Phone, Mail, MapPin, Calendar, Users, CheckCircle2, XCircle, Clock, Loader2, Plus } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function ClientDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const clientId = parseInt(params.id || "0");

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDemandListDialogOpen, setIsDemandListDialogOpen] = useState(false);
  const [selectedDateDemands, setSelectedDateDemands] = useState<any[]>([]);

  const { data: clientDetail, isLoading: isLoadingClient } = trpc.clients.getDetailById.useQuery({ id: clientId });
  
  const { data: monthDemands, isLoading: isLoadingDemands, refetch } = trpc.demands.listByClientAndMonth.useQuery({
    clientId,
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });

  const createDemandMutation = trpc.demands.create.useMutation({
    onSuccess: () => {
      toast.success("需求單已建立");
      setIsCreateDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    const demands = getDemandsForDate(date);
    
    if (demands.length > 0) {
      // 當日有需求單：顯示需求清單
      setSelectedDateDemands(demands);
      setIsDemandListDialogOpen(true);
    } else {
      // 當日無需求單：直接建立
      setIsCreateDialogOpen(true);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDate) return;

    const formData = new FormData(e.currentTarget);
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const requiredWorkers = parseInt(formData.get("requiredWorkers") as string);
    const breakHours = parseFloat(formData.get("breakHours") as string) || 0;
    const location = formData.get("location") as string;
    const note = formData.get("note") as string;

    createDemandMutation.mutate({
      clientId,
      date: selectedDate,
      startTime,
      endTime,
      requiredWorkers,
      breakHours,
      location: location || undefined,
      note: note || undefined,
      status: "draft",
    });
  };

  // 生成日曆數據
  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const calendar: (Date | null)[] = [];
    
    // 填充月初空白
    for (let i = 0; i < startDayOfWeek; i++) {
      calendar.push(null);
    }
    
    // 填充日期
    for (let day = 1; day <= daysInMonth; day++) {
      calendar.push(new Date(year, month, day));
    }

    return calendar;
  };

  // 獲取特定日期的需求
  const getDemandsForDate = (date: Date) => {
    if (!monthDemands) return [];
    return monthDemands.filter((d: any) => {
      const demandDate = new Date(d.date);
      return demandDate.getDate() === date.getDate() &&
             demandDate.getMonth() === date.getMonth() &&
             demandDate.getFullYear() === date.getFullYear();
    });
  };

  // 獲取狀態顏色
  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-blue-500";
      case "closed":
        return "bg-green-500";
      case "cancelled":
        return "bg-gray-400";
      default:
        return "bg-yellow-500";
    }
  };

  if (isLoadingClient) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!clientDetail) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <p className="text-muted-foreground">客戶不存在</p>
          <Button onClick={() => setLocation("/clients")} className="mt-4">
            返回客戶列表
          </Button>
        </div>
      </div>
    );
  }

  const calendar = generateCalendar();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/clients")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {clientDetail.logoUrl && (
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              <img src={clientDetail.logoUrl} alt={clientDetail.name} className="w-full h-full object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{clientDetail.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">客戶詳細資料與需求管理</p>
          </div>
        </div>
        <Badge variant={clientDetail.status === "active" ? "default" : "secondary"}>
          {clientDetail.status === "active" ? "合作中" : "已停用"}
        </Badge>
      </div>

      {/* 客戶資訊卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              基本資訊
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {clientDetail.contactName && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">聯絡人：</span>
                <span className="font-medium">{clientDetail.contactName}</span>
              </div>
            )}
            {clientDetail.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">電話：</span>
                <span className="font-medium">{clientDetail.contactPhone}</span>
              </div>
            )}
            {clientDetail.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email：</span>
                <span className="font-medium">{clientDetail.contactEmail}</span>
              </div>
            )}
            {clientDetail.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground">地址：</span>
                  <p className="font-medium">{clientDetail.address}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              需求統計
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">總需求數</span>
              <span className="font-semibold text-lg">{clientDetail.stats.totalDemands}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                已關閉
              </span>
              <span className="font-medium">{clientDetail.stats.closedDemands}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4 text-blue-500" />
                進行中
              </span>
              <span className="font-medium">{clientDetail.stats.activeDemands}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <XCircle className="h-4 w-4 text-gray-400" />
                已取消
              </span>
              <span className="font-medium">{clientDetail.stats.cancelledDemands}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">備註</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {clientDetail.note ? (
              <p className="text-muted-foreground">{clientDetail.note}</p>
            ) : (
              <p className="text-muted-foreground italic">無備註</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar View */}
      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">需求日曆</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                上一月
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月
              </span>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                下一月
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingDemands ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {/* 星期標題 */}
              {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              
              {/* 日期格子 */}
              {calendar.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const demands = getDemandsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    className={`aspect-square border rounded-lg p-2 hover:bg-accent transition-colors relative flex flex-col ${
                      isToday ? "border-primary border-2" : "border-border"
                    }`}
                  >
                    <div className="text-sm font-medium">{date.getDate()}</div>
                    {demands.length > 0 && (
                      <div className="mt-auto space-y-1">
                        {demands.slice(0, 2).map((demand: any) => {
                          const shortage = demand.requiredWorkers - demand.assignedCount;
                          return (
                            <div key={demand.id} className="space-y-0.5">
                              <div
                                className={`h-1.5 rounded-full ${getStatusColor(demand.status)}`}
                                title={`${demand.startTime}-${demand.endTime}`}
                              />
                              <div className="text-[10px] text-muted-foreground leading-none">
                                {demand.assignedCount}/{demand.requiredWorkers}
                                {shortage > 0 && <span className="text-orange-600 ml-0.5">缺{shortage}</span>}
                              </div>
                            </div>
                          );
                        })}
                        {demands.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">+{demands.length - 2}單</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 圖例 */}
          <div className="mt-6 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">草稿</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">已確認</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">已關閉</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-gray-400" />
              <span className="text-muted-foreground">已取消</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 需求清單 Dialog */}
      <Dialog open={isDemandListDialogOpen} onOpenChange={setIsDemandListDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && `${selectedDate.getFullYear()}/${selectedDate.getMonth() + 1}/${selectedDate.getDate()}`} 的需求單
            </DialogTitle>
            <DialogDescription>
              共 {selectedDateDemands.length} 筆需求
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedDateDemands.map((demand: any) => {
              const shortage = demand.requiredWorkers - demand.assignedCount;
              return (
                <Card key={demand.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${
                          demand.status === "draft" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                          demand.status === "confirmed" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          demand.status === "closed" ? "bg-green-50 text-green-700 border-green-200" :
                          "bg-gray-50 text-gray-500 border-gray-200"
                        }`}>
                          {demand.status === "draft" && "草稿"}
                          {demand.status === "confirmed" && "已確認"}
                          {demand.status === "closed" && "已關閉"}
                          {demand.status === "cancelled" && "已取消"}
                        </Badge>
                        <span className="text-sm font-medium">{demand.startTime} - {demand.endTime}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation(`/demands/${demand.id}`)}
                      >
                        查看詳情
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">需求人數：</span>
                        <span className="font-medium">{demand.requiredWorkers} 人</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">已指派：</span>
                        <span className="font-medium">{demand.assignedCount} 人</span>
                        {shortage > 0 && (
                          <span className="text-orange-600 ml-1">(還缺 {shortage} 人)</span>
                        )}
                      </div>
                    </div>
                    
                    {demand.assignedWorkers && demand.assignedWorkers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <div className="text-xs text-muted-foreground mb-2">已指派員工：</div>
                        <div className="flex flex-wrap gap-2">
                          {demand.assignedWorkers.map((worker: any) => (
                            <Button
                              key={worker.assignmentId}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setLocation(`/workers/${worker.id}`)}
                            >
                              <Users className="h-3 w-3 mr-1" />
                              {worker.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {demand.location && (
                      <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {demand.location}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDemandListDialogOpen(false);
                setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              新增需求單
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 建立需求單 Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>建立用工需求</DialogTitle>
            <DialogDescription>
              為 {clientDetail.name} 建立需求單
              {selectedDate && ` - ${selectedDate.getFullYear()}/${selectedDate.getMonth() + 1}/${selectedDate.getDate()}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">開始時間</Label>
                  <Input
                    id="startTime"
                    name="startTime"
                    type="time"
                    required
                    defaultValue="09:00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">結束時間</Label>
                  <Input
                    id="endTime"
                    name="endTime"
                    type="time"
                    required
                    defaultValue="18:00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="requiredWorkers">需求人數</Label>
                  <Input
                    id="requiredWorkers"
                    name="requiredWorkers"
                    type="number"
                    min="1"
                    required
                    defaultValue="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breakHours">休息時間（小時）</Label>
                  <Input
                    id="breakHours"
                    name="breakHours"
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue="1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">工作地點</Label>
                <Input
                  id="location"
                  name="location"
                  defaultValue={clientDetail.address || ""}
                  placeholder="若與客戶地址不同，請填寫"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">備註</Label>
                <Textarea
                  id="note"
                  name="note"
                  placeholder="其他說明事項"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createDemandMutation.isPending}>
                {createDemandMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                建立需求單
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
