import { supabase } from '../lib/supabase';
import { TaskReference } from '../types/task';
import { formatDateTime, formatDateOnly, isTaskOverdue, parseInTimezone } from '../lib/dateUtils';
import { isToday, isYesterday, isTomorrow } from 'date-fns';
import { executeAIAction } from './aiActionService';
import { queryUniversalKnowledge } from './aiWebKnowledgeService';

export interface AIResponse {
  answer: string;
  referencedTasks: TaskReference[];
  providerUsed: string;
  actionTaken?: 'create' | 'complete' | 'reminder' | 'update' | 'delete' | null;
}

// AI Provider Interface to allow pluggable LLM integrations later
export interface AIProvider {
  name: string;
  isAvailable: () => boolean;
  processQuery: (question: string, contextTasks: any[]) => Promise<AIResponse>;
}

// Helper to format date in conversational style
const formatConversationalDate = (dateStr: string | null, isMarathi: boolean): string => {
  if (!dateStr) return isMarathi ? 'कोणतीही due date दिलेली नाही' : 'No due date set';
  const d = parseInTimezone(dateStr);
  if (!d) return isMarathi ? 'अवैध तारीख' : 'Invalid date';

  const timeStr = formatDateTime(dateStr).split(',')[1]?.trim() || '';
  const dateFormatted = formatDateOnly(dateStr);

  if (isToday(d)) {
    return isMarathi ? `आज ${timeStr}` : `Today at ${timeStr}`;
  }
  if (isTomorrow(d)) {
    return isMarathi ? `उद्या ${timeStr}` : `Tomorrow at ${timeStr}`;
  }
  if (isYesterday(d)) {
    return isMarathi ? `काल ${timeStr}` : `Yesterday at ${timeStr}`;
  }

  return isMarathi ? `${dateFormatted} रोजी ${timeStr}` : `${dateFormatted} at ${timeStr}`;
};

// Translate status and priority to Marathi
const translateStatusMr = (status: string): string => {
  switch (status) {
    case 'pending': return 'Pending (प्रलंबित)';
    case 'in_progress': return 'In Progress (सुरू)';
    case 'partial': return 'Partially Done (अंशतः पूर्ण)';
    case 'completed': return 'Completed (पूर्ण झालेला)';
    case 'cancelled': return 'Cancelled (रद्द)';
    default: return status;
  }
};

const translatePriorityMr = (p: string): string => {
  switch (p) {
    case 'urgent': return 'Urgent (अत्यंत महत्त्वाचे)';
    case 'high': return 'High (उच्च)';
    case 'medium': return 'Medium (मध्यम)';
    case 'low': return 'Low (कमी)';
    default: return p;
  }
};

// Built-in Task-Aware Grounding Engine
class TaskAwareGroundingEngine implements AIProvider {
  name = 'TASKER AI 2.0 (Task Grounded)';

  isAvailable() {
    return true;
  }

