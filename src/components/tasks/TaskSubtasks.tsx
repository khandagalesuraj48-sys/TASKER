import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { TaskSubtask } from '../../types/task';
import { getSubtasks, addSubtask, toggleSubtask, deleteSubtask } from '../../services/subtaskService';

interface TaskSubtasksProps {
  taskId: string;
}

export const TaskSubtasks: React.FC<TaskSubtasksProps> = ({ taskId }) => {
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const loadSubtasks = async () => {
    const list = await getSubtasks(taskId);
    setSubtasks(list);
  };

  useEffect(() => {
    loadSubtasks();
  }, [taskId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsAdding(true);
    try {
      await addSubtask(taskId, newTitle.trim());
      setNewTitle('');
      await loadSubtasks();
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (item: TaskSubtask) => {
    await toggleSubtask(item.id, !item.is_completed);
    await loadSubtasks();
  };

  const handleDelete = async (id: string) => {
    await deleteSubtask(id);
    await loadSubtasks();
  };

  const completedCount = subtasks.filter((s) => s.is_completed).length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress */}
      {subtasks.length > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
            <span>Progress: {completedCount} of {subtasks.length} done</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-1.5">
        {subtasks.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => handleToggle(sub)}
              className="flex items-center gap-2.5 flex-1 text-left"
            >
              {sub.is_completed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className={sub.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200 font-medium'}>
                {sub.title}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(sub.id)}
              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Subtask input */}
      <form onSubmit={handleAdd} className="flex gap-2 pt-1">
        <input
          type="text"
          placeholder="Add a checklist subtask..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isAdding || !newTitle.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>
    </div>
  );
};
