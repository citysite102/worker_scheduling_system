import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft, Loader2 } from "lucide-react";
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
    {
      enabled: !!demand,
    }
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
      <div className="p-8">
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  if (!demand || !feasibility) {
    return (
      <div className="p-8">
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
    <div className="p-8">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => setLocation("/demands")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回需求列表
      </Button>

      <h1 className="text-3xl font-bold mb-6">需求單：{demand.client?.name}</h1>

      <div className="grid gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>需求資訊</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <span className="text-muted-foreground">日期：</span>
                <span className="font-medium">
                  {new Date(demand.date).toLocaleDateString("zh-TW", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">時段：</span>
                <span className="font-medium">
                  {demand.startTime} - {demand.endTime}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">需求人數：</span>
                <span className="font-medium">{demand.requiredWorkers} 人</span>
              </div>
              {demand.location && (
                <div>
                  <span className="text-muted-foreground">地點：</span>
                  <span className="font-medium">{demand.location}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>人力可行性</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">可用員工：</span>
                <span className="font-medium">{feasibility.availableWorkers.length} 人</span>
              </div>
              {feasibility.shortage > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>缺口：{feasibility.shortage} 人</strong>
                    <br />
                    可用員工不足，建議調整時段或拆分需求單。
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>已選統計與操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg">
                已選 <span className="font-bold">{selectedWorkerIds.length}</span> /{" "}
                <span className="font-bold">{demand.requiredWorkers}</span> 人
                {gap > 0 && <span className="text-muted-foreground">，還差 {gap} 人</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleAutoFill}>
                  一鍵湊滿
                </Button>
                <Button variant="outline" onClick={handleClearSelection}>
                  清空已選
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={selectedWorkerIds.length === 0 || batchCreateMutation.isPending}
                >
                  送出指派
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              可指派 ({feasibility.availableWorkers.length})
            </CardTitle>
            <CardDescription>
              符合排班時間設置且無衝突的員工，依「本週工時少 → 近期排班少 → 姓名」排序
            </CardDescription>
          </CardHeader>
          <CardContent>
            {feasibility.availableWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">無可指派員工</div>
            ) : (
              <div className="space-y-2">
                {feasibility.availableWorkers.map((worker) => (
                  <div
                    key={worker.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={selectedWorkerIds.includes(worker.id)}
                      onCheckedChange={() => handleToggleWorker(worker.id)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">{worker.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {worker.phone} {worker.email && `· ${worker.email}`}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      本週已排：{((worker.weekHours || 0) / 60).toFixed(1)} 小時
                    </div>
                    <div className="text-sm text-muted-foreground">
                      近 7 天：{worker.last7DaysCount || 0} 次
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              不可指派 ({unavailableActiveWorkers.length})
            </CardTitle>
            <CardDescription>因故無法指派的員工，已灰底並鎖定</CardDescription>
          </CardHeader>
          <CardContent>
            {unavailableActiveWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">無不可指派員工</div>
            ) : (
              <div className="space-y-2">
                {unavailableActiveWorkers.map((uw) => (
                  <div
                    key={uw.worker.id}
                    className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50 opacity-60"
                  >
                    <Checkbox disabled />
                    <div className="flex-1">
                      <div className="font-medium text-muted-foreground">{uw.worker.name}</div>
                      <div className="text-sm text-muted-foreground space-y-1 mt-1">
                        {uw.reasons.map((reason, idx) => (
                          <div key={idx}>• {reason}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Collapsible open={isInactiveExpanded} onOpenChange={setIsInactiveExpanded}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-muted-foreground">📴</span>
                    已停用 ({inactiveWorkers.length})
                  </CardTitle>
                  {isInactiveExpanded ? <ChevronUp /> : <ChevronDown />}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {inactiveWorkers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">無已停用員工</div>
                ) : (
                  <div className="space-y-2">
                    {inactiveWorkers.map((uw) => (
                      <div
                        key={uw.worker.id}
                        className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30 opacity-50"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-muted-foreground">{uw.worker.name}</div>
                          <div className="text-sm text-muted-foreground">已停用</div>
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