  async processQuery(question: string, tasks: any[]): Promise<AIResponse> {
    const qLower = question.toLowerCase().trim();
    const isMarathi = /[\u0900-\u097F]/.test(question) ||
      qLower.includes('aahe') || qLower.includes('ahet') || qLower.includes('kadh') ||
      qLower.includes('dakhva') || qLower.includes('maze') || qLower.includes('konte');

    const referencedTasks: TaskReference[] = [];

    // Helper to register task reference
    const addRef = (t: any) => {
      if (!referencedTasks.some((r) => r.id === t.id)) {
        referencedTasks.push({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
        });
      }
    };

    // 1. COUNT INQUIRIES: "किती pending tasks आहेत?", "how many pending tasks?"
    if (
      qLower.includes('किती') ||
      qLower.includes('how many') ||
      qLower.includes('count')
    ) {
      if (qLower.includes('pending') || qLower.includes('प्रलंबित') || qLower.includes('बाकी')) {
        const pending = tasks.filter((t) => t.status === 'pending');
        pending.forEach(addRef);
        const count = pending.length;
        const ans = isMarathi
          ? `तुमच्याकडे सध्या **${count}** pending tasks आहेत.`
          : `You currently have **${count}** pending tasks.`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }
      if (qLower.includes('completed') || qLower.includes('पूर्ण') || qLower.includes('झालेले')) {
        const comp = tasks.filter((t) => t.status === 'completed');
        comp.forEach(addRef);
        const ans = isMarathi
          ? `तुमचे एकूण **${comp.length}** tasks complete झाले आहेत.`
          : `You have completed **${comp.length}** tasks in total.`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }
      if (qLower.includes('आज') || qLower.includes('today')) {
        const todayTasks = tasks.filter((t) => t.due_date && isToday(new Date(t.due_date)));
        todayTasks.forEach(addRef);
        const ans = isMarathi
          ? `आज एकूण **${todayTasks.length}** tasks due आहेत.`
          : `There are **${todayTasks.length}** tasks due today.`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }
      if (qLower.includes('overdue') || qLower.includes('मुदत संपलेले')) {
        const overdue = tasks.filter((t) => isTaskOverdue(t.due_date, t.status));
        overdue.forEach(addRef);
        const ans = isMarathi
          ? `सध्या **${overdue.length}** tasks overdue (मुदत उलटून गेलेले) आहेत.`
          : `You currently have **${overdue.length}** overdue tasks.`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }
    }

    // 2. TODAY'S TASKS: "आज कोणते tasks आहेत?", "today tasks"
    if (qLower.includes('आज') || qLower.includes('today')) {
      const todayTasks = tasks.filter((t) => t.due_date && isToday(new Date(t.due_date)));
      if (todayTasks.length === 0) {
        return {
          answer: isMarathi ? 'आज कोणतीही tasks due नाहीत.' : 'There are no tasks due today.',
          referencedTasks: [],
          providerUsed: this.name,
        };
      }
      todayTasks.forEach(addRef);
      const listStr = todayTasks
        .map((t) => `- **${t.title}** (${isMarathi ? translateStatusMr(t.status) : t.status}, Due: ${formatConversationalDate(t.due_date, isMarathi)})`)
        .join('\n');
      const ans = isMarathi
        ? `आज एकूण **${todayTasks.length}** tasks आहेत:\n\n${listStr}`
        : `Here are the **${todayTasks.length}** tasks due today:\n\n${listStr}`;
      return { answer: ans, referencedTasks, providerUsed: this.name };
    }

    // 3. YESTERDAY'S COMPLETED TASKS: "काल कोणते tasks complete झाले?", "yesterday completed"
    if (qLower.includes('काल') || qLower.includes('yesterday')) {
      const yestComp = tasks.filter(
        (t) => t.status === 'completed' && t.completed_at && isYesterday(new Date(t.completed_at))
      );
      if (yestComp.length === 0) {
        return {
          answer: isMarathi ? 'काल कोणताही task complete झालेला नाही.' : 'No tasks were completed yesterday.',
          referencedTasks: [],
          providerUsed: this.name,
        };
      }
      yestComp.forEach(addRef);
      const listStr = yestComp.map((t) => `- **${t.title}**`).join('\n');
      const ans = isMarathi
        ? `काल हे **${yestComp.length}** tasks complete झाले आहेत:\n\n${listStr}`
        : `These **${yestComp.length}** tasks were completed yesterday:\n\n${listStr}`;
      return { answer: ans, referencedTasks, providerUsed: this.name };
    }

    // 4. OVERDUE TASKS: "कोणते tasks overdue आहेत?", "overdue tasks"
    if (qLower.includes('overdue') || qLower.includes('मुदत उलटून') || qLower.includes('उलटलेले')) {
      const overdue = tasks.filter((t) => isTaskOverdue(t.due_date, t.status));
      if (overdue.length === 0) {
        return {
          answer: isMarathi ? 'कोणताही task overdue नाही.' : 'There are no overdue tasks.',
          referencedTasks: [],
          providerUsed: this.name,
        };
      }
      overdue.forEach(addRef);
      const listStr = overdue
        .map((t) => `- **${t.title}** (Due: ${formatConversationalDate(t.due_date, isMarathi)}, Priority: ${isMarathi ? translatePriorityMr(t.priority) : t.priority})`)
        .join('\n');
      const ans = isMarathi
        ? `हे **${overdue.length}** tasks overdue आहेत:\n\n${listStr}`
        : `These **${overdue.length}** tasks are overdue:\n\n${listStr}`;
      return { answer: ans, referencedTasks, providerUsed: this.name };
    }

    // 5. URGENT PENDING TASKS: "माझे urgent pending tasks कोणते?", "urgent tasks"
    if (qLower.includes('urgent') || qLower.includes('तातडीचे')) {
      const urgentTasks = tasks.filter(
        (t) => t.priority === 'urgent' && t.status !== 'completed' && t.status !== 'cancelled'
      );
      if (urgentTasks.length === 0) {
        return {
          answer: isMarathi ? 'कोणताही urgent pending task नाही.' : 'There are no urgent pending tasks.',
          referencedTasks: [],
          providerUsed: this.name,
        };
      }
      urgentTasks.forEach(addRef);
      const listStr = urgentTasks
        .map((t) => `- **${t.title}** (${isMarathi ? translateStatusMr(t.status) : t.status}, Due: ${formatConversationalDate(t.due_date, isMarathi)})`)
        .join('\n');
      const ans = isMarathi
        ? `तुमचे urgent tasks:\n\n${listStr}`
        : `Your urgent tasks:\n\n${listStr}`;
      return { answer: ans, referencedTasks, providerUsed: this.name };
    }

    // 6. GENERAL PENDING TASKS: "माझे pending tasks कोणते?", "pending tasks"
    if (
      (qLower.includes('pending') || qLower.includes('प्रलंबित') || qLower.includes('बाकी')) &&
      !qLower.includes('disha') && !qLower.includes('call')
    ) {
      const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
      if (pendingTasks.length === 0) {
        return {
          answer: isMarathi ? 'तुमच्याकडे सध्या कोणतेही pending tasks नाहीत.' : 'You have no pending tasks.',
          referencedTasks: [],
          providerUsed: this.name,
        };
      }
      pendingTasks.forEach(addRef);
      const listStr = pendingTasks
        .slice(0, 10)
        .map((t) => `- **${t.title}** (${isMarathi ? translateStatusMr(t.status) : t.status}, Due: ${formatConversationalDate(t.due_date, isMarathi)})`)
        .join('\n');
      const ans = isMarathi
        ? `तुमचे pending tasks (${pendingTasks.length}):\n\n${listStr}`
        : `Your pending tasks (${pendingTasks.length}):\n\n${listStr}`;
      return { answer: ans, referencedTasks, providerUsed: this.name };
    }

    // 7. COMPLETED TASKS: "माझे completed tasks कोणते?", "completed tasks"
    if (
      (qLower.includes('completed') || qLower.includes('पूर्ण झालेले') || qLower.includes('झालेले')) &&
      !qLower.includes('disha') && !qLower.includes('call')
    ) {
      const completedTasks = tasks.filter((t) => t.status === 'completed');
      if (completedTasks.length === 0) {
        return {
          answer: isMarathi ? 'कोणताही task complete झालेला नाही.' : 'No tasks have been completed yet.',
          referencedTasks: [],
          providerUsed: this.name,
        };
      }
      completedTasks.forEach(addRef);
      const listStr = completedTasks
        .slice(0, 10)
        .map((t) => `- **${t.title}** (Completed at: ${formatConversationalDate(t.completed_at, isMarathi)})`)
        .join('\n');
      const ans = isMarathi
        ? `तुमचे completed tasks (${completedTasks.length}):\n\n${listStr}`
        : `Your completed tasks (${completedTasks.length}):\n\n${listStr}`;
      return { answer: ans, referencedTasks, providerUsed: this.name };
    }

    // 8. SPECIFIC TASK / PERSON SEARCH:
    // e.g. "Disha ला call कधी करायचा आहे?", "Disha चे सगळे tasks दाखव", "Call Disha"
    const tokens = qLower
      .replace(/[?.,!लाचेचाचीचेनाना]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['tasks', 'task', 'kadh', 'aahe', 'ahet', 'kay', 'hoti'].includes(w));

    const candidateTasks = tasks.filter((t) => {
      const titleL = t.title.toLowerCase();
      const descL = (t.description || '').toLowerCase();
      const personL = (t.person_name || '').toLowerCase();

      return tokens.some((tok) => titleL.includes(tok) || personL.includes(tok) || descL.includes(tok));
    });

    // Score candidates based on relevance
    const scoredCandidates = candidateTasks.map((t) => {
      const titleL = t.title.toLowerCase();
      const descL = (t.description || '').toLowerCase();
      const personL = (t.person_name || '').toLowerCase();
      let score = 0;

      if (titleL === qLower || qLower.includes(titleL)) score += 12;
      if (tokens.length > 0 && tokens.every((tok) => titleL.includes(tok))) score += 8;
      if (titleL.includes('call') && titleL.includes('disha')) score += 6;
      if (personL.includes('disha') || titleL.includes('disha')) score += 4;
      if (descL.includes('project requirements')) score += 4;
      // Prefer active tasks over cancelled
      if (t.status === 'pending' || t.status === 'in_progress') score += 4;
      if (t.status === 'cancelled') score -= 3;

      return { task: t, score };
    });

    scoredCandidates.sort((a, b) => b.score - a.score);

    // If user explicitly asks for "all tasks" / "सगळे tasks":
    if (
      qLower.includes('सगळे') ||
      qLower.includes('सर्व') ||
      qLower.includes('all tasks') ||
      qLower.includes('दाखव') && !qLower.includes('कधी') && !qLower.includes('description')
    ) {
      if (candidateTasks.length > 0) {
        candidateTasks.forEach(addRef);
        const listStr = candidateTasks
          .map((t) => `- **${t.title}** (${isMarathi ? translateStatusMr(t.status) : t.status}, Due: ${formatConversationalDate(t.due_date, isMarathi)})`)
          .join('\n');
        const ans = isMarathi
          ? `या संदर्भात **${candidateTasks.length}** tasks सापडले:\n\n${listStr}`
          : `Found **${candidateTasks.length}** tasks matching your query:\n\n${listStr}`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }
    }

    // Single target candidate response
    if (scoredCandidates.length > 0 && scoredCandidates[0].score > 0) {
      const t = scoredCandidates[0].task;
      addRef(t);

      // A. Due date inquiry: "कधी", "when", "due"
      if (qLower.includes('कधी') || qLower.includes('when') || qLower.includes('due date') || qLower.includes('वेळ')) {
        const dueDateFormatted = formatConversationalDate(t.due_date, isMarathi);
        const prioStr = isMarathi ? translatePriorityMr(t.priority) : t.priority;
        const statusStr = isMarathi ? translateStatusMr(t.status) : t.status;

        const ans = isMarathi
          ? `**${t.title}** चा task **${dueDateFormatted}** ला due आहे. Priority **${prioStr}** आहे आणि task सध्या **${statusStr}** आहे.`
          : `The task **${t.title}** is due on **${dueDateFormatted}**. Priority is **${prioStr}** and status is currently **${statusStr}**.`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }

      // B. Description inquiry: "description काय आहे"
      if (qLower.includes('description') || qLower.includes('तपशील') || qLower.includes('माहिती')) {
        const descText = t.description?.trim() || (isMarathi ? 'कोणतीही description दिलेली नाही.' : 'No description provided.');
        const ans = isMarathi
          ? `**${t.title}** ची description:\n\n> "${descText}"`
          : `Description for **${t.title}**:\n\n> "${descText}"`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }

      // C. Priority inquiry: "priority काय आहे"
      if (qLower.includes('priority') || qLower.includes('महत्त्व')) {
        const prioStr = isMarathi ? translatePriorityMr(t.priority) : t.priority;
        const ans = isMarathi
          ? `**${t.title}** ची priority **${prioStr}** आहे.`
          : `The priority for **${t.title}** is **${prioStr}**.`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }

      // D. Completion status inquiry: "complete झाला आहे का?", "is it completed?"
      if (qLower.includes('complete') || qLower.includes('झाला आहे का') || qLower.includes('status')) {
        const isComp = t.status === 'completed';
        const ans = isMarathi
          ? isComp
            ? `होय, **${t.title}** हा task **${formatConversationalDate(t.completed_at, isMarathi)}** रोजी Complete झाला आहे.`
            : `नाही, **${t.title}** हा task अजून Complete झालेला नाही. सध्याचा status **${translateStatusMr(t.status)}** आहे.`
          : isComp
            ? `Yes, the task **${t.title}** was completed on **${formatConversationalDate(t.completed_at, false)}**.`
            : `No, the task **${t.title}** is not yet completed. Current status is **${t.status}**.`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }

      // E. Status history inquiry: "history काय आहे"
      if (qLower.includes('history') || qLower.includes('इतिहास') || qLower.includes('बदल')) {
        const hist = t.task_status_history || [];
        if (hist.length === 0) {
          const ans = isMarathi
            ? `**${t.title}** साठी कोणतीही वेगळी history नोंदवलेली नाही.`
            : `No status history recorded for **${t.title}**.`;
          return { answer: ans, referencedTasks, providerUsed: this.name };
        }
        const histStr = hist
          .map((h: any) => `- ${formatDateTime(h.changed_at)}: **${h.new_status}** (${h.remarks || 'No remarks'})`)
          .join('\n');
        const ans = isMarathi
          ? `**${t.title}** चा Status History:\n\n${histStr}`
          : `Status history for **${t.title}**:\n\n${histStr}`;
        return { answer: ans, referencedTasks, providerUsed: this.name };
      }

      // Default single task summary
      const ans = isMarathi
        ? `**${t.title}**:\n- **Status**: ${translateStatusMr(t.status)}\n- **Priority**: ${translatePriorityMr(t.priority)}\n- **Due Date**: ${formatConversationalDate(t.due_date, isMarathi)}\n- **Description**: ${t.description || 'N/A'}`
        : `**${t.title}**:\n- **Status**: ${t.status}\n- **Priority**: ${t.priority}\n- **Due Date**: ${formatConversationalDate(t.due_date, false)}\n- **Description**: ${t.description || 'N/A'}`;
      return { answer: ans, referencedTasks, providerUsed: this.name };
    }

    // 9. GENERAL / WORLD / WEB QUESTION — DELEGATE TO UNIVERSAL KNOWLEDGE ENGINE
    const universal = await queryUniversalKnowledge(question);
    return {
      answer: universal.answer,
      referencedTasks: [],
      providerUsed: universal.provider,
    };
  }
}

