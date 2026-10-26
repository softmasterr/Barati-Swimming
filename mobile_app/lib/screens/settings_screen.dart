import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../models/app_settings.dart';
import '../models/definition_item.dart';
import '../services/sms_service.dart';
import '../widgets/changelog_dialog.dart';
import 'onboarding_screen.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _academyNameCtrl;
  late TextEditingController _schoolIdCtrl;
  late TextEditingController _licenseKeyCtrl;
  late TextEditingController _subscriptionExpiryCtrl;

  late TextEditingController _serverUrlCtrl;
  late TextEditingController _apiKeyCtrl;

  late TextEditingController _smsApiKeyCtrl;
  late TextEditingController _smsSenderLineCtrl;

  late TextEditingController _smsEntryCtrl;
  late TextEditingController _smsLowBalanceCtrl;
  late TextEditingController _smsRechargeCtrl;

  late TextEditingController _graceSessionsCtrl;
  late TextEditingController _lowSessionsCtrl;
  late TextEditingController _cooldownCtrl;

  late String _smsProvider;
  late bool _autoSync;
  late bool _isDemoMode;

  bool _isTestingServer = false;
  bool _isTestingSms = false;

  @override
  void initState() {
    super.initState();
    final settings = context.read<AcademyProvider>().settings;

    _academyNameCtrl = TextEditingController(text: settings.academyName);
    _schoolIdCtrl = TextEditingController(text: settings.schoolId);
    _licenseKeyCtrl = TextEditingController(text: settings.licenseKey);
    _subscriptionExpiryCtrl = TextEditingController(text: settings.subscriptionExpiry);

    _serverUrlCtrl = TextEditingController(text: settings.serverUrl);
    _apiKeyCtrl = TextEditingController(text: settings.apiKey);

    _smsApiKeyCtrl = TextEditingController(text: settings.smsApiKey);
    _smsSenderLineCtrl = TextEditingController(text: settings.smsSenderLine);

    _smsEntryCtrl = TextEditingController(text: settings.smsEntryTemplate);
    _smsLowBalanceCtrl = TextEditingController(text: settings.smsLowBalanceTemplate);
    _smsRechargeCtrl = TextEditingController(text: settings.smsRechargeTemplate);

    _graceSessionsCtrl = TextEditingController(text: settings.graceSessionsLimit.toString());
    _lowSessionsCtrl = TextEditingController(text: settings.lowSessionsThreshold.toString());
    _cooldownCtrl = TextEditingController(text: settings.cooldownMinutes.toString());

    _smsProvider = settings.smsProvider;
    _autoSync = settings.autoSync;
    _isDemoMode = settings.isDemoMode;
  }

  @override
  void dispose() {
    _academyNameCtrl.dispose();
    _schoolIdCtrl.dispose();
    _licenseKeyCtrl.dispose();
    _subscriptionExpiryCtrl.dispose();
    _serverUrlCtrl.dispose();
    _apiKeyCtrl.dispose();
    _smsApiKeyCtrl.dispose();
    _smsSenderLineCtrl.dispose();
    _smsEntryCtrl.dispose();
    _smsLowBalanceCtrl.dispose();
    _smsRechargeCtrl.dispose();
    _graceSessionsCtrl.dispose();
    _lowSessionsCtrl.dispose();
    _cooldownCtrl.dispose();
    super.dispose();
  }

  void _saveSettings() {
    final provider = context.read<AcademyProvider>();

    final graceLimit = int.tryParse(_graceSessionsCtrl.text.trim()) ?? 1;
    final lowThreshold = int.tryParse(_lowSessionsCtrl.text.trim()) ?? 2;
    final cooldown = int.tryParse(_cooldownCtrl.text.trim()) ?? 60;

    final newSettings = AppSettings(
      academyName: _academyNameCtrl.text.trim(),
      schoolId: _schoolIdCtrl.text.trim(),
      licenseKey: _licenseKeyCtrl.text.trim(),
      subscriptionExpiry: _subscriptionExpiryCtrl.text.trim(),
      subscriptionStatus: provider.settings.subscriptionStatus,
      activePoolName: provider.activePoolName,
      registeredPools: provider.registeredPools,
      serverUrl: _serverUrlCtrl.text.trim(),
      apiKey: _apiKeyCtrl.text.trim(),
      smsProvider: _smsProvider,
      smsApiKey: _smsApiKeyCtrl.text.trim(),
      smsSenderLine: _smsSenderLineCtrl.text.trim(),
      smsEntryTemplate: _smsEntryCtrl.text.trim(),
      smsLowBalanceTemplate: _smsLowBalanceCtrl.text.trim(),
      smsRechargeTemplate: _smsRechargeCtrl.text.trim(),
      graceSessionsLimit: graceLimit,
      lowSessionsThreshold: lowThreshold,
      cooldownMinutes: cooldown,
      autoSync: _autoSync,
      isDemoMode: _isDemoMode,
      isOnboardingCompleted: provider.settings.isOnboardingCompleted,
      appVersion: provider.settings.appVersion,
      lastSeenVersion: provider.settings.lastSeenVersion,
    );

    provider.updateSettings(newSettings);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('تنظیمات با موفقیت ذخیره و اعمال شد'),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _handleDemoModeToggle(bool newValue) {
    final provider = context.read<AcademyProvider>();

    if (!newValue) {
      showDialog(
        context: context,
        builder: (ctx) => Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            title: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
                SizedBox(width: 8),
                Text('خروج از حالت تستی', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
            content: const Text(
              'شما در حال خروج از حالت تستی و آموزشی هستید.\n\n'
              'آیا مایلید اطلاعات تستی ثبت‌شده حذف شوند تا پایگاه داده جهت شروع کار واقعی تمیز و خالی گردد، یا مایلید این داده‌ها حفظ شوند؟',
              style: TextStyle(height: 1.6),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('انصراف'),
              ),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF0284C7),
                  side: const BorderSide(color: Color(0xFF0284C7)),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  setState(() => _isDemoMode = false);
                  provider.toggleDemoMode(clearData: false);
                  _saveSettings();
                },
                child: const Text('حفظ اطلاعات تستی'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red[700],
                  foregroundColor: Colors.white,
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  setState(() => _isDemoMode = false);
                  provider.toggleDemoMode(clearData: true);
                  _saveSettings();
                },
                child: const Text('حذف و پاک‌سازی سیستم'),
              ),
            ],
          ),
        ),
      );
    } else {
      setState(() => _isDemoMode = true);
      provider.toggleDemoMode(clearData: false);
      _saveSettings();
    }
  }

  Future<void> _testServerConnection() async {
    setState(() => _isTestingServer = true);
    final provider = context.read<AcademyProvider>();
    final success = await provider.testServerConnection(
      url: _serverUrlCtrl.text.trim(),
      key: _apiKeyCtrl.text.trim(),
    );
    if (!mounted) return;
    setState(() => _isTestingServer = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          success
              ? '✅ ارتباط با سرور ابری با موفقیت برقرار شد'
              : '⚠️ ارتباط با سرور برقرار نشد؛ لطفاً آدرس سرور یا اتصال اینترنت را بررسی فرمایید',
        ),
        backgroundColor: success ? Colors.green : Colors.orange[800],
      ),
    );
  }

  Future<void> _testSmsDispatch() async {
    setState(() => _isTestingSms = true);
    final dummySettings = AppSettings(
      academyName: _academyNameCtrl.text.trim(),
      smsProvider: _smsProvider,
      smsApiKey: _smsApiKeyCtrl.text.trim(),
      smsSenderLine: _smsSenderLineCtrl.text.trim(),
    );

    final res = await SmsService.sendSms(
      phone: '09120000000',
      message: 'پیامک تستی سامانه ${_academyNameCtrl.text.trim()}',
      settings: dummySettings,
    );

    if (!mounted) return;
    setState(() => _isTestingSms = false);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(res.message),
        backgroundColor: res.success ? Colors.green : Colors.orange[800],
      ),
    );
  }

  void _showAddPoolDialog(BuildContext context) {
    final poolCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('افزودن نام استخر جدید', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          content: TextField(
            controller: poolCtrl,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'نام استخر *',
              hintText: 'مثال: استخر کوثر',
              prefixIcon: Icon(Icons.pool_rounded),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0284C7), foregroundColor: Colors.white),
              onPressed: () {
                final name = poolCtrl.text.trim();
                if (name.isNotEmpty) {
                  context.read<AcademyProvider>().addRegisteredPool(name);
                  Navigator.pop(ctx);
                }
              },
              child: const Text('افزودن'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('خروج از حساب کاربری', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: const Text('آیا مایلید از حساب خود خارج شده و به صفحه ورود بازگردید؟'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red[700], foregroundColor: Colors.white),
              onPressed: () async {
                Navigator.pop(ctx);
                await context.read<AcademyProvider>().logout();
                if (mounted) {
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (route) => false,
                  );
                }
              },
              child: const Text('خروج'),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddOrEditPackageDialog(BuildContext context, [DefinitionItem? item]) {
    final isEditing = item != null;
    final titleCtrl = TextEditingController(text: isEditing ? item.title : '');
    final sessionsCtrl = TextEditingController(text: isEditing ? (item.sessions?.toString() ?? '12') : '12');
    final priceCtrl = TextEditingController(text: isEditing ? (item.price?.toString() ?? '2800000') : '2800000');
    final codeCtrl = TextEditingController(text: isEditing ? item.code : '');
    final descCtrl = TextEditingController(text: isEditing ? (item.description ?? '') : '');
    final provider = context.read<AcademyProvider>();

    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: Row(
            children: [
              Icon(
                isEditing ? Icons.edit_note_rounded : Icons.add_circle_outline_rounded,
                color: const Color(0xFF0284C7),
              ),
              const SizedBox(width: 8),
              Text(
                isEditing ? 'ویرایش مشخصات دوره آموزشی' : 'تعریف پکیج / دوره جدید',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleCtrl,
                  decoration: InputDecoration(
                    labelText: 'عنوان دوره آموزشی *',
                    hintText: 'مثلاً: دوره مقدماتی شنا (۱۲ جلسه)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: sessionsCtrl,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'تعداد جلسات *',
                          hintText: '۱۲',
                          suffixText: 'جلسه',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: priceCtrl,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'شهریه دوره (تومان) *',
                          hintText: '۲,۸۰۰,۰۰۰',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: codeCtrl,
                  decoration: InputDecoration(
                    labelText: 'کد شناسایی دوره (اختیاری)',
                    hintText: 'مثلاً: PKG-BEG',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'توضیحات یا شرایط دوره (اختیاری)',
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
                final code = codeCtrl.text.trim().isNotEmpty
                    ? codeCtrl.text.trim()
                    : 'PKG-${DateTime.now().millisecondsSinceEpoch % 1000}';
                final desc = descCtrl.text.trim();

                if (isEditing) {
                  final updated = DefinitionItem(
                    id: item.id,
                    type: 'course_type',
                    title: title,
                    code: code,
                    description: desc,
                    sessions: sessions,
                    price: price,
                  );
                  provider.updateDefinition(updated);
                } else {
                  final newDef = DefinitionItem(
                    id: 'pkg_${DateTime.now().millisecondsSinceEpoch}',
                    type: 'course_type',
                    title: title,
                    code: code,
                    description: desc,
                    sessions: sessions,
                    price: price,
                  );
                  provider.addDefinition(newDef);
                }
                Navigator.pop(ctx);
              },
              child: Text(isEditing ? 'ذخیره تغییرات' : 'افزودن دوره'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDeletePackage(BuildContext context, DefinitionItem item) {
    showDialog(
      context: context,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('حذف دوره آموزشی', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          content: Text('آیا از حذف دوره «${item.title}» اطمینان دارید؟'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red[700], foregroundColor: Colors.white),
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

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AcademyProvider>();
    final user = provider.currentUser;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('تنظیمات سامانه', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          backgroundColor: const Color(0xFF0F172A),
          foregroundColor: Colors.white,
          actions: [
            IconButton(
              icon: const Icon(Icons.check_rounded, color: Color(0xFF38BDF8)),
              tooltip: 'ذخیره تنظیمات',
              onPressed: _saveSettings,
            ),
          ],
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // User Card
            if (user != null)
              Card(
                color: const Color(0xFF0F172A),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: const Color(0xFF0284C7),
                        child: Text(
                          user.displayName.isNotEmpty ? user.displayName[0] : 'U',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user.displayName,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              user.roleLabel,
                              style: const TextStyle(color: Color(0xFF7DD3FC), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red[300],
                          side: BorderSide(color: Colors.red[400]!),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        ),
                        icon: const Icon(Icons.logout_rounded, size: 16),
                        label: const Text('خروج', style: TextStyle(fontSize: 12)),
                        onPressed: _confirmLogout,
                      ),
                    ],
                  ),
                ),
              ),

            const SizedBox(height: 16),

            // Academy & School Profile (Requirement 2 & 9)
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.pool_rounded, color: Color(0xFF0284C7)),
                        SizedBox(width: 8),
                        Text(
                          'مشخصات و نام آکادمی شنا',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _academyNameCtrl,
                      decoration: InputDecoration(
                        labelText: 'نام رسمی آکادمی / مدرسه شنا *',
                        hintText: 'مثلاً: آکادمی شنای براتی',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'این نام در هدر سامانه، پیامک‌های ارسالی به اولیاء و رسیدهای پرداختی نمایش داده می‌شود.',
                      style: TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Multi-Pool Management Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.location_on_rounded, color: Color(0xFF0284C7)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: const Text(
                            'مدیریت شعب و استخرهای همکار',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                        TextButton.icon(
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('استخر جدید', style: TextStyle(fontSize: 12)),
                          onPressed: () => _showAddPoolDialog(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'در این بخش می‌توانید لیست استخرهایی که مربیان و شناگران در آنها فعالیت دارند را مدیریت کنید. استخر فعال در هنگام ثبت ورود و ثبت هزینه‌ها استفاده می‌شود.',
                      style: TextStyle(color: Colors.grey, fontSize: 11, height: 1.5),
                    ),
                    const SizedBox(height: 12),
                    ...provider.registeredPools.map((pool) {
                      final isActive = provider.activePoolName == pool;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isActive ? const Color(0xFFF0F9FF) : Colors.grey[50],
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isActive ? const Color(0xFF0284C7) : Colors.grey[200]!,
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isActive ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                              color: isActive ? const Color(0xFF0284C7) : Colors.grey,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                pool,
                                style: TextStyle(
                                  fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                                  color: isActive ? const Color(0xFF0284C7) : Colors.black87,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            if (isActive)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0284C7),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text('استخر فعال', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                              )
                            else ...[
                              TextButton(
                                onPressed: () => provider.setActivePoolName(pool),
                                child: const Text('فعال‌سازی', style: TextStyle(fontSize: 11)),
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, color: Colors.red, size: 18),
                                tooltip: 'حذف استخر',
                                onPressed: () => provider.removeRegisteredPool(pool),
                              ),
                            ],
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Subscription & Multi-Tenant SaaS License (Requirement 9)
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.verified_rounded, color: Color(0xFF10B981)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: const Text(
                            'لایسنس و اشتراک مدرسه شنا (سایر استخرها)',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('اشتراک فعال VIP', style: TextStyle(color: Color(0xFF15803D), fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _schoolIdCtrl,
                            decoration: InputDecoration(
                              labelText: 'شناسه اختصاصی استخر / مدرسه',
                              hintText: 'barati-pool',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _subscriptionExpiryCtrl,
                            decoration: InputDecoration(
                              labelText: 'تاریخ انقضای اشتراک',
                              hintText: '۱۴۰۵/۱۲/۲۹',
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _licenseKeyCtrl,
                      decoration: InputDecoration(
                        labelText: 'کد لایسنس فعال‌سازی اشتراک',
                        hintText: 'LIC-XXXX-YYYY',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'سایر مدارس و باشگاه‌های شنا می‌توانند با وارد کردن کد لایسنس و شناسه مدرسه خود، از این نرم‌افزار با برند، لوگو و دیتابیس اختصاصی خود بهره‌برداری کنند.',
                      style: TextStyle(color: Colors.grey, fontSize: 11, height: 1.5),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Course & Packages Management Card (User Requirement: Edit course specs in Settings)
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.workspace_premium_rounded, color: Color(0xFF0284C7)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: const Text(
                            'مدیریت دوره‌ها و پکیج‌های آموزشی',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF0284C7)),
                          tooltip: 'تعریف دوره جدید',
                          onPressed: () => _showAddOrEditPackageDialog(context),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'مشخصات، شهریه و تعداد جلسات دوره‌های آموزشی جهت ثبت‌نام و شارژ شناگران:',
                      style: TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                    const SizedBox(height: 12),
                    Builder(
                      builder: (ctx) {
                        final packages = provider.getDefinitionsByType('course_type');
                        final currency = NumberFormat('#,###', 'fa');

                        if (packages.isEmpty) {
                          return Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.grey[50],
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: Colors.grey[200]!),
                            ),
                            child: Center(
                              child: Text('هیچ دوره‌ای تعریف نشده است.', style: TextStyle(color: Colors.grey[600], fontSize: 12)),
                            ),
                          );
                        }

                        return Column(
                          children: packages.map((pkg) {
                            return Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.grey[50],
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: Colors.grey[200]!),
                              ),
                              child: Row(
                                children: [
                                  const CircleAvatar(
                                    radius: 18,
                                    backgroundColor: Color(0xFFE0F2FE),
                                    child: Icon(Icons.pool_rounded, color: Color(0xFF0284C7), size: 18),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(pkg.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${pkg.sessions ?? 0} جلسه • شهریه: ${currency.format(pkg.price ?? 0)} تومان${pkg.code.isNotEmpty ? " • کد: ${pkg.code}" : ""}',
                                          style: TextStyle(color: Colors.grey[600], fontSize: 11),
                                        ),
                                      ],
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.edit_outlined, color: Color(0xFF0284C7), size: 20),
                                    tooltip: 'ویرایش مشخصات دوره',
                                    onPressed: () => _showAddOrEditPackageDialog(context, pkg),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                                    tooltip: 'حذف دوره',
                                    onPressed: () => _confirmDeletePackage(context, pkg),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF0284C7),
                          side: const BorderSide(color: Color(0xFF0284C7)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('افزودن دوره / پکیج آموزشی جدید'),
                        onPressed: () => _showAddOrEditPackageDialog(context),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Rules & Gate Behavior (Requirements 3, 5, 6)
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.rule_rounded, color: Color(0xFFF59E0B)),
                        SizedBox(width: 8),
                        Text(
                          'قوانین تردد، جلسات ارفاقی و اعلان‌ها',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),

                    // Grace Sessions Limit (Requirement 5)
                    TextField(
                      controller: _graceSessionsCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'تعداد جلسات مجاز پس از اتمام دوره (جلسات ارفاقی)',
                        hintText: '۱',
                        suffixText: 'جلسه',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'شناگرانی که موجودی جلساتشان صفر شده، تا این سقف اجازه ورود ارفاقی خواهند داشت تا پشت گیت معطل نمانند.',
                      style: TextStyle(color: Colors.grey, fontSize: 10),
                    ),
                    const SizedBox(height: 14),

                    // Cooldown Minutes (Requirement 3)
                    TextField(
                      controller: _cooldownCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'محدودیت زمانی کارت زدن مکرر (دقیقه)',
                        hintText: '۶۰',
                        suffixText: 'دقیقه',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'اگر شناگری در کمتر از این مدت مجدداً کارت بزند، سیستم از مربی تاییدیه می‌گیرد تا از کسر ناخواسته جلسه جلوگیری شود.',
                      style: TextStyle(color: Colors.grey, fontSize: 10),
                    ),
                    const SizedBox(height: 14),

                    // Low Sessions Threshold (Requirement 6)
                    TextField(
                      controller: _lowSessionsCtrl,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'آستانه ارسال پیامک یادآوری تمدید (مانده جلسات)',
                        hintText: '۲',
                        suffixText: 'جلسه',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'وقتی اعتبار دوره به این تعداد جلسه یا کمتر برسد، پیامک یادآوری تمدید خودکار به اولیاء ارسال خواهد شد.',
                      style: TextStyle(color: Colors.grey, fontSize: 10),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // SMS Templates Configuration (Requirements 2 & 6)
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.edit_note_rounded, color: Color(0xFF0D9488)),
                        SizedBox(width: 8),
                        Text(
                          'شخصی‌سازی متن پیامک‌ها (قالب‌های ارسالی)',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'متغیرهای قابل استفاده در متن: {name} (نام شناگر) ، {time} (ساعت) ، {sessions} (مانده جلسات) ، {pool} (نام استخر تردد) ، {academy} (نام آکادمی) ، {package} (پکیج دوره)',
                      style: TextStyle(color: Color(0xFF0D9488), fontSize: 11, fontWeight: FontWeight.bold, height: 1.5),
                    ),
                    const SizedBox(height: 14),

                    // Entry SMS Template
                    TextField(
                      controller: _smsEntryCtrl,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'قالب پیامک ثبت تردد و ورود شناگر',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Low Balance SMS Template (Requirement 6)
                    TextField(
                      controller: _smsLowBalanceCtrl,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'قالب پیامک هشدار کسر موجودی و یادآوری تمدید',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Recharge SMS Template (Requirement 1)
                    TextField(
                      controller: _smsRechargeCtrl,
                      maxLines: 2,
                      decoration: InputDecoration(
                        labelText: 'قالب پیامک شارژ و تمدید دوره',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // SMS Gateway Configuration (Requirement 7)
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.sms_rounded, color: Color(0xFF0D9488)),
                        SizedBox(width: 8),
                        Text(
                          'تنظیمات درگاه پیامک و سیم‌کارت',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    DropdownButtonFormField<String>(
                      value: _smsProvider,
                      decoration: InputDecoration(
                        labelText: 'روش ارسال پیامک',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'directSim',
                          child: Text('📱 سیم‌کارت گوشی (اصلاح‌شده، مستقیم از گوشی بدون وب‌سرویس)'),
                        ),
                        DropdownMenuItem(
                          value: 'kavenegar',
                          child: Text('🌐 وب‌سرویس کاوه‌نگار (Kavenegar API)'),
                        ),
                        DropdownMenuItem(
                          value: 'farazsms',
                          child: Text('🌐 وب‌سرویس فراز اس‌ام‌اس / IPPanel'),
                        ),
                      ],
                      onChanged: (val) {
                        if (val != null) setState(() => _smsProvider = val);
                      },
                    ),
                    if (_smsProvider != 'directSim') ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _smsApiKeyCtrl,
                        decoration: InputDecoration(
                          labelText: 'کلید دسترسی (API Key)',
                          hintText: _smsProvider == 'kavenegar' ? 'مثلاً: 636A4F...' : 'مثلاً: eyJhbGciOi...',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _smsSenderLineCtrl,
                        decoration: InputDecoration(
                          labelText: _smsProvider == 'farazsms' ? 'کد پترن / خط خدماتی' : 'شماره خط فرستنده (مثلاً: 10008585)',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF0D9488),
                          side: const BorderSide(color: Color(0xFF0D9488)),
                        ),
                        icon: _isTestingSms
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.send_rounded, size: 18),
                        label: const Text('ارسال پیامک تستی به مربی'),
                        onPressed: _isTestingSms ? null : _testSmsDispatch,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Demo Mode Card (Requirement 5)
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.amber.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.science_rounded, color: Colors.orange, size: 24),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text(
                                'حالت تستی و آزمایشی (آموزش کاربر)',
                                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'ثبت اطلاعات فرضی جهت آشنایی با امکانات برنامه',
                                style: TextStyle(color: Colors.grey, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        Switch(
                          value: _isDemoMode,
                          activeColor: Colors.orange,
                          onChanged: _handleDemoModeToggle,
                        ),
                      ],
                    ),
                    const Divider(height: 20),
                    Text(
                      _isDemoMode
                          ? '⚡ حالت تستی فعال است. تغییرات شما تاثیری روی اطلاعات نهایی نخواهد داشت و در زمان خروج می‌توانید کل اطلاعات را پاک فرمایید.'
                          : 'سیستم در حالت عملیاتی و واقعی قرار دارد.',
                      style: TextStyle(
                        fontSize: 12,
                        color: _isDemoMode ? Colors.orange[800] : Colors.grey[700],
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Cloud Server Sync
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.cloud_sync_rounded, color: Color(0xFF0284C7)),
                        SizedBox(width: 8),
                        Text(
                          'همگام‌سازی و پایگاه داده ابری',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: _serverUrlCtrl,
                      decoration: InputDecoration(
                        labelText: 'آدرس سرور ابری (API Endpoint)',
                        hintText: 'https://api.barati-swimming.ir',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _apiKeyCtrl,
                      obscureText: true,
                      decoration: InputDecoration(
                        labelText: 'کلید امنیتی سرور (API Secret Token)',
                        hintText: 'ak_live_...',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('همگام‌سازی خودکار در پس‌زمینه', style: TextStyle(fontSize: 13)),
                      subtitle: const Text('در زمان وجود اتصال اینترنت، تغییرات به سرور ارسال شود', style: TextStyle(fontSize: 11)),
                      value: _autoSync,
                      onChanged: (val) => setState(() => _autoSync = val),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF0284C7),
                              side: const BorderSide(color: Color(0xFF0284C7)),
                            ),
                            icon: _isTestingServer
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.network_check_rounded, size: 18),
                            label: const Text('تست اتصال به سرور'),
                            onPressed: _isTestingServer ? null : _testServerConnection,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0284C7),
                              foregroundColor: Colors.white,
                            ),
                            icon: const Icon(Icons.sync_rounded, size: 18),
                            label: const Text('همگام‌سازی ابری'),
                            onPressed: () async {
                              _saveSettings();
                              await provider.syncWithRemoteServer();
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 16),

            // App Version & What's New (Requirement 4)
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              child: ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0284C7).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.info_outline_rounded, color: Color(0xFF0284C7)),
                ),
                title: Text(
                  'نسخه نرم‌افزار: ${provider.settings.appVersion} (نسخه جدید)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                subtitle: const Text('مشاهده فهرست تغییرات و امکانات اضافه شده در این نسخه', style: TextStyle(fontSize: 11)),
                trailing: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                    visualDensity: VisualDensity.compact,
                  ),
                  onPressed: () => ChangelogDialog.show(context, version: provider.settings.appVersion),
                  child: const Text('تغییرات نسخه', style: TextStyle(fontSize: 11)),
                ),
              ),
            ),

            const SizedBox(height: 12),

            // Onboarding Revisit
            ListTile(
              tileColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              leading: const Icon(Icons.help_outline_rounded, color: Color(0xFF0284C7)),
              title: const Text('راهنمای کار با برنامه (آموزش اولیه)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: const Text('مشاهده مجدد اسلایدهای معرفی امکانات سامانه', style: TextStyle(fontSize: 11)),
              trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const OnboardingScreen(isRevisit: true)),
                );
              },
            ),

            const SizedBox(height: 24),

            // Save Button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 2,
                ),
                icon: const Icon(Icons.save_rounded),
                label: const Text('ذخیره و اعمال کلیه تنظیمات', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                onPressed: _saveSettings,
              ),
            ),

            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
