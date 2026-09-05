// src/services/aiActionService.ts
import { createTask, updateTask, updateTaskStatus, softDeleteTask } from './taskService';
import { saveTaskReminder } from './reminderService';
import { Task, TaskPriority, TaskReference, ReminderRecurrence } from '../types/task';
import { formatDateTime } from '../lib/dateUtils';
import { addMinutes, addHours, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday } from 'date-fns';

export interface ActionExecutionResult {
  handled: boolean;
  answer: string;
  referencedTasks: TaskReference[];
  actionType: 'create' | 'complete' | 'reminder' | 'update' | 'delete' | null;
}

/**
 * Parses natural language date & time from a prompt.
 * Supports:
 * - "in 15 minutes", "in 2 hours", "10 mins"
 * - "today at 5pm", "today 6:30"
 * - "tomorrow at 10am", "tomorrow evening", "tomorrow 3pm"
 * - "day after tomorrow"
 * - "next monday", "next friday at 4pm"
 * - Marathi: "उद्या दुपारी ३ वाजता", "आज संध्याकाळी ६ वाजता", "१० मिनिटांत"
 */
export function parseNaturalLanguageDateTime(
  rawText: string,
  now: Date = new Date()
): { date: Date | null; cleanedText: string; recurrence: ReminderRecurrence } {
  let text = rawText;
  let targetDate: Date | null = null;
  let recurrence: ReminderRecurrence = 'once';

  // Check recurrence
  if (/daily|every day|दररोज|रोज/i.test(text)) {
    recurrence = 'daily';
    text = text.replace(/daily|every day|दररोज|रोज/gi, ' ');
  } else if (/hourly|every hour|दर तासाला/i.test(text)) {
    recurrence = 'hourly';
    text = text.replace(/hourly|every hour|दर तासाला/gi, ' ');
  } else if (/every 2 hours|दर दोन तासांनी/i.test(text)) {
    recurrence = 'every_2_hours';
    text = text.replace(/every 2 hours|दर दोन तासांनी/gi, ' ');
  }

  // 1. "in X minutes" / "X मिनिटांत"
  const minMatch = text.match(/in\s+(\d+)\s*(?:min|mins|minute|minutes)|(\d+)\s*(?:min|mins|minute|minutes)\s*(?:later|in|नंतर|मध्ये|त)/i);
  if (minMatch) {
    const mins = parseInt(minMatch[1] || minMatch[2], 10);
    if (!isNaN(mins)) {
      targetDate = addMinutes(now, mins);
      text = text.replace(minMatch[0], ' ');
      return { date: targetDate, cleanedText: text.trim(), recurrence };
    }
  }

  // 2. "in X hours" / "X तासात"
  const hrMatch = text.match(/in\s+(\d+)\s*(?:hr|hrs|hour|hours)|(\d+)\s*(?:hr|hrs|hour|hours)\s*(?:later|in|नंतर|मध्ये|त)/i);
  if (hrMatch) {
    const hrs = parseInt(hrMatch[1] || hrMatch[2], 10);
    if (!isNaN(hrs)) {
      targetDate = addHours(now, hrs);
      text = text.replace(hrMatch[0], ' ');
      return { date: targetDate, cleanedText: text.trim(), recurrence };
    }
  }

  // Base day calculation
  let baseDay = new Date(now);
  let hasSpecificDay = false;

  if (/\b(?:tomorrow|udya|उद्या)\b/i.test(text)) {
    baseDay = addDays(now, 1);
    hasSpecificDay = true;
    text = text.replace(/\b(?:tomorrow|udya|उद्या)\b/gi, ' ');
  } else if (/\b(?:day after tomorrow|parwa|परवा)\b/i.test(text)) {
    baseDay = addDays(now, 2);
    hasSpecificDay = true;
    text = text.replace(/\b(?:day after tomorrow|parwa|परवा)\b/gi, ' ');
  } else if (/\b(?:today|aaj|आज)\b/i.test(text)) {
    baseDay = new Date(now);
    hasSpecificDay = true;
    text = text.replace(/\b(?:today|aaj|आज)\b/gi, ' ');
  } else if (/\bnext\s+monday\b/i.test(text)) {
    baseDay = nextMonday(now);
    hasSpecificDay = true;
    text = text.replace(/\bnext\s+monday\b/gi, ' ');
  } else if (/\bnext\s+tuesday\b/i.test(text)) {
    baseDay = nextTuesday(now);
    hasSpecificDay = true;
    text = text.replace(/\bnext\s+tuesday\b/gi, ' ');
  } else if (/\bnext\s+wednesday\b/i.test(text)) {
    baseDay = nextWednesday(now);
    hasSpecificDay = true;
    text = text.replace(/\bnext\s+wednesday\b/gi, ' ');
  } else if (/\bnext\s+thursday\b/i.test(text)) {
    baseDay = nextThursday(now);
    hasSpecificDay = true;
    text = text.replace(/\bnext\s+thursday\b/gi, ' ');
  } else if (/\bnext\s+friday\b/i.test(text)) {
    baseDay = nextFriday(now);
    hasSpecificDay = true;
    text = text.replace(/\bnext\s+friday\b/gi, ' ');
  } else if (/\bnext\s+saturday\b/i.test(text)) {
    baseDay = nextSaturday(now);
    hasSpecificDay = true;
    text = text.replace(/\bnext\s+saturday\b/gi, ' ');
  } else if (/\bnext\s+sunday\b/i.test(text)) {
    baseDay = nextSunday(now);
    hasSpecificDay = true;
    text = text.replace(/\bnext\s+sunday\b/gi, ' ');
  }

  // Time extraction: e.g. "at 5pm", "at 5:30 pm", "5 pm", "17:00", "दुपारी ३ वाजता", "सकाळी ९ वाजता"
  let hours = 17; // Default 5:00 PM if day mentioned without time
  let minutes = 0;
  let hasTime = false;

  const timeMatch = text.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|वाजता|सकाळी|दुपारी|संध्याकाळी)?/i);
  if (timeMatch && (timeMatch[3] || text.includes('at ') || hasSpecificDay)) {
    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const modifier = (timeMatch[3] || '').toLowerCase();

    if (modifier === 'pm' && h < 12) h += 12;
    if (modifier === 'am' && h === 12) h = 0;
    if (text.includes('दुपारी') && h < 12) h += 12;
    if (text.includes('संध्याकाळी') && h < 12) h += 12;
    if (text.includes('सकाळी') && h === 12) h = 0;

    if (h >= 0 && h < 24) {
      hours = h;
      minutes = m;
      hasTime = true;
      text = text.replace(timeMatch[0], ' ');
    }
  } else if (/\b(?:morning|सकाळी)\b/i.test(text)) {
    hours = 9;
    minutes = 0;
    hasTime = true;
    text = text.replace(/\b(?:morning|सकाळी)\b/gi, ' ');
  } else if (/\b(?:afternoon|दुपारी)\b/i.test(text)) {
    hours = 14;
    minutes = 0;
    hasTime = true;
    text = text.replace(/\b(?:afternoon|दुपारी)\b/gi, ' ');
  } else if (/\b(?:evening|संध्याकाळी)\b/i.test(text)) {
    hours = 18;
    minutes = 0;
    hasTime = true;
    text = text.replace(/\b(?:evening|संध्याकाळी)\b/gi, ' ');
  } else if (/\b(?:night|रात्री)\b/i.test(text)) {
    hours = 20;
    minutes = 0;
    hasTime = true;
    text = text.replace(/\b(?:night|रात्री)\b/gi, ' ');
  }

  if (hasSpecificDay || hasTime) {
    baseDay.setHours(hours, minutes, 0, 0);
    // If only time was specified and that time today is already in the past, roll over to tomorrow
    if (!hasSpecificDay && baseDay.getTime() <= now.getTime()) {
      baseDay = addDays(baseDay, 1);
    }
    targetDate = baseDay;
  }

  return {
    date: targetDate,
    cleanedText: text.replace(/\s+/g, ' ').trim(),
    recurrence,
  };
}

