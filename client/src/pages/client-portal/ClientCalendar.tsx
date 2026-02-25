import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export default function ClientCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // 取得當月的開始和結束日期
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  // 查詢當月的需求單
  const { data: demandsData, isLoading } = trpc.demands.list.useQuery({
    page: 1,
    pageSize: 100, // 取得當月所有需求單
  });

  const demands = demandsData?.demands || [];

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="h-8 w-8" />
            派工行事曆
          </h1>
          <p className="text-muted-foreground mt-1">
            查看每月的派工狀況與已指派員工
          </p>
        </div>
      </div>

      {/* Calendar Card */}
      <Card className="p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
            上個月
          </Button>
          <h2 className="text-2xl font-semibold">{formatMonthTitle()}</h2>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            下個月
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Weekday Headers */}
          {['日', '一', '二', '三', '四', '五', '六'].map((day, index) => (
            <div
              key={index}
              className="text-center font-semibold text-muted-foreground py-2"
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
                  ${dayDemands.length > 0 ? 'bg-accent/50' : 'bg-background'}
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
                      {dayDemands.length} 個需求
                    </div>
                    {totalAssignments > 0 && (
                      <div className="text-xs text-primary flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {totalAssignments} 位員工
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
      </Card>

      {/* Demands List for Current Month */}
      {demands.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">本月需求單列表</h3>
          <div className="space-y-3">
            {demands.map(demand => (
              <div
                key={demand.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium">需求單 #{demand.id}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(demand.date).toLocaleDateString('zh-TW', {
                      month: 'numeric',
                      day: 'numeric',
                      weekday: 'short',
                    })} {demand.startTime} - {demand.endTime}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    需求 <span className="font-semibold">{demand.requiredWorkers}</span> 人
                  </div>
                  <div className="text-sm">
                    已指派 <span className="font-semibold text-primary">{demand.assignedCount || 0}</span> 人
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
