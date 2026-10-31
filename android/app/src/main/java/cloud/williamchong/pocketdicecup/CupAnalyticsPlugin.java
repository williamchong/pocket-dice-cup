package cloud.williamchong.pocketdicecup;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.analytics.FirebaseAnalytics;
import java.util.Iterator;

/**
 * Reports usage through Firebase's SDK, as the iOS shell's
 * CupAnalyticsPlugin.swift does; keep the two in step. The page asks through
 * app/utils/analytics.ts, whose list of events is all that is ever sent.
 *
 * AndroidManifest.xml starts collection off, so that nothing goes out for
 * someone who switched it off before the page has had the chance to say so.
 * Without google-services.json, and in debuggable builds so that development
 * runs stay out of the data, every call does nothing.
 */
@CapacitorPlugin(name = "CupAnalytics")
public class CupAnalyticsPlugin extends Plugin {

    /** Null when not reporting. */
    private FirebaseAnalytics analytics;

    @Override
    public void load() {
        boolean debuggable = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        if (!debuggable && !FirebaseApp.getApps(getContext()).isEmpty()) {
            analytics = FirebaseAnalytics.getInstance(getContext());
        }
    }

    @PluginMethod
    public void track(PluginCall call) {
        String event = call.getString("event");
        if (event == null) {
            call.reject("An event needs a name");
            return;
        }
        if (analytics != null) {
            Bundle params = new Bundle();
            JSObject given = call.getObject("params", new JSObject());
            for (Iterator<String> keys = given.keys(); keys.hasNext();) {
                String key = keys.next();
                params.putString(key, given.getString(key));
            }
            analytics.logEvent(event, params);
        }
        call.resolve();
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        if (analytics != null) {
            analytics.setAnalyticsCollectionEnabled(Boolean.TRUE.equals(call.getBoolean("enabled", false)));
        }
        call.resolve();
    }
}
