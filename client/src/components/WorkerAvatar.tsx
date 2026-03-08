/**
 * WorkerAvatar — 員工頭像元件
 *
 * 優先顯示 avatarUrl 圖片，無頭像時以姓名首字縮寫 + 依 id 決定的色彩背景呈現。
 * 同時提供格式化工號（W-001）的工具函式。
 */

interface WorkerAvatarProps {
  /** 員工 id（用於決定縮寫頭像的背景色） */
  workerId: number;
  /** 員工姓名（用於顯示縮寫） */
  name: string;
  /** 頭像圖片 URL（可選） */
  avatarUrl?: string | null;
  /** 頭像尺寸，預設 "md" */
  size?: "sm" | "md" | "lg";
}

/** 依員工 id 決定縮寫頭像的背景色（共 8 種，循環使用） */
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

/** 取得姓名縮寫（中文取第一字，英文取首字母） */
function getInitials(name: string): string {
  if (!name) return "?";
  const trimmed = name.trim();
  // 中文姓名：取第一個字
  if (/[\u4e00-\u9fff]/.test(trimmed[0])) {
    return trimmed[0];
  }
  // 英文姓名：取首字母（最多兩個）
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed[0].toUpperCase();
}

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
};

export function WorkerAvatar({ workerId, name, avatarUrl, size = "md" }: WorkerAvatarProps) {
  const colorClass = AVATAR_COLORS[workerId % AVATAR_COLORS.length];
  const initials = getInitials(name);
  const sizeClass = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover shrink-0 ring-2 ring-background`}
        onError={(e) => {
          // 圖片載入失敗時退回縮寫頭像
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center shrink-0 text-white font-semibold ring-2 ring-background select-none`}
      title={name}
    >
      {initials}
    </div>
  );
}

/**
 * 將員工 id 格式化為工號字串
 * @example formatWorkerId(1) → "W-001"
 * @example formatWorkerId(42) → "W-042"
 * @example formatWorkerId(1000) → "W-1000"
 */
export function formatWorkerId(id: number): string {
  return `W-${String(id).padStart(3, "0")}`;
}
