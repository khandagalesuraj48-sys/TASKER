import { Capacitor, registerPlugin } from '@capacitor/core';

interface SystemBarsPluginInterface {
  setStyle(options: { style: 'light' | 'dark' }): Promise<void>;
}

const SystemBars = registerPlugin<SystemBarsPluginInterface>('SystemBars');

/**
 * Synchronizes Android status bar and navigation bar icon colors
 * with the application theme.
 *
 * - Light theme: status bar & navigation bar icons become dark (high contrast against white)
 * - Dark theme: status bar & navigation bar icons become light/white (high contrast against dark)
 */
export const setNativeSystemBarsStyle = async (style: 'light' | 'dark'): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    try {
      await SystemBars.setStyle({ style });
    } catch (err) {
      console.warn('SystemBars.setStyle failed:', err);
    }
  }
};

