package cloud.williamchong.pocketdicecup;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.List;

/**
 * Sells and checks Pro, one non-consumable purchase, through Play Billing,
 * as the iOS shell's CupStorePlugin.swift does through StoreKit 2; keep the
 * two in step. The page asks through app/engine/store/unlock.ts, and only
 * ever learns whether Pro is owned: no purchase token leaves the phone.
 */
@CapacitorPlugin(name = "CupStore")
public class CupStorePlugin extends Plugin {

    /** The product's id in the Play Console, the same as in App Store Connect. */
    private static final String PRO_PRODUCT_ID = "pro";

    private BillingClient billing;
    /** The buy waiting on the purchase sheet, answered by onPurchasesUpdated, which Play may call on another thread. */
    private volatile PluginCall pendingBuy;

    @Override
    public void load() {
        billing = BillingClient.newBuilder(getContext())
            .setListener(this::onPurchasesUpdated)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            // A call made while the connection to Play is down reconnects first, rather than failing.
            .enableAutoServiceReconnection()
            .build();
        billing.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {}

            @Override
            public void onBillingServiceDisconnected() {}
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (billing != null) billing.endConnection();
    }

    /**
     * Whether `purchases` hold a completed Pro purchase. Each completed one is
     * also acknowledged, which Play needs within 3 days or it refunds the
     * purchase; one that failed to be is acknowledged at the next check.
     */
    private boolean anyPro(List<Purchase> purchases) {
        boolean owned = false;
        for (Purchase purchase : purchases) {
            if (!purchase.getProducts().contains(PRO_PRODUCT_ID) || purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            owned = true;
            if (!purchase.isAcknowledged()) {
                billing.acknowledgePurchase(
                    AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build(),
                    result -> {}
                );
            }
        }
        return owned;
    }

    private static JSObject owned(boolean owned) {
        JSObject answer = new JSObject();
        answer.put("owned", owned);
        return answer;
    }

    @PluginMethod
    public void ownsPro(PluginCall call) {
        billing.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) call.resolve(owned(anyPro(purchases)));
                else call.reject(result.getDebugMessage(), String.valueOf(result.getResponseCode()));
            }
        );
    }

    /**
     * Resolves owned false when the buyer cancels, or when the payment is
     * pending, as cash at a shop, which completes later and is seen at the
     * next launch's check.
     */
    @PluginMethod
    public void buyPro(PluginCall call) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(PRO_PRODUCT_ID)
            .setProductType(BillingClient.ProductType.INAPP)
            .build();
        billing.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(product)).build(),
            (result, details) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || details.getProductDetailsList().isEmpty()) {
                    call.reject("Pro is not on sale in this Play Store", String.valueOf(result.getResponseCode()));
                    return;
                }
                BillingFlowParams flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(
                        BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details.getProductDetailsList().get(0)).build()
                    ))
                    .build();
                // The purchase sheet must be opened from the UI thread.
                getActivity().runOnUiThread(() -> launch(call, flow));
            }
        );
    }

    private void launch(PluginCall call, BillingFlowParams flow) {
        // A buy still held is one whose answer never came, as when the sheet
        // was lost with the app's process; it is let go rather than block every
        // later buy until a relaunch.
        PluginCall held = pendingBuy;
        if (held != null) held.reject("Superseded by a later purchase");
        pendingBuy = call;
        BillingResult launched = billing.launchBillingFlow(getActivity(), flow);
        if (launched.getResponseCode() != BillingClient.BillingResponseCode.OK) {
            // The sheet never opened, so onPurchasesUpdated will not answer.
            pendingBuy = null;
            call.reject(launched.getDebugMessage(), String.valueOf(launched.getResponseCode()));
        }
    }

    /** Play keeps purchases with the Google account, so restoring is asking again. */
    @PluginMethod
    public void restorePro(PluginCall call) {
        ownsPro(call);
    }

    /** Every purchase's outcome, from a buy here or one that completes later, as a pending payment. */
    private void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        int code = result.getResponseCode();
        boolean owned = code == BillingClient.BillingResponseCode.OK && purchases != null && anyPro(purchases);
        PluginCall call = pendingBuy;
        pendingBuy = null;
        if (call == null) return;
        if (code == BillingClient.BillingResponseCode.OK || code == BillingClient.BillingResponseCode.USER_CANCELED) {
            call.resolve(owned(owned));
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            call.resolve(owned(true));
        } else {
            call.reject(result.getDebugMessage(), String.valueOf(code));
        }
    }
}
