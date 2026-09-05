import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { backHandlerService } from '../services/backHandlerService';

/**
 * Root Android Hardware Back Button Handler
 *
 * Registered once on mount. Never torn down on route change.
 *
 * Strict Priority:
 * 1. Soft keyboard / text input dismissal (blur active input)
 * 2. Topmost open Modals & Dialogs (TaskFormModal, ChangeStatusModal, FilePreviewModal, ConfirmDialog)
 * 3. Open Drawers & Command Palettes (AIAssistantDrawer, UniversalSearchModal)
 * 4. Open Dropdowns & Menus (Header profile dropdown, MobileNav "More" menu, Sidebar drawer, FilterPanel)
 * 5. Page Navigation: Navigates back one step in history (navigate(-1))
 * 6. App Exit: Only when at Dashboard root "/" with zero open overlays
 *
 * Rapid double back in inner pages navigates two pages back (Task Details -> Tasks -> Dashboard).
 * It will NEVER exit prematurely.
 */
export const useAndroidBackHandler = (): void => {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isSubscribed = true;

    // Register ONE permanent back button listener
    const listenerPromise = CapApp.addListener('backButton', () => {
      if (!isSubscribed) return;

      // 1. Soft Keyboard dismissal: If an input element is active, blur it
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl instanceof HTMLInputElement ||
          activeEl instanceof HTMLTextAreaElement ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        (activeEl as HTMLElement).blur();
        return;
      }

      // 2. Overlays Stack: Check registered modals, drawers, dropdowns, menus
      if (backHandlerService.handleBack()) {
        return;
      }

      // 3. Fallback: If any modal dialog exists in the DOM, dispatch Escape
      const openDialog = document.querySelector('[role="dialog"]');
      if (openDialog) {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
            cancelable: true,
          })
        );
        return;
      }

      // 4. Page Navigation: If on an inner page (not Dashboard root "/")
      const currentPath = window.location.pathname;
      if (currentPath !== '/' && currentPath !== '') {
        if (window.history.length > 1) {
          navigateRef.current(-1);
        } else {
          navigateRef.current('/', { replace: true });
        }
        return;
      }

      // 5. At Dashboard root "/" with no overlays: standard clean app exit
      CapApp.exitApp();
    });

    return () => {
      isSubscribed = false;
      listenerPromise.then((handle) => handle.remove());
    };
  }, []); // Run ONCE on mount; never re-bind or unbind on route change
};

