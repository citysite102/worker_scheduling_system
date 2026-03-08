import { trpc } from "@/lib/trpc";
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, FileText, Loader2, ChevronDown, ChevronRight, Lock, Unlock, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { getTaiwanMonthStartStr, getTaiwanMonthEndStr, formatTaiwanDate } from "@/lib/dateUtils";
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

type ReportType = "worker" | "client";
type ViewMode = "detail" | "monthly";

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("worker");
  const [viewMode, setViewMode] = useState<ViewMode>("detail");
  const [startDate, setStartDate] = useState<string>(() => getTaiwanMonthStartStr());
  const [endDate, setEndDate] = useState<string>(() => getTaiwanMonthEndStr());
  const [selectedWorker, setSelectedWorker] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [expandedWorkers, setExpandedWorkers] = useState<Set<number>>(new Set());

  // 月結結算確認狀態
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [unsettleDialogOpen, setUnsettleDialogOpen] = useState(false);
  const [pendingSettleWorker, setPendingSettleWorker] = useState<{ workerId: number; workerName: string; totalAmount: number; totalHours: number; assignmentCount: number } | null>(null);
  const [pendingUnsettleWorker, setPendingUnsettleWorker] = useState<{ workerId: number; workerName: string } | null>(null);

  const { data: workers } = trpc.workers.list.useQuery({ status: "active" });
  const { data: clients } = trpc.clients.list.useQuery();

  // 從 startDate 解析年月（用於結算 API）
  const reportYearMonth = useMemo(() => {
    if (!startDate) return { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    const [y, m] = startDate.split("-").map(Number);
    return { year: y, month: m };
  }, [startDate]);

  // 批次查詢月份結算狀態
  const { data: settlementBatch, refetch: refetchSettlements } = (trpc.reports as any).settlementBatchStatus.useQuery(
    { year: reportYearMonth.year, month: reportYearMonth.month },
    { enabled: hasGenerated && reportType === "worker" && viewMode === "monthly" }
  );

  const settleMutation = (trpc.reports as any).settle.useMutation({
    onSuccess: () => {
      toast.success(`${pendingSettleWorker?.workerName} ${reportYearMonth.year}年${reportYearMonth.month}月薪資已結算鎖定`);
      setSettleDialogOpen(false);
      setPendingSettleWorker(null);
      refetchSettlements();
    },
    onError: (err: any) => {
      toast.error(err.message || "結算失敗，請稍後再試");
      setSettleDialogOpen(false);
    },
  });

  const unsettleMutation = (trpc.reports as any).unsettle.useMutation({
    onSuccess: () => {
      toast.success(`${pendingUnsettleWorker?.workerName} ${reportYearMonth.year}年${reportYearMonth.month}月結算已解除`);
      setUnsettleDialogOpen(false);
      setPendingUnsettleWorker(null);
      refetchSettlements();
    },
    onError: (err: any) => {
      toast.error(err.message || "解除結算失敗，請稍後再試");
      setUnsettleDialogOpen(false);
    },
  });

  const handleSettle = (row: any) => {
    setPendingSettleWorker({
      workerId: row.workerId,
      workerName: row.workerName,
      totalAmount: row.totalPayAmount,
      totalHours: Math.round(parseFloat(row.totalHours) * 60),
      assignmentCount: row.assignmentCount,
    });
    setSettleDialogOpen(true);
  };

  const handleUnsettle = (row: any) => {
    setPendingUnsettleWorker({ workerId: row.workerId, workerName: row.workerName });
    setUnsettleDialogOpen(true);
  };

  const confirmSettle = () => {
    if (!pendingSettleWorker) return;
    settleMutation.mutate({
      workerId: pendingSettleWorker.workerId,
      year: reportYearMonth.year,
      month: reportYearMonth.month,
      totalAmount: pendingSettleWorker.totalAmount,
      totalHours: pendingSettleWorker.totalHours,
      assignmentCount: pendingSettleWorker.assignmentCount,
    });
  };

  const confirmUnsettle = () => {
    if (!pendingUnsettleWorker) return;
    unsettleMutation.mutate({
      workerId: pendingUnsettleWorker.workerId,
      year: reportYearMonth.year,
      month: reportYearMonth.month,
    });
  };

  // 使用日期字串直接傳遞，後端用 MySQL CONVERT_TZ 比對台灣時區，完全繞過 JS Date 物件的時區序列化問題
  const reportStartStr = startDate || "";
  const reportEndStr = endDate || "";

  const { data: workerReport, isLoading: workerLoading, refetch: refetchWorker } = (trpc.reports as any).workerPayroll.useQuery(
    { 
      startDate: reportStartStr || "2000-01-01", 
      endDate: reportEndStr || "2099-12-31",
      workerId: selectedWorker === "all" ? undefined : parseInt(selectedWorker)
    },
    { enabled: false }
  );

  const { data: clientReport, isLoading: clientLoading, refetch: refetchClient } = (trpc.reports as any).clientHours.useQuery(
    { 
      startDate: reportStartStr || "2000-01-01", 
      endDate: reportEndStr || "2099-12-31",
      clientId: selectedClient === "all" ? undefined : parseInt(selectedClient)
    },
    { enabled: false }
  );

  const { data: monthlyReport, isLoading: monthlyLoading, refetch: refetchMonthly } = (trpc.reports as any).workerMonthlySummary.useQuery(
    { 
      startDate: reportStartStr || "2000-01-01", 
      endDate: reportEndStr || "2099-12-31",
      workerId: selectedWorker === "all" ? undefined : parseInt(selectedWorker)
    },
    { enabled: false }
  );

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast.error("請選擇日期區間");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("開始日期不可晚於結束日期");
      return;
    }
    setHasGenerated(true);
    setExpandedWorkers(new Set());
    if (reportType === "worker" && viewMode === "monthly") {
      await refetchMonthly();
    } else if (reportType === "worker") {
      await refetchWorker();
    } else {
      await refetchClient();
    }
    toast.success("報表已生成");
  };

  const handleDownloadCSV = () => {
    let csvContent = "";
    
    if (reportType === "worker" && viewMode === "monthly" && monthlyReport) {
      csvContent = "\uFEFF員工姓名,角色,指派筆數,總工時(小時),總件數,應付薪資(元),已填薪資筆數,待填薪資筆數\n";
      monthlyReport.forEach((row: any) => {
        csvContent += `${row.workerName},${row.role === "intern" ? "實習生" : "正職"},${row.assignmentCount},${row.totalHours},${row.totalUnitCount},$${row.totalPayAmount.toLocaleString()},${row.payrollFilledCount},${row.payrollPendingCount}\n`;
      });
    } else if (reportType === "worker" && workerReport) {
      csvContent = "\uFEFF員工姓名,客戶名稱,日期,開始時間,結束時間,角色,實際工時(小時),計薪方式,完成件數,薪資金額(元)\n";
      workerReport.forEach((row: any) => {
        csvContent += `${row.workerName},${row.clientName},${row.demandDate},${row.actualStart},${row.actualEnd},${row.role === "intern" ? "實習生" : "正職"},${row.actualHours},${row.payType === "hourly" ? "時薪" : row.payType === "unit" ? "件薪" : row.payType === "fixed" ? "固定" : "未設定"},${row.unitCount ?? ""},${row.payAmount ?? ""}\n`;
      });
    } else if (clientReport) {
      csvContent = "\uFEFF客戶名稱,員工姓名,總工時(小時)\n";
      clientReport.forEach((row: any) => {
        csvContent += `${row.clientName},${row.workerName},${row.totalHours}\n`;
      });
    }

    if (!csvContent) {
      toast.error("無資料可下載");
      return;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const fileName = reportType === "worker" 
      ? (viewMode === "monthly" ? `員工薪資月結_${startDate}_${endDate}` : `員工薪資明細_${startDate}_${endDate}`)
      : `客戶工時報表_${startDate}_${endDate}`;
    link.setAttribute("download", `${fileName}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV 檔案已下載");
  };

  const toggleWorkerExpand = (workerId: number) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const isLoading = workerLoading || clientLoading || monthlyLoading;
  const currentData = reportType === "worker" 
    ? (viewMode === "monthly" ? monthlyReport : workerReport)
    : clientReport;

  const payTypeLabel = (payType: string) => {
    if (payType === "hourly") return "時薪";
    if (payType === "unit") return "件薪";
    if (payType === "fixed") return "固定";
    return "未設定";
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* 結算確認對話框 */}
      <AlertDialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-600" />
              確認結算鎖定
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>您即將對以下員工進行月結結算：</p>
                <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">員工姓名</span>
                    <span className="font-medium">{pendingSettleWorker?.workerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">結算月份</span>
                    <span className="font-medium">{reportYearMonth.year}年{reportYearMonth.month}月</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">指派筆數</span>
                    <span className="font-medium">{pendingSettleWorker?.assignmentCount} 筆</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 mt-1.5">
                    <span className="text-muted-foreground">應付薪資</span>
                    <span className="font-semibold text-emerald-700">${pendingSettleWorker?.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  結算後該月薪資資料將被鎖定，管理員將無法再修改。如需修改請先解除結算。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSettle}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {settleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
              確認結算
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 解除結算對話框 */}
      <AlertDialog open={unsettleDialogOpen} onOpenChange={setUnsettleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="h-4 w-4 text-amber-600" />
              解除結算鎖定
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>您即將解除 <strong>{pendingUnsettleWorker?.workerName}</strong> {reportYearMonth.year}年{reportYearMonth.month}月的結算鎖定。</p>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  解除後該月薪資資料可被重新修改。請確認後再操作。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnsettle}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {unsettleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
              確認解除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">報表輸出</h1>
        <p className="text-sm text-muted-foreground mt-1">生成員工薪資或客戶工時報表，並下載 CSV 檔案</p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-md border-border/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">報表設定</CardTitle>
            <CardDescription className="text-xs">選擇報表類型與日期區間</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5">
              {/* 報表類型 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">報表類型</Label>
                <Select value={reportType} onValueChange={(value) => {
                  setReportType(value as ReportType);
                  setHasGenerated(false);
                }}>
                  <SelectTrigger className="mt-1.5 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worker">員工薪資報表</SelectItem>
                    <SelectItem value="client">客戶工時報表</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 員工薪資報表：顯示模式切換 */}
              {reportType === "worker" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">顯示模式</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Button
                      variant={viewMode === "detail" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setViewMode("detail"); setHasGenerated(false); }}
                      className="flex-1 h-9 text-xs"
                    >
                      明細模式
                    </Button>
                    <Button
                      variant={viewMode === "monthly" ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setViewMode("monthly"); setHasGenerated(false); }}
                      className="flex-1 h-9 text-xs"
                    >
                      月結模式
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {viewMode === "detail"
                      ? "按每筆指派顯示：客戶、日期、工時、計薪方式、薪資金額"
                      : "按員工彙總：總工時、總件數、應付薪資，可展開查看明細"}
                  </p>
                </div>
              )}

              {/* 篩選員工 */}
              {reportType === "worker" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">篩選員工</Label>
                  <Select value={selectedWorker} onValueChange={(value) => {
                    setSelectedWorker(value);
                    setHasGenerated(false);
                  }}>
                    <SelectTrigger className="mt-1.5 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部員工</SelectItem>
                      {workers?.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id.toString()}>
                          {worker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 篩選客戶 */}
              {reportType === "client" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">篩選客戶</Label>
                  <Select value={selectedClient} onValueChange={(value) => {
                    setSelectedClient(value);
                    setHasGenerated(false);
                  }}>
                    <SelectTrigger className="mt-1.5 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部客戶</SelectItem>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 日期區間 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">開始日期</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setHasGenerated(false); }}
                    className="mt-1.5 h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">結束日期</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setHasGenerated(false); }}
                    className="mt-1.5 h-9"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleGenerate} disabled={isLoading} size="sm">
                  {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  <FileText className="mr-2 h-3.5 w-3.5" />
                  生成報表
                </Button>
                {hasGenerated && currentData && currentData.length > 0 && (
                  <Button variant="outline" onClick={handleDownloadCSV} size="sm">
                    <Download className="mr-2 h-3.5 w-3.5" />
                    下載 CSV
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {hasGenerated && (
          <Card className="shadow-md border-border/40">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">
                    {reportType === "worker"
                      ? (viewMode === "monthly" ? "員工薪資月結彙總" : "員工薪資明細")
                      : "客戶工時報表"}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {startDate} 至 {endDate}
                    {currentData && currentData.length > 0 && (
                      <span className="ml-2">
                        {reportType === "worker" && viewMode === "monthly"
                          ? `· ${currentData.length} 位員工`
                          : `· ${currentData.length} 筆記錄`}
                      </span>
                    )}
                  </CardDescription>
                </div>
                {currentData && currentData.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="h-8 text-xs">
                    <Download className="mr-1.5 h-3 w-3" />
                    下載 CSV
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : currentData && currentData.length > 0 ? (

                /* ===== 月結模式 ===== */
                reportType === "worker" && viewMode === "monthly" ? (
                  <div className="space-y-3">
                    {/* 月結彙總統計 */}
                    {(() => {
                      const data = currentData as any[];
                      const regularWorkers = data.filter(r => r.role !== "intern");
                      const totalPay = regularWorkers.reduce((sum: number, r: any) => sum + r.totalPayAmount, 0);
                      const totalHours = regularWorkers.reduce((sum: number, r: any) => sum + parseFloat(r.totalHours), 0);
                      const pendingCount = data.reduce((sum: number, r: any) => sum + r.payrollPendingCount, 0);
                      return (
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-muted/30 rounded-lg p-3 text-center">
                            <div className="text-lg font-semibold tabular-nums">{data.length}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">員工人數</div>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3 text-center">
                            <div className="text-lg font-semibold tabular-nums">{totalHours.toFixed(1)} 小時</div>
                            <div className="text-xs text-muted-foreground mt-0.5">正職總工時</div>
                          </div>
                          <div className={`rounded-lg p-3 text-center ${pendingCount > 0 ? "bg-amber-50 border border-amber-200" : "bg-muted/30"}`}>
                            <div className={`text-lg font-semibold tabular-nums ${pendingCount > 0 ? "text-amber-700" : ""}`}>
                              {pendingCount > 0 ? `${pendingCount} 筆待填` : `$${totalPay.toLocaleString()}`}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {pendingCount > 0 ? "薪資未完整" : "正職應付薪資"}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 員工月結表格（可展開明細） */}
                    <div className="border border-border/60 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs font-medium w-8"></TableHead>
                            <TableHead className="text-xs font-medium">員工姓名</TableHead>
                            <TableHead className="text-xs font-medium">角色</TableHead>
                            <TableHead className="text-xs font-medium text-right">指派筆數</TableHead>
                            <TableHead className="text-xs font-medium text-right">總工時(小時)</TableHead>
                            <TableHead className="text-xs font-medium text-right">總件數</TableHead>
                            <TableHead className="text-xs font-medium text-right">應付薪資(元)</TableHead>
                            <TableHead className="text-xs font-medium text-right">薪資狀態</TableHead>
                            <TableHead className="text-xs font-medium text-right">結算狀態</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(currentData as any[]).map((row: any) => (
                            <React.Fragment key={`worker-${row.workerId}`}>
                              <TableRow
                                className="hover:bg-muted/20 cursor-pointer"
                                onClick={() => toggleWorkerExpand(row.workerId)}
                              >
                                <TableCell className="text-center text-muted-foreground">
                                  {expandedWorkers.has(row.workerId)
                                    ? <ChevronDown className="h-3.5 w-3.5 inline" />
                                    : <ChevronRight className="h-3.5 w-3.5 inline" />}
                                </TableCell>
                                <TableCell className="font-medium text-sm">{row.workerName}</TableCell>
                                <TableCell>
                                  {row.role === "intern"
                                    ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">實習生</span>
                                    : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">正職</span>}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">{row.assignmentCount}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums">{row.totalHours}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {row.totalUnitCount > 0 ? row.totalUnitCount : <span className="text-muted-foreground text-xs">—</span>}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums font-semibold">
                                  {row.role === "intern"
                                    ? <span className="text-muted-foreground text-xs">無薪</span>
                                    : row.payrollFilledCount > 0
                                      ? `$${row.totalPayAmount.toLocaleString()}`
                                      : <span className="text-muted-foreground text-xs">未設定</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {row.payrollPendingCount > 0
                                    ? <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">{row.payrollPendingCount} 筆待填</Badge>
                                    : <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">已完整</Badge>}
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                  {row.role === "intern" ? (
                                    <span className="text-xs text-muted-foreground">無須結算</span>
                                  ) : settlementBatch?.[row.workerId]?.settled ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                        <Lock className="h-3 w-3" />已結算
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                                        onClick={() => handleUnsettle(row)}
                                      >
                                        <Unlock className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`h-6 px-2 text-xs ${
                                        row.payrollPendingCount > 0
                                          ? "text-muted-foreground border-border/50 cursor-not-allowed opacity-50"
                                          : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                      }`}
                                      disabled={row.payrollPendingCount > 0}
                                      onClick={() => handleSettle(row)}
                                      title={row.payrollPendingCount > 0 ? "請先完整填寫所有薪資再結算" : "確認結算"}
                                    >
                                      <CheckCircle2 className="h-3 w-3 mr-0.5" />結算確認
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>

                              {/* 展開明細 */}
                              {expandedWorkers.has(row.workerId) && row.details.map((detail: any, idx: number) => (
                                <TableRow key={`detail-${row.workerId}-${idx}`} className="bg-muted/10">
                                  <TableCell></TableCell>
                                  <TableCell className="text-xs text-muted-foreground pl-4" colSpan={2}>
                                    {detail.demandDate} · {detail.clientName}
                                  </TableCell>
                                  <TableCell></TableCell>
                                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{detail.actualHours}</TableCell>
                                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                                    {detail.unitCount != null ? `${detail.unitCount} ${detail.unitType || "件"}` : "—"}
                                  </TableCell>
                                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                                    {detail.payAmount != null ? `$${detail.payAmount.toLocaleString()}` : "—"}
                                  </TableCell>
                                  <TableCell className="text-right text-xs text-muted-foreground">
                                    {payTypeLabel(detail.payType)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                /* ===== 明細模式（員工）或客戶報表 ===== */
                ) : (
                  <div className="border border-border/60 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          {reportType === "worker" ? (
                            <>
                              <TableHead className="text-xs font-medium">員工姓名</TableHead>
                              <TableHead className="text-xs font-medium">客戶名稱</TableHead>
                              <TableHead className="text-xs font-medium">日期</TableHead>
                              <TableHead className="text-xs font-medium">開始時間</TableHead>
                              <TableHead className="text-xs font-medium">結束時間</TableHead>
                              <TableHead className="text-xs font-medium">角色</TableHead>
                              <TableHead className="text-xs font-medium text-right">實際工時(小時)</TableHead>
                              <TableHead className="text-xs font-medium">計薪方式</TableHead>
                              <TableHead className="text-xs font-medium text-right">完成件數</TableHead>
                              <TableHead className="text-xs font-medium text-right">薪資金額(元)</TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="text-xs font-medium">客戶名稱</TableHead>
                              <TableHead className="text-xs font-medium">員工姓名</TableHead>
                              <TableHead className="text-xs font-medium text-right">總工時(小時)</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(currentData as any[]).map((row: any, index: number) => (
                          <TableRow key={index} className="hover:bg-muted/20">
                            {reportType === "worker" ? (
                              <>
                                <TableCell className="font-medium text-sm">{row.workerName}</TableCell>
                                <TableCell className="text-sm">{row.clientName}</TableCell>
                                <TableCell className="text-sm">{row.demandDate}</TableCell>
                                <TableCell className="text-sm">{row.actualStart}</TableCell>
                                <TableCell className="text-sm">{row.actualEnd}</TableCell>
                                <TableCell className="text-sm">
                                  {row.role === "intern"
                                    ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">實習生</span>
                                    : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">正職</span>}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">{row.actualHours}</TableCell>
                                <TableCell className="text-sm">
                                  {payTypeLabel(row.payType)}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {row.unitCount != null ? `${row.unitCount} ${row.unitType || "件"}` : <span className="text-muted-foreground text-xs">—</span>}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums font-medium">
                                  {row.payAmount != null ? `$${row.payAmount.toLocaleString()}` : <span className="text-muted-foreground text-xs">未設定</span>}
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="font-medium text-sm">{row.clientName}</TableCell>
                                <TableCell className="text-sm">{row.workerName}</TableCell>
                                <TableCell className="text-right text-sm tabular-nums">{row.totalHours}</TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )

              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  所選日期區間內無已完成的排班記錄
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
