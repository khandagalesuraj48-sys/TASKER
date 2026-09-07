// src/services/aiService.ts
import { supabase } from '../lib/supabase';
import { TaskReference } from '../types/task';
import { formatDateTime, formatDateOnly, isTaskOverdue, parseInTimezone } from '../lib/dateUtils';
import { isToday, isYesterday, isTomorrow } from 'date-fns';
import { executeAIAction } from './aiActionService';
import { queryUniversalKnowledge, cleanAiText } from './aiWebKnowledgeService';

export interface AIResponse {
  answer: string;
  referencedTasks: TaskReference[];
  providerUsed: string;
  actionTaken?: 'create' | 'complete' | 'reminder' | 'update' | 'delete' | null;
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

/**
 * Gathers complete live data across the application to empower TASKER Super-Brain.
 */
async function gatherAppBrainContext() {
  let currentUser = {
    name: 'Authorized User',
    email: '',
    role: 'Employee',
  };
  let organizationName = 'TASKER Enterprise';
  let rawTasks: any[] = [];
  let employees: any[] = [];

  // 1. Current user session
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      currentUser.email = authData.user.email || '';
      currentUser.name =
        authData.user.user_metadata?.full_name ||
        authData.user.user_metadata?.name ||
        authData.user.email?.split('@')[0] ||
        'User';
    }
  } catch {
    // Fail gracefully
  }

  // 2. Fetch live tasks
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        task_notes(note, created_at, created_by),
        task_status_history(old_status, new_status, changed_at, remarks)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (!error && data) {
      rawTasks = data;
    }
  } catch (err) {
    console.warn('Live task query warning:', err);
  }

  // 3. Fetch active organization and employees
  try {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (orgData?.name) {
      organizationName = orgData.name;
    }

    const { data: empData } = await supabase
      .from('erp_employees')
      .select('full_name, designation, department, phone, email, is_active')
      .limit(30);

    if (empData) {
      employees = empData;
    }
  } catch {
    // Fail gracefully
  }

  // 4. Calculate task metrics
  const now = new Date();
  const pendingTasks = rawTasks.filter((t) => t.status === 'pending');
  const inProgressTasks = rawTasks.filter((t) => t.status === 'in_progress');
  const completedTasks = rawTasks.filter((t) => t.status === 'completed');
  const overdueTasks = rawTasks.filter((t) => isTaskOverdue(t.due_date, t.status));
  const urgentTasks = rawTasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed');
  const todayTasks = rawTasks.filter((t) => t.due_date && isToday(new Date(t.due_date)));

  const stats = {
    total: rawTasks.length,
    pending: pendingTasks.length,
    in_progress: inProgressTasks.length,
    completed: completedTasks.length,
    overdue: overdueTasks.length,
    urgent: urgentTasks.length,
    dueToday: todayTasks.length,
  };

  const currentDateTimeIST = formatDateTime(now.toISOString());

  return {
    currentUser,
    organizationName,
    currentDateTimeIST,
    rawTasks,
    employees,
    stats,
  };
}

/**
 * Builds the Master System Instruction for Google Gemini AI with App Brain Context and Language Preference.
 */
function buildGeminiSystemInstruction(
  context: Awaited<ReturnType<typeof gatherAppBrainContext>>,
  language: 'mr' | 'hi' | 'en' = 'mr'
): string {
  const { currentUser, organizationName, currentDateTimeIST, rawTasks, employees, stats } = context;

  // Format top tasks
  const topTasksStr = rawTasks
    .slice(0, 40)
    .map((t) => {
      const due = t.due_date ? formatDateTime(t.due_date) : 'No due date';
      const person = t.person_name ? ` | Assigned/Pending with: ${t.person_name}` : '';
      return `- [Task ID: ${t.id}] "${t.title}" | Status: ${t.status} | Priority: ${t.priority} | Due: ${due}${person}`;
    })
    .join('\n');

  // Format employees
  const employeesStr = employees.length > 0
    ? employees.map((e) => `- ${e.full_name} (${e.designation || 'Staff'}, Dept: ${e.department || 'General'}${e.phone ? `, Phone: ${e.phone}` : ''})`).join('\n')
    : 'None explicitly listed.';

  let langDirective = '';
  if (language === 'hi') {
    langDirective = `4. STRICT LANGUAGE PREFERENCE (HINDI - हिंदी):
   The user explicitly selected HINDI. Respond primarily in polite, professional, natural HINDI (हिंदी - Devanagari script). Keep task names and IDs easily recognizable.`;
  } else if (language === 'mr') {
    langDirective = `4. STRICT LANGUAGE PREFERENCE (MARATHI - मराठी):
   The user explicitly selected MARATHI. Respond primarily in polite, courteous, fluent MARATHI (मराठी - Devanagari script). Keep task names and IDs easily recognizable.`;
  } else {
    langDirective = `4. STRICT LANGUAGE PREFERENCE (ENGLISH):
   The user explicitly selected ENGLISH. Respond in crisp, structured, professional ENGLISH.`;
  }

  return `You are TASKER AI, the intelligent, proprietary enterprise AI core of TASKER (an advanced task and workforce management platform developed by Suraj Khandagale / One Click Solution). Always identify yourself strictly as TASKER AI. Never mention third-party AI models or platforms.

CRITICAL DIRECTIVES:
1. APP BRAIN MASTERY:
   You have complete, live visibility into the enterprise database below. You know all tasks, employees, deadlines, priorities, and work statuses.
   When the user asks anything about tasks, team members, pending work, deadlines, or progress, use the live data below to answer with 100% precision.
   Always state task titles in bold, mention assignees, status, and due dates clearly.

2. UNIVERSAL & WORLD KNOWLEDGE:
   When asked about anything outside the app — business planning, construction estimation, accounting, GST, drafting professional emails/letters, math, science, programming, history, or daily life — answer authoritatively, thoroughly, and intelligently.

3. NEVER SAY "I DON'T KNOW":
   NEVER say "मला माहिती नाही", "मुझे नहीं पता", or "I don't know". If information is broad or conceptual, provide practical, well-reasoned, actionable advice.

${langDirective}

5. CLEAN PLAIN TEXT FORMATTING:
   CRITICAL: DO NOT use markdown asterisks (*, **) or hash symbols (#, ##) anywhere in your response. Do not write **bold**, *italics*, # Heading, or * bullets.
   Write clean, crisp, natural plain text with neat paragraphs. Use clear section headers on separate lines with emojis like 📌, 🔹, 👉, 📋. For lists, use numbers (1., 2.) or clean bullets (•).

--- LIVE ENTERPRISE APP CONTEXT ---
- Logged-in User: ${currentUser.name} (${currentUser.email})
- Organization: ${organizationName}
- Current Date & Time (IST): ${currentDateTimeIST}
- Overall Task Stats: ${stats.total} total active tasks (${stats.pending} pending, ${stats.in_progress} in progress, ${stats.dueToday} due today, ${stats.overdue} overdue, ${stats.urgent} urgent, ${stats.completed} completed).

TEAM MEMBERS & EMPLOYEES:
${employeesStr}

LIVE TASK ROSTER:
${topTasksStr || 'No active tasks currently recorded.'}
-----------------------------------`;
}

/**
 * High-speed local fallback engine that uses database context directly
 * if Gemini API key is missing or network is offline.
 */
