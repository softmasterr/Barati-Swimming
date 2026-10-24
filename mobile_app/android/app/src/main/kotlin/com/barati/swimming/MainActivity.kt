package com.barati.swimming

import android.media.AudioManager
import android.media.ToneGenerator
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.barati.swimming/audio"
    private var toneGenerator: ToneGenerator? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        try {
            // Use STREAM_MUSIC with volume 100 for loud, reliable hardware feedback
            toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "playBeep" -> {
                    val type = call.argument<String>("type") ?: "success"
                    try {
                        if (toneGenerator == null) {
                            toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
                        }
                        when (type) {
                            "success" -> {
                                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP2, 180)
                            }
                            "warning" -> {
                                toneGenerator?.startTone(ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE, 250)
                            }
                            "error" -> {
                                toneGenerator?.startTone(ToneGenerator.TONE_PROP_NACK, 350)
                            }
                        }
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("AUDIO_ERROR", e.localizedMessage, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onDestroy() {
        toneGenerator?.release()
        toneGenerator = null
        super.onDestroy()
    }
}
