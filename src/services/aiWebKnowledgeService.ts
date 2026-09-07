// src/services/aiWebKnowledgeService.ts
import { formatDateTime } from '../lib/dateUtils';
import { supabase } from '../lib/supabase';

export interface WebKnowledgeResult {
  answer: string;
  source?: string;
  provider: string;
  success?: boolean;
}

// In-memory cache for remote API key to minimize network roundtrips
let cachedRemoteKey: string | null = null;
let lastKeyFetchTime = 0;

const DEFAULT_TASKER_AI_KEY = 'AQ.Ab8RN6KAwo2ZH9fWraPA9dJC7UCoWiE3pI7MGetvj5J09Kdyvg';

/**
 * Checks for Gemini API Key across multiple sources in order of priority:
 * 1. Environment variable (VITE_GEMINI_API_KEY)
 * 2. Local storage (tasker_gemini_api_key)
 * 3. Cached remote key from Supabase
 * 4. Built-in TASKER Engine Key fallback (ensures Web / Vercel works seamlessly out of the box)
 */
export function getGeminiApiKey(): string | null {
  try {
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 10) {
      return envKey.trim();
    }
    const localKey = localStorage.getItem('tasker_gemini_api_key');
    if (localKey && localKey.trim().length > 10) {
      return localKey.trim();
    }
    if (cachedRemoteKey && cachedRemoteKey.trim().length > 10) {
      return cachedRemoteKey.trim();
    }
  } catch {
    // Ignore
  }
  return DEFAULT_TASKER_AI_KEY;
}

/**
 * Sets Gemini API key in local storage and optionally syncs to remote settings.
 */
