import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';

class AccountingScreen extends StatelessWidget {
  const AccountingScreen({super.key});

  void _showNewExpenseDialog(BuildContext context) {
    final titleCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final customPoolCtrl = TextEditingController();
    String category = 'اجاره سانس استخر';
    final provider = context.read<AcademyProvider>();
    String selectedPool = provider.activePoolName;
    bool isCustomPool = false;

    final pools = List<String>.from(provider.registeredPools);
    if (!pools.contains(selectedPool)) {
      pools.insert(0, selectedPool);
    }

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return Directionality(
            textDirection: TextDirection.rtl,
            child: AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(Icons.receipt_long_rounded, color: Color(0xFFEF4444)),
                  SizedBox(width: 8),
                  Text('ثبت هزینه استخر / تجهیزات', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Pool Selection Dropdown
                    DropdownButtonFormField<String>(
                      value: isCustomPool ? '__CUSTOM__' : selectedPool,
                      decoration: const InputDecoration(
                        labelText: 'نام استخر مرتبط *',
                        prefixIcon: Icon(Icons.pool_rounded, color: Color(0xFF0284C7)),
                        isDense: true,
                      ),
                      items: [
                        ...pools.map((p) => DropdownMenuItem(value: p, child: Text(p))),
                        const DropdownMenuItem(value: '__CUSTOM__', child: Text('+ استخر دیگر (ورود دستی)')),
                      ],
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            if (val == '__CUSTOM__') {
                              isCustomPool = true;
                            } else {
                              isCustomPool = false;
                              selectedPool = val;
                            }
                          });
                        }
                      },
                    ),
                    if (isCustomPool) ...[
                      const SizedBox(height: 8),
                      TextField(
                        controller: customPoolCtrl,
                        autofocus: true,
                        decoration: const InputDecoration(
                          labelText: 'نام استخر را بنویسید...',
                          hintText: 'مثال: استخر موج طلایی',
                          prefixIcon: Icon(Icons.edit_location_alt_rounded),
                          isDense: true,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),

                    DropdownButtonFormField<String>(
                      value: category,
                      decoration: const InputDecoration(labelText: 'دسته‌بندی هزینه', isDense: true),
                      items: const [
                        DropdownMenuItem(value: 'اجاره سانس استخر', child: Text('اجاره سانس استخر')),
                        DropdownMenuItem(value: 'خرید تجهیزات و وسایل شنا', child: Text('خرید تجهیزات شنا')),
                        DropdownMenuItem(value: 'شارژ و نگهداری مجموعه', child: Text('شارژ و نگهداری')),
                        DropdownMenuItem(value: 'متفرقه', child: Text('سایر هزینه‌ها')),
                      ],
                      onChanged: (val) => setDialogState(() => category = val!),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: amountCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'مبلغ هزینه (تومان) *', isDense: true),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: titleCtrl,
                      decoration: const InputDecoration(labelText: 'شرح فاکتور یا توضیحات *', isDense: true),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444), foregroundColor: Colors.white),
                  onPressed: () {
                    final amount = int.tryParse(amountCtrl.text.trim()) ?? 0;
                    final title = titleCtrl.text.trim();
                    final poolName = isCustomPool ? customPoolCtrl.text.trim() : selectedPool;
                    if (amount > 0 && title.isNotEmpty) {
                      provider.recordExpense(
                        category,
                        amount,
                        title,
                        poolName: poolName.isNotEmpty ? poolName : provider.activePoolName,
                      );
                      Navigator.pop(ctx);
                    }
                  },
                  child: const Text('ثبت هزینه'),
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
    final currency = NumberFormat('#,###', 'fa');
    final transactions = provider.transactions;
    final debtors = provider.debtors;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => _showNewExpenseDialog(context),
          backgroundColor: const Color(0xFFEF4444),
          icon: const Icon(Icons.add, color: Colors.white),
          label: const Text('ثبت هزینه استخر', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // KPI Summary Cards
            GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.5,
              children: [
                _buildKpiCard('کل درآمد شهریه‌ها', '${currency.format(provider.totalIncome)} ت', Colors.blue, Icons.monetization_on_rounded),
                _buildKpiCard('سهم مربیان', '${currency.format(provider.totalCoachFees)} ت', Colors.orange, Icons.pool_rounded),
                _buildKpiCard('مخارج و اجاره استخر', '${currency.format(provider.totalExpenses)} ت', Colors.red, Icons.receipt_long_rounded),
                _buildKpiCard('سود خالص سرمربی', '${currency.format(provider.netProfit)} ت', Colors.green, Icons.trending_up_rounded),
              ],
            ),
            const SizedBox(height: 12),

            // Outstanding Debtors Summary
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('کل مطالبات بدهی ورزشکاران:', style: TextStyle(color: Color(0xFF991B1B), fontSize: 12)),
                      Text('${currency.format(provider.totalDebts)} تومان', style: const TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.bold, fontSize: 16)),
                      Text('${debtors.length} ورزشکار دارای مانده بدهی', style: TextStyle(color: Colors.grey[700], fontSize: 11)),
                    ],
                  ),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFFDC2626),
                      elevation: 0,
                      side: const BorderSide(color: Color(0xFFFECACA)),
                    ),
                    icon: const Icon(Icons.sms_rounded, size: 16),
                    label: const Text('پیامک یادآوری', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('پیامک یادآوری بدهی برای ${debtors.length} نفر ارسال شد.')),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Transactions Ledger
            const Text('دفتر روزنامه تراکنش‌های مالی', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(height: 10),

            if (transactions.isEmpty)
              const Center(child: Padding(padding: EdgeInsets.all(20), child: Text('تراکنشی ثبت نشده است')))
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: transactions.length,
                itemBuilder: (ctx, i) {
                  final tx = transactions[i];
                  final isIncome = tx.type == 'income';
                  final isExpense = tx.type == 'expense';

                  Color badgeColor = isIncome ? Colors.green : isExpense ? Colors.red : Colors.orange;
                  String typeLabel = isIncome ? 'دریافت شهریه' : isExpense ? 'هزینه استخر' : 'دستمزد مربی';

                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0.5,
                    child: ListTile(
                      dense: true,
                      leading: CircleAvatar(
                        radius: 16,
                        backgroundColor: badgeColor.withOpacity(0.12),
                        child: Icon(
                          isIncome ? Icons.arrow_downward : Icons.arrow_upward,
                          color: badgeColor,
                          size: 16,
                        ),
                      ),
                      title: Text(tx.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      subtitle: Text(
                        '${tx.date} • ${tx.method}${tx.poolName.isNotEmpty ? " • استخر: ${tx.poolName}" : ""} • ${tx.author}',
                        style: TextStyle(color: Colors.grey[600], fontSize: 11),
                      ),
                      trailing: Text(
                        '${currency.format(tx.amount)} ت',
                        style: TextStyle(
                          color: badgeColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: TextStyle(color: Colors.grey[600], fontSize: 11)),
              Icon(icon, color: color, size: 20),
            ],
          ),
          Text(
            value,
            style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 15),
          ),
        ],
      ),
    );
  }
}
