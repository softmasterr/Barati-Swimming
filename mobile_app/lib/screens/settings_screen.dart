import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../models/app_settings.dart';
import '../services/sms_service.dart';
import 'onboarding_screen.dart';
import 'login_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _serverUrlCtrl;
  late TextEditingController _apiKeyCtrl;
  late TextEditingController _smsApiKeyCtrl;
  late TextEditingController _smsSenderLineCtrl;

  late String _smsProvider;
  late bool _autoSync;
  late bool _isDemoMode;

  bool _isTestingServer = false;
  bool _isTestingSms = false;

  @override
  void initState() {
    super.initState();
    final settings = context.read<AcademyProvider>().settings;
    _serverUrlCtrl = TextEditingController(text: settings.serverUrl);
    _apiKeyCtrl = TextEditingController(text: settings.apiKey);
    _smsApiKeyCtrl = TextEditingController(text: settings.smsApiKey);
    _smsSenderLineCtrl = TextEditingController(text: settings.smsSenderLine);
    _smsProvider = settings.smsProvider;
    _autoSync = settings.autoSync;
    _isDemoMode = settings.isDemoMode;
  }

  @override
  void dispose() {
    _serverUrlCtrl.dispose();
    _apiKeyCtrl.dispose();
    _smsApiKeyCtrl.dispose();
    _smsSenderLineCtrl.dispose();
    super.dispose();
  }

  void _saveSettings() {
    final provider = context.read<AcademyProvider>();
    final newSettings = AppSettings(
      serverUrl: _serverUrlCtrl.text.trim(),
      apiKey: _apiKeyCtrl.text.trim(),
      smsProvider: _smsProvider,
      smsApiKey: _smsApiKeyCtrl.text.trim(),
      smsSenderLine: _smsSenderLineCtrl.text.trim(),
      autoSync: _autoSync,
      isDemoMode: _isDemoMode,
      isOnboardingCompleted: provider.settings.isOnboardingCompleted,
    );

    provider.updateSettings(newSettings);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('تنظیمات با موفقیت ذخیره شد'),
        backgroundColor: Colors.green,
      ),
    );
  }

  void _handleDemoModeToggle(bool newValue) {
    final provider = context.read<AcademyProvider>();

    if (!newValue) {
      // User is turning OFF demo mode -> Ask if they want to delete or keep demo data
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
      // User is turning ON demo mode
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
      smsProvider: _smsProvider,
      smsApiKey: _smsApiKeyCtrl.text.trim(),
      smsSenderLine: _smsSenderLineCtrl.text.trim(),
    );

    final res = await SmsService.sendSms(
      phone: '09120000000',
      message: 'پیامک تستی سامانه آکادمی شنای براتی',
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
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
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

            // Cloud Server Sync (Requirement 3)
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

            // SMS Gateway Configuration (Requirement 4)
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
                          child: Text('📱 سیم‌کارت گوشی (بدون نیاز به اینترنت و وب‌سرویس)'),
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

            // Onboarding Revisit (Requirement 6)
            ListTile(
              tileColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              leading: const Icon(Icons.help_outline_rounded, color: Color(0xFF0284C7)),
              title: const Text('راهنمای کار با برنامه (آموزش اولیه)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: const Text('مشاهده مجدد اسلایدهای معرفی امکانات سامانه', style: TextStyle(fontSize: 11)),
              trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16),
              onPressed: () {
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
              height: 48,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.save_rounded),
                label: const Text('ذخیره و اعمال تنظیمات', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
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
