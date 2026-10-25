import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:provider/provider.dart';
import '../models/athlete.dart';
import '../models/definition_item.dart';
import '../providers/academy_provider.dart';

class RechargeAthleteDialog extends StatefulWidget {
  final Athlete athlete;

  const RechargeAthleteDialog({super.key, required this.athlete});

  static void show(BuildContext context, Athlete athlete) {
    showDialog(
      context: context,
      builder: (ctx) => RechargeAthleteDialog(athlete: athlete),
    );
  }

  @override
  State<RechargeAthleteDialog> createState() => _RechargeAthleteDialogState();
}

class _RechargeAthleteDialogState extends State<RechargeAthleteDialog> {
  final TextEditingController _paidCtrl = TextEditingController();
  final TextEditingController _customSessionsCtrl = TextEditingController();
  final TextEditingController _customPriceCtrl = TextEditingController();

  String _selectedPackageName = '';
  int _selectedSessions = 12;
  int _selectedPrice = 2800000;
  bool _isCustom = false;

  @override
  void initState() {
    super.initState();
    final provider = context.read<AcademyProvider>();
    final courses = provider.getDefinitionsByType('course_type');

    if (courses.isNotEmpty) {
      final first = courses.first;
      _selectedPackageName = first.title;
      _selectedSessions = first.sessions ?? 12;
      _selectedPrice = first.price ?? 2800000;
    } else {
      _selectedPackageName = 'آموزش مقدماتی (۱۲ جلسه)';
      _selectedSessions = 12;
      _selectedPrice = 2800000;
    }
    _paidCtrl.text = _selectedPrice.toString();
  }

  @override
  void dispose() {
    _paidCtrl.dispose();
    _customSessionsCtrl.dispose();
    _customPriceCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AcademyProvider>();
    final courses = provider.getDefinitionsByType('course_type');
    final currency = NumberFormat('#,###', 'fa');

    final paid = int.tryParse(_paidCtrl.text.replaceAll(',', '').trim()) ?? 0;
    final int currentPrice = _isCustom
        ? (int.tryParse(_customPriceCtrl.text.replaceAll(',', '').trim()) ?? 0)
        : _selectedPrice;
    final int currentSessions = _isCustom
        ? (int.tryParse(_customSessionsCtrl.text.trim()) ?? 0)
        : _selectedSessions;
    final int newDebt = currentPrice > paid ? currentPrice - paid : 0;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.autorenew_rounded, color: Color(0xFF10B981), size: 26),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('تمدید دوره و شارژ مجدد', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text(
                    'شناگر: ${widget.athlete.name} (مانده فعلی: ${widget.athlete.remainingSessions} جلسه)',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Package Selector
              const Text('انتخاب پکیج آموزشی تمدید:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              const SizedBox(height: 8),
              if (courses.isNotEmpty)
                DropdownButtonFormField<String>(
                  value: _isCustom ? 'custom' : _selectedPackageName,
                  isExpanded: true,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  items: [
                    ...courses.map((c) => DropdownMenuItem(
                          value: c.title,
                          child: Text(
                            '${c.title} (${c.sessions ?? 12} ج - ${currency.format(c.price ?? 0)} ت)',
                            style: const TextStyle(fontSize: 12),
                          ),
                        )),
                    const DropdownMenuItem(
                      value: 'custom',
                      child: Text('⚙️ پکیج دلخواه و دستی...', style: TextStyle(fontSize: 12, color: Colors.blue)),
                    ),
                  ],
                  onChanged: (val) {
                    if (val == 'custom') {
                      setState(() {
                        _isCustom = true;
                        _customSessionsCtrl.text = '12';
                        _customPriceCtrl.text = '3000000';
                        _paidCtrl.text = '3000000';
                      });
                    } else if (val != null) {
                      final pkg = courses.firstWhere((c) => c.title == val);
                      setState(() {
                        _isCustom = false;
                        _selectedPackageName = pkg.title;
                        _selectedSessions = pkg.sessions ?? 12;
                        _selectedPrice = pkg.price ?? 0;
                        _paidCtrl.text = _selectedPrice.toString();
                      });
                    }
                  },
                )
              else
                DropdownButtonFormField<String>(
                  value: _selectedPackageName,
                  isExpanded: true,
                  decoration: InputDecoration(
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                  items: const [
                    DropdownMenuItem(
                      value: 'آموزش مقدماتی (۱۲ جلسه)',
                      child: Text('آموزش مقدماتی (۱۲ جلسه - ۲,۸۰۰,۰۰۰ ت)', style: TextStyle(fontSize: 12)),
                    ),
                    DropdownMenuItem(
                      value: 'آموزش پیشرفته (۱۲ جلسه)',
                      child: Text('آموزش پیشرفته (۱۲ جلسه - ۳,۵۰۰,۰۰۰ ت)', style: TextStyle(fontSize: 12)),
                    ),
                    DropdownMenuItem(
                      value: 'تیم مسابقات (۲۴ جلسه)',
                      child: Text('تیم مسابقات (۲۴ جلسه - ۵,۸۰۰,۰۰۰ ت)', style: TextStyle(fontSize: 12)),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _selectedPackageName = val;
                        if (val.contains('پیشرفته')) {
                          _selectedSessions = 12;
                          _selectedPrice = 3500000;
                        } else if (val.contains('مسابقات')) {
                          _selectedSessions = 24;
                          _selectedPrice = 5800000;
                        } else {
                          _selectedSessions = 12;
                          _selectedPrice = 2800000;
                        }
                        _paidCtrl.text = _selectedPrice.toString();
                      });
                    }
                  },
                ),

              if (_isCustom) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _customSessionsCtrl,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'تعداد جلسات',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        onChanged: (_) => setState(() {}),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _customPriceCtrl,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'شهریه (تومان)',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        ),
                        onChanged: (val) {
                          _paidCtrl.text = val;
                          setState(() {});
                        },
                      ),
                    ),
                  ],
                ),
              ],

              const SizedBox(height: 14),

              // Payment Field
              TextField(
                controller: _paidCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'مبلغ پرداختی نقدی / پوز (تومان)',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  suffixText: 'تومان',
                ),
                onChanged: (_) => setState(() {}),
              ),

              const SizedBox(height: 14),

              // Summary Box
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.grey[300]!),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('تعداد جلسات اضافه شونده:', style: TextStyle(fontSize: 12)),
                        Text('+$currentSessions جلسه',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('شهریه پکیج دوره:', style: TextStyle(fontSize: 12)),
                        Text('${currency.format(currentPrice)} تومان',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('مانده بدهی جدید:', style: TextStyle(fontSize: 12)),
                        Text(
                          newDebt > 0 ? '${currency.format(newDebt)} تومان' : 'تسویه کامل',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                            color: newDebt > 0 ? Colors.red : Colors.green,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '⚡ پس از تایید، پیامک تمدید دوره به صورت خودکار به اولیاء ارسال شده و مبلغ پرداختی در دفتر مالی ثبت خواهد شد.',
                style: TextStyle(color: Colors.grey, fontSize: 10, height: 1.5),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('انصراف', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.check_circle_rounded, size: 18),
            label: const Text('تایید و تمدید دوره'),
            onPressed: () {
              if (currentSessions <= 0 || currentPrice < 0) return;

              final pkgTitle = _isCustom ? 'پکیج دستی ($currentSessions جلسه)' : _selectedPackageName;
              provider.rechargeAthlete(
                athleteId: widget.athlete.id,
                packageName: pkgTitle,
                sessions: currentSessions,
                price: currentPrice,
                initialPaid: paid,
              );
              Navigator.pop(context);
            },
          ),
        ],
      ),
    );
  }
}
