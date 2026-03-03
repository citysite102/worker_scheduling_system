import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Edit, UserX, UserCheck, Loader2, Phone, Mail, GraduationCap, ShieldCheck, HeartPulse, Filter, ChevronDown, Upload, UserPlus, Download, MapPin, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { WorkPermitOCRDialog } from "@/components/WorkPermitOCRDialog";
import { BatchWorkPermitUpload } from "@/components/BatchWorkPermitUpload";
import { exportWorkersToCSV } from "@/lib/exportWorkers";
import { DEFAULT_AVATARS } from "../../../shared/avatars";
import { TAIWAN_CITIES } from "../../../shared/cities";
import { cropAndCompressImage, isValidImageFile, isValidImageSize } from "@/lib/imageUtils";

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | undefined>(undefined);
  const [schoolFilter, setSchoolFilter] = useState("");
  const [workPermitFilter, setWorkPermitFilter] = useState<"valid" | "invalid" | "none" | undefined>(undefined);
  const [healthCheckFilter, setHealthCheckFilter] = useState<boolean | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "workPermitExpiry" | "createdAt">("createdAt");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [confirmToggleWorker, setConfirmToggleWorker] = useState<any>(null);
  const [ocrData, setOcrData] = useState<any>(null);
  const [showOCRDialog, setShowOCRDialog] = useState(false);
  const [showBatchUploadDialog, setShowBatchUploadDialog] = useState(false);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<Set<number>>(new Set());
  const [hasWorkPermitChecked, setHasWorkPermitChecked] = useState(false);
  const [workPermitExpiryDate, setWorkPermitExpiryDate] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [deletingWorker, setDeletingWorker] = useState<any>(null);

  const deleteWorkerMutation = trpc.workers.delete.useMutation({
    onSuccess: () => {
      toast.success("員工已成功刪除");
      setDeletingWorker(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`刪除失敗：${error.message}`);
      setDeletingWorker(null);
    },
  });

  const { data: workers, isLoading, refetch } = trpc.workers.list.useQuery({
    search: searchTerm,
    status: statusFilter,
    school: schoolFilter || undefined,
    workPermitStatus: workPermitFilter,
    hasHealthCheck: healthCheckFilter,
  });

  const createMutation = trpc.workers.create.useMutation({
    onSuccess: () => {
      toast.success("員工新增成功");
      setIsDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`新增失敗：${error.message}`);
    },
  });

  const updateMutation = trpc.workers.update.useMutation({
    onSuccess: (_, variables) => {
      if (variables.status) {
        toast.success(variables.status === "inactive" ? "已停用員工" : "已啟用員工");
        setConfirmToggleWorker(null);
        refetch();
      } else {
        toast.success("員工資料更新成功");
        setIsDialogOpen(false);
        setEditingWorker(null);
        refetch();
      }
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
      setConfirmToggleWorker(null);
    },
  });

  // 民國年轉西元年函式（例：115/9/16 → 2026-09-16）
  const convertROCToAD = (rocDate: string): string | null => {
    if (!rocDate) return null;
    const match = rocDate.match(/(\d+)\/(\d+)\/(\d+)/);
    if (!match) return null;
    const [, rocYear, month, day] = match;
    const adYear = parseInt(rocYear) + 1911;
    return `${adYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || undefined,
      school: (formData.get("school") as string) || undefined,
      nationality: (formData.get("nationality") as string) || undefined,
      idNumber: (formData.get("idNumber") as string) || undefined,
      lineId: (formData.get("lineId") as string) || undefined,
      whatsappId: (formData.get("whatsappId") as string) || undefined,
      hasWorkPermit: hasWorkPermitChecked,
      hasHealthCheck: formData.get("hasHealthCheck") === "on",
      // 只有勾選「有工作簽證」時，才提交到期日
      workPermitExpiryDate: hasWorkPermitChecked && workPermitExpiryDate ? new Date(workPermitExpiryDate) : undefined,
      attendanceNotes: (formData.get("attendanceNotes") as string) || undefined,
      avatarUrl: avatarUrl || undefined,
      city: (formData.get("city") as string) || undefined,
      note: (formData.get("note") as string) || undefined,
    };

    if (editingWorker) {
      updateMutation.mutate({ id: editingWorker.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleConfirmToggle = () => {
    if (!confirmToggleWorker) return;
    const newStatus = confirmToggleWorker.status === "active" ? "inactive" : "active";
    updateMutation.mutate({
      id: confirmToggleWorker.id,
      status: newStatus,
    });
  };

  const activeFilterCount = [schoolFilter, workPermitFilter !== undefined, healthCheckFilter !== undefined].filter(Boolean).length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">員工管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理所有員工的基本資料與狀態</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              新增員工
              <ChevronDown className="ml-1 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowBatchUploadDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              批次上傳許可證
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowOCRDialog(true)}>
              <Upload className="mr-2 h-4 w-4" />
              單張圖片新增
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setEditingWorker(null); setOcrData(null); setHasWorkPermitChecked(false); setWorkPermitExpiryDate(""); setIsDialogOpen(true); }}>
              <UserPlus className="mr-2 h-4 w-4" />
              一般新增
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingWorker(null); setHasWorkPermitChecked(false); setWorkPermitExpiryDate(""); } }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingWorker ? "編輯員工" : "新增員工"}</DialogTitle>
                <DialogDescription>填寫員工基本資料</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                {/* 頭像選擇 */}
                <div className="space-y-2">
              <Label>頭像</Label>
                  <div className="flex items-center gap-4">
                    {/* 頭像預覽 */}
                    <div className="relative">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="頭像預覽" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          <UserPlus className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                        >
                          選擇預設頭像
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = "image/*";
                            input.onchange = async (e: any) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              // 驗證檔案類型
                              if (!isValidImageFile(file)) {
                                toast.error("僅支援 JPG、PNG、GIF 或 WebP 格式");
                                return;
                              }

                              // 驗證檔案大小
                              if (!isValidImageSize(file)) {
                                toast.error("檔案大小不可超過 5MB");
                                return;
                              }

                              try {
                                // 裁切與壓縮圖片
                                const compressedBase64 = await cropAndCompressImage(file);
                                setAvatarUrl(compressedBase64);
                                toast.success("頭像已上傳（已繪製至 200x200）");
                              } catch (error) {
                                toast.error("圖片處理失敗，請重試");
                              }
                            };
                            input.click();
                          }}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          上傳圖片
                        </Button>
                      </div>
                      {avatarUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setAvatarUrl("");
                            toast.success("已清除頭像");
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          清除頭像
                        </Button>
                      )}
                    </div>
                  </div>
                  {showAvatarPicker && (
                    <div className="grid grid-cols-4 gap-3 p-4 border rounded-lg">
                      {DEFAULT_AVATARS.map((url, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setAvatarUrl(url);
                            setShowAvatarPicker(false);
                          }}
                          className="w-full aspect-square rounded-full overflow-hidden border-2 hover:border-primary transition-colors"
                        >
                          <img src={url} alt={`預設頭像 ${index + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
                    <Input id="name" name="name" defaultValue={editingWorker?.name || ocrData?.name} required key={ocrData?.name} />
                  </div>
                  <div className="space-y-2">
              <Label htmlFor="phone">電話</Label>
                    <Input id="phone" name="phone" defaultValue={editingWorker?.phone} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={editingWorker?.email} />
                  </div>
                  <div className="space-y-2">
              <Label htmlFor="school">學校</Label>
                    <Input id="school" name="school" defaultValue={editingWorker?.school || ocrData?.school} placeholder="例：台大、政大" key={ocrData?.school} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
              <Label htmlFor="nationality">國籍</Label>
                    <Input id="nationality" name="nationality" defaultValue={editingWorker?.nationality || ocrData?.nationality} placeholder="例：印尼、越南" key={ocrData?.nationality} />
                  </div>
                  <div className="space-y-2">
              <Label htmlFor="idNumber">統一證號</Label>
                    <Input id="idNumber" name="idNumber" defaultValue={editingWorker?.idNumber || ocrData?.uiNumber} placeholder="例：H801403696" key={ocrData?.uiNumber} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
              <Label htmlFor="city">所在縣市</Label>
                    <Select name="city" defaultValue={editingWorker?.city || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇縣市" />
                      </SelectTrigger>
                      <SelectContent>
                        {TAIWAN_CITIES.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2.5" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
              <Label htmlFor="lineId">Line ID</Label>
                    <Input id="lineId" name="lineId" defaultValue={editingWorker?.lineId} placeholder="例：@username" />
                  </div>
                  <div className="space-y-2">
              <Label htmlFor="whatsappId">WhatsApp ID</Label>
                    <Input id="whatsappId" name="whatsappId" defaultValue={editingWorker?.whatsappId} placeholder="例：+886912345678" />
                  </div>
                </div>
                <div className="flex gap-8 pt-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasWorkPermit"
                      name="hasWorkPermit"
                      checked={hasWorkPermitChecked}
                      onCheckedChange={(checked) => {
                        setHasWorkPermitChecked(checked === true);
                        if (!checked) {
                          setWorkPermitExpiryDate(""); // 取消勾選時清空到期日
                        }
                      }}
                    />
                    <Label htmlFor="hasWorkPermit" className="text-sm font-normal cursor-pointer">有工作簽證</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasHealthCheck"
                      name="hasHealthCheck"
                      defaultChecked={editingWorker?.hasHealthCheck === 1}
                    />
                    <Label htmlFor="hasHealthCheck" className="text-sm font-normal cursor-pointer">有體檢</Label>
                  </div>
                </div>
                <div className="space-y-2">
              <Label htmlFor="workPermitExpiryDate" className={!hasWorkPermitChecked ? "text-muted-foreground" : ""}>工作許可到期日</Label>
                  <Input 
                    id="workPermitExpiryDate" 
                    name="workPermitExpiryDate" 
                    type="date" 
                    disabled={!hasWorkPermitChecked}
                    value={hasWorkPermitChecked ? workPermitExpiryDate : ''}
                    onChange={(e) => setWorkPermitExpiryDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{hasWorkPermitChecked ? '留空表示無期限' : '請先勾選「有工作簽證」才能設定到期日'}</p>
                </div>
                <div className="space-y-2">
              <Label htmlFor="attendanceNotes">出勤記錄（遲到/曠職）</Label>
                  <Textarea id="attendanceNotes" name="attendanceNotes" defaultValue={editingWorker?.attendanceNotes} placeholder="記錄員工的遲到、曠職或其他出勤問題" />
                </div>
                <div className="space-y-2">
              <Label htmlFor="note">備註</Label>
                  <Textarea id="note" name="note" defaultValue={editingWorker?.note} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingWorker ? "更新" : "新增"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 搜尋與篩選 */}
      <Card className="mb-6 shadow-md border-border/40">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋姓名、電話、Email、學校..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value as "active" | "inactive")}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 relative"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-1.5" />
              篩選
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="學校篩選"
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  className="h-8 w-[160px] text-sm"
                />
              </div>
              <Select
                value={workPermitFilter || "all"}
                onValueChange={(value) => setWorkPermitFilter(value === "all" ? undefined : value as "valid" | "invalid" | "none")}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="工作簽證" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">簽證</SelectItem>
                  <SelectItem value="valid">簽證有效</SelectItem>
                  <SelectItem value="invalid">簽證無效</SelectItem>
                  <SelectItem value="none">無簽證</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={healthCheckFilter === undefined ? "all" : healthCheckFilter ? "yes" : "no"}
                onValueChange={(value) => setHealthCheckFilter(value === "all" ? undefined : value === "yes")}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <HeartPulse className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="體檢" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">體檢</SelectItem>
                  <SelectItem value="yes">有體檢</SelectItem>
                  <SelectItem value="no">無體檢</SelectItem>
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => {
                    setSchoolFilter("");
                    setWorkPermitFilter(undefined);
                    setHealthCheckFilter(undefined);
                  }}
                >
                  清除篩選
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 員工列表 */}
      <Card className="shadow-md border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base font-medium">員工列表</CardTitle>
              {selectedWorkerIds.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (!workers) return;
                    const selectedWorkers = workers.filter(w => selectedWorkerIds.has(w.id));
                    exportWorkersToCSV(selectedWorkers);
                    toast.success(`已匯出 ${selectedWorkers.length} 位員工資料`);
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  匯出選定員工 ({selectedWorkerIds.size})
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {workers && workers.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (selectedWorkerIds.size === workers.length) {
                      setSelectedWorkerIds(new Set());
                    } else {
                      setSelectedWorkerIds(new Set(workers.map(w => w.id)));
                    }
                  }}
                >
                  {selectedWorkerIds.size === workers.length ? "取消全選" : "全選"}
                </Button>
              )}
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as "name" | "workPermitExpiry")}
              >
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">按建立日期排序</SelectItem>
                  <SelectItem value="name">按姓名排序</SelectItem>
                  <SelectItem value="workPermitExpiry">按簽證到期排序</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{workers?.length || 0} 位員工</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !workers || workers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">無員工資料</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                // 排序邏輯
                const sortedWorkers = [...workers].sort((a, b) => {
                  if (sortBy === "createdAt") {
                    // 按照建立日期排序（最新的在最前）
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  } else if (sortBy === "workPermitExpiry") {
                    // 按照簽證到期日排序（無到期日的排在最後）
                    if (!a.workPermitExpiryDate && !b.workPermitExpiryDate) return 0;
                    if (!a.workPermitExpiryDate) return 1;
                    if (!b.workPermitExpiryDate) return -1;
                    return new Date(a.workPermitExpiryDate).getTime() - new Date(b.workPermitExpiryDate).getTime();
                  } else {
                    // 按照姓名排序
                    return a.name.localeCompare(b.name, 'zh-TW');
                  }
                });
                return sortedWorkers;
              })().map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    checked={selectedWorkerIds.has(worker.id)}
                    onCheckedChange={(checked) => {
                      const newSet = new Set(selectedWorkerIds);
                      if (checked) {
                        newSet.add(worker.id);
                      } else {
                        newSet.delete(worker.id);
                      }
                      setSelectedWorkerIds(newSet);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* 頭像 */}
                  <div className="shrink-0">
                    {worker.avatarUrl ? (
                      <img
                        src={worker.avatarUrl}
                        alt={worker.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-border/60"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium text-sm border-2 border-border/60">
                        {worker.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/workers/${worker.id}`} className="font-medium text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">{worker.name}</Link>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          worker.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        {worker.status === "active" ? "啟用" : "停用"}
                      </Badge>
                      {worker.hasWorkPermit === 1 && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          簽證
                        </Badge>
                      )}
                      {worker.hasHealthCheck === 1 && (
                        <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                          <HeartPulse className="h-3 w-3 mr-1" />
                          體檢
                        </Badge>
                      )}
                      {(() => {
                        if (!worker.workPermitExpiryDate) return null;
                        const expiryDate = new Date(worker.workPermitExpiryDate);
                        const today = new Date();
                        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        
                        if (daysUntilExpiry < 0) {
                          return (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              許可已過期
                            </Badge>
                          );
                        } else if (daysUntilExpiry <= 30) {
                          return (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              許可 {daysUntilExpiry} 天到期
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {worker.phone}
                      </span>
                      {worker.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {worker.email}
                        </span>
                      )}
                      {worker.school && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          {worker.school}
                        </span>
                      )}
                      {worker.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {worker.city}
                        </span>
                      )}
                    </div>
                    {worker.note && (
                      <div className="text-xs text-muted-foreground mt-1">{worker.note}</div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditingWorker(worker);
                        setHasWorkPermitChecked(worker.hasWorkPermit === 1);
                        setWorkPermitExpiryDate(
                          worker.workPermitExpiryDate 
                            ? new Date(worker.workPermitExpiryDate).toISOString().split('T')[0]
                            : ""
                        );
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        worker.status === "active"
                          ? "text-muted-foreground hover:text-destructive"
                          : "text-muted-foreground hover:text-emerald-600"
                      }`}
                      onClick={() => setConfirmToggleWorker(worker)}
                      disabled={updateMutation.isPending}
                    >
                      {worker.status === "active" ? (
                        <UserX className="h-3.5 w-3.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingWorker(worker)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}  
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmToggleWorker} onOpenChange={(open) => !open && setConfirmToggleWorker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggleWorker?.status === "active" ? "確認停用員工" : "確認啟用員工"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggleWorker?.status === "active" ? (
                <>
                  您確定要停用員工 <strong>{confirmToggleWorker?.name}</strong> 嗎？
                  <br />
                  停用後，該員工將無法被指派至新的排班。
                </>
              ) : (
                <>
                  您確定要啟用員工 <strong>{confirmToggleWorker?.name}</strong> 嗎？
                  <br />
                  啟用後，該員工將可以被指派至排班。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {updateMutation.isPending ? "處理中..." : "確認"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除員工確認對話框 */}
      <AlertDialog open={!!deletingWorker} onOpenChange={(open) => { if (!open) setDeletingWorker(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除員工</AlertDialogTitle>
            <AlertDialogDescription>
              您確定要刪除員工「<strong>{deletingWorker?.name}</strong>」嗎？
              <br />
              此操作無法復原。若該員工有進行中的指派，系統將阻止刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteWorkerMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteWorkerMutation.isPending}
              onClick={() => {
                if (deletingWorker) {
                  deleteWorkerMutation.mutate({ id: deletingWorker.id });
                }
              }}
            >
              {deleteWorkerMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />刪除中...</>
              ) : "確認刪除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WorkPermitOCRDialog
        open={showOCRDialog}
        onOpenChange={setShowOCRDialog}
        onOCRSuccess={(data) => {
          setOcrData(data);
          setEditingWorker(null);
          setHasWorkPermitChecked(true); // OCR 識別到簽證，預設勾選
          // 設定到期日（如果有）
          if (data.validityPeriodEnd) {
            const convertedDate = convertROCToAD(data.validityPeriodEnd);
            if (convertedDate) {
              setWorkPermitExpiryDate(convertedDate);
            }
          }
          setIsDialogOpen(true);
          toast.success("資料已自動填入，請確認後送出");
        }}
      />

      <BatchWorkPermitUpload
        open={showBatchUploadDialog}
        onClose={() => setShowBatchUploadDialog(false)}
        onSuccess={() => {
          refetch();
          setSelectedWorkerIds(new Set());
        }}
      />
    </div>
  );
}
