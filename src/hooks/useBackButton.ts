import { useEffect, useRef } from 'react';
import { backHandlerService } from '../services/backHandlerService';

let nextHookId = 1;

/**
 * React hook that registers a callback with the Android Back button handler
 * while `isOpen` is true. Automatically cleans up on unmount or when `isOpen` becomes false.
 *
 * @param isOpen Whether the overlay/modal/menu is currently open
 * @param onClose The dismiss callback to invoke on back press
 * @param priority Priority tier (higher numbers run first, default 30)
 * @param id Optional unique identifier (auto-generated if omitted)
 */
export const useBackButton = (
  isOpen: boolean,
  onClose: () => void,
  priority = 30,
  id?: string
): void => {
  const handlerIdRef = useRef<string>(id || `back_handler_${nextHookId++}`);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const unregister = backHandlerService.register(
      handlerIdRef.current,
      () => {
        onCloseRef.current();
        return true;
      },
      priority
    );

    return () => {
      unregister();
    };
  }, [isOpen, priority]);
};

