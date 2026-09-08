import React, { useState, useEffect } from 'react';
import { History, Clock } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { getAssignmentHistory } from '../services/enterpriseService';
import { TaskAssignment } from '../types/task';
import { formatDateTime } from '../lib/dateUtils';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';

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
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="p-5 rounded-xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
          <History className="w-4 h-4" />
          <span>Audit Log</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mt-1">
          Task Assignment History
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Immutable audit trail of all task assignments, delegations, and reassignments.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2.5 animate-pulse">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-16 bg-muted rounded-xl"></div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <Card className="text-center py-16 border border-border bg-card shadow-xs">
          <CardContent className="space-y-2">
            <History className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No Assignment Records Yet</h3>
            <p className="text-xs text-muted-foreground">
              Assignments and reassignments will appear here automatically.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {history.map((record) => (
            <Card
              key={record.id}
              className="rounded-xl border border-border bg-card shadow-xs hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-foreground">
                      {record.assigned_to_name || 'Assigned Member'}
                    </span>
                    <Badge
                      variant={record.status === 'completed' ? 'success' : 'secondary'}
                      className="text-[10px] capitalize px-1.5 py-0"
                    >
                      {record.status}
                    </Badge>
                  </div>
                  {record.remark && (
                    <p className="text-xs text-muted-foreground italic">"{record.remark}"</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDateTime(record.assigned_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