/**
 * Extracts priority from text.
 */
function extractPriority(text: string): { priority: TaskPriority; cleaned: string } {
  let priority: TaskPriority = 'medium';
  let cleaned = text;

  if (/\b(?:urgent|तात्काळ|तातडीचे|आत्ताच)\b/i.test(cleaned)) {
    priority = 'urgent';
    cleaned = cleaned.replace(/\b(?:urgent|priority\s+urgent|urgent\s+priority|तात्काळ|तातडीचे|आत्ताच)\b/gi, ' ');
  } else if (/\b(?:high\s+priority|priority\s+high|उच्च|महत्त्वाचे)\b/i.test(cleaned)) {
    priority = 'high';
    cleaned = cleaned.replace(/\b(?:high\s+priority|priority\s+high|उच्च|महत्त्वाचे)\b/gi, ' ');
  } else if (/\b(?:low\s+priority|priority\s+low|कमी)\b/i.test(cleaned)) {
    priority = 'low';
    cleaned = cleaned.replace(/\b(?:low\s+priority|priority\s+low|कमी)\b/gi, ' ');
  } else if (/\b(?:medium\s+priority|priority\s+medium)\b/i.test(cleaned)) {
    priority = 'medium';
    cleaned = cleaned.replace(/\b(?:medium\s+priority|priority\s+medium)\b/gi, ' ');
  }

  return { priority, cleaned: cleaned.replace(/\s+/g, ' ').trim() };
}

