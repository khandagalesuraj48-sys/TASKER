// src/services/whatsappService.ts
import { Task } from '../types/task';
import { format } from 'date-fns';

/**
 * Formats an enterprise-grade WhatsApp Work Order message for operatives & supervisors.
 */
export function generateTaskWhatsAppText(task: Task, subtasksCount = 0): string {
  const priorityEmoji =
    task.priority === 'urgent'
      ? '🚨'
      : task.priority === 'high'
      ? '🔴'
      : task.priority === 'medium'
      ? '🟡'
      : '🟢';

  const statusLabel = (task.status || 'PENDING').toUpperCase().replace('_', ' ');
  const dueDateStr = task.due_date ? format(new Date(task.due_date), 'PPP') : 'Not Specified';
  const appBaseUrl = window.location.origin;
  const directLink = `${appBaseUrl}/tasks/${task.id}`;

  const message = [
    `*📋 TASKER — OFFICIAL WORK ORDER*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `*📌 Task:* ${task.title}`,
    `*⚡ Priority:* ${priorityEmoji} ${task.priority.toUpperCase()}`,
    `*📊 Status:* ${statusLabel}`,
    `*👤 Assigned To:* ${task.assigned_to_name || 'Operative'}`,
    `*📅 Due Date:* ${dueDateStr}`,
    (task as any).category ? `*🏷️ Category:* ${(task as any).category}` : null,
    subtasksCount > 0 ? `*✅ Checklist:* ${subtasksCount} Subtasks required` : null,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    task.description ? `*📝 Scope of Work:*\n${task.description}\n` : null,
    `*🔗 Open Work Order in TASKER:*`,
    directLink,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `_Reply with photo proof to log completion._`,
  ]
    .filter(Boolean)
    .join('\n');

  return message;
}

/**
 * Directly opens WhatsApp Web or native WhatsApp mobile app with pre-filled message.
 */
export function openWhatsApp(text: string, phone?: string): void {
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
  const encodedText = encodeURIComponent(text);

  let url = '';
  if (cleanPhone) {
    url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  } else {
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  // Open in new window / external browser
  window.open(url, '_blank');
}

/**
 * Quick action to share a task with an operative or team group via WhatsApp.
 */
export function shareTaskViaWhatsApp(
  task: Task,
  phoneOrSubtasks?: string | any[],
  subtasksCount = 0
): void {
  let phone = '';
  let count = subtasksCount;
  if (Array.isArray(phoneOrSubtasks)) {
    count = phoneOrSubtasks.length;
  } else if (typeof phoneOrSubtasks === 'string') {
    phone = phoneOrSubtasks;
  }
  const text = generateTaskWhatsAppText(task, count);
  openWhatsApp(text, phone);
}
