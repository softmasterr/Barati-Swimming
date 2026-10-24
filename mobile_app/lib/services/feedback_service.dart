import 'package:flutter/services.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:flutter/material.dart';

enum FeedbackType { success, warning, error }

class FeedbackService {
  static void trigger(FeedbackType type, String message) {
    switch (type) {
      case FeedbackType.success:
        HapticFeedback.lightImpact();
        SystemSound.play(SystemSoundType.click);
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
        SystemSound.play(SystemSoundType.alert);
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
        SystemSound.play(SystemSoundType.alert);
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
}
