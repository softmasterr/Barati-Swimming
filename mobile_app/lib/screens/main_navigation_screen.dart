import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../services/nfc_service.dart';
import '../widgets/checkin_result_sheet.dart';
import '../widgets/new_card_detected_dialog.dart';
import '../widgets/sync_queue_dialog.dart';
import 'scanner_screen.dart';
import 'athletes_screen.dart';
import 'coaches_screen.dart';
import 'accounting_screen.dart';
import 'sms_screen.dart';
import 'definitions_screen.dart';
import 'settings_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _initGlobalNfcListener();
  }

  void _initGlobalNfcListener() {
    // Global Foreground NFC Dispatch: Listens for card taps across all screens!
    NfcService.instance.startListening((uid) async {
      final provider = context.read<AcademyProvider>();
      final result = await provider.processCardScan(uid);
      if (mounted) {
        if (result['status'] == 'unassigned') {
          NewCardDetectedDialog.show(context, result['cardUid'] ?? uid);
        } else {
          CheckinResultSheet.show(context, result);
        }
      }
    });
  }

  @override
  void dispose() {
    NfcService.instance.stopListening();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AcademyProvider>();
    final isOffline = provider.isOfflineMode;
    final queueCount = provider.syncQueue.length;
    final isHeadCoach = provider.isHeadCoach;
    final user = provider.currentUser;

    // Define tabs dynamically based on user role
    final List<Widget> screens = isHeadCoach
        ? const [
            ScannerScreen(),
            AthletesScreen(),
            CoachesScreen(),
            AccountingScreen(),
            SmsScreen(),
          ]
        : const [
            ScannerScreen(),
            AthletesScreen(),
            SmsScreen(),
          ];

    final List<BottomNavigationBarItem> navItems = isHeadCoach
        ? const [
            BottomNavigationBarItem(icon: Icon(Icons.nfc_rounded), label: 'گیت تردد'),
            BottomNavigationBarItem(icon: Icon(Icons.people_alt_rounded), label: 'ورزشکاران'),
            BottomNavigationBarItem(icon: Icon(Icons.sports_rounded), label: 'مربیان'),
            BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet_rounded), label: 'حسابداری'),
            BottomNavigationBarItem(icon: Icon(Icons.sms_rounded), label: 'پیامک‌ها'),
          ]
        : const [
            BottomNavigationBarItem(icon: Icon(Icons.nfc_rounded), label: 'گیت تردد'),
            BottomNavigationBarItem(icon: Icon(Icons.people_alt_rounded), label: 'ورزشکاران من'),
            BottomNavigationBarItem(icon: Icon(Icons.sms_rounded), label: 'پیامک‌ها'),
          ];

    // Safety index check if role switched
    if (_currentIndex >= screens.length) {
      _currentIndex = 0;
    }

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          backgroundColor: const Color(0xFF0F172A),
          elevation: 2,
          titleSpacing: 16,
          title: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF0284C7), Color(0xFF38BDF8)]),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.pool_rounded, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'آکادمی شنای براتی',
                        style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      if (provider.settings.isDemoMode) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: Colors.amber.withOpacity(0.25),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.amber, width: 0.8),
                          ),
                          child: const Text('آزمایشی', style: TextStyle(color: Colors.amber, fontSize: 9, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ],
                  ),
                  Text(
                    user != null ? '${user.displayName} (${user.roleLabel})' : 'سامانه هوشمند تردد و حسابداری',
                    style: const TextStyle(color: Color(0xFF7DD3FC), fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
          actions: [
            // Definitions Button (Only visible to Head Coach)
            if (isHeadCoach)
              IconButton(
                icon: const Icon(Icons.category_rounded, color: Color(0xFF7DD3FC), size: 21),
                tooltip: 'تعاریف پایه',
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const DefinitionsScreen()),
                  );
                },
              ),

            // Settings Button
            IconButton(
              icon: const Icon(Icons.settings_rounded, color: Colors.white, size: 21),
              tooltip: 'تنظیمات سامانه',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SettingsScreen()),
                );
              },
            ),

            // Offline/Online Toggle Button
            ActionChip(
              visualDensity: VisualDensity.compact,
              avatar: Icon(
                isOffline ? Icons.wifi_off_rounded : Icons.wifi_rounded,
                color: isOffline ? Colors.red : Colors.green,
                size: 13,
              ),
              label: Text(
                isOffline ? 'آفلاین' : 'آنلاین',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: isOffline ? Colors.red : Colors.green,
                ),
              ),
              backgroundColor: isOffline ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7),
              onPressed: () => provider.toggleOfflineMode(),
            ),
            const SizedBox(width: 4),

            // Sync Queue Badge Button
            Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.sync_rounded, color: Colors.white, size: 22),
                  tooltip: 'صف آفلاین',
                  onPressed: () => SyncQueueDialog.show(context),
                ),
                if (queueCount > 0)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.amber,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        '$queueCount',
                        style: const TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 8),
          ],
        ),

        // Body
        body: IndexedStack(
          index: _currentIndex,
          children: screens,
        ),

        // Bottom Navigation Bar
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          type: BottomNavigationBarType.fixed,
          selectedItemColor: const Color(0xFF0284C7),
          unselectedItemColor: Colors.grey[500],
          selectedFontSize: 12,
          unselectedFontSize: 11,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold),
          items: navItems,
        ),
      ),
    );
  }
}
