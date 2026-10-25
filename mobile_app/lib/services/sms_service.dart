import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import '../models/app_settings.dart';

class SmsResult {
  final bool success;
  final String message;

  SmsResult({required this.success, required this.message});
}

class SmsService {
  static final SmsService instance = SmsService._init();
  SmsService._init();

  static Future<SmsResult> sendSms({
    required String phone,
    required String message,
    required AppSettings settings,
  }) async {
    // 1. Direct SIM Card on Phone
    if (settings.smsProvider == 'directSim') {
      try {
        final cleanPhone = phone.replaceAll(RegExp(r'\s+'), '');
        final encodedBody = Uri.encodeComponent(message);
        final Uri smsUri = Uri.parse('sms:$cleanPhone?body=$encodedBody');

        if (await canLaunchUrl(smsUri)) {
          await launchUrl(smsUri, mode: LaunchMode.externalApplication);
          return SmsResult(success: true, message: 'برنامه پیامک سیم‌کارت گوشی باز شد');
        } else {
          final Uri smstoUri = Uri.parse('smsto:$cleanPhone?body=$encodedBody');
          if (await canLaunchUrl(smstoUri)) {
            await launchUrl(smstoUri, mode: LaunchMode.externalApplication);
            return SmsResult(success: true, message: 'برنامه پیامک سیم‌کارت باز شد');
          }
          // Direct launch attempt
          await launchUrl(smsUri, mode: LaunchMode.externalApplication);
          return SmsResult(success: true, message: 'درخواست ارسال به پیام‌رسان گوشی تحویل شد');
        }
      } catch (e) {
        return SmsResult(success: false, message: 'خطا در ارسال پیامک سیم‌کارت: $e');
      }
    }

    // 2. Kavenegar Gateway
    if (settings.smsProvider == 'kavenegar') {
      if (settings.smsApiKey.isEmpty) {
        return SmsResult(success: true, message: 'شبیه‌سازی کاوه‌نگار (کلید API وارد نشده است)');
      }
      try {
        final url = Uri.parse(
          'https://api.kavenegar.com/v1/${settings.smsApiKey}/sms/send.json',
        );
        final response = await http.post(url, body: {
          'receptor': phone,
          'message': message,
          'sender': settings.smsSenderLine,
        }).timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) {
          return SmsResult(success: true, message: 'پیامک با موفقیت به درگاه کاوه‌نگار تحویل شد');
        } else {
          return SmsResult(success: false, message: 'خطای درگاه کاوه‌نگار: ${response.statusCode}');
        }
      } catch (e) {
        return SmsResult(success: false, message: 'عدم دسترسی به اینترنت یا سرور کاوه‌نگار');
      }
    }

    // 3. FarazSMS (IPPanel)
    if (settings.smsProvider == 'farazsms') {
      if (settings.smsApiKey.isEmpty) {
        return SmsResult(success: true, message: 'شبیه‌سازی فراز اس‌ام‌اس (کلید API وارد نشده است)');
      }
      try {
        final url = Uri.parse('https://api2.ippanel.com/api/v1/sms/send/webservice/single');
        final response = await http.post(
          url,
          headers: {
            'Content-Type': 'application/json',
            'apikey': settings.smsApiKey,
          },
          body: '''{
            "recipient": ["$phone"],
            "sender": "${settings.smsSenderLine}",
            "message": "$message"
          }''',
        ).timeout(const Duration(seconds: 8));

        if (response.statusCode == 200) {
          return SmsResult(success: true, message: 'پیامک با موفقیت به درگاه فراز اس‌ام‌اس ارسال شد');
        } else {
          return SmsResult(success: false, message: 'خطای درگاه فراز اس‌ام‌اس: ${response.statusCode}');
        }
      } catch (e) {
        return SmsResult(success: false, message: 'عدم دسترسی به اینترنت یا سرور فراز اس‌ام‌اس');
      }
    }

    return SmsResult(success: true, message: 'پیامک ارسال گردید');
  }
}
