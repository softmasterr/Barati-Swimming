import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';

class PoolSelectionDialog extends StatefulWidget {
  final bool isDismissible;

  const PoolSelectionDialog({super.key, this.isDismissible = true});

  static Future<void> show(BuildContext context, {bool isDismissible = true}) {
    return showDialog(
      context: context,
      barrierDismissible: isDismissible,
      builder: (ctx) => PoolSelectionDialog(isDismissible: isDismissible),
    );
  }

  @override
  State<PoolSelectionDialog> createState() => _PoolSelectionDialogState();
}

class _PoolSelectionDialogState extends State<PoolSelectionDialog> {
  late String _selectedPool;
  final TextEditingController _newPoolCtrl = TextEditingController();
  bool _isAddingCustom = false;

  @override
  void initState() {
    super.initState();
    final provider = context.read<AcademyProvider>();
    _selectedPool = provider.activePoolName;
  }

  @override
  void dispose() {
    _newPoolCtrl.dispose();
    super.dispose();
  }

  void _handleConfirm() {
    final provider = context.read<AcademyProvider>();
    if (_isAddingCustom && _newPoolCtrl.text.trim().isNotEmpty) {
      final newName = _newPoolCtrl.text.trim();
      provider.addRegisteredPool(newName);
      provider.setActivePoolName(newName);
    } else {
      provider.setActivePoolName(_selectedPool);
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AcademyProvider>();
    final registeredPools = provider.registeredPools;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: PopScope(
        canPop: widget.isDismissible,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          contentPadding: const EdgeInsets.fromLTRB(20, 10, 20, 10),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF0284C7).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.pool_rounded, color: Color(0xFF0284C7), size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'انتخاب استخر فعال',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'محل تردد شناگران، مربیان و ثبت هزینه‌ها',
                      style: TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'لطفاً استخری که در حال حاضر در آن مستقر هستید را انتخاب نمایید:',
                    style: TextStyle(fontSize: 12, color: Color(0xFF475569)),
                  ),
                  const SizedBox(height: 12),

                  // Pools list
                  ...registeredPools.map((pool) {
                    final isSelected = !_isAddingCustom && _selectedPool == pool;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFFF0F9FF) : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? const Color(0xFF0284C7) : Colors.grey[300]!,
                          width: isSelected ? 1.8 : 1.0,
                        ),
                      ),
                      child: RadioListTile<String>(
                        value: pool,
                        groupValue: _isAddingCustom ? '' : _selectedPool,
                        activeColor: const Color(0xFF0284C7),
                        title: Text(
                          pool,
                          style: TextStyle(
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            color: isSelected ? const Color(0xFF0284C7) : Colors.black89,
                            fontSize: 13,
                          ),
                        ),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _selectedPool = val;
                              _isAddingCustom = false;
                            });
                          }
                        },
                      ),
                    );
                  }),

                  // Add New Pool Option
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    decoration: BoxDecoration(
                      color: _isAddingCustom ? const Color(0xFFF0FDF4) : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _isAddingCustom ? const Color(0xFF16A34A) : Colors.grey[300]!,
                        width: _isAddingCustom ? 1.8 : 1.0,
                      ),
                    ),
                    child: RadioListTile<String>(
                      value: '__CUSTOM__',
                      groupValue: _isAddingCustom ? '__CUSTOM__' : '',
                      activeColor: const Color(0xFF16A34A),
                      title: const Text(
                        'ثبت و انتخاب استخر جدید...',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      onChanged: (_) {
                        setState(() {
                          _isAddingCustom = true;
                        });
                      },
                    ),
                  ),

                  if (_isAddingCustom) ...[
                    const SizedBox(height: 10),
                    TextField(
                      controller: _newPoolCtrl,
                      autofocus: true,
                      decoration: InputDecoration(
                        labelText: 'نام استخر جدید',
                        hintText: 'مثال: استخر کوثر، استخر آزادی...',
                        prefixIcon: const Icon(Icons.add_business_rounded),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          actions: [
            if (widget.isDismissible)
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('انصراف'),
              ),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              icon: const Icon(Icons.check_rounded, size: 18),
              label: const Text('تایید و ورود', style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: _handleConfirm,
            ),
          ],
        ),
      ),
    );
  }
}
