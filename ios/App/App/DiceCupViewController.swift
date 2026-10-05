import UIKit
import Capacitor

class DiceCupViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        // The plugin lives in the app rather than in a package, so Capacitor
        // does not find it on its own.
        bridge?.registerPluginInstance(CoreHapticsPlugin())
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // The phone lies on the table showing a result. The web Wake Lock is
        // not reliable in a WebView, so keep the screen on natively.
        UIApplication.shared.isIdleTimerDisabled = true
    }
}
