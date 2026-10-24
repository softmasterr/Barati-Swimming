import 'package:flutter/material.dart';
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

  void _showAddDialog(String type) {
    final titleCtrl = TextEditingController();
    final codeCtrl = TextEditingController();
    final descCtrl = TextEditingController();

    String typeLabel = '';
    String titleHint = '';
    if (type == 'cost_center') {
      typeLabel = 'مرکز هزینه جدید';
      titleHint = 'نام مرکز هزینه (مثلاً: تاسیسات و موتورخانه)';
    } else if (type == 'goods_item') {
      typeLabel = 'دسته / نوع کالای جدید';
      titleHint = 'نام کالا یا تجهیزات (مثلاً: عینک شنا Speedo)';
    } else {
      typeLabel = 'پکیج آموزشی جدید';
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
                    hintText: type == 'cost_center' ? 'مثلاً: CC-105' : 'مثلاً: GD-01',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
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

                final newItem = DefinitionItem(
                  id: 'def-${DateTime.now().millisecondsSinceEpoch}',
                  type: type,
                  title: title,
                  code: codeCtrl.text.trim(),
                  description: descCtrl.text.trim(),
                );

                context.read<AcademyProvider>().addDefinition(newItem);
                Navigator.pop(ctx);
              },
              child: const Text('ذخیره تعریف'),
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
              onPressed: () => _showAddDialog(type),
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
                if (item.code.isNotEmpty)
                  Text(
                    'شناسه: ${item.code}',
                    style: TextStyle(color: Colors.grey[700], fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                if (item.description != null && item.description!.isNotEmpty)
                  Text(
                    item.description!,
                    style: TextStyle(color: Colors.grey[600], fontSize: 11),
                  ),
              ],
            ),
            trailing: IconButton(
              icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
              tooltip: 'حذف مورد',
              onPressed: () => _confirmDelete(item),
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
          title: const Text('مدیریت تعاریف پایه', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
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
                icon: const Icon(Icons.account_balance_rounded, size: 20),
                text: 'مراکز هزینه (${costCenters.length})',
              ),
              Tab(
                icon: const Icon(Icons.inventory_2_rounded, size: 20),
                text: 'انواع کالا (${goods.length})',
              ),
              Tab(
                icon: const Icon(Icons.school_rounded, size: 20),
                text: 'دوره‌های آموزشی (${courses.length})',
              ),
            ],
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildListTab(costCenters, 'cost_center', Icons.account_balance_rounded, const Color(0xFF4F46E5)),
            _buildListTab(goods, 'goods_item', Icons.inventory_2_rounded, const Color(0xFF0D9488)),
            _buildListTab(courses, 'course_type', Icons.school_rounded, const Color(0xFF0284C7)),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(
          backgroundColor: const Color(0xFF0284C7),
          foregroundColor: Colors.white,
          icon: const Icon(Icons.add_rounded),
          label: const Text('تعریف جدید'),
          onPressed: () {
            final idx = _tabController.index;
            final type = idx == 0 ? 'cost_center' : (idx == 1 ? 'goods_item' : 'course_type');
            _showAddDialog(type);
          },
        ),
      ),
    );
  }
}
