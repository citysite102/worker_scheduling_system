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
  const [hasGenerated, setHasGenerated] = useState(false);

  const { data: workerReport, isLoading: workerLoading, refetch: refetchWorker } = trpc.reports.workerPayroll.useQuery(
    {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    {
      enabled: false,
    }
  );

  const { data: clientReport, isLoading: clientLoading, refetch: refetchClient } = trpc.reports.clientHours.useQuery(
    {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    {
      enabled: false,
    }
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

    // 生成 CSV 內容
    let csvContent = "";
    
    if (reportType === "worker") {
      // 員工薪資報表表頭
      csvContent = "\uFEFF員工姓名,客戶名稱,日期,開始時間,結束時間,實際工時(小時)\n";
      data.forEach((row: any) => {
        csvContent += `${row.workerName},${row.clientName},${row.demandDate},${row.actualStart},${row.actualEnd},${row.actualHours}\n`;
      });
    } else {
      // 客戶工時報表表頭
      csvContent = "\uFEFF客戶名稱,員工姓名,日期,開始時間,結束時間,實際工時(小時)\n";
      data.forEach((row: any) => {
        csvContent += `${row.clientName},${row.workerName},${row.demandDate},${row.actualStart},${row.actualEnd},${row.actualHours}\n`;
      });
    }

    // 建立下載連結
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
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">報表輸出</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>報表設定</CardTitle>
            <CardDescription>選擇報表類型與日期區間，生成報表後可下載 CSV 檔案</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <div>
                <Label className="text-base font-medium">報表類型</Label>
                <Select value={reportType} onValueChange={(value) => {
                  setReportType(value as ReportType);
                  setHasGenerated(false);
                }}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worker">員工薪資報表</SelectItem>
                    <SelectItem value="client">客戶工時報表</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  {reportType === "worker" 
                    ? "按員工分組，顯示客戶、日期、實際工時，方便計算薪資" 
                    : "按客戶分組，顯示員工、日期、實際工時，方便帳務對帳"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-base font-medium">開始日期</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setHasGenerated(false);
                    }}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-base font-medium">結束日期</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setHasGenerated(false);
                    }}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleGenerate} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <FileText className="mr-2 h-4 w-4" />
                  生成報表
                </Button>
                {hasGenerated && currentData && currentData.length > 0 && (
                  <Button variant="outline" onClick={handleDownloadCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    下載 CSV
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {hasGenerated && (
          <Card>
            <CardHeader>
              <CardTitle>報表預覽</CardTitle>
              <CardDescription>
                {reportType === "worker" ? "員工薪資報表" : "客戶工時報表"} · {startDate} 至 {endDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : currentData && currentData.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {reportType === "worker" ? (
                          <>
                            <TableHead>員工姓名</TableHead>
                            <TableHead>客戶名稱</TableHead>
                            <TableHead>日期</TableHead>
                            <TableHead>開始時間</TableHead>
                            <TableHead>結束時間</TableHead>
                            <TableHead className="text-right">實際工時(小時)</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>客戶名稱</TableHead>
                            <TableHead>員工姓名</TableHead>
                            <TableHead>日期</TableHead>
                            <TableHead>開始時間</TableHead>
                            <TableHead>結束時間</TableHead>
                            <TableHead className="text-right">實際工時(小時)</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentData.map((row: any, index: number) => (
                        <TableRow key={index}>
                          {reportType === "worker" ? (
                            <>
                              <TableCell className="font-medium">{row.workerName}</TableCell>
                              <TableCell>{row.clientName}</TableCell>
                              <TableCell>{row.demandDate}</TableCell>
                              <TableCell>{row.actualStart}</TableCell>
                              <TableCell>{row.actualEnd}</TableCell>
                              <TableCell className="text-right">{row.actualHours}</TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="font-medium">{row.clientName}</TableCell>
                              <TableCell>{row.workerName}</TableCell>
                              <TableCell>{row.demandDate}</TableCell>
                              <TableCell>{row.actualStart}</TableCell>
                              <TableCell>{row.actualEnd}</TableCell>
                              <TableCell className="text-right">{row.actualHours}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
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
