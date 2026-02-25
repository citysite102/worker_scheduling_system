import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface DateMultiPickerProps {
  selectedDates: Date[];
  onDatesChange: (dates: Date[]) => void;
  minDate?: Date;
}

export function DateMultiPicker({ selectedDates, onDatesChange, minDate }: DateMultiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    // 檢查日期是否已選擇
    const dateString = format(date, "yyyy-MM-dd");
    const isSelected = selectedDates.some(
      (d) => format(d, "yyyy-MM-dd") === dateString
    );

    if (isSelected) {
      // 如果已選擇，則移除
      onDatesChange(
        selectedDates.filter((d) => format(d, "yyyy-MM-dd") !== dateString)
      );
    } else {
      // 如果未選擇，則加入
      onDatesChange([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const handleRemoveDate = (dateToRemove: Date) => {
    const dateString = format(dateToRemove, "yyyy-MM-dd");
    onDatesChange(
      selectedDates.filter((d) => format(d, "yyyy-MM-dd") !== dateString)
    );
  };

  const handleClearAll = () => {
    onDatesChange([]);
  };

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start text-left font-normal"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDates.length > 0
              ? `已選擇 ${selectedDates.length} 個日期`
              : "選擇日期"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDates[0]}
            onSelect={handleDateSelect}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              return false;
            }}
            modifiers={{
              selected: selectedDates,
            }}
            modifiersClassNames={{
              selected: "bg-primary/10 text-primary font-semibold border-2 border-primary",
            }}
            initialFocus
            locale={zhTW}
          />
          <div className="p-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                已選擇 {selectedDates.length} 個日期
              </span>
              {selectedDates.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-auto py-1 px-2"
                >
                  清除全部
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* 已選擇的日期列表 */}
      {selectedDates.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md">
          {selectedDates.map((date) => (
            <div
              key={format(date, "yyyy-MM-dd")}
              className="inline-flex items-center gap-1 px-2 py-1 bg-background border rounded-md text-sm"
            >
              <span>{format(date, "yyyy/MM/dd (E)", { locale: zhTW })}</span>
              <button
                type="button"
                onClick={() => handleRemoveDate(date)}
                className="ml-1 hover:bg-muted rounded-sm p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
