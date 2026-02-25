import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export function CreateDemand() {
  const [, setLocation] = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 取得需求類型列表
  const { data: demandTypes } = trpc.demandTypes.list.useQuery();

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

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
      toast.error("請填寫所有必填欄位：日期、開始時間、結束時間、需求人數。");
      setIsSubmitting(false);
      return;
    }

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

    try {
      await createMutation.mutateAsync({
        date: new Date(date),
        startTime,
        endTime,
        requiredWorkers,
        location: location || undefined,
        demandTypeId: demandTypeId ? parseInt(demandTypeId) : undefined,
        note: note || undefined,
      });
    } catch (error) {
      // Error handling is done in onError callback
    }
  };

  return (
    <ClientPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/client-portal/demands">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回需求列表
            </Button>
          </Link>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>建立新需求單</CardTitle>
            <p className="text-sm text-muted-foreground">
              填寫以下資訊建立用工需求單，提交後將由內部人員審核並指派員工。
            </p>
          </CardHeader>
          <CardContent>
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
                <Select name="demandTypeId">
                  <SelectTrigger>
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  提交需求單
                </Button>
                <Link href="/client-portal/demands">
                  <Button type="button" variant="outline">
                    取消
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
