import { ChecklistTemplate } from '../types/template';
import { createTask } from './taskService';

export const PRESET_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'tmpl_diwali',
    title: 'Diwali Preparation Checklist',
    category: 'diwali',
    description: 'Complete home deep cleaning, sweets order, lighting, gifts and puja essentials',
    icon: '🪔',
    is_preset: true,
    created_at: new Date().toISOString(),
    items: [
      { id: '1', title: 'Deep clean living room and kitchen', priority: 'high', estimated_minutes: 180, offset_days: -7 },
      { id: '2', title: 'Order/prepare traditional sweets and snacks', priority: 'medium', estimated_minutes: 60, offset_days: -4 },
      { id: '3', title: 'Buy diyas, lights, rangoli colors and candles', priority: 'high', estimated_minutes: 45, offset_days: -3 },
      { id: '4', title: 'Shop for Diwali gifts and distribution list', priority: 'medium', estimated_minutes: 90, offset_days: -2 },
      { id: '5', title: 'Laxmi Puja samagri arrangement', priority: 'urgent', estimated_minutes: 30, offset_days: 0 },
    ],
  },
  {
    id: 'tmpl_gst',
    title: 'Monthly GST Filing Checklist',
    category: 'gst',
    description: 'Ensure accurate sales and purchase reconciliation before the 11th and 20th',
    icon: '📊',
    is_preset: true,
    created_at: new Date().toISOString(),
    items: [
      { id: '1', title: 'Reconcile sales register with invoices issued', priority: 'high', estimated_minutes: 60, offset_days: -5 },
      { id: '2', title: 'Collect vendor purchase invoices for ITC match', priority: 'high', estimated_minutes: 90, offset_days: -3 },
      { id: '3', title: 'File GSTR-1 by 11th of month', priority: 'urgent', estimated_minutes: 45, offset_days: 0 },
      { id: '4', title: 'Download GSTR-2B and verify ITC claims', priority: 'high', estimated_minutes: 45, offset_days: 4 },
      { id: '5', title: 'File GSTR-3B and pay liability by 20th', priority: 'urgent', estimated_minutes: 45, offset_days: 9 },
    ],
  },
  {
    id: 'tmpl_travel',
    title: 'India Family Travel & Packing',
    category: 'travel',
    description: 'Stress-free domestic vacation, pilgrimage or wedding travel checklist',
    icon: '✈️',
    is_preset: true,
    created_at: new Date().toISOString(),
    items: [
      { id: '1', title: 'Check train/flight PNR status and web check-in', priority: 'urgent', estimated_minutes: 20, offset_days: -1 },
      { id: '2', title: 'Pack medications (ORS, first aid, prescriptions)', priority: 'high', estimated_minutes: 30, offset_days: -1 },
      { id: '3', title: 'Download offline Google Maps and ID proofs', priority: 'medium', estimated_minutes: 15, offset_days: -1 },
      { id: '4', title: 'Pack power banks, chargers and universal adapters', priority: 'medium', estimated_minutes: 20, offset_days: 0 },
      { id: '5', title: 'Turn off home gas cylinder and water mains', priority: 'urgent', estimated_minutes: 10, offset_days: 0 },
    ],
  },
  {
    id: 'tmpl_shifting',
    title: 'House Shifting & Relocation',
    category: 'shifting',
    description: 'Step-by-step checklist for packers, movers and utility transfers',
    icon: '📦',
    is_preset: true,
    created_at: new Date().toISOString(),
    items: [
      { id: '1', title: 'Get quotes from 3 verified Packers & Movers', priority: 'high', estimated_minutes: 60, offset_days: -14 },
      { id: '2', title: 'Discard/donate unused furniture and clutter', priority: 'medium', estimated_minutes: 120, offset_days: -10 },
      { id: '3', title: 'Apply for broadband and gas connection transfer', priority: 'high', estimated_minutes: 45, offset_days: -5 },
      { id: '4', title: 'Pack critical documents, jewelry and cash separately', priority: 'urgent', estimated_minutes: 60, offset_days: -1 },
      { id: '5', title: 'Supervise loading and record inventory checklist', priority: 'urgent', estimated_minutes: 240, offset_days: 0 },
    ],
  },
  {
    id: 'tmpl_onboarding',
    title: 'Staff / Contractor Onboarding',
    category: 'onboarding',
    description: 'Official verification and workplace setup for new hires',
    icon: '🤝',
    is_preset: true,
    created_at: new Date().toISOString(),
    items: [
      { id: '1', title: 'Collect Aadhaar, PAN and Bank details', priority: 'urgent', estimated_minutes: 20, offset_days: 0 },
      { id: '2', title: 'Sign employment agreement / NDA', priority: 'high', estimated_minutes: 30, offset_days: 0 },
      { id: '3', title: 'Create email and internal tool accounts', priority: 'medium', estimated_minutes: 30, offset_days: 1 },
      { id: '4', title: 'First-week goal alignment and walkthrough', priority: 'medium', estimated_minutes: 60, offset_days: 2 },
    ],
  },
];

export const instantiateTemplate = async (
  template: ChecklistTemplate,
  workspaceId: string
): Promise<number> => {
  let createdCount = 0;
  const now = new Date();

  for (const item of template.items) {
    const dueDate = new Date();
    dueDate.setDate(now.getDate() + (item.offset_days || 0));

    await createTask({
      title: item.title,
      priority: item.priority,
      status: 'pending',
      due_date: dueDate.toISOString(),
      workspace_id: workspaceId,
      estimated_minutes: item.estimated_minutes || 30,
      tags: [template.category],
    });
    createdCount++;
  }

  return createdCount;
};
