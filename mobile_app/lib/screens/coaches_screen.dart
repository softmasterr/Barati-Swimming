import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../models/coach.dart';

class CoachesScreen extends StatelessWidget {
  const CoachesScreen({super.key});

  void _showSettleCoachDialog(BuildContext context, Coach coach, int payable) {
    final amountCtrl = TextEditingController(text: payable > 0 ? payable.toString() : '500000');
    final refCtrl = TextEditingController();
    final provider = context.read<AcademyProvider>();
    final currency = NumberFormat('#,###', 'fa');

    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text('تسویه‌حساب با ${coach.name}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('مانده طلب فعلی مربی: ${currency.format(payable)} تومان', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 13)),
              const SizedBox(height: 12),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'مبلغ واریز به حساب مربی (تومان)', isDense: true),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: refCtrl,
                decoration: const InputDecoration(labelText: 'شماره پیگیری پایا / ساتنا', isDense: true),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7), foregroundColor: Colors.white),
              onPressed: () {
                final amount = int.tryParse(amountCtrl.text.trim()) ?? 0;
                if (amount > 0) {
                  provider.settleCoach(coach.id, amount, refCtrl.text.trim());
                  Navigator.pop(ctx);
                }
              },
              child: const Text('ثبت واریز'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AcademyProvider>();
    final coaches = provider.coaches;
    final athletes = provider.athletes;
    final currency = NumberFormat('#,###', 'fa');

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: coaches.length,
          itemBuilder: (ctx, i) {
            final coach = coaches[i];
            final assigned = athletes.where((a) => a.coachId == coach.id).toList();
            final totalAttended = assigned.fold(0, (sum, a) => sum + a.totalAttended);

            int totalEarned = 0;
            if (coach.modelType == 'percentage') {
              final tuitionSum = assigned.fold(0, (sum, a) => sum + a.tuitionFee);
              totalEarned = ((tuitionSum * coach.modelVal) / 100).round();
            } else if (coach.modelType == 'per_session') {
              totalEarned = totalAttended * coach.modelVal;
            } else if (coach.modelType == 'monthly_fixed') {
              totalEarned = coach.modelVal;
            }

            final payable = totalEarned > coach.settledAmount ? totalEarned - coach.settledAmount : 0;

            return Card(
              margin: const EdgeInsets.only(bottom: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              elevation: 1,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: const Color(0xFF0284C7),
                          child: Text(
                            coach.name.isNotEmpty ? coach.name[coach.name.length - 1] : 'م',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(coach.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                              Text(coach.specialty, style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                              const SizedBox(height: 2),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE0E7FF),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  coach.modelLabel,
                                  style: const TextStyle(color: Color(0xFF4338CA), fontSize: 10, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Stats Grid
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey[50],
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey[200]!),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStat('شاگردان', '${assigned.length} نفر'),
                          _buildStat('حضورها', '$totalAttended سانس'),
                          _buildStat('کارکرد کل', '${currency.format(totalEarned)} ت'),
                          _buildStat('واریزشده', '${currency.format(coach.settledAmount)} ت'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Settlement Action
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('مانده طلب مربی:', style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                            Text(
                              '${currency.format(payable)} تومان',
                              style: TextStyle(
                                color: payable > 0 ? const Color(0xFFD97706) : Colors.green,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0284C7),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          ),
                          icon: const Icon(Icons.payment_rounded, size: 16),
                          label: const Text('تسویه‌حساب دستمزد', style: TextStyle(fontSize: 12)),
                          onPressed: () => _showSettleCoachDialog(context, coach, payable),
                        ),
                      ],
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

  Widget _buildStat(String label, String value) {
    return Column(
      children: [
        Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 10)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
      ],
    );
  }
}
