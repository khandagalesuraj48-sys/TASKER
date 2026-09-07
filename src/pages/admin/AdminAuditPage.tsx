import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { AdminAuditLog } from '../../types/admin';
import { useToast } from '../../context/ToastContext';

export const AdminAuditPage: React.FC = () => {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAuditLogs(100);
      setLogs(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Audit History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Immutable log of administrative operations, organization updates, and access decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        {logs.length === 0 && !loading ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-sm font-semibold">No audit logs recorded yet</p>
            <p className="text-xs mt-1">Administrative actions such as approvals and organization creation will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800/80">
                  <th className="pb-3 font-semibold">Action</th>
                  <th className="pb-3 font-semibold">Admin Account</th>
                  <th className="pb-3 font-semibold">Target</th>
                  <th className="pb-3 font-semibold">Details</th>
                  <th className="pb-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 uppercase">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-white">
                      {log.admin_email || 'System'}
                    </td>
                    <td className="py-3 text-slate-300">
                      <span className="font-mono text-[11px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                        {log.target_type}
                      </span>
                      {log.target_id && (
                        <span className="text-[10px] text-slate-500 block truncate max-w-[120px]">
                          {log.target_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-slate-400 max-w-xs truncate font-mono text-[11px]">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="py-3 text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
