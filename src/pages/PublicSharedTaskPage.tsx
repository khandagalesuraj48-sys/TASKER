import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicSharedTask } from '../services/shareLinkService';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { formatDateOnly, formatDateTime, isTaskOverdue } from '../lib/dateUtils';
import {
  Calendar,
  Clock,
  User,
  Paperclip,
  Download,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const PublicSharedTaskPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [taskData, setTaskData] = useState<any>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [allowAttachments, setAllowAttachments] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing shared link token.');
      setIsLoading(false);
      return;
    }

    const fetchSharedTask = async () => {
      setIsLoading(true);
      try {
        const result = await getPublicSharedTask(token);
        setTaskData(result.task);
        setAttachments(result.attachments);
        setAllowAttachments(result.allowAttachments);
        setExpiresAt(result.expiresAt);
      } catch (err: any) {
        setError(err.message || 'This shared link has expired or is invalid.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedTask();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Decrypting and loading shared task...
        </p>
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center mx-auto mb-3 text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
            Link Unavailable
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            {error || 'This task share link is either inactive, expired, or has been revoked by the creator.'}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Go to TASKER Sign In
          </Link>
        </div>
      </div>
    );
  }

  const overdue = isTaskOverdue(taskData.due_date, taskData.status);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Top Banner */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              T
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-wide">
                TASKER
              </span>
              <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                Shared Task View
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Verified Read-Only View</span>
          </div>
        </div>
      </header>

      {/* Main Task Card */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Header Info */}
          <div className="p-5 sm:p-7 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <StatusBadge status={taskData.status} />
              <PriorityBadge priority={taskData.priority} />
              {taskData.scope && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                  {taskData.scope} Scope
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {taskData.title}
            </h1>

            {/* Meta Row */}
            <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-500 dark:text-slate-400">
              {taskData.person_name && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>
                    Pending with: <strong className="text-slate-800 dark:text-slate-200">{taskData.person_name}</strong>
                  </span>
                </div>
              )}

              {taskData.due_date && (
                <div className={`flex items-center gap-1.5 ${overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}`}>
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Due: {formatDateOnly(taskData.due_date)}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Created: {formatDateTime(taskData.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="p-5 sm:p-7">
            <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Description / Instructions
            </h2>
            {taskData.description ? (
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                {taskData.description}
              </p>
            ) : (
              <p className="text-xs italic text-slate-400">No additional description provided.</p>
            )}
          </div>

          {/* Attachments Section */}
          {allowAttachments && (
            <div className="p-5 sm:p-7 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-400" />
                <span>Supporting Attachments ({attachments.length})</span>
              </h2>

              {attachments.length === 0 ? (
                <p className="text-xs italic text-slate-400">No files attached to this task.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {file.file_name}
                        </p>
                        {file.file_size && (
                          <p className="text-[11px] text-slate-400">
                            {(file.file_size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                      {file.file_path && (
                        <a
                          href={file.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                          title="View / Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Expiration Notice Footer */}
          {expiresAt && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
              This link will expire on {formatDateTime(expiresAt)}.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
