import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';

class SmsScreen extends StatelessWidget {
  const SmsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AcademyProvider>();
    final logs = provider.smsLogs;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: logs.isEmpty
            ? const Center(child: Text('هیچ پیامکی ثبت نشده است', style: TextStyle(color: Colors.grey)))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: logs.length,
                itemBuilder: (ctx, i) {
                  final sms = logs[i];
                  final isPending = sms.status.contains('صف');

                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0.5,
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(
                                    isPending ? Icons.hourglass_top_rounded : Icons.check_circle_rounded,
                                    size: 16,
                                    color: isPending ? Colors.orange : Colors.green,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    sms.event,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                ],
                              ),
                              Text(sms.time, style: TextStyle(color: Colors.grey[500], fontSize: 11)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text('گیرنده: ${sms.receiver}', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(10),
                            width: double.infinity,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              sms.text,
                              style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B)),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              sms.status,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: isPending ? Colors.orange[800] : Colors.green[700],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