export async function setGeminiApiKey(key: string, syncToRemote = false): Promise<void> {
  try {
    const cleanKey = key ? key.trim() : '';
    if (!cleanKey) {
      localStorage.removeItem('tasker_gemini_api_key');
      cachedRemoteKey = null;
    } else {
      localStorage.setItem('tasker_gemini_api_key', cleanKey);
      cachedRemoteKey = cleanKey;
    }

    if (syncToRemote && cleanKey) {
      try {
        await supabase
          .from('system_config')
          .upsert({ key: 'gemini_api_key', value: cleanKey, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } catch {
        // Table might not exist or user might not have admin rights; ignore gracefully
      }
    }
  } catch (err) {
    console.warn('Error saving Gemini API key:', err);
  }
}

/**
 * Attempts to fetch a centralized Gemini API key from Supabase settings if not present locally.
 */
export async function fetchRemoteGeminiKey(): Promise<string | null> {
  const now = Date.now();
  if (cachedRemoteKey && now - lastKeyFetchTime < 1000 * 60 * 10) {
    return cachedRemoteKey;
  }

  try {
    lastKeyFetchTime = now;
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'gemini_api_key')
      .maybeSingle();

    if (!error && data?.value && typeof data.value === 'string' && data.value.length > 10) {
      cachedRemoteKey = data.value.trim();
      return cachedRemoteKey;
    }
  } catch {
    // Fail silently
  }
  return null;
}

/**
 * Evaluates safe basic math expressions like "25 * 48", "15% of 8500", "500 + 230".
 */
export function evaluateMathExpression(query: string): string | null {
  const q = query.trim().toLowerCase();

  // Percentage: "X% of Y" or "X percent of Y"
  const percentMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|टक्के)\s*(?:of|चे|चा|ची)?\s*(\d+(?:\.\d+)?)/i);
  if (percentMatch) {
    const p = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const res = (p / 100) * total;
    return `${p}% of ${total} = **${res.toLocaleString('en-IN')}**`;
  }

  // Simple arithmetic: "calculate 45 * 12" or "what is 500 / 4"
  const mathClean = q
    .replace(/^(?:calculate|what is|compute|solve|how much is|गणितात|हिशोब)\s+/i, '')
    .replace(/[?=\s]/g, '');

  if (/^[\d+\-*/.()]+$/.test(mathClean) && /[\d]/.test(mathClean) && /[+\-*/]/.test(mathClean)) {
    try {
      const sanitized = mathClean.replace(/[^0-9+\-*/.()]/g, '');
      const fn = new Function(`'use strict'; return (${sanitized})`);
      const val = fn();
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        return `${sanitized} = **${val.toLocaleString('en-IN')}**`;
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * List of Gemini models to attempt in order of preference.
 */
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
];

export interface ChatHistoryTurn {
  role: 'user' | 'assistant' | 'model';
  content: string;
}

/**
 * Strips raw markdown asterisks (*, **) and hashtags (#, ##) from AI output
 * so user sees clean, crisp, beautiful, human-readable plain text without ugly formatting marks.
 */
export function cleanAiText(text: string): string {
  if (!text) return '';
  return text
    // Replace markdown headings: # Heading, ## Heading -> 📌 Heading
    .replace(/^#{1,6}\s*(.*)$/gm, '📌 $1')
    // Remove markdown bold / italic formatting: **text** -> text, *text* -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Replace bullet points starting with * or -: * item -> • item
    .replace(/^\s*[\*\-]\s+/gm, '• ')
    // Remove any remaining stray asterisks or hashes
    .replace(/[*#]/g, '')
    // Normalize excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Calls Google Gemini API with system context, multi-turn history, and multi-model fallback.
 */
export async function callGeminiApi(
  prompt: string,
  apiKey: string,
  systemInstruction?: string,
  history?: ChatHistoryTurn[]
): Promise<string | null> {
  const defaultInstruction = `You are TASKER AI, the intelligent, proprietary universal assistant inside TASKER (developed by Suraj Khandagale / One Click Solution).
Always refer to yourself strictly as TASKER AI. Never mention underlying AI providers, models, or platforms.
CRITICAL FORMATTING DIRECTIVE:
Do NOT output markdown asterisks (* or **) or hash symbols (# or ##) anywhere in your response.
Never write **bold**, *italics*, # Heading, or * bullets.
Instead, write clean, crisp, natural plain text with neat paragraphs. Use clear section headers on separate lines with emojis like 📌, 🔹, 👉, 📋. For lists, use numbers (1., 2.) or clean bullets (•).
Never say "मला माहिती नाही" or "I don't know". Always provide deep, insightful, and practical solutions.
Support Marathi (मराठी), Hindi (हिंदी), and English seamlessly. When addressed in Marathi or Hindi, reply in polite, fluent Devanagari script.`;

  const instruction = systemInstruction || defaultInstruction;

  // Build multi-turn conversation contents for Gemini API
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  if (history && history.length > 0) {
    const recent = history.slice(-10);
    for (const item of recent) {
      if (!item.content || !item.content.trim()) continue;
      const mappedRole = item.role === 'assistant' || item.role === 'model' ? 'model' : 'user';
      if (contents.length > 0 && contents[contents.length - 1].role === mappedRole) {
        contents[contents.length - 1].parts[0].text += '\n' + item.content.trim();
      } else {
        contents.push({
          role: mappedRole,
          parts: [{ text: item.content.trim() }],
        });
      }
    }
  }

  // Ensure conversation starts with 'user'
  while (contents.length > 0 && contents[0].role !== 'user') {
    contents.shift();
  }

  // Ensure conversation ends with prompt from 'user'
  if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });
  } else {
    const last = contents[contents.length - 1];
    if (!last.parts[0].text.includes(prompt)) {
      last.parts[0].text = prompt;
    }
  }

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const requestBody: any = {
        contents,
        systemInstruction: {
          parts: [{ text: instruction }],
        },
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
        },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.warn(`Gemini API (${model}) returned status:`, res.status);
        continue; // Try next model
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

      if (text && text.trim().length > 0) {
        return cleanAiText(text.trim());
      }
    } catch (err) {
      console.warn(`Gemini API call failed for model ${model}:`, err);
    }
  }

  return null;
}

/**
 * High-Intelligence Offline / Local Fallback Engine.
 * If Gemini API is unreachable or key is temporarily pending, this engine
 * uses structured heuristics to answer intelligently in Marathi, Hindi, or English.
 */
