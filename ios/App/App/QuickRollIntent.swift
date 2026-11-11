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

/**
 * The ✕ button beside ↻: ends the activity, island and Lock Screen banner
 * alike, for someone done rolling who would otherwise wait for the app's
 * four-hour cleanup or iOS's eight, or have to find the Lock Screen's swipe.
 * The next roll from the cup starts a new one, as after that swipe. In this
 * file so it is compiled into both targets with ↻'s intent, for the same reason.
 */
@available(iOS 17.0, *)
struct EndCupActivityIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "Close"
    static let description = IntentDescription("Removes the last roll from the Dynamic Island and the Lock Screen.")
    static let isDiscoverable = false

    init() {}

    func perform() async throws -> some IntentResult {
        for activity in Activity<CupActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        return .result()
    }
}
