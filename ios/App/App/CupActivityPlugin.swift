import ActivityKit
import Capacitor
import UIKit

/**
 * Keeps the last roll in the Dynamic Island and on the Lock Screen, through a
 * Live Activity drawn by the CupActivity widget extension. iOS 17 or later,
 * for the island's button; on older systems every call does nothing.
 */
@objc(CupActivityPlugin)
public class CupActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CupActivityPlugin"
    public let jsName = "CupActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeQuickRolls", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(endIfIdle), name: UIApplication.didBecomeActiveNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(endOnQuit), name: UIApplication.willTerminateNotification, object: nil)
    }

    /**
     * Shows `kinds` and `values` (a roll from the cup), starting the activity
     * if there is none. With no values (the pool changed) it only updates an
     * activity already showing, so a change of dice alone never starts one.
     */
    @objc func show(_ call: CAPPluginCall) {
        guard #available(iOS 17.0, *) else { return call.resolve() }
        guard let kinds = call.getArray("kinds") as? [String], !kinds.isEmpty, kinds.allSatisfy({ DiceRow.sides($0) != nil }) else {
            return call.reject("kinds must be a list of dice")
        }
        // Null is a change of pool; anything else that is not one value per die is a mistake, not that.
        let values: [Int]?
        if call.getValue("values") is NSNull || call.getValue("values") == nil {
            values = nil
        } else if let given = call.getArray("values") as? [Int], given.count == kinds.count {
            values = given
        } else {
            return call.reject("values must have one value per die")
        }
        let time = call.getDouble("time").map { Date(timeIntervalSince1970: $0 / 1000) } ?? .now
        let content = CupActivityAttributes.content(kinds: kinds, values: values, quick: false, time: time)
        Task { @MainActor in
            let running = Activity<CupActivityAttributes>.activities
            if running.isEmpty {
                if values != nil && ActivityAuthorizationInfo().areActivitiesEnabled {
                    do {
                        _ = try Activity.request(attributes: CupActivityAttributes(), content: content)
                    } catch {
                        CAPLog.print("CupActivity: could not start the activity: \(error)")
                    }
                }
            } else {
                for activity in running { await activity.update(content) }
            }
            call.resolve()
        }
    }

    /** The quick rolls made from the island since the last call, oldest first, as `{ kinds, values, time }`. */
    @objc func takeQuickRolls(_ call: CAPPluginCall) {
        Task { @MainActor in
            call.resolve(["rolls": QuickRollStore.take()])
        }
    }

    /**
     * Ends the activity when the app is quit while still running, as quitting
     * reads as being done with the cup. iOS does not say so once the app is
     * suspended in the background, the usual case, so a quit from there leaves
     * the activity to ✕, the Lock Screen's swipe or the timeouts. The app has
     * about five seconds before it is killed. The end runs in a detached task,
     * as a plain one here would inherit the main actor that the semaphore is
     * holding, and is waited for at most one second, so a slow end cannot use
     * up the five.
     */
    @objc private func endOnQuit() {
        guard #available(iOS 17.0, *) else { return }
        let done = DispatchSemaphore(value: 0)
        Task.detached {
            for activity in Activity<CupActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            done.signal()
        }
        _ = done.wait(timeout: .now() + 1)
    }

    /** Ends an activity left from a roll long ago, as the app comes to the front. */
    @objc private func endIfIdle() {
        guard #available(iOS 17.0, *) else { return }
        Task {
            for activity in Activity<CupActivityAttributes>.activities
            where Date.now.timeIntervalSince(activity.content.state.time) > CupActivityAttributes.endAfter {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
        }
    }
}
