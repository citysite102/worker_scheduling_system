import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, Building2, Phone, Mail, MapPin, Calendar, Users, 
  CheckCircle2, XCircle, Clock, Loader2, Plus, FileText, 
  TrendingUp, Briefcase, Copy, Edit, Trash2
} from "lucide-react";
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
  const [selectedDemandTypeId, setSelectedDemandTypeId] = useState<number | undefined>(undefined);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);

  const { data: clientDetail, isLoading: isLoadingClient } = trpc.clients.getDetailById.useQuery({ id: clientId });
  const { data: demandTypes = [] } = trpc.demandTypes.list.useQuery();
  
  const { data: monthDemands, isLoading: isLoadingDemands, refetch } = trpc.demands.listByClientAndMonth.useQuery({
    clientId,
    year: currentDate.getFullYear(),
    month: currentDate.getMonth() + 1,
  });

  const createDemandMutation = trpc.demands.create.useMutation({
    onSuccess: () => {
      toast.success("需求單已建立");
      setIsCreateDialogOpen(false);
      setSelectedDemandTypeId(undefined);
      setSelectedOptions([]);
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
      demandTypeId: selectedDemandTypeId || undefined,
      selectedOptions: selectedOptions.length > 0 ? JSON.stringify(selectedOptions) : undefined,
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
    
    // 填充前面的空白
    for (let i = 0; i < startDayOfWeek; i++) {
      calendar.push(null);
    }
    
    // 填充日期
    for (let day = 1; day <= daysInMonth; day++) {
      calendar.push(new Date(year, month, day));
    }

    return calendar;
  };

  const getDemandsForDate = (date: Date) => {
    if (!monthDemands) return [];
    return monthDemands.filter((demand: any) => {
      const demandDate = new Date(demand.date);
      return (
        demandDate.getFullYear() === date.getFullYear() &&
        demandDate.getMonth() === date.getMonth() &&
        demandDate.getDate() === date.getDate()
      );
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      draft: { label: "草稿", variant: "secondary" as const },
      confirmed: { label: "已確認", variant: "default" as const },
      cancelled: { label: "已取消", variant: "destructive" as const },
      closed: { label: "已結案", variant: "outline" as const },
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[date.getDay()];
    return `${year}/${month}/${day} ${weekday}`;
  };

  if (isLoadingClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clientDetail) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            找不到客戶資料
          </CardContent>
        </Card>
      </div>
    );
  }

  const calendar = generateCalendar();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  // 計算統計數據
  const totalDemands = clientDetail.stats.totalDemands;
  const confirmedDemands = clientDetail.stats.activeDemands;
  const totalHours = monthDemands?.reduce((sum: number, d: any) => {
    const start = new Date(`2000-01-01T${d.startTime}`);
    const end = new Date(`2000-01-01T${d.endTime}`);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return sum + hours * d.requiredWorkers;
  }, 0) || 0;

  // 計算合作天數（從建立客戶到現在）
  const cooperationDays = Math.floor((Date.now() - new Date(clientDetail.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  // 找出選中的需求類型與選項
  const selectedDemandType = demandTypes.find(t => t.id === selectedDemandTypeId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 返回按鈕 */}
      <Button variant="ghost" onClick={() => setLocation("/clients")} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        返回客戶列表
      </Button>

      {/* 客戶基本資訊卡片 */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-primary" />
                <div>
                  <CardTitle className="text-2xl">{clientDetail.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      {clientDetail.clientCode}
                    </Badge>
                    <Badge variant={clientDetail.status === "active" ? "default" : "secondary"}>
                      {clientDetail.status === "active" ? "啟用中" : "已停用"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Edit className="w-4 h-4" />
                編輯資料
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="w-4 h-4" />
                查看報表
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 聯絡資訊 */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">聯絡資訊</h3>
              <div className="space-y-2">
                {clientDetail.contactName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">聯絡人：</span>
                    <span>{clientDetail.contactName}</span>
                  </div>
                )}
                {clientDetail.contactPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">電話：</span>
                    <span>{clientDetail.contactPhone}</span>
                  </div>
                )}
                {clientDetail.contactEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">Email：</span>
                    <span>{clientDetail.contactEmail}</span>
                  </div>
                )}
                {clientDetail.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-medium">地址：</span>
                      <span>{clientDetail.address}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 計費資訊 */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">計費資訊</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">計費方式：</span>
                  <Badge variant="outline">
                    {clientDetail.billingType === "hourly" && "時薪制"}
                    {clientDetail.billingType === "fixed" && "固定費用"}
                    {clientDetail.billingType === "custom" && "自訂"}
                  </Badge>
                </div>
                {clientDetail.note && (
                  <div className="text-sm">
                    <span className="font-medium">備註：</span>
                    <p className="text-muted-foreground mt-1">{clientDetail.note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">總需求數</p>
                <p className="text-2xl font-bold mt-1">{totalDemands}</p>
              </div>
              <FileText className="w-8 h-8 text-primary/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">已確認需求</p>
                <p className="text-2xl font-bold mt-1">{confirmedDemands}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">本月工時</p>
                <p className="text-2xl font-bold mt-1">{totalHours.toFixed(1)}h</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500/60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">合作天數</p>
                <p className="text-2xl font-bold mt-1">{cooperationDays}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 月曆與需求單 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>需求單管理</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                上個月
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月
              </span>
              <Button variant="outline" size="sm" onClick={handleNextMonth}>
                下個月
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingDemands ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {/* 星期標題 */}
              {weekDays.map((day) => (
                <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              
              {/* 日期格子 */}
              {calendar.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const demands = getDemandsForDate(date);
                const isToday = 
                  date.getDate() === new Date().getDate() &&
                  date.getMonth() === new Date().getMonth() &&
                  date.getFullYear() === new Date().getFullYear();

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    className={`
                      aspect-square rounded-lg border-2 p-2 text-left transition-all
                      hover:border-primary hover:shadow-md
                      ${isToday ? "border-primary bg-primary/5" : "border-border"}
                      ${demands.length > 0 ? "bg-accent/50" : ""}
                    `}
                  >
                    <div className="text-sm font-medium">{date.getDate()}</div>
                    {demands.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {demands.slice(0, 2).map((demand: any) => (
                          <div
                            key={demand.id}
                            className="text-xs px-1 py-0.5 rounded bg-primary/20 text-primary truncate"
                          >
                            {demand.startTime} - {demand.endTime}
                          </div>
                        ))}
                        {demands.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{demands.length - 2} 筆
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 建立需求單對話框 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增用工需求</DialogTitle>
            <DialogDescription>
              為 {selectedDate && formatDate(selectedDate)} 建立新的用工需求
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">開始時間 *</Label>
                <Input id="startTime" name="startTime" type="time" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">結束時間 *</Label>
                <Input id="endTime" name="endTime" type="time" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requiredWorkers">需求人數 *</Label>
                <Input id="requiredWorkers" name="requiredWorkers" type="number" min="1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakHours">休息時間（小時）</Label>
                <Select name="breakHours" defaultValue="0">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">無休息時間</SelectItem>
                    <SelectItem value="0.5">0.5 小時</SelectItem>
                    <SelectItem value="1">1 小時</SelectItem>
                    <SelectItem value="1.5">1.5 小時</SelectItem>
                    <SelectItem value="2">2 小時</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demandTypeId">需求類別</Label>
              <Select 
                value={selectedDemandTypeId?.toString() || "none"} 
                onValueChange={(value) => {
                  setSelectedDemandTypeId(value === "none" ? undefined : parseInt(value));
                  setSelectedOptions([]);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇需求類別（可選）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">無（不選擇）</SelectItem>
                  {demandTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 需求類型選項 */}
            {selectedDemandType && selectedDemandType.options && selectedDemandType.options.length > 0 && (
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <Label>選擇需求項目</Label>
                <div className="space-y-2">
                  {selectedDemandType.options.map((option: any) => (
                    <div key={option.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`option-${option.id}`}
                        checked={selectedOptions.includes(option.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedOptions([...selectedOptions, option.id]);
                          } else {
                            setSelectedOptions(selectedOptions.filter(id => id !== option.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`option-${option.id}`}
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {option.content}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="location">工作地點</Label>
              <Input id="location" name="location" placeholder="選填" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">備註</Label>
              <Textarea id="note" name="note" placeholder="選填" rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsCreateDialogOpen(false);
                setSelectedDemandTypeId(undefined);
                setSelectedOptions([]);
              }}>
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

      {/* 需求單列表對話框 */}
      <Dialog open={isDemandListDialogOpen} onOpenChange={setIsDemandListDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && formatDate(selectedDate)} 的需求單
            </DialogTitle>
            <DialogDescription>
              共 {selectedDateDemands.length} 筆需求單
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedDateDemands.map((demand) => (
              <Card key={demand.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {demand.startTime} - {demand.endTime}
                        </span>
                        {getStatusBadge(demand.status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          需求人數：{demand.requiredWorkers} 人
                        </div>
                        {demand.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {demand.location}
                          </div>
                        )}
                        {demand.note && (
                          <div className="text-xs text-muted-foreground mt-1">
                            備註：{demand.note}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation(`/demands/${demand.id}`)}
                    >
                      查看詳情
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDemandListDialogOpen(false);
                setIsCreateDialogOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              新增需求單
            </Button>
            <Button onClick={() => setIsDemandListDialogOpen(false)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
