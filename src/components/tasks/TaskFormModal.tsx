import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  CreateTaskInput,
  ReminderInput,
  Task,
  TaskPriority,
  TaskScope,
  TaskStatus,
} from '../../types/task';
import { ErpEmployee } from '../../types/enterprise';
import {
  createTask,
  updateTask,
  getOrgEmployees,
  quickCreateEmployee,
} from '../../services/taskService';
import { uploadAttachment } from '../../services/attachmentService';
import { getTaskReminder, saveTaskReminder } from '../../services/reminderService';
import { formatInputDate } from '../../lib/dateUtils';
import { useToast } from '../../context/ToastContext';
import { useTask } from '../../context/TaskContext';
import { DEFAULT_USER_NAME } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { useEnterprise } from '../../context/EnterpriseContext';
import { useAdmin } from '../../context/AdminContext';
import { extractTaskFromDocument, extractTaskFromSpokenText } from '../../services/aiTaskService';
import { FileUploadZone } from './FileUploadZone';
import { ReminderControls } from '../reminders/ReminderControls';
import { Paperclip, X, User, Building2, UserPlus, Sparkles, FileUp, Loader2, Mic, MicOff } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit?: Task | null;
  initialValues?: Partial<CreateTaskInput>;
  onSuccess?: (task: Task) => void;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  initialValues,
  onSuccess,
}) => {
  const isEditing = Boolean(taskToEdit);
  const { showToast } = useToast();
  const { triggerRefresh } = useTask();
  const { displayName, userEmail } = useAuth();
  const currentUser = displayName || userEmail || DEFAULT_USER_NAME;
  const { currentOrg, isEnterpriseMode, organizations, userApprovedOrgs, sites, selectedSite, isAdmin, isOwner } = useEnterprise();
  const { isPlatformAdmin } = useAdmin();

  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [personName, setPersonName] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [dueDate, setDueDate] = useState<string>('');
  const [initialNote, setInitialNote] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Available organizations: platform admins see all orgs; members see approved orgs
  const availableOrgs = isPlatformAdmin
    ? organizations
    : (userApprovedOrgs.length > 0 ? userApprovedOrgs : organizations);

  // Scope & Enterprise Assignment State
  const [scope, setScope] = useState<TaskScope>('personal');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employees, setEmployees] = useState<ErpEmployee[]>([]);

  // Inline Quick Add Employee State
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [quickName, setQuickName] = useState<string>('');
  const [quickDesignation, setQuickDesignation] = useState<string>('Team Member');
  const [isCreatingEmp, setIsCreatingEmp] = useState<boolean>(false);

  const [reminder, setReminder] = useState<ReminderInput>({
    is_enabled: false,
    remind_at: '',
    recurrence_type: 'once',
    custom_interval_minutes: null,
  });

  // AI Document Parsing State
  const [isAiParsing, setIsAiParsing] = useState<boolean>(false);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  const handleAiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiParsing(true);
    try {
      showToast('AI डॉक्युमेंट वाचत आहे, कृपया थोडा वेळ थांबा...', 'info');
      const result = await extractTaskFromDocument(file);

      if (result.title) setTitle(result.title);
      if (result.description) {
        let fullDesc = result.description;
        if (result.subtasks && result.subtasks.length > 0) {
          fullDesc += '\n\nकामाचे टप्पे (Action Items):\n' + result.subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n');
        }
        setDescription(fullDesc);
      }
      if (result.priority) setPriority(result.priority);
      if (result.dueDate) setDueDate(result.dueDate);

      if (result.suggestedSite && sites.length > 0) {
        const query = result.suggestedSite.toLowerCase();
        const matched = sites.find(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.code.toLowerCase().includes(query) ||
            query.includes(s.code.toLowerCase())
        );
        if (matched) {
          setSelectedSiteId(matched.id);
        }
      }

      // Also attach the uploaded document to selectedFiles
      setSelectedFiles((prev) => [...prev, file]);
      showToast('✨ AI ने PDF मधून सर्व माहिती टास्क फॉर्ममध्ये भरली!', 'success');
    } catch (err: any) {
      console.error('AI parse error:', err);
      showToast('AI डॉक्युमेंट वाचताना त्रुटी आली: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsAiParsing(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = '';
    }
  };

  // Marathi Voice-to-Task State & Handlers
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('तुमच्या ब्राउझर किंवा डिव्हाइसवर व्हॉईस इनपुट सपोर्ट उपलब्ध नाही.', 'warning');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'mr-IN'; // Default to Marathi
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        showToast('🎙️ ऐकत आहे... कृपया मराठीत बोला...', 'info');
      };

      recognition.onresult = async (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setIsListening(false);
          await handleVoiceInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          showToast(`माईक त्रुटी: ${event.error}`, 'error');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Speech recognition start failed:', err);
      setIsListening(false);
      showToast('माईक सुरू करता आला नाही: ' + (err.message || 'Error'), 'error');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
  };

  const handleVoiceInput = async (spokenText: string) => {
    setIsAiParsing(true);
    try {
      showToast(`🎙️ "${spokenText}" - AI समजून घेत आहे...`, 'info');
      const result = await extractTaskFromSpokenText(spokenText);

      if (result.title) setTitle(result.title);
      if (result.description) {
        let fullDesc = result.description;
        if (result.subtasks && result.subtasks.length > 0) {
          fullDesc += '\n\nकामाचे टप्पे:\n' + result.subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n');
        }
        setDescription(fullDesc);
      }
      if (result.priority) setPriority(result.priority);
      if (result.dueDate) setDueDate(result.dueDate);

      if (result.suggestedSite && sites.length > 0) {
        const query = result.suggestedSite.toLowerCase();
        const matched = sites.find(
          (s) =>
            s.name.toLowerCase().includes(query) ||
            s.code.toLowerCase().includes(query) ||
            query.includes(s.name.toLowerCase()) ||
            query.includes(s.code.toLowerCase())
        );
        if (matched) {
          setSelectedSiteId(matched.id);
        }
      }

      showToast('✨ AI ने बोललेले ऐकून टास्क फॉर्म भरला!', 'success');
    } catch (err: any) {
      console.error('Voice parsing error:', err);
      if (!title) setTitle(spokenText.slice(0, 50));
      if (!description) setDescription(spokenText);
      showToast('बोललेला मजकूर जोडला गेला.', 'info');
    } finally {
      setIsAiParsing(false);
    }
  };

  // Load active organization's employees when in workplace scope
  useEffect(() => {
    const orgIdToUse = selectedOrgId || currentOrg?.id || availableOrgs[0]?.id;
    if (scope === 'workplace' && orgIdToUse) {
      getOrgEmployees(orgIdToUse).then((list) => {
        setEmployees(list);
      }).catch((err) => {
        console.warn('Could not load employees for org:', err);
      });
    }
  }, [scope, selectedOrgId, currentOrg, availableOrgs]);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setPersonName(taskToEdit.person_name || '');
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setDueDate(formatInputDate(taskToEdit.due_date));
      setInitialNote('');
      setSelectedFiles([]);
      setScope(taskToEdit.scope || 'personal');
      setSelectedOrgId(taskToEdit.org_id || currentOrg?.id || availableOrgs[0]?.id || '');
      setSelectedSiteId(taskToEdit.site_id || '');
      setSelectedEmployeeId(taskToEdit.assigned_employee_id || '');

      getTaskReminder(taskToEdit.id).then((rem) => {
        if (rem) {
          setReminder({
            is_enabled: rem.is_enabled && rem.status === 'active',
            remind_at: rem.remind_at,
            recurrence_type: rem.recurrence_type,
            custom_interval_minutes: rem.custom_interval_minutes,
          });
        } else {
          setReminder({
            is_enabled: false,
            remind_at: taskToEdit.due_date || '',
            recurrence_type: 'once',
            custom_interval_minutes: null,
          });
        }
      });
    } else {
      setTitle(initialValues?.title || '');
      setDescription(initialValues?.description || '');
      setPersonName(initialValues?.person_name || '');
      setPriority(initialValues?.priority || 'medium');
      setStatus(initialValues?.status || 'pending');
      setDueDate(initialValues?.due_date ? formatInputDate(initialValues.due_date) : '');
      setInitialNote(initialValues?.initialNote || '');
      setSelectedFiles([]);
      const defaultScope: TaskScope = isEnterpriseMode ? 'workplace' : 'personal';
      setScope(defaultScope);
      const defaultOrg = defaultScope === 'workplace' ? (initialValues?.org_id || currentOrg?.id || availableOrgs[0]?.id || '') : '';
      setSelectedOrgId(defaultOrg);
      const defaultSite = initialValues?.site_id || selectedSite?.id || (sites.length === 1 ? sites[0].id : '');
      setSelectedSiteId(defaultSite);
      setSelectedEmployeeId(initialValues?.assigned_employee_id || '');
      setReminder({
        is_enabled: false,
        remind_at: initialValues?.due_date ? new Date(initialValues.due_date).toISOString() : '',
        recurrence_type: 'once',
        custom_interval_minutes: null,
      });
    }
  }, [taskToEdit, initialValues, isOpen, currentOrg]);

  const handleAddFile = (file: File) => {
    setSelectedFiles((prev) => [...prev, file]);
  };

  const handleAddFiles = (files: File[]) => {
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuickAddEmployee = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!quickName.trim()) {
      showToast('Employee name is required.', 'error');
      return;
    }
    const targetOrgId = selectedOrgId || currentOrg?.id;
    if (!targetOrgId) {
      showToast('Please choose an organization first.', 'error');
      return;
    }

    setIsCreatingEmp(true);
    try {
      const created = await quickCreateEmployee(
        targetOrgId,
        quickName.trim(),
        quickDesignation.trim() || 'Team Member'
      );
      showToast(`Added ${created.first_name} to employee directory!`, 'success');
      const updatedList = await getOrgEmployees(targetOrgId);
      setEmployees(updatedList);
      setSelectedEmployeeId(created.id);
      setPersonName(`${created.first_name} ${created.last_name || ''}`.trim());
      setIsQuickAddOpen(false);
      setQuickName('');
    } catch (err: any) {
      showToast(err.message || 'Failed to add employee.', 'error');
    } finally {
      setIsCreatingEmp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Task title is required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const activeOrgId = scope === 'workplace'
        ? (selectedOrgId || currentOrg?.id || availableOrgs[0]?.id || null)
        : null;

      if (scope === 'workplace' && !activeOrgId) {
        showToast('Please choose or create an organization before creating workplace tasks.', 'error');
        setIsSubmitting(false);
        return;
      }

      const selectedEmp = employees.find((emp) => emp.id === selectedEmployeeId);
      const effectivePersonName = scope === 'workplace' && selectedEmp
        ? `${selectedEmp.first_name} ${selectedEmp.last_name || ''}`.trim()
        : personName.trim();

      if (isEditing && taskToEdit) {
        // Update existing task
        const updated = await updateTask(taskToEdit.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          person_name: effectivePersonName || undefined,
          priority,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          scope,
          org_id: activeOrgId,
          site_id: scope === 'workplace' ? (selectedSiteId || null) : null,
          assigned_employee_id: scope === 'workplace' ? (selectedEmployeeId || null) : null,
          assigned_to: scope === 'workplace' ? (selectedEmp?.user_id || null) : null,
        });

        // Upload any newly selected files for this task
        const uploadErrors: string[] = [];
        for (const file of selectedFiles) {
          try {
            await uploadAttachment(updated.id, file, currentUser);
          } catch (fileErr: any) {
            console.warn(`Could not upload ${file.name}:`, fileErr);
            uploadErrors.push(file.name);
          }
        }

        if (uploadErrors.length > 0) {
          showToast(`Task updated, but ${uploadErrors.length} file(s) failed to upload: ${uploadErrors.join(', ')}`, 'warning');
        } else {
          showToast(`Task "${updated.title}" updated successfully.`, 'success');
        }

        // Save reminder if configured
        if (reminder.is_enabled) {
          try {
            await saveTaskReminder(updated.id, reminder);
          } catch (remErr) {
            console.warn('Could not save reminder:', remErr);
          }
        }

        triggerRefresh();
        onSuccess?.(updated);
        onClose();
      } else {
        // Create new task
        const created = await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          person_name: effectivePersonName || undefined,
          priority,
          status,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          created_by: currentUser,
          initialNote: initialNote.trim() || undefined,
          scope,
          org_id: activeOrgId,
          site_id: scope === 'workplace' ? (selectedSiteId || null) : null,
          assigned_employee_id: scope === 'workplace' ? (selectedEmployeeId || null) : null,
          assigned_to: scope === 'workplace' ? (selectedEmp?.user_id || null) : null,
        });

        // Upload any attached files
        const uploadErrors: string[] = [];
        for (const file of selectedFiles) {
          try {
            await uploadAttachment(created.id, file, currentUser);
          } catch (fileErr: any) {
            console.warn(`Could not upload ${file.name}:`, fileErr);
            uploadErrors.push(file.name);
          }
        }

        if (uploadErrors.length > 0) {
          showToast(`Task created, but ${uploadErrors.length} file(s) failed to upload: ${uploadErrors.join(', ')}`, 'warning');
        } else {
          showToast(`Task "${created.title}" created successfully!`, 'success');
        }

        // Save reminder if configured
        if (reminder.is_enabled) {
          try {
            await saveTaskReminder(created.id, reminder);
          } catch (remErr) {
            console.warn('Could not save reminder:', remErr);
          }
        }

        triggerRefresh();
        onSuccess?.(created);
        onClose();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save task. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Task' : 'Create New Task'}
      subtitle={isEditing ? 'Update task details' : 'Add any task or work to track'}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ✨ AI Super-Powers: Voice-to-Task & PDF Document Import Card */}
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10 border border-violet-200 dark:border-violet-900/60 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                    ✨ AI स्मार्ट असिस्टंट
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                    Gemini AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  टाईप न करता मराठीत बोलून किंवा PDF फाईल अपलोड करून सेकंदात टास्क भरा
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 🎙️ Voice-to-Task Button */}
            <button
              type="button"
              disabled={isAiParsing}
              onClick={isListening ? stopListening : startListening}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all transform active:scale-95 shadow-xs ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-300 dark:ring-rose-950'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/50'
              } disabled:opacity-50`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4 text-white" />
                  <span>🎙️ ऐकत आहे... (थांबवण्यासाठी क्लिक करा)</span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  <span>🎙️ बोलून टास्क भरा (मराठी)</span>
                </>
              )}
            </button>

            {/* 📄 PDF Import Button */}
            <div>
              <input
                type="file"
                ref={aiFileInputRef}
                onChange={handleAiFileUpload}
                accept=".pdf,application/pdf,image/*"
                className="hidden"
              />
              <button
                type="button"
                disabled={isAiParsing || isListening}
                onClick={() => aiFileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isAiParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>AI विश्लेषण करत आहे...</span>
                  </>
                ) : (
                  <>
                    <FileUp className="w-3.5 h-3.5" />
                    <span>📄 PDF Import करा</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Strictly Isolated Space Indicator */}
        {scope === 'workplace' ? (
          <div className="flex items-center justify-between p-3 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900/60">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  Workplace Task
                </p>
                <p className="text-[10px] text-indigo-700/80 dark:text-indigo-400">
                  Organization task collaboration & team assignment
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
              Workplace Only
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-blue-50/80 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  Personal Task
                </p>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-400">
                  Private task visible strictly to you
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/30 uppercase tracking-wider">
              Personal Only
            </span>
          </div>
        )}

        {/* Organization Selector (When workplace scope is active) */}
        {scope === 'workplace' && (
          <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 rounded-2xl border border-purple-200 dark:border-purple-900/60 space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                Target Organization Workplace <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-purple-500 dark:text-purple-400 font-semibold">
                {availableOrgs.length} available
              </span>
            </div>
            <select
              value={selectedOrgId || currentOrg?.id || availableOrgs[0]?.id || ''}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedOrgId(newId);
                setSelectedEmployeeId('');
              }}
              className="w-full rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-purple-950 dark:text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {availableOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.trade_name || org.legal_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Site Selector (When in Workplace Scope) */}
        {scope === 'workplace' && sites && sites.length > 0 && (
          <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                कामाची साईट / लोकेशन (Site)
              </label>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold">
                {sites.length} {sites.length === 1 ? 'साईट नियुक्त' : 'साईट्स उपलब्ध'}
              </span>
            </div>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-indigo-950 dark:text-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(isPlatformAdmin || isAdmin || isOwner) ? (
                <option value="">सर्व साईट्स / सामान्य (All Sites / General)</option>
              ) : sites.length === 0 ? (
                <option value="">कोणतीही साईट नियुक्त नाही (No site assigned)</option>
              ) : null}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title (Required) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Task Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Description / Details
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add any context, specifications, or instructions..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Grid: Pending With, Priority, Due Date, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Pending With / Assigned To */}
          <div>
            {scope === 'personal' ? (
              <>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Person / Pending With
                </label>
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="e.g. Self, Ramesh, Bank"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                    Assigned Employee (Directory)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                    className="text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>{isQuickAddOpen ? 'Cancel' : '+ Quick Add'}</span>
                  </button>
                </div>

                {isQuickAddOpen ? (
                  <div className="p-2.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
                    <input
                      type="text"
                      placeholder="New Employee Name *"
                      value={quickName}
                      onChange={(e) => setQuickName(e.target.value)}
                      className="w-full p-2 text-xs rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Designation"
                        value={quickDesignation}
                        onChange={(e) => setQuickDesignation(e.target.value)}
                        className="flex-1 p-2 text-xs rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                      />
                      <Button
                        size="sm"
                        type="button"
                        onClick={handleQuickAddEmployee}
                        isLoading={isCreatingEmp}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      const empId = e.target.value;
                      setSelectedEmployeeId(empId);
                      const emp = employees.find((m) => m.id === empId);
                      if (emp) {
                        setPersonName(`${emp.first_name} ${emp.last_name || ''}`.trim());
                      } else {
                        setPersonName('');
                      }
                    }}
                    className="w-full rounded-xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">-- Unassigned (General Workplace Task) --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name || ''} ({emp.designation})
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Initial Status (only for creation) */}
          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="pending">Pending (Default)</option>
                <option value="in_progress">In Progress</option>
                <option value="partial">Partial</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
        </div>

        {/* Initial Note (only for new tasks) */}
        {!isEditing && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Initial Note / Remark (Optional)
            </label>
            <input
              type="text"
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="e.g. Initial conversation held today..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* File Attachments Zone */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Attach Supporting Documents (Optional)</span>
          </label>

          <FileUploadZone onFileSelect={handleAddFile} onFilesSelect={handleAddFiles} />

          {/* Staged files list */}
          {selectedFiles.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {selectedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg"
                    title="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Smart Reminder Configuration */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <ReminderControls
            value={reminder}
            onChange={setReminder}
            defaultTime={dueDate ? new Date(dueDate).toISOString() : null}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button size="sm" type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
