import { TaskPriority } from '../types/task';

export interface AiExtractedTask {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate?: string;
  suggestedSite?: string;
  subtasks?: string[];
  rawSummary?: string;
}

const FALLBACK_KEY = 'AQ.Ab8RN6KAwo2ZH9fWraPA9dJC7UCoWiE3pI7MGetvj5J09Kdyvg';
const GEMINI_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite'];

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

/**
 * Extract task details from an uploaded PDF or image file using Gemini AI
 */
export const extractTaskFromDocument = async (file: File): Promise<AiExtractedTask> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || FALLBACK_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const { base64, mimeType } = await fileToBase64(file);

  const prompt = `You are an expert AI task planner and construction/work order analysis assistant for TASKER.
Analyze this document thoroughly (it may be a work order, bill of quantities, site instructions, architectural drawing notes, tender, or meeting memo).

Read all sections, dates, notes, and scope of work. Extract and generate a complete, structured task in JSON format.
The output MUST be valid JSON with exactly these fields:
{
  "title": "Clear, concise, professional task title describing what needs to be done",
  "description": "Thorough, structured description of the work to be completed, including steps, technical specifications, required materials, or precautions mentioned in the document",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD format if a target completion date or deadline is specified or implied in the document, otherwise null",
  "suggestedSite": "Extracted site name or code if mentioned (e.g. 'VTR', '18 B', 'Site C', 'Site D', 'Rachana', etc.), otherwise null",
  "subtasks": ["Actionable step 1", "Actionable step 2", "Actionable step 3"]
}

Rules:
1. Provide accurate details in Marathi or English (prefer Marathi or clean English matching user's document context).
2. If deadline is mentioned (like 15 Sept 2026 or immediate), translate into YYYY-MM-DD format.
3. If no specific priority is stated, default to "medium" unless urgency words like 'tatkal', 'urgent', 'immediately' are found.
4. Output ONLY the JSON object without markdown fences or additional conversational commentary.`;

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType || 'application/pdf',
                    data: base64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini model ${model} responded with ${response.status}:`, errorText);
        lastError = new Error(`AI model returned error status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        continue;
      }

      const cleanedText = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

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
    } catch (err: any) {
      console.warn(`Attempt with ${model} failed:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to extract task from document using AI.');
};

/**
 * Extract structured task from spoken Marathi / Hindi / English speech transcript using Gemini AI
 */
export const extractTaskFromSpokenText = async (spokenText: string): Promise<AiExtractedTask> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || FALLBACK_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are an expert AI task planner for the construction and project management app TASKER.
A site supervisor or user just spoke a task instruction in Marathi (or mixed Marathi/Hindi/English).
Here is the user's spoken audio transcript:
"${spokenText}"

Today's date is: ${today}.

Analyze the spoken transcript. Understand:
1. What work needs to be done (Title & Description)
2. Is there any site mentioned? (e.g. Rachana, Site A, Site B, VTR, 18 B, etc.)
3. Is there any urgency or priority? (e.g. तातडीने, urgent = urgent; महत्वाचे = high; सामान्य = normal/medium)
4. Is there any due date mentioned? (e.g. आज, उद्या, परवा, २ दिवसांत, तारखेनुसार). Calculate the target date relative to today (${today}).
5. Action steps if any.

Generate valid JSON output with EXACTLY these fields:
{
  "title": "Clear, concise Marathi or English title summarizing the core work",
  "description": "Clean, well-structured description of the spoken task instructions in Marathi or English",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD format or null",
  "suggestedSite": "Extracted site name or null",
  "subtasks": ["Step 1", "Step 2"]
}

Output ONLY valid JSON. Do not include markdown codeblocks or explanation.`;

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Gemini model ${model} responded with ${response.status}:`, errorText);
        lastError = new Error(`AI model returned error status ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        continue;
      }

      const cleanedText = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

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
    } catch (err: any) {
      console.warn(`Spoken text attempt with ${model} failed:`, err);
      lastError = err;
    }
  }

  if (lastError) {
    console.warn('AI speech parsing fell back to transcript due to:', lastError);
  }

  // Fallback if AI call failed
  return {
    title: spokenText.length > 40 ? spokenText.substring(0, 40) + '...' : spokenText,
    description: spokenText,
    priority: 'medium',
  };
};

