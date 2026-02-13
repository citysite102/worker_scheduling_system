import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkPermitUpload } from "./WorkPermitUpload";

interface WorkPermitOCRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOCRSuccess: (data: {
    name: string;
    nationality: string;
    passportNo: string;
    validityPeriodStart: string;
    validityPeriodEnd: string;
    issuedDate: string;
    documentNo: string;
    uiNo: string;
    school: string;
    imageUrl: string;
  }) => void;
}

export function WorkPermitOCRDialog({ open, onOpenChange, onOCRSuccess }: WorkPermitOCRDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>上傳工作許可證</DialogTitle>
          <DialogDescription>
            上傳工作許可證圖片，系統會自動辨識並提取資料
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <WorkPermitUpload
            onOCRSuccess={(data) => {
              onOCRSuccess(data);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
