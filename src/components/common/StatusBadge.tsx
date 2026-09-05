import React from 'react';
import { TaskStatus } from '../../types/task';
import { STATUS_CONFIG } from '../../constants';
import { Clock, PlayCircle, CheckCircle2, XCircle, AlertCircle, PieChart } from 'lucide-react';

interface StatusBadgeProps {
  status: TaskStatus;
  isOverdue?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  isOverdue = false,
  className = '',
  size = 'md',
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 shrink-0" />;
      case 'in_progress':
        return <PlayCircle className="w-3.5 h-3.5 shrink-0" />;
      case 'partial':
        return <PieChart className="w-3.5 h-3.5 shrink-0" />;
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      case 'cancelled':
        return <XCircle className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} ${sizeClasses}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        {getStatusIcon()}
        <span>{config.label}</span>
      </span>

      {/* Derived OVERDUE badge */}
      {isOverdue && (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-full border bg-rose-50 text-rose-700 border-rose-200 uppercase tracking-wider ${sizeClasses}`}
          title="Due date has passed"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>OVERDUE</span>
        </span>
      )}
    </div>
  );
};

