import React, { useEffect, useState } from 'react';
import { getTasks, permanentDeleteTask } from '../services/taskService';
import { Task } from '../types/task';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskTable } from '../components/tasks/TaskTable';
import { EmptyState } from '../components/common/EmptyState';
import { CardSkeleton, TableSkeleton } from '../components/common/LoadingSkeleton';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../context/ToastContext';
import { useTask } from '../context/TaskContext';
import { Trash2, AlertTriangle, LayoutGrid, List } from 'lucide-react';

export const BinPage: React.FC = () => {
  const { refreshKey, triggerRefresh } = useTask();
  const { showToast } = useToast();

  const [deletedTasks, setDeletedTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [emptyBinConfirmOpen, setEmptyBinConfirmOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const loadBinTasks = async () => {
    setIsLoading(true);
    try {
      const data = await getTasks({
        includeDeleted: true,
        scope: 'personal',
        sortBy: 'recently_updated',
      });
      setDeletedTasks(data.filter((t: Task) => t.is_deleted === true));
    } catch (err) {
      console.error('Failed to load bin tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBinTasks();
  }, [refreshKey]);

  const handleEmptyBin = async () => {
    setIsProcessing(true);
    try {
      for (const t of deletedTasks) {
        await permanentDeleteTask(t.id);
      }
      showToast('Bin emptied completely. All associated files purged.', 'info');
      triggerRefresh();
      loadBinTasks();
    } catch (err: any) {
      showToast(err.message || 'Error emptying bin', 'error');
    } finally {
      setIsProcessing(false);
      setEmptyBinConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-500" />
            <span>Recycle Bin</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deleted tasks and work items. You can restore them to active tasks or permanently delete them.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {deletedTasks.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setEmptyBinConfirmOpen(true)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Empty Bin
            </Button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border/80 bg-card p-0.5 shadow-2xs">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-md transition-all active:scale-95 ${
                viewMode === 'card' ? 'bg-muted text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all active:scale-95 ${
                viewMode === 'table' ? 'bg-muted text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {deletedTasks.length > 0 && (
        <div className="flex items-center gap-2.5 p-3 sm:p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-xs shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            Items in the Bin remain fully intact with history, notes, and attachments until you permanently delete them.
          </span>
        </div>
      )}

      {/* Task List */}
      {isLoading ? (
        viewMode === 'card' ? <CardSkeleton count={3} /> : <TableSkeleton rows={4} />
      ) : deletedTasks.length === 0 ? (
        <EmptyState
          icon={<Trash2 className="w-10 h-10 text-slate-300" />}
          title="Bin is empty."
          description="Tasks moved to the Bin will appear here for safe recovery or permanent deletion."
        />
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {deletedTasks.map((task: Task) => (
            <TaskCard
              key={task.id}
              task={task}
              isBin={true}
              onRefresh={loadBinTasks}
            />
          ))}
        </div>
      ) : (
        <TaskTable
          tasks={deletedTasks}
          isBin={true}
          onRefresh={loadBinTasks}
        />
      )}

      {/* Empty Bin Confirmation */}
      <ConfirmDialog
        isOpen={emptyBinConfirmOpen}
        onClose={() => setEmptyBinConfirmOpen(false)}
        onConfirm={handleEmptyBin}
        title="Empty Entire Bin"
        message="This will permanently delete ALL tasks in the Bin and permanently purge their attached files from Supabase Storage. This action cannot be undone."
        confirmText="Empty Bin Completely"
        variant="danger"
        isLoading={isProcessing}
      />
    </div>
  );
};

