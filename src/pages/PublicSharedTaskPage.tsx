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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-muted-foreground">
          Decrypting and loading shared task...
        </p>
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-6 bg-card rounded-2xl shadow-xl border border-border text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3 text-destructive">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">
            Link Unavailable
          </h2>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            {error || 'This task share link is either inactive, expired, or has been revoked by the creator.'}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            Go to TASKER Sign In
          </Link>
        </div>
      </div>
    );
  }

  const overdue = isTaskOverdue(taskData.due_date, taskData.status);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Banner */}
      <header className="bg-card border-b border-border/80 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-xs">
              T
            </div>
            <div>
              <span className="font-bold text-foreground text-sm tracking-wide">
                TASKER
              </span>
              <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
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
        <div className="bg-card rounded-2xl shadow-xs border border-border/80 overflow-hidden">
          {/* Header Info */}
          <div className="p-5 sm:p-7 border-b border-border/60">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <StatusBadge status={taskData.status} />
              <PriorityBadge priority={taskData.priority} />
              {taskData.scope && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground capitalize">
                  {taskData.scope} Scope
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
              {taskData.title}
            </h1>

            {/* Meta Row */}
            <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-muted-foreground">
              {taskData.person_name && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Pending with: <strong className="text-foreground">{taskData.person_name}</strong>
                  </span>
                </div>
              )}

              {taskData.due_date && (
                <div className={`flex items-center gap-1.5 ${overdue ? 'text-destructive font-semibold' : ''}`}>
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>Due: {formatDateOnly(taskData.due_date)}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Created: {formatDateTime(taskData.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="p-5 sm:p-7">
            <h2 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-2">
              Description / Instructions
            </h2>
            {taskData.description ? (
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/40">
                {taskData.description}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground">No additional description provided.</p>
            )}
          </div>

          {/* Attachments Section */}
          {allowAttachments && (
            <div className="p-5 sm:p-7 border-t border-border/60 bg-muted/20">
              <h2 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span>Supporting Attachments ({attachments.length})</span>
              </h2>

              {attachments.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">No files attached to this task.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {attachments.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 rounded-xl border border-border/80 bg-card flex items-center justify-between text-xs shadow-2xs"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-medium text-foreground truncate">
                          {file.file_name}
                        </p>
                        {file.file_size && (
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {(file.file_size / 1024).toFixed(1)} KB
                          </p>
                        )}
                      </div>
                      {file.file_path && (
                        <a
                          href={file.file_path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
            <div className="p-4 border-t border-border/60 text-center text-[11px] text-muted-foreground font-mono">
              This link will expire on {formatDateTime(expiresAt)}.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
