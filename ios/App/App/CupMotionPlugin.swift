import Capacitor
import CoreMotion
import UIKit

/**
 * Reads the motion sensor through Core Motion and hands each reading to the
 * page (app/engine/input/nativeMotionSource.ts). In the WebView the page could
 * only have it through DeviceMotionEvent, whose permission WebKit asks for
 * from a tap alone, so the app opened on a "tap to begin" screen; Core
 * Motion's device motion needs no permission and no prompt.
 */
@objc(CupMotionPlugin)
public class CupMotionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CupMotionPlugin"
    public let jsName = "CupMotion"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    /**
     * Safari's DeviceMotionEvent arrives at about this rate, which the shake
     * tuning was done at; the page only takes one reading a frame anyway.
     */
    private static let interval: TimeInterval = 1.0 / 60

    private let manager = CMMotionManager()
    /** Whether the page wants readings, so they come back after the app returns from the background. */
    private var wanted = false

    override public func load() {
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(pause), name: UIApplication.didEnterBackgroundNotification, object: nil)
        center.addObserver(self, selector: #selector(resume), name: UIApplication.willEnterForegroundNotification, object: nil)
    }

    @objc func start(_ call: CAPPluginCall) {
        guard manager.isDeviceMotionAvailable else {
            call.reject("Device motion is not available")
            return
        }
        DispatchQueue.main.async {
            self.wanted = true
            self.resume()
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.wanted = false
            self.pause()
            call.resolve()
        }
    }

    @objc private func resume() {
        guard wanted, !manager.isDeviceMotionActive else { return }
        manager.deviceMotionUpdateInterval = Self.interval
        manager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let self, let motion else { return }
            // Gravity and the hand's own acceleration together, in g, which is
            // what WebKit turns into accelerationIncludingGravity: the shake
            // thresholds and the recorded traces were tuned on that, not on the
            // raw accelerometer.
            let gravity = motion.gravity
            let user = motion.userAcceleration
            self.notifyListeners("reading", data: [
                "x": gravity.x + user.x,
                "y": gravity.y + user.y,
                "z": gravity.z + user.z,
            ])
        }
    }

    @objc private func pause() {
        manager.stopDeviceMotionUpdates()
    }
}
