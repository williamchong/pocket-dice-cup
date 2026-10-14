package cloud.williamchong.pocketdicecup;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plays the taps of the dice on the cup through the vibrator, as the iOS
 * shell's CupHapticsPlugin.swift does through Core Haptics. The stock
 * Capacitor haptics plugin only has a few fixed impact styles.
 *
 * Phones differ in what their motor can play, so each tap is the best of:
 * a click or a low tick at the hit's strength, where the phone has those
 * primitives (Android 11+, most phones with a good motor); a pulse at the
 * hit's strength, where it controls the amplitude; or a pulse whose length
 * grows with the hit, as the web's navigator.vibrate plays it.
 */
@CapacitorPlugin(name = "CupHaptics")
public class CupHapticsPlugin extends Plugin {

    /** Pulse lengths (ms) for the softest and the hardest hit without amplitude control, as VibrateBackend's. */
    private static final int SHORTEST_PULSE_MS = 8;
    private static final int LONGEST_PULSE_MS = 30;

    /** Pulse lengths (ms) with amplitude control: shorter feels crisper. */
    private static final int CRISP_PULSE_MS = 10;
    private static final int SOFT_PULSE_MS = 20;

    /** From this sharpness up a tap is a click; below it, a low tick (cupFeedback.ts: floor 0.2, the rest 0.8). */
    private static final float CRISP_SHARPNESS = 0.5f;

    /** Null where the phone has no vibrator, and then every tap is skipped. */
    private Vibrator vibrator;
    private boolean hasPrimitives;
    private boolean hasAmplitudeControl;
    // As media rather than touch feedback, so the phone's touch vibration
    // setting does not silence the dice; the media vibration setting does.
    // One or the other, by Android version.
    private VibrationAttributes vibrationAttributes;
    private AudioAttributes audioAttributes;

    @Override
    public void load() {
        Vibrator found = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            ? ((VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator()
            : (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        if (found == null || !found.hasVibrator()) return;
        vibrator = found;
        hasPrimitives = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
            && vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK, VibrationEffect.Composition.PRIMITIVE_LOW_TICK);
        // Asked once: before Android 12 it is a call to the vibrator service.
        hasAmplitudeControl = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator.hasAmplitudeControl();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            vibrationAttributes = VibrationAttributes.createForUsage(VibrationAttributes.USAGE_MEDIA);
        } else {
            audioAttributes = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).build();
        }
    }

    // Fire and forget: a shake plays about 30 taps a second, and none of them
    // is worth a reply over the bridge.
    @PluginMethod(returnType = PluginMethod.RETURN_NONE)
    public void playTransient(PluginCall call) {
        if (vibrator == null) return;
        float intensity = Math.max(0, Math.min(1, call.getFloat("intensity", 1f)));
        boolean crisp = call.getFloat("sharpness", 0.5f) >= CRISP_SHARPNESS;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            vibrator.vibrate(pulseLength(intensity));
            return;
        }
        VibrationEffect effect;
        if (hasPrimitives) {
            int primitive = crisp ? VibrationEffect.Composition.PRIMITIVE_CLICK : VibrationEffect.Composition.PRIMITIVE_LOW_TICK;
            effect = VibrationEffect.startComposition().addPrimitive(primitive, intensity).compose();
        } else if (hasAmplitudeControl) {
            effect = VibrationEffect.createOneShot(crisp ? CRISP_PULSE_MS : SOFT_PULSE_MS, Math.max(1, Math.round(intensity * 255)));
        } else {
            effect = VibrationEffect.createOneShot(pulseLength(intensity), VibrationEffect.DEFAULT_AMPLITUDE);
        }
        if (vibrationAttributes != null) {
            vibrator.vibrate(effect, vibrationAttributes);
        } else {
            vibrator.vibrate(effect, audioAttributes);
        }
    }

    private static int pulseLength(float intensity) {
        return Math.round(SHORTEST_PULSE_MS + intensity * (LONGEST_PULSE_MS - SHORTEST_PULSE_MS));
    }
}
