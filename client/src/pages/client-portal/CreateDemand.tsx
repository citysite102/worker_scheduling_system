import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateMultiPicker } from "@/components/DateMultiPicker";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export function CreateDemand() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  // user 角色同樣需要選擇客戶來建立需求單
  const isStaffRole = user?.role === "admin" || user?.role === "user";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDemandTypeId, setSelectedDemandTypeId] = useState<number | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  
  // Admin 代建：選擇的客戶 ID
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);

  // 批次模式狀態
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

  // 取得需求類型列表
  const { data: demandTypes } = trpc.demandTypes.list.useQuery();

  // Admin / User 都需要取得客戶列表
  const { data: clients } = trpc.clients.list.useQuery(
    { status: "active" },
    { enabled: isStaffRole }
  );

  const createMutation = trpc.demands.create.useMutation({
    onSuccess: () => {
      toast.success("需求單已成功提交，等待內部審核。");
      setLocation("/client-portal/demands");
    },
    onError: (error) => {
      toast.error(error.message || "提交需求單時發生錯誤，請稍後再試。");
      setIsSubmitting(false);
    },
  });

  const createBatchMutation = trpc.demands.createBatch.useMutation({
    onSuccess: (result) => {
      if (result.failed > 0) {
        toast.warning(`已成功建立 ${result.succeeded} 筆需求單，${result.failed} 筆失敗。`);
      } else {
        toast.success(`已成功建立 ${result.succeeded} 筆需求單！`);
      }
      setLocation("/client-portal/demands");
    },
    onError: (error) => {
      toast.error(error.message || "批次建立需求單時發生錯誤，請稍後再試。");
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Admin / User 代建時必須先選擇客戶
    if (isStaffRole && !selectedClientId) {
      toast.error("請先選擇要代替建立需求單的客戶。");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const date = formData.get("date") as string;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const requiredWorkers = parseInt(formData.get("requiredWorkers") as string);
    const location = formData.get("location") as string;
    const demandTypeId = formData.get("demandTypeId") as string;
    const note = formData.get("note") as string;

    // 將選取的選項 ID 轉為 JSON 字串
    const selectedOptionsJson = selectedOptionIds.length > 0 ? JSON.stringify(selectedOptionIds) : undefined;

    // 驗證時間邏輯
    if (startTime >= endTime) {
      toast.error("結束時間必須晚於開始時間。");
      setIsSubmitting(false);
      return;
    }

    // 驗證需求人數
    if (requiredWorkers <= 0) {
      toast.error("需求人數必須大於 0。");
      setIsSubmitting(false);
      return;
    }

    // 批次模式
    if (isBatchMode) {
      if (selectedDates.length === 0) {
        toast.error("請至少選擇一個日期。");
        setIsSubmitting(false);
        return;
      }

      // 顯示確認對話框
      setPendingFormData({
        dates: selectedDates,
        startTime,
        endTime,
        requiredWorkers,
        location: location || undefined,
        demandTypeId: demandTypeId ? parseInt(demandTypeId) : undefined,
        selectedOptions: selectedOptionsJson,
        note: note || undefined,
        ...(isStaffRole && selectedClientId ? { clientId: selectedClientId } : {}),
      });
      setShowConfirmDialog(true);
      setIsSubmitting(false);
      return;
    }

    // 單一日期模式
    if (!date) {
      toast.error("請選擇日期。");
      setIsSubmitting(false);
      return;
    }

    try {
      await createMutation.mutateAsync({
        date: new Date(date),
        startTime,
        endTime,
        requiredWorkers,
        location: location || undefined,
        demandTypeId: demandTypeId ? parseInt(demandTypeId) : undefined,
        selectedOptions: selectedOptionsJson,
        note: note || undefined,
        ...(isStaffRole && selectedClientId ? { clientId: selectedClientId } : {}),
      });
    } catch (error) {
      // Error handling is done in onError callback
    }
  };

  const handleConfirmBatchCreate = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      await createBatchMutation.mutateAsync(pendingFormData);
    } catch (error) {
      // Error handling is done in onError callback
    }
  };

  const minDate = new Date();
  minDate.setHours(0, 0, 0, 0);

  const selectedClient = clients?.find((c) => c.id === selectedClientId);

  return (
    <ClientPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation("/client-portal/demands")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回需求列表
          </Button>
        </div>

        <Card className="max-w-2xl shadow-md border-border/40">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <CardTitle>建立新需求單</CardTitle>
              {isStaffRole && (
                <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/30 gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {isAdmin ? "管理員代建" : "內部人員代建"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isStaffRole
                ? "以內部人員身份代替客戶建立需求單，請先選擇目標客戶。"
                : "填寫以下資訊建立用工需求單，提交後將由內部人員審核並指派員工。"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Admin / User 代建：客戶選擇器 */}
              {isStaffRole && (
                <div className="space-y-2 p-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                  <Label htmlFor="admin-client-select" className="text-amber-700 dark:text-amber-400 font-medium">
                    代替客戶建立 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    onValueChange={(value) => setSelectedClientId(parseInt(value))}
                  >
                    <SelectTrigger className="w-full border-amber-300 dark:border-amber-700">
                      <SelectValue placeholder="請選擇客戶公司..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedClient && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      此需求單將建立於「{selectedClient.name}」帳下
                    </p>
                  )}
                </div>
              )}

              {/* 批次模式切換 */}
              <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="space-y-0.5">
                  <Label htmlFor="batch-mode" className="text-base font-medium">
                    批次建立模式
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    一次選擇多個日期，快速建立相同設定的需求單
                  </p>
                </div>
                <Switch
                  id="batch-mode"
                  checked={isBatchMode}
                  onCheckedChange={(checked) => {
                    setIsBatchMode(checked);
                    if (!checked) {
                      setSelectedDates([]);
                    }
                  }}
                />
              </div>

              {/* 日期選擇 */}
              <div className="space-y-2">
                <Label htmlFor={isBatchMode ? undefined : "date"}>
                  日期 <span className="text-destructive">*</span>
                </Label>
                {isBatchMode ? (
                  <DateMultiPicker
                    selectedDates={selectedDates}
                    onDatesChange={setSelectedDates}
                    minDate={minDate}
                  />
                ) : (
                  <Input
                    type="date"
                    id="date"
                    name="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                  />
                )}
              </div>

              {/* 時間範圍 */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startTime">
                    開始時間 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="time"
                    id="startTime"
                    name="startTime"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">
                    結束時間 <span className="text-destructive">*</span>
                  </Label>
                  <Input type="time" id="endTime" name="endTime" required />
                </div>
              </div>

              {/* 需求人數 */}
              <div className="space-y-2">
                <Label htmlFor="requiredWorkers">
                  需求人數 <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  id="requiredWorkers"
                  name="requiredWorkers"
                  required
                  min="1"
                  placeholder="請輸入需求人數"
                />
              </div>

              {/* 地點 */}
              <div className="space-y-2">
                <Label htmlFor="location">地點</Label>
                <Input
                  type="text"
                  id="location"
                  name="location"
                  placeholder="請輸入工作地點"
                />
              </div>

              {/* 需求類型 */}
              <div className="space-y-2">
                <Label htmlFor="demandTypeId">需求類型</Label>
                <Select 
                  name="demandTypeId"
                  onValueChange={(value) => {
                    const typeId = parseInt(value);
                    setSelectedDemandTypeId(typeId);
                    setSelectedOptionIds([]); // 清空已選取的選項
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="請選擇需求類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {demandTypes?.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 需求類型選項 */}
              {selectedDemandTypeId && (() => {
                const selectedType = demandTypes?.find(t => t.id === selectedDemandTypeId);
                if (!selectedType || !selectedType.options || selectedType.options.length === 0) {
                  return null;
                }
                return (
                  <div className="space-y-3">
                    <Label>選項清單</Label>
                    <div className="space-y-2 rounded-lg border p-4">
                      {selectedType.options.map((option) => (
                        <div key={option.id} className="flex items-start gap-3">
                          <Checkbox
                            id={`option-${option.id}`}
                            checked={selectedOptionIds.includes(option.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedOptionIds([...selectedOptionIds, option.id]);
                              } else {
                                setSelectedOptionIds(selectedOptionIds.filter(id => id !== option.id));
                              }
                            }}
                          />
                          <Label
                            htmlFor={`option-${option.id}`}
                            className="cursor-pointer font-normal leading-relaxed"
                          >
                            {option.content}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* 備註 */}
              <div className="space-y-2">
                <Label htmlFor="note">備註</Label>
                <Textarea
                  id="note"
                  name="note"
                  placeholder="請輸入其他需求或備註事項"
                  rows={4}
                />
              </div>

              {/* 提交按鈕 */}
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isSubmitting || (isAdmin && !selectedClientId)}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isBatchMode ? `批次建立需求單` : `提交需求單`}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => setLocation("/client-portal/demands")}
                >
                  取消
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* 批次建立確認對話框 */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認批次建立需求單</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>您即將建立 <span className="font-semibold text-foreground">{selectedDates.length}</span> 筆需求單，所有需求單將使用相同的設定（時間、地點、人數等），僅日期不同。</p>
              {isAdmin && selectedClient && (
                <p className="text-sm font-medium text-amber-600">客戶：{selectedClient.name}</p>
              )}
              <p className="text-sm text-muted-foreground">提交後將由內部人員審核並指派員工。</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBatchCreate}>
              確認建立
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ClientPortalLayout>
  );
}
