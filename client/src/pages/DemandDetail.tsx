import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft, Loader2, Calendar, Clock, MapPin, Users } from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function DemandDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const demandId = parseInt(params.id || "0");

  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([]);
  const [isInactiveExpanded, setIsInactiveExpanded] = useState(false);

  const { data: demand, isLoading, refetch } = trpc.demands.getById.useQuery({ id: demandId });

  const { data: feasibility, isLoading: feasibilityLoading } = trpc.demands.feasibility.useQuery(
    {
      demandId,
      date: demand?.date || new Date(),
      startTime: demand?.startTime || "00:00",
      endTime: demand?.endTime || "00:00",
      requiredWorkers: demand?.requiredWorkers || 0,
    },
    { enabled: !!demand }
  );

  const batchCreateMutation = trpc.assignments.batchCreate.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`已成功指派 ${result.successCount} 位員工`);
        setSelectedWorkerIds([]);
        refetch();
      } else {
        toast.error(`部分指派失敗：${result.errors.join("、")}`);
        refetch();
      }
    },
    onError: (error) => {
      toast.error(`指派失敗：${error.message}`);
    },
  });

  const handleToggleWorker = (workerId: number) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  const handleAutoFill = () => {
    if (!feasibility || !demand) return;
    const needed = demand.requiredWorkers - selectedWorkerIds.length;
    const availableIds = feasibility.availableWorkers
      .filter((w) => !selectedWorkerIds.includes(w.id))
      .slice(0, needed)
      .map((w) => w.id);

    if (availableIds.length < needed) {
      toast.warning(
        `可用員工僅 ${feasibility.availableWorkers.length} 人，仍缺 ${feasibility.shortage} 人。建議調整時段或拆分需求單。`
      );
    } else {
      toast.success(`已自動選取 ${availableIds.length} 位員工，請確認後送出。`);
    }
    setSelectedWorkerIds((prev) => [...prev, ...availableIds]);
  };

  const handleClearSelection = () => {
    setSelectedWorkerIds([]);
    toast.info("已清空選取");
  };

  const handleSubmit = () => {
    if (!demand || selectedWorkerIds.length === 0) {
      toast.error("請至少選擇一位員工");
      return;
    }
    const scheduledStart = new Date(demand.date);
    const [startHour, startMinute] = demand.startTime.split(":").map(Number);
    scheduledStart.setHours(startHour, startMinute, 0, 0);

    const scheduledEnd = new Date(demand.date);
    const [endHour, endMinute] = demand.endTime.split(":").map(Number);
    scheduledEnd.setHours(endHour, endMinute, 0, 0);

    batchCreateMutation.mutate({
      demandId,
      workerIds: selectedWorkerIds,
      scheduledStart,
      scheduledEnd,
    });
  };

  if (isLoading || feasibilityLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!demand || !feasibility) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="text-muted-foreground">需求單不存在</div>
      </div>
    );
  }

  const gap = demand.requiredWorkers - selectedWorkerIds.length;
  const inactiveWorkers = feasibility.unavailableWorkers.filter(
    (uw) => uw.worker.status === "inactive"
  );
  const unavailableActiveWorkers = feasibility.unavailableWorkers.filter(
    (uw) => uw.worker.status === "active"
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground hover:text-foreground" onClick={() => setLocation("/demands")}>
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        返回需求列表
      </Button>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">需求單：{demand.client?.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">指派員工至此需求單</p>
      </div>

      <div className="grid gap-5 mb-6">
        {/* 需求資訊 + 可行性 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">需求資訊</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">日期：</span>
                  <span className="font-medium">
                    {new Date(demand.date).toLocaleDateString("zh-TW", {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">時段：</span>
                  <span className="font-medium">{demand.startTime} - {demand.endTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">需求人數：</span>
                  <span className="font-medium">{demand.requiredWorkers} 人</span>
                </div>
                {demand.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">地點：</span>
                    <span className="font-medium">{demand.location}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">人力可行性</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">可用員工</span>
                  <span className="font-semibold text-emerald-600">{feasibility.availableWorkers.length} 人</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">不可用員工</span>
                  <span className="font-medium">{unavailableActiveWorkers.length} 人</span>
                </div>
                {feasibility.shortage > 0 && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>缺口：{feasibility.shortage} 人</strong>
                      <br />
                      可用員工不足，建議調整時段或拆分需求單。
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 操作列 */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                已選 <span className="font-semibold text-blue-600">{selectedWorkerIds.length}</span>
                {" / "}
                <span className="font-semibold">{demand.requiredWorkers}</span> 人
                {gap > 0 && <span className="text-muted-foreground ml-1">（還差 {gap} 人）</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleAutoFill}>
                  一鍵湊滿
                </Button>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleClearSelection}>
                  清空已選
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={selectedWorkerIds.length === 0 || batchCreateMutation.isPending}
                >
                  {batchCreateMutation.isPending ? "指派中..." : "送出指派"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 可指派 */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <CardTitle className="text-base font-medium">
                可指派 ({feasibility.availableWorkers.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              符合排班時間設置且無衝突的員工，依「本週工時少 → 近期排班少 → 姓名」排序
            </CardDescription>
          </CardHeader>
          <CardContent>
            {feasibility.availableWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">無可指派員工</div>
            ) : (
              <div className="space-y-1.5">
                {feasibility.availableWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedWorkerIds.includes(worker.id)
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-border/60 hover:bg-muted/40"
                    }`}
                    onClick={() => handleToggleWorker(worker.id)}
                  >
                    <Checkbox
                      checked={selectedWorkerIds.includes(worker.id)}
                      onCheckedChange={() => handleToggleWorker(worker.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{worker.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {worker.phone} {worker.email && `· ${worker.email}`}
                      </div>
                    </div>
                    <div className="flex gap-4 shrink-0 text-xs text-muted-foreground">
                      <span>本週 {((worker.weekHours || 0) / 60).toFixed(1)}h</span>
                      <span>近7天 {worker.last7DaysCount || 0}次</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 不可指派 */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <CardTitle className="text-base font-medium">
                不可指派 ({unavailableActiveWorkers.length})
              </CardTitle>
            </div>
            <CardDescription className="text-xs">因故無法指派的員工</CardDescription>
          </CardHeader>
          <CardContent>
            {unavailableActiveWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">無不可指派員工</div>
            ) : (
              <div className="space-y-1.5">
                {unavailableActiveWorkers.map((uw) => (
                  <div
                    key={uw.worker.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/30 opacity-60"
                  >
                    <Checkbox disabled />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-muted-foreground">{uw.worker.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {uw.reasons.map((reason, idx) => (
                          <span key={idx}>
                            {idx > 0 && " · "}
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 已停用 */}
        <Collapsible open={isInactiveExpanded} onOpenChange={setIsInactiveExpanded}>
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-base font-medium text-muted-foreground">
                    已停用 ({inactiveWorkers.length})
                  </CardTitle>
                  {isInactiveExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {inactiveWorkers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">無已停用員工</div>
                ) : (
                  <div className="space-y-1.5">
                    {inactiveWorkers.map((uw) => (
                      <div
                        key={uw.worker.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/20 opacity-40"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-muted-foreground">{uw.worker.name}</div>
                          <div className="text-xs text-muted-foreground">已停用</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
