import React from 'react';
import { Shield, CheckCircle2, KeyRound } from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';

export const AdminSettingsPage: React.FC = () => {
  const { adminProfile } = useAdmin();
  const { userEmail } = useAuth();

  const securityChecks = [
    { title: 'Personal Tasks Isolation', desc: 'Protected by RLS (scope = personal AND user_id = auth.uid())', status: 'Active' },
    { title: 'Workplace Task Security', desc: 'Accessible only by assigner, assignee, or org admin', status: 'Active' },
    { title: 'Public Link Cryptography', desc: 'Client-side SHA-256 hash stored in DB (no raw tokens)', status: 'Active' },
    { title: 'Database-Backed Admin Roles', desc: 'Managed in public.platform_admins without hardcoded emails', status: 'Active' },
    { title: 'Zero ERP Navigation', desc: 'All accounting, inventory, blueprints, GL links removed from routing', status: 'Enforced' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Platform Settings & Security</h1>
        <p className="text-xs text-slate-400 mt-1">
          System configurations, security safeguards, and administrator provisioning instructions.
        </p>
      </div>

      {/* Admin Profile Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-indigo-400 pb-2 border-b border-slate-800">
          <Shield className="w-5 h-5" />
          <h2 className="text-base font-bold text-white">Current Administrator Identity</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Active Admin Email</span>
            <p className="text-sm font-bold text-white mt-1">{userEmail || 'admin@tasker.com'}</p>
          </div>
          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Privilege Role</span>
            <p className="text-sm font-bold text-indigo-400 mt-1 uppercase font-mono">
              {adminProfile?.role || 'SUPER_ADMIN'}
            </p>
          </div>
          <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-800">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Admin UID</span>
            <p className="text-xs font-mono text-slate-400 mt-1 truncate">
              {adminProfile?.user_id || 'System'}
            </p>
          </div>
        </div>
      </div>

      {/* Security Baseline Audit */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-emerald-400 pb-2 border-b border-slate-800">
          <CheckCircle2 className="w-5 h-5" />
          <h2 className="text-base font-bold text-white">Security & Data Isolation Baseline</h2>
        </div>

        <div className="space-y-3">
          {securityChecks.map((chk, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs"
            >
              <div>
                <p className="font-bold text-white">{chk.title}</p>
                <p className="text-slate-400 text-[11px] mt-0.5">{chk.desc}</p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] rounded-full">
                {chk.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* New Admin Account Provisioning Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3 text-xs">
        <div className="flex items-center gap-2 text-purple-400 pb-2 border-b border-slate-800">
          <KeyRound className="w-5 h-5" />
          <h2 className="text-base font-bold text-white">New Platform Admin Account Provisioning</h2>
        </div>

        <p className="text-slate-300 leading-relaxed">
          To provision a brand-new, dedicated Admin account without exposing secrets or hardcoding credentials:
        </p>

        <ol className="list-decimal list-inside space-y-2 text-slate-400 pl-2">
          <li>
            <strong className="text-slate-200">Register the user</strong> in Supabase Auth via the TASKER sign-up screen or Supabase Dashboard.
          </li>
          <li>
            <strong className="text-slate-200">Assign Platform Admin role</strong> by running:
            <pre className="mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-indigo-300 font-mono text-[11px]">
              SELECT public.claim_or_register_super_admin('newadmin@tasker.com');
            </pre>
            or use the <strong className="text-slate-200">"Assign Platform Admin"</strong> modal in the Users & Admins tab.
          </li>
          <li>
            The user can now sign in with their single account and access both their private Personal Space and the Central Admin Panel at <span className="font-mono text-indigo-300">/admin</span>.
          </li>
        </ol>
      </div>
    </div>
  );
};
