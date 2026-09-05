import React, { useState } from 'react';
import { TaskFilterOptions, TaskPriority, TaskStatus, SortField } from '../../types/task';
import { Filter, RotateCcw, Paperclip } from 'lucide-react';
import { Button } from '../common/Button';

interface FilterPanelProps {
  filters: TaskFilterOptions;
  onChange: (filters: TaskFilterOptions) => void;
  onReset: () => void;
  hideStatusFilter?: boolean;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onChange,
  onReset,
  hideStatusFilter = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const activeFiltersCount =
    (filters.status && filters.status !== 'all' ? 1 : 0) +
    (filters.priority && filters.priority !== 'all' ? 1 : 0) +
    (filters.person ? 1 : 0) +
    (filters.hasAttachments ? 1 : 0) +
    (filters.sortBy && filters.sortBy !== 'newest' ? 1 : 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs">
      {/* Toggle button row */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <Filter className="w-4 h-4 text-slate-500" />
          <span>Filters & Sorting</span>
          {activeFiltersCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </button>
        )}
      </div>

      {/* Expandable filters body */}
      {isOpen && (
        <div className="border-t border-slate-100 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Status Filter */}
          {!hideStatusFilter && (
            <div>
              <label className="block font-medium text-slate-700 mb-1.5">Status</label>
              <select
                value={filters.status || 'all'}
                onChange={(e) =>
                  onChange({ ...filters, status: e.target.value as TaskStatus | 'all' })
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="partial">Partial</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          {/* Priority Filter */}
          <div>
            <label className="block font-medium text-slate-700 mb-1.5">Priority</label>
            <select
              value={filters.priority || 'all'}
              onChange={(e) =>
                onChange({ ...filters, priority: e.target.value as TaskPriority | 'all' })
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Pending With Person Filter */}
          <div>
            <label className="block font-medium text-slate-700 mb-1.5">Pending With / Person</label>
            <input
              type="text"
              value={filters.person || ''}
              onChange={(e) => onChange({ ...filters, person: e.target.value })}
              placeholder="e.g. Rahul, Vendor"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Sorting */}
          <div>
            <label className="block font-medium text-slate-700 mb-1.5">Sort By</label>
            <select
              value={filters.sortBy || 'newest'}
              onChange={(e) =>
                onChange({ ...filters, sortBy: e.target.value as SortField })
              }
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="due_date">Due Date</option>
              <option value="pending_duration">Longest Pending</option>
              <option value="recently_updated">Recently Updated</option>
              <option value="priority">Priority</option>
            </select>
          </div>

          {/* Attachment Toggle */}
          <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-slate-100 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 select-none">
              <input
                type="checkbox"
                checked={Boolean(filters.hasAttachments)}
                onChange={(e) =>
                  onChange({ ...filters, hasAttachments: e.target.checked })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
              <span>Only tasks with attachments</span>
            </label>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Close Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

