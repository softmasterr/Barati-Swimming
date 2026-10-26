import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../models/coach.dart';

class CoachesScreen extends StatelessWidget {
  const CoachesScreen({super.key});

  void _showAddOrEditCoachDialog(BuildContext context, [Coach? coach]) {
    final isEditing = coach != null;
    final nameCtrl = TextEditingController(text: isEditing ? coach.name : '');
    final specialtyCtrl = TextEditingController(text: isEditing ? coach.specialty : '');
    final phoneCtrl = TextEditingController(text: isEditing ? coach.phone : '');
    String selectedModelType = isEditing ? coach.modelType : 'percentage';
    final modelValCtrl = TextEditingController(text: isEditing ? coach.modelVal.toString() : '35');
    final provider = context.read<AcademyProvider>();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            title: Row(
              children: [
                Icon(
                  isEditing ? Icons.edit_rounded : Icons.person_add_rounded,
                  color: const Color(0xFF0284C7),
                ),
                const SizedBox(width: 8),
                Text(
                  isEditing ? 'ویرایش مشخصات مربی' : 'ثبت مربی جدید',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: nameCtrl,
                    decoration: InputDecoration(
                      labelText: 'نام و نام خانوادگی مربی *',
                      hintText: 'مثلاً: استاد براتی',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: specialtyCtrl,
                    decoration: InputDecoration(
                      labelText: 'تخصص / رده آموزشی',
                      hintText: 'مثلاً: کرال سینه و کرال پشت',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(
                      labelText: 'شماره تماس مربی',
                      hintText: '۰۹۱۲۳۴۵۶۷۸۹',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text('مدل قرارداد مالی و محاسبه دستمزد:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: selectedModelType,
                    decoration: InputDecoration(
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'percentage',
                        child: Text('درصدی از شهریه شاگردان (%)'),
                      ),
                      DropdownMenuItem(
                        value: 'per_session',
                        child: Text('حق‌الزحمه به ازای هر سانس / جلسه (تومان)'),
                      ),
                      DropdownMenuItem(
                        value: 'monthly_fixed',
                        child: Text('حقوق ثابت ماهانه (تومان)'),
                      ),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() {
                          selectedModelType = val;
                          if (val == 'percentage' && (int.tryParse(modelValCtrl.text) ?? 0) > 100) {
                            modelValCtrl.text = '35';
                          } else if (val == 'per_session' && (int.tryParse(modelValCtrl.text) ?? 0) < 1000) {
                            modelValCtrl.text = '150000';
                          } else if (val == 'monthly_fixed' && (int.tryParse(modelValCtrl.text) ?? 0) < 10000) {
                            modelValCtrl.text = '8000000';
                          }
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: modelValCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: selectedModelType == 'percentage'
                          ? 'درصد مربی از شهریه'
                          : (selectedModelType == 'per_session' ? 'مبلغ هر سانس حضور (تومان)' : 'حقوق ماهانه ثابت (تومان)'),
                      suffixText: selectedModelType == 'percentage' ? '%' : 'تومان',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('انصراف'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  final name = nameCtrl.text.trim();
                  if (name.isEmpty) return;

                  final specialty = specialtyCtrl.text.trim().isNotEmpty ? specialtyCtrl.text.trim() : 'مربی شنا';
                  final phone = phoneCtrl.text.trim();
                  final modelVal = int.tryParse(modelValCtrl.text.trim()) ?? (selectedModelType == 'percentage' ? 35 : 150000);

                  String modelLabel = '';
                  if (selectedModelType == 'percentage') {
                    modelLabel = 'درصدی ($modelVal%)';
                  } else if (selectedModelType == 'per_session') {
                    modelLabel = 'جلسه‌ای (${NumberFormat('#,###', 'fa').format(modelVal)} ت)';
                  } else {
                    modelLabel = 'حقوق ثابت (${NumberFormat('#,###', 'fa').format(modelVal)} ت)';
                  }

                  if (isEditing) {
                    provider.updateCoachDetails(
                      id: coach.id,
                      name: name,
                      specialty: specialty,
                      modelType: selectedModelType,
                      modelVal: modelVal,
                      modelLabel: modelLabel,
                      phone: phone,
                    );
                  } else {
                    provider.addCoach(
                      name: name,
                      specialty: specialty,
                      modelType: selectedModelType,
                      modelVal: modelVal,
                      modelLabel: modelLabel,
                      phone: phone,
                    );
                  }
                  Navigator.pop(ctx);
                },
                child: Text(isEditing ? 'ذخیره تغییرات' : 'ثبت مربی'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDeleteCoach(BuildContext context, Coach coach, int assignedAthletesCount) {
    if (assignedAthletesCount > 0) {
      showDialog(
        context: context,
        builder: (ctx) => Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Colors.orange),
                SizedBox(width: 8),
                Text('عدم امکان حذف مربی', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              ],
            ),
            content: Text(
              'مربی «${coach.name}» در حال حاضر دارای $assignedAthletesCount شاگرد فعال در سیستم است. لطفاً ابتدا مربی شاگردان را تغییر داده و سپس اقدام به حذف نمایید.',
              style: const TextStyle(height: 1.5),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('متوجه شدم')),
            ],
          ),
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('تایید حذف مربی', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: Text('آیا از حذف مربی «${coach.name}» از لیست مربیان آکادمی اطمینان دارید؟'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red[700], foregroundColor: Colors.white),
              onPressed: () {
                context.read<AcademyProvider>().deleteCoach(coach.id);
                Navigator.pop(ctx);
              },
              child: const Text('حذف مربی'),
            ),
          ],
        ),
      ),
    );
  }

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
        floatingActionButton: FloatingActionButton.extended(
          backgroundColor: const Color(0xFF0284C7),
          foregroundColor: Colors.white,
          icon: const Icon(Icons.person_add_rounded),
          label: const Text('افزودن مربی جدید', style: TextStyle(fontWeight: FontWeight.bold)),
          onPressed: () => _showAddOrEditCoachDialog(context),
        ),
        body: coaches.isEmpty
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.people_outline_rounded, size: 64, color: Colors.grey[400]),
                    const SizedBox(height: 12),
                    Text('هنوز مربی در سیستم تعریف نشده است', style: TextStyle(color: Colors.grey[600], fontSize: 14)),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7), foregroundColor: Colors.white),
                      icon: const Icon(Icons.add),
                      label: const Text('ثبت اولین مربی'),
                      onPressed: () => _showAddOrEditCoachDialog(context),
                    ),
                  ],
                ),
              )
            : ListView.builder(
                padding: const EdgeInsets.only(left: 16, right: 16, top: 16, bottom: 80),
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
                                  coach.name.isNotEmpty ? coach.name[0] : 'م',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(coach.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                        if (coach.phone.isNotEmpty) ...[
                                          const SizedBox(width: 8),
                                          Text(
                                            '(${coach.phone})',
                                            style: TextStyle(color: Colors.grey[500], fontSize: 11),
                                          ),
                                        ],
                                      ],
                                    ),
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
                              // Edit Coach Button
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, color: Color(0xFF0284C7), size: 20),
                                tooltip: 'ویرایش مشخصات مربی',
                                onPressed: () => _showAddOrEditCoachDialog(context, coach),
                              ),
                              // Delete Coach Button
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                                tooltip: 'حذف مربی',
                                onPressed: () => _confirmDeleteCoach(context, coach, assigned.length),
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
