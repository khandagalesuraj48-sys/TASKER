import { Task } from '../types/task';
import { formatDateOnly } from '../lib/dateUtils';

/**
 * 1-Click WhatsApp Share for any task with clean Marathi formatting and deep link
 */
export const shareTaskOnWhatsApp = (task: Task, siteName?: string): void => {
  const origin = window.location.origin;
  const taskLink = `${origin}/tasks/${task.id}`;

  const priorityLabels: Record<string, string> = {
    urgent: '🔴 तातडीचे (Urgent)',
    high: '🟠 उच्च (High)',
    medium: '🟡 मध्यम (Medium)',
    low: '🟢 सामान्य (Low)',
  };

  const statusLabels: Record<string, string> = {
    pending: '⏳ प्रलंबित (Pending)',
    in_progress: '⚙️ चालू आहे (In Progress)',
    completed: '✅ पूर्ण झाले (Completed)',
    transferred: '🔄 हस्तांतरित (Transferred)',
    delayed: '⚠️ विलंबित (Delayed)',
  };

  const siteText = siteName || (task.site_id ? 'कार्य साईट' : 'सामान्य कार्यक्षेत्र');
  const priorityText = priorityLabels[task.priority] || task.priority;
  const statusText = statusLabels[task.status] || task.status;
  const dueDateText = task.due_date ? formatDateOnly(task.due_date) : 'तारीख दिलेली नाही';
  const personText = task.person_name || 'अद्याप कोणाला दिले नाही';

  const message = [
    `📋 *टास्क अपडेट: ${task.title}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📍 *साईट:* ${siteText}`,
    `👤 *जबाबदार व्यक्ती:* ${personText}`,
    `⚡ *प्राधान्य:* ${priorityText}`,
    `📊 *स्थिती:* ${statusText}`,
    `📅 *अंतिम मुदत:* ${dueDateText}`,
    task.description ? `
📝 *कामाचा तपशील:*
${task.description}` : '',
    `
🔗 *ॲपमध्ये टास्क उघडा:*
${taskLink}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `_TASKER App द्वारे पाठवले_`
  ].filter(Boolean).join('\n');

  const encoded = encodeURIComponent(message);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encoded}`;
  
  // Open WhatsApp in new window or mobile app
  window.open(whatsappUrl, '_blank');
};

/**
 * AI Audio Reader: Speaks task details aloud in Marathi / English
 */
export const speakTaskDetails = (
  title: string,
  description?: string,
  siteName?: string
): void => {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis is not supported on this browser/device.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  let textToSpeak = `टास्क: ${title}. `;
  if (siteName) {
    textToSpeak += `साईट: ${siteName}. `;
  }
  if (description) {
    textToSpeak += `तपशील: ${description}. `;
  }

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  
  // Try finding Marathi voice or fallback to Hindi / Indian English
  const voices = window.speechSynthesis.getVoices();
  const marathiVoice = voices.find((v) => v.lang.startsWith('mr') || v.name.toLowerCase().includes('marathi'));
  const hindiVoice = voices.find((v) => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
  const indianVoice = voices.find((v) => v.lang.includes('IN') || v.lang.includes('India'));

  if (marathiVoice) {
    utterance.voice = marathiVoice;
    utterance.lang = 'mr-IN';
  } else if (hindiVoice) {
    utterance.voice = hindiVoice;
    utterance.lang = 'hi-IN';
  } else if (indianVoice) {
    utterance.voice = indianVoice;
    utterance.lang = indianVoice.lang;
  } else {
    utterance.lang = 'mr-IN';
  }

  utterance.rate = 0.95; // Slightly slower for crisp clarity
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
};

/**
 * Stop any ongoing speech
 */
export const stopSpeaking = (): void => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};
