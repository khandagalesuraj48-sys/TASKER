// src/services/voiceTaskService.ts
import { getGeminiApiKey } from './aiWebKnowledgeService';
import { TaskPriority } from '../types/task';
import { addDays, setHours, setMinutes, format } from 'date-fns';

export interface ParsedVoiceTask {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  category: string;
  assignedToName?: string | null;
  subtasks: string[];
  rawTranscript: string;
  detectedLanguage: 'mr' | 'hi' | 'en';
}

/**
 * Intelligent local fallback parser for Marathi, Hindi, and English relative dates & priorities
 */
function localRuleBasedTaskParser(transcript: string, lang: 'mr' | 'hi' | 'en'): ParsedVoiceTask {
  const text = transcript.trim();
  const lower = text.toLowerCase();

  // 1. Priority Detection
  let priority: TaskPriority = 'medium';
  if (
    lower.includes('urgent') ||
    lower.includes('तातडीने') ||
    lower.includes('तातडीचे') ||
    lower.includes('लवकरात लवकर') ||
    lower.includes('इमर्जन्सी') ||
    lower.includes('तुरंत') ||
    lower.includes('जरूरी')
  ) {
    priority = 'urgent';
  } else if (
    lower.includes('high') ||
    lower.includes('महत्त्वाचे') ||
    lower.includes('खास') ||
    lower.includes('इंपॉर्टेंट') ||
    lower.includes('अति आवश्यक')
  ) {
    priority = 'high';
  } else if (lower.includes('low') || lower.includes('कमी') || lower.includes('सावकाश')) {
    priority = 'low';
  }

  // 2. Relative Due Date Parsing
  let targetDate = new Date();
  let hasDueDate = false;

  if (
    lower.includes('उद्या') ||
    lower.includes('कल') ||
    lower.includes('tomorrow')
  ) {
    targetDate = addDays(new Date(), 1);
    hasDueDate = true;
  } else if (
    lower.includes('परवा') ||
    lower.includes('परसों') ||
    lower.includes('day after tomorrow')
  ) {
    targetDate = addDays(new Date(), 2);
    hasDueDate = true;
  } else if (lower.includes('आज') || lower.includes('today')) {
    hasDueDate = true;
  }

  // Time detection
  if (lower.includes('संध्याकाळी') || lower.includes('शाम को') || lower.includes('evening') || lower.includes('६ वाजता') || lower.includes('6 pm')) {
    targetDate = setHours(setMinutes(targetDate, 0), 18);
    hasDueDate = true;
  } else if (lower.includes('दुपारी') || lower.includes('दोपहर') || lower.includes('afternoon') || lower.includes('२ वाजता') || lower.includes('2 pm')) {
    targetDate = setHours(setMinutes(targetDate, 0), 14);
    hasDueDate = true;
  } else if (lower.includes('सकाळी') || lower.includes('सुबह') || lower.includes('morning') || lower.includes('१० वाजता') || lower.includes('10 am')) {
    targetDate = setHours(setMinutes(targetDate, 0), 10);
    hasDueDate = true;
  } else if (hasDueDate) {
    // Default 5 PM for due dates
    targetDate = setHours(setMinutes(targetDate, 0), 17);
  }

  // 3. Category inference
  let category = 'General';
  if (lower.includes('बिल') || lower.includes('पेमेंट') || lower.includes('invoice') || lower.includes('खर्च') || lower.includes('पैसे')) {
    category = 'Finance & Accounts';
  } else if (lower.includes('गोदाम') || lower.includes('स्टॉक') || lower.includes('डिलिव्हरी') || lower.includes('सामान') || lower.includes('सप्लाय')) {
    category = 'Operations & Inventory';
  } else if (lower.includes('क्लाइंट') || lower.includes('ग्राहक') || lower.includes('कस्टमर') || lower.includes('कॉल') || lower.includes('मीटिंग')) {
    category = 'Client Relations & Sales';
  } else if (lower.includes('मेंटेनन्स') || lower.includes('दुरुस्ती') || lower.includes('सर्व्हिस') || lower.includes('रिपेअर')) {
    category = 'Maintenance';
  }

  // 4. Subtasks extraction by conjunctions
  const subtasks: string[] = [];
  const parts = text.split(/आणि|तसेच|व|और|तथा|and|also/i);
  if (parts.length > 1) {
    parts.forEach((p) => {
      const clean = p.trim().replace(/^,+|,+$/g, '');
      if (clean.length > 5) {
        subtasks.push(clean);
      }
    });
  }

  return {
    title: text.length > 70 ? text.slice(0, 67) + '...' : text,
    description: `Voice Command Input (${lang.toUpperCase()}):\n"${text}"`,
    priority,
    dueDate: hasDueDate ? targetDate.toISOString() : null,
    category,
    subtasks,
    rawTranscript: text,
    detectedLanguage: lang,
  };
}

/**
 * Parses spoken speech transcript with Gemini 1.5 Flash AI into a structured Task object.
 */
export async function parseVoiceTranscriptWithAI(
  transcript: string,
  selectedLang: 'mr' | 'hi' | 'en' = 'mr'
): Promise<ParsedVoiceTask> {
  const cleanTranscript = transcript.trim();
  if (!cleanTranscript) {
    throw new Error('No voice transcript provided.');
  }

  const apiKey = getGeminiApiKey();

  // If no Gemini API key available, use robust local NLP parser
  if (!apiKey) {
    return localRuleBasedTaskParser(cleanTranscript, selectedLang);
  }

  const currentDateStr = format(new Date(), 'yyyy-MM-dd HH:mm');

  const systemPrompt = `You are the TASKER Enterprise AI Voice Assistant.
The user is dictating a task in Marathi, Hindi, or English.
Current Date and Time (IST): ${currentDateStr}

Your job is to parse the spoken transcript into a clean, actionable enterprise task.
Return ONLY a valid JSON object with NO markdown quotes, NO backticks, NO explanations.

Format:
{
  "title": "Clear, concise action-oriented title in the language spoken",
  "description": "Elaborated scope of work and details from the voice input",
  "priority": "low" | "medium" | "high" | "urgent",
  "dueDate": "ISO 8601 string or null if not mentioned (calculate relative dates like उद्या, कल, today, tomorrow from current time ${currentDateStr})",
  "category": "Operations" | "Finance" | "Sales" | "Maintenance" | "Administration" | "Personal",
  "assignedToName": "Name of person mentioned to assign task to, or null",
  "subtasks": ["Action item 1", "Action item 2"]
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nSpoken Voice Transcript: "${cleanTranscript}"` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      console.warn('Gemini API call returned error:', response.status);
      return localRuleBasedTaskParser(cleanTranscript, selectedLang);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      title: parsed.title || cleanTranscript.slice(0, 60),
      description: parsed.description || cleanTranscript,
      priority: (['low', 'medium', 'high', 'urgent'].includes(parsed.priority) ? parsed.priority : 'medium') as TaskPriority,
      dueDate: parsed.dueDate || null,
      category: parsed.category || 'General',
      assignedToName: parsed.assignedToName || null,
      subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : [],
      rawTranscript: cleanTranscript,
      detectedLanguage: selectedLang,
    };
  } catch (err) {
    console.warn('AI Parsing failed, falling back to local extractor:', err);
    return localRuleBasedTaskParser(cleanTranscript, selectedLang);
  }
}
