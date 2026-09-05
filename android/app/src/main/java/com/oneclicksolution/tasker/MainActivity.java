package com.oneclicksolution.tasker;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {

    @CapacitorPlugin(name = "SystemBars")
    public static class SystemBarsPlugin extends Plugin {
        @PluginMethod
        public void setStyle(PluginCall call) {
            String style = call.getString("style", "light");
            boolean isDark = "dark".equalsIgnoreCase(style);
            if (getActivity() != null) {
                getActivity().runOnUiThread(() -> {
                    Window window = getActivity().getWindow();
                    if (window != null) {
                        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                        if (controller != null) {
                            // true = dark icons (on light background)
                            // false = light icons (on dark background)
                            controller.setAppearanceLightStatusBars(!isDark);
                            controller.setAppearanceLightNavigationBars(!isDark);
                        }
                    }
                    call.resolve();
                });
            } else {
                call.resolve();
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarsPlugin.class);
        registerPlugin(UpdatePlugin.class);
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        if (window != null) {
            // Enable edge-to-edge: window insets will not restrict the webview
            WindowCompat.setDecorFitsSystemWindows(window, false);

            // Transparent system bars
            window.setStatusBarColor(Color.TRANSPARENT);
            window.setNavigationBarColor(Color.TRANSPARENT);

            // Disable Samsung/Android 10+ translucent scrim bars
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setStatusBarContrastEnforced(false);
                window.setNavigationBarContrastEnforced(false);
            }

            // Initialize icon colors matching system configuration before JS loads
            int nightModeFlags = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            boolean isDark = nightModeFlags == Configuration.UI_MODE_NIGHT_YES;
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            if (controller != null) {
                controller.setAppearanceLightStatusBars(!isDark);
                controller.setAppearanceLightNavigationBars(!isDark);
            }
        }
    }
}

