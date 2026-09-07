import React, { useState, useEffect } from 'react';
import { FileBadge, Plus, Shield, Calendar, Trash2, Lock } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { PersonalDocument, PersonalDocType } from '../types/document';
import { getDocuments, createDocument, deleteDocument } from '../services/documentService';
import { maskSensitiveNumber } from '../services/privacyService';
import { useToast } from '../context/ToastContext';

export const DocumentsPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<PersonalDocument[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<PersonalDocType>('aadhaar');
  const [holderName, setHolderName] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const loadData = async () => {
    if (!currentWorkspace) return;
    const data = await getDocuments(currentWorkspace.id);
    setDocs(data);
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !title.trim() || !holderName.trim()) return;

    await createDocument({
      workspace_id: currentWorkspace.id,
      title: title.trim(),
      doc_type: docType,
      holder_name: holderName.trim(),
      document_number_masked: docNumber ? maskSensitiveNumber(docNumber, 4) : null,
      expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
      reminder_days_before: 30,
    });

    showToast('Document record saved securely', 'success');
    setIsModalOpen(false);
    setTitle('');
    setHolderName('');
    setDocNumber('');
    setExpiryDate('');
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this document entry?')) {
      await deleteDocument(id);
      showToast('Document deleted', 'info');
      loadData();
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <FileBadge className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Document Expiry & Vault</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Store metadata and renewal dates for Aadhaar, PAN, Passports, Driving Licenses with DPDP compliance.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Document</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Shield className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No documents stored</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Keep track of passport & license expiry dates safely.</p>
          </div>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      {doc.doc_type.replace('_', ' ')}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">{doc.title}</h3>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Holder: <strong>{doc.holder_name}</strong>
                </p>

                {doc.document_number_masked && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg w-fit">
                    <Lock className="w-3 h-3 text-slate-400" />
                    <span>{doc.document_number_masked}</span>
                  </div>
                )}
              </div>

              {doc.expiry_date && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Expiry:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {new Date(doc.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Document Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Personal Document</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Dad's Passport, My Driving License"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Doc Type</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as PersonalDocType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="aadhaar">Aadhaar Card</option>
                    <option value="pan">PAN Card</option>
                    <option value="passport">Passport</option>
                    <option value="driving_license">Driving License</option>
                    <option value="voter_id">Voter ID</option>
                    <option value="ration_card">Ration Card</option>
                    <option value="property">Property / Agreement</option>
                    <option value="medical">Medical / Insurance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Holder Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Name on card"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Doc Number (Masked)</label>
                  <input
                    type="text"
                    placeholder="XXXX-XXXX-1234"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
