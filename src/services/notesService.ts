import { supabase } from '../lib/supabase';
import { DEFAULT_USER_NAME } from '../constants';
import { TaskNote } from '../types/task';

export const getNotes = async (taskId: string): Promise<TaskNote[]> => {
  const { data, error } = await supabase
    .from('task_notes')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    throw new Error('Unable to load notes.');
  }

  return (data || []) as TaskNote[];
};

export const addNote = async (
  taskId: string,
  note: string,
  author: string = DEFAULT_USER_NAME
): Promise<TaskNote> => {
  const payload = {
    task_id: taskId,
    note: note.trim(),
    created_by: author,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('task_notes')
    .insert(payload as any)
    .select()
    .single();

  if (error) {
    console.error('Error adding note:', error);
    throw new Error('Unable to add note. Please try again.');
  }

  return data as TaskNote;
};

export const deleteNote = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('task_notes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting note:', error);
    throw new Error('Unable to delete note.');
  }
};

