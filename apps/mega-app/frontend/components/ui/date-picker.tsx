"use client"

import * as React from "react"
import { format } from "date-fns"
import { ro } from "date-fns/locale"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  date: Date | undefined
  onSelect: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const MONTHS_RO = [
  "Ianuarie", "Februarie", "Martie", "Aprilie",
  "Mai", "Iunie", "Iulie", "August",
  "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
]

const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: currentYear - 1970 + 1 }, (_, i) => currentYear - i)

export function DatePicker({
  date,
  onSelect,
  placeholder = "Selecteaza data",
  disabled = false,
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [displayMonth, setDisplayMonth] = React.useState<Date>(date || new Date())

  React.useEffect(() => {
    if (date) {
      setDisplayMonth(date)
    }
  }, [date])

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value)
    const newDate = new Date(displayMonth)
    newDate.setMonth(newMonth)
    setDisplayMonth(newDate)
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value)
    const newDate = new Date(displayMonth)
    newDate.setFullYear(newYear)
    setDisplayMonth(newDate)
  }

  const goToPrevMonth = () => {
    const newDate = new Date(displayMonth)
    newDate.setMonth(newDate.getMonth() - 1)
    setDisplayMonth(newDate)
  }

  const goToNextMonth = () => {
    const newDate = new Date(displayMonth)
    newDate.setMonth(newDate.getMonth() + 1)
    setDisplayMonth(newDate)
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-10 px-3 bg-white border border-gray-200 rounded-md text-left text-sm transition-colors",
          "focus:outline-none focus:ring-1 focus:ring-slate-500 focus:border-slate-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          date ? "text-slate-900" : "text-slate-400",
          className
        )}
      >
        {date ? format(date, "dd.MM.yyyy", { locale: ro }) : placeholder}
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 z-50 mt-1 rounded-md border bg-popover p-3 shadow-md">
            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={goToPrevMonth}
                className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1">
                <select
                  value={displayMonth.getMonth()}
                  onChange={handleMonthChange}
                  className="text-sm font-medium bg-transparent border border-gray-200 rounded-md px-2 py-1 cursor-pointer hover:bg-accent focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  {MONTHS_RO.map((month, idx) => (
                    <option key={idx} value={idx}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  value={displayMonth.getFullYear()}
                  onChange={handleYearChange}
                  className="text-sm font-medium bg-transparent border border-gray-200 rounded-md px-2 py-1 cursor-pointer hover:bg-accent focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  {YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={goToNextMonth}
                className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-input"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <DayPicker
              mode="single"
              selected={date}
              month={displayMonth}
              onMonthChange={setDisplayMonth}
              onSelect={(newDate) => {
                onSelect(newDate)
                setIsOpen(false)
              }}
              locale={ro}
              className="p-0"
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "hidden",
                nav: "hidden",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: "h-9 w-9 text-center text-sm p-0 relative",
                day: cn(
                  "h-9 w-9 p-0 font-normal inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                ),
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                day_today: "bg-accent text-accent-foreground",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_hidden: "invisible",
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
