import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Calendar,
  ArrowRight,
  Database,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { askTaskerAI } from '../../services/aiService';
import { AIMessage } from '../../types/task';
import { StatusBadge } from '../common/StatusBadge';
import { PriorityBadge } from '../common/PriorityBadge';
import { formatDateTime } from '../../lib/dateUtils';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_SUGGESTIONS = [
  'Disha ला call कधी करायचा आहे?',
  'आज कोणते tasks आहेत?',
  'माझे pending tasks कोणते?',
  'माझे urgent pending tasks कोणते?',
  'कोणते tasks overdue आहेत?',
  'काल कोणते tasks complete झाले?',
  'माझ्याकडे किती pending tasks आहेत?',
];

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputQuery, setInputQuery] = useState<string>('');
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'नमस्कार! मी तुमचा **TASKER Task Assistant** आहे. मी थेट तुमच्या Supabase डेटाबेसवरील tasks वाचून उत्तरे देतो. खालीलपैकी कोणताही प्रश्न निवडा किंवा तुमचा प्रश्न विचारा:',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

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

      const assistantMsg: AIMessage = {
        id: 'assistant_' + Date.now(),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        referencedTasks: response.referencedTasks,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: 'मला TASKER मध्ये ही माहिती सापडली नाही.',
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
        content: 'चॅट साफ केली आहे. तुम्ही तुमच्या टास्कविषयी कोणताही प्रश्न पुन्हा विचारू शकता.',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-linear-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">TASKER AI Assistant</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    Task-Aware
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Answers strictly from your Supabase task records</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Clear chat history"
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Database Grounding Notice */}
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2 text-[11px] text-emerald-800">
            <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Directly connected to live Supabase tasks. Zero hallucination safeguard active.</span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                      : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>

                {/* Clickable Referenced Tasks */}
                {msg.referencedTasks && msg.referencedTasks.length > 0 && (
                  <div className="mt-2 w-full max-w-[90%] space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1">
                      Related Tasks (Click to open):
                    </p>
                    {msg.referencedTasks.map((refTask) => (
                      <div
                        key={refTask.id}
                        onClick={() => handleTaskClick(refTask.id)}
                        className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 shadow-xs cursor-pointer transition-all flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <StatusBadge status={refTask.status} size="sm" />
                            <PriorityBadge priority={refTask.priority} size="sm" />
                          </div>
                          <h5 className="font-semibold text-xs text-slate-900 truncate">
                            {refTask.title}
                          </h5>
                          {refTask.due_date && (
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Calendar className="w-2.5 h-2.5" />
                              {formatDateTime(refTask.due_date)}
                            </p>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isSearching && (
              <div className="flex items-center gap-2 text-slate-400 text-xs pl-2 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Searching TASKER database...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" /> Quick:
            </span>
            {INITIAL_SUGGESTIONS.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSend(sug)}
                disabled={isSearching}
                className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-700 whitespace-nowrap transition-colors shrink-0 disabled:opacity-50"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about any task (e.g. Disha ला call कधी करायचा आहे?)..."
                disabled={isSearching}
                className="w-full pl-3 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white text-slate-900 placeholder-slate-400"
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputQuery.trim() || isSearching}
                className="absolute right-1.5 p-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                aria-label="Send query"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};