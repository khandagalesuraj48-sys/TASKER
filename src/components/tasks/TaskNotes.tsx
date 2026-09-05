import React, { useState } from 'react';
import { TaskNote } from '../../types/task';
import { addNote, deleteNote } from '../../services/notesService';
import { formatDateTime } from '../../lib/dateUtils';
import { Button } from '../common/Button';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_USER_NAME } from '../../constants';
import { Send, Trash2, Clock, User } from 'lucide-react';

interface TaskNotesProps {
  taskId: string;
  notes: TaskNote[];
  onNotesUpdated: () => void;
}

export const TaskNotes: React.FC<TaskNotesProps> = ({ taskId, notes, onNotesUpdated }) => {
  const [noteText, setNoteText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { showToast } = useToast();

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setIsSubmitting(true);
    try {
      await addNote(taskId, noteText, DEFAULT_USER_NAME);
      setNoteText('');
      showToast('Note added successfully.', 'success');
      onNotesUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to add note.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      showToast('Note removed.', 'info');
      onNotesUpdated();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete note.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Add note input form */}
      <form onSubmit={handleAddNote} className="space-y-2">
        <div className="relative">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add an update or remark (e.g. 'Called vendor today', 'Waiting for approval')..."
            rows={2}
            className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            type="submit"
            disabled={!noteText.trim() || isSubmitting}
            isLoading={isSubmitting}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Add Note
          </Button>
        </div>
      </form>

      {/* Notes listing */}
      <div className="space-y-2.5">
        {notes.length === 0 ? (
          <div className="p-4 text-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
            No notes or updates added yet.
          </div>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              className="group p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <User className="w-3 h-3 text-slate-400" />
                    {n.created_by}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatDateTime(n.created_at)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(n.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                  title="Delete note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                {n.note}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

