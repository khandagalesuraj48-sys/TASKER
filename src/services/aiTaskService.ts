import { TaskPriority } from '../types/task';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export interface AiExtractedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate?: string;
  suggestedSite?: string;
  subtasks?: string[];
  rawSummary?: string;
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
];

/**
 * Gets Gemini API Key from localStorage or env if it's a valid Google AI Studio key
 */
function getActiveGeminiKey(): string | null {
  try {
    const local = localStorage.getItem('tasker_gemini_api_key');
    if (local && local.trim().startsWith('AIzaSy')) return local.trim();
    const env = import.meta.env.VITE_GEMINI_API_KEY;
    if (env && typeof env === 'string' && env.trim().startsWith('AIzaSy')) return env.trim();
  } catch {}
  return null;
}

/**
 * Convert a File into base64 string
 */
const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const matches = result.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        resolve({ mimeType: matches[1], base64: matches[2] });
      } else {
        const commaIndex = result.indexOf(',');
        const base64 = commaIndex !== -1 ? result.substring(commaIndex + 1) : result;
        resolve({ mimeType: file.type || 'application/pdf', base64 });
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

interface ExtractedPdfContent {
  numPages: number;
  page1Text: string;
  allPagesText: string;
}

/**
 * Extract text from all pages of a PDF document using pdfjs-dist.
 * Separates Page 1 (Main Header/Metadata) from subsequent pages for 2-stage analysis.
 */
async function extractPdfText(file: File): Promise<ExtractedPdfContent> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  } as any);

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pagesText: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      let text = '';
      for (const item of tc.items as any[]) {
        text += (item.str || '') + (item.hasEOL ? '\n' : ' ');
      }
      pagesText.push(text.trim());
    } catch (err) {
      console.warn(`Could not read text on page ${i}:`, err);
      pagesText.push('');
    }
  }

  const page1Text = pagesText[0] || '';
  const allPagesText = pagesText.map((txt, idx) => `[PAGE ${idx + 1}]\n${txt}`).join('\n\n');

  return { numPages, page1Text, allPagesText };
}

/**
 * Fail-safe intelligent local parser.
 * Extracts title/site/date/priority from Page 1 first, then scans all pages for scope & subtasks.
 * Guarantees zero 401 errors even if offline or without Gemini API key.
 */