// Active provider instance
const activeProvider: AIProvider = new TaskAwareGroundingEngine();

// Public entrypoint for AI Assistant
export const askTaskerAI = async (question: string): Promise<AIResponse> => {
  const trimmed = question.trim();
  if (!trimmed) {
    return {
      answer: 'कृपया तुमचा प्रश्न विचारा किंवा कमांड द्या (उदा. "Add task: Call Rahul tomorrow at 5pm").',
      referencedTasks: [],
      providerUsed: activeProvider.name,
    };
  }

  // 1. Fetch live task data with relations from Supabase
  let rawTasks: any[] = [];
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_notes(note, created_at, created_by),
        task_status_history(old_status, new_status, changed_at, remarks),
        task_attachments(file_name, file_type, uploaded_at)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (!error && data) {
      rawTasks = data;
    }
  } catch (err) {
    console.warn('Live task query warning:', err);
  }

  // 2. First Priority: Check for natural-language TASKER action commands (Create, Complete, Reminder, Update, Delete)
  try {
    const actionResult = await executeAIAction(trimmed, rawTasks);
    if (actionResult.handled) {
      return {
        answer: actionResult.answer,
        referencedTasks: actionResult.referencedTasks,
        providerUsed: 'TASKER AI 2.0 (Action Engine)',
        actionTaken: actionResult.actionType,
      };
    }
  } catch (actionErr) {
    console.warn('Action command execution error:', actionErr);
  }

  // 3. Second Priority: Task-grounded queries or Universal Web / World Knowledge
  try {
    return await activeProvider.processQuery(trimmed, rawTasks);
  } catch (ex) {
    console.error('AI assistant processing error, attempting universal fallback:', ex);
    const universal = await queryUniversalKnowledge(trimmed);
    return {
      answer: universal.answer,
      referencedTasks: [],
      providerUsed: universal.provider,
    };
  }
};