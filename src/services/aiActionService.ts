// src/services/aiActionService.ts
import { updateTask, updateTaskStatus, softDeleteTask } from './taskService';
import { saveTaskReminder } from './reminderService';
import { Task, TaskPriority, TaskReference, ReminderRecurrence } from '../types/task';
import { formatDateTime } from '../lib/dateUtils';
import { createFinancialRecord } from './financeService';
import { createFamilyEntity } from './familyService';
import { createPerson } from './businessService';
import { PRESET_TEMPLATES, instantiateTemplate } from './templateService';
import { getActiveWorkspaceId } from './workspaceService';
import { getSiteStock } from './erpInventoryService';
import { getErpParties } from './erpCrmService';
import { getErpInvoices } from './erpAccountingService';
import { getPendingApprovals } from './erpApprovalService';
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


  const activeWsId = getActiveWorkspaceId();

  // ==========================================
  // ACTION: TEMPLATE CHECKLIST INTENT
  // e.g.: "Use Diwali checklist", "Start GST template"
  // ==========================================
  if (/(?:use|apply|start|create)s+(?:thes+)?(?:diwali|gst|travel|shifting|onboarding)s+(?:template|checklist)/i.test(qLower) ||
      /(?:दिवाळी|जीएसटी)s+(?:चेकलिस्ट|तयारी)/i.test(rawQuery)) {
    let matchedCategory = 'diwali';
    if (/gst/i.test(qLower)) matchedCategory = 'gst';
    else if (/travel/i.test(qLower)) matchedCategory = 'travel';
    else if (/shifting/i.test(qLower)) matchedCategory = 'shifting';
    else if (/onboarding/i.test(qLower)) matchedCategory = 'onboarding';

    const tmpl = PRESET_TEMPLATES.find((t) => t.category === matchedCategory);
    if (tmpl) {
      const count = await instantiateTemplate(tmpl, activeWsId);
      return {
        handled: true,
        answer: isMarathi
          ? `🎉 **'${tmpl.title}' चेकलिस्ट सक्रिय केली!**\n\n${count} नवीन कार्ये तुमच्या वर्कस्पेसमध्ये जोडली गेली आहेत. तुम्ही 'Tasks' टॅबमध्ये पाहू शकता.`
          : `🎉 **Activated '${tmpl.title}' Checklist!**\n\nSuccessfully added ${count} structured tasks to your active workspace.`,
        referencedTasks: [],
        actionType: 'create',
      };
    }
  }

  // ==========================================
  // ACTION: BILL / FINANCIAL RECORD INTENT
  // e.g.: "Add bill: MSEB 2400 due 15th", "Add electricity bill 1500"
  // ==========================================
  if (/^(?:add|create|new)s+(?:as+)?(?:bill|emi|expense|utility)/i.test(qLower) || /(?:बिल जोडा|बिल ॲड करा|नवीन बिल)/i.test(rawQuery)) {
    const amtMatch = rawQuery.match(/(?:rs\.?|inr|₹|amount)?\s*(\d+(?:\.\d+)?)/i);
    const amount = amtMatch ? parseFloat(amtMatch[1]) : 500;
    const cleanTitle = rawQuery
      .replace(/^(?:add|create|new)s+(?:as+)?(?:bill|emi|expense|utility)(?:\s*[:\-to]+)?/i, '')
      .replace(/(?:बिल जोडा|बिल ॲड करा|नवीन बिल)/gi, '')
      .replace(/(?:rs\.?|inr|₹|amount)?\s*(\d+(?:\.\d+)?)/gi, '')
      .trim() || 'Utility Bill';

    const { date: dueDate } = parseNaturalLanguageDateTime(rawQuery);

    await createFinancialRecord({
      workspace_id: activeWsId,
      title: cleanTitle,
      type: /emi/i.test(qLower) ? 'obligation' : 'bill',
      amount,
      currency: 'INR',
      due_date: (dueDate || new Date()).toISOString(),
      status: 'unpaid',
    });

    return {
      handled: true,
      answer: isMarathi
        ? `💳 **नवीन बिल जोडले!**\n\n- **नाव**: ${cleanTitle}\n- **रक्कम**: ₹${amount}\n- **Due Date**: ${formatDateTime((dueDate || new Date()).toISOString())}`
        : `💳 **Saved Financial Record!**\n\n- **Title**: ${cleanTitle}\n- **Amount**: ₹${amount.toLocaleString('en-IN')}\n- **Due Date**: ${formatDateTime((dueDate || new Date()).toISOString())}`,
      referencedTasks: [],
      actionType: 'create',
    };
  }

  // ==========================================
  // ACTION: FAMILY / GROCERY INTENT
  // e.g.: "Add to grocery: 5kg Atta", "Add chore: Clean bedroom"
  // ==========================================
  if (/^(?:add|buy|get)s+(?:tos+)?(?:grocer(?:y|ies)|chore|supplies)/i.test(qLower) || /(?:किराणा|भाजी)/i.test(rawQuery)) {
    const isGrocery = /grocer|किराणा|भाजी/i.test(rawQuery);
    const itemTitle = rawQuery
      .replace(/^(?:add|buy|get)s+(?:tos+)?(?:grocer(?:y|ies)|chore|supplies)(?:\s*[:\-to]+)?/i, '')
      .replace(/(?:किराणा|भाजी)/gi, '')
      .trim() || 'Household Item';

    await createFamilyEntity({
      workspace_id: activeWsId,
      title: itemTitle,
      entity_type: isGrocery ? 'grocery' : 'chore',
      status: 'pending',
      priority: 'medium',
    });

    return {
      handled: true,
      answer: isMarathi
        ? `🛒 **कौटुंबिक यादीत जोडले!**\n\n- **वस्तू**: ${itemTitle}\n- **प्रकार**: ${isGrocery ? 'किराणा / बाजार' : 'घरकाम'}`
        : `🛒 **Added to Family Hub!**\n\n- **Item**: ${itemTitle}\n- **Category**: ${isGrocery ? 'Groceries' : 'Chore'}`,
      referencedTasks: [],
      actionType: 'create',
    };
  }

  // ==========================================
  // ACTION: BUSINESS CONTACT INTENT
  // e.g.: "Add client: Ramesh Bhai", "Add vendor: Sharma Logistics"
  // ==========================================
  if (/^(?:add|create|new)\s+(?:a\s+)?(?:client|vendor|contractor|party|contact)\b/i.test(qLower) || /(?:क्लायंट|पार्टी|काँट्रॅक्टर)/i.test(rawQuery)) {
    const isVendor = /vendor/i.test(qLower);
    const isContractor = /contractor|काँट्रॅक्टर/i.test(qLower);
    const pType = isVendor ? 'vendor' : isContractor ? 'contractor' : 'client';
    const personName = rawQuery
      .replace(/^(?:add|create|new)\s+(?:a\s+)?(?:client|vendor|contractor|party|contact)(?:\s*[:\-to]+)?/i, '')
      .replace(/(?:क्लायंट|पार्टी|काँट्रॅक्टर)/gi, '')
      .trim() || 'New Contact';

    await createPerson({
      workspace_id: activeWsId,
      name: personName,
      person_type: pType,
    });

    return {
      handled: true,
      answer: isMarathi
        ? `🤝 **नवीन संपर्क जोडला!**\n\n- **नाव**: ${personName}\n- **प्रकार**: ${pType}`
        : `🤝 **Saved Business Contact!**\n\n- **Name**: ${personName}\n- **Category**: ${pType}`,
      referencedTasks: [],
      actionType: 'create',
    };
  }


  // ==========================================
  // ENTERPRISE ACTION: VENDOR OUTSTANDING BALANCE
  // e.g.: "या vendor ला किती payment बाकी आहे?", "UltraTech payment status"
  // ==========================================
  if (/(?:vendor|सप्लायर|पार्टी|payment|पेमेंट).*(?:बाकी|outstanding|due|balance)/i.test(rawQuery) ||
      /(?:किती payment बाकी|how much payment due|vendor balance)/i.test(rawQuery)) {
    const parties = await getErpParties('vendor');
    const matched = parties.find((p) => rawQuery.toLowerCase().includes(p.legal_name.toLowerCase()) || (p.trade_name && rawQuery.toLowerCase().includes(p.trade_name.toLowerCase()))) || parties[0];

    if (matched) {
      return {
        handled: true,
        answer: isMarathi
          ? `🏢 **व्हेंडर पेमेंट लेजर माहिती:**\n\n- **व्हेंडर**: ${matched.legal_name}\n- **GSTIN**: ${matched.gstin || 'N/A'}\n- **बाकी रक्कम (Payable)**: ₹${(matched.balance_amount || 0).toLocaleString('en-IN')}\n- **Credit Days**: ${matched.credit_days} दिवस\n\nतुम्ही 'Invoicing & GL Ledger' मधून RTGS किंवा UPI द्वारे पेमेंट करू शकता.`
          : `🏢 **Vendor Outstanding Ledger:**\n\n- **Vendor**: ${matched.legal_name}\n- **GSTIN**: ${matched.gstin || 'N/A'}\n- **Outstanding Payable**: ₹${(matched.balance_amount || 0).toLocaleString('en-IN')}\n- **Credit Terms**: ${matched.credit_days} Days\n\nYou can disburse payments via RTGS/UPI from the Accounts module.`,
        referencedTasks: [],
        actionType: null,
      };
    }
  }

  // ==========================================
  // ENTERPRISE ACTION: SITE STOCK / INVENTORY QUERY
  // e.g.: "Bandra site वर किती cement bags शिल्लक आहेत?", "Cement stock on hand"
  // ==========================================
  if (/(?:stock|शिल्लक|साठा|inventory|material|bags|cement|steel)/i.test(rawQuery) && (/(?:किती|how much|balance|available)/i.test(rawQuery) || /(?:stock|inventory)/i.test(rawQuery))) {
    const stockItems = await getSiteStock();
    const found = stockItems.find((s) => rawQuery.toLowerCase().includes((s.item_name || '').toLowerCase()) || rawQuery.toLowerCase().includes('cement') && (s.item_name || '').toLowerCase().includes('cement')) || stockItems[0];

    if (found) {
      return {
        handled: true,
        answer: isMarathi
          ? `📦 **साइट इन्व्हेंटरी साठा (Live Stock):**\n\n- **मटेरिअल**: ${found.item_name}\n- **उपलब्ध साठा (Quantity on Hand)**: ${found.quantity_on_hand.toLocaleString('en-IN')} ${found.uom}\n- **Valuation Rate**: ₹${found.valuation_rate}/${found.uom}\n- **एकूण मूल्यांकन**: ₹${(found.quantity_on_hand * found.valuation_rate).toLocaleString('en-IN')}`
          : `📦 **Live Site Inventory Stock:**\n\n- **Material**: ${found.item_name}\n- **Quantity on Hand**: ${found.quantity_on_hand.toLocaleString('en-IN')} ${found.uom}\n- **Valuation Rate**: ₹${found.valuation_rate}/${found.uom}\n- **Total Value**: ₹${(found.quantity_on_hand * found.valuation_rate).toLocaleString('en-IN')}`,
        referencedTasks: [],
        actionType: null,
      };
    }
  }

  // ==========================================
  // ENTERPRISE ACTION: SITE PENDING TASKS
  // e.g.: "Mumbai Site 2 चे pending tasks दाखव", "Site Worli tasks"
  // ==========================================
  if (/(?:site|साइट).*(?:tasks|कामे|कामं|pending)/i.test(rawQuery)) {
    const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
    const displayTasks = pendingTasks.slice(0, 5);

    return {
      handled: true,
      answer: isMarathi
        ? `📍 **साइट प्रलंबित कामे (Site Pending Operations):**\n\n${displayTasks.map((t, idx) => `${idx + 1}. **${t.title}** (${t.priority.toUpperCase()})`).join('\n')}\n\nएकूण ${pendingTasks.length} कामे प्रलंबित आहेत.`
        : `📍 **Site Pending Operations:**\n\n${displayTasks.map((t, idx) => `${idx + 1}. **${t.title}** [Priority: ${t.priority.toUpperCase()}]`).join('\n')}\n\nTotal ${pendingTasks.length} tasks currently active on site.`,
      referencedTasks: displayTasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date })),
      actionType: null,
    };
  }

  // ==========================================
  // ENTERPRISE ACTION: PROJECT EXPENSE / PURCHASE REPORT
  // e.g.: "Project A चा खर्च किती झाला?", "March purchase report"
  // ==========================================
  if (/(?:purchase report|खर्च|project cost|expense report)/i.test(rawQuery)) {
    const invoices = await getErpInvoices('purchase');
    const totalSpent = invoices.reduce((acc, inv) => acc + inv.total_amount, 0);

    return {
      handled: true,
      answer: isMarathi
        ? `📊 **प्रकल्प खरेदी व खर्च अहवाल (Project Purchase Summary):**\n\n- **एकूण खरेदी बिले**: ${invoices.length}\n- **एकूण खर्च (Total Outflow)**: ₹${totalSpent.toLocaleString('en-IN')}\n- **नोंदणीकृत प्रकल्प**: Mumbai Metro Phase 2\n\nसविस्तर रिपोर्टसाठी 'Executive Dashboard' पहा.`
        : `📊 **Project Purchase & Cost Summary:**\n\n- **Total Invoices**: ${invoices.length}\n- **Total Incurred Cost**: ₹${totalSpent.toLocaleString('en-IN')}\n- **Project Code**: PRJ-MUM-02\n\nView detailed site breakdown in the Executive Dashboard.`,
      referencedTasks: [],
      actionType: null,
    };
  }

  // ==========================================
  // ENTERPRISE ACTION: PENDING APPROVALS / BILLS
  // e.g.: "कोणती bills approval pending आहेत?", "Pending approvals"
  // ==========================================
  if (/(?:approval|मंजुरी|bills|बिलं|बिले).*(?:pending|बाकी|अडकलेली|प्रलंबित)/i.test(rawQuery) ||
      /(?:कोणती bills approval pending|pending approvals)/i.test(rawQuery)) {
    const pendingList = await getPendingApprovals();

    if (pendingList.length === 0) {
      return {
        handled: true,
        answer: isMarathi
          ? '✅ **कोणतीही बिले किंवा Requisitions मंजुरीसाठी प्रलंबित नाहीत.** सर्व मान्यता पूर्ण झाल्या आहेत!'
          : '✅ **No bills or requisitions are pending approval.** All approvals are up to date!',
        referencedTasks: [],
        actionType: null,
      };
    }

    return {
      handled: true,
      answer: isMarathi
        ? `📋 **मंजुरीसाठी प्रलंबित बिले व Requisitions:**\n\n${pendingList.map((a: any, i: number) => `${i + 1}. **${a.title}** - ₹${(a.amount || 0).toLocaleString('en-IN')} (आवश्यक पद: ${a.assigned_role})`).join('\n')}\n\nतुम्ही 'Approvals Center' मधून एका क्लिकवर मान्यता (Approve) देऊ शकता.`
        : `📋 **Requisitions & Bills Pending Authorization:**\n\n${pendingList.map((a: any, i: number) => `${i + 1}. **${a.title}** - ₹${(a.amount || 0).toLocaleString('en-IN')} [Required Role: ${a.assigned_role}]`).join('\n')}\n\nYou can authorize or reject these in the Approvals Center.`,
      referencedTasks: [],
      actionType: null,
    };
  }


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
    const answer = isMarathi
      ? `ℹ️ AI द्वारे परस्पर टास्क तयार करण्याची सुविधा डेटा सुरक्षिततेसाठी बंद केलेली आहे.\n\nनवीन टास्क तयार करण्यासाठी कृपया स्क्रीनच्या वर दिलेल्या '+ New Task' बटणाचा वापर करा.`
      : `ℹ️ Automatic task creation via AI is disabled for data integrity.\n\nPlease use the '+ New Task' button at the top of the screen to create a new task.`;

    return {
      handled: true,
      answer,
      referencedTasks: [],
      actionType: null,
    };
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
