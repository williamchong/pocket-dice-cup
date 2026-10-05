import Capacitor
import CoreHaptics

/**
 * Plays the taps of the dice on the cup through Core Haptics, which can vary
 * how hard and how crisp each one is. The stock Capacitor haptics plugin only
 * has a few fixed impact styles.
 */
@objc(CoreHapticsPlugin)
public class CoreHapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CoreHapticsPlugin"
    public let jsName = "CoreHaptics"
    // Fire and forget: a shake plays about 30 taps a second, and none of them
    // is worth a reply over the bridge.
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "playTransient", returnType: CAPPluginReturnNone)
    ]

    /** Nil where the phone has no Taptic Engine, and then every tap is skipped. */
    private var engine: CHHapticEngine?

    override public func load() {
        guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else { return }
        do {
            let engine = try CHHapticEngine()
            engine.playsHapticsOnly = true
            // Lets the hardware power down while the dice lie still.
            engine.isAutoShutdownEnabled = true
            // The haptic server can restart, for example after a call.
            engine.resetHandler = { [weak engine] in try? engine?.start() }
            try engine.start()
            self.engine = engine
        } catch {
            CAPLog.print("CoreHaptics: could not start the engine: \(error)")
        }
    }

    @objc func playTransient(_ call: CAPPluginCall) {
        guard let engine else { return }
        let intensity = call.getFloat("intensity") ?? 1
        let sharpness = call.getFloat("sharpness") ?? 0.5
        do {
            let pattern = try CHHapticPattern(
                events: [CHHapticEvent(
                    eventType: .hapticTransient,
                    parameters: [
                        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
                        CHHapticEventParameter(parameterID: .hapticSharpness, value: sharpness),
                    ],
                    relativeTime: 0)],
                parameters: [])
            do {
                try engine.makePlayer(with: pattern).start(atTime: CHHapticTimeImmediate)
            } catch {
                // The engine stops itself after a quiet spell (auto shutdown),
                // in the background and on an audio interruption; start it
                // again and retry this tap once.
                try engine.start()
                try engine.makePlayer(with: pattern).start(atTime: CHHapticTimeImmediate)
            }
        } catch {
            // A tap that cannot play is dropped; the next hit tries again.
        }
    }
}