function extractLocallyFromDocument(
  page1Text: string,
  allPagesText: string,
  fileName: string
): AiExtractedTask {
  const combined = (page1Text + '\n' + allPagesText).trim();

  // 1. Title: Look on Page 1 first
  let title = '';
  const titlePatterns = [
    /(?:Subject|Sub|Work Order|Title|Name of Work|Task|Project)[:\-]?\s*([^\n\r.]+)/i,
    /(?:MEMORANDUM|MEMO|SITE INSTRUCTION|NOTICE)[:\-]?\s*([^\n\r.]+)/i,
  ];
  for (const pattern of titlePatterns) {
    const match = page1Text.match(pattern);
    if (match && match[1].trim().length > 3) {
      title = match[1].trim();
      break;
    }
  }

  // If no explicit keyword, take the first descriptive line of Page 1
  if (!title) {
    const p1Lines = page1Text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && !/^\d+$/.test(l));
    if (p1Lines.length > 0) {
      title = p1Lines[0].substring(0, 90);
    }
  }

  if (!title) {
    title = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
  }

  // 2. Site: Check Page 1 first, then all pages
  let suggestedSite: string | undefined = undefined;
  const siteRegex = /\b(VTR|18\s*B|Site\s+[A-Za-z0-9]+|Rachana|NH[-\s]*\d+|Yard|Plant)\b/i;
  const p1SiteMatch = page1Text.match(siteRegex);
  const allSiteMatch = combined.match(siteRegex);
  if (p1SiteMatch) {
    suggestedSite = p1SiteMatch[1].trim();
  } else if (allSiteMatch) {
    suggestedSite = allSiteMatch[1].trim();
  }

  // 3. Due Date: Scan for target/completion dates
  let dueDate: string | undefined = undefined;
  const datePatterns = [
    /(?:Target Date|Completion Date|Due Date|Deadline|Target Completion|By)[:\-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
    /\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b/,
    /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/,
  ];

  for (const pattern of datePatterns) {
    const match = combined.match(pattern);
    if (match) {
      const raw = match[1] || match[0];
      const dmy = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
      if (dmy) {
        dueDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
        break;
      }
      const ymd = raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (ymd) {
        dueDate = `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
        break;
      }
    }
  }

  // 4. Priority: Check urgency keywords
  let priority: TaskPriority = 'medium';
  if (/urgent|tatkal|emergency|critical|immediately/i.test(combined)) {
    priority = 'urgent';
  } else if (/high priority|important|asap|crucial/i.test(combined)) {
    priority = 'high';
  } else if (/low priority|minor/i.test(combined)) {
    priority = 'low';
  }

  // 5. Subtasks: Scan across all pages for bullet points and numbered deliverables
  const subtasks: string[] = [];
  const lines = combined.split('\n').map((l) => l.trim());
  for (const line of lines) {
    const itemMatch = line.match(/^(?:(?:\d+|[a-z])[\.\)]|[\*\-•])\s+(.+)$/i);
    if (itemMatch && itemMatch[1].length > 3 && itemMatch[1].length < 150) {
      const itemText = itemMatch[1].trim();
      if (!subtasks.includes(itemText)) {
        subtasks.push(itemText);
      }
    }
  }

  // 6. Description: Page 1 summary + comprehensive scope across pages
  let description = '';
  if (page1Text.trim()) {
    description = page1Text.slice(0, 600).trim();
  }
  if (combined.length > 600) {
    description += '\n\n' + combined.slice(600, 1800).trim();
  }
  if (!description) {
    description = `Task extracted from uploaded document: ${fileName}`;
  }

  return {
    title,
    description,
    priority,
    dueDate,
    suggestedSite,
    subtasks: subtasks.slice(0, 12),
    rawSummary: description,
  };
}

/**
 * Extract task details from an uploaded PDF or image file.
 * 1. Inspects Page 1 first (for title, site, date, priority).
 * 2. Scans all PDF pages for complete scope, deliverables, and subtasks.
 * 3. Never fails with 401: seamless local parser fallback.
 */
export const extractTaskFromDocument = async (file: File): Promise<AiExtractedTask> => {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  let page1Text = '';
  let allPagesText = '';
  let numPages = 1;

  // 1. Extract text from PDF across all pages
  if (isPdf) {
    try {
      const extracted = await extractPdfText(file);
      numPages = extracted.numPages;
      page1Text = extracted.page1Text;
      allPagesText = extracted.allPagesText;
    } catch (pdfErr) {
      console.warn('PDF text extraction error, falling back to base64/local:', pdfErr);
    }
  }

  // 2. Check for active, valid Gemini API Key (starts with AIzaSy)
  const apiKey = getActiveGeminiKey();

  // If no valid Gemini API key is configured or PDF already extracted locally,
  // we can either call Gemini (if key exists) or execute the robust local extractor.
  if (!apiKey) {
    // Intelligent local parsing (zero 401 errors)
    if (isPdf && (page1Text || allPagesText)) {
      return extractLocallyFromDocument(page1Text, allPagesText, file.name);
    }
    // For images without API key, return clean file metadata
    return {
      title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
      description: `Uploaded document: ${file.name}`,
      priority: 'medium',
    };
  }

  // 3. Gemini AI Parsing with 2-stage prompt
  const prompt = isPdf && (page1Text || allPagesText)
    ? `You are an expert AI task planner and work order analysis assistant for TASKER.
We have extracted text from an uploaded PDF (${numPages} page${numPages > 1 ? 's' : ''}).

=== PRIMARY FIRST PAGE (HEADER & METADATA) ===
${page1Text.slice(0, 3500)}

=== FULL DOCUMENT CONTENT (ALL PAGES) ===
${allPagesText.slice(0, 10000)}

INSTRUCTIONS:
1. FIRST inspect the PRIMARY FIRST PAGE to extract:
   - "title": Clear, concise, professional task title or Work Order subject.
   - "suggestedSite": The specific construction or workplace site name/code mentioned (e.g., 'VTR', '18 B', 'Site C', 'Rachana', etc.). Look primarily on Page 1.
   - "dueDate": Target completion date or deadline mentioned in YYYY-MM-DD format (or null if none).
   - "priority": "urgent" | "high" | "medium" | "low" (if 'tatkal', 'urgent', 'immediately', 'critical' appear, use 'urgent' or 'high'; otherwise 'medium').

2. NEXT inspect the FULL DOCUMENT across all pages to extract:
   - "description": Thorough, structured description of the work to be completed, technical specifications, and guidelines found across all pages.
   - "subtasks": An array of actionable deliverable items / steps extracted from bullet points, numbered items, or BOQ work packages across all pages.

Return ONLY valid JSON matching this schema:
{
  "title": "string",
  "description": "string",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD" or null,
  "suggestedSite": "string" or null,
  "subtasks": ["string", "string"]
}`
    : `You are an expert AI task planner for TASKER.
Analyze this document thoroughly. Extract and generate a complete, structured task in JSON format.
Output ONLY valid JSON with fields:
{
  "title": "Clear task title",
  "description": "Detailed description",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD" or null,
  "suggestedSite": "Extracted site name" or null,
  "subtasks": ["Step 1", "Step 2"]
}`;

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      let contents: any[];
      if (isPdf && (page1Text || allPagesText)) {
        contents = [{ parts: [{ text: prompt }] }];
      } else {
        const { base64, mimeType } = await fileToBase64(file);
        contents = [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType || 'application/pdf',
                  data: base64,
                },
              },
              { text: prompt },
            ],
          },
        ];
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (!response.ok) {
        console.warn(`Gemini model ${model} responded with ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedText);

      let priority: TaskPriority = 'medium';
      if (['low', 'medium', 'high', 'urgent'].includes(parsed.priority?.toLowerCase())) {
        priority = parsed.priority.toLowerCase() as TaskPriority;
      }

      let formattedDueDate: string | undefined = undefined;
      if (parsed.dueDate && typeof parsed.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate.trim())) {
        formattedDueDate = parsed.dueDate.trim();
      }

      return {
        title: parsed.title || file.name.replace(/\.[^/.]+$/, ''),
        description: parsed.description || '',
        priority,
        dueDate: formattedDueDate,
        suggestedSite: parsed.suggestedSite || undefined,
        subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks.filter(Boolean) : [],
        rawSummary: parsed.description,
      };
    } catch (err) {
      console.warn(`Attempt with ${model} failed:`, err);
    }
  }

  // If Gemini API fails for any reason (network, quota, 401), fallback seamlessly to local parser
  if (isPdf && (page1Text || allPagesText)) {
    return extractLocallyFromDocument(page1Text, allPagesText, file.name);
  }

  return {
    title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' '),
    description: `Uploaded document: ${file.name}`,
    priority: 'medium',
  };
};

