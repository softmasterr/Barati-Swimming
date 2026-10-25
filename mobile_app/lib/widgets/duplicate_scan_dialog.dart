import 'package:flutter/material.dart';
import '../models/athlete.dart';

class DuplicateScanDialog extends StatelessWidget {
  final Athlete athlete;
  final int minutesAgo;
  final String lastTime;
  final VoidCallback onConfirm;

  const DuplicateScanDialog({
    super.key,
    required this.athlete,
    required this.minutesAgo,
    required this.lastTime,
    required this.onConfirm,
  });

  static void show(
    BuildContext context, {
    required Athlete athlete,
    required int minutesAgo,
    required String lastTime,
    required VoidCallback onConfirm,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => DuplicateScanDialog(
        athlete: athlete,
        minutesAgo: minutesAgo,
        lastTime: lastTime,
        onConfirm: onConfirm,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.amber.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.timer_rounded, color: Colors.orange, size: 26),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'تردد مکرر در کمتر از ۱ ساعت',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[300]!),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'شناگر: ${athlete.name}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'ورود قبلی: ساعت $lastTime ($minutesAgo دقیقه پیش)',
                    style: TextStyle(color: Colors.grey[700], fontSize: 12),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'مانده جلسات فعلی: ${athlete.remainingSessions} جلسه',
                    style: const TextStyle(color: Color(0xFF0284C7), fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'این شناگر در فاصله زمانی کمتر از ۱ ساعت مجدداً کارت زده است.\nآیا مایلید یک جلسه دیگر از اعتبار ایشان کسر شده و ورود دوم ثبت گردد؟',
              style: TextStyle(fontSize: 13, height: 1.6),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('لغو ورود (بدون کسر جلسه)', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0284C7),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.check_rounded, size: 18),
            label: const Text('تایید و کسر ۱ جلسه مجدد'),
            onPressed: () {
              Navigator.pop(context);
              onConfirm();
            },
          ),
        ],
      ),
    );
  }
}
