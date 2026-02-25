import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2, Edit, Save, X } from "lucide-react";
import { toast } from "sonner";

export function DemandDetail() {
  const [, params] = useRoute("/client-portal/demands/:id");
  const [, setLocation] = useLocation();
  const demandId = params?.id ? parseInt(params.id) : null;

  const [isEditing, setIsEditing] = useState(false);
  const [selectedDemandTypeId, setSelectedDemandTypeId] = useState<number | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);

  // 查詢需求單資料
  const { data: demand, isLoading, refetch } = trpc.demands.getById.useQuery(
    { id: demandId || 0 },
    { enabled: !!demandId }
  );

  // 取得需求類型列表
  const { data: demandTypes } = trpc.demandTypes.list.useQuery();

  // 更新需求單
  const updateMutation = trpc.demands.update.useMutation({
    onSuccess: () => {
      toast.success("需求單已成功更新");
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "更新需求單時發生錯誤");
    },
  });

  // 初始化選取的需求類型和選項
  useEffect(() => {
    if (demand) {
      setSelectedDemandTypeId(demand.demandTypeId || null);
      if (demand.selectedOptions) {
        try {
          const options = JSON.parse(demand.selectedOptions as unknown as string) as any;
          const numericOptions: number[] = Array.isArray(options) ? options.map((o: any) => Number(o)) : [];
          setSelectedOptionIds(numericOptions);
        } catch (e) {
          setSelectedOptionIds([]);
        }
      }
    }
  }, [demand]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const date = formData.get("date") as string;
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const requiredWorkers = parseInt(formData.get("requiredWorkers") as string);
    const location = formData.get("location") as string;
    const demandTypeId = formData.get("demandTypeId") as string;
    const note = formData.get("note") as string;

    // 驗證必填欄位
    if (!date || !startTime || !endTime || !requiredWorkers) {
      toast.error("請填寫所有必填欄位");
      return;
    }

    // 驗證時間邏輯
    if (startTime >= endTime) {
      toast.error("結束時間必須晚於開始時間");
      return;
    }

    // 將選取的選項 ID 轉為 JSON 字串
    const selectedOptionsJson = selectedOptionIds.length > 0 ? JSON.stringify(selectedOptionIds) : undefined;

    try {
      await updateMutation.mutateAsync({
        id: demandId!,
        date: new Date(date),
        startTime,
        endTime,
        requiredWorkers,
        location: location || undefined,
        demandTypeId: demandTypeId ? parseInt(demandTypeId) : undefined,
        selectedOptions: selectedOptionsJson,
        note: note || undefined,
      });
    } catch (error) {
      // Error handling is done in onError callback
    }
  };

  if (isLoading || !demand) {
    return (
      <ClientPortalLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">載入中...</p>
          </div>
        </div>
      </ClientPortalLayout>
    );
  }

  // 判斷是否可編輯（草稿和待審核狀態可編輯）
  const canEdit = demand.status === "draft" || demand.status === "pending";

  // 狀態顯示
  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "草稿", variant: "secondary" },
    pending: { label: "待審核", variant: "outline" },
    confirmed: { label: "已確認", variant: "default" },
    assigned: { label: "已指派", variant: "default" },
    completed: { label: "已完成", variant: "default" },
    cancelled: { label: "已取消", variant: "destructive" },
    closed: { label: "已關閉", variant: "destructive" },
  };

  return (
    <ClientPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            <Badge variant={statusConfig[demand.status]?.variant || "default"}>
              {statusConfig[demand.status]?.label || demand.status}
            </Badge>
            {canEdit && !isEditing && (
              <Button size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                編輯需求單
              </Button>
            )}
          </div>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{isEditing ? "編輯需求單" : "需求單詳情"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {isEditing ? "修改需求單資訊" : "查看需求單完整資訊"}
            </p>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 日期 */}
                <div className="space-y-2">
                  <Label htmlFor="date">
                    日期 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="date"
                    id="date"
                    name="date"
                    required
                    defaultValue={new Date(demand.date).toISOString().split("T")[0]}
                    min={new Date().toISOString().split("T")[0]}
                  />
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
                      defaultValue={demand.startTime}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">
                      結束時間 <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      type="time" 
                      id="endTime" 
                      name="endTime" 
                      required 
                      defaultValue={demand.endTime}
                    />
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
                    defaultValue={demand.requiredWorkers}
                  />
                </div>

                {/* 地點 */}
                <div className="space-y-2">
                  <Label htmlFor="location">地點</Label>
                  <Input
                    type="text"
                    id="location"
                    name="location"
                    defaultValue={demand.location || ""}
                  />
                </div>

                {/* 需求類型 */}
                <div className="space-y-2">
                  <Label htmlFor="demandTypeId">需求類型</Label>
                  <Select 
                    name="demandTypeId"
                    value={selectedDemandTypeId?.toString() || ""}
                    onValueChange={(value) => {
                      const typeId = value ? parseInt(value) : null;
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
                    rows={4}
                    defaultValue={demand.note || ""}
                  />
                </div>

                {/* 提交按鈕 */}
                <div className="flex items-center gap-4">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Save className="mr-2 h-4 w-4" />
                    儲存變更
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    取消
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* 日期 */}
                <div>
                  <Label className="text-muted-foreground">日期</Label>
                  <p className="mt-1 font-medium">
                    {new Date(demand.date).toLocaleDateString("zh-TW", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "long",
                    })}
                  </p>
                </div>

                {/* 時間範圍 */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">開始時間</Label>
                    <p className="mt-1 font-medium">{demand.startTime}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">結束時間</Label>
                    <p className="mt-1 font-medium">{demand.endTime}</p>
                  </div>
                </div>

                {/* 需求人數 */}
                <div>
                  <Label className="text-muted-foreground">需求人數</Label>
                  <p className="mt-1 font-medium">{demand.requiredWorkers} 人</p>
                </div>

                {/* 地點 */}
                {demand.location && (
                  <div>
                    <Label className="text-muted-foreground">地點</Label>
                    <p className="mt-1 font-medium">{demand.location}</p>
                  </div>
                )}

                {/* 需求類型 */}
                {demand.demandType && (
                  <div>
                    <Label className="text-muted-foreground">需求類型</Label>
                    <p className="mt-1 font-medium">{demand.demandType.name}</p>
                  </div>
                )}

                {/* 已選取的選項 */}
                {demand.selectedOptions && (() => {
                  try {
                    const optionIds = JSON.parse(demand.selectedOptions as unknown as string) as any;
                    if (Array.isArray(optionIds) && optionIds.length > 0 && demand.demandType?.options) {
                      const numericIds: number[] = optionIds.map((o: any) => Number(o));
                      const selectedOptions = demand.demandType.options.filter((opt: any) => 
                        numericIds.includes(opt.id)
                      );
                      if (selectedOptions.length > 0) {
                        return (
                          <div>
                            <Label className="text-muted-foreground">已選取的選項</Label>
                            <ul className="mt-2 space-y-2">
                              {selectedOptions.map((option: any) => (
                                <li key={option.id} className="flex items-start gap-2">
                                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                  <span>{option.content}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      }
                    }
                  } catch (e) {
                    // Ignore parsing errors
                  }
                  return null;
                })()}

                {/* 備註 */}
                {demand.note && (
                  <div>
                    <Label className="text-muted-foreground">備註</Label>
                    <p className="mt-1 whitespace-pre-wrap">{demand.note}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
