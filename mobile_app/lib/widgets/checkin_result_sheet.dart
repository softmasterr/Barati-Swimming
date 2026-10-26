import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import '../models/athlete.dart';
import '../models/coach.dart';
import 'recharge_athlete_dialog.dart';

class CheckinResultSheet extends StatelessWidget {
  final Map<String, dynamic> result;

  const CheckinResultSheet({super.key, required this.result});

  static void show(BuildContext context, Map<String, dynamic> result) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CheckinResultSheet(result: result),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = result['status'] as String? ?? 'approved';
    final title = result['title'] as String? ?? '';
    final sub = result['sub'] as String? ?? '';
    final athlete = result['athlete'] as Athlete?;
    final coach = result['coach'] as Coach?;
    final smsText = result['smsText'] as String?;
    final poolName = result['poolName'] as String? ?? '';

    Color bannerColor;
    IconData statusIcon;

    if (status == 'approved' || status == 'coach_entry') {
      bannerColor = const Color(0xFF10B981);
      statusIcon = status == 'coach_entry' ? Icons.sports : Icons.check_circle_rounded;
    } else if (status == 'warning') {
      bannerColor = const Color(0xFFF59E0B);
      statusIcon = Icons.warning_amber_rounded;
    } else {
      bannerColor = const Color(0xFFEF4444);
      statusIcon = Icons.cancel_rounded;
    }

    final currencyFormat = NumberFormat('#,###', 'fa');

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Status Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: bannerColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: bannerColor.withOpacity(0.4)),
            ),
            child: Row(
              children: [
                Icon(statusIcon, color: bannerColor, size: 36),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              style: TextStyle(
                                color: bannerColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                              ),
                            ),
                          ),
                          if (poolName.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: bannerColor.withOpacity(0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                poolName,
                                style: TextStyle(color: bannerColor, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        sub,
                        style: TextStyle(color: Colors.grey[700], fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Coach Profile if Coach Entry
          if (athlete == null && coach != null) ...[
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: const Color(0xFF0284C7).withOpacity(0.15),
                  child: const Icon(Icons.sports, color: Color(0xFF0284C7), size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        coach.name,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
                      ),
                      Text(
                        'مربی رسمی آکادمی • ${coach.specialty}',
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                      if (poolName.isNotEmpty)
                        Text(
                          'محل حضور: $poolName',
                          style: const TextStyle(color: Color(0xFF0284C7), fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
          ],

          // Athlete Profile if recognized
          if (athlete != null) ...[
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: const Color(0xFF0284C7).withOpacity(0.15),
                  child: Text(
                    athlete.name.isNotEmpty ? athlete.name[0] : 'و',
                    style: const TextStyle(
                      color: Color(0xFF0284C7),
                      fontWeight: FontWeight.bold,
                      fontSize: 20,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        athlete.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 17,
                        ),
                      ),
                      if (coach != null)
                        Text(
                          'مربی: ${coach.name}',
                          style: TextStyle(color: Colors.grey[600], fontSize: 13),
                        ),
                      Text(
                        athlete.phone,
                        style: TextStyle(color: Colors.grey[500], fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Metrics Grid
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('مانده جلسات', style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(
                          '${athlete.remainingSessions} جلسه',
                          style: const TextStyle(
                            color: Color(0xFF0284C7),
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('وضعیت تسویه', style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                        const SizedBox(height: 4),
                        Text(
                          athlete.debt > 0
                              ? '${currencyFormat.format(athlete.debt)} ت بدهی'
                              : 'تسویه کامل',
                          style: TextStyle(
                            color: athlete.debt > 0 ? const Color(0xFFEF4444) : const Color(0xFF10B981),
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // SMS Notification Box
            if (smsText != null)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFA7F3D0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.send_rounded, color: Color(0xFF059669), size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'پیامک خودکار به والدین ارسال شد: $smsText',
                        style: const TextStyle(color: Color(0xFF065F46), fontSize: 11),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
          ],

          if (athlete != null && athlete.remainingSessions <= 0) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.autorenew_rounded),
                label: const Text('تمدید دوره و شارژ مجدد همین حالا', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                onPressed: () {
                  Navigator.pop(context);
                  RechargeAthleteDialog.show(context, athlete);
                },
              ),
            ),
          ],

          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () => Navigator.pop(context),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF0284C7),
                side: const BorderSide(color: Color(0xFF0284C7)),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('بستن و ادامه اسکن', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}
