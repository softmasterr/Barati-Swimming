import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';
import 'main_navigation_screen.dart';

class OnboardingScreen extends StatefulWidget {
  final bool isRevisit;

  const OnboardingScreen({super.key, this.isRevisit = false});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<OnboardingItem> _pages = const [
    OnboardingItem(
      title: 'سامانه هوشمند حضور و غیاب NFC',
      description:
          'ثبت سریع و دقیق تردد شناگران تنها با نزدیک‌کردن مچ‌بند یا کارت به گوشی، همراه با پخش صدای اعلان رسا و کسر خودکار جلسات دوره.',
      icon: Icons.nfc_rounded,
      color: Color(0xFF0284C7),
      accentColor: Color(0xFFE0F2FE),
      tag: 'تردد هوشمند',
    ),
    OnboardingItem(
      title: 'پیامک خودکار به اولیاء و سیم‌کارت',
      description:
          'ارسال لحظه‌ای پیامک ورود فرزند به والدین بدون نیاز به اینترنت (از طریق سیم‌کارت گوشی) یا از طریق وب‌سرویس‌های کاوه‌نگار و فراز اس‌ام‌اس.',
      icon: Icons.sms_rounded,
      color: Color(0xFF0D9488),
      accentColor: Color(0xFFCCFBF1),
      tag: 'اطلاع‌رسانی بلادرنگ',
    ),
    OnboardingItem(
      title: 'حسابداری، تسویه مربیان و مراکز هزینه',
      description:
          'محاسبه دقیق سهم مربیان (درصدی، جلسه‌ای، حقوق ثابت)، ثبت شهریه‌ها، ثبت هزینه‌ها بر اساس مراکز هزینه و گزارش سود و زیان دوره‌ای.',
      icon: Icons.account_balance_wallet_rounded,
      color: Color(0xFF4F46E5),
      accentColor: Color(0xFFEEF2FF),
      tag: 'مدیریت مالی کامل',
    ),
    OnboardingItem(
      title: 'همگام‌سازی ابری و کارکرد آفلاین',
      description:
          'دسترسی ایمن و همگام به پایگاه داده ابری بدون نگرانی از قطعی اینترنت. تمامی اطلاعات هنگام اتصال مجدد به صورت خودکار ذخیره می‌شوند.',
      icon: Icons.cloud_sync_rounded,
      color: Color(0xFF0284C7),
      accentColor: Color(0xFFF0F9FF),
      tag: 'امنیت و پایداری اطلاعات',
    ),
  ];

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_completed', true);

    if (!mounted) return;

    if (widget.isRevisit) {
      Navigator.pop(context);
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = _pages[_currentPage];

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: widget.isRevisit
              ? IconButton(
                  icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                )
              : null,
          actions: [
            if (!widget.isRevisit)
              TextButton(
                onPressed: _completeOnboarding,
                child: const Text(
                  'رد شدن',
                  style: TextStyle(color: Color(0xFF7DD3FC), fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
          ],
        ),
        body: SafeArea(
          child: Column(
            children: [
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: _pages.length,
                  onPageChanged: (idx) => setState(() => _currentPage = idx),
                  itemBuilder: (context, index) {
                    final item = _pages[index];
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Animated Icon Container
                          Container(
                            width: 140,
                            height: 140,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: item.color.withOpacity(0.15),
                              border: Border.all(color: item.color.withOpacity(0.4), width: 3),
                              boxShadow: [
                                BoxShadow(
                                  color: item.color.withOpacity(0.3),
                                  blurRadius: 30,
                                  spreadRadius: 4,
                                ),
                              ],
                            ),
                            child: Icon(item.icon, size: 70, color: item.color),
                          ),
                          const SizedBox(height: 32),

                          // Tag Pill
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: item.color.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: item.color.withOpacity(0.5)),
                            ),
                            child: Text(
                              item.tag,
                              style: TextStyle(
                                color: item.color == const Color(0xFF0284C7) ? const Color(0xFF38BDF8) : item.color,
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const SizedBox(height: 18),

                          // Title
                          Text(
                            item.title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Description
                          Text(
                            item.description,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.grey[300],
                              fontSize: 14,
                              height: 1.7,
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              // Bottom Indicator & Controls
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
                child: Column(
                  children: [
                    // Dot indicators
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(
                        _pages.length,
                        (index) => AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: _currentPage == index ? 24 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: _currentPage == index ? const Color(0xFF38BDF8) : Colors.grey[700],
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Navigation Button
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0284C7),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 3,
                        ),
                        onPressed: () {
                          if (_currentPage == _pages.length - 1) {
                            _completeOnboarding();
                          } else {
                            _pageController.nextPage(
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeInOut,
                            );
                          }
                        },
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              _currentPage == _pages.length - 1
                                  ? (widget.isRevisit ? 'بازگشت به برنامه' : 'ورود به سامانه آکادمی')
                                  : 'مرحله بعدی',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(width: 8),
                            Icon(
                              _currentPage == _pages.length - 1
                                  ? Icons.check_circle_rounded
                                  : Icons.arrow_forward_rounded,
                              size: 20,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class OnboardingItem {
  final String title;
  final String description;
  final IconData icon;
  final Color color;
  final Color accentColor;
  final String tag;

  const OnboardingItem({
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
    required this.accentColor,
    required this.tag,
  });
}
