// src/services/aiWebKnowledgeService.ts
import { formatDateTime } from '../lib/dateUtils';

export interface WebKnowledgeResult {
  answer: string;
  source?: string;
  provider: string;
}

/**
 * Checks for Gemini API Key from environment or local storage.
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
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Sets Gemini API key in local storage.
 */
export function setGeminiApiKey(key: string): void {
  try {
    if (!key || key.trim() === '') {
      localStorage.removeItem('tasker_gemini_api_key');
    } else {
      localStorage.setItem('tasker_gemini_api_key', key.trim());
    }
  } catch {
    // Ignore
  }
}

/**
 * Evaluates safe basic math expressions like "25 * 48", "15% of 8500", "500 + 230".
 */
function evaluateMathExpression(query: string): string | null {
  const q = query.trim().toLowerCase();

  // Percentage: "X% of Y" or "X percent of Y"
  const percentMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s+of\s+(\d+(?:\.\d+)?)/i);
  if (percentMatch) {
    const p = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const res = (p / 100) * total;
    return `${p}% of ${total} = **${res.toLocaleString('en-IN')}**`;
  }

  // Simple arithmetic: "calculate 45 * 12" or "what is 500 / 4"
  const mathClean = q
    .replace(/^(?:calculate|what is|compute|solve|how much is)\s+/i, '')
    .replace(/[?=\s]/g, '');

  if (/^[\d+\-*/.()]+$/.test(mathClean) && /[\d]/.test(mathClean) && /[+\-*/]/.test(mathClean)) {
    try {
      // Safe math evaluator without eval()
      const sanitized = mathClean.replace(/[^0-9+\-*/.()]/g, '');
      // Use Function with strict isolation
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
 * Queries Wikipedia REST API for search and summaries.
 */
async function searchWikipedia(query: string): Promise<string | null> {
  try {
    // Extract main subject
    const subject = query
      .replace(/^(?:who is|what is|tell me about|explain|who was|where is|capital of|about)\s+/i, '')
      .replace(/[?.,!]/g, '')
      .trim();

    if (!subject || subject.length < 2) return null;

    // 1. Search for closest matching Wikipedia title
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      subject
    )}&format=json&origin=*`;

    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(4500) });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    const firstHit = searchData?.query?.search?.[0];
    if (!firstHit || !firstHit.title) return null;

    // 2. Fetch page summary extract
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      firstHit.title.replace(/\s+/g, '_')
    )}`;

    const summaryRes = await fetch(summaryUrl, { signal: AbortSignal.timeout(4500) });
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();

    if (summaryData && summaryData.extract) {
      const description = summaryData.description ? `*(${summaryData.description})*\n\n` : '';
      return `**${summaryData.title}** ${description}${summaryData.extract}\n\n*Source: [Wikipedia](${summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(firstHit.title)}`})*`;
    }
  } catch (err) {
    // Fail gracefully on timeout or offline
  }
  return null;
}

/**
 * Queries DuckDuckGo Instant Answer API.
 */
async function searchDuckDuckGo(query: string): Promise<string | null> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();

    if (data.AbstractText) {
      const source = data.AbstractSource ? `\n\n*Source: ${data.AbstractSource}*` : '';
      return `${data.AbstractText}${source}`;
    }

    if (data.Answer) {
      return String(data.Answer);
    }
  } catch {
    // Fail gracefully
  }
  return null;
}

/**
 * Calls Google Gemini API if key is available.
 * Supports Google Search Grounding for current information.
 */
async function callGeminiApi(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const systemInstruction = `You are TASKER AI 2.0, a helpful, intelligent universal assistant inside TASKER (an enterprise task and work management app developed by Suraj Khandagale / One Click Solution).
Answer clearly, concisely, and helpfully with markdown formatting.
Seamlessly answer world knowledge, science, programming, productivity, language translation, dates, facts, and everyday questions.
Support English, Marathi (मराठी), and Hindi naturally.`;

    const requestBody: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn('Gemini API returned status:', res.status);
      return null;
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;

    if (text) {
      return text.trim();
    }
  } catch (err) {
    console.warn('Gemini API call failed:', err);
  }
  return null;
}

/**
 * Main Web & Universal Knowledge Handler for TASKER AI 2.0.
 */
export async function queryUniversalKnowledge(question: string): Promise<WebKnowledgeResult> {
  const trimmed = question.trim();
  const qLower = trimmed.toLowerCase();
  const isMarathi = /[\u0900-\u097F]/.test(trimmed) ||
    qLower.includes('kay') || qLower.includes('aahe') || qLower.includes('sang');

  // 1. Math / Calculation Check
  const mathResult = evaluateMathExpression(trimmed);
  if (mathResult) {
    return {
      answer: mathResult,
      provider: 'TASKER AI 2.0 (Math Engine)',
    };
  }

  // 2. Date & Time Inquiries
  if (
    qLower.includes("today's date") ||
    qLower.includes('what is the date') ||
    qLower.includes('current date') ||
    qLower.includes('आजची तारीख') ||
    qLower.includes('वेळ काय') ||
    qLower.includes('what time is it') ||
    qLower.includes('current year')
  ) {
    const nowIso = new Date().toISOString();
    const formatted = formatDateTime(nowIso);
    const ans = isMarathi
      ? `📅 आजची तारीख आणि वेळ: **${formatted}** (IST).`
      : `📅 Current Date and Time: **${formatted}** (Indian Standard Time).`;
    return {
      answer: ans,
      provider: 'TASKER AI 2.0 (System)',
    };
  }

  // 3. Try Gemini API first if configured
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const geminiReply = await callGeminiApi(trimmed, geminiKey);
    if (geminiReply) {
      return {
        answer: geminiReply,
        provider: 'TASKER AI 2.0 (Gemini Live)',
      };
    }
  }

  // 4. Try live Wikipedia search & summary
  const wikiResult = await searchWikipedia(trimmed);
  if (wikiResult) {
    return {
      answer: wikiResult,
      provider: 'TASKER AI 2.0 (Web Encyclopedia)',
    };
  }

  // 5. Try DuckDuckGo Instant Answer API
  const ddgResult = await searchDuckDuckGo(trimmed);
  if (ddgResult) {
    return {
      answer: ddgResult,
      provider: 'TASKER AI 2.0 (Web Search)',
    };
  }

  // 6. Intelligent universal fallback
  let fallbackAnswer = '';
  if (isMarathi) {
    fallbackAnswer = `**TASKER AI 2.0**: मी तुमच्या प्रश्नाचे उत्तर शोधण्याचा प्रयत्न केला. तुम्ही या संदर्भात खालील गोष्टी करू शकता:\n\n1. **टास्क मॅनेजमेंट**: 'नवा टास्क बनवा', 'टास्क complete करा', किंवा 'रिमाइंडर लावा'.\n2. **तारीख / आकडेमोड**: कोणत्याही गणिताचे किंवा तारखेचे उत्तर थेट विचारा.\n3. **विस्तृत माहिती**: अधिक प्रगत संवादासाठी तुम्ही Settings मध्ये **Google Gemini API Key** जोडू शकता.`;
  } else {
    fallbackAnswer = `**TASKER AI 2.0**: I searched my knowledge base for "${trimmed}".\n\nHere are some things I can help you with:\n- **Task Actions**: Say *"Create task: Meeting tomorrow 4pm"*, *"Complete task..."*, or *"Set reminder..."*.\n- **Quick Calculations & Dates**: Ask math questions or check current Indian Standard Time.\n- **General Knowledge**: Ask about world facts, geography, science, and definitions.\n- **Full AI Power**: You can optionally configure your **Google Gemini API Key** in Settings for unlimited generative chat.`;
  }

  return {
    answer: fallbackAnswer,
    provider: 'TASKER AI 2.0 (Universal)',
  };
}

