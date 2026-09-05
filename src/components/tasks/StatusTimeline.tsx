import React from 'react';
import { TaskStatusHistory } from '../../types/task';
import { formatDateTime } from '../../lib/dateUtils';
import { STATUS_CONFIG } from '../../constants';
import { User, Clock, ArrowRight, MessageSquare } from 'lucide-react';

interface StatusTimelineProps {
  history: TaskStatusHistory[];
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-slate-400">
        No status history recorded yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
      {history.map((record, index) => {
        const newCfg = STATUS_CONFIG[record.new_status] || STATUS_CONFIG.pending;
        const oldCfg = record.old_status ? STATUS_CONFIG[record.old_status] : null;
        const isLatest = index === 0;

        return (
          <div key={record.id} className="relative group">
            {/* Timeline Bullet */}
            <div
              className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                isLatest
                  ? 'bg-blue-600 border-white ring-2 ring-blue-500/30 text-white'
                  : 'bg-white border-slate-300 text-slate-400'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isLatest ? 'bg-white' : 'bg-slate-400'
                }`}
              />
            </div>

            {/* Event Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Transition badges */}
                <div className="flex items-center gap-2 text-xs">
                  {oldCfg ? (
                    <span
                      className={`px-2 py-0.5 rounded-full border ${oldCfg.badgeBg} ${oldCfg.badgeText} ${oldCfg.badgeBorder} font-medium`}
                    >
                      {oldCfg.label}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">Created</span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span
                    className={`px-2 py-0.5 rounded-full border ${newCfg.badgeBg} ${newCfg.badgeText} ${newCfg.badgeBorder} font-semibold`}
                  >
                    {newCfg.label}
                  </span>
                </div>

                {/* Date & Time */}
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatDateTime(record.changed_at)}</span>
                </div>
              </div>

              {/* Actor */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Changed by: <strong className="text-slate-800">{record.changed_by}</strong>
                </span>
              </div>

              {/* Remark */}
              {record.remarks && (
                <div className="mt-2 text-xs bg-slate-50 rounded p-2 text-slate-700 border border-slate-100 flex items-start gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p className="whitespace-pre-line leading-relaxed">{record.remarks}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

