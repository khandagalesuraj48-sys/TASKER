import React, { useState } from 'react';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { PRESET_TEMPLATES, instantiateTemplate } from '../services/templateService';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export const TemplatesPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loadingTmplId, setLoadingTmplId] = useState<string | null>(null);

  const handleApply = async (tmpl: typeof PRESET_TEMPLATES[0]) => {
    if (!currentWorkspace) return;
    try {
      setLoadingTmplId(tmpl.id);
      const count = await instantiateTemplate(tmpl, currentWorkspace.id);
      showToast(`Added ${count} tasks from '${tmpl.title}' to your workspace!`, 'success');
      navigate('/tasks');
    } catch (e) {
      showToast('Could not instantiate checklist', 'error');
    } finally {
      setLoadingTmplId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-500" />
          <span>Indian Life & Business Checklists</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Battle-tested action plans for festivals, tax filings, travel, shifting, and onboarding.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {PRESET_TEMPLATES.map((tmpl) => (
          <div
            key={tmpl.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{tmpl.icon}</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{tmpl.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{tmpl.description}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Included Tasks ({tmpl.items.length})</p>
                <div className="space-y-1.5">
                  {tmpl.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleApply(tmpl)}
              disabled={loadingTmplId === tmpl.id}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              <span>{loadingTmplId === tmpl.id ? 'Adding to Tasks...' : 'Use This Checklist'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
