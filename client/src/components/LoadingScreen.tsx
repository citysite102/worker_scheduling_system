import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface LoadingScreenProps {
  isLoading: boolean;
}

export function LoadingScreen({ isLoading }: LoadingScreenProps) {
  const [show, setShow] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShow(true);
    } else {
      // 延遲隱藏，讓動畫更流暢
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-300 ${
        isLoading ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        {/* 環形進度條 */}
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        
        {/* 載入文字 */}
        <p className="text-sm text-muted-foreground">載入中...</p>
      </div>
    </div>
  );
}
