import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Mail, Phone, ShieldCheck } from 'lucide-react';
import { useEnterprise } from '../context/EnterpriseContext';
import { useToast } from '../context/ToastContext';
import { getOrgEmployees, createOrgEmployee } from '../services/enterpriseService';
import { ErpEmployee } from '../types/enterprise';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Modal } from '../components/common/Modal';

export const EmployeeDirectoryPage: React.FC = () => {
  const { currentOrg, isAdmin } = useEnterprise();
  const { showToast } = useToast();

  const [employees, setEmployees] = useState<ErpEmployee[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Employee Modal
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [designation, setDesignation] = useState<string>('Team Member');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadEmployees = async () => {
    if (!currentOrg?.id) return;
    setIsLoading(true);
    try {
      const list = await getOrgEmployees(currentOrg.id);
      setEmployees(list);
    } catch (err) {
      console.error('Error loading employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [currentOrg?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Only organization administrators can add employees to the directory.', 'error');
      return;
    }
    if (!currentOrg?.id || !firstName.trim() || !designation.trim()) {
      showToast('Name and designation are required.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await createOrgEmployee(currentOrg.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        designation: designation.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      showToast('Employee added to directory.', 'success');
      setAddModalOpen(false);
      setFirstName('');
      setLastName('');
      setDesignation('Team Member');
      setPhone('');
      setEmail('');
      loadEmployees();
    } catch (err: any) {
      showToast(err.message || 'Failed to add employee.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = employees.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = `${e.first_name} ${e.last_name || ''}`.toLowerCase();
    return name.includes(q) || e.designation.toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl bg-card border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>Organization Directory</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mt-1">
            Employee Directory
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentOrg?.legal_name || 'Organization'} — Staff & Team Members ({employees.length})
          </p>
        </div>

        {isAdmin ? (
          <Button
            onClick={() => setAddModalOpen(true)}
            className="h-8 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Employee
          </Button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-xs font-medium text-muted-foreground border border-border">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <span>Admin Managed</span>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2.5 bg-card px-3.5 py-2 rounded-lg border border-border shadow-xs max-w-md">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Search by name, role, email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent focus:outline-hidden text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Directory Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-32 bg-muted rounded-xl"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16 border border-border bg-card shadow-xs">
          <CardContent className="space-y-2">
            <Users className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No Employees Found</h3>
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? 'Click "+ Add Employee" to add a team member to the directory.'
                : 'No employees have been added to the directory by the administrator yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <Card
              key={emp.id}
              className="rounded-xl border border-border bg-card shadow-xs hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                      {emp.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {emp.first_name} {emp.last_name || ''}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">{emp.designation}</p>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                    {emp.employee_code}
                  </Badge>
                </div>

                <div className="pt-2 border-t border-border/60 text-xs space-y-1.5 text-muted-foreground">
                  {emp.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className={emp.user_id ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground italic'}>
                      {emp.user_id ? 'Linked TASKER Account' : 'Directory Record'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Employee to Directory">
        <form onSubmit={handleCreate} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Ramesh"
                className="w-full text-xs p-2 rounded-lg border border-border bg-card text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Shinde"
                className="w-full text-xs p-2 rounded-lg border border-border bg-card text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Designation *</label>
            <input
              type="text"
              required
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Site Supervisor / Engineer"
              className="w-full text-xs p-2 rounded-lg border border-border bg-card text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full text-xs p-2 rounded-lg border border-border bg-card text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@example.com"
                className="w-full text-xs p-2 rounded-lg border border-border bg-card text-foreground"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add to Directory'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