function processLocalGroundedQuery(
  question: string,
  context: Awaited<ReturnType<typeof gatherAppBrainContext>>,
  language: 'mr' | 'hi' | 'en' = 'mr'
): AIResponse {
  const { rawTasks, stats, currentDateTimeIST } = context;
  const qLower = question.toLowerCase().trim();
  const isMarathi = language === 'mr' || /[\u0900-\u097F]/.test(question) ||
    qLower.includes('aahe') || qLower.includes('ahet') || qLower.includes('kadh') ||
    qLower.includes('dakhva') || qLower.includes('maze') || qLower.includes('konte');

  const referencedTasks: TaskReference[] = [];
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

  // 1. COUNT / STATS INQUIRIES
  if (qLower.includes('किती') || qLower.includes('how many') || qLower.includes('count') || qLower.includes('संख्या')) {
    if (qLower.includes('pending') || qLower.includes('प्रलंबित') || qLower.includes('बाकी')) {
      const pending = rawTasks.filter((t) => t.status === 'pending');
      pending.forEach(addRef);
      const ans = isMarathi
        ? `तुमच्याकडे सध्या एकूण **${stats.pending}** प्रलंबित (Pending) tasks आहेत.`
        : `You currently have **${stats.pending}** pending tasks.`;
      return { answer: ans, referencedTasks, providerUsed: 'TASKER AI (Local Grounding)' };
    }
    if (qLower.includes('completed') || qLower.includes('पूर्ण') || qLower.includes('झालेले')) {
      const comp = rawTasks.filter((t) => t.status === 'completed');
      comp.forEach(addRef);
      const ans = isMarathi
        ? `एकूण **${stats.completed}** tasks पूर्ण (Completed) झाले आहेत.`
        : `A total of **${stats.completed}** tasks have been completed.`;
      return { answer: ans, referencedTasks, providerUsed: 'TASKER AI (Local Grounding)' };
    }
    if (qLower.includes('overdue') || qLower.includes('मुदत संपलेले')) {
      const overdue = rawTasks.filter((t) => isTaskOverdue(t.due_date, t.status));
      overdue.forEach(addRef);
      const ans = isMarathi
        ? `सध्या **${stats.overdue}** tasks ची मुदत उलटून गेली आहे (Overdue).`
        : `You currently have **${stats.overdue}** overdue tasks.`;
      return { answer: ans, referencedTasks, providerUsed: 'TASKER AI (Local Grounding)' };
    }
    if (qLower.includes('urgent') || qLower.includes('तातडीचे')) {
      const urgent = rawTasks.filter((t) => t.priority === 'urgent' && t.status !== 'completed');
      urgent.forEach(addRef);
      const ans = isMarathi
        ? `सध्या **${stats.urgent}** urgent tasks बाकी आहेत.`
        : `You currently have **${stats.urgent}** urgent tasks pending.`;
      return { answer: ans, referencedTasks, providerUsed: 'TASKER AI (Local Grounding)' };
    }
  }

  // 2. TODAY'S TASKS
  if (qLower.includes('आज') || qLower.includes('today')) {
    const todayTasks = rawTasks.filter((t) => t.due_date && isToday(new Date(t.due_date)));
    todayTasks.forEach(addRef);
    if (todayTasks.length === 0) {
      const ans = isMarathi
        ? `📅 **${currentDateTimeIST}**\n\nआजसाठी कोणताही task due नाही. सर्व कामे सुरळीत आहेत!`
        : `📅 **${currentDateTimeIST}**\n\nThere are no tasks due today. All scheduled work is on track!`;
      return { answer: ans, referencedTasks: [], providerUsed: 'TASKER AI (Local Grounding)' };
    }
    const listStr = todayTasks
      .map((t) => `- **${t.title}** (${isMarathi ? translateStatusMr(t.status) : t.status}, Due: ${formatConversationalDate(t.due_date, isMarathi)})`)
      .join('\n');
    const ans = isMarathi
      ? `📅 आज एकूण **${todayTasks.length}** tasks पूर्ण करायचे आहेत:\n\n${listStr}`
      : `📅 Here are the **${todayTasks.length}** tasks due today:\n\n${listStr}`;
    return { answer: ans, referencedTasks, providerUsed: 'TASKER AI (Local Grounding)' };
  }

  // 3. OVERDUE TASKS
  if (qLower.includes('overdue') || qLower.includes('मुदत उलटून') || qLower.includes('उलटलेले')) {
    const overdue = rawTasks.filter((t) => isTaskOverdue(t.due_date, t.status));
    overdue.forEach(addRef);
    if (overdue.length === 0) {
      return {
        answer: isMarathi ? '✅ छान! कोणताही task overdue नाही.' : '✅ Great! There are no overdue tasks.',
        referencedTasks: [],
        providerUsed: 'TASKER AI (Local Grounding)',
      };
    }
    const listStr = overdue
      .map((t) => `- **${t.title}** (Due: ${formatConversationalDate(t.due_date, isMarathi)}, Priority: ${isMarathi ? translatePriorityMr(t.priority) : t.priority})`)
      .join('\n');
    const ans = isMarathi
      ? `⚠️ हे **${overdue.length}** tasks मुदत उलटून गेलेले (Overdue) आहेत, यावर तातडीने लक्ष द्या:\n\n${listStr}`
      : `⚠️ These **${overdue.length}** tasks are overdue and require immediate attention:\n\n${listStr}`;
    return { answer: ans, referencedTasks, providerUsed: 'TASKER AI (Local Grounding)' };
  }

  // 4. SEARCH BY PERSON OR TASK KEYWORD
  const cleanKeywords = qLower
    .replace(/[?.,!लाचेचाचीचेनाना]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['tasks', 'task', 'kadh', 'aahe', 'ahet', 'kay', 'hoti', 'dakhva', 'maze'].includes(w));

  const matchingTasks = rawTasks.filter((t) => {
    const titleL = t.title.toLowerCase();
    const descL = (t.description || '').toLowerCase();
    const personL = (t.person_name || '').toLowerCase();
    return cleanKeywords.some((k) => titleL.includes(k) || personL.includes(k) || descL.includes(k));
  });

  if (matchingTasks.length > 0) {
    matchingTasks.forEach(addRef);
    const listStr = matchingTasks
      .slice(0, 8)
      .map((t) => `- **${t.title}** (${isMarathi ? translateStatusMr(t.status) : t.status}, Due: ${formatConversationalDate(t.due_date, isMarathi)}${t.person_name ? `, Assigned: ${t.person_name}` : ''})`)
      .join('\n');
    const ans = isMarathi
      ? `तुमच्या शोधानुसार **${matchingTasks.length}** tasks सापडले:\n\n${listStr}`
      : `Found **${matchingTasks.length}** tasks matching your inquiry:\n\n${listStr}`;
    return { answer: ans, referencedTasks, providerUsed: 'TASKER AI (Local Grounding)' };
  }

  // 5. GENERAL PENDING TASKS LIST
  const pendingTasks = rawTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  if (pendingTasks.length > 0) {
    pendingTasks.slice(0, 5).forEach(addRef);
    const listStr = pendingTasks
      .slice(0, 5)
      .map((t) => `- **${t.title}** (${isMarathi ? translateStatusMr(t.status) : t.status}, Priority: ${isMarathi ? translatePriorityMr(t.priority) : t.priority})`)
      .join('\n');
    const ans = isMarathi
      ? `तुमच्याकडे **${pendingTasks.length}** चालू tasks आहेत. मुख्य tasks:\n\n${listStr}`
      : `You have **${pendingTasks.length}** active tasks. Top items:\n\n${listStr}`;
    return { answer: ans, referencedTasks, providerUsed: 'TASKER AI (Local Grounding)' };
  }

  const defaultAns = isMarathi
    ? `**TASKER AI**:\nतुमचा प्रश्न समजला: "${question}".\n\nसध्या तुमच्याकडे कोणतेही प्रलंबित काम नाही. नवीन कार्य सुरू करण्यासाठी "Add task: [कामाचे नाव]" अशी सूचना देऊ शकता.`
    : `**TASKER AI**:\nUnderstood your query: "${question}".\n\nAll tasks are currently up to date. You can say "Add task: [Title]" to create new work items.`;
  return { answer: defaultAns, referencedTasks: [], providerUsed: 'TASKER AI (Local Grounding)' };
}

