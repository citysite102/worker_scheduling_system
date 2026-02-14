import { useEffect, useState } from "react";

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
      <div className="flex flex-col items-center gap-6">
        {/* 日曆圖示動畫 */}
        <div className="relative">
          <div className="h-20 w-20 animate-pulse">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-full w-full"
            >
              {/* 日曆外框 */}
              <rect
                x="3"
                y="6"
                width="18"
                height="15"
                rx="2"
                className="fill-primary"
              />
              {/* 日曆頂部 */}
              <rect
                x="3"
                y="4"
                width="18"
                height="4"
                rx="2"
                className="fill-primary/80"
              />
              {/* 日曆格子 */}
              <rect
                x="6"
                y="10"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
              <rect
                x="10.5"
                y="10"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
              <rect
                x="15"
                y="10"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
              <rect
                x="6"
                y="13.5"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
              <rect
                x="10.5"
                y="13.5"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
              <rect
                x="15"
                y="13.5"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
              <rect
                x="6"
                y="17"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
              <rect
                x="10.5"
                y="17"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
              <rect
                x="15"
                y="17"
                width="3"
                height="2"
                rx="0.5"
                className="fill-background"
              />
            </svg>
          </div>
          {/* 旋轉圓環 */}
          <div className="absolute inset-0 -m-2">
            <svg className="h-24 w-24 animate-spin" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>

        {/* 載入文字 */}
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-semibold text-foreground">
            載入中...
          </h2>
          <div className="flex gap-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}
