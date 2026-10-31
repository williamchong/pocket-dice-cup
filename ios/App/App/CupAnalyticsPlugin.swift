import Capacitor
import FirebaseAnalytics
import FirebaseCore

/**
 * Reports usage through Firebase's SDK, as android/.../CupAnalyticsPlugin.java
 * does; keep the two in step. The page asks through app/utils/analytics.ts,
 * whose list of events is all that is ever sent.
 *
 * Info.plist starts collection off, so that nothing goes out for someone who
 * switched it off before the page has had the chance to say so. Without
 * GoogleService-Info.plist, and in debug builds so that development runs stay
 * out of the data, every call does nothing.
 */
@objc(CupAnalyticsPlugin)
public class CupAnalyticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CupAnalyticsPlugin"
    public let jsName = "CupAnalytics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "track", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
    ]

    private var reporting: Bool {
        #if DEBUG
        return false
        #else
        return FirebaseApp.app() != nil
        #endif
    }

    @objc func track(_ call: CAPPluginCall) {
        guard let event = call.getString("event") else {
            call.reject("An event needs a name")
            return
        }
        if reporting {
            Analytics.logEvent(event, parameters: call.getObject("params") as? [String: Any])
        }
        call.resolve()
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        if reporting {
            Analytics.setAnalyticsCollectionEnabled(call.getBool("enabled") ?? false)
        }
        call.resolve()
    }
}
