import XCTest
@testable import App

/** The island's row, and the quick roll, which must only land on a die's faces. */
final class CupActivityTests: XCTestCase {
    func testPoolLabelListsTheLargestKindFirst() {
        XCTAssertEqual(DiceRow.poolLabel(["d6", "d6", "d6"]), "3d6")
        XCTAssertEqual(DiceRow.poolLabel(["d6", "d6", "d20"]), "d20+2d6")
        XCTAssertEqual(DiceRow.poolLabel(["d4", "d10", "d12"]), "d12+d10+d4")
    }

    func testDiceAreLaidOutLargestKindFirstInTheCupsOrder() {
        let dice = DiceRow.dice(kinds: ["d6", "d6", "d20"], values: [4, 2, 17])
        XCTAssertEqual(dice.map(\.kind), ["d20", "d6", "d6"])
        XCTAssertEqual(dice.map(\.value), [17, 4, 2])
        XCTAssertEqual(DiceRow.dice(kinds: ["d10"], values: [10]).map(\.value), [10])
        XCTAssertEqual(DiceRow.total([4, 2, 17]), 23)
    }

    func testQuickRollStaysOnEachDiesFacesAndReachesEveryOne() {
        for kind in ["d4", "d6", "d8", "d10", "d12", "d20"] {
            let sides = DiceRow.sides(kind)!
            var seen = Set<Int>()
            for _ in 0..<2000 {
                let value = DiceRow.draw([kind])[0]
                XCTAssert((1...sides).contains(value), "\(kind) rolled \(value)")
                seen.insert(value)
            }
            XCTAssertEqual(seen.count, sides, "\(kind) never rolled some faces")
        }
    }

    @MainActor
    func testQuickRollsAreKeptUntilTaken() {
        let defaults = UserDefaults(suiteName: "CupActivityTests")!
        defaults.removePersistentDomain(forName: "CupActivityTests")
        QuickRollStore.append(kinds: ["d6"], values: [4], time: Date(timeIntervalSince1970: 1), defaults: defaults)
        QuickRollStore.append(kinds: ["d20"], values: [17], time: Date(timeIntervalSince1970: 2), defaults: defaults)
        let rolls = QuickRollStore.take(defaults: defaults)
        XCTAssertEqual(rolls.map { $0["values"] as? [Int] }, [[4], [17]])
        XCTAssertEqual(rolls.map { $0["time"] as? Double }, [1000, 2000])
        XCTAssertTrue(QuickRollStore.take(defaults: defaults).isEmpty)
    }
}
