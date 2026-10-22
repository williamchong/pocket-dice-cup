import Capacitor
import StoreKit

/**
 * Sells and checks Pro, one non-consumable purchase, through StoreKit 2, as
 * android/.../CupStorePlugin.java does through Play Billing; keep the two in
 * step. The page asks through app/engine/store/unlock.ts, and only ever learns
 * whether Pro is owned: no receipt or account leaves the phone.
 */
@objc(CupStorePlugin)
public class CupStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CupStorePlugin"
    public let jsName = "CupStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "ownsPro", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buyPro", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePro", returnType: CAPPluginReturnPromise),
    ]

    /** The product's id in App Store Connect, the same as in the Play Console. */
    static let proProductId = "pro"

    private var updates: Task<Void, Never>?

    override public func load() {
        // A purchase can complete outside a buy: approved by a parent with Ask
        // to Buy, made on another device, or refunded. StoreKit hands these
        // over here, and each must be finished or it is handed over again.
        updates = Task {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result { await transaction.finish() }
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    /** Whether a verified, unrevoked Pro transaction is among the phone's current entitlements. */
    private static func owned() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == proProductId,
               transaction.revocationDate == nil {
                return true
            }
        }
        return false
    }

    @objc func ownsPro(_ call: CAPPluginCall) {
        Task { call.resolve(["owned": await Self.owned()]) }
    }

    /**
     * Resolves owned false when the buyer cancels, or when the purchase waits
     * on a parent's approval, which arrives later through `Transaction.updates`
     * and is seen at the next launch's check.
     */
    @objc func buyPro(_ call: CAPPluginCall) {
        Task {
            do {
                guard let product = try await Product.products(for: [Self.proProductId]).first else {
                    call.reject("Pro is not on sale in this App Store")
                    return
                }
                switch try await product.purchase() {
                case .success(.verified(let transaction)):
                    await transaction.finish()
                    call.resolve(["owned": true])
                case .success(.unverified(_, let error)):
                    call.reject("The purchase could not be verified", nil, error)
                case .userCancelled, .pending:
                    call.resolve(["owned": false])
                @unknown default:
                    call.resolve(["owned": await Self.owned()])
                }
            } catch {
                call.reject("The purchase failed", nil, error)
            }
        }
    }

    /** Asks the App Store for the account's purchases, which may sign the buyer in, then checks again. */
    @objc func restorePro(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["owned": await Self.owned()])
            } catch StoreKitError.userCancelled {
                call.resolve(["owned": await Self.owned()])
            } catch {
                call.reject("The App Store could not be reached", nil, error)
            }
        }
    }
}
