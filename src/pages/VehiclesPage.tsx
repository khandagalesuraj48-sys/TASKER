import React, { useState, useEffect } from 'react';
import { Car, Plus, FileText, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Vehicle, VehicleDocType, VehicleType } from '../types/vehicle';
import {
  getVehicles,
  createVehicle,
  addVehicleDocument,
  deleteVehicle,
  deleteVehicleDocument,
} from '../services/vehicleService';
import { useToast } from '../context/ToastContext';

export const VehiclesPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedVehicleForDoc, setSelectedVehicleForDoc] = useState<Vehicle | null>(null);

  // New vehicle form
  const [name, setName] = useState('');
  const [regNum, setRegNum] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('two_wheeler');
  const [fuelType, setFuelType] = useState<'petrol' | 'diesel' | 'cng' | 'electric'>('petrol');

  // New doc form
  const [docType, setDocType] = useState<VehicleDocType>('puc');
  const [docNumber, setDocNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    if (!currentWorkspace) return;
    const data = await getVehicles(currentWorkspace.id);
    setVehicles(data);
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace]);

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !name.trim() || !regNum.trim()) return;

    await createVehicle({
      workspace_id: currentWorkspace.id,
      name: name.trim(),
      registration_number: regNum.trim().toUpperCase(),
      vehicle_type: vehicleType,
      fuel_type: fuelType,
    });

    showToast('Vehicle added successfully', 'success');
    setIsVehicleModalOpen(false);
    setName('');
    setRegNum('');
    loadData();
  };

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleForDoc || !expiryDate) return;

    await addVehicleDocument({
      vehicle_id: selectedVehicleForDoc.id,
      doc_type: docType,
      document_number: docNumber.trim() || null,
      expiry_date: new Date(expiryDate).toISOString(),
    });

    showToast('Document expiry recorded', 'success');
    setSelectedVehicleForDoc(null);
    setDocNumber('');
    loadData();
  };

  const handleDeleteVehicle = async (id: string) => {
    if (confirm('Are you sure you want to remove this vehicle?')) {
      await deleteVehicle(id);
      showToast('Vehicle removed', 'info');
      loadData();
    }
  };

  const getDocStatus = (expiry: string) => {
    const now = new Date();
    const exp = new Date(expiry);
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Expired', color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60' };
    if (diffDays <= 15) return { label: `Expiring in ${diffDays}d`, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60' };
    return { label: 'Valid', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60' };
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Vehicles & PUC Expiry Hub</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Never miss PUC, Insurance, or Fitness renewals. Automated reminders before deadlines.
          </p>
        </div>
        <button
          onClick={() => setIsVehicleModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Vehicle</span>
        </button>
      </div>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicles.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Car className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No vehicles added yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Add your scooter, bike, or car to track PUC & Insurance.</p>
          </div>
        ) : (
          vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{v.name}</h3>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono px-2 py-0.5 rounded-md font-bold uppercase">
                      {v.registration_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">
                    {v.vehicle_type.replace('_', ' ')} • {v.fuel_type}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteVehicle(v.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Documents Status */}
              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Renewals & Compliance</span>
                  <button
                    onClick={() => setSelectedVehicleForDoc(v)}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Expiry</span>
                  </button>
                </div>

                {v.documents && v.documents.length > 0 ? (
                  <div className="space-y-1.5">
                    {v.documents.map((doc) => {
                      const st = getDocStatus(doc.expiry_date);
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold uppercase text-slate-900 dark:text-white">
                              {doc.doc_type}
                            </span>
                            {doc.document_number && (
                              <span className="text-[10px] text-slate-500 font-mono">({doc.document_number})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${st.color}`}>
                              {st.label} ({new Date(doc.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                            </span>
                            <button
                              onClick={async () => {
                                await deleteVehicleDocument(doc.id);
                                loadData();
                              }}
                              className="text-slate-400 hover:text-rose-500 p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No expiry documents added yet.</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Vehicle Modal */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Vehicle</h3>
            <form onSubmit={handleCreateVehicle} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Vehicle Nickname *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Activa 6G, Honda City"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Registration Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MH 12 AB 1234"
                  value={regNum}
                  onChange={(e) => setRegNum(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="two_wheeler">Two Wheeler (Bike / Scooter)</option>
                    <option value="four_wheeler">Four Wheeler (Car / SUV)</option>
                    <option value="commercial">Commercial Vehicle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fuel Type</label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="cng">CNG</option>
                    <option value="electric">Electric (EV)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Document Expiry Modal */}
      {selectedVehicleForDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Renewal / Expiry</h3>
            <p className="text-xs text-slate-500">Add document details for {selectedVehicleForDoc.name}</p>

            <form onSubmit={handleAddDoc} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as VehicleDocType)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="puc">PUC (Pollution Under Control)</option>
                  <option value="insurance">Insurance Policy</option>
                  <option value="fitness">Fitness Certificate</option>
                  <option value="rc">Registration Certificate (RC)</option>
                  <option value="service">Scheduled Service</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Policy / Cert Number</label>
                <input
                  type="text"
                  placeholder="Optional"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVehicleForDoc(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Save Expiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
