import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  CheckCircle2,
  X,
  ListTodo,
} from 'lucide-react';
import { parseVoiceTranscriptWithAI, ParsedVoiceTask } from '../../services/voiceTaskService';
import { createTask } from '../../services/taskService';
import { createSubtask } from '../../services/subtaskService';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { format } from 'date-fns';

interface VoiceTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
}

export const VoiceTaskModal: React.FC<VoiceTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const { showToast } = useToast();
  const { triggerRefresh } = useTask();

  const [selectedLang, setSelectedLang] = useState<'mr' | 'hi' | 'en'>('mr');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [parsedTask, setParsedTask] = useState<ParsedVoiceTask | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const languageConfig = {
    mr: { label: 'मराठी (Marathi)', code: 'mr-IN', placeholder: 'उदा: "उद्या दुपारी ३ वाजता नवीन मशीन चेक करा आणि रिपोर्ट पाठवा..."' },
    hi: { label: 'हिंदी (Hindi)', code: 'hi-IN', placeholder: 'उदा: "कल सुबह १० बजे टीम के साथ मीटिंग करो और इनवॉइस भेजो..."' },
    en: { label: 'English', code: 'en-IN', placeholder: 'E.g., "Review monthly inventory by Friday 4 PM and send report..."' },
  };

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = languageConfig[selectedLang].code;

      recognizer.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        setTranscript(currentTranscript.trim());
      };

      recognizer.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          showToast('Microphone access denied. Please allow microphone in browser.', 'error');
        }
        stopRecording();
      };

      recognizer.onend = () => {
        setIsRecording(false);
        clearInterval(timerRef.current);
      };

      recognitionRef.current = recognizer;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      clearInterval(timerRef.current);
    };
  }, [selectedLang]);

  const startRecording = () => {
    setParsedTask(null);
    setTranscript('');
    setRecordingSeconds(0);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = languageConfig[selectedLang].code;
        recognitionRef.current.start();
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.warn('Recognition start failed:', err);
        showToast('Could not start microphone. Please check permissions.', 'error');
      }
    } else {
      showToast('Speech recognition not directly supported on this browser. You can type or paste spoken text.', 'info');
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const handleAnalyzeWithAI = async () => {
    if (!transcript.trim()) {
      showToast('Please record or type something first.', 'warning');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await parseVoiceTranscriptWithAI(transcript, selectedLang);
      setParsedTask(result);
      showToast('AI successfully structured your voice task!', 'success');
    } catch (err: any) {
      showToast(err.message || 'AI parsing failed.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateTask = async () => {
    if (!parsedTask) return;
    setIsCreating(true);
    try {
      const newTask = await createTask({
        title: parsedTask.title,
        description: parsedTask.description,
        priority: parsedTask.priority,
        due_date: parsedTask.dueDate,
        status: 'pending',
        person_name: parsedTask.assignedToName || undefined,
      });

      // If subtasks generated, create them linked to parent task
      if (parsedTask.subtasks && parsedTask.subtasks.length > 0) {
        for (const st of parsedTask.subtasks) {
          try {
            await createSubtask(newTask, {
              title: st,
              priority: parsedTask.priority,
              dueDate: parsedTask.dueDate,
            });
          } catch (e) {
            console.warn('Subtask creation warning:', e);
          }
        }
      }

      showToast(`Task "${newTask.title}" created successfully!`, 'success');
      triggerRefresh();
      if (onTaskCreated) onTaskCreated();
      onClose();
    } catch (err: any) {
      showToast('Failed to create task: ' + err.message, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">AI Voice-to-Task</h3>
              <p className="text-[11px] text-muted-foreground">
                Dictate in Marathi, Hindi, or English — Gemini structures it instantly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Language Selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              Select Spoken Language
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['mr', 'hi', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    if (isRecording) stopRecording();
                    setSelectedLang(lang);
                  }}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all ${
                    selectedLang === lang
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background hover:bg-muted border-border text-foreground'
                  }`}
                >
                  {languageConfig[lang].label.split(' ')[0]}
                  <span className="block text-[10px] opacity-80 font-normal">
                    {lang === 'mr' ? 'मराठी' : lang === 'hi' ? 'हिंदी' : 'English'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Microphone Recording Hub */}
          <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl border border-border/60 bg-muted/20 text-center relative overflow-hidden">
            {isRecording && (
              <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
            )}

            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700 ring-4 ring-red-400/30'
                  : 'bg-primary text-primary-foreground hover:opacity-90'
              }`}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            <div className="mt-3">
              {isRecording ? (
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                    Recording ({recordingSeconds}s)... Tap to Stop
                  </span>
                  <p className="text-[11px] text-muted-foreground">Speak naturally in your selected language</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <span className="text-xs font-bold text-foreground">
                    {transcript ? 'Tap Mic to Re-record' : 'Tap to Speak'}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {languageConfig[selectedLang].placeholder}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Spoken Transcript Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Live Spoken Transcript
              </label>
              {transcript && (
                <button
                  type="button"
                  onClick={() => setTranscript('')}
                  className="text-[11px] text-muted-foreground hover:text-destructive"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder={languageConfig[selectedLang].placeholder}
              className="w-full text-xs p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none"
            />
          </div>

          {/* AI Parse Button */}
          {transcript && !parsedTask && (
            <button
              type="button"
              disabled={isAnalyzing || isRecording}
              onClick={handleAnalyzeWithAI}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Voice & Structuring Task...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Structure Task with AI
                </>
              )}
            </button>
          )}

          {/* AI Result Card */}
          {parsedTask && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-indigo-200/50 dark:border-indigo-900/50 pb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Structured Work Order</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 uppercase">
                  {parsedTask.category}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Title</span>
                <input
                  type="text"
                  value={parsedTask.title}
                  onChange={(e) => setParsedTask({ ...parsedTask, title: e.target.value })}
                  className="w-full mt-0.5 text-xs font-semibold p-2 rounded-md border border-border bg-background text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Priority</span>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                        parsedTask.priority === 'urgent'
                          ? 'bg-red-500/10 text-red-600'
                          : parsedTask.priority === 'high'
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-blue-500/10 text-blue-600'
                      }`}
                    >
                      {parsedTask.priority}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold">Due Date</span>
                  <div className="mt-1 text-xs text-foreground font-mono">
                    {parsedTask.dueDate ? format(new Date(parsedTask.dueDate), 'PP p') : 'No Deadline'}
                  </div>
                </div>
              </div>

              {parsedTask.subtasks && parsedTask.subtasks.length > 0 && (
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                    <ListTodo className="w-3 h-3" />
                    Generated Subtasks ({parsedTask.subtasks.length})
                  </span>
                  <ul className="mt-1 space-y-1">
                    {parsedTask.subtasks.map((st, i) => (
                      <li key={i} className="text-xs flex items-center gap-1.5 text-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span>{st}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
          >
            Cancel
          </button>
          {parsedTask && (
            <button
              type="button"
              disabled={isCreating}
              onClick={handleCreateTask}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm & Create Task
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
