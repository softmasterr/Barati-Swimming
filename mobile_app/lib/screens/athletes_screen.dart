import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../models/athlete.dart';
import '../models/coach.dart';

class AthletesScreen extends StatefulWidget {
  const AthletesScreen({super.key});

  @override
  State<AthletesScreen> createState() => _AthletesScreenState();
}

class _AthletesScreenState extends State<AthletesScreen> {
  String _searchQuery = '';
  String _selectedCoachId = 'all';
  String _selectedStatus = 'all';

  void _showNewAthleteDialog() {
    final provider = context.read<AcademyProvider>();
    final coaches = provider.coaches;

    final nameCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final initialPaidCtrl = TextEditingController();
    final uidCtrl = TextEditingController();

    String selectedCoach = coaches.isNotEmpty ? coaches.first.id : '';
    String selectedPkg = 'آموزش مقدماتی (۱۲ جلسه)';
    int sessions = 12;
    int price = 2800000;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return Directionality(
            textDirection: TextDirection.rtl,
            child: AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: const Text('ثبت‌نام ورزشکار جدید', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: nameCtrl,
                      decoration: const InputDecoration(labelText: 'نام و نام خانوادگی *', isDense: true),
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
                      items: const [
                        DropdownMenuItem(value: 'آموزش مقدماتی (۱۲ جلسه)', child: Text('آموزش مقدماتی (۱۲ جلسه - ۲,۸۰۰,۰۰۰ ت)')),
                        DropdownMenuItem(value: 'آموزش پیشرفته (۱۲ جلسه)', child: Text('آموزش پیشرفته (۱۲ جلسه - ۳,۵۰۰,۰۰۰ ت)')),
                        DropdownMenuItem(value: 'تیم مسابقات (۲۴ جلسه)', child: Text('تیم مسابقات (۲۴ جلسه - ۵,۸۰۰,۰۰۰ ت)')),
                      ],
                      onChanged: (val) {
                        setDialogState(() {
                          selectedPkg = val!;
                          if (val.contains('پیشرفته')) {
                            sessions = 12; price = 3500000;
                          } else if (val.contains('مسابقات')) {
                            sessions = 24; price = 5800000;
                          } else {
                            sessions = 12; price = 2800000;
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
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: uidCtrl,
                            decoration: const InputDecoration(labelText: 'شناسه مچ‌بند NFC (اختیاری)', isDense: true),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.casino_outlined, color: Color(0xFF0284C7)),
                          tooltip: 'تولید شناسه تصادفی',
                          onPressed: () {
                            final rand = (1000 + DateTime.now().microsecond % 9000).toString();
                            uidCtrl.text = 'NFC-$rand';
                          },
                        ),
                      ],
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
                      cardUid: uidCtrl.text.trim(),
                    );
                    Navigator.pop(ctx);
                  },
                  child: const Text('ثبت‌نام'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showAssignCardDialog(Athlete athlete) {
    final uidCtrl = TextEditingController(text: athlete.cardUid);
    final provider = context.read<AcademyProvider>();

    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text('تخصیص مچ‌بند به ${athlete.name}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('کد سخت‌افزاری UID مچ‌بند یا کارت NFC را وارد کنید:', style: TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 12),
              TextField(
                controller: uidCtrl,
                decoration: InputDecoration(
                  labelText: 'شناسه NFC',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.casino),
                    onPressed: () {
                      final rand = (DateTime.now().millisecondsSinceEpoch % 10000).toRadixString(16).toUpperCase();
                      uidCtrl.text = 'NFC-$rand';
                    },
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7), foregroundColor: Colors.white),
              onPressed: () {
                final uid = uidCtrl.text.trim();
                if (uid.isNotEmpty) {
                  provider.assignNfcCard(athlete.id, uid);
                  Navigator.pop(ctx);
                }
              },
              child: const Text('ذخیره و اتصال'),
            ),
          ],
        ),
      ),
    );
  }

  void _showPaymentDialog(Athlete athlete) {
    final amountCtrl = TextEditingController(text: athlete.debt > 0 ? athlete.debt.toString() : '');
    final noteCtrl = TextEditingController();
    String method = 'کارتخوان پوز استخر';
    final provider = context.read<AcademyProvider>();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return Directionality(
            textDirection: TextDirection.rtl,
            child: AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Text('دریافت شهریه - ${athlete.name}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('مانده بدهی فعلی: ${NumberFormat('#,###', 'fa').format(athlete.debt)} تومان', style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: amountCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'مبلغ دریافتی (تومان)', isDense: true),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: method,
                    decoration: const InputDecoration(labelText: 'روش پرداخت', isDense: true),
                    items: const [
                      DropdownMenuItem(value: 'کارتخوان پوز استخر', child: Text('کارتخوان پوز استخر')),
                      DropdownMenuItem(value: 'کارت‌به‌کارت', child: Text('کارت‌به‌کارت')),
                      DropdownMenuItem(value: 'وجه نقد به مربی', child: Text('وجه نقد به مربی')),
                    ],
                    onChanged: (val) => setDialogState(() => method = val!),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: noteCtrl,
                    decoration: const InputDecoration(labelText: 'شماره پیگیری فیش / توضیحات', isDense: true),
                  ),
                ],
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981), foregroundColor: Colors.white),
                  onPressed: () {
                    final amount = int.tryParse(amountCtrl.text.trim()) ?? 0;
                    if (amount > 0) {
                      provider.recordPayment(athlete.id, amount, method, noteCtrl.text.trim());
                      Navigator.pop(ctx);
                    }
                  },
                  child: const Text('ثبت دریافت'),
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
    final provider = context.watch<AcademyProvider>();
    final coaches = provider.coaches;
    final currency = NumberFormat('#,###', 'fa');

    final filtered = provider.athletes.where((a) {
      final matchesSearch = _searchQuery.isEmpty ||
          a.name.contains(_searchQuery) ||
          a.phone.contains(_searchQuery) ||
          a.cardUid.contains(_searchQuery);

      final matchesCoach = _selectedCoachId == 'all' || a.coachId == _selectedCoachId;

      bool matchesStatus = true;
      if (_selectedStatus == 'debt') matchesStatus = a.debt > 0;
      if (_selectedStatus == 'active') matchesStatus = a.remainingSessions > 0;
      if (_selectedStatus == 'expired') matchesStatus = a.remainingSessions == 0;

      return matchesSearch && matchesCoach && matchesStatus;
    }).toList();

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: _showNewAthleteDialog,
          backgroundColor: const Color(0xFF0284C7),
          icon: const Icon(Icons.person_add_rounded, color: Colors.white),
          label: const Text('ثبت‌نام جدید', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
        body: Column(
          children: [
            // Filter Bar
            Container(
              padding: const EdgeInsets.all(12),
              color: Colors.white,
              child: Column(
                children: [
                  TextField(
                    decoration: InputDecoration(
                      hintText: 'جستجو بر اساس نام، تلفن یا UID...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      isDense: true,
                    ),
                    onChanged: (val) => setState(() => _searchQuery = val.trim()),
                  ),
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        FilterChip(
                          label: const Text('همه وضعیت‌ها', style: TextStyle(fontSize: 11)),
                          selected: _selectedStatus == 'all',
                          onSelected: (_) => setState(() => _selectedStatus = 'all'),
                        ),
                        const SizedBox(width: 6),
                        FilterChip(
                          label: const Text('دارای بدهی', style: TextStyle(fontSize: 11)),
                          selected: _selectedStatus == 'debt',
                          onSelected: (_) => setState(() => _selectedStatus = 'debt'),
                        ),
                        const SizedBox(width: 6),
                        FilterChip(
                          label: const Text('اعتبار فعال', style: TextStyle(fontSize: 11)),
                          selected: _selectedStatus == 'active',
                          onSelected: (_) => setState(() => _selectedStatus = 'active'),
                        ),
                        const SizedBox(width: 6),
                        FilterChip(
                          label: const Text('پایان یافته', style: TextStyle(fontSize: 11)),
                          selected: _selectedStatus == 'expired',
                          onSelected: (_) => setState(() => _selectedStatus = 'expired'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // Athletes List
            Expanded(
              child: filtered.isEmpty
                  ? const Center(
                      child: Text('ورزشکاری یافت نشد', style: TextStyle(color: Colors.grey)),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: filtered.length,
                      itemBuilder: (ctx, i) {
                        final athlete = filtered[i];
                        final coach = coaches.firstWhere(
                          (c) => c.id == athlete.coachId,
                          orElse: () => Coach(id: '', name: 'نامشخص', specialty: '', modelType: '', modelVal: 0, modelLabel: '', phone: '', settledAmount: 0),
                        );

                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 1,
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 20,
                                      backgroundColor: const Color(0xFF0284C7).withOpacity(0.12),
                                      child: Text(
                                        athlete.name.isNotEmpty ? athlete.name[0] : 'و',
                                        style: const TextStyle(color: Color(0xFF0284C7), fontWeight: FontWeight.bold),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(athlete.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                          Text('مربی: ${coach.name} • ${athlete.packageName}', style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          '${athlete.remainingSessions} از ${athlete.totalSessions} جلسه',
                                          style: TextStyle(
                                            color: athlete.remainingSessions == 0
                                                ? Colors.red
                                                : athlete.remainingSessions <= 2
                                                    ? Colors.orange
                                                    : const Color(0xFF0284C7),
                                            fontWeight: FontWeight.bold,
                                            fontSize: 12,
                                          ),
                                        ),
                                        Text(
                                          athlete.debt > 0
                                              ? '${currency.format(athlete.debt)} ت بدهی'
                                              : 'تسویه کامل',
                                          style: TextStyle(
                                            color: athlete.debt > 0 ? Colors.red : Colors.green,
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const Divider(height: 16),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(Icons.nfc, size: 16, color: Colors.grey),
                                        const SizedBox(width: 4),
                                        Text(
                                          athlete.cardUid.isNotEmpty ? athlete.cardUid : 'فاقد کارت',
                                          style: TextStyle(
                                            fontFamily: 'monospace',
                                            fontSize: 11,
                                            color: athlete.cardUid.isNotEmpty ? Colors.blueGrey : Colors.red,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Row(
                                      children: [
                                        OutlinedButton(
                                          style: OutlinedButton.styleFrom(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                            visualDensity: VisualDensity.compact,
                                          ),
                                          onPressed: () => _showAssignCardDialog(athlete),
                                          child: const Text('مچ‌بند', style: TextStyle(fontSize: 11)),
                                        ),
                                        const SizedBox(width: 6),
                                        ElevatedButton(
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFF10B981),
                                            foregroundColor: Colors.white,
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                                            visualDensity: VisualDensity.compact,
                                          ),
                                          onPressed: () => _showPaymentDialog(athlete),
                                          child: const Text('دریافت', style: TextStyle(fontSize: 11)),
                                        ),
                                      ],
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
          ],
        ),
      ),
    );
  }
}