/**
 * Extract structured task from spoken Marathi / Hindi / English speech transcript
 */
export const extractTaskFromSpokenText = async (spokenText: string): Promise<AiExtractedTask> => {
  const apiKey = getActiveGeminiKey();
  const today = new Date().toISOString().split('T')[0];

  if (apiKey) {
    const prompt = `You are an expert AI task planner for the construction and project management app TASKER.
A site supervisor or user just spoke a task instruction in Marathi (or mixed Marathi/Hindi/English):
"${spokenText}"
Today's date is: ${today}.
Analyze the spoken transcript and return JSON with:
{
  "title": "Clear concise title",
  "description": "Clean description in Marathi or English",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD" or null,
  "suggestedSite": "Extracted site name" or null,
  "subtasks": ["Step 1", "Step 2"]
}`;

    for (const model of GEMINI_MODELS) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        });

        if (!response.ok) continue;
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);

        let priority: TaskPriority = 'medium';
        if (['low', 'medium', 'high', 'urgent'].includes(parsed.priority?.toLowerCase())) {
          priority = parsed.priority.toLowerCase() as TaskPriority;
        }

        let formattedDueDate: string | undefined = undefined;
        if (parsed.dueDate && typeof parsed.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate.trim())) {
          formattedDueDate = parsed.dueDate.trim();
        }

        return {
          title: parsed.title || spokenText.slice(0, 50),
          description: parsed.description || spokenText,
          priority,
          dueDate: formattedDueDate,
          suggestedSite: parsed.suggestedSite || undefined,
          subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks.filter(Boolean) : [],
          rawSummary: parsed.description || spokenText,
        };
      } catch (err) {
        console.warn(`Spoken text attempt with ${model} failed:`, err);
      }
    }
  }

  // Graceful Fallback if Gemini is unavailable
  let priority: TaskPriority = 'medium';
  if (/urgent|tatkal|तातडीने/i.test(spokenText)) priority = 'urgent';
  else if (/महत्वाचे|high|important/i.test(spokenText)) priority = 'high';

  return {
    title: spokenText.length > 50 ? spokenText.substring(0, 50) + '...' : spokenText,
    description: spokenText,
    priority,
  };
};
