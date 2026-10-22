import UIKit
import WebKit
import Capacitor

class DiceCupViewController: CAPBridgeViewController {
    /// The launch screen, held over the web view until the dice are ready.
    private var launchCover: UIView?

    override open func capacitorDidLoad() {
        // The plugins live in the app rather than in a package, so Capacitor
        // does not find them on their own.
        bridge?.registerPluginInstance(CupHapticsPlugin())
        bridge?.registerPluginInstance(CupMotionPlugin())
        bridge?.registerPluginInstance(CupStorePlugin())
        coverUntilReady()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // The phone lies on the table showing a result. The web Wake Lock is
        // not reliable in a WebView, so keep the screen on natively.
        UIApplication.shared.isIdleTimerDisabled = true
    }

    /// The web view draws nothing until the engine has loaded, and shows bare
    /// felt meanwhile, so the page's own loading screen never gets on screen
    /// here. A copy of the launch screen stands in for it, rolling its die as
    /// the page's does, until the page says the dice are ready (hideSplash in
    /// app/utils/splash.ts), or after 15 s in case the page failed first.
    private func coverUntilReady() {
        guard let webView, let cover = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view else { return }
        cover.frame = webView.bounds
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        if let die = cover.viewWithTag(DieFaces.tag) as? UIImageView {
            die.animationImages = DieFaces.images()
            die.animationDuration = DieFaces.cycle
            die.startAnimating()
        }
        webView.addSubview(cover)
        launchCover = cover
        webView.configuration.userContentController.add(CupReadyHandler(self), name: CupReadyHandler.name)
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in self?.uncover() }
    }

    fileprivate func uncover() {
        guard let cover = launchCover else { return }
        launchCover = nil
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: CupReadyHandler.name)
        // As long as the page's own splash takes to fade (FADE_MS).
        UIView.animate(withDuration: 0.4, animations: { cover.alpha = 0 }, completion: { _ in cover.removeFromSuperview() })
    }
}

/// Passes the page's message on without the web view holding the controller.
private class CupReadyHandler: NSObject, WKScriptMessageHandler {
    static let name = "cupReady"
    private weak var controller: DiceCupViewController?

    init(_ controller: DiceCupViewController) {
        self.controller = controller
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        controller?.uncover()
    }
}

/// The faces the loading die turns up, drawn as app/spa-loading-template.html
/// draws them: the 5 of the launch screen first, each tipped its own way.
private enum DieFaces {
    /// The die's image view in LaunchScreen.storyboard.
    static let tag = 1
    static let cycle: TimeInterval = 1.2
    private static let size: CGFloat = 96
    private static let felt = UIColor(red: 0x12 / 255, green: 0x24 / 255, blue: 0x1b / 255, alpha: 1)
    private static let cream = UIColor(red: 0xf4 / 255, green: 0xef / 255, blue: 0xe3 / 255, alpha: 1)
    private static let faces: [(tilt: CGFloat, pips: [CGPoint])] = [
        (0, [.init(x: 28, y: 28), .init(x: 68, y: 28), .init(x: 48, y: 48), .init(x: 28, y: 68), .init(x: 68, y: 68)]),
        (-8, [.init(x: 28, y: 28), .init(x: 68, y: 68)]),
        (8, [.init(x: 28, y: 28), .init(x: 68, y: 28), .init(x: 28, y: 48), .init(x: 68, y: 48), .init(x: 28, y: 68), .init(x: 68, y: 68)]),
        (-8, [.init(x: 28, y: 28), .init(x: 48, y: 48), .init(x: 68, y: 68)]),
        (8, [.init(x: 48, y: 48)]),
        (-8, [.init(x: 28, y: 28), .init(x: 68, y: 28), .init(x: 28, y: 68), .init(x: 68, y: 68)]),
    ]

    static func images() -> [UIImage] {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return faces.map { face in
            renderer.image { context in
                let cg = context.cgContext
                cg.translateBy(x: size / 2, y: size / 2)
                cg.rotate(by: face.tilt * .pi / 180)
                cg.translateBy(x: -size / 2, y: -size / 2)
                cream.setFill()
                UIBezierPath(roundedRect: CGRect(x: 4, y: 4, width: 88, height: 88), cornerRadius: 20).fill()
                felt.setFill()
                for pip in face.pips {
                    UIBezierPath(ovalIn: CGRect(x: pip.x - 8, y: pip.y - 8, width: 16, height: 16)).fill()
                }
            }
        }
    }
}
