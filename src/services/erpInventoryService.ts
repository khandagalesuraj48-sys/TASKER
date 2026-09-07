import { ErpItem, InventoryStock, GatePass } from '../types/enterprise';
import { OfflineSyncService } from './offlineSyncService';

const DEFAULT_ITEMS: ErpItem[] = [
  {
    id: 'item_cement',
    org_id: 'org_enterprise_default',
    sku: 'CEM-OPC-53',
    name: 'UltraTech OPC 53 Grade Cement',
    hsn_sac: '252329',
    uom: 'Bags',
    category: 'Cement & Binding',
    standard_rate: 380,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_steel',
    org_id: 'org_enterprise_default',
    sku: 'STL-TMT-12',
    name: 'Tata Tiscon 12mm TMT Steel Rebars',
    hsn_sac: '721420',
    uom: 'MT',
    category: 'Steel & Metals',
    standard_rate: 62000,
    created_at: new Date().toISOString(),
  },
  {
    id: 'item_sand',
    org_id: 'org_enterprise_default',
    sku: 'AGG-M-SAND',
    name: 'Crushed M-Sand (Fine Aggregate)',
    hsn_sac: '250590',
    uom: 'Brass',
    category: 'Aggregates',
    standard_rate: 4200,
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_STOCK: InventoryStock[] = [
  {
    id: 'stk_worli_cement',
    org_id: 'org_enterprise_default',
    site_id: 'site_worli',
    item_id: 'item_cement',
    item_name: 'UltraTech OPC 53 Grade Cement',
    sku: 'CEM-OPC-53',
    uom: 'Bags',
    quantity_on_hand: 850,
    valuation_rate: 380,
    updated_at: new Date().toISOString(),
  },
  {
    id: 'stk_worli_steel',
    org_id: 'org_enterprise_default',
    site_id: 'site_worli',
    item_id: 'item_steel',
    item_name: 'Tata Tiscon 12mm TMT Steel Rebars',
    sku: 'STL-TMT-12',
    uom: 'MT',
    quantity_on_hand: 24.5,
    valuation_rate: 62000,
    updated_at: new Date().toISOString(),
  },
];

export const getErpItems = async (orgId: string): Promise<ErpItem[]> => {
  const items = await OfflineSyncService.getItems<ErpItem>('erp_items', (i) => i.org_id === orgId);
  if (items.length === 0 && orgId === 'org_enterprise_default') {
    for (const item of DEFAULT_ITEMS) {
      await OfflineSyncService.saveItem('erp_items', item);
    }
    return DEFAULT_ITEMS;
  }
  return items;
};

export const getSiteStock = async (siteId?: string | null, orgId: string = 'org_enterprise_default'): Promise<InventoryStock[]> => {
  const stock = await OfflineSyncService.getItems<InventoryStock>(
    'inventory_stock',
    (s) => s.org_id === orgId && (!siteId || s.site_id === siteId)
  );
  if (stock.length === 0 && orgId === 'org_enterprise_default') {
    for (const s of DEFAULT_STOCK) {
      await OfflineSyncService.saveItem('inventory_stock', s);
    }
    return siteId ? DEFAULT_STOCK.filter((s) => s.site_id === siteId) : DEFAULT_STOCK;
  }
  return stock;
};

export const getInventoryStock = getSiteStock;

export const getGatePasses = async (siteId?: string | null, orgId: string = 'org_enterprise_default'): Promise<GatePass[]> => {
  return await OfflineSyncService.getItems<GatePass>(
    'gate_passes',
    (g) => g.org_id === orgId && (!siteId || g.site_id === siteId)
  );
};

export const createGatePass = async (input: Omit<GatePass, 'id' | 'created_at'>): Promise<GatePass> => {
  const pass: GatePass = {
    ...input,
    id: 'gp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    created_at: new Date().toISOString(),
  };

  await OfflineSyncService.saveItem('gate_passes', pass);

  // If verified inward, auto-update stock balance!
  if (pass.type === 'inward' && pass.status === 'verified') {
    for (const it of pass.items) {
      const stockItems = await getSiteStock(pass.site_id, pass.org_id);
      const existing = stockItems.find((s) => s.item_id === it.item_id);
      if (existing) {
        await OfflineSyncService.updateItem<InventoryStock>('inventory_stock', existing.id, {
          quantity_on_hand: existing.quantity_on_hand + it.qty,
        });
      } else {
        await OfflineSyncService.saveItem<InventoryStock>('inventory_stock', {
          id: 'stk_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
          org_id: pass.org_id,
          site_id: pass.site_id,
          item_id: it.item_id,
          item_name: it.item_name,
          uom: it.uom,
          quantity_on_hand: it.qty,
          valuation_rate: 0,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  return pass;
};
