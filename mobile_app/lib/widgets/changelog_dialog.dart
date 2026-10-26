import 'package:flutter/material.dart';

class ChangelogDialog extends StatelessWidget {
  final String version;

  const ChangelogDialog({super.key, this.version = '1.2.0'});

  static void show(BuildContext context, {String version = '1.2.0'}) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => ChangelogDialog(version: version),
    );
  }

  @override
  Widget build(BuildContext context) {
    final changes = [
      {
        'icon': Icons.location_city_rounded,
        'color': const Color(0xFF0284C7),
        'title': 'انتخاب استخر فعال در بدو ورود',
        'desc': 'سوال هوشمند نام استخر هنگام ورود و قابلیت تغییر سریع در نوار بالا جهت ثبت دقیق تردد شناگران و مربیان به تفکیک استخر.',
      },
      {
        'icon': Icons.receipt_long_rounded,
        'color': const Color(0xFFEF4444),
        'title': 'ثبت استخر در هزینه‌ها و دستمزد مربیان',
        'desc': 'امکان مشخص کردن نام استخر مرتبط در هنگام ثبت هزینه‌ها یا تسویه‌حساب با مربیانی که با چندین استخر همکاری دارند.',
      },
      {
        'icon': Icons.sms_rounded,
        'color': const Color(0xFF10B981),
        'title': 'درج نام استخر در پیامک ارسالی به والدین',
        'desc': 'ارسال نام دقیق استخری که شناگر در آن ورود ثبت کرده به اولیاء جهت اطلاع‌رسانی دقیق و شفاف.',
      },
      {
        'icon': Icons.autorenew_rounded,
        'color': const Color(0xFF10B981),
        'title': 'امکان شارژ مجدد و تمدید دوره',
        'desc': 'افزوده شدن دکمه تمدید دوره شناگران با انتخاب پکیج دلخواه، ثبت خودکار در حسابداری و ارسال پیامک تمدید به والدین.',
      },
      {
        'icon': Icons.tune_rounded,
        'color': const Color(0xFF0284C7),
        'title': 'تنظیم نام آکادمی و قالب پیامک‌ها',
        'desc': 'امکان شخصی‌سازی کامل نام مدرسه شنا و تغییر متن پیامک‌های ورود، تمدید و یادآوری با متغیرهای هوشمند.',
      },
      {
        'icon': Icons.timer_rounded,
        'color': const Color(0xFFF59E0B),
        'title': 'محدودیت هوشمند کارت‌زدن در یک ساعت',
        'desc': 'در صورت اسکن مجدد مچ‌بند در کمتر از ۶۰ دقیقه، با صدای هشدار از مربی برای کسر جلسه تاییدیه گرفته می‌شود.',
      },
      {
        'icon': Icons.security_rounded,
        'color': const Color(0xFF8B5CF6),
        'title': 'جلسات ارفاقی پس از اتمام دوره',
        'desc': 'تعیین سقف جلسات ارفاقی در تنظیمات (مثلاً ۱ جلسه اضافه)، جهت جلوگیری از معطل ماندن شناگر پشت گیت.',
      },
      {
        'icon': Icons.notifications_active_rounded,
        'color': const Color(0xFFEC4899),
        'title': 'پیامک خودکار یادآوری در ۲ جلسه پایانی',
        'desc': 'با رسیدن جلسات به ۲ یا کمتر، پیامک یادآوری تمدید دوره به طور خودکار به خانواده ارسال می‌شود.',
      },
      {
        'icon': Icons.sms_rounded,
        'color': const Color(0xFF0D9488),
        'title': 'اصلاح و فعال‌سازی پیامک سیم‌کارت',
        'desc': 'رفع مشکل دسترسی در اندروید ۱۱ به بالا و ارسال روان پیامک از طریق سیم‌کارت بدون نیاز به اینترنت.',
      },
      {
        'icon': Icons.edit_note_rounded,
        'color': const Color(0xFF3B82F6),
        'title': 'ویرایش قیمت و نام پکیج‌های آموزشی',
        'desc': 'امکان ویرایش قیمت، تعداد جلسات و نام دوره‌ها در بخش تعاریف و اتصال مستقیم آن به فرم ثبت‌نام و تمدید.',
      },
      {
        'icon': Icons.business_rounded,
        'color': const Color(0xFF64748B),
        'title': 'سیستم لایسنس اشتراکی مدارس شنا',
        'desc': 'امکان بهره‌برداری سایر استخرها و مدارس شنا با وارد کردن کد فعال‌سازی و شناسه مدرسه اختصاصی.',
      },
    ];

    return Directionality(
      textDirection: TextDirection.rtl,
      child: AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        titlePadding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
        contentPadding: const EdgeInsets.symmetric(horizontal: 20),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF0284C7), Color(0xFF38BDF8)]),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.new_releases_rounded, color: Colors.white, size: 24),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('تغییرات نسخه جدید', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  Text('نسخه $version (به‌روزرسانی رسمی)', style: const TextStyle(fontSize: 11, color: Color(0xFF0284C7), fontWeight: FontWeight.bold)),
                ],
              ),
            ),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 380),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: changes.length,
                  separatorBuilder: (_, __) => const Divider(height: 12),
                  itemBuilder: (ctx, i) {
                    final item = changes[i];
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: (item['color'] as Color).withOpacity(0.12),
                          child: Icon(item['icon'] as IconData, size: 18, color: item['color'] as Color),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item['title'] as String,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                item['desc'] as String,
                                style: TextStyle(color: Colors.grey[700], fontSize: 11, height: 1.5),
                              ),
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0284C7),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
              onPressed: () => Navigator.pop(context),
              child: const Text('متوجه شدم (ورود به برنامه)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }
}
