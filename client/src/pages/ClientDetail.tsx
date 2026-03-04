import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ArrowLeft, Building2, Phone, Mail, MapPin, Calendar, Users, 
  CheckCircle2, XCircle, Clock, Loader2, Plus, FileText, 
  TrendingUp, Briefcase, Copy, Edit, Trash2, RotateCcw
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editBillingType, setEditBillingType] = useState<string>("hourly");
  const [editStatus, setEditStatus] = useState<string>("active");
  const [breakHoursValue, setBreakHoursValue] = useState<string>("0");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  const { data: clientDetail, isLoading: isLoadingClient } = trpc.clients.getDetailById.useQuery({ id: clientId });
  const { data: demandTypes = [] } = trpc.demandTypes.list.useQuery();
  const { data: users = [], isLoading: isLoadingUsers, refetch: refetchUsers } = trpc.clients.listUsers.useQuery({ clientId });
  
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

  const updateClientMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("客戶資料已更新");
      setIsEditDialogOpen(false);
      setLogoFile(null);
      setLogoPreview(null);
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const createUserMutation = trpc.clients.createUser.useMutation({
    onSuccess: () => {
      toast.success("使用者已建立");
      setIsAddUserDialogOpen(false);
      refetchUsers();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const updateUserMutation = trpc.clients.updateUser.useMutation({
    onSuccess: () => {
      toast.success("使用者資料已更新");
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
      refetchUsers();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const deleteUserMutation = trpc.clients.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("使用者已刪除");
      refetchUsers();
      setIsDeleteUserDialogOpen(false);
      setDeletingUserId(null);
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const resetOnboardingMutation = trpc.auth.resetOnboarding.useMutation({
    onSuccess: () => {
      toast.success("已重置引導狀態，該用戶下次登入時將再次看到引導流程");
    },
    onError: (error) => {
      toast.error(`重置失敗：${error.message}`);
    },
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 驗證檔案類型
    if (!file.type.startsWith("image/")) {
      toast.error("請上傳圖片檔案");
      return;
    }

    // 驗證檔案大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast.error("圖片大小不可超過 5MB");
      return;
    }

    setLogoFile(file);

    // 生成預覽
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const compressAndConvertToBase64 = async (file: File): Promise<string> => {
    // 壓縮圖片並轉換為 base64
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = () => {
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        // 轉換為 base64
        const base64 = canvas.toDataURL("image/jpeg", 0.8);
        resolve(base64);
      };

      img.onerror = () => reject(new Error("圖片載入失敗"));
      img.src = URL.createObjectURL(file);
    });
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setIsEditUserDialogOpen(true);
  };

  const handleDeleteUser = (userId: number) => {
    setDeletingUserId(userId);
    setIsDeleteUserDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (deletingUserId) {
      deleteUserMutation.mutate({ userId: deletingUserId });
    }
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
    const breakHours = parseFloat(breakHoursValue) || 0;
    const location = formData.get("location") as string;
    const note = formData.get("note") as string;

    createDemandMutation.mutate({
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
      {/* 返回按鈕與快速操作 */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setLocation("/clients")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          返回客戶列表
        </Button>
        <Button variant="default" onClick={() => setLocation(`/demands?clientId=${clientId}`)} className="gap-2">
          <FileText className="w-4 h-4" />
          前往需求管理
        </Button>
      </div>

      {/* 客戶基本資訊卡片 */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 overflow-hidden">
                  {clientDetail.logoUrl ? (
                    <img src={clientDetail.logoUrl} alt={clientDetail.name} className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-6 h-6 text-primary" />
                  )}
                </div>
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
              <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEditBillingType(clientDetail?.billingType || "hourly"); setEditStatus(clientDetail?.status || "active"); setIsEditDialogOpen(true); }}>
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

      {/* 使用者管理區塊 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>使用者管理</CardTitle>
            <Button size="sm" className="gap-2" onClick={() => setIsAddUserDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              新增使用者
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : users && users.length > 0 ? (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role === "admin" ? "管理員" : "客戶"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {user.email && <span>{user.email}</span>}
                      {user.position && <span className="ml-4">職位：{user.position}</span>}
                      {user.phone && <span className="ml-4">電話：{user.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleEditUser(user)}
                    >
                      <Edit className="w-4 h-4" />
                      編輯
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      title="重置引導後，該用戶下次登入將再次看到 Onboarding 引導流程"
                      disabled={resetOnboardingMutation.isPending}
                      onClick={() => resetOnboardingMutation.mutate({ userId: user.id })}
                    >
                      {resetOnboardingMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      重置引導
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      刪除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>尚無使用者帳號</p>
              <p className="text-sm mt-1">點擊「新增使用者」為該客戶建立帳號</p>
            </div>
          )}
        </CardContent>
      </Card>

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
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4">
              <div className="space-y-2">
              <Label htmlFor="startTime">開始時間 *</Label>
                <Input id="startTime" name="startTime" type="time" required />
              </div>
              <div className="space-y-2">
              <Label htmlFor="endTime">結束時間 *</Label>
                <Input id="endTime" name="endTime" type="time" required />
              </div>
              <div className="space-y-2">
              <Label htmlFor="requiredWorkers">需求人數 *</Label>
                <Input id="requiredWorkers" name="requiredWorkers" type="number" min="1" required />
              </div>
              <div className="space-y-2">
              <Label htmlFor="breakHours">休息時間（小時）</Label>
                <Select value={breakHoursValue} onValueChange={setBreakHoursValue}>
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
              <div className="col-span-2 space-y-2">
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
              {selectedDemandType && selectedDemandType.options && selectedDemandType.options.length > 0 && (
                <div className="col-span-2 p-4 bg-muted/30 rounded-lg space-y-2">
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
              <Label htmlFor="location">地點</Label>
                <Input id="location" name="location" placeholder="工作地點" />
              </div>
              <div className="grid gap-2">
                {/* 空格，保持對齊 */}
              </div>
              <div className="col-span-2 space-y-2">
              <Label htmlFor="note">備註</Label>
                <Textarea id="note" name="note" placeholder="其他說明..." rows={3} />
              </div>
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

      {/* 客戶編輯對話框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>編輯客戶資料</DialogTitle>
            <DialogDescription>
              修改 {clientDetail?.name} 的基本資訊
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            
            let logoUrl = clientDetail?.logoUrl;
            
            // 如果有上傳新的 Logo，先處理圖片
            if (logoFile) {
              try {
                logoUrl = await compressAndConvertToBase64(logoFile);
              } catch (error) {
                toast.error("圖片處理失敗");
                return;
              }
            }
            
            updateClientMutation.mutate({
              id: clientId,
              name: formData.get("name") as string,
              contactName: (formData.get("contactName") as string) || undefined,
              contactEmail: (formData.get("contactEmail") as string) || undefined,
              contactPhone: (formData.get("contactPhone") as string) || undefined,
              address: (formData.get("address") as string) || undefined,
              logoUrl: logoUrl || undefined,
              billingType: editBillingType as "hourly" | "fixed" | "custom",
              status: editStatus as "active" | "inactive",
              note: (formData.get("note") as string) || undefined,
            });
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">客戶名稱 *</Label>
                <Input id="name" name="name" defaultValue={clientDetail?.name} required />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="logo">Logo</Label>
                <div className="flex items-center gap-4">
                  {(logoPreview || clientDetail?.logoUrl) && (
                    <div className="w-16 h-16 rounded-lg border-2 border-border overflow-hidden flex-shrink-0">
                      <img 
                        src={logoPreview || clientDetail?.logoUrl || ""} 
                        alt="Logo" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input 
                      id="logo" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      建議尺寸：200x200，最大 5MB
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">聯絡人</Label>
                <Input id="contactName" name="contactName" defaultValue={clientDetail?.contactName || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">聯絡電話</Label>
                <Input id="contactPhone" name="contactPhone" defaultValue={clientDetail?.contactPhone || ""} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="contactEmail">聯絡 Email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" defaultValue={clientDetail?.contactEmail || ""} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">地址</Label>
                <Textarea id="address" name="address" defaultValue={clientDetail?.address || ""} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingType">計費方式</Label>
                <Select value={editBillingType} onValueChange={setEditBillingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">時薪制</SelectItem>
                    <SelectItem value="fixed">固定費用</SelectItem>
                    <SelectItem value="custom">自訂</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">狀態</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">啟用中</SelectItem>
                    <SelectItem value="inactive">已停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="note">備註</Label>
                <Textarea id="note" name="note" defaultValue={clientDetail?.note || ""} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={updateClientMutation.isPending}>
                {updateClientMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                儲存更改
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 新增使用者對話框 */}
      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增使用者</DialogTitle>
            <DialogDescription>
              為 {clientDetail?.name} 建立新的使用者帳號
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createUserMutation.mutate({
                clientId,
                name: formData.get("name") as string,
                email: formData.get("email") as string,
                position: formData.get("position") as string || undefined,
                phone: formData.get("phone") as string || undefined,
                origin: window.location.origin, // 前端 origin，用於建立登入連結
              });
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名 *</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">職位</Label>
                <Input id="position" name="position" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話</Label>
                <Input id="phone" name="phone" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddUserDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                建立帳號
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 編輯使用者對話框 */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯使用者</DialogTitle>
            <DialogDescription>
              修改 {editingUser?.name} 的資訊
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              updateUserMutation.mutate({
                userId: editingUser.id,
                name: formData.get("name") as string,
                position: formData.get("position") as string || undefined,
                phone: formData.get("phone") as string || undefined,
              });
            }}
          >
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">姓名 *</Label>
                <Input id="edit-name" name="name" defaultValue={editingUser?.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" value={editingUser?.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email 無法修改</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-position">職位</Label>
                <Input id="edit-position" name="position" defaultValue={editingUser?.position} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">電話</Label>
                <Input id="edit-phone" name="phone" defaultValue={editingUser?.phone} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                儲存更改
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 刪除使用者確認對話框 */}
      <AlertDialog open={isDeleteUserDialogOpen} onOpenChange={setIsDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除這個使用者帳號嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。刪除後，該使用者將無法再登入系統。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteUserDialogOpen(false);
              setDeletingUserId(null);
            }}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
