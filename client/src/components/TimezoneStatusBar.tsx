import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * 時區狀態列
 * 顯示當前台灣時間（UTC+8）與 UTC 時間，供管理員驗證時區對齊
 */
export function TimezoneStatusBar() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 台灣時間（UTC+8）
  const taiwanTime = now.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // UTC 時間
  const utcTime = now.toLocaleString("zh-TW", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // 星期幾（台灣）
  const weekday = now.toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    weekday: "short",
  });

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-slate-900/95 border-b border-slate-700/60 text-xs font-mono backdrop-blur sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Clock className="h-3 w-3" />
          <span className="text-slate-400">台灣時間</span>
          <span className="text-emerald-300 font-semibold tracking-wide">
            {weekday} {taiwanTime}
          </span>
        </div>
        <div className="w-px h-3 bg-slate-600" />
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">UTC</span>
          <span className="text-slate-400 tracking-wide">{utcTime}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-slate-500">
        <span className="text-slate-600">時區偏移</span>
        <span className="text-sky-400 font-medium">+08:00</span>
      </div>
    </div>
  );
}
