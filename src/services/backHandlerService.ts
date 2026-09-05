/**
 * Centralized Android Back Handler Service
 *
 * Manages a prioritized LIFO stack of dismissible overlays (modals, drawers, dropdowns).
 * Higher priority numbers run before lower priority numbers.
 *
 * Standard Priority Tiers:
 * 100 - Active Soft Keyboard / Input blur
 *  50 - Topmost Modals & Dialogs (TaskFormModal, ChangeStatusModal, FilePreviewModal, ConfirmDialog)
 *  40 - Drawers & Command palettes (AIAssistantDrawer, UniversalSearchModal)
 *  30 - Dropdowns & Menus (Header profile dropdown, MobileNav "More" menu, Sidebar drawer, FilterPanel)
 */

export type BackHandlerFn = () => boolean | void;

interface RegisteredHandler {
  id: string;
  priority: number;
  handler: BackHandlerFn;
}

class BackHandlerService {
  private handlers: RegisteredHandler[] = [];

  /**
   * Registers a back-closable handler.
   * Returns an unregister cleanup function.
   */
  register(id: string, handler: BackHandlerFn, priority = 30): () => void {
    // Remove any existing entry with the same id
    this.handlers = this.handlers.filter((h) => h.id !== id);
    this.handlers.push({ id, priority, handler });
    // Sort descending by priority; preserve insertion order for same priority
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.unregister(id);
    };
  }

  /**
   * Unregisters a handler by id.
   */
  unregister(id: string): void {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }

  /**
   * Pops and invokes the topmost handler.
   * Returns true if an overlay was dismissed, or false if the overlay stack was empty.
   */
  handleBack(): boolean {
    if (this.handlers.length === 0) {
      return false;
    }

    const top = this.handlers.pop();
    if (top) {
      const result = top.handler();
      // If the handler returned false, it didn't consume the back press, so continue
      if (result === false) {
        return this.handleBack();
      }
      return true;
    }

    return false;
  }

  /**
   * Returns true if there are any overlays currently registered.
   */
  hasOverlays(): boolean {
    return this.handlers.length > 0;
  }
}

export const backHandlerService = new BackHandlerService();

