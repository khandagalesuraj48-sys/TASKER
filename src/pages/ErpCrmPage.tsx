import React, { useState, useEffect } from 'react';
import { useEnterprise } from '../context/EnterpriseContext';
import { ErpParty } from '../types/enterprise';
import { getErpParties, createErpParty } from '../services/erpCrmService';
import { Users, Phone, Building, Search, Plus } from 'lucide-react';

export const ErpCrmPage: React.FC = () => {
  const { currentOrg } = useEnterprise();
  const [parties, setParties] = useState<ErpParty[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'vendor' | 'subcontractor'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [partyType, setPartyType] = useState<'customer' | 'vendor' | 'subcontractor'>('vendor');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');

  const loadParties = async () => {
    const data = await getErpParties(filterType === 'all' ? undefined : filterType, currentOrg?.id);
    setParties(data);
  };

  useEffect(() => {
    loadParties();
  }, [filterType, currentOrg]);

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName) return;

    await createErpParty({
      org_id: currentOrg?.id || 'org_enterprise_default',
      legal_name: legalName,
      trade_name: tradeName || null,
      type: partyType,
      gstin: gstin || null,
      pan: pan || null,
      contact_person: contactPerson || null,
      phone: phone || null,
      credit_limit: parseFloat(creditLimit) || 0,
      credit_days: 30,
      balance_amount: parseFloat(openingBalance) || 0,
    });

    setIsAddModalOpen(false);
    setLegalName('');
    setTradeName('');
    setGstin('');
    setPan('');
    setContactPerson('');
    setPhone('');
    setCreditLimit('');
    setOpeningBalance('');
    loadParties();
  };

  const filtered = parties.filter((p) => {
    const matchesSearch =
      p.legal_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.trade_name && p.trade_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.gstin && p.gstin.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const totalReceivables = parties
    .filter((p) => p.type === 'customer' || p.type === 'both')
    .reduce((sum, p) => sum + (p.balance_amount || 0), 0);

  const totalPayables = parties
    .filter((p) => p.type === 'vendor' || p.type === 'subcontractor')
    .reduce((sum, p) => sum + (p.balance_amount || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white">CRM & Commercial Parties</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Vendor payables, customer receivables, GST compliance & credit terms.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Customer / Vendor
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-2xl">
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Total Receivables (Customers)</p>
          <p className="text-2xl font-black text-emerald-900 dark:text-emerald-300 mt-1">
            ₹{totalReceivables.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-4 rounded-2xl">
          <p className="text-xs font-bold text-rose-800 dark:text-rose-400">Total Payables (Vendors & Subs)</p>
          <p className="text-2xl font-black text-rose-900 dark:text-rose-300 mt-1">
            ₹{totalPayables.toLocaleString('en-IN')}
          </p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 p-4 rounded-2xl">
          <p className="text-xs font-bold text-indigo-800 dark:text-indigo-400">Registered Entities</p>
          <p className="text-2xl font-black text-indigo-900 dark:text-indigo-300 mt-1">{parties.length}</p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {(['all', 'vendor', 'customer', 'subcontractor'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                filterType === type
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {type === 'all' ? 'All Parties' : type + 's'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search party by name, GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Parties Roster */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((party) => (
          <div
            key={party.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider mb-2 ${
                      party.type === 'customer'
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                        : party.type === 'vendor'
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                        : 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400'
                    }`}
                  >
                    {party.type}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {party.legal_name}
                  </h3>
                  {party.trade_name && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">({party.trade_name})</p>
                  )}
                </div>
                <Building className="w-5 h-5 text-slate-400 shrink-0" />
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                {party.contact_person && (
                  <p className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Contact:</span>
                    {party.contact_person}
                  </p>
                )}
                {party.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {party.phone}
                  </p>
                )}
                {party.gstin && (
                  <p className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">GSTIN:</span>
                    <span className="font-mono">{party.gstin}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Current Balance</p>
                <p
                  className={`text-base font-black ${
                    (party.balance_amount || 0) > 0
                      ? party.type === 'customer'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500'
                  }`}
                >
                  ₹{(party.balance_amount || 0).toLocaleString('en-IN')}
                </p>
              </div>

              {party.credit_limit > 0 && (
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Credit Limit</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    ₹{party.credit_limit.toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Party Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Register Commercial Party</h3>

            <form onSubmit={handleCreateParty} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Legal Entity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UltraTech Cement Limited"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Trade Name / Brand
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UltraTech"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Type *</label>
                  <select
                    value={partyType}
                    onChange={(e) => setPartyType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="vendor">Vendor / Supplier</option>
                    <option value="customer">Client / Customer</option>
                    <option value="subcontractor">Subcontractor</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="27AAACU9876E1Z2"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">PAN</label>
                  <input
                    type="text"
                    placeholder="AAACU9876E"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="Key Person Name"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="Mobile / Office"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Opening Balance (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20"
                >
                  Save Party
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ErpCrmPage;
