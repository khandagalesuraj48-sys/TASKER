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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-rose-500" />
            <span>Bin / Trash</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
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
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'card' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
              title="Card view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
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
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs">
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

