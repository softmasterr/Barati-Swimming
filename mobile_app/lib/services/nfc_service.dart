import 'package:flutter/foundation.dart';
import 'package:nfc_manager/nfc_manager.dart';

typedef NfcScanCallback = void Function(String uid);

class NfcService {
  static final NfcService instance = NfcService._init();
  NfcService._init();

  bool _isListening = false;
  NfcScanCallback? _onTagScanned;

  bool get isListening => _isListening;

  Future<bool> isNfcAvailable() async {
    try {
      return await NfcManager.instance.isAvailable();
    } catch (e) {
      debugPrint('NFC Availability check error: $e');
      return false;
    }
  }

  void startListening(NfcScanCallback callback) async {
    _onTagScanned = callback;
    final available = await isNfcAvailable();
    if (!available) {
      debugPrint('NFC hardware not available or turned off');
      return;
    }

    if (_isListening) return;

    try {
      _isListening = true;
      NfcManager.instance.startSession(
        onDiscovered: (NfcTag tag) async {
          final uid = _extractUid(tag);
          if (uid != null && uid.isNotEmpty) {
            _onTagScanned?.call(uid);
          }
        },
      );
      debugPrint('NFC Service started global listening');
    } catch (e) {
      _isListening = false;
      debugPrint('NFC start session error: $e');
    }
  }

  void stopListening() {
    try {
      if (_isListening) {
        NfcManager.instance.stopSession();
        _isListening = false;
        debugPrint('NFC Service stopped session');
      }
    } catch (e) {
      debugPrint('NFC stop session error: $e');
    }
  }

  String? _extractUid(NfcTag tag) {
    try {
      final data = tag.data;
      List<int>? identifier;

      if (data.containsKey('nfca')) {
        identifier = List<int>.from(data['nfca']['identifier'] ?? []);
      } else if (data.containsKey('mifareclassic')) {
        identifier = List<int>.from(data['mifareclassic']['identifier'] ?? []);
      } else if (data.containsKey('mifareultralight')) {
        identifier = List<int>.from(data['mifareultralight']['identifier'] ?? []);
      } else if (data.containsKey('isodep')) {
        identifier = List<int>.from(data['isodep']['identifier'] ?? []);
      } else if (data.containsKey('ndef')) {
        identifier = List<int>.from(data['ndef']['identifier'] ?? []);
      }

      if (identifier != null && identifier.isNotEmpty) {
        final hex = identifier.map((e) => e.toRadixString(16).padLeft(2, '0').toUpperCase()).join('');
        return 'NFC-$hex';
      }
    } catch (e) {
      debugPrint('Error parsing NFC tag UID: $e');
    }
    return null;
  }
}
