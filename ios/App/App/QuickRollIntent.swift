import ActivityKit
import AppIntents

/**
 * The ↻ button in the expanded island and on the Lock Screen: a quick roll of
 * the pool the island shows, without opening the app. A LiveActivityIntent
 * runs in the app's process, so it is compiled into the app as well as the
 * widget extension, which only shows the button.
 */
@available(iOS 17.0, *)
struct QuickRollIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Quick roll"
    static let description = IntentDescription("Rolls the dice shown in the Dynamic Island again, from a random number rather than the cup.")
    static let isDiscoverable = false

    init() {}

    func perform() async throws -> some IntentResult {
        for activity in Activity<CupActivityAttributes>.activities {
            let kinds = activity.content.state.kinds
            let values = DiceRow.draw(kinds)
            let time = Date.now
            await QuickRollStore.append(kinds: kinds, values: values, time: time)
            await activity.update(CupActivityAttributes.content(kinds: kinds, values: values, quick: true, time: time))
        }
        return .result()
    }
}
