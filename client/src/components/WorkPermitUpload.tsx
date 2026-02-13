import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, FileImage, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface WorkPermitUploadProps {
  onOCRSuccess: (data: {
    name: string;
    nationality: string;
    passportNo: string;
    validityPeriodStart: string;
    validityPeriodEnd: string;
    issuedDate: string;
    documentNo: string;
    uiNumber: string;
    school: string;
    imageUrl: string;
  }) => void;
}

export function WorkPermitUpload({ onOCRSuccess }: WorkPermitUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.workers.uploadWorkPermitImage.useMutation({
    onSuccess: (result) => {
      toast.success("工作許可證辨識成功！");
      onOCRSuccess({
        ...result.ocrResult,
        imageUrl: result.imageUrl,
      });
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(`辨識失敗：${error.message}`);
      setIsProcessing(false);
    },
  });

  const handleFileSelect = async (file: File) => {
    // 檢查檔案類型
    if (!file.type.startsWith("image/")) {
      toast.error("請上傳圖片檔案");
      return;
    }

    // 檢查檔案大小（限制 10MB）
    if (file.size > 10 * 1024 * 1024) {
      toast.error("圖片檔案不可超過 10MB");
      return;
    }

    // 顯示預覽
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 轉換為 base64 並上傳
    setIsProcessing(true);
    const base64Reader = new FileReader();
    base64Reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadMutation.mutate({
        imageBase64: base64,
        mimeType: file.type,
      });
    };
    base64Reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClearPreview = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {!previewUrl ? (
        <Card
          className={`border-2 border-dashed transition-colors cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">上傳工作許可證</h3>
            <p className="text-sm text-muted-foreground mb-4">
              拖拉圖片到此處，或點擊選擇檔案
            </p>
            <p className="text-xs text-muted-foreground">
              支援 JPG、PNG 格式，檔案大小不超過 10MB
            </p>
          </div>
        </Card>
      ) : (
        <Card className="relative">
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                <img
                  src={previewUrl}
                  alt="工作許可證預覽"
                  className="w-40 h-40 object-cover rounded-md border"
                />
                {!isProcessing && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleClearPreview}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex-1">
                {isProcessing ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>正在辨識工作許可證資料...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <FileImage className="h-4 w-4" />
                    <span>圖片已上傳，準備辨識</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
