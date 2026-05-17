/**
 * QuickMatch.tsx — 快速配對頁面
 *
 * 雙模式：
 *   員工視角 — 左側員工列表，右側顯示該員工可配對的需求單
 *   需求視角 — 左側未滿員需求列表，右側顯示可配對的員工
 */

import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, ClipboardList, Search, Calendar, Clock, MapPin,
  CheckCircle2, XCircle, AlertTriangle, Zap, ChevronRight,
  UserCheck, Loader2, ExternalLink, RefreshCw, Info,
  ArrowLeftRight, Tag
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { getTaiwanWeekStartStr, addDaysToDateStr, formatTaiwanDate } from "@/lib/dateUtils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ViewMode = "worker" | "demand";

type DateRange = "today" | "week" | "twoweeks" | "month";

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "today", label: "今日" },
  { value: "week", label: "本週" },
  { value: "twoweeks", label: "兩週" },
  { value: "month", label: "本月" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRange(range: DateRange): { dateFrom: string; dateTo: string } {
  const weekStart = getTaiwanWeekStartStr();
  switch (range) {
    case "today": {
      const today = addDaysToDateStr(weekStart, new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
      // 用 getTaiwanWeekStartStr 計算今日
      const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      const d = String(now.getUTCDate()).padStart(2, "0");
      const todayStr = `${y}-${m}-${d}`;
      return { dateFrom: todayStr, dateTo: todayStr };
    }
    case "week":
      return { dateFrom: weekStart, dateTo: addDaysToDateStr(weekStart, 6) };
    case "twoweeks":
      return { dateFrom: weekStart, dateTo: addDaysToDateStr(weekStart, 13) };
    case "month":
      return { dateFrom: weekStart, dateTo: addDaysToDateStr(weekStart, 29) };
  }
}

const STATUS_DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `週${STATUS_DAY_NAMES[d.getUTCDay()]}`;
}

function getMatchStatusConfig(status: string) {
  switch (status) {
    case "available":
      return { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500", label: "可配對", icon: CheckCircle2 };
    case "assigned":
      return { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800", dot: "bg-blue-500", label: "已指派", icon: UserCheck };
    case "conflict":
      return { color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800", dot: "bg-red-500", label: "時段衝突", icon: XCircle };
    case "unavailable":
      return { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800", dot: "bg-amber-500", label: "不可排班", icon: AlertTriangle };
    case "mismatch":
      return { color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700", dot: "bg-slate-400", label: "種類不符", icon: Tag };
    default:
      return { color: "text-muted-foreground", bg: "bg-muted/30 border-border", dot: "bg-muted-foreground", label: status, icon: Info };
  }
}

function getFitScoreConfig(score: number) {
  if (score >= 80) return { color: "text-emerald-600 dark:text-emerald-400", label: "高度吻合" };
  if (score >= 50) return { color: "text-amber-600 dark:text-amber-400", label: "部分吻合" };
  if (score >= 10) return { color: "text-slate-500", label: "低度吻合" };
  return { color: "text-red-500", label: "不吻合" };
}

// ─── Worker Avatar ────────────────────────────────────────────────────────────

function WorkerAvatar({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm";
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sizeClass} rounded-full object-cover flex-shrink-0`} />;
  }
  const initials = name.slice(0, 2);
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${sizeClass} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Confirm Assign Dialog ────────────────────────────────────────────────────

interface ConfirmAssignDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  workerName: string;
  demandInfo: { clientName: string; date: string; startTime: string; endTime: string; location?: string | null };
}

function ConfirmAssignDialog({ open, onClose, onConfirm, isLoading, workerName, demandInfo }: ConfirmAssignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            確認指派
          </DialogTitle>
          <DialogDescription>
            請確認以下指派資訊後執行
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">{workerName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" />
              <span>{demandInfo.clientName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatTaiwanDate(demandInfo.date, "full")} ({getDayLabel(demandInfo.date)})</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{demandInfo.startTime} – {demandInfo.endTime}</span>
            </div>
            {demandInfo.location && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{demandInfo.location}</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>取消</Button>
          <Button onClick={onConfirm} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            立即指派
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Worker Mode: Right Panel ─────────────────────────────────────────────────

function WorkerRightPanel({ workerId, dateFrom, dateTo, onAssigned }: {
  workerId: number;
  dateFrom: string;
  dateTo: string;
  onAssigned: () => void;
}) {
  const [, setLocation] = useLocation();
  const [confirmTarget, setConfirmTarget] = useState<null | { demand: any; scheduledStart: Date; scheduledEnd: Date }>(null);

  const { data, isLoading, refetch } = trpc.dispatch.getMatchingDemands.useQuery(
    { workerId, dateFrom, dateTo },
    { enabled: !!workerId }
  );

  const assignMutation = trpc.assignments.create.useMutation({
    onSuccess: () => {
      toast.success("指派成功！");
      setConfirmTarget(null);
      refetch();
      onAssigned();
    },
    onError: (err) => {
      toast.error(`指派失敗：${err.message}`);
      refetch();
    },
  });

  const handleAssign = useCallback(() => {
    if (!confirmTarget || !data) return;
    const { demand, scheduledStart, scheduledEnd } = confirmTarget;
    assignMutation.mutate({
      demandId: demand.id,
      workerId,
      scheduledStart: new Date(scheduledStart),
      scheduledEnd: new Date(scheduledEnd),
      role: "regular",
    });
  }, [confirmTarget, data, workerId, assignMutation]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { worker, workerCategories, results } = data;
  const availableCount = results.filter((r) => r.matchStatus === "available").length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <WorkerAvatar name={worker.name} avatarUrl={worker.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{worker.name}</p>
            <p className="text-xs text-muted-foreground truncate">{worker.school || "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {workerCategories.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {workerCategories.slice(0, 2).map((cat: any) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                  style={{ backgroundColor: `${cat.color}15`, borderColor: `${cat.color}40`, color: cat.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
              ))}
              {workerCategories.length > 2 && (
                <span className="text-[10px] text-muted-foreground">+{workerCategories.length - 2}</span>
              )}
            </div>
          )}
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
            {availableCount} 可配
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">此期間無需求單</p>
              <p className="text-xs mt-1">請調整日期範圍或確認需求單狀態</p>
            </div>
          )}
          {results.map((result, idx) => {
            const { demand, matchStatus, matchReason, shortage } = result;
            const sc = getMatchStatusConfig(matchStatus);
            const StatusIcon = sc.icon;
            const demandDateStr = demand.date
              ? new Date(demand.date).toISOString().split("T")[0]
              : "";
            const isAvailable = matchStatus === "available";

            return (
              <div
                key={`${demand.id}-${idx}`}
                className={`rounded-lg border p-3 transition-all ${sc.bg} ${isAvailable ? "hover:shadow-sm cursor-default" : "opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* 第一行：客戶名稱 + 工作種類 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{demand.client?.name || "未知客戶"}</span>
                      {demand.jobCategory && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                          style={{
                            backgroundColor: `${demand.jobCategory.color}15`,
                            borderColor: `${demand.jobCategory.color}40`,
                            color: demand.jobCategory.color,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: demand.jobCategory.color }} />
                          {demand.jobCategory.name}
                        </span>
                      )}
                    </div>
                    {/* 第二行：日期、時間、地點 */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {demandDateStr ? `${formatTaiwanDate(demandDateStr)} (${getDayLabel(demandDateStr)})` : "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {demand.startTime} – {demand.endTime}
                      </span>
                      {demand.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {demand.location}
                        </span>
                      )}
                    </div>
                    {/* 第三行：缺員 + 狀態 */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${sc.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {sc.label}
                      </span>
                      {matchReason && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              {matchReason}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {shortage > 0 && (
                        <span className="text-xs text-muted-foreground">缺 {shortage} 人</span>
                      )}
                    </div>
                  </div>
                  {/* 右側操作 */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {isAvailable && (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => setConfirmTarget({
                          demand,
                          scheduledStart: result.scheduledStart,
                          scheduledEnd: result.scheduledEnd,
                        })}
                      >
                        <Zap className="h-3 w-3" />
                        指派
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 px-2 text-muted-foreground"
                      onClick={() => setLocation(`/demands/${demand.id}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      詳情
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Confirm Dialog */}
      {confirmTarget && (
        <ConfirmAssignDialog
          open={!!confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleAssign}
          isLoading={assignMutation.isPending}
          workerName={worker.name}
          demandInfo={{
            clientName: confirmTarget.demand.client?.name || "未知客戶",
            date: new Date(confirmTarget.demand.date).toISOString().split("T")[0],
            startTime: confirmTarget.demand.startTime,
            endTime: confirmTarget.demand.endTime,
            location: confirmTarget.demand.location,
          }}
        />
      )}
    </div>
  );
}

// ─── Demand Mode: Right Panel ─────────────────────────────────────────────────

function DemandRightPanel({ demandId, onAssigned }: { demandId: number; onAssigned: () => void }) {
  const [, setLocation] = useLocation();
  const [confirmTarget, setConfirmTarget] = useState<null | { worker: any }>(null);

  const { data, isLoading, refetch } = trpc.dispatch.getMatchingWorkers.useQuery(
    { demandId },
    { enabled: !!demandId }
  );

  const assignMutation = trpc.assignments.create.useMutation({
    onSuccess: () => {
      toast.success("指派成功！");
      setConfirmTarget(null);
      refetch();
      onAssigned();
    },
    onError: (err) => {
      toast.error(`指派失敗：${err.message}`);
      refetch();
    },
  });

  const handleAssign = useCallback(() => {
    if (!confirmTarget || !data) return;
    const { worker } = confirmTarget;
    const demandDate = new Date(data.demand.date);
    const scheduledStart = new Date(demandDate);
    const [sh, sm] = data.demand.startTime.split(":").map(Number);
    scheduledStart.setUTCHours(sh, sm, 0, 0);
    const scheduledEnd = new Date(demandDate);
    const [eh, em] = data.demand.endTime.split(":").map(Number);
    scheduledEnd.setUTCHours(eh, em, 0, 0);

    assignMutation.mutate({
      demandId,
      workerId: worker.id,
      scheduledStart,
      scheduledEnd,
      role: "regular",
    });
  }, [confirmTarget, data, demandId, assignMutation]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const { demand, availableWorkers, schedulableWorkers, conflictWorkers, shortage, assignedCount } = data;
  const demandDateStr = demand.date ? new Date(demand.date).toISOString().split("T")[0] : "";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60 flex-shrink-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{demand.client?.name || "未知客戶"}</span>
              {demand.jobCategory && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium"
                  style={{
                    backgroundColor: `${demand.jobCategory.color}15`,
                    borderColor: `${demand.jobCategory.color}40`,
                    color: demand.jobCategory.color,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: demand.jobCategory.color }} />
                  {demand.jobCategory.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {demandDateStr ? `${formatTaiwanDate(demandDateStr)} (${getDayLabel(demandDateStr)})` : "—"}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {demand.startTime} – {demand.endTime}
              </span>
              {demand.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {demand.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">已指派 / 需求</p>
              <p className="text-sm font-semibold">
                <span className={shortage > 0 ? "text-amber-600" : "text-emerald-600"}>{assignedCount}</span>
                <span className="text-muted-foreground"> / {demand.requiredWorkers}</span>
              </p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {shortage > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span>尚缺 {shortage} 人，{availableWorkers.length} 人可立即指派</span>
          </div>
        )}
      </div>

      {/* Workers */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* 可指派 */}
          {availableWorkers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-1">
                <CheckCircle2 className="h-3 w-3" />
                可立即指派（{availableWorkers.length}）
              </p>
              {availableWorkers.map((worker: any) => (
                <WorkerMatchCard
                  key={worker.id}
                  worker={worker}
                  matchType="available"
                  demandJobCategoryId={demand.jobCategoryId}
                  onAssign={() => setConfirmTarget({ worker })}
                  onViewDetail={() => setLocation(`/workers/${worker.id}`)}
                />
              ))}
            </div>
          )}

          {/* 可聯繫（排班外） */}
          {schedulableWorkers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 px-1">
                <AlertTriangle className="h-3 w-3" />
                排班外可聯繫（{schedulableWorkers.length}）
              </p>
              {schedulableWorkers.map((item: any) => (
                <WorkerMatchCard
                  key={item.worker.id}
                  worker={item.worker}
                  matchType="schedulable"
                  fitLabel={item.fitLabel}
                  fitScore={item.fitScore}
                  reasons={item.reasons}
                  demandJobCategoryId={demand.jobCategoryId}
                  onViewDetail={() => setLocation(`/workers/${item.worker.id}`)}
                />
              ))}
            </div>
          )}

          {/* 衝突 */}
          {conflictWorkers.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-500 flex items-center gap-1 px-1">
                <XCircle className="h-3 w-3" />
                時段衝突（{conflictWorkers.length}）
              </p>
              {conflictWorkers.map((item: any) => (
                <WorkerMatchCard
                  key={item.worker.id}
                  worker={item.worker}
                  matchType="conflict"
                  reasons={item.reasons}
                  demandJobCategoryId={demand.jobCategoryId}
                  onViewDetail={() => setLocation(`/workers/${item.worker.id}`)}
                />
              ))}
            </div>
          )}

          {availableWorkers.length === 0 && schedulableWorkers.length === 0 && conflictWorkers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">無在職員工資料</p>
              <p className="text-xs mt-1">請先新增員工並設定可排班時段</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Confirm Dialog */}
      {confirmTarget && data && (
        <ConfirmAssignDialog
          open={!!confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleAssign}
          isLoading={assignMutation.isPending}
          workerName={confirmTarget.worker.name}
          demandInfo={{
            clientName: data.demand.client?.name || "未知客戶",
            date: demandDateStr,
            startTime: data.demand.startTime,
            endTime: data.demand.endTime,
            location: data.demand.location,
          }}
        />
      )}
    </div>
  );
}

// ─── Worker Match Card (for demand mode) ─────────────────────────────────────

function WorkerMatchCard({
  worker, matchType, fitLabel, fitScore, reasons, demandJobCategoryId, onAssign, onViewDetail,
}: {
  worker: any;
  matchType: "available" | "schedulable" | "conflict";
  fitLabel?: string;
  fitScore?: number;
  reasons?: string[];
  demandJobCategoryId?: number | null;
  onAssign?: () => void;
  onViewDetail: () => void;
}) {
  const categoryMatch = worker.categoryMatch;
  const bgClass = matchType === "available"
    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
    : matchType === "conflict"
    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 opacity-70"
    : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";

  const fitConfig = fitScore !== undefined ? getFitScoreConfig(fitScore) : null;

  return (
    <div className={`rounded-lg border p-3 ${bgClass} transition-all`}>
      <div className="flex items-center gap-3">
        <WorkerAvatar name={worker.name} avatarUrl={worker.avatarUrl} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{worker.name}</span>
            {demandJobCategoryId && categoryMatch === "matched" && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">✓ 種類符合</span>
            )}
            {demandJobCategoryId && categoryMatch === "mismatch" && (
              <span className="text-[10px] text-slate-400 font-medium">種類不符</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {worker.school && (
              <span className="text-xs text-muted-foreground">{worker.school}</span>
            )}
            {fitConfig && fitLabel && (
              <span className={`text-xs font-medium ${fitConfig.color}`}>{fitLabel}</span>
            )}
            {reasons && reasons.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
                    {reasons.map((r, i) => <p key={i}>{r}</p>)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {matchType === "available" && onAssign && (
            <Button size="sm" className="h-7 text-xs gap-1 px-2" onClick={onAssign}>
              <Zap className="h-3 w-3" />
              指派
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" onClick={onViewDetail}>
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuickMatch() {
  const [viewMode, setViewMode] = useState<ViewMode>("demand");
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [selectedDemandId, setSelectedDemandId] = useState<number | null>(null);
  const [workerSearch, setWorkerSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [filterJobCategoryId, setFilterJobCategoryId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { dateFrom, dateTo } = useMemo(() => getDateRange(dateRange), [dateRange]);

  // ── Queries ──
  const { data: workersData = [], isLoading: workersLoading } = trpc.workers.list.useQuery({ status: "active" });
  const { data: allJobCategories = [] } = trpc.jobCategories.list.useQuery();
  const { data: openDemandsData, isLoading: demandsLoading, refetch: refetchDemands } = trpc.dispatch.listOpenDemands.useQuery(
    { dateFrom, dateTo, onlyShortage: true, jobCategoryId: filterJobCategoryId ?? undefined },
    { enabled: viewMode === "demand" }
  );

  const openDemands = openDemandsData?.demands ?? [];

  // ── Filtered workers ──
  const filteredWorkers = useMemo(() => {
    let list = workersData as any[];
    if (workerSearch.trim()) {
      const q = workerSearch.toLowerCase();
      list = list.filter((w) => w.name?.toLowerCase().includes(q) || w.school?.toLowerCase().includes(q));
    }
    return list;
  }, [workersData, workerSearch]);

  const handleAssigned = useCallback(() => {
    setRefreshKey((k) => k + 1);
    refetchDemands();
  }, [refetchDemands]);

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="px-6 py-4 border-b border-border/60 flex-shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            快速配對
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">以員工或需求為中心，快速完成指派</p>
        </div>
        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
          <Button
            variant={viewMode === "demand" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => { setViewMode("demand"); setSelectedDemandId(null); }}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            需求視角
          </Button>
          <Button
            variant={viewMode === "worker" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => { setViewMode("worker"); setSelectedWorkerId(null); }}
          >
            <Users className="h-3.5 w-3.5" />
            員工視角
          </Button>
        </div>
      </div>

      {/* Main Content: Split Panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Panel ── */}
        <div className="w-72 flex-shrink-0 border-r border-border/60 flex flex-col min-h-0">
          {/* Left Filters */}
          <div className="p-3 space-y-2 border-b border-border/40 flex-shrink-0">
            {viewMode === "worker" ? (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="搜尋員工姓名..."
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            ) : (
              <>
                <Select value={dateRange} onValueChange={(v) => { setDateRange(v as DateRange); setSelectedDemandId(null); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filterJobCategoryId?.toString() ?? "all"}
                  onValueChange={(v) => { setFilterJobCategoryId(v === "all" ? null : Number(v)); setSelectedDemandId(null); }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="所有工作種類" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">所有工作種類</SelectItem>
                    {(allJobCategories as any[]).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()} className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            {/* Date range for worker mode */}
            {viewMode === "worker" && (
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Left List */}
          <ScrollArea className="flex-1">
            {viewMode === "worker" ? (
              <div className="p-2 space-y-0.5">
                {workersLoading ? (
                  [...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg mb-1" />)
                ) : filteredWorkers.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">無符合條件的員工</div>
                ) : (
                  filteredWorkers.map((worker: any) => (
                    <button
                      key={worker.id}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        selectedWorkerId === worker.id
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/60 border border-transparent"
                      }`}
                      onClick={() => setSelectedWorkerId(worker.id)}
                    >
                      <WorkerAvatar name={worker.name} avatarUrl={worker.avatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{worker.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{worker.school || "—"}</p>
                      </div>
                      {selectedWorkerId === worker.id && (
                        <ChevronRight className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {demandsLoading ? (
                  [...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg mb-1" />)
                ) : openDemands.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400 opacity-60" />
                    <p>此期間無缺員需求</p>
                    <p className="mt-1">可調整日期範圍或篩選條件</p>
                  </div>
                ) : (
                  openDemands.map((demand: any) => {
                    const demandDateStr = demand.date ? new Date(demand.date).toISOString().split("T")[0] : "";
                    return (
                      <button
                        key={demand.id}
                        className={`w-full flex flex-col gap-1 px-3 py-2.5 rounded-lg text-left transition-colors ${
                          selectedDemandId === demand.id
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted/60 border border-transparent"
                        }`}
                        onClick={() => setSelectedDemandId(demand.id)}
                      >
                        <div className="flex items-center gap-2 justify-between">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-sm font-medium truncate">{demand.client?.name || "未知客戶"}</span>
                            {demand.jobCategory && (
                              <span
                                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: demand.jobCategory.color }}
                              />
                            )}
                          </div>
                          <span className="text-xs text-amber-600 font-medium flex-shrink-0">缺 {demand.shortage}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{demandDateStr ? `${formatTaiwanDate(demandDateStr, "short")} ${getDayLabel(demandDateStr)}` : "—"}</span>
                          <span>{demand.startTime}–{demand.endTime}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── Right Panel ── */}
        <div className="flex-1 flex flex-col min-h-0">
          {viewMode === "worker" && !selectedWorkerId && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <Users className="h-8 w-8 opacity-40" />
              </div>
              <div>
                <p className="font-medium text-sm">請從左側選擇員工</p>
                <p className="text-xs mt-1">選擇後顯示該員工在指定期間可配對的需求單</p>
              </div>
            </div>
          )}
          {viewMode === "demand" && !selectedDemandId && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <ClipboardList className="h-8 w-8 opacity-40" />
              </div>
              <div>
                <p className="font-medium text-sm">請從左側選擇需求單</p>
                <p className="text-xs mt-1">選擇後顯示可配對的員工清單，可直接執行指派</p>
              </div>
            </div>
          )}
          {viewMode === "worker" && selectedWorkerId && (
            <WorkerRightPanel
              key={`worker-${selectedWorkerId}-${dateFrom}-${dateTo}-${refreshKey}`}
              workerId={selectedWorkerId}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onAssigned={handleAssigned}
            />
          )}
          {viewMode === "demand" && selectedDemandId && (
            <DemandRightPanel
              key={`demand-${selectedDemandId}-${refreshKey}`}
              demandId={selectedDemandId}
              onAssigned={handleAssigned}
            />
          )}
        </div>
      </div>
    </div>
  );
}