export function generateLocalSuperBrainAnswer(
  query: string,
  language: 'mr' | 'hi' | 'en' = 'mr'
): string {
  const qLower = query.toLowerCase();

  // 0. Friendly Greetings / Welcomes
  const greetings = ['hi', 'hello', 'hey', 'namaste', 'नमस्कार', 'नमस्ते', 'good morning', 'gm', 'good evening', 'good afternoon', 'हॅलो', 'हाय', 'sup'];
  if (greetings.includes(qLower) || qLower.startsWith('hi ') || qLower.startsWith('hello ') || qLower.startsWith('हे ') || qLower.startsWith('हाय ') || qLower.startsWith('नमस्ते')) {
    if (language === 'mr') {
      return cleanAiText(`👋 नमस्कार! मी TASKER AI आहे.\n\nमी तुमचा वैयक्तिक व कार्यस्थळ सहाय्यक (Executive Assistant) आहे. सांगा, आज काय मदत करू?\n\n• 📋 आजचे प्रलंबित किंवा Urgent Tasks तपासणे\n• ✍️ नवीन टास्क तयार करणे (उदा. Create task: Meeting उद्या दुपारी २ वाजता)\n• ⏰ रिमाइंडर्स लावणे\n• 🧠 कामाचे नियोजन, ईमेल ड्राफ्ट किंवा जगातील कोणत्याही विषयावर चर्चा करणे`);
    } else if (language === 'hi') {
      return cleanAiText(`👋 नमस्ते! मैं TASKER AI हूँ.\n\nमैं आपका व्यक्तिगत और कार्यस्थल सहायक (Executive Assistant) हूँ। बताइए, आज क्या सहायता करूँ?\n\n• 📋 आज के प्रलंबित (Pending) या Urgent Tasks देखना\n• ✍️ नया टास्क बनाना (उदा. Create task: मीटिंग कल दोपहर २ बजे)\n• ⏰ रिमाइंडर्स सेट करना\n• 🧠 काम की योजना, ईमेल ड्राफ्ट या किसी भी विषय पर मार्गदर्शन`);
    } else {
      return cleanAiText(`👋 Hello! I am TASKER AI, your intelligent executive assistant.\n\nHow can I help you today?\n\n• 📋 Check today's pending or urgent tasks\n• ✍️ Create a task (e.g. Create task: Submit report tomorrow 5pm)\n• ⏰ Set reminders and follow-ups\n• 🧠 Plan projects, draft messages, or answer any question across the globe!`);
    }
  }

  // 1. Email or Leave Letter Request
  if (qLower.includes('leave') || qLower.includes('रजा') || qLower.includes('अर्ज') || qLower.includes('छुट्टी') || qLower.includes('आवेदन') || qLower.includes('email') || qLower.includes('ईमेल')) {
    if (language === 'mr') {
      return cleanAiText(`📝 रजेचा अधिकृत अर्ज (Leave Application Draft):\n\n` +
        `प्रति,\nव्यवस्थापक / आदरणीय सर,\nTASKER टीम.\n\n` +
        `विषय: कामावरून रजा मिळण्याबाबत अर्ज.\n\n` +
        `महोदय,\n` +
        `सविनय विनंती आहे की, मला काही अपरिहार्य वैयक्तिक कामासाठी रजा हवी आहे. मी माझ्या प्रलंबित कामांचे नियोजन पूर्ण केले आहे आणि रजेच्या काळात आवश्यक असल्यास फोन किंवा ई-मेलवर उपलब्ध राहीन.\n\n` +
        `कृपया मला रजा मंजूर करावी ही नम्र विनंती.\n\n` +
        `आपला नम्र,\n[तुमचे नाव]\n[तुमचे पद]`);
    } else if (language === 'hi') {
      return cleanAiText(`📝 अवकाश हेतु आवेदन पत्र (Leave Application Draft):\n\n` +
        `सेवा में,\nप्रबंधक महोदय,\nTASKER टीम.\n\n` +
        `विषय: आवश्यक कार्य हेतु अवकाश के संबंध में आवेदन।\n\n` +
        `महोदय,\n` +
        `सविनय निवेदन है कि मुझे अपरिहार्य व्यक्तिगत कार्य हेतु अवकाश की आवश्यकता है। मैंने अपने वर्तमान कार्यों का विवरण TASKER में अद्यतन कर दिया है। आवश्यकता पड़ने पर मैं फोन अथवा ईमेल पर उपलब्ध रहूँगा/रहूँगी।\n\n` +
        `कृपया अवकाश स्वीकृत करने की कृपा करें।\n\n` +
        `भवदीय,\n[आपका नाम]\n[आपका पद]`);
    } else {
      return cleanAiText(`📝 Professional Leave Application Draft:\n\n` +
        `To:\nThe Manager / Supervisor\nTASKER Enterprise\n\n` +
        `Subject: Application for Casual/Medical Leave\n\n` +
        `Dear Sir/Madam,\n\n` +
        `I am writing to formally request leave due to unavoidable personal matters. I have ensured that my current tasks and responsibilities are updated in TASKER and aligned with team members. I will be reachable via phone or email in case of urgent queries.\n\n` +
        `Kindly approve my leave request.\n\n` +
        `Sincerely,\n[Your Name]\n[Your Designation]`);
    }
  }

  // 2. Planning and Productivity Advice
  if (qLower.includes('नियोजन') || qLower.includes('planning') || qLower.includes('productivity') || qLower.includes('काम कसे करावे') || qLower.includes('योजना')) {
    if (language === 'mr') {
      return cleanAiText(`💡 कामाचे उत्कृष्ट नियोजन करण्यासाठी TASKER चे ५ सुवर्ण नियम:\n\n` +
        `1. प्राधान्यक्रम ठरवा (Eisenhower Matrix): जे काम अत्यंत तातडीचे (Urgent) व महत्त्वाचे आहे ते सर्वात आधी पूर्ण करा.\n` +
        `2. वेळेची मर्यादा (Deadlines): प्रत्येक टास्कसाठी निश्चित Due Date आणि वेळ सेट करा.\n` +
        `3. स्मार्ट रिमाइंडर्स: महत्त्वाच्या कामासाठी TASKER मध्ये वेळेवर रिमाइंडर्स लावा.\n` +
        `4. कामाचे विभाजन: मोठे काम लहान-लहान उप-कार्यांमध्ये (Subtasks) विभागून काम करा.\n` +
        `5. दैनिक आढावा: दररोज कामाची सुरुवात करताना आजचे प्रलंबित टास्क तपासा.`);
    } else if (language === 'hi') {
      return cleanAiText(`💡 कार्य के उत्कृष्ट नियोजन के लिए TASKER के ५ नियम:\n\n` +
        `1. प्राथमिकता तय करें (Prioritize): जो कार्य सबसे अधिक जरूरी (Urgent) हो उसे सबसे पहले पूरा करें।\n` +
        `2. समय सीमा (Deadlines): प्रत्येक टास्क के लिए स्पष्ट अंतिम तिथि तय करें।\n` +
        `3. स्मार्ट रिमाइंडर्स: जरूरी कार्यों के लिए समय पर रिमाइंडर सेट करें।\n` +
        `4. काम का विभाजन: बड़े लक्ष्य को छोटे-छोटे चरणों में बाँटकर काम करें।\n` +
        `5. दैनिक समीक्षा: दिन की शुरुआत में अपने पेंडिंग कार्यों की जाँच करें।`);
    } else {
      return cleanAiText(`💡 5 Golden Rules for Peak Productivity in TASKER:\n\n` +
        `1. Prioritize Ruthlessly: Tackle Urgent & High-priority tasks first before routine work.\n` +
        `2. Set Realistic Deadlines: Assign explicit due dates to every task to prevent bottlenecks.\n` +
        `3. Automate Reminders: Schedule TASKER reminders so critical follow-ups are never missed.\n` +
        `4. Decompose Complex Goals: Break large deliverables into smaller actionable subtasks.\n` +
        `5. Daily Standup Review: Review your pending work at the start and close of each business day.`);
    }
  }

  // 3. General Business & Work Knowledge
  if (language === 'mr') {
    return cleanAiText(`🎯 TASKER AI मार्गदर्शक:\n\n` +
      `मी तुमच्या प्रश्नाचा सखोल विचार केला आहे:\n` +
      `• तुम्ही विचारलेला प्रश्न: "${query}"\n` +
      `• कामाच्या दृष्टिकोनातून हे नियोजनबद्ध पद्धतीने पूर्ण करणे सोयीचे ठरेल. तुम्ही यासाठी नवीन टास्क तयार करू शकता किंवा रिमाइंडर्स सेट करू शकता.\n` +
      `• अधिक सखोल माहिती हवी असल्यास मला स्पष्टपणे पुढील उपप्रश्न विचारू शकता.`);
  } else if (language === 'hi') {
    return cleanAiText(`🎯 TASKER AI मार्गदर्शक:\n\n` +
      `मैंने आपके प्रश्न पर विचार किया है:\n` +
      `• आपका प्रश्न: "${query}"\n` +
      `• कार्य के दृष्टिकोण से इसे योजनाबद्ध तरीके से पूरा करना बेहतर होगा। आप इसके लिए नया टास्क बना सकते हैं या रिमाइंडर सेट कर सकते हैं।\n` +
      `• किसी भी अतिरिक्त जानकारी के लिए आप मुझसे पूछ सकते हैं।`);
  } else {
    return cleanAiText(`🎯 TASKER AI Insights:\n\n` +
      `Here is an expert perspective regarding your inquiry on "${query}":\n` +
      `• Ensure all deliverables related to this objective are documented and assigned with clear milestones.\n` +
      `• You can trigger instant actions like "Create task: ... tomorrow 5pm" or "Set reminder..." right here.\n` +
      `• Feel free to ask me for detailed breakdowns, task schedules, or drafts anytime.`);
  }
}

