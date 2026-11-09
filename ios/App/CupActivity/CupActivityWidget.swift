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

/** The felt of the cup, behind the Lock Screen banner: --color-felt in main.css. */
private let felt = Color(red: 0x12 / 255, green: 0x24 / 255, blue: 0x1b / 255)
/** The dice's sizes in the expanded island and on the Lock Screen, largest first. */
private let largeDice: [CGFloat] = [34, 28, 22]
private let largeTotal = Font.system(size: 40, weight: .bold, design: .rounded)

/**
 * The last roll in the Dynamic Island and on the Lock Screen. A tap anywhere
 * opens the app, which is what a Live Activity does with no URL of its own;
 * only the ↻ button, in the expanded island and on the Lock Screen, rolls.
 */
struct CupActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CupActivityAttributes.self) { context in
            LockScreenRoll(state: context.state)
                .padding(16)
                .opacity(context.isStale ? 0.6 : 1)
                .activityBackgroundTint(felt)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                // The dice and the total go in the band beside the camera, as one
                // row under it left the expanded island looking empty.
                DynamicIslandExpandedRegion(.leading) {
                    DiceChips(state: context.state, sizes: largeDice)
                        .padding(.leading, 6)
                        .frame(maxHeight: .infinity)
                        .opacity(context.isStale ? 0.6 : 1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TotalText(state: context.state)
                        .font(largeTotal)
                        .padding(.trailing, 6)
                        .frame(maxHeight: .infinity)
                        .opacity(context.isStale ? 0.6 : 1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    PoolAndReroll(state: context.state)
                        .padding(.horizontal, 6)
                }
            } compactLeading: {
                DiceChips(state: context.state, sizes: [18, 14])
            } compactTrailing: {
                TotalText(state: context.state).font(.body.bold())
            } minimal: {
                TotalText(state: context.state).font(.body.bold())
            }
            .keylineTint(.white)
        }
    }
}

/** The Lock Screen's banner: the dice and the total, with the pool and ↻ under them. */
struct LockScreenRoll: View {
    let state: CupActivityAttributes.ContentState

    var body: some View {
        VStack(spacing: 10) {
            HStack {
                DiceChips(state: state, sizes: largeDice)
                Spacer(minLength: 8)
                TotalText(state: state).font(largeTotal)
            }
            PoolAndReroll(state: state)
        }
        .foregroundStyle(.white)
    }
}

/**
 * Each die as a small die: the SF Symbol of its face for a d6, and a tile
 * with its number for any other kind, at the first size in `sizes` that fits,
 * the smaller ones taking over as the pool grows.
 */
struct DiceChips: View {
    let state: CupActivityAttributes.ContentState
    let sizes: [CGFloat]

    var body: some View {
        let dice = Array(DiceRow.dice(kinds: state.kinds, values: state.values ?? []).enumerated())
        if !dice.isEmpty {
            ViewThatFits(in: .horizontal) {
                ForEach(sizes, id: \.self) { size in
                    HStack(spacing: size * 0.2) {
                        ForEach(dice, id: \.offset) { _, die in
                            DieChip(kind: die.kind, value: die.value, size: size)
                                // A new value in a slot is a new chip, so every kind of die
                                // turns over the same way, rather than a symbol swap for a d6
                                // and rolling digits for the others; a die that came up the
                                // same stays still.
                                .id(die.value)
                                .transition(.scale.combined(with: .opacity))
                        }
                    }
                }
                // Too many even at the smallest size: the count, as "×12".
                Text("×\(dice.count)").font(.system(size: sizes[sizes.count - 1], weight: .semibold, design: .rounded))
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(dice.map { String($0.element.value) }.joined(separator: ", "))
        } else {
            // The pool changed since the last roll.
            Image(systemName: "dice")
                .font(.system(size: sizes[0]))
                .foregroundStyle(.secondary)
                .accessibilityLabel("Not rolled yet")
        }
    }
}

struct DieChip: View {
    let kind: String
    let value: Int
    let size: CGFloat

    var body: some View {
        // A d6 outside 1...6 would name a symbol that does not exist.
        if kind == "d6", (1...6).contains(value) {
            Image(systemName: "die.face.\(value).fill")
                .font(.system(size: size))
        } else {
            Text(String(value))
                .font(.system(size: size * 0.5, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.6)
                .foregroundStyle(.black)
                .frame(width: size, height: size)
                .background(RoundedRectangle(cornerRadius: size * 0.22).fill(.white))
        }
    }
}

/**
 * The pool, which opens the dice, and when it was rolled, which opens
 * History, then the ↻ button, all as capsules so that each reads as
 * something to tap. A quick roll is said in words with the time rather than
 * with a second ↻, which read as another button.
 */
struct PoolAndReroll: View {
    let state: CupActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 8) {
            Link(destination: CupLink.pool) {
                Text(DiceRow.poolLabel(state.kinds)).bold().capsule()
            }
            .accessibilityHint("Opens the dice")
            Link(destination: CupLink.history) {
                // The clock time rather than a relative one, whose ticking seconds distract.
                Text("\(state.quick ? "Quick roll · " : "")\(state.time, style: .time)").capsule()
            }
            .accessibilityHint("Opens History")
            Spacer(minLength: 0)
            Button(intent: QuickRollIntent()) {
                Image(systemName: "arrow.clockwise").font(.body.bold()).capsule(padding: 18)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Quick roll")
        }
        .font(.footnote)
    }
}

/** The links that open the app on a sheet, read by app/utils/cupLink.ts; keep the scheme in step with it. */
enum CupLink {
    static let pool = URL(string: "pocketdicecup://pool")!
    static let history = URL(string: "pocketdicecup://history")!
}

extension View {
    /** A quiet capsule at least 44 pt tall, the least a finger can be sure of hitting. */
    func capsule(padding: CGFloat = 12) -> some View {
        lineLimit(1)
            .minimumScaleFactor(0.8)
            .padding(.horizontal, padding)
            .frame(minHeight: 44)
            .background(Capsule().fill(.white.opacity(0.18)))
            .contentShape(Capsule())
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
