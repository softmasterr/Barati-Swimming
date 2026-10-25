import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../models/definition_item.dart';

class DefinitionsScreen extends StatefulWidget {
  const DefinitionsScreen({super.key});

  @override
  State<DefinitionsScreen> createState() => _DefinitionsScreenState();
}

class _DefinitionsScreenState extends State<DefinitionsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showAddOrEditDialog({String? type, DefinitionItem? existingItem}) {
    final isEditing = existingItem != null;
    final itemType = isEditing ? existingItem.type : (type ?? 'cost_center');

    final titleCtrl = TextEditingController(text: isEditing ? existingItem.title : '');
    final codeCtrl = TextEditingController(text: isEditing ? existingItem.code : '');
    final descCtrl = TextEditingController(text: isEditing ? (existingItem.description ?? '') : '');
    final sessionsCtrl = TextEditingController(text: isEditing ? (existingItem.sessions?.toString() ?? '12') : '12');
    final priceCtrl = TextEditingController(text: isEditing ? (existingItem.price?.toString() ?? '2800000') : '2800000');

    String typeLabel = '';
    String titleHint = '';
    if (itemType == 'cost_center') {
      typeLabel = isEditing ? 'ویرایش مرکز هزینه' : 'مرکز هزینه جدید';
      titleHint = 'نام مرکز هزینه (مثلاً: تاسیسات و موتورخانه)';
    } else if (itemType == 'goods_item') {
      typeLabel = isEditing ? 'ویرایش کالا / تجهیزات' : 'دسته / نوع کالای جدید';
      titleHint = 'نام کالا یا تجهیزات (مثلاً: عینک شنا Speedo)';
    } else {
      typeLabel = isEditing ? 'ویرایش پکیج آموزشی' : 'پکیج آموزشی جدید';
      titleHint = 'نام دوره آموزشی (مثلاً: شنای پیشرفته ۱۲ جلسه)';
    }

    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(typeLabel, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleCtrl,
                  decoration: InputDecoration(
                    labelText: titleHint,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: codeCtrl,
                  decoration: InputDecoration(
                    labelText: 'کد شناسایی یا نماد (اختیاری)',
                    hintText: itemType == 'cost_center'
                        ? 'مثلاً: CC-105'
                        : (itemType == 'goods_item' ? 'مثلاً: GD-01' : 'مثلاً: PKG-BEG'),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                if (itemType == 'course_type') ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: sessionsCtrl,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'تعداد جلسات دوره',
                            hintText: '۱۲',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: priceCtrl,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'شهریه پکیج (تومان)',
                            hintText: '۲,۸۰۰,۰۰۰',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'توضیحات تکمیلی (اختیاری)',
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
                final title = titleCtrl.text.trim();
                if (title.isEmpty) return;

                final sessions = int.tryParse(sessionsCtrl.text.trim()) ?? 12;
                final price = int.tryParse(priceCtrl.text.trim()) ?? 0;

                if (isEditing) {
                  final updatedItem = DefinitionItem(
                    id: existingItem.id,
                    type: existingItem.type,
                    title: title,
                    code: codeCtrl.text.trim(),
                    description: descCtrl.text.trim(),
                    sessions: itemType == 'course_type' ? sessions : null,
                    price: itemType == 'course_type' ? price : null,
                  );
                  context.read<AcademyProvider>().updateDefinition(updatedItem);
                } else {
                  final newItem = DefinitionItem(
                    id: 'def-${DateTime.now().millisecondsSinceEpoch}',
                    type: itemType,
                    title: title,
                    code: codeCtrl.text.trim(),
                    description: descCtrl.text.trim(),
                    sessions: itemType == 'course_type' ? sessions : null,
                    price: itemType == 'course_type' ? price : null,
                  );
                  context.read<AcademyProvider>().addDefinition(newItem);
                }
                Navigator.pop(ctx);
              },
              child: Text(isEditing ? 'ذخیره تغییرات' : 'ذخیره تعریف'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDelete(DefinitionItem item) {
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('حذف تعریف', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: Text('آیا از حذف "${item.title}" اطمینان دارید؟'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[700],
                foregroundColor: Colors.white,
              ),
              onPressed: () {
                context.read<AcademyProvider>().deleteDefinition(item.id);
                Navigator.pop(ctx);
              },
              child: const Text('حذف'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListTab(List<DefinitionItem> items, String type, IconData icon, Color color) {
    final currency = NumberFormat('#,###', 'fa');

    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 60, color: Colors.grey[400]),
            const SizedBox(height: 12),
            const Text(
              'موردی در این دسته تعریف نشده است',
              style: TextStyle(color: Colors.grey, fontSize: 14),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              icon: const Icon(Icons.add_rounded),
              label: const Text('افزودن اولین مورد'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
              ),
              onPressed: () => _showAddOrEditDialog(type: type),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        final isCourse = item.type == 'course_type';

        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          elevation: 1.5,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: color.withOpacity(0.12),
              child: Icon(icon, color: color, size: 22),
            ),
            title: Text(
              item.title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isCourse && item.sessions != null && item.price != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE0F2FE),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '${item.sessions} جلسه',
                          style: const TextStyle(color: Color(0xFF0369A1), fontWeight: FontWeight.bold, fontSize: 11),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'شهریه: ${currency.format(item.price)} تومان',
                        style: const TextStyle(color: Color(0xFF059669), fontWeight: FontWeight.bold, fontSize: 11),
                      ),
                    ],
                  ),
                ],
                if (item.code.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      'شناسه: ${item.code}',
                      style: TextStyle(color: Colors.grey[700], fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                if (item.description != null && item.description!.isNotEmpty)
                  Text(
                    item.description!,
                    style: TextStyle(color: Colors.grey[600], fontSize: 11),
                  ),
              ],
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.edit_outlined, color: Color(0xFF0284C7), size: 20),
                  tooltip: 'ویرایش مورد',
                  onPressed: () => _showAddOrEditDialog(existingItem: item),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
                  tooltip: 'حذف مورد',
                  onPressed: () => _confirmDelete(item),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AcademyProvider>();

    final costCenters = provider.getDefinitionsByType('cost_center');
    final goods = provider.getDefinitionsByType('goods_item');
    final courses = provider.getDefinitionsByType('course_type');

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('مدیریت تعاریف و پکیج‌ها', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          backgroundColor: const Color(0xFF0F172A),
          foregroundColor: Colors.white,
          bottom: TabBar(
            controller: _tabController,
            indicatorColor: const Color(0xFF38BDF8),
            labelColor: const Color(0xFF38BDF8),
            unselectedLabelColor: Colors.grey[400],
            indicatorWeight: 3,
            labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
            tabs: [
              Tab(
                icon: const Icon(Icons.school_rounded, size: 20),
                text: 'پکیج‌های دوره (${courses.length})',
              ),
              Tab(
                icon: const Icon(Icons.account_balance_rounded, size: 20),
                text: 'مراکز هزینه (${costCenters.length})',
              ),
              Tab(
                icon: const Icon(Icons.inventory_2_rounded, size: 20),
                text: 'انواع کالا (${goods.length})',
              ),
            ],
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildListTab(courses, 'course_type', Icons.school_rounded, const Color(0xFF0284C7)),
            _buildListTab(costCenters, 'cost_center', Icons.account_balance_rounded, const Color(0xFF4F46E5)),
            _buildListTab(goods, 'goods_item', Icons.inventory_2_rounded, const Color(0xFF0D9488)),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(
          backgroundColor: const Color(0xFF0284C7),
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add_rounded),
          label: const Text('تعریف جدید'),
          onPressed: () {
            final idx = _tabController.index;
            final type = idx == 0 ? 'course_type' : (idx == 1 ? 'cost_center' : 'goods_item');
            _showAddOrEditDialog(type: type);
          },
        ),
      ),
    );
  }
}
