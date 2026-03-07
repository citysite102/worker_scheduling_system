import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, FileText, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getTaiwanMonthStartStr, getTaiwanMonthEndStr, formatTaiwanDate } from "@/lib/dateUtils";

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

  const { data: workers } = trpc.workers.list.useQuery({ status: "active" });
  const { data: clients } = trpc.clients.list.useQuery();

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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(currentData as any[]).map((row: any) => (
                            <>
                              <TableRow
                                key={`summary-${row.workerId}`}
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
                            </>
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
