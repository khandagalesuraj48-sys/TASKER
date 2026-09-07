import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Trash2,
  ArrowRight,
  Zap,
  Key,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { askTaskerAI } from '../../services/aiService';
import { getGeminiApiKey, setGeminiApiKey } from '../../services/aiWebKnowledgeService';
import { AIMessage } from '../../types/task';
import { useBackButton } from '../../hooks/useBackButton';
import { useTask } from '../../context/TaskContext';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_SUGGESTIONS = [
  'आज कोणते tasks करायचे आहेत?',
  'माझे urgent pending tasks कोणते?',
  'Add task: Call Rahul tomorrow at 5pm',
  'Complete task Call Rahul',
  'कंपनीतील कर्मचाऱ्यांची यादी दाखवा',
  'रजेसाठी मराठीत एक अर्ज लिहून दे',
  '15% of 8500 किती?',
  'कामाचे उत्कृष्ट नियोजन कसे करावे?',
];

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { triggerRefresh, reloadStats } = useTask();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Register with Android hardware back button handler (Priority 40: Drawers)
  useBackButton(isOpen, onClose, 40);

  const [inputQuery, setInputQuery] = useState<string>('');
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'नमस्कार! मी **TASKER Super-Brain** आहे — Google Gemini AI द्वारे समर्थित तुमचा स्मार्ट ॲप असिस्टंट.\n\nमी ॲपमधील सर्व **Tasks, कर्मचाऱ्यांची माहिती, मुदती आणि आकडेवारी** जाणतो. तसेच तुम्ही मला जगातील कोणत्याही विषयावर (गणिते, व्यावसायिक पत्रे, नियोजन, सामान्य ज्ञान) प्रश्न विचारू शकता!\n\nखालीलपैकी पर्याय निवडा किंवा तुमचा प्रश्न टाईप करा:',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [customKeyInput, setCustomKeyInput] = useState<string>('');
  const [hasKeyConfigured, setHasKeyConfigured] = useState<boolean>(false);
  const [keySavedMessage, setKeySavedMessage] = useState<string>('');

  useEffect(() => {
    const key = getGeminiApiKey();
    setHasKeyConfigured(Boolean(key));
    if (key) {
      setCustomKeyInput(key);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showKeyModal) {
          setShowKeyModal(false);
        } else if (isOpen) {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showKeyModal]);

  useEffect(() => {
    if (isOpen && !showKeyModal) {
      setTimeout(() => inputRef.current?.focus(), 150);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages, showKeyModal]);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || isSearching) return;

    const userMsg: AIMessage = {
      id: 'user_' + Date.now(),
      role: 'user',
      content: q,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsSearching(true);

    try {
      const response = await askTaskerAI(q);

      if (response.actionTaken) {
        triggerRefresh();
        reloadStats();
      }

      const assistantMsg: AIMessage = {
        id: 'assistant_' + Date.now(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        referencedTasks: response.referencedTasks,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: 'माफ करा, उत्तर तयार करताना अडचण आली. कृपया तुमचा प्रश्न पुन्हा विचारा.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTaskClick = (taskId: string) => {
    onClose();
    navigate(`/tasks/${taskId}`);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'assistant',
        content: 'चॅट साफ केली आहे. तुम्ही तुमच्या टास्कविषयी, कर्मचाऱ्यांविषयी किंवा जगातील कोणत्याही विषयावर प्रश्न विचारू शकता.',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleSaveApiKey = async () => {
    await setGeminiApiKey(customKeyInput.trim(), true);
    setHasKeyConfigured(Boolean(customKeyInput.trim()));
    setKeySavedMessage('Google Gemini API Key सेव्ह करण्यात आली!');
    setTimeout(() => {
      setKeySavedMessage('');
      setShowKeyModal(false);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end animate-in fade-in duration-200">
      {/* Backdrop (Click to close on any screen) */}
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />

      {/* Main Drawer: Fullscreen on mobile, 440px slide-over on desktop */}
      <div className="relative w-full sm:max-w-md md:max-w-lg h-full max-h-[100dvh] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col z-10">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-between shrink-0 pt-safe">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">TASKER Super-Brain</h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs">
                  Gemini AI
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Universal Knowledge • Live App Brain • Actions</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Gemini API Key config button */}
            <button
              onClick={() => setShowKeyModal(true)}
              title="Google Gemini API Key Settings"
              className={`p-2 rounded-xl border transition-all min-w-[38px] min-h-[38px] flex items-center justify-center ${
                hasKeyConfigured
                  ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
                  : 'text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}
              aria-label="API Key Settings"
            >
              <Key className="w-4 h-4" />
            </button>

            <button
              onClick={handleClearHistory}
              title="चॅट साफ करा"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 min-w-[38px] min-h-[38px] flex items-center justify-center transition-colors"
              aria-label="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Accessible Close Button */}
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl min-h-[38px] flex items-center gap-1.5 transition-colors shadow-xs border border-slate-200 dark:border-slate-700 font-semibold text-xs"
              aria-label="Close assistant"
              title="Close assistant (Esc)"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Realtime database status badge */}
        <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between gap-2 text-[11px] text-blue-900 dark:text-blue-200 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate font-medium">TASKER Super-Brain सक्रिय आहे • लाइव्ह डेटाबेस व ज्ञानकोश</span>
          </div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-200/70 dark:bg-blue-900 text-blue-800 dark:text-blue-300 shrink-0">
            {hasKeyConfigured ? 'Gemini Live' : 'AI Active'}
          </span>
        </div>

        {/* Chat Messages Scrolling Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/60 dark:border-slate-700/60'
                }`}
              >
                <p className="whitespace-pre-line">{msg.content}</p>
              </div>

              {/* Clickable Referenced Tasks */}
              {msg.referencedTasks && msg.referencedTasks.length > 0 && (
                <div className="mt-2.5 w-full max-w-[90%] space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">
                    संबंधित कार्ये (Related Tasks):
                  </p>
                  {msg.referencedTasks.map((refTask) => (
                    <div
                      key={refTask.id}
                      onClick={() => handleTaskClick(refTask.id)}
                      className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm cursor-pointer transition-all flex items-center justify-between gap-2 group"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                          {refTask.title}
                        </p>
                        <p className="text-[10px] text-slate-400 capitalize">
                          Status: {refTask.status.replace('_', ' ')} • Priority: {refTask.priority}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isSearching && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 w-fit text-xs text-slate-600 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
              <span>TASKER Super-Brain विचार करत आहे...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {INITIAL_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s)}
                disabled={isSearching}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap transition-colors shrink-0 shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Pure Conversational Input (STRICTLY NO ATTACHMENTS) */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pb-safe shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="काहीही विचारा, किंवा सांगा 'Add task: ...', 'Complete task ...'"
              disabled={isSearching}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button
              onClick={() => handleSend()}
              disabled={isSearching || !inputQuery.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all min-w-[42px] min-h-[42px] flex items-center justify-center"
              aria-label="Send message"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Gemini API Key Configuration Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Key className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Google Gemini AI Key</h4>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Google Gemini AI द्वारे सुपरफास्ट आणि अमर्याद उत्तरे मिळवण्यासाठी तुमची विनामूल्य Google Gemini API Key खाली टाका.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Gemini API Key (AI Studio):
              </label>
              <input
                type="password"
                value={customKeyInput}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {keySavedMessage && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{keySavedMessage}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Get Free Key (Google)</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  रद्द करा
                </button>
                <button
                  onClick={handleSaveApiKey}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  Save & Activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};