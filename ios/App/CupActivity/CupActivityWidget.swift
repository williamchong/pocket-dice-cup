import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@main
struct CupActivityBundle: WidgetBundle {
    var body: some Widget {
        CupActivityWidget()
    }
}

/**
 * The last roll in the Dynamic Island and on the Lock Screen. A tap anywhere
 * opens the app, which is what a Live Activity does with no URL of its own;
 * only the ↻ button, in the expanded island and on the Lock Screen, rolls.
 */
struct CupActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CupActivityAttributes.self) { context in
            RollRow(state: context.state, large: true)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .opacity(context.isStale ? 0.6 : 1)
                .activityBackgroundTint(Color(red: 0.11, green: 0.24, blue: 0.17))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // One row under the camera, which leaves the regions beside it empty.
                DynamicIslandExpandedRegion(.bottom) {
                    RollRow(state: context.state, large: false)
                        .opacity(context.isStale ? 0.6 : 1)
                }
            } compactLeading: {
                FacesIfTheyFit(state: context.state)
            } compactTrailing: {
                TotalText(state: context.state)
            } minimal: {
                TotalText(state: context.state)
            }
        }
    }
}

/** The pool, the faces, the total and the ↻ button, on one line. */
struct RollRow: View {
    let state: CupActivityAttributes.ContentState
    let large: Bool

    var body: some View {
        HStack(spacing: 12) {
            Text(DiceRow.poolLabel(state.kinds))
                .font(large ? .subheadline : .caption)
                .foregroundStyle(.secondary)
                .fixedSize()
            FacesIfTheyFit(state: state)
            Spacer(minLength: 0)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                TotalText(state: state)
                    .font(large ? .title.bold() : .title2.bold())
                if state.quick {
                    // A quick roll, not settled dice, until the next roll from the cup.
                    Image(systemName: "arrow.clockwise")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .accessibilityLabel("Quick roll result")
                }
            }
            Button(intent: QuickRollIntent()) {
                Image(systemName: "arrow.clockwise.circle.fill")
                    .font(.title2)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Quick roll")
        }
        .foregroundStyle(.white)
    }
}

/** The faces, dropped first when there is no room, leaving the pool and the total. */
struct FacesIfTheyFit: View {
    let state: CupActivityAttributes.ContentState

    var body: some View {
        ViewThatFits {
            Text(state.faces).lineLimit(1)
            EmptyView()
        }
        .contentTransition(.numericText())
    }
}

struct TotalText: View {
    let state: CupActivityAttributes.ContentState

    var body: some View {
        Text(state.totalText)
            .monospacedDigit()
            .contentTransition(.numericText())
    }
}
