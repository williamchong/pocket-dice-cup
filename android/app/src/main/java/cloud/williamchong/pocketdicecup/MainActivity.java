package cloud.williamchong.pocketdicecup;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // The die on the felt (styles.xml), on every Android version, until
        // the web view's first frame shows the page's own loading screen.
        SplashScreen.installSplashScreen(this);
        // The plugins live in the app rather than in a package, so Capacitor
        // does not find them on their own.
        registerPlugin(CupHapticsPlugin.class);
        registerPlugin(CupStorePlugin.class);
        super.onCreate(savedInstanceState);
        // The phone lies on the table showing a result. The web Wake Lock is
        // not reliable in a WebView, so keep the screen on natively.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
