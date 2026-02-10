import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft, Loader2,
  Calendar, Clock, MapPin, Users, Filter, GraduationCap, FileCheck, Stethoscope, X
} from "lucide-react";
import { useParams, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function DemandDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const demandId = parseInt(params.id || "0");

  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([]);
  const [isInactiveExpanded, setIsInactiveExpanded] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // 篩選狀態
  const [filterSchool, setFilterSchool] = useState("");
  const [filterWorkPermit, setFilterWorkPermit] = useState<string>("all"); // "all" | "yes" | "no"
  const [filterHealthCheck, setFilterHealthCheck] = useState<string>("all"); // "all" | "yes" | "no"

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

  // 計算篩選後的員工列表
  const filteredAvailableWorkers = useMemo(() => {
    if (!feasibility) return [];
    return feasibility.availableWorkers.filter((worker) => {
      if (filterSchool && !(worker.school || "").toLowerCase().includes(filterSchool.toLowerCase())) {
        return false;
      }
      if (filterWorkPermit === "yes" && !worker.hasWorkPermit) return false;
      if (filterWorkPermit === "no" && worker.hasWorkPermit) return false;
      if (filterHealthCheck === "yes" && !worker.hasHealthCheck) return false;
      if (filterHealthCheck === "no" && worker.hasHealthCheck) return false;
      return true;
    });
  }, [feasibility, filterSchool, filterWorkPermit, filterHealthCheck]);

  const filteredUnavailableWorkers = useMemo(() => {
    if (!feasibility) return [];
    return feasibility.unavailableWorkers
      .filter((uw) => uw.worker.status === "active")
      .filter((uw) => {
        if (filterSchool && !(uw.worker.school || "").toLowerCase().includes(filterSchool.toLowerCase())) {
          return false;
        }
        if (filterWorkPermit === "yes" && !uw.worker.hasWorkPermit) return false;
        if (filterWorkPermit === "no" && uw.worker.hasWorkPermit) return false;
        if (filterHealthCheck === "yes" && !uw.worker.hasHealthCheck) return false;
        if (filterHealthCheck === "no" && uw.worker.hasHealthCheck) return false;
        return true;
      });
  }, [feasibility, filterSchool, filterWorkPermit, filterHealthCheck]);

  // 是否有啟用任何篩選
  const hasActiveFilters = filterSchool !== "" || filterWorkPermit !== "all" || filterHealthCheck !== "all";
  const activeFilterCount = [
    filterSchool !== "",
    filterWorkPermit !== "all",
    filterHealthCheck !== "all",
  ].filter(Boolean).length;

  // 取得所有不重複的學校名稱
  const schoolOptions = useMemo(() => {
    if (!feasibility) return [];
    const schools = new Set<string>();
    feasibility.availableWorkers.forEach((w) => {
      if (w.school) schools.add(w.school);
    });
    feasibility.unavailableWorkers.forEach((uw) => {
      if (uw.worker.school) schools.add(uw.worker.school);
    });
    return Array.from(schools).sort();
  }, [feasibility]);

  const handleToggleWorker = (workerId: number) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  };

  const handleAutoFill = () => {
    if (!feasibility || !demand) return;
    const needed = demand.requiredWorkers - selectedWorkerIds.length;
    // 一鍵湊滿時也套用篩選條件
    const availableIds = filteredAvailableWorkers
      .filter((w) => !selectedWorkerIds.includes(w.id))
      .slice(0, needed)
      .map((w) => w.id);

    if (availableIds.length < needed) {
      toast.warning(
        `篩選後可用員工僅 ${filteredAvailableWorkers.length} 人，仍缺 ${needed - availableIds.length} 人。`
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

  const handleClearFilters = () => {
    setFilterSchool("");
    setFilterWorkPermit("all");
    setFilterHealthCheck("all");
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
                  <span className="font-medium">{feasibility.unavailableWorkers.filter(uw => uw.worker.status === "active").length} 人</span>
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

        {/* 篩選器 */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-0">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Filter className="h-4 w-4" />
                <span>員工篩選</span>
                {hasActiveFilters && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-blue-100 text-blue-700">
                    {activeFilterCount}
                  </Badge>
                )}
                {isFilterOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" onClick={handleClearFilters}>
                  <X className="h-3 w-3 mr-1" />
                  清除篩選
                </Button>
              )}
            </div>

            {isFilterOpen && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/40">
                {/* 學校篩選 */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5" />
                    學校
                  </label>
                  {schoolOptions.length > 0 ? (
                    <Select value={filterSchool || "all_schools"} onValueChange={(v) => setFilterSchool(v === "all_schools" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="全部學校" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_schools">全部學校</SelectItem>
                        {schoolOptions.map((school) => (
                          <SelectItem key={school} value={school}>{school}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="輸入學校名稱"
                      value={filterSchool}
                      onChange={(e) => setFilterSchool(e.target.value)}
                      className="h-9 text-sm"
                    />
                  )}
                </div>

                {/* 工作簽證篩選 */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <FileCheck className="h-3.5 w-3.5" />
                    工作簽證
                  </label>
                  <Select value={filterWorkPermit} onValueChange={setFilterWorkPermit}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">不限</SelectItem>
                      <SelectItem value="yes">有簽證</SelectItem>
                      <SelectItem value="no">無簽證</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 體檢篩選 */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Stethoscope className="h-3.5 w-3.5" />
                    體檢狀態
                  </label>
                  <Select value={filterHealthCheck} onValueChange={setFilterHealthCheck}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">不限</SelectItem>
                      <SelectItem value="yes">已體檢</SelectItem>
                      <SelectItem value="no">未體檢</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 操作列 */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                已選 <span className="font-semibold text-blue-600">{selectedWorkerIds.length}</span>
                {" / "}
                <span className="font-semibold">{demand.requiredWorkers}</span> 人
                {gap > 0 && <span className="text-muted-foreground ml-1">（還差 {gap} 人）</span>}
                {hasActiveFilters && (
                  <span className="text-muted-foreground ml-2">
                    · 篩選後 {filteredAvailableWorkers.length} 人可用
                  </span>
                )}
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
                可指派 ({filteredAvailableWorkers.length})
                {hasActiveFilters && feasibility.availableWorkers.length !== filteredAvailableWorkers.length && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    / 全部 {feasibility.availableWorkers.length}
                  </span>
                )}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              符合排班時間設置且無衝突的員工，依「本週工時少 → 近期排班少 → 姓名」排序
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredAvailableWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {hasActiveFilters ? "篩選條件下無可指派員工，請調整篩選條件" : "無可指派員工"}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredAvailableWorkers.map((worker) => (
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
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{worker.name}</span>
                        {worker.school && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground">
                            <GraduationCap className="h-2.5 w-2.5 mr-0.5" />
                            {worker.school}
                          </Badge>
                        )}
                        {worker.hasWorkPermit ? (
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                            <FileCheck className="h-2.5 w-2.5 mr-0.5" />
                            簽證
                          </Badge>
                        ) : null}
                        {worker.hasHealthCheck ? (
                          <Badge className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
                            <Stethoscope className="h-2.5 w-2.5 mr-0.5" />
                            體檢
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {worker.phone} {worker.email && `· ${worker.email}`}
                      </div>
                    </div>
                    <div className="flex gap-4 shrink-0 text-xs text-muted-foreground">
                      <span>本週 {(worker.weekHours || 0).toFixed(1)}h</span>
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
                不可指派 ({filteredUnavailableWorkers.length})
                {hasActiveFilters && feasibility.unavailableWorkers.filter(uw => uw.worker.status === "active").length !== filteredUnavailableWorkers.length && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    / 全部 {feasibility.unavailableWorkers.filter(uw => uw.worker.status === "active").length}
                  </span>
                )}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">因故無法指派的員工</CardDescription>
          </CardHeader>
          <CardContent>
            {filteredUnavailableWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {hasActiveFilters ? "篩選條件下無不可指派員工" : "無不可指派員工"}
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredUnavailableWorkers.map((uw) => (
                  <div
                    key={uw.worker.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/30 opacity-60"
                  >
                    <Checkbox disabled />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-muted-foreground">{uw.worker.name}</span>
                        {uw.worker.school && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground/60">
                            {uw.worker.school}
                          </Badge>
                        )}
                      </div>
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
