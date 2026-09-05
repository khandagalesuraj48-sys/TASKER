import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CreateTaskInput, ReminderInput, Task, TaskPriority, TaskStatus } from '../../types/task';
import { createTask, updateTask } from '../../services/taskService';
import { uploadAttachment } from '../../services/attachmentService';
import { getTaskReminder, saveTaskReminder } from '../../services/reminderService';
import { formatInputDate } from '../../lib/dateUtils';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { DEFAULT_USER_NAME } from '../../constants';
import { FileUploadZone } from './FileUploadZone';
import { ReminderControls } from '../reminders/ReminderControls';
import { Paperclip, X } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  initialValues?: Partial<CreateTaskInput>;
  onSuccess?: (task: Task) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  initialValues,
  onSuccess,
}) => {
  const isEditing = Boolean(taskToEdit);
  const { showToast } = useToast();
  const { triggerRefresh } = useTask();

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [personName, setPersonName] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [dueDate, setDueDate] = useState<string>('');
  const [initialNote, setInitialNote] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [reminder, setReminder] = useState<ReminderInput>({
    is_enabled: false,
    remind_at: '',
    recurrence_type: 'once',
    custom_interval_minutes: null,
  });

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setPersonName(taskToEdit.person_name || '');
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setDueDate(formatInputDate(taskToEdit.due_date));
      setInitialNote('');
      setSelectedFiles([]);

      getTaskReminder(taskToEdit.id).then((rem) => {
        if (rem) {
          setReminder({
            is_enabled: rem.is_enabled && rem.status === 'active',
            remind_at: rem.remind_at,
            recurrence_type: rem.recurrence_type,
            custom_interval_minutes: rem.custom_interval_minutes,
          });
        } else {
          setReminder({
            is_enabled: false,
            remind_at: taskToEdit.due_date || '',
            recurrence_type: 'once',
            custom_interval_minutes: null,
          });
        }
      });
    } else {
      setTitle(initialValues?.title || '');
      setDescription(initialValues?.description || '');
      setPersonName(initialValues?.person_name || '');
      setPriority(initialValues?.priority || 'medium');
      setStatus(initialValues?.status || 'pending');
      setDueDate(initialValues?.due_date ? formatInputDate(initialValues.due_date) : '');
      setInitialNote(initialValues?.initialNote || '');
      setSelectedFiles([]);
      setReminder({
        is_enabled: false,
        remind_at: initialValues?.due_date ? new Date(initialValues.due_date).toISOString() : '',
        recurrence_type: 'once',
        custom_interval_minutes: null,
      });
    }
  }, [taskToEdit, initialValues, isOpen]);

  const handleAddFile = (file: File) => {
    setSelectedFiles((prev) => [...prev, file]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Task title is required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && taskToEdit) {
        // Update existing task
        const updated = await updateTask(taskToEdit.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          person_name: personName.trim() || undefined,
          priority,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
        });

        // Upload any newly selected files for this task
        const uploadErrors: string[] = [];
        for (const file of selectedFiles) {
          try {
            await uploadAttachment(updated.id, file, DEFAULT_USER_NAME);
          } catch (fileErr: any) {
            console.warn(`Could not upload ${file.name}:`, fileErr);
            uploadErrors.push(file.name);
          }
        }

        if (uploadErrors.length > 0) {
          showToast(`Task updated, but ${uploadErrors.length} file(s) failed to upload: ${uploadErrors.join(', ')}`, 'warning');
        } else {
          showToast(`Task "${updated.title}" updated successfully.`, 'success');
        }
        // Save reminder if configured
        if (reminder.is_enabled) {
          try {
            await saveTaskReminder(updated.id, reminder);
          } catch (remErr) {
            console.warn('Could not save reminder:', remErr);
          }
        }

        triggerRefresh();
        onSuccess?.(updated);
        onClose();
      } else {
        // Create new task
        const created = await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          person_name: personName.trim() || undefined,
          priority,
          status,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          created_by: DEFAULT_USER_NAME,
          initialNote: initialNote.trim() || undefined,
        });

        // Upload any attached files
        const uploadErrors: string[] = [];
        for (const file of selectedFiles) {
          try {
            await uploadAttachment(created.id, file, DEFAULT_USER_NAME);
          } catch (fileErr: any) {
            console.warn(`Could not upload ${file.name}:`, fileErr);
            uploadErrors.push(file.name);
          }
        }

        if (uploadErrors.length > 0) {
          showToast(`Task created, but ${uploadErrors.length} file(s) failed to upload: ${uploadErrors.join(', ')}`, 'warning');
        } else {
          showToast(`Task "${created.title}" created successfully!`, 'success');
        }
        // Save reminder if configured
        if (reminder.is_enabled) {
          try {
            await saveTaskReminder(created.id, reminder);
          } catch (remErr) {
            console.warn('Could not save reminder:', remErr);
          }
        }

        triggerRefresh();
        onSuccess?.(created);
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save task. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Task' : 'Create New Task'}
      subtitle={isEditing ? 'Update task details' : 'Add any task or work to track'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title (Required) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Task Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Description / Details
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any context, specifications, or instructions..."
            rows={3}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Grid: Person Name, Priority, Due Date, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Person / Pending With */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Person / Pending With
            </label>
            <input
              type="text"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="e.g. Ramesh, Contractor, Bank"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Initial Status (only for creation) */}
          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="pending">Pending (Default)</option>
                <option value="in_progress">In Progress</option>
                <option value="partial">Partial</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
        </div>

        {/* Initial Note (only for new tasks) */}
        {!isEditing && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Initial Note / Remark (Optional)
            </label>
            <input
              type="text"
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="e.g. Initial conversation held today..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* File Attachments Zone */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-slate-500" />
            <span>Attach Supporting Documents (Optional)</span>
          </label>

          <FileUploadZone onFileSelect={handleAddFile} />

          {/* Staged files list */}
          {selectedFiles.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {selectedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 border border-blue-100 text-xs"
                >
                  <span className="font-medium text-slate-800 truncate max-w-xs">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Smart Reminder Configuration */}
        <div className="pt-2 border-t border-slate-100">
          <ReminderControls
            value={reminder}
            onChange={setReminder}
            defaultTime={dueDate ? new Date(dueDate).toISOString() : null}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