/**
 * Extracts person name from text (e.g., "with Rahul", "pending with Disha", "Rahul la").
 */
function extractPersonName(text: string): { person: string | null; cleaned: string } {
  let person: string | null = null;
  let cleaned = text;

  const match = cleaned.match(/(?:pending with|assigned to|with|for|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (match) {
    person = match[1].trim();
    cleaned = cleaned.replace(match[0], ' ');
  } else {
    // Marathi style: "राहुलला", "दिशेला"
    const mrMatch = cleaned.match(/([A-Z\u0900-\u097F][a-z\u0900-\u097F]+)(?:ला|कडे|सोबत)/i);
    if (mrMatch && !['टास्कला', 'रिमाइंडरला', 'उद्याला'].includes(mrMatch[1])) {
      person = mrMatch[1].trim();
    }
  }

  return { person, cleaned: cleaned.replace(/\s+/g, ' ').trim() };
}

/**
 * Finds the most relevant task matching the query.
 */
function findBestMatchingTask(query: string, tasks: Task[], filterStatus?: 'active' | 'completed'): Task | null {
  const qLower = query.toLowerCase().trim();
  const candidates = tasks.filter((t) => {
    if (filterStatus === 'active') return t.status !== 'completed' && t.status !== 'cancelled';
    if (filterStatus === 'completed') return t.status === 'completed';
    return true;
  });

  if (candidates.length === 0) return null;

  // Extract query keywords (strip verbs and stop words)
  const cleanQ = qLower
    .replace(/\b(?:task|complete|done|finish|set|reminder|remind|delete|remove|update|priority|due|date|चा|ची|चे|करा|पूर्ण|झाला|आहे|का|ला)\b/gi, ' ')
    .trim();

  const words = cleanQ.split(/\s+/).filter((w) => w.length > 1);

  let bestTask: Task | null = null;
  let highestScore = 0;

  for (const t of candidates) {
    const titleL = t.title.toLowerCase();
    const personL = (t.person_name || '').toLowerCase();
    let score = 0;

    if (titleL === cleanQ) score += 20;
    if (titleL.includes(cleanQ) && cleanQ.length > 3) score += 10;
    if (personL && cleanQ.includes(personL)) score += 8;

    for (const w of words) {
      if (titleL.includes(w)) score += 4;
      if (personL.includes(w)) score += 3;
    }

    if (score > highestScore) {
      highestScore = score;
      bestTask = t;
    }
  }

  return highestScore > 0 ? bestTask : null;
}

/**
 * Main Action Dispatcher for natural-language commands in TASKER AI 2.0.
 */
export async function executeAIAction(
  rawQuery: string,
  tasks: Task[]
): Promise<ActionExecutionResult> {
  const qLower = rawQuery.toLowerCase().trim();
  const isMarathi = /[\u0900-\u097F]/.test(rawQuery) ||
    qLower.includes('aahe') || qLower.includes('kara') || qLower.includes('banva') || qLower.includes('lava');

  // ==========================================
  // ACTION 1: CREATE TASK
  // e.g.: "Create a task to submit report tomorrow 5pm"
  //       "Add task: Call Rahul priority urgent"
  //       "New task: Review contract with Sharma"
  //       "नवा टास्क बनवा: राहुलला कॉल करा उद्या ३ वाजता"
  // ==========================================
  const isCreateIntent =
    /^(?:create|add|new|make)\s+(?:a\s+)?task\b/i.test(qLower) ||
    /^(?:remind me to|task:)\b/i.test(qLower) ||
    /(?:टास्क बनवा|टास्क तयार करा|टास्क ॲड करा|नवा टास्क|टास्क टाका)/i.test(rawQuery) ||
    (qLower.includes('task') && (qLower.includes('create') || qLower.includes('add') || qLower.includes('banva')));

  if (isCreateIntent) {
    // Clean prefix command words
    let workingText = rawQuery
      .replace(/^(?:please\s+)?(?:create|add|new|make)\s+(?:a\s+)?task(?:\s*[:\-to]+)?/i, ' ')
      .replace(/^(?:remind me to)\s+/i, ' ')
      .replace(/^(?:task\s*[:\-])\s*/i, ' ')
      .replace(/(?:टास्क बनवा|टास्क तयार करा|टास्क ॲड करा|नवा टास्क|टास्क टाका)/gi, ' ')
      .trim();

    // Check if reminder was requested
    const wantsReminder = /remind\s*(?:me)?|रिमाइंडर/i.test(rawQuery);

    // Extract Date/Time
    const { date: dueDate, cleanedText: afterDateText, recurrence } = parseNaturalLanguageDateTime(workingText);
    workingText = afterDateText;

    // Extract Priority
    const { priority, cleaned: afterPrioText } = extractPriority(workingText);
    workingText = afterPrioText;

    // Extract Person Name
    const { person, cleaned: afterPersonText } = extractPersonName(workingText);
    workingText = afterPersonText;

    // Remaining string is the task title
    let title = workingText.replace(/^[:\-–\s]+|[:\-–\s]+$/g, '').trim();
    if (!title) {
      title = 'New Task via TASKER AI';
    }

    try {
      const newTask = await createTask({
        title,
        priority,
        due_date: dueDate ? dueDate.toISOString() : null,
        person_name: person || undefined,
        description: 'Created automatically by TASKER AI 2.0',
        status: 'pending',
      });

      let reminderText = '';
      if (wantsReminder && dueDate) {
        try {
          await saveTaskReminder(newTask.id, {
            is_enabled: true,
            remind_at: dueDate.toISOString(),
            recurrence_type: recurrence,
          });
          reminderText = isMarathi
            ? `\n⏰ **रिमाइंडर**: ${formatDateTime(dueDate.toISOString())} साठी सेट केला आहे.`
            : `\n⏰ **Reminder**: Scheduled for ${formatDateTime(dueDate.toISOString())}.`;
        } catch (remErr) {
          console.warn('Could not auto-schedule reminder on create:', remErr);
        }
      }

      const dueFormatted = dueDate ? formatDateTime(dueDate.toISOString()) : (isMarathi ? 'दिलेली नाही' : 'None');
      const personStr = person ? `\n- **${isMarathi ? 'कोणासोबत' : 'Pending with'}**: ${person}` : '';

      const answer = isMarathi
        ? `✅ **टास्क यशस्वीपणे तयार केला!**\n\n- **नाव**: ${newTask.title}\n- **Priority**: ${priority.toUpperCase()}\n- **Due Date**: ${dueFormatted}${personStr}${reminderText}\n\nतुम्ही खाली दिलेल्या कार्डवर टॅप करून हा टास्क उघडू शकता.`
        : `✅ **Task Created Successfully!**\n\n- **Title**: ${newTask.title}\n- **Priority**: ${priority.toUpperCase()}\n- **Due Date**: ${dueFormatted}${personStr}${reminderText}\n\nTap the card below to view or edit this task.`;

      const ref: TaskReference = {
        id: newTask.id,
        title: newTask.title,
        status: newTask.status,
        priority: newTask.priority,
        due_date: newTask.due_date,
      };

      return {
        handled: true,
        answer,
        referencedTasks: [ref],
        actionType: 'create',
      };
    } catch (err: any) {
      return {
        handled: true,
        answer: isMarathi
          ? `❌ टास्क तयार करताना त्रुटी आली: ${err?.message || 'कृपया पुन्हा प्रयत्न करा.'}`
          : `❌ Failed to create task: ${err?.message || 'Please try again.'}`,
        referencedTasks: [],
        actionType: 'create',
      };
    }
  }

  // ==========================================
  // ACTION 2: COMPLETE / MARK AS DONE
  // e.g.: "Complete task Call Rahul"
  //       "Mark tax report as completed"
  //       "Finish proposal"
  //       "राहुलचा टास्क पूर्ण झाला"
  // ==========================================
  const isCompleteIntent =
    /\b(?:complete|mark\s+(?:as\s+)?completed|mark\s+(?:as\s+)?done|finish|finished)\b/i.test(qLower) ||
    /(?:पूर्ण झाला|पूर्ण करा|complete करा|done करा|झाला आहे)/i.test(rawQuery);

  if (isCompleteIntent) {
    const targetTask = findBestMatchingTask(rawQuery, tasks, 'active');
    if (targetTask) {
      try {
        const updated = await updateTaskStatus(targetTask.id, 'completed', 'Completed via TASKER AI 2.0');
        const answer = isMarathi
          ? `🎉 **टास्क Complete झाला!**\n\n- **टास्क**: ${updated.title}\n- **Status**: Completed (पूर्ण)\n- **वेळ**: आत्ताच\n\nछान! हा टास्क पूर्ण झाला असून त्याचे चालू रिमाइंडर्स रद्द केले आहेत.`
          : `🎉 **Task Marked as Completed!**\n\n- **Task**: ${updated.title}\n- **Status**: Completed\n- **Completed At**: Just now\n\nGreat work! This task is now complete and active reminders have been cleared.`;

        const ref: TaskReference = {
          id: updated.id,
          title: updated.title,
          status: updated.status,
          priority: updated.priority,
          due_date: updated.due_date,
        };

        return {
          handled: true,
          answer,
          referencedTasks: [ref],
          actionType: 'complete',
        };
      } catch (err: any) {
        return {
          handled: true,
          answer: isMarathi ? 'टास्क पूर्ण करताना अडचण आली.' : 'Failed to mark task as completed.',
          referencedTasks: [],
          actionType: 'complete',
        };
      }
    }
  }

  // ==========================================
  // ACTION 3: SET / SCHEDULE REMINDER
  // e.g.: "Set a reminder for Call Rahul in 15 minutes"
  //       "Remind me about Dr. Sharma tomorrow at 9 AM"
  //       "टॅक्स रिपोर्टसाठी संध्याकाळी ६ वाजता रिमाइंडर लावा"
  // ==========================================
  const isReminderIntent =
    /\b(?:set\s+(?:a\s+)?reminder|remind\s+me|reminder\s+for)\b/i.test(qLower) ||
    /(?:रिमाइंडर लावा|रिमाइंडर सेट करा|आठवण करा)/i.test(rawQuery);

  if (isReminderIntent) {
    const { date: remindDate, recurrence } = parseNaturalLanguageDateTime(rawQuery);
    const targetTask = findBestMatchingTask(rawQuery, tasks, 'active');

    if (targetTask && remindDate) {
      try {
        await saveTaskReminder(targetTask.id, {
          is_enabled: true,
          remind_at: remindDate.toISOString(),
          recurrence_type: recurrence,
        });

        const formatted = formatDateTime(remindDate.toISOString());
        const answer = isMarathi
          ? `⏰ **रिमाइंडर सेट केला!**\n\n- **टास्क**: ${targetTask.title}\n- **वेळ**: ${formatted}\n- **प्रकार**: ${recurrence === 'daily' ? 'दररोज' : 'एकदा'}\n\nतुम्हाला तुमच्या फोनवर योग्य वेळी नोटिफिकेशन मिळेल.`
          : `⏰ **Reminder Scheduled!**\n\n- **Task**: ${targetTask.title}\n- **Time**: ${formatted}\n- **Recurrence**: ${recurrence === 'daily' ? 'Daily' : 'Once'}\n\nYou will receive a native notification on your device when it's due.`;

        const ref: TaskReference = {
          id: targetTask.id,
          title: targetTask.title,
          status: targetTask.status,
          priority: targetTask.priority,
          due_date: targetTask.due_date,
        };

        return {
          handled: true,
          answer,
          referencedTasks: [ref],
          actionType: 'reminder',
        };
      } catch (err: any) {
        return {
          handled: true,
          answer: isMarathi ? 'रिमाइंडर सेट करताना अडचण आली.' : 'Failed to set reminder.',
          referencedTasks: [],
          actionType: 'reminder',
        };
      }
    }
  }

  // ==========================================
  // ACTION 4: UPDATE TASK (PRIORITY / DUE DATE)
  // e.g.: "Update priority of Call Disha to urgent"
  //       "Change due date of Tax report to tomorrow"
  // ==========================================
  const isUpdateIntent =
    /\b(?:update|change|set)\s+(?:priority|due\s+date|status)\b/i.test(qLower) ||
    /(?:priority\s+बदला|तारीख बदला|अपडेट करा)/i.test(rawQuery);

  if (isUpdateIntent) {
    const targetTask = findBestMatchingTask(rawQuery, tasks, 'active');
    if (targetTask) {
      const { priority } = extractPriority(rawQuery);
      const { date: newDueDate } = parseNaturalLanguageDateTime(rawQuery);

      const updates: any = {};
      if (qLower.includes('priority')) updates.priority = priority;
      if (newDueDate) updates.due_date = newDueDate.toISOString();

      if (Object.keys(updates).length > 0) {
        try {
          const updated = await updateTask(targetTask.id, updates);
          const answer = isMarathi
            ? `✏️ **टास्क अपडेट केला!**\n\n- **टास्क**: ${updated.title}\n- **Priority**: ${updated.priority.toUpperCase()}\n- **Due Date**: ${updated.due_date ? formatDateTime(updated.due_date) : 'None'}`
            : `✏️ **Task Updated!**\n\n- **Task**: ${updated.title}\n- **Priority**: ${updated.priority.toUpperCase()}\n- **Due Date**: ${updated.due_date ? formatDateTime(updated.due_date) : 'None'}`;

          const ref: TaskReference = {
            id: updated.id,
            title: updated.title,
            status: updated.status,
            priority: updated.priority,
            due_date: updated.due_date,
          };

          return {
            handled: true,
            answer,
            referencedTasks: [ref],
            actionType: 'update',
          };
        } catch (err: any) {
          return {
            handled: true,
            answer: isMarathi ? 'टास्क अपडेट करताना अडचण आली.' : 'Failed to update task.',
            referencedTasks: [],
            actionType: 'update',
          };
        }
      }
    }
  }

  // ==========================================
  // ACTION 5: DELETE / MOVE TO BIN
  // e.g.: "Delete task Call Rahul"
  //       "Move proposal to bin"
  // ==========================================
  const isDeleteIntent =
    /\b(?:delete|remove|move\s+to\s+bin)\s+(?:task\s+)?/i.test(qLower) ||
    /(?:टास्क डिलीट करा|कचऱ्याच्या डब्यात टाका|bin मध्ये टाका)/i.test(rawQuery);

  if (isDeleteIntent) {
    const targetTask = findBestMatchingTask(rawQuery, tasks, 'active');
    if (targetTask) {
      try {
        await softDeleteTask(targetTask.id);
        const answer = isMarathi
          ? `🗑️ **टास्क Bin मध्ये हलवला!**\n\n- **टास्क**: ${targetTask.title}\n\nहा टास्क Recycle Bin मध्ये सुरक्षित ठेवला आहे. गरज असल्यास तुम्ही तो पुन्हा restore करू शकता.`
          : `🗑️ **Task Moved to Bin!**\n\n- **Task**: ${targetTask.title}\n\nThe task has been moved to the Recycle Bin. You can restore it anytime from the Bin page.`;

        return {
          handled: true,
          answer,
          referencedTasks: [],
          actionType: 'delete',
        };
      } catch (err: any) {
        return {
          handled: true,
          answer: isMarathi ? 'टास्क डिलीट करताना अडचण आली.' : 'Failed to delete task.',
          referencedTasks: [],
          actionType: 'delete',
        };
      }
    }
  }

  return {
    handled: false,
    answer: '',
    referencedTasks: [],
    actionType: null,
  };
}
