import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Calendar,
  Paperclip,
  ArrowRight,
  User,
  Loader2,
} from 'lucide-react';
import { universalSearchTasks } from '../../services/taskService';
import { MatchFieldCategory, UniversalSearchResult } from '../../types/task';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { formatDateTime } from '../../lib/dateUtils';

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const getMatchBadge = (field: MatchFieldCategory) => {
  switch (field) {
    case 'title_exact':
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Exact Title</span>;
    case 'title':
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">Title</span>;
    case 'description':
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800">Description</span>;
    case 'note':
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Notes / Remarks</span>;
    case 'person':
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-100 text-sky-800">Person</span>;
    case 'status_priority':
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">Status / Priority</span>;
    case 'status_history':
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800">Status History</span>;
    case 'attachment':
      return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">Attachment File</span>;
    default:
      return null;
  }
};

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<string>(initialQuery);
  const [results, setResults] = useState<UniversalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setResults([]);
    }
  }, [isOpen, initialQuery]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const clean = query.trim();
    if (!clean) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await universalSearchTasks(clean);
        setResults(res);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Universal search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelectTask(results[selectedIndex].task.id);
      }
    }
  };

  const handleSelectTask = (taskId: string) => {
    onClose();
    navigate(`/tasks/${taskId}`);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 border-b border-slate-200 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across tasks, descriptions, notes, history, and attachments..."
            className="w-full py-4 text-base bg-transparent text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {isLoading && (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin mr-2 shrink-0" />
          )}
          {query && !isLoading && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
              aria-label="Clear query"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block ml-3 px-2 py-0.5 text-[11px] font-mono text-slate-400 bg-slate-200/70 rounded">
            ESC
          </span>
        </div>

        {/* Results / Feedback Section */}
        <div className="overflow-y-auto flex-1 p-2 divide-y divide-slate-100">
          {/* Loading state */}
          {isLoading && results.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
              Searching database...
            </div>
          )}

          {/* Empty state: No query entered */}
          {!query.trim() && (
            <div className="p-8 text-center text-slate-500">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">Universal Task Search</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Search task titles, full descriptions, assignees, remarks, status change history, and attachment filenames.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">e.g. Disha</span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">e.g. project requirements</span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">e.g. urgent</span>
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">e.g. .pdf</span>
              </div>
            </div>
          )}

          {/* No results state */}
          {query.trim() && !isLoading && results.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              <p className="text-sm font-medium text-slate-700">No matching tasks found</p>
              <p className="text-xs text-slate-400 mt-1">
                No tasks, notes, history remarks, or attachment filenames matched "{query}".
              </p>
              <button
                onClick={() => setQuery('')}
                className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Results List */}
          {results.map((res, index) => {
            const isSelected = index === selectedIndex;
            return (
              <div
                key={res.task.id}
                onClick={() => handleSelectTask(res.task.id)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`p-3 rounded-lg cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                  isSelected ? 'bg-blue-50/80 border border-blue-200' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {getMatchBadge(res.matchedField)}
                    <StatusBadge status={res.task.status} size="sm" />
                    <PriorityBadge priority={res.task.priority} size="sm" />
                    {(res.task.attachments_count ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <Paperclip className="w-3 h-3 text-slate-400" />
                        {res.task.attachments_count}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-semibold text-slate-900 truncate">
                    {res.task.title}
                  </h4>

                  {/* Matching Excerpt */}
                  {res.snippet && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      <span className="font-medium text-slate-600">Match:</span> {res.snippet}
                    </p>
                  )}

                  {/* Context bar */}
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                    {res.task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due: {formatDateTime(res.task.due_date)}
                      </span>
                    )}
                    {res.task.person_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {res.task.person_name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 pt-1 text-slate-400">
                  <ArrowRight className={`w-4 h-4 ${isSelected ? 'text-blue-600 translate-x-0.5' : ''} transition-transform`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        {results.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
            <span>
              Found <strong>{results.length}</strong> {results.length === 1 ? 'task' : 'tasks'}
            </span>
            <span className="hidden sm:inline">Use ↑ ↓ to navigate, Enter to select</span>
          </div>
        )}
      </div>
    </div>
  );
};