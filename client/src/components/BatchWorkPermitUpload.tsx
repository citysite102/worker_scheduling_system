import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, XCircle, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface OCRResult {
  name?: string;
  nationality?: string;
  uiNumber?: string;
  school?: string;
  validityPeriodEnd?: string;
}

interface WorkerData {
  name: string;
  phone?: string;
  email?: string;
  school?: string;
  nationality?: string;
  idNumber?: string;
  hasWorkPermit: boolean;
  hasHealthCheck: boolean;
  workPermitExpiryDate?: Date;
  note?: string;
  imageUrl?: string;
}

interface BatchWorkPermitUploadProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchWorkPermitUpload({ open, onClose, onSuccess }: BatchWorkPermitUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<"upload" | "preview">("upload");
  const [workersData, setWorkersData] = useState<WorkerData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const batchOCRMutation = trpc.workers.batchUploadWorkPermitImages.useMutation();
  const batchCreateMutation = trpc.workers.batchCreate.useMutation();

  // 民國年轉西元年函式
  const convertROCToAD = (rocDate: string): Date | undefined => {
    if (!rocDate) return undefined;
    const match = rocDate.match(/(\d+)\/(\d+)\/(\d+)/);
    if (!match) return undefined;
    const [, rocYear, month, day] = match;
    const adYear = parseInt(rocYear) + 1911;
    return new Date(`${adYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setProcessing(true);

    try {
      // 將所有圖片轉換為 base64
      const images = await Promise.all(
        Array.from(files).map(async (file) => {
          return new Promise<{ imageBase64: string; mimeType: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              const base64Data = base64.split(",")[1];
              resolve({
                imageBase64: base64Data,
                mimeType: file.type,
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      // 批次 OCR 辨識
      const result = await batchOCRMutation.mutateAsync({ images });

      // 將 OCR 結果轉換為員工資料
      const workers: WorkerData[] = result.results
        .filter((r: any) => r.success)
        .map((r: any) => ({
          name: r.ocrResult.name || "",
          nationality: r.ocrResult.nationality || "",
          idNumber: r.ocrResult.uiNumber || "",
          school: r.ocrResult.school || "",
          workPermitExpiryDate: convertROCToAD(r.ocrResult.validityPeriodEnd || ""),
          hasWorkPermit: true,
          hasHealthCheck: false,
          imageUrl: r.imageUrl,
        }));

      setWorkersData(workers);
      setCurrentStep("preview");
      toast.success(`成功辨識 ${result.successCount} 張工作許可證`);
      
      if (result.failureCount > 0) {
        toast.warning(`${result.failureCount} 張圖片辨識失敗`);
      }
    } catch (error) {
      console.error("批次上傳錯誤：", error);
      toast.error("批次上傳失敗，請稍後再試");
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleBatchCreate = async () => {
    if (workersData.length === 0) {
      toast.error("沒有可建立的員工資料");
      return;
    }

    setProcessing(true);

    try {
      const result = await batchCreateMutation.mutateAsync({ workers: workersData });
      
      toast.success(`成功建立 ${result.successCount} 位員工`);
      
      if (result.failureCount > 0) {
        toast.warning(`${result.failureCount} 位員工建立失敗`);
      }

      onSuccess();
      handleClose();
    } catch (error) {
      console.error("批次建立錯誤：", error);
      toast.error("批次建立失敗，請稍後再試");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setCurrentStep("upload");
    setWorkersData([]);
    setEditingIndex(null);
    onClose();
  };

  const handleUpdateWorker = (index: number, updates: Partial<WorkerData>) => {
    setWorkersData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], ...updates };
      return newData;
    });
  };

  const handleDeleteWorker = (index: number) => {
    setWorkersData(prev => prev.filter((_, i) => i !== index));
    toast.success("已移除該員工資料");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>批次上傳工作許可證</DialogTitle>
          <DialogDescription>
            {currentStep === "upload" 
              ? "選擇多張工作許可證圖片，系統將自動辨識並提取員工資料" 
              : "檢查並修正辨識結果，確認無誤後批次建立員工"}
          </DialogDescription>
        </DialogHeader>

        {currentStep === "upload" ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                點擊選擇或拖拉多張工作許可證圖片
              </p>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className="max-w-xs mx-auto"
              />
            </div>

            {uploading && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在上傳並辨識圖片...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                共 {workersData.length} 位員工待建立
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep("upload")}
              >
                重新上傳
              </Button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {workersData.map((worker, index) => (
                <Card key={index} className="border-border/60">
                  <CardContent className="p-4">
                    {editingIndex === index ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">姓名 *</Label>
                            <Input
                              value={worker.name}
                              onChange={(e) => handleUpdateWorker(index, { name: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">國籍</Label>
                            <Input
                              value={worker.nationality || ""}
                              onChange={(e) => handleUpdateWorker(index, { nationality: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">統一證號</Label>
                            <Input
                              value={worker.idNumber || ""}
                              onChange={(e) => handleUpdateWorker(index, { idNumber: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">學校</Label>
                            <Input
                              value={worker.school || ""}
                              onChange={(e) => handleUpdateWorker(index, { school: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">電話</Label>
                            <Input
                              value={worker.phone || ""}
                              onChange={(e) => handleUpdateWorker(index, { phone: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">工作許可到期日</Label>
                            <Input
                              type="date"
                              value={worker.workPermitExpiryDate ? new Date(worker.workPermitExpiryDate).toISOString().split('T')[0] : ""}
                              onChange={(e) => handleUpdateWorker(index, { workPermitExpiryDate: e.target.value ? new Date(e.target.value) : undefined })}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={worker.hasWorkPermit}
                              onCheckedChange={(checked) => handleUpdateWorker(index, { hasWorkPermit: !!checked })}
                            />
                            <Label className="text-xs">有工作簽證</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={worker.hasHealthCheck}
                              onCheckedChange={(checked) => handleUpdateWorker(index, { hasHealthCheck: !!checked })}
                            />
                            <Label className="text-xs">有體檢</Label>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingIndex(null)}
                          >
                            完成
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{worker.name}</div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {worker.nationality && <div>國籍：{worker.nationality}</div>}
                            {worker.idNumber && <div>統一證號：{worker.idNumber}</div>}
                            {worker.school && <div>學校：{worker.school}</div>}
                            {worker.workPermitExpiryDate && (
                              <div>工作許可到期：{new Date(worker.workPermitExpiryDate).toLocaleDateString('zh-TW')}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingIndex(index)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWorker(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button onClick={handleBatchCreate} disabled={processing || workersData.length === 0}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                批次建立 ({workersData.length} 位員工)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
