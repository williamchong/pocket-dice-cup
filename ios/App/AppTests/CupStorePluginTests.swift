import XCTest
import StoreKit
import StoreKitTest
import Capacitor
@testable import App

/**
 * Drives the real CupStorePlugin through Products.storekit, the file the
 * shared App scheme points Xcode at, so the buy, refund, Ask to Buy and
 * restore paths are checked before App Store Connect has the product. The
 * dialogs are off, so a buy cancelled on the sheet cannot be made here and
 * is only checked by hand.
 */
@MainActor
final class CupStorePluginTests: XCTestCase {
    private var session: SKTestSession!
    private var plugin: CupStorePlugin!

    /** What the page would receive: the `owned` it resolves with, or the message it rejects with. */
    private enum Outcome: Equatable {
        case owned(Bool)
        case rejected(String)
    }

    override func setUp() async throws {
        session = try SKTestSession(configurationFileNamed: "Products")
        session.disableDialogs = true
        // The session's settings outlive it within the run, so a test that
        // turns on Ask to Buy or failing transactions would leak into the
        // next. resetToDefaultState() would cover them, but it also stopped
        // the session serving the file's products.
        session.askToBuyEnabled = false
        session.failTransactionsEnabled = false
        session.clearTransactions()
        plugin = makePlugin()
    }

    override func tearDown() async throws {
        // XCTest keeps every test case alive until the run ends, so without
        // this each test's plugin would keep finishing later tests' updates.
        plugin = nil
        session = nil
    }

    private func makePlugin() -> CupStorePlugin {
        let plugin = CupStorePlugin()
        plugin.load()
        return plugin
    }

    private func call(_ method: (CupStorePlugin) -> (CAPPluginCall) -> Void) async -> Outcome {
        await withCheckedContinuation { continuation in
            let call = CAPPluginCall(callbackId: "test", methodName: "test", options: [:], success: { result, _ in
                guard let owned = result?.data?["owned"] as? Bool else {
                    continuation.resume(returning: .rejected("resolved without owned"))
                    return
                }
                continuation.resume(returning: .owned(owned))
            }, error: { error in
                continuation.resume(returning: .rejected(error?.message ?? ""))
            })!
            method(plugin)(call)
        }
    }

    private func expect(
        _ method: (CupStorePlugin) -> (CAPPluginCall) -> Void,
        _ expected: Outcome,
        line: UInt = #line
    ) async {
        let outcome = await call(method)
        XCTAssertEqual(outcome, expected, line: line)
    }

    /** StoreKit hands a refund or an approval over a moment after the session records it, so this asks again until it shows. */
    private func expectEventually(owned: Bool, line: UInt = #line) async throws {
        var outcome = await call(CupStorePlugin.ownsPro)
        for _ in 0..<60 where outcome != .owned(owned) {
            try await Task.sleep(nanoseconds: 50_000_000)
            outcome = await call(CupStorePlugin.ownsPro)
        }
        XCTAssertEqual(outcome, .owned(owned), line: line)
    }

    func testTheConfigurationSellsPro() async throws {
        let product = try await Product.products(for: [CupStorePlugin.proProductId]).first
        XCTAssertEqual(product?.type, .nonConsumable)
    }

    func testABuyIsStillOwnedAtTheNextLaunch() async {
        await expect(CupStorePlugin.ownsPro, .owned(false))
        await expect(CupStorePlugin.buyPro, .owned(true))
        // A fresh plugin stands in for the next launch.
        plugin = makePlugin()
        await expect(CupStorePlugin.ownsPro, .owned(true))
    }

    func testARefundTakesProAway() async throws {
        await expect(CupStorePlugin.buyPro, .owned(true))
        let transaction = try XCTUnwrap(session.allTransactions().first)
        try session.refundTransaction(identifier: transaction.identifier)
        try await expectEventually(owned: false)
    }

    func testADeletedPurchaseIsNotOwned() async throws {
        await expect(CupStorePlugin.buyPro, .owned(true))
        let transaction = try XCTUnwrap(session.allTransactions().first)
        try session.deleteTransaction(identifier: transaction.identifier)
        try await expectEventually(owned: false)
    }

    func testAskToBuyIsNotOwnedUntilAParentApproves() async throws {
        session.askToBuyEnabled = true
        await expect(CupStorePlugin.buyPro, .owned(false))
        await expect(CupStorePlugin.ownsPro, .owned(false))
        let transaction = try XCTUnwrap(session.allTransactions().first)
        try session.approveAskToBuyTransaction(identifier: transaction.identifier)
        try await expectEventually(owned: true)
    }

    /** Only guards against a declined request being counted as a purchase, as a pending one already reads as not owned. */
    func testAskToBuyDeclinedStaysLocked() async throws {
        session.askToBuyEnabled = true
        await expect(CupStorePlugin.buyPro, .owned(false))
        let transaction = try XCTUnwrap(session.allTransactions().first)
        try session.declineAskToBuyTransaction(identifier: transaction.identifier)
        await expect(CupStorePlugin.ownsPro, .owned(false))
    }

    /** The sheet says a buy failed only when the plugin rejects, rather than resolving as cancelled. */
    func testAFailedBuyRejects() async {
        session.failTransactionsEnabled = true
        await expect(CupStorePlugin.buyPro, .rejected("The purchase failed"))
        await expect(CupStorePlugin.ownsPro, .owned(false))
    }

    func testRestoreFindsOnlyWhatWasBought() async {
        await expect(CupStorePlugin.restorePro, .owned(false))
        await expect(CupStorePlugin.buyPro, .owned(true))
        await expect(CupStorePlugin.restorePro, .owned(true))
    }
}
