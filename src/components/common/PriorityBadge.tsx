import React from 'react';
import { TaskPriority } from '../../types/task';
import { PRIORITY_CONFIG } from '../../constants';
import { ArrowDown, ArrowRight, ArrowUp, AlertOctagon } from 'lucide-react';

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
  size?: 'sm' | 'md';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  className = '',
  size = 'md',
}) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  const getPriorityIcon = () => {
    switch (priority) {
      case 'low':
        return <ArrowDown className="w-3 h-3 text-slate-500" />;
      case 'medium':
        return <ArrowRight className="w-3 h-3 text-blue-500" />;
      case 'high':
        return <ArrowUp className="w-3 h-3 text-amber-500" />;
      case 'urgent':
        return <AlertOctagon className="w-3 h-3 text-rose-500" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-md border capitalize ${config.badgeBg} ${config.badgeText} ${config.badgeBorder} ${sizeClasses} ${className}`}
    >
      {getPriorityIcon()}
      <span>{config.label}</span>
    </span>
  );
};

