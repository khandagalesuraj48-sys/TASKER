import React, { useState, useEffect } from 'react';
import { Users, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { FamilyEntity, FamilyEntityType } from '../types/family';
import { getFamilyEntities, createFamilyEntity, updateFamilyEntity, deleteFamilyEntity } from '../services/familyService';
import { useToast } from '../context/ToastContext';

export const FamilyPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [entities, setEntities] = useState<FamilyEntity[]>([]);
  const [activeTab, setActiveTab] = useState<FamilyEntityType>('chore');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [quantity, setQuantity] = useState('');

  const loadData = async () => {
    if (!currentWorkspace) return;
    const data = await getFamilyEntities(currentWorkspace.id);
    setEntities(data);
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !title.trim()) return;

    await createFamilyEntity({
      workspace_id: currentWorkspace.id,
      title: title.trim(),
      entity_type: activeTab,
      assigned_to: assignedTo.trim() || null,
      quantity: quantity.trim() || null,
      status: 'pending',
      priority: 'medium',
    });

    showToast('Added to family list', 'success');
    setIsModalOpen(false);
    setTitle('');
    setAssignedTo('');
    setQuantity('');
    loadData();
  };

  const handleToggle = async (item: FamilyEntity) => {
    const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
    await updateFamilyEntity(item.id, { status: nextStatus });
    loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteFamilyEntity(id);
    loadData();
  };

  const filtered = entities.filter((e) => e.entity_type === activeTab);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <span>Family & Home Operations</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Coordinate household chores, grocery shopping, school homework, and medicine schedules.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('chore')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'chore'
              ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>🧹 Chores & Cleaning</span>
        </button>
        <button
          onClick={() => setActiveTab('grocery')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'grocery'
              ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>🛒 Groceries & Supplies</span>
        </button>
        <button
          onClick={() => setActiveTab('homework')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'homework'
              ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>📚 Kids Homework & School</span>
        </button>
        <button
          onClick={() => setActiveTab('medicine')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'medicine'
              ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-600 dark:text-teal-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <span>💊 Medicine Schedule</span>
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No items in this section</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tap 'Add Item' to organize this household list.</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => handleToggle(item)}
                  className="text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  {item.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div>
                  <span className={`text-xs font-bold ${
                    item.status === 'completed'
                      ? 'line-through text-slate-400 dark:text-slate-600'
                      : 'text-slate-900 dark:text-white'
                  }`}>
                    {item.title}
                  </span>
                  {(item.assigned_to || item.quantity) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {item.assigned_to && <span>Assigned: {item.assigned_to} </span>}
                      {item.quantity && <span>({item.quantity})</span>}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDelete(item.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Family Item</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Item Title *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    activeTab === 'grocery'
                      ? 'e.g. Atta 10kg, Mustard Oil 1L'
                      : activeTab === 'medicine'
                      ? 'e.g. BP tablet after dinner'
                      : 'e.g. Math homework Chapter 4'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Family Member</label>
                <input
                  type="text"
                  placeholder="e.g. Mom, Rahul, Priya"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {activeTab === 'grocery' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Quantity / Unit</label>
                  <input
                    type="text"
                    placeholder="e.g. 2 kg, 1 packet"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              )}

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
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
