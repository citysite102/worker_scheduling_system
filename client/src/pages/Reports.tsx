import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ReportType = "worker" | "client";

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("worker");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedWorker, setSelectedWorker] = useState<string>("all");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [hasGenerated, setHasGenerated] = useState(false);

  const { data: workers } = trpc.workers.list.useQuery({ status: "active" });
  const { data: clients } = trpc.clients.list.useQuery();

  const { data: workerReport, isLoading: workerLoading, refetch: refetchWorker } = trpc.reports.workerPayroll.useQuery(
    { 
      startDate: new Date(startDate), 
      endDate: new Date(endDate),
      workerId: selectedWorker === "all" ? undefined : parseInt(selectedWorker)
    },
    { enabled: false }
  );

  const { data: clientReport, isLoading: clientLoading, refetch: refetchClient } = trpc.reports.clientHours.useQuery(
    { 
      startDate: new Date(startDate), 
      endDate: new Date(endDate),
      clientId: selectedClient === "all" ? undefined : parseInt(selectedClient)
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
    if (reportType === "worker") {
      await refetchWorker();
    } else {
      await refetchClient();
    }
    toast.success("報表已生成");
  };

  const handleDownloadCSV = () => {
    const data = reportType === "worker" ? workerReport : clientReport;
    if (!data || data.length === 0) {
      toast.error("無資料可下載");
      return;
    }

    let csvContent = "";
    if (reportType === "worker") {
      csvContent = "\uFEFF員工姓名,客戶名稱,日期,開始時間,結束時間,實際工時(小時)\n";
      data.forEach((row: any) => {
        csvContent += `${row.workerName},${row.clientName},${row.demandDate},${row.actualStart},${row.actualEnd},${row.actualHours}\n`;
      });
    } else {
      csvContent = "\uFEFF客戶名稱,員工姓名,總工時(小時)\n";
      data.forEach((row: any) => {
        csvContent += `${row.clientName},${row.workerName},${row.totalHours}\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${reportType === "worker" ? "員工薪資報表" : "客戶工時報表"}_${startDate}_${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV 檔案已下載");
  };

  const isLoading = workerLoading || clientLoading;
  const currentData = reportType === "worker" ? workerReport : clientReport;

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
                <p className="text-xs text-muted-foreground mt-1.5">
                  {reportType === "worker"
                    ? "按員工分組，顯示客戶、日期、實際工時，方便計算薪資"
                    : "按客戶+員工彙總工時，方便計算薪資和帳務對帳"}
                </p>
              </div>

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
                  <p className="text-xs text-muted-foreground mt-1.5">
                    選擇特定員工或全部員工的薪資記錄
                  </p>
                </div>
              )}

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
                  <p className="text-xs text-muted-foreground mt-1.5">
                    選擇特定客戶或全部客戶的工時記錄
                  </p>
                </div>
              )}

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
                  <CardTitle className="text-base font-medium">報表預覽</CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {reportType === "worker" ? "員工薪資報表" : "客戶工時報表"} · {startDate} 至 {endDate}
                  </CardDescription>
                </div>
                {currentData && currentData.length > 0 && (
                  <span className="text-xs text-muted-foreground">{currentData.length} 筆記錄</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : currentData && currentData.length > 0 ? (
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
                            <TableHead className="text-xs font-medium text-right">實際工時(小時)</TableHead>
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
                      {currentData.map((row: any, index: number) => (
                        <TableRow key={index} className="hover:bg-muted/20">
                          {reportType === "worker" ? (
                            <>
                              <TableCell className="font-medium text-sm">{row.workerName}</TableCell>
                              <TableCell className="text-sm">{row.clientName}</TableCell>
                              <TableCell className="text-sm">{row.demandDate}</TableCell>
                              <TableCell className="text-sm">{row.actualStart}</TableCell>
                              <TableCell className="text-sm">{row.actualEnd}</TableCell>
                              <TableCell className="text-right text-sm tabular-nums">{row.actualHours}</TableCell>
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
