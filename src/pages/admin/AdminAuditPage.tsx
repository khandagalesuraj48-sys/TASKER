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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Admin Audit History</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Immutable log of administrative operations, organization updates, and access decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs font-semibold transition-all border border-border/50 flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-card border border-border/80 rounded-xl p-5 shadow-2xs space-y-4">
        {logs.length === 0 && !loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40 text-primary" />
            <p className="text-sm font-semibold text-foreground">No audit logs recorded yet</p>
            <p className="text-xs mt-1">Administrative actions such as approvals and organization creation will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/80">
                  <th className="pb-3 font-semibold">Action</th>
                  <th className="pb-3 font-semibold">Admin Account</th>
                  <th className="pb-3 font-semibold">Target</th>
                  <th className="pb-3 font-semibold">Details</th>
                  <th className="pb-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary/10 border border-primary/20 text-primary uppercase">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-foreground">
                      {log.admin_email || 'System'}
                    </td>
                    <td className="py-3 text-foreground">
                      <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {log.target_type}
                      </span>
                      {log.target_id && (
                        <span className="text-[10px] text-muted-foreground block truncate max-w-[120px]">
                          {log.target_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground max-w-xs truncate font-mono text-[11px]">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">
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
