import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Phone, Building, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { PersonContact, PersonType } from '../types/business';
import { getPeople, createPerson, deletePerson } from '../services/businessService';
import { useToast } from '../context/ToastContext';

export const BusinessPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [people, setPeople] = useState<PersonContact[]>([]);
  const [activeTab, setActiveTab] = useState<PersonType>('client');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [balance, setBalance] = useState('');

  const loadData = async () => {
    if (!currentWorkspace) return;
    const data = await getPeople(currentWorkspace.id);
    setPeople(data);
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !name.trim()) return;

    await createPerson({
      workspace_id: currentWorkspace.id,
      name: name.trim(),
      person_type: activeTab,
      company: company.trim() || null,
      phone: phone.trim() || null,
      gstin: gstin.trim() || null,
      balance_amount: balance ? parseFloat(balance) : 0,
    });

    showToast('Party added to directory', 'success');
    setIsModalOpen(false);
    setName('');
    setCompany('');
    setPhone('');
    setGstin('');
    setBalance('');
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this contact?')) {
      await deletePerson(id);
      loadData();
    }
  };

  const filtered = people.filter((p) => p.person_type === activeTab);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <span>Business Contacts & Khata</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage clients, vendors, contractors, and outstanding ledger balances.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {(['client', 'vendor', 'contractor', 'staff'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
              activeTab === tab
                ? 'bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab}s
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No {activeTab}s added yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tap 'Add Contact' to maintain this directory.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{item.name}</h3>
                  {item.company && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Building className="w-3 h-3" /> {item.company}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                {item.phone && (
                  <a href={`tel:${item.phone}`} className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline">
                    <Phone className="w-3.5 h-3.5" /> {item.phone}
                  </a>
                )}
                {item.gstin && <p className="font-mono text-[11px] text-slate-500">GSTIN: {item.gstin}</p>}
              </div>

              {item.balance_amount !== undefined && item.balance_amount !== 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Ledger Balance:</span>
                  <span className={`font-black ${item.balance_amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {item.balance_amount > 0 ? `+₹${item.balance_amount.toLocaleString('en-IN')}` : `-₹${Math.abs(item.balance_amount).toLocaleString('en-IN')}`}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">Add {activeTab}</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Person or contact name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Business Name</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="Optional GST"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Initial Balance (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000 (positive: they owe you, negative: you owe them)"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
