import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/academy_provider.dart';
import '../widgets/checkin_result_sheet.dart';
import '../widgets/new_card_detected_dialog.dart';
import '../widgets/duplicate_scan_dialog.dart';
import '../widgets/pool_selection_dialog.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final TextEditingController _uidController = TextEditingController();

  @override
  void dispose() {
    _uidController.dispose();
    super.dispose();
  }

  void _triggerScan(String uid, {bool bypassCooldown = false}) async {
    final provider = context.read<AcademyProvider>();
    final result = await provider.processCardScan(uid, bypassCooldown: bypassCooldown);
    if (mounted) {
      if (result['status'] == 'unassigned') {
        NewCardDetectedDialog.show(context, uid);
      } else if (result['status'] == 'cooldown_warning') {
        DuplicateScanDialog.show(
          context,
          athlete: result['athlete'],
          minutesAgo: result['minutesAgo'],
          lastTime: result['lastTime'],
          onConfirm: () => _triggerScan(uid, bypassCooldown: true),
        );
      } else {
        CheckinResultSheet.show(context, result);
      }
    }
  }

  void _showManualSearchDialog() {
    final provider = context.read<AcademyProvider>();
    final athletes = provider.athletes;
    final coaches = provider.coaches;
    String query = '';
    int selectedTab = 0; // 0: Athletes, 1: Coaches

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          final filteredAthletes = athletes.where((a) {
            if (query.isEmpty) return true;
            return a.name.contains(query) || a.phone.contains(query);
          }).toList();

          final filteredCoaches = coaches.where((c) {
            if (query.isEmpty) return true;
            return c.name.contains(query) || c.phone.contains(query) || c.specialty.contains(query);
          }).toList();

          return Directionality(
            textDirection: TextDirection.rtl,
            child: AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(Icons.how_to_reg_rounded, color: Color(0xFF0284C7)),
                  SizedBox(width: 8),
                  Text('ثبت دستی ورود به استخر', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                ],
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Segmented Selector: Athletes vs Coaches
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      decoration: BoxDecoration(
                        color: Colors.grey[200],
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: InkWell(
                              onTap: () => setDialogState(() => selectedTab = 0),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: selectedTab == 0 ? const Color(0xFF0284C7) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  'شناگران (${athletes.length})',
                                  style: TextStyle(
                                    color: selectedTab == 0 ? Colors.white : Colors.grey[700],
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: InkWell(
                              onTap: () => setDialogState(() => selectedTab = 1),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: selectedTab == 1 ? const Color(0xFF0284C7) : Colors.transparent,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  'مربیان (${coaches.length})',
                                  style: TextStyle(
                                    color: selectedTab == 1 ? Colors.white : Colors.grey[700],
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Search Input Field
                    TextField(
                      decoration: InputDecoration(
                        hintText: selectedTab == 0 ? 'نام یا شماره موبایل شناگر...' : 'نام یا تخصص مربی...',
                        prefixIcon: const Icon(Icons.search),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      ),
                      onChanged: (val) {
                        setDialogState(() => query = val.trim());
                      },
                    ),
                    const SizedBox(height: 12),

                    // Results List
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 220),
                      child: selectedTab == 0
                          ? (filteredAthletes.isEmpty
                              ? const Padding(
                                  padding: EdgeInsets.all(16),
                                  child: Text('شناگری یافت نشد', style: TextStyle(color: Colors.grey)),
                                )
                              : ListView.separated(
                                  shrinkWrap: true,
                                  itemCount: filteredAthletes.length,
                                  separatorBuilder: (_, __) => const Divider(height: 1),
                                  itemBuilder: (c, idx) {
                                    final a = filteredAthletes[idx];
                                    return ListTile(
                                      dense: true,
                                      title: Text(a.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                      subtitle: Text('مانده: ${a.remainingSessions} جلسه', style: const TextStyle(fontSize: 11)),
                                      trailing: ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF0284C7),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                        ),
                                        onPressed: () {
                                          Navigator.pop(ctx);
                                          if (a.cardUid.isNotEmpty) {
                                            _triggerScan(a.cardUid);
                                          } else {
                                            _triggerScan('TEMP-${a.id}');
                                          }
                                        },
                                        child: const Text('ثبت ورود', style: TextStyle(fontSize: 12)),
                                      ),
                                    );
                                  },
                                ))
                          : (filteredCoaches.isEmpty
                              ? const Padding(
                                  padding: EdgeInsets.all(16),
                                  child: Text('مربی‌ای یافت نشد', style: TextStyle(color: Colors.grey)),
                                )
                              : ListView.separated(
                                  shrinkWrap: true,
                                  itemCount: filteredCoaches.length,
                                  separatorBuilder: (_, __) => const Divider(height: 1),
                                  itemBuilder: (c, idx) {
                                    final coach = filteredCoaches[idx];
                                    return ListTile(
                                      dense: true,
                                      leading: const CircleAvatar(
                                        radius: 16,
                                        backgroundColor: Color(0xFFE0F2FE),
                                        child: Icon(Icons.sports, color: Color(0xFF0284C7), size: 18),
                                      ),
                                      title: Text(coach.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                      subtitle: Text(coach.specialty, style: TextStyle(color: Colors.grey[600], fontSize: 11)),
                                      trailing: ElevatedButton(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF10B981),
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                                        ),
                                        onPressed: () async {
                                          Navigator.pop(ctx);
                                          final res = await provider.recordCoachCheckIn(coach);
                                          if (mounted) {
                                            CheckinResultSheet.show(context, res);
                                          }
                                        },
                                        child: const Text('ثبت حضور مربی', style: TextStyle(fontSize: 11)),
                                      ),
                                    );
                                  },
                                )),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('انصراف'),
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
    final recentLogs = provider.attendanceLogs;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Active Pool Banner
            Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F9FF),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFBAE6FD)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0284C7).withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.location_on_rounded, color: Color(0xFF0284C7), size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'استخر فعال جهت ثبت تردد و ورود:',
                          style: TextStyle(color: Color(0xFF0369A1), fontSize: 10),
                        ),
                        Text(
                          provider.activePoolName,
                          style: const TextStyle(color: Color(0xFF0C4A6E), fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF0284C7),
                      side: const BorderSide(color: Color(0xFF0284C7)),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      visualDensity: VisualDensity.compact,
                    ),
                    icon: const Icon(Icons.edit_location_alt_rounded, size: 14),
                    label: const Text('تغییر استخر', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                    onPressed: () => PoolSelectionDialog.show(context),
                  ),
                ],
              ),
            ),

            // NFC Scanner Radar Card
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Colors.white, Color(0xFFF0F9FF)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFBAE6FD), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0284C7).withOpacity(0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0284C7), Color(0xFF38BDF8)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0284C7).withOpacity(0.35),
                          blurRadius: 18,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.nfc_rounded, color: Colors.white, size: 44),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'مچ‌بند یا کارت NFC را نزدیک گوشی کنید',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF075985),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'سنسور سخت‌افزاری فعال است • اعتبارسنجی خودکار جلسات و بدهی',
                    style: TextStyle(color: Colors.grey[600], fontSize: 11),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Quick Virtual Test Wristbands Section
            const Text(
              'مچ‌بندهای آزمایشی (جهت تست بدون کارت فیزیکی):',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF334155)),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildTestWristbandChip(
                  name: 'علی رضوانی (مجاز)',
                  uid: 'NFC-A101',
                  color: const Color(0xFF10B981),
                  icon: Icons.check_circle_outline_rounded,
                ),
                _buildTestWristbandChip(
                  name: 'مهدی کاظمی (دارای بدهی)',
                  uid: 'NFC-B202',
                  color: const Color(0xFFF59E0B),
                  icon: Icons.warning_amber_rounded,
                ),
                _buildTestWristbandChip(
                  name: 'سینا مرادی (جلسه آخر)',
                  uid: 'NFC-C303',
                  color: Colors.deepOrange,
                  icon: Icons.timer_outlined,
                ),
                _buildTestWristbandChip(
                  name: 'پوریا عباسی (اتمام دوره)',
                  uid: 'NFC-D404',
                  color: const Color(0xFFEF4444),
                  icon: Icons.block_rounded,
                ),
                _buildTestWristbandChip(
                  name: 'کارت خام / ناشناخته',
                  uid: 'NFC-UNKNOWN',
                  color: Colors.grey,
                  icon: Icons.help_outline_rounded,
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Manual UID Input & Forgotten Card Button
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _uidController,
                    decoration: InputDecoration(
                      hintText: 'ورود دستی UID (مثال: NFC-A101)...',
                      hintStyle: const TextStyle(fontSize: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0284C7),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    final uid = _uidController.text.trim();
                    if (uid.isNotEmpty) {
                      _triggerScan(uid);
                      _uidController.clear();
                    }
                  },
                  child: const Text('اسکن'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.person_search_rounded, size: 20),
              label: const Text('فراموشی کارت (جستجو بر اساس نام ورزشکار)'),
              onPressed: _showManualSearchDialog,
            ),
            const SizedBox(height: 24),

            // Today's Attendance Logs
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'ترددهای ثبت‌شده امروز',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text('${recentLogs.length} تردد', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 10),

            if (recentLogs.isEmpty)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('هنوز ترددی ثبت نشده است.', style: TextStyle(color: Colors.grey)),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: recentLogs.length > 8 ? 8 : recentLogs.length,
                itemBuilder: (ctx, i) {
                  final log = recentLogs[i];
                  final isCoach = log.status == 'coach_entry';
                  final isOk = log.status == 'approved' || isCoach;

                  Color avatarBg = isCoach
                      ? const Color(0xFFE0F2FE)
                      : (isOk ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7));
                  Color iconColor = isCoach
                      ? const Color(0xFF0284C7)
                      : (isOk ? const Color(0xFF166534) : const Color(0xFFB45309));
                  IconData iconData = isCoach
                      ? Icons.sports
                      : (isOk ? Icons.check : Icons.warning_amber_rounded);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 14,
                              backgroundColor: avatarBg,
                              child: Icon(iconData, color: iconColor, size: 16),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(log.athleteName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                    if (isCoach) ...[
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF0284C7).withOpacity(0.12),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text('مربی', style: TextStyle(color: Color(0xFF0284C7), fontSize: 9, fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  ],
                                ),
                                Text(
                                  '${isCoach ? "ثبت ورود مربی" : "مربی: ${log.coachName}"}${log.poolName.isNotEmpty ? " • ${log.poolName}" : ""}',
                                  style: TextStyle(color: Colors.grey[600], fontSize: 11),
                                ),
                              ],
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(log.time, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            Text(
                              isCoach ? 'ثبت ورود' : '${log.sessionsLeft} جلسه مانده',
                              style: TextStyle(color: isCoach ? const Color(0xFF0284C7) : Colors.grey[500], fontSize: 10),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTestWristbandChip({
    required String name,
    required String uid,
    required Color color,
    required IconData icon,
  }) {
    return ActionChip(
      avatar: Icon(icon, color: color, size: 16),
      label: Text(name, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.bold)),
      backgroundColor: color.withOpacity(0.08),
      side: BorderSide(color: color.withOpacity(0.3)),
      onPressed: () => _triggerScan(uid),
    );
  }
}
