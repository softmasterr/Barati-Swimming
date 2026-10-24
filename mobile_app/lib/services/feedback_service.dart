import 'package:flutter/services.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:flutter/material.dart';

enum FeedbackType { success, warning, error }

class FeedbackService {
  static const MethodChannel _audioChannel = MethodChannel('com.barati.swimming/audio');

  static void trigger(FeedbackType type, String message) {
    // 1. Play loud physical hardware beep via native Android ToneGenerator
    _playNativeBeep(type);

    // 2. Trigger Haptic Vibration & Visual Toast
    switch (type) {
      case FeedbackType.success:
        HapticFeedback.lightImpact();
        Fluttertoast.showToast(
          msg: message,
          toastLength: Toast.LENGTH_SHORT,
          gravity: ToastGravity.TOP,
          backgroundColor: const Color(0xFF10B981),
          textColor: Colors.white,
          fontSize: 14.0,
        );
        break;

      case FeedbackType.warning:
        HapticFeedback.mediumImpact();
        Future.delayed(const Duration(milliseconds: 150), () {
          HapticFeedback.mediumImpact();
        });
        Fluttertoast.showToast(
          msg: message,
          toastLength: Toast.LENGTH_LONG,
          gravity: ToastGravity.TOP,
          backgroundColor: const Color(0xFFF59E0B),
          textColor: Colors.black,
          fontSize: 14.0,
        );
        break;

      case FeedbackType.error:
        HapticFeedback.heavyImpact();
        Future.delayed(const Duration(milliseconds: 150), () {
          HapticFeedback.heavyImpact();
        });
        Fluttertoast.showToast(
          msg: message,
          toastLength: Toast.LENGTH_LONG,
          gravity: ToastGravity.TOP,
          backgroundColor: const Color(0xFFEF4444),
          textColor: Colors.white,
          fontSize: 14.0,
        );
        break;
    }
  }

  static void _playNativeBeep(FeedbackType type) async {
    try {
      final typeStr = type == FeedbackType.success
          ? 'success'
          : type == FeedbackType.warning
              ? 'warning'
              : 'error';
      await _audioChannel.invokeMethod('playBeep', {'type': typeStr});
    } catch (_) {
      SystemSound.play(SystemSoundType.click);
    }
  }
}
