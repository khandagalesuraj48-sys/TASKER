// src/components/tasks/TaskGanttView.tsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../types/task';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  eachDayOfInterval,
  isToday,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns';

interface TaskGanttViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

type TimeScale = 'day' | 'week';

export const TaskGanttView: React.FC<TaskGanttViewProps> = ({ tasks, onTaskClick }) => {
  const navigate = useNavigate();

  // Navigation base date (defaults to current week)
  const [baseDate, setBaseDate] = useState<Date>(new Date());
  const [timeScale, setTimeScale] = useState<TimeScale>('day');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Compute timeline window: 14 days or 28 days
  const timelineDaysCount = timeScale === 'day' ? 14 : 28;
  const startDate = useMemo(() => startOfWeek(baseDate, { weekStartsOn: 1 }), [baseDate]);
  const endDate = useMemo(() => addDays(startDate, timelineDaysCount - 1), [startDate, timelineDaysCount]);

  const daysList = useMemo(() => {
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [startDate, endDate]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasks, statusFilter]);

  const handlePrev = () => {
    setBaseDate((prev) => subDays(prev, timeScale === 'day' ? 7 : 14));
  };

  const handleNext = () => {
    setBaseDate((prev) => addDays(prev, timeScale === 'day' ? 7 : 14));
  };

  const handleToday = () => {
    setBaseDate(new Date());
  };

  const handleBarClick = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      navigate(`/tasks/${task.id}`);
    }
  };

  // Helper to calculate start offset & bar span in days
  const getTaskBarSpan = (task: Task) => {
    const createdDate = task.started_at
      ? parseISO(task.started_at)
      : task.created_at
      ? parseISO(task.created_at)
      : new Date();

    const dueDate = task.due_date ? parseISO(task.due_date) : addDays(createdDate, 2);

    let offsetDays = differenceInCalendarDays(createdDate, startDate);
    let spanDays = differenceInCalendarDays(dueDate, createdDate) + 1;

    if (spanDays < 1) spanDays = 1;

    // Bounds check within current visible window
    const visibleStart = Math.max(0, offsetDays);
    const visibleEnd = Math.min(timelineDaysCount - 1, offsetDays + spanDays - 1);
    const visibleSpan = Math.max(1, visibleEnd - visibleStart + 1);

    const isVisible = offsetDays + spanDays > 0 && offsetDays < timelineDaysCount;

    return {
      offsetDays: visibleStart,
      spanDays: visibleSpan,
      isVisible,
      isBefore: offsetDays + spanDays <= 0,
      isAfter: offsetDays >= timelineDaysCount,
    };
  };

  // Color mapping based on status & priority
  const getStatusColor = (task: Task) => {
    if (task.status === 'completed') {
      return 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-700';
    }
    if (task.status === 'in_progress') {
      return 'bg-blue-600 dark:bg-blue-500 text-white border-blue-700';
    }
    if (task.status === 'partial') {
      return 'bg-amber-500 dark:bg-amber-600 text-white border-amber-700';
    }
    if (task.priority === 'urgent') {
      return 'bg-red-600 dark:bg-red-500 text-white border-red-700';
    }
    return 'bg-slate-700 dark:bg-slate-600 text-slate-100 border-slate-800';
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-muted/20">
        {/* Navigation & Date Range */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            title="Previous Range"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-md border border-border hover:bg-muted text-foreground"
          >
            Today
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
            title="Next Range"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold text-foreground ml-2">
            {format(startDate, 'MMM d, yyyy')} — {format(endDate, 'MMM d, yyyy')}
          </span>
        </div>

        {/* View & Status Filters */}
        <div className="flex items-center gap-2">
          {/* Zoom Toggle */}
          <div className="flex items-center rounded-md border border-border bg-card p-0.5 text-xs font-medium">
            <button
              onClick={() => setTimeScale('day')}
              className={`px-2.5 py-1 rounded-sm transition-colors ${
                timeScale === 'day' ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              14 Days
            </button>
            <button
              onClick={() => setTimeScale('week')}
              className={`px-2.5 py-1 rounded-sm transition-colors ${
                timeScale === 'week' ? 'bg-muted text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              4 Weeks
            </button>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1 px-2.5 rounded-md border border-border bg-background text-foreground"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="partial">Partial</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Gantt Interactive Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Calendar Day Header */}
          <div className="grid grid-cols-[240px_1fr] border-b border-border bg-muted/40 text-xs">
            <div className="p-3 font-semibold text-muted-foreground border-r border-border flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Task & Operative</span>
            </div>

            {/* Days row */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${timelineDaysCount}, minmax(0, 1fr))`,
              }}
            >
              {daysList.map((d, i) => {
                const isCurrent = isToday(d);
                return (
                  <div
                    key={i}
                    className={`py-2 px-1 text-center border-r border-border/50 text-[11px] ${
                      isCurrent
                        ? 'bg-primary/10 text-primary font-bold border-primary/30'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-semibold">{format(d, 'EEE')}</div>
                    <div className="text-xs">{format(d, 'd')}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tasks Rows */}
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-xs">
              No tasks found for the selected timeline window or filters.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredTasks.map((task) => {
                const { offsetDays, spanDays, isVisible, isBefore, isAfter } = getTaskBarSpan(task);
                const colorClass = getStatusColor(task);

                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[240px_1fr] hover:bg-muted/30 transition-colors text-xs items-center group"
                  >
                    {/* Left Column: Task Info */}
                    <div
                      onClick={() => handleBarClick(task)}
                      className="p-3 border-r border-border flex flex-col gap-0.5 cursor-pointer"
                    >
                      <span className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <User className="w-2.5 h-2.5" />
                          {task.assigned_to_name || 'Self'}
                        </span>
                        <span>•</span>
                        <span className="uppercase font-semibold text-[9px]">{task.priority}</span>
                      </div>
                    </div>

                    {/* Right Column: Timeline Grid */}
                    <div
                      className="relative h-12 grid items-center"
                      style={{
                        gridTemplateColumns: `repeat(${timelineDaysCount}, minmax(0, 1fr))`,
                      }}
                    >
                      {/* Column background dividers */}
                      {daysList.map((d, i) => (
                        <div
                          key={i}
                          className={`h-full border-r border-border/30 ${
                            isToday(d) ? 'bg-primary/5' : ''
                          }`}
                        />
                      ))}

                      {/* Floating Task Timeline Bar */}
                      {isVisible && (
                        <div
                          onClick={() => handleBarClick(task)}
                          style={{
                            gridColumnStart: offsetDays + 1,
                            gridColumnEnd: `span ${spanDays}`,
                          }}
                          className={`absolute inset-y-2 left-1 right-1 rounded-md px-2 flex items-center justify-between text-[11px] font-medium shadow-xs cursor-pointer hover:opacity-90 hover:scale-[1.01] transition-all border ${colorClass}`}
                          title={`${task.title}\nDue: ${
                            task.due_date ? format(parseISO(task.due_date), 'PPP') : 'N/A'
                          }\nStatus: ${task.status.toUpperCase()}`}
                        >
                          <span className="truncate pr-1 font-semibold">{task.title}</span>
                          <span className="text-[10px] opacity-90 font-mono hidden md:inline">
                            {task.status === 'completed' ? '✓' : task.priority.slice(0, 1).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Out of bounds indicators */}
                      {isBefore && (
                        <div className="absolute left-2 text-[10px] text-muted-foreground italic">
                          ◀ Prior
                        </div>
                      )}
                      {isAfter && (
                        <div className="absolute right-2 text-[10px] text-muted-foreground italic">
                          Later ▶
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center gap-4 p-3 border-t border-border bg-muted/10 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> Completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" /> In Progress
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Partial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-600 inline-block" /> Urgent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 inline-block" /> Pending
        </span>
      </div>
    </div>
  );
};
