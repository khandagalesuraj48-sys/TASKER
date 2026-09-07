import React, { useState, useEffect } from 'react';
import { Package, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { getSiteStock, getGatePasses, createGatePass, getErpItems } from '../services/erpInventoryService';
import { InventoryStock, GatePass, ErpItem } from '../types/enterprise';
import { useToast } from '../context/ToastContext';

export const ErpInventoryPage: React.FC = () => {
  const { currentOrg, selectedSite, sites } = useEnterprise();
  const { showToast } = useToast();
  const [stock, setStock] = useState<InventoryStock[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [items, setItems] = useState<ErpItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [passType, setPassType] = useState<'inward' | 'outward'>('inward');
  const [partyName, setPartyName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState('');

  const loadData = async () => {
    if (!currentOrg) return;
    const st = await getSiteStock(selectedSite ? selectedSite.id : null, currentOrg.id);
    setStock(st);
    const gp = await getGatePasses(selectedSite ? selectedSite.id : null, currentOrg.id);
    setGatePasses(gp);
    const it = await getErpItems(currentOrg.id);
    setItems(it);
  };

  useEffect(() => {
    loadData();
  }, [currentOrg, selectedSite]);

  const handleCreatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !qty || !selectedItemId) return;
    const itemObj = items.find((i) => i.id === selectedItemId);
    if (!itemObj) return;

    const targetSiteId = selectedSite ? selectedSite.id : sites[0]?.id || 'site_worli';

    await createGatePass({
      org_id: currentOrg.id,
      project_id: 'prj_mumbai_metro',
      site_id: targetSiteId,
      type: passType,
      pass_number: (passType === 'inward' ? 'INW-' : 'OUT-') + Date.now().toString().slice(-6),
      party_name: partyName.trim() || 'Vendor Direct',
      vehicle_number: vehicleNo.trim().toUpperCase() || null,
      items: [
        {
          item_id: itemObj.id,
          item_name: itemObj.name,
          qty: parseFloat(qty),
          uom: itemObj.uom,
        },
      ],
      status: 'verified',
    });

    showToast(`${passType === 'inward' ? 'Material Inward (GRN)' : 'Material Outward'} verified and recorded!`, 'success');
    setIsModalOpen(false);
    setPartyName('');
    setVehicleNo('');
    setQty('');
    loadData();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            <span>Site Inventory & Gate Passes</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time material on-hand balances, Inward GRN verification, and Dispatch gate passes.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Gate Pass (GRN)</span>
        </button>
      </div>

      {/* Current Site Stock Balances */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live Stock on Hand</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {stock.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{s.item_name}</span>
                <span className="text-[10px] font-mono text-slate-500 font-bold">{s.sku}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {s.quantity_on_hand.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-semibold text-slate-500">{s.uom}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Rate: ₹{s.valuation_rate}/unit • Total: ₹{(s.quantity_on_hand * s.valuation_rate).toLocaleString('en-IN')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Gate Passes History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Inward & Outward Gate Passes</h3>
        <div className="space-y-2">
          {gatePasses.map((gp) => (
            <div
              key={gp.id}
              className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  gp.type === 'inward'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                    : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                }`}>
                  {gp.type === 'inward' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{gp.pass_number}</span>
                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">
                      {gp.type} • {gp.party_name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {gp.items.map((i) => `${i.item_name} (${i.qty} ${i.uom})`).join(', ')}
                    {gp.vehicle_number && ` • Vehicle: ${gp.vehicle_number}`}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 uppercase">
                {gp.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* New Gate Pass Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Gate Pass (GRN / Dispatch)</h3>
            <form onSubmit={handleCreatePass} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Pass Type</label>
                  <select
                    value={passType}
                    onChange={(e) => setPassType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="inward">Material Inward (GRN)</option>
                    <option value="outward">Material Outward (Dispatch)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Vehicle No</label>
                  <input
                    type="text"
                    placeholder="MH 12 AB 1234"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Party / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. UltraTech Cement"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Material / Item *</label>
                  <select
                    required
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">Select Item</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.uom})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Quantity *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
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
                  Verify & Save Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
