import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClientDemands() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentDate, setCurrentDate] = useState(new Date());
  const pageSize = 20;

  const { data, isLoading } = trpc.demands.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    page: currentPage,
    pageSize,
  });

  const demands = data?.demands || [];
  const pagination = data?.pagination;

  // 上一個月
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // 下一個月
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // 取得月曆的日期陣列
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // 當月第一天是星期幾（0=週日, 1=週一, ...）
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // 當月有幾天
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days: (Date | null)[] = [];
    
    // 填入前面的空白
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    
    // 填入當月的日期
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const calendarDays = getCalendarDays();

  // 取得某一天的需求單
  const getDemandsForDay = (date: Date) => {
    return demands.filter(demand => {
      const demandDate = new Date(demand.date);
      return (
        demandDate.getFullYear() === date.getFullYear() &&
        demandDate.getMonth() === date.getMonth() &&
        demandDate.getDate() === date.getDate()
      );
    });
  };

  // 格式化月份標題
  const formatMonthTitle = () => {
    return `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;
  };

  // 判斷是否為今天
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  return (
    <ClientPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">需求管理</h1>
            <p className="text-muted-foreground mt-1">
              管理您的用工需求單與派工行事曆
            </p>
          </div>
          <Link href="/client-portal/demands/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              建立需求單
            </Button>
          </Link>
        </div>

        {/* 左右分欄佈局 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側：需求單列表 */}
          <Card className="lg:h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>需求單列表</CardTitle>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="篩選狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部狀態</SelectItem>
                    <SelectItem value="pending">待審核</SelectItem>
                    <SelectItem value="confirmed">已確認</SelectItem>
                    <SelectItem value="assigned">進行中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                    <p className="text-muted-foreground">載入中...</p>
                  </div>
                </div>
              ) : demands.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {statusFilter === "all"
                      ? "尚無需求單"
                      : `尚無${
                          statusFilter === "pending"
                            ? "待審核"
                            : statusFilter === "confirmed"
                            ? "已確認"
                            : statusFilter === "assigned"
                            ? "進行中"
                            : statusFilter === "completed"
                            ? "已完成"
                            : "已取消"
                        }的需求單`}
                  </p>
                  <Link href="/client-portal/demands/create">
                    <Button variant="outline" size="sm" className="mt-4">
                      建立需求單
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {demands.map((demand) => (
                      <Link
                        key={demand.id}
                        href={`/client-portal/demands/${demand.id}`}
                      >
                        <div className="flex items-center justify-between rounded-lg border p-5 hover:bg-accent hover:shadow-md transition-all cursor-pointer bg-card mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-semibold text-base">
                                {new Date(demand.date).toLocaleDateString(
                                  "zh-TW",
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  }
                                )}
                              </p>
                              <span className="text-sm text-muted-foreground font-medium">
                                {demand.startTime} - {demand.endTime}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>需求人數：{demand.requiredWorkers} 人</span>
                              <span>已指派：{demand.assignedCount} 人</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                demand.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : demand.status === "confirmed"
                                  ? "bg-blue-100 text-blue-800"
                                  : demand.status === "assigned"
                                  ? "bg-purple-100 text-purple-800"
                                  : demand.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {demand.status === "pending"
                                ? "待審核"
                                : demand.status === "confirmed"
                                ? "已確認"
                                : demand.status === "assigned"
                                ? "進行中"
                                : demand.status === "completed"
                                ? "已完成"
                                : demand.status === "cancelled"
                                ? "已取消"
                                : demand.status}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* 分頁 */}
                  {pagination && pagination.totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        第 {pagination.currentPage} / {pagination.totalPages} 頁，共{" "}
                        {pagination.total} 筆
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          上一頁
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={currentPage === pagination.totalPages}
                          onClick={() =>
                            setCurrentPage((p) =>
                              Math.min(pagination.totalPages, p + 1)
                            )
                          }
                        >
                          下一頁
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 右側：行事曆 */}
          <Card className="lg:h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  派工行事曆
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={previousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[100px] text-center">
                    {formatMonthTitle()}
                  </span>
                  <Button variant="outline" size="sm" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Weekday Headers */}
                {['日', '一', '二', '三', '四', '五', '六'].map((day, index) => (
                  <div
                    key={index}
                    className="text-center font-semibold text-muted-foreground py-2 text-sm"
                  >
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {calendarDays.map((date, index) => {
                  if (!date) {
                    return <div key={index} className="aspect-square" />;
                  }

                  const dayDemands = getDemandsForDay(date);
                  const totalAssignments = dayDemands.reduce((sum, demand) => sum + (demand.assignedCount || 0), 0);

                  return (
                    <div
                      key={index}
                      className={`
                        aspect-square border rounded-lg p-2 flex flex-col
                        ${isToday(date) ? 'border-primary bg-primary/5' : 'border-border'}
                        ${dayDemands.length > 0 ? 'bg-accent/50 cursor-pointer hover:bg-accent' : 'bg-background'}
                        transition-colors
                      `}
                    >
                      {/* Date Number */}
                      <div className={`text-sm font-medium ${isToday(date) ? 'text-primary' : 'text-foreground'}`}>
                        {date.getDate()}
                      </div>

                      {/* Demands Info */}
                      {dayDemands.length > 0 && (
                        <div className="mt-auto space-y-1">
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {dayDemands.length}
                          </div>
                          {totalAssignments > 0 && (
                            <div className="text-xs text-primary flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {totalAssignments}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary bg-primary/5 rounded" />
                  今天
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-accent/50 border border-border rounded" />
                  有需求單
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientPortalLayout>
  );
}
