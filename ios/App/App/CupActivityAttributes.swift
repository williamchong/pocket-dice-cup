import ActivityKit
import Foundation

/**
 * The last roll, as the Live Activity in the Dynamic Island and on the Lock
 * Screen shows it. Compiled into both the app and the CupActivity widget
 * extension, which draws it; the app is the only one that starts or updates it.
 */
@available(iOS 16.1, *)
struct CupActivityAttributes: ActivityAttributes {
    /** Marked stale this long after the last roll, and drawn dimmer. */
    static let staleAfter: TimeInterval = 60 * 60
    /** Ended when the app next comes to the front this long after the last roll; iOS ends it at 8 hours anyway. */
    static let endAfter: TimeInterval = 4 * 60 * 60

    struct ContentState: Codable, Hashable {
        /** The kind of each die in the cup, such as "d6", in the cup's order. */
        var kinds: [String]
        /** One value per die, in the order of `kinds`; nil when the pool has changed since the last roll. */
        var values: [Int]?
        /** Whether `values` came from the island's quick roll rather than from settled dice. */
        var quick: Bool
        /** When the roll was made, or the pool changed. */
        var time: Date

        /** The faces, or a dash when the pool changed since the last roll. */
        var faces: String {
            values.map { DiceRow.faces(kinds: kinds, values: $0) } ?? "–"
        }

        var totalText: String {
            values.map { String(DiceRow.total($0)) } ?? "–"
        }
    }

    /** What the activity shows for a roll or a change of pool, stale `staleAfter` later. */
    @available(iOS 16.2, *)
    static func content(kinds: [String], values: [Int]?, quick: Bool, time: Date) -> ActivityContent<ContentState> {
        ActivityContent(state: ContentState(kinds: kinds, values: values, quick: quick, time: time), staleDate: time.addingTimeInterval(staleAfter))
    }
}

/**
 * The words and numbers of the island's row, from the kinds and values alone,
 * so that the island cannot show other dice than the cup holds.
 */
enum DiceRow {
    /** The number of faces of `kind`: 20 for "d20". */
    static func sides(_ kind: String) -> Int? {
        guard kind.hasPrefix("d"), let sides = Int(kind.dropFirst()), sides > 1 else { return nil }
        return sides
    }

    /** The kinds in `kinds`, largest first, each with the indices of its dice in the cup's order. */
    private static func groups(_ kinds: [String]) -> [(kind: String, indices: [Int])] {
        var indices: [String: [Int]] = [:]
        for (index, kind) in kinds.enumerated() { indices[kind, default: []].append(index) }
        return indices
            .sorted { (sides($0.key) ?? 0) > (sides($1.key) ?? 0) }
            .map { (kind: $0.key, indices: $0.value) }
    }

    /** The pool in dice notation, largest kind first, as "d20+2d6". */
    static func poolLabel(_ kinds: [String]) -> String {
        groups(kinds)
            .map { $0.indices.count > 1 ? "\($0.indices.count)\($0.kind)" : $0.kind }
            .joined(separator: "+")
    }

    /**
     * Each die's value: as die faces, "⚄ ⚂ ⚅", for a pool of only d6, the
     * only dice Unicode has faces for; otherwise as numbers grouped by kind,
     * largest first, as "17 · 4 2". A d10's 10 reads 10, as in the app's
     * History, so the values add up to the total beside them.
     */
    static func faces(kinds: [String], values: [Int]) -> String {
        guard kinds.count == values.count else { return "" }
        if kinds.allSatisfy({ $0 == "d6" }) {
            return values.map { value in
                (1...6).contains(value) ? String(UnicodeScalar(0x2680 + value - 1)!) : String(value)
            }.joined(separator: " ")
        }
        return groups(kinds)
            .map { group in group.indices.map { String(values[$0]) }.joined(separator: " ") }
            .joined(separator: " · ")
    }

    static func total(_ values: [Int]) -> Int {
        values.reduce(0, +)
    }

    /**
     * A quick roll of `kinds`: each value drawn evenly from the die's faces
     * by the system's cryptographic generator. Unlike the cup's rolls, no
     * dice settle; the island cannot run the physics.
     */
    static func draw(_ kinds: [String]) -> [Int] {
        var generator = SystemRandomNumberGenerator()
        return kinds.map { Int.random(in: 1...(sides($0) ?? 6), using: &generator) }
    }
}

/**
 * The quick rolls made from the island since the page last asked for them.
 * The island's button runs in the app's process, so the app's own defaults
 * hold them, with no App Group, which a free Apple ID may not provision; the
 * page adds them to History when it next comes to the front.
 */
enum QuickRollStore {
    private static let key = "CupActivity.quickRolls"
    /** As many as History keeps (MAX_HISTORY in rollHistory.ts), as taps on the Lock Screen could go on for hours before the app is opened. */
    private static let kept = 50

    @MainActor
    static func append(kinds: [String], values: [Int], time: Date, defaults: UserDefaults = .standard) {
        var rolls = defaults.array(forKey: key) as? [[String: Any]] ?? []
        rolls.append(["kinds": kinds, "values": values, "time": (time.timeIntervalSince1970 * 1000).rounded()])
        defaults.set(Array(rolls.suffix(kept)), forKey: key)
    }

    /** The rolls kept, oldest first, removing them. */
    @MainActor
    static func take(defaults: UserDefaults = .standard) -> [[String: Any]] {
        let rolls = defaults.array(forKey: key) as? [[String: Any]] ?? []
        defaults.removeObject(forKey: key)
        return rolls
    }
}
