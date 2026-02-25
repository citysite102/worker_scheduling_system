import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft, Loader2,
  Calendar, Clock, MapPin, Users, Filter, GraduationCap, FileCheck, Stethoscope, X,
  Edit, Copy, Trash2
} from "lucide-react";
import { useRoute, useLocation, Link } from "wouter";;
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function DemandDetail() {
  const [, params] = useRoute("/demands/:id");
  const [, setLocation] = useLocation();
  const demandId = parseInt(params?.id || "0");

  const [selectedWorkerIds, setSelectedWorkerIds] = useState<number[]>([]);
  const [isInactiveExpanded, setIsInactiveExpanded] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [assignmentToCancel, setAssignmentToCancel] = useState<number | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDemandTypeId, setSelectedDemandTypeId] = useState<number | undefined>(undefined);
  const [selectedOptions, setSelectedOptions] = useState<number[]>([]);

  // 篩選狀態
  const [filterSchool, setFilterSchool] = useState("");
  const [filterWorkPermit, setFilterWorkPermit] = useState<string>("all"); // "all" | "yes" | "no" | "within_validity"
  const [filterHealthCheck, setFilterHealthCheck] = useState<string>("all"); // "all" | "yes" | "no"
  
  // 搜尋和分頁狀態
  const [availableSearchTerm, setAvailableSearchTerm] = useState("");
  const [unavailableSearchTerm, setUnavailableSearchTerm] = useState("");
  const [availablePage, setAvailablePage] = useState(1);
  const [unavailablePage, setUnavailablePage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const utils = trpc.useUtils();

  // 查詢客戶列表
  const { data: clients } = trpc.clients.list.useQuery({});

  // 查詢需求類型列表
  const { data: demandTypes = [] } = trpc.demandTypes.list.useQuery();

  // 當前選擇的需求類型
  const selectedDemandType = demandTypes.find(t => t.id === selectedDemandTypeId);

  // 更新需求單
  const updateMutation = trpc.demands.update.useMutation({
    onSuccess: () => {
      toast.success("需求單更新成功");
      setIsEditDialogOpen(false);
      utils.demands.getById.invalidate({ id: demandId });
      utils.demands.feasibility.invalidate({
        demandId,
        date: localDate,
        startTime: demand?.startTime || "00:00",
        endTime: demand?.endTime || "00:00",
        requiredWorkers: demand?.requiredWorkers || 0,
      });
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  // 複製需求單
  const duplicateMutation = trpc.demands.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success("需求單複製成功");
      setLocation(`/demands/${data.newDemandId}`);
    },
    onError: (error) => {
      toast.error(`複製失敗：${error.message}`);
    },
  });

  // 取消需求單
  const cancelDemandMutation = trpc.demands.cancel.useMutation({
    onSuccess: () => {
      toast.success("需求單已取消");
      setLocation("/demands");
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });
  const { data: demand, isLoading } = trpc.demands.getById.useQuery({ id: demandId });

  // 將 UTC 日期轉換為台灣時區的日期（用於顯示和 API 呼叫）
  const localDate = useMemo(() => {
    if (!demand?.date) return new Date();
    const utcDate = new Date(demand.date);
    // 將 UTC 時間轉換為台灣時區（UTC+8）的本地時間
    // 加上 8 小時的時區偏移
    const taiwanTime = new Date(utcDate.getTime() + 8 * 60 * 60 * 1000);
    // 取得台灣時區的年月日
    const year = taiwanTime.getUTCFullYear();
    const month = taiwanTime.getUTCMonth();
    const day = taiwanTime.getUTCDate();
    // 使用 Date.UTC() 建立 UTC 時間的日期物件，但日期是台灣時區的日期
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }, [demand?.date]);

  const { data: feasibility, isLoading: feasibilityLoading } = trpc.demands.feasibility.useQuery(
    {
      demandId,
      date: localDate,
      startTime: demand?.startTime || "00:00",
      endTime: demand?.endTime || "00:00",
      requiredWorkers: demand?.requiredWorkers || 0,
    },
    { enabled: !!demand }
  );

  // 查詢已指派的員工
  const { data: assignments, isLoading: assignmentsLoading } = trpc.assignments.getByDemand.useQuery(
    { demandId },
    { enabled: !!demand }
  );

  const batchCreateMutation = trpc.assignments.batchCreate.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`已成功指派 ${result.successCount} 位員工`);
        setSelectedWorkerIds([]);
        // 重新查詢 assignments 和 feasibility
        utils.assignments.getByDemand.invalidate({ demandId });
        utils.demands.feasibility.invalidate({
          demandId,
          date: demand?.date || new Date(),
          startTime: demand?.startTime || "00:00",
          endTime: demand?.endTime || "00:00",
          requiredWorkers: demand?.requiredWorkers || 0,
        });
      } else {
        toast.error(`部分指派失敗：${result.errors.join("、")}`);
        utils.assignments.getByDemand.invalidate({ demandId });
        utils.demands.feasibility.invalidate({
          demandId,
          date: demand?.date || new Date(),
          startTime: demand?.startTime || "00:00",
          endTime: demand?.endTime || "00:00",
          requiredWorkers: demand?.requiredWorkers || 0,
        });
      }
    },
    onError: (error) => {
      toast.error(`指派失敗：${error.message}`);
      // 自動刷新可行性資料，確保顯示的是最新狀態
      utils.demands.feasibility.invalidate({
        demandId,
        date: localDate,
        startTime: demand?.startTime || "00:00",
        endTime: demand?.endTime || "00:00",
        requiredWorkers: demand?.requiredWorkers || 0,
      });
    },
  });

  const cancelMutation = trpc.assignments.cancel.useMutation({
    onSuccess: () => {
      toast.success("已取消指派");
      // 重新查詢 assignments 和 feasibility，讓員工重新出現在對應的列表中
      utils.assignments.getByDemand.invalidate({ demandId });
      utils.demands.feasibility.invalidate({
        demandId,
        date: localDate,
        startTime: demand?.startTime || "00:00",
        endTime: demand?.endTime || "00:00",
        requiredWorkers: demand?.requiredWorkers || 0,
      });
      setCancelDialogOpen(false);
      setAssignmentToCancel(null);
    },
    onError: (error) => {
      toast.error(`取消失敗：${error.message}`);
    },
  });

  // 已指派的員工 ID 列表（排除已取消的）
  const assignedWorkerIds = useMemo(() => {
    return assignments?.filter(a => a.status !== "cancelled").map(a => a.workerId) || [];
  }, [assignments]);

  // 有效的已指派記錄（排除已取消的）
  const activeAssignments = useMemo(() => {
    return assignments?.filter(a => a.status !== "cancelled") || [];
  }, [assignments]);

  // 計算篩選後的員工列表（排除已指派的員工）
  const allFilteredAvailableWorkers = useMemo(() => {
    if (!feasibility) return [];
    return feasibility.availableWorkers
      .filter((worker) => !assignedWorkerIds.includes(worker.id))
      .filter((worker) => {
      if (filterSchool && !(worker.school || "").toLowerCase().includes(filterSchool.toLowerCase())) {
        return false;
      }
      if (filterWorkPermit === "yes" && !worker.hasWorkPermit) return false;
      if (filterWorkPermit === "no" && worker.hasWorkPermit) return false;
      if (filterWorkPermit === "within_validity") {
        if (!worker.hasWorkPermit || !worker.workPermitExpiryDate) return false;
        const expiryDate = new Date(worker.workPermitExpiryDate);
        const today = new Date();
        if (expiryDate < today) return false;
      }
      if (filterHealthCheck === "yes" && !worker.hasHealthCheck) return false;
      if (filterHealthCheck === "no" && worker.hasHealthCheck) return false;
      return true;
    });
  }, [feasibility, filterSchool, filterWorkPermit, filterHealthCheck]);
  
  // 加入搜尋功能
  const searchedAvailableWorkers = useMemo(() => {
    if (!availableSearchTerm) return allFilteredAvailableWorkers;
    const term = availableSearchTerm.toLowerCase();
    return allFilteredAvailableWorkers.filter((worker) => 
      (worker.name || "").toLowerCase().includes(term) ||
      (worker.phone || "").toLowerCase().includes(term) ||
      (worker.school || "").toLowerCase().includes(term)
    );
  }, [allFilteredAvailableWorkers, availableSearchTerm]);
  
  // 加入分頁功能
  const filteredAvailableWorkers = useMemo(() => {
    const startIndex = (availablePage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return searchedAvailableWorkers.slice(startIndex, endIndex);
  }, [searchedAvailableWorkers, availablePage]);
  
  const availableTotalPages = Math.ceil(searchedAvailableWorkers.length / ITEMS_PER_PAGE);

  const allFilteredUnavailableWorkers = useMemo(() => {
    if (!feasibility) return [];
    return feasibility.unavailableWorkers
      .filter((uw) => uw.worker.status === "active")
      .filter((uw) => {
        if (filterSchool && !(uw.worker.school || "").toLowerCase().includes(filterSchool.toLowerCase())) {
          return false;
        }
        if (filterWorkPermit === "yes" && !uw.worker.hasWorkPermit) return false;
        if (filterWorkPermit === "no" && uw.worker.hasWorkPermit) return false;
        if (filterWorkPermit === "within_validity") {
          if (!uw.worker.hasWorkPermit || !uw.worker.workPermitExpiryDate) return false;
          const expiryDate = new Date(uw.worker.workPermitExpiryDate);
          const today = new Date();
          if (expiryDate < today) return false;
        }
        if (filterHealthCheck === "yes" && !uw.worker.hasHealthCheck) return false;
        if (filterHealthCheck === "no" && uw.worker.hasHealthCheck) return false;
        return true;
      });
  }, [feasibility, filterSchool, filterWorkPermit, filterHealthCheck]);
  
  // 加入搜尋功能
  const searchedUnavailableWorkers = useMemo(() => {
    if (!unavailableSearchTerm) return allFilteredUnavailableWorkers;
    const term = unavailableSearchTerm.toLowerCase();
    return allFilteredUnavailableWorkers.filter((uw) => 
      (uw.worker.name || "").toLowerCase().includes(term) ||
      (uw.worker.phone || "").toLowerCase().includes(term) ||
      (uw.worker.school || "").toLowerCase().includes(term)
    );
  }, [allFilteredUnavailableWorkers, unavailableSearchTerm]);
  
  // 加入分頁功能
  const filteredUnavailableWorkers = useMemo(() => {
    const startIndex = (unavailablePage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return searchedUnavailableWorkers.slice(startIndex, endIndex);
  }, [searchedUnavailableWorkers, unavailablePage]);
  
  const unavailableTotalPages = Math.ceil(searchedUnavailableWorkers.length / ITEMS_PER_PAGE);

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
    // 一鍵湊滿時也套用篩選和搜尋條件
    const availableIds = searchedAvailableWorkers
      .filter((w) => !selectedWorkerIds.includes(w.id))
      .slice(0, needed)
      .map((w) => w.id);

    if (availableIds.length < needed) {
      toast.warning(
        `篩選後可用員工僅 ${searchedAvailableWorkers.length} 人，仍缺 ${needed - availableIds.length} 人。`
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
    scheduledStart.setUTCHours(startHour, startMinute, 0, 0);

    const scheduledEnd = new Date(demand.date);
    const [endHour, endMinute] = demand.endTime.split(":").map(Number);
    scheduledEnd.setUTCHours(endHour, endMinute, 0, 0);

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

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            需求單：
            <Link href={`/clients/${demand.clientId}`} className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors font-medium">
              {demand.client?.name}
            </Link>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">指派員工至此需求單</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Edit className="mr-1.5 h-3.5 w-3.5" />
            編輯
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              duplicateMutation.mutate({ id: demandId });
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            複製
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm("確定要取消這個需求單嗎？取消後需求單狀態將變為「已取消」。")) {
                cancelDemandMutation.mutate({ id: demandId });
              }
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            取消
          </Button>
        </div>
      </div>

      <div className="grid gap-5 mb-6">
        {/* 需求資訊 + 可行性 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="shadow-md border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium">需求資訊</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">日期：</span>
                  <span className="font-medium">
                    {localDate.toLocaleDateString("zh-TW", {
                      year: "numeric", month: "long", day: "numeric", weekday: "long",
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
                {demand.demandType && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <FileCheck className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <div className="text-muted-foreground mb-1">需求類別：</div>
                          <div className="font-medium">{demand.demandType.name}</div>
                          {demand.demandType.description && (
                            <div className="text-xs text-muted-foreground mt-1">{demand.demandType.description}</div>
                          )}
                        </div>
                      </div>
                      {demand.selectedOptions && demand.selectedOptions.length > 0 && (
                        <div className="ml-5 space-y-1">
                          <div className="text-xs text-muted-foreground mb-1.5">已勾選的項目：</div>
                          <div className="space-y-1">
                            {demand.selectedOptions.map((option: any) => (
                              <div key={option.id} className="flex items-start gap-2 text-xs">
                                <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                                <span>{option.content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-border/40">
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
        <Card className="shadow-md border-border/40">
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
                      <SelectItem value="within_validity">期限內</SelectItem>
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

        {/* 已指派員工 */}
        {assignments && assignments.length > 0 && (
          <Card className="shadow-md border-border/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <CardTitle className="text-base font-medium">
                  已指派 ({activeAssignments.length})
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                已確認指派的員工
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {activeAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 bg-blue-50/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/workers/${assignment.workerId}`} className="font-medium text-sm hover:underline hover:text-primary transition-colors">
                          {assignment.worker?.name}
                        </Link>
                        {assignment.worker?.school ? (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 bg-white">
                            <GraduationCap className="h-3 w-3 mr-0.5" />
                            {assignment.worker.school}
                          </Badge>
                        ) : null}
                        {assignment.worker?.hasWorkPermit ? (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                            <FileCheck className="h-3 w-3 mr-0.5" />
                            簽證
                          </Badge>
                        ) : null}
                        {assignment.worker?.hasHealthCheck ? (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                            <Stethoscope className="h-3 w-3 mr-0.5" />
                            體檢
                          </Badge>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {assignment.worker?.phone} · {assignment.worker?.email}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                        {assignment.status === "assigned" && "已指派"}
                        {assignment.status === "completed" && "已完成"}
                        {assignment.status === "cancelled" && "已取消"}
                        {assignment.status === "disputed" && "異常"}
                      </Badge>
                      {assignment.status === "assigned" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setAssignmentToCancel(assignment.id);
                            setCancelDialogOpen(true);
                          }}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          取消指派
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 操作列 */}
        <Card className="shadow-md border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                已選 <span className="font-semibold text-blue-600">{selectedWorkerIds.length}</span>
                {" / "}
                <span className="font-semibold">{Math.max(0, demand.requiredWorkers - (activeAssignments?.length || 0))}</span> 人
                {gap > 0 && <span className="text-muted-foreground ml-1">（還差 {gap - (activeAssignments?.length || 0)} 人）</span>}
                {hasActiveFilters && (
                  <span className="text-muted-foreground ml-2">
                    · 篩選後 {searchedAvailableWorkers.length} 人可用
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
        <Card className="shadow-md border-border/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <CardTitle className="text-base font-medium">
                可指派 ({searchedAvailableWorkers.length})
                {(hasActiveFilters || availableSearchTerm) && feasibility.availableWorkers.length !== searchedAvailableWorkers.length && (
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
            {/* 搜尋框 */}
            {searchedAvailableWorkers.length > 0 || availableSearchTerm ? (
              <div className="mb-3">
                <Input
                  placeholder="搜尋姓名、電話、學校..."
                  value={availableSearchTerm}
                  onChange={(e) => {
                    setAvailableSearchTerm(e.target.value);
                    setAvailablePage(1); // 搜尋時重置到第一頁
                  }}
                  className="h-9"
                />
              </div>
            ) : null}
            
            {filteredAvailableWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {availableSearchTerm ? "搜尋無結果" : hasActiveFilters ? "篩選條件下無可指派員工，請調整篩選條件" : "無可指派員工"}
              </div>
            ) : (
              <>
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
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/workers/${worker.id}`} className="font-medium text-sm hover:underline hover:text-primary transition-colors">
                          {worker.name}
                        </Link>
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
                
                {/* 分頁控制 */}
                {availableTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAvailablePage(p => Math.max(1, p - 1))}
                      disabled={availablePage === 1}
                    >
                      上一頁
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {availablePage} / {availableTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAvailablePage(p => Math.min(availableTotalPages, p + 1))}
                      disabled={availablePage === availableTotalPages}
                    >
                      下一頁
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 不可指派 */}
        <Card className="shadow-md border-border/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <CardTitle className="text-base font-medium">
                不可指派 ({searchedUnavailableWorkers.length})
                {(hasActiveFilters || unavailableSearchTerm) && feasibility.unavailableWorkers.filter(uw => uw.worker.status === "active").length !== searchedUnavailableWorkers.length && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    / 全部 {feasibility.unavailableWorkers.filter(uw => uw.worker.status === "active").length}
                  </span>
                )}
              </CardTitle>
            </div>
            <CardDescription className="text-xs">因故無法指派的員工</CardDescription>
          </CardHeader>
          <CardContent>
            {/* 搜尋框 */}
            {searchedUnavailableWorkers.length > 0 || unavailableSearchTerm ? (
              <div className="mb-3">
                <Input
                  placeholder="搜尋姓名、電話、學校..."
                  value={unavailableSearchTerm}
                  onChange={(e) => {
                    setUnavailableSearchTerm(e.target.value);
                    setUnavailablePage(1); // 搜尋時重置到第一頁
                  }}
                  className="h-9"
                />
              </div>
            ) : null}
            
            {filteredUnavailableWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {unavailableSearchTerm ? "搜尋無結果" : hasActiveFilters ? "篩選條件下無不可指派員工" : "無不可指派員工"}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {filteredUnavailableWorkers.map((uw) => (
                  <div
                    key={uw.worker.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/30 opacity-60"
                  >
                    <Checkbox disabled />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/workers/${uw.worker.id}`} className="font-medium text-sm text-muted-foreground hover:underline hover:text-primary transition-colors">
                          {uw.worker.name}
                        </Link>
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
                
                {/* 分頁控制 */}
                {unavailableTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnavailablePage(p => Math.max(1, p - 1))}
                      disabled={unavailablePage === 1}
                    >
                      上一頁
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {unavailablePage} / {unavailableTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUnavailablePage(p => Math.min(unavailableTotalPages, p + 1))}
                      disabled={unavailablePage === unavailableTotalPages}
                    >
                      下一頁
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 已停用 */}
        <Collapsible open={isInactiveExpanded} onOpenChange={setIsInactiveExpanded}>
          <Card className="shadow-md border-border/40">
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
                          <Link href={`/workers/${uw.worker.id}`} className="font-medium text-sm text-muted-foreground hover:underline hover:text-primary transition-colors">
                            {uw.worker.name}
                          </Link>
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

      {/* 編輯對話框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (open && demand) {
          // 當對話框開啟時，初始化需求類型與選項
          setSelectedDemandTypeId(demand.demandTypeId || undefined);
          setSelectedOptions(demand.selectedOptions || []);
        } else {
          // 當對話框關閉時，清空狀態
          setSelectedDemandTypeId(undefined);
          setSelectedOptions([]);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const dateStr = formData.get("date") as string;
            const date = new Date(dateStr);
            const breakHoursStr = formData.get("breakHours") as string;
            const breakHours = breakHoursStr ? parseFloat(breakHoursStr) * 60 : 0;

            const data = {
              id: demandId,
              clientId: parseInt(formData.get("clientId") as string),
              date,
              startTime: formData.get("startTime") as string,
              endTime: formData.get("endTime") as string,
              requiredWorkers: parseInt(formData.get("requiredWorkers") as string),
              breakHours,
              location: (formData.get("location") as string) || undefined,
              note: (formData.get("note") as string) || undefined,
              demandTypeId: selectedDemandTypeId,
              selectedOptions: selectedOptions.length > 0 ? JSON.stringify(selectedOptions) : undefined,
            };

            updateMutation.mutate(data);
          }}>
            <DialogHeader>
              <DialogTitle>編輯用工需求</DialogTitle>
              <DialogDescription>填寫需求單基本資料</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4">
              <div className="col-span-2 space-y-2">
              <Label htmlFor="clientId">客戶 *</Label>
                <Select name="clientId" defaultValue={demand?.clientId?.toString()} required>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇客戶" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
              <Label htmlFor="date">日期 *</Label>
                <Input 
                  id="date" 
                  name="date" 
                  type="date" 
                  defaultValue={demand?.date ? new Date(demand.date).toISOString().split('T')[0] : ''}
                  required 
                />
              </div>
              <div className="grid gap-2">
                {/* 空格，保持對齊 */}
              </div>
              <div className="space-y-2">
              <Label htmlFor="startTime">開始時間 *</Label>
                <Input id="startTime" name="startTime" type="time" defaultValue={demand?.startTime} required />
              </div>
              <div className="space-y-2">
              <Label htmlFor="endTime">結束時間 *</Label>
                <Input id="endTime" name="endTime" type="time" defaultValue={demand?.endTime} required />
              </div>
              <div className="space-y-2">
              <Label htmlFor="requiredWorkers">需求人數 *</Label>
                <Input id="requiredWorkers" name="requiredWorkers" type="number" min="1" defaultValue={demand?.requiredWorkers} required />
              </div>
              <div className="space-y-2">
              <Label htmlFor="breakHours">休息時間（小時）</Label>
                <Input 
                  id="breakHours" 
                  name="breakHours" 
                  type="number" 
                  step="0.25" 
                  min="0" 
                  placeholder="例如：0.75 小時 = 45 分鐘" 
                  defaultValue={demand?.breakHours ? (demand.breakHours / 60).toString() : "0"} 
                />
              </div>
              <div className="col-span-2 space-y-2">
              <Label htmlFor="demandTypeId">需求類別</Label>
                <Select 
                  value={selectedDemandTypeId?.toString() || "none"} 
                  onValueChange={(value) => {
                    setSelectedDemandTypeId(value === "none" ? undefined : parseInt(value));
                    setSelectedOptions([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選擇需求類別（可選）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">無（不選擇）</SelectItem>
                    {demandTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedDemandType && selectedDemandType.options && selectedDemandType.options.length > 0 && (
                <div className="col-span-2 p-4 bg-muted/30 rounded-lg space-y-2">
              <Label className="text-sm font-medium">選擇需要的項目</Label>
                  <div className="space-y-2">
                    {selectedDemandType.options.map((option) => (
                      <label key={option.id} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedOptions.includes(option.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOptions([...selectedOptions, option.id]);
                            } else {
                              setSelectedOptions(selectedOptions.filter(id => id !== option.id));
                            }
                          }}
                          className="mt-1"
                        />
                        <span className="text-sm">{option.content}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
              <Label htmlFor="location">地點</Label>
                <Input id="location" name="location" placeholder="工作地點" defaultValue={demand?.location || ''} />
              </div>
              <div className="grid gap-2">
                {/* 空格，保持對齊 */}
              </div>
              <div className="col-span-2 space-y-2">
              <Label htmlFor="note">備註</Label>
                <Textarea id="note" name="note" placeholder="其他說明..." rows={3} defaultValue={demand?.note || ''} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "更新中..." : "更新"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 取消指派確認對話框 */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認取消指派</AlertDialogTitle>
            <AlertDialogDescription>
              {demand && (() => {
                const demandDateTime = new Date(demand.date);
                const [startHour, startMin] = demand.startTime.split(":").map(Number);
                demandDateTime.setUTCHours(startHour, startMin, 0, 0);
                const now = new Date();
                const hasStarted = demandDateTime <= now;

                if (hasStarted) {
                  return (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-900">
                          <div className="font-medium mb-1">注意：排班時間已開始</div>
                          <div>此需求單的排班時間已經開始，取消指派可能影響現場作業安排。請確認是否繼續取消指派？</div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return "確定要取消這位員工的指派嗎？取消後該員工將重新出現在可指派列表中。";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>不，取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (assignmentToCancel) {
                  cancelMutation.mutate({ id: assignmentToCancel });
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              確定取消指派
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