export interface TaskerAIOptions {
  language?: 'mr' | 'hi' | 'en';
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Public Entrypoint for TASKER AI Assistant.
 * Seamlessly integrates:
 * 1. Natural Language Task Action Engine (Instant Task CRUD)
 * 2. Google Gemini AI Super-Brain with Deep App Context & Multi-turn Conversation Memory
 * 3. User Language Selection (मराठी, हिंदी, English)
 * 4. High-Intelligence Local Grounding Fallback (Zero "I don't know" responses)
 */
export const askTaskerAI = async (
  question: string,
  options?: TaskerAIOptions
): Promise<AIResponse> => {
  const language = options?.language || 'mr';
  const history = options?.history || [];
  const trimmed = question.trim();

  if (!trimmed) {
    let emptyGreeting = 'नमस्कार! मी TASKER AI आहे. कृपया तुमचा प्रश्न विचारा किंवा नवीन टास्क तयार करा (उदा. "Add task: Meeting उद्या दुपारी ४ वाजता").';
    if (language === 'hi') {
      emptyGreeting = 'नमस्ते! मैं TASKER AI हूँ। कृपया अपना प्रश्न पूछें या नया टास्क बनाएँ (उदा. "Add task: मीटिंग कल दोपहर ४ बजे")।';
    } else if (language === 'en') {
      emptyGreeting = 'Hello! I am TASKER AI. Please ask any question or create a task (e.g. "Add task: Meeting tomorrow 4pm").';
    }
    return {
      answer: emptyGreeting,
      referencedTasks: [],
      providerUsed: 'TASKER AI',
    };
  }

  // 1. Gather comprehensive live context across the application
  const appBrainContext = await gatherAppBrainContext();
  const { rawTasks } = appBrainContext;

  // 2. FIRST PRIORITY: Check for natural-language TASKER action commands (Create, Complete, Reminder, Update, Delete)
  try {
    const actionResult = await executeAIAction(trimmed, rawTasks);
    if (actionResult.handled) {
      return {
        answer: cleanAiText(actionResult.answer),
        referencedTasks: actionResult.referencedTasks,
        providerUsed: 'TASKER AI (Action Core)',
        actionTaken: actionResult.actionType,
      };
    }
  } catch (actionErr) {
    console.warn('Action command execution error:', actionErr);
  }

  // 3. SECOND PRIORITY: Google Gemini AI Super-Brain with live database context & chat history
  try {
    const systemInstruction = buildGeminiSystemInstruction(appBrainContext, language);
    const result = await queryUniversalKnowledge(trimmed, systemInstruction, history, language);

    if (result && result.answer) {
      // Cross-match referenced tasks from the AI answer with live database
      const referencedTasks: TaskReference[] = [];
      const answerLower = result.answer.toLowerCase();

      rawTasks.forEach((t) => {
        if (
          answerLower.includes(t.title.toLowerCase()) ||
          result.answer.includes(t.id) ||
          trimmed.toLowerCase().includes(t.title.toLowerCase())
        ) {
          if (!referencedTasks.some((r) => r.id === t.id)) {
            referencedTasks.push({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              due_date: t.due_date,
            });
          }
        }
      });

      return {
        answer: cleanAiText(result.answer),
        referencedTasks: referencedTasks.slice(0, 5),
        providerUsed: result.provider,
      };
    }
  } catch (geminiErr) {
    console.warn('Gemini query encountered issue, activating local grounding:', geminiErr);
  }

  // 4. THIRD PRIORITY: Intelligent Local Task-Grounded Brain
  // Never fails, never returns Wikipedia, never says "I don't know"
  const localRes = processLocalGroundedQuery(trimmed, appBrainContext, language);
  return {
    ...localRes,
    answer: cleanAiText(localRes.answer),
  };
};