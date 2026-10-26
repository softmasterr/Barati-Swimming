import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../models/athlete.dart';

class NewCardDetectedDialog extends StatelessWidget {
  final String uid;

  const NewCardDetectedDialog({super.key, required this.uid});

  static void show(BuildContext context, String uid) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => NewCardDetectedDialog(uid: uid),
    );
  }

  void _showLinkToExistingAthlete(BuildContext context) {
    final provider = context.read<AcademyProvider>();
    final athletes = provider.athletes;

    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('انتخاب ورزشکار جهت پیوند کارت', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          content: SizedBox(
            width: double.maxFinite,
            child: athletes.isEmpty
                ? const Text('ورزشکاری در سیستم ثبت نشده است')
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: athletes.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (c, i) {
                      final a = athletes[i];
                      return ListTile(
                        dense: true,
                        title: Text(a.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('کارت فعلی: ${a.cardUid.isEmpty ? "ندارد" : a.cardUid} • تلفن: ${a.phone}', style: const TextStyle(fontSize: 11)),
                        trailing: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0284C7),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                            visualDensity: VisualDensity.compact,
                          ),
                          onPressed: () {
                            provider.assignNfcCard(a.id, uid);
                            Navigator.pop(ctx); // Close picker
                            Navigator.pop(context); // Close parent dialog
                          },
                          child: const Text('اتصال این کارت', style: TextStyle(fontSize: 11)),
                        ),
                      );
                    },
                  ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
          ],
        ),
      ),
    );
  }

  void _showNewAthleteRegistration(BuildContext context) {
    final provider = context.read<AcademyProvider>();
    final coaches = provider.coaches;
    final packages = provider.getDefinitionsByType('course_type');

    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final initialPaidCtrl = TextEditingController();

    String selectedCoach = coaches.isNotEmpty ? coaches.first.id : '';
    String selectedPkg = packages.isNotEmpty ? packages.first.title : 'آموزش مقدماتی (۱۲ جلسه)';
    int sessions = packages.isNotEmpty ? (packages.first.sessions ?? 12) : 12;
    int price = packages.isNotEmpty ? (packages.first.price ?? 2800000) : 2800000;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return Directionality(
            textDirection: TextDirection.rtl,
            child: AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Text('ثبت‌نام ورزشکار با کارت $uid', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0F2FE),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.nfc, color: Color(0xFF0284C7), size: 18),
                          const SizedBox(width: 6),
                          Text('شناسه مچ‌بند: $uid', style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFF0369A1))),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'نام و نام خانوادگی ورزشکار *', isDense: true),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(labelText: 'شماره موبایل (جهت پیامک) *', isDense: true),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: selectedCoach,
                      decoration: const InputDecoration(labelText: 'مربی اختصاصی', isDense: true),
                      items: coaches.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                      onChanged: (val) => setDialogState(() => selectedCoach = val ?? ''),
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: selectedPkg,
                      decoration: const InputDecoration(labelText: 'پکیج آموزشی', isDense: true),
                      items: packages.isNotEmpty
                          ? packages.map((pkg) {
                              final currency = NumberFormat('#,###', 'fa');
                              return DropdownMenuItem(
                                value: pkg.title,
                                child: Text('${pkg.title} (${pkg.sessions ?? 0} جلسه - ${currency.format(pkg.price ?? 0)} ت)'),
                              );
                            }).toList()
                          : const [
                              DropdownMenuItem(value: 'آموزش مقدماتی (۱۲ جلسه)', child: Text('آموزش مقدماتی (۱۲ جلسه - ۲,۸۰۰,۰۰۰ ت)')),
                              DropdownMenuItem(value: 'آموزش پیشرفته (۱۲ جلسه)', child: Text('آموزش پیشرفته (۱۲ جلسه - ۳,۵۰۰,۰۰۰ ت)')),
                              DropdownMenuItem(value: 'تیم مسابقات (۲۴ جلسه)', child: Text('تیم مسابقات (۲۴ جلسه - ۵,۸۰۰,۰۰۰ ت)')),
                            ],
                      onChanged: (val) {
                        if (val == null) return;
                        setDialogState(() {
                          selectedPkg = val;
                          if (packages.isNotEmpty) {
                            try {
                              final found = packages.firstWhere((p) => p.title == val);
                              sessions = found.sessions ?? 12;
                              price = found.price ?? 0;
                            } catch (_) {}
                          } else {
                            if (val.contains('پیشرفته')) {
                              sessions = 12; price = 3500000;
                            } else if (val.contains('مسابقات')) {
                              sessions = 24; price = 5800000;
                            } else {
                              sessions = 12; price = 2800000;
                            }
                          }
                        });
                      },
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: initialPaidCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'مبلغ پرداختی علی‌الحساب (تومان)', isDense: true),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7), foregroundColor: Colors.white),
                  onPressed: () {
                    final name = nameCtrl.text.trim();
                    final phone = phoneCtrl.text.trim();
                    if (name.isEmpty || phone.isEmpty) return;

                    final paid = int.tryParse(initialPaidCtrl.text.trim()) ?? 0;
                    provider.registerAthlete(
                      name: name,
                      phone: phone,
                      coachId: selectedCoach,
                      packageName: selectedPkg,
                      sessions: sessions,
                      price: price,
                      initialPaid: paid,
                      cardUid: uid,
                    );
                    Navigator.pop(ctx);
                    Navigator.pop(context);
                  },
                  child: const Text('ثبت‌نام و اتصال کارت'),
                ),
              ],
            ),
          );
        },
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
                color: const Color(0xFF0284C7).withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.nfc_rounded, color: Color(0xFF0284C7), size: 26),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: const Text(
                'شناسایی کارت/مچ‌بند جدید',
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
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.grey[300]!),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('کد سخت‌افزاری UID:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  Text(
                    uid,
                    style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'این کارت در سیستم ثبت نشده است. مایلید در همین لحظه آن را چگونه ثبت کنید؟',
              style: TextStyle(fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 16),

            // Option 1: Register New Athlete
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.person_add_rounded, size: 20),
                label: const Text('ثبت‌نام ورزشکار جدید با این کارت', style: TextStyle(fontWeight: FontWeight.bold)),
                onPressed: () => _showNewAthleteRegistration(context),
              ),
            ),
            const SizedBox(height: 10),

            // Option 2: Link to Existing Athlete
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  side: const BorderSide(color: Color(0xFF0284C7)),
                ),
                icon: const Icon(Icons.link_rounded, color: Color(0xFF0284C7), size: 20),
                label: const Text('پیوند دادن به یکی از شاگردان فعلی', style: TextStyle(color: Color(0xFF0284C7), fontWeight: FontWeight.bold)),
                onPressed: () => _showLinkToExistingAthlete(context),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('انصراف و بستن', style: TextStyle(color: Colors.grey)),
          ),
        ],
      ),
    );
  }
}
