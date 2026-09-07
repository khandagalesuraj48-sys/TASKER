import React, { useState, useEffect } from 'react';
import { History, Clock } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { getAssignmentHistory } from '../services/enterpriseService';
import { TaskAssignment } from '../types/task';
import { formatDateTime } from '../lib/dateUtils';

export const AssignmentHistoryPage: React.FC = () => {
  const { currentOrg, isMember } = useEnterprise();
  const [history, setHistory] = useState<TaskAssignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!currentOrg?.id || !isMember) {
      setIsLoading(false);
      return;
    }
    getAssignmentHistory(currentOrg.id).then((list) => {
      setHistory(list);
      setIsLoading(false);
    });
  }, [currentOrg?.id, isMember]);

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase tracking-wider">
          <History className="w-4 h-4" />
          <span>Audit Log</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
          Task Assignment History
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Immutable audit trail of all task assignments, delegations, and reassignments.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-2">
          <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Assignment Records Yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Assignments and reassignments will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((record) => (
            <div
              key={record.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {record.assigned_to_name || 'Assigned Member'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {record.status}
                  </span>
                </div>
                {record.remark && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic">&ldquo;{record.remark}&rdquo;</p>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatDateTime(record.assigned_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