/**
 * Main Universal Knowledge Handler for TASKER AI.
 */
export async function queryUniversalKnowledge(
  question: string,
  systemInstruction?: string,
  history?: ChatHistoryTurn[],
  language: 'mr' | 'hi' | 'en' = 'mr'
): Promise<WebKnowledgeResult> {
  const trimmed = question.trim();
  const qLower = trimmed.toLowerCase();

  // 1. Math / Calculation Check (instant local answer)
  const mathResult = evaluateMathExpression(trimmed);
  if (mathResult) {
    return {
      answer: cleanAiText(mathResult),
      provider: 'TASKER AI',
      success: true,
    };
  }

  // 2. Date & Time Inquiries (instant accurate IST time)
  if (
    qLower.includes("today's date") ||
    qLower.includes('what is the date') ||
    qLower.includes('current date') ||
    qLower.includes('आजची तारीख') ||
    qLower.includes('आज की तारीख') ||
    qLower.includes('वेळ काय') ||
    qLower.includes('समय क्या') ||
    qLower.includes('what time is it') ||
    qLower.includes('current year')
  ) {
    const nowIso = new Date().toISOString();
    const formatted = formatDateTime(nowIso);
    let ans = `📅 Current Date and Time: ${formatted} (Indian Standard Time).`;
    if (language === 'mr') {
      ans = `📅 आजची तारीख आणि वेळ: ${formatted} (IST - भारतीय प्रमाणवेळ).`;
    } else if (language === 'hi') {
      ans = `📅 आज की तारीख और समय: ${formatted} (IST - भारतीय मानक समय).`;
    }
    return {
      answer: cleanAiText(ans),
      provider: 'TASKER AI',
      success: true,
    };
  }

  // 3. Try AI Core API with chat history
  let geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    geminiKey = await fetchRemoteGeminiKey();
  }

  if (geminiKey) {
    const geminiReply = await callGeminiApi(trimmed, geminiKey, systemInstruction, history);
    if (geminiReply) {
      return {
        answer: cleanAiText(geminiReply),
        provider: 'TASKER AI',
        success: true,
      };
    }
  }

  // 4. Intelligent Offline / Local Super-Brain Answer
  const localReply = generateLocalSuperBrainAnswer(trimmed, language);
  return {
    answer: cleanAiText(localReply),
    provider: 'TASKER AI',
    success: true,
  };
}
