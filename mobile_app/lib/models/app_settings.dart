class AppSettings {
  // Academy & Multi-tenant (SaaS)
  String academyName;
  String schoolId;
  String licenseKey;
  String subscriptionExpiry;
  String subscriptionStatus; // 'active', 'trial', 'expired'

  // Multi-Pool Management
  String activePoolName;
  List<String> registeredPools;

  // Server Sync
  String serverUrl;
  String apiKey;
  bool autoSync;

  // SMS Configuration
  String smsProvider; // 'directSim', 'kavenegar', 'farazsms'
  String smsApiKey;
  String smsSenderLine;

  // SMS Templates
  String smsEntryTemplate;
  String smsLowBalanceTemplate;
  String smsRechargeTemplate;

  // Session & Gate Rules
  int graceSessionsLimit; // Number of sessions allowed after balance hits 0 (Requirement 5)
  int lowSessionsThreshold; // Sessions remaining to trigger reminder SMS (Requirement 6, default 2)
  int cooldownMinutes; // Card tap cooldown in minutes (Requirement 3, default 60)

  // App States
  bool isDemoMode;
  bool isOnboardingCompleted;
  String appVersion;
  String lastSeenVersion;

  AppSettings({
    this.academyName = 'آکادمی شنای براتی',
    this.schoolId = 'barati-pool',
    this.licenseKey = 'LIC-BARATI-2026-VIP',
    this.subscriptionExpiry = '۱۴۰۵/۱۲/۲۹',
    this.subscriptionStatus = 'active',
    this.activePoolName = 'استخر مرکزی براتی',
    List<String>? registeredPools,
    this.serverUrl = 'https://api.barati-swimming.ir',
    this.apiKey = '',
    this.autoSync = true,
    this.smsProvider = 'directSim',
    this.smsApiKey = '',
    this.smsSenderLine = '10008585',
    this.smsEntryTemplate = 'فرزند شما {name} ساعت {time} وارد {pool} شد. مانده جلسات: {sessions}',
    this.smsLowBalanceTemplate = 'اولیاء گرامی، تنها {sessions} جلسه از اعتبار دوره فرزند شما {name} در {academy} باقی مانده است. لطفاً نسبت به تمدید اقدام فرمایید.',
    this.smsRechargeTemplate = 'دوره فرزند شما {name} در {academy} با موفقیت تمدید شد. پکیج: {package} • مانده جلسات: {sessions}',
    this.graceSessionsLimit = 1,
    this.lowSessionsThreshold = 2,
    this.cooldownMinutes = 60,
    this.isDemoMode = true,
    this.isOnboardingCompleted = false,
    this.appVersion = '1.2.0',
    this.lastSeenVersion = '',
  }) : registeredPools = registeredPools ?? [
          'استخر مرکزی براتی',
          'استخر موج طلایی',
          'استخر شهید چمران',
        ];

  // Aliases for compatibility
  String get serverApiKey => apiKey;
  set serverApiKey(String val) => apiKey = val;

  bool get isAutoSyncEnabled => autoSync;
  set isAutoSyncEnabled(bool val) => autoSync = val;

  String get smsLineNumber => smsSenderLine;
  set smsLineNumber(String val) => smsSenderLine = val;

  bool get isOnboardingDone => isOnboardingCompleted;
  set isOnboardingDone(bool val) => isOnboardingCompleted = val;

  Map<String, dynamic> toMap() {
    return {
      'academyName': academyName,
      'schoolId': schoolId,
      'licenseKey': licenseKey,
      'subscriptionExpiry': subscriptionExpiry,
      'subscriptionStatus': subscriptionStatus,
      'activePoolName': activePoolName,
      'registeredPools': registeredPools.join('|||'),
      'serverUrl': serverUrl,
      'apiKey': apiKey,
      'autoSync': autoSync ? 1 : 0,
      'smsProvider': smsProvider,
      'smsApiKey': smsApiKey,
      'smsSenderLine': smsSenderLine,
      'smsEntryTemplate': smsEntryTemplate,
      'smsLowBalanceTemplate': smsLowBalanceTemplate,
      'smsRechargeTemplate': smsRechargeTemplate,
      'graceSessionsLimit': graceSessionsLimit,
      'lowSessionsThreshold': lowSessionsThreshold,
      'cooldownMinutes': cooldownMinutes,
      'isDemoMode': isDemoMode ? 1 : 0,
      'isOnboardingCompleted': isOnboardingCompleted ? 1 : 0,
      'appVersion': appVersion,
      'lastSeenVersion': lastSeenVersion,
    };
  }

  factory AppSettings.fromMap(Map<String, dynamic> map) {
    List<String> pools = [
      'استخر مرکزی براتی',
      'استخر موج طلایی',
      'استخر شهید چمران',
    ];
    if (map['registeredPools'] != null && map['registeredPools'].toString().isNotEmpty) {
      pools = map['registeredPools'].toString().split('|||').where((s) => s.trim().isNotEmpty).toList();
    }

    return AppSettings(
      academyName: map['academyName'] ?? 'آکادمی شنای براتی',
      schoolId: map['schoolId'] ?? 'barati-pool',
      licenseKey: map['licenseKey'] ?? 'LIC-BARATI-2026-VIP',
      subscriptionExpiry: map['subscriptionExpiry'] ?? '۱۴۰۵/۱۲/۲۹',
      subscriptionStatus: map['subscriptionStatus'] ?? 'active',
      activePoolName: map['activePoolName'] ?? 'استخر مرکزی براتی',
      registeredPools: pools,
      serverUrl: map['serverUrl'] ?? 'https://api.barati-swimming.ir',
      apiKey: map['apiKey'] ?? map['serverApiKey'] ?? '',
      autoSync: (map['autoSync'] ?? map['isAutoSyncEnabled'] ?? 1) == 1,
      smsProvider: map['smsProvider'] ?? 'directSim',
      smsApiKey: map['smsApiKey'] ?? '',
      smsSenderLine: map['smsSenderLine'] ?? map['smsLineNumber'] ?? '10008585',
      smsEntryTemplate: map['smsEntryTemplate'] ?? 'فرزند شما {name} ساعت {time} وارد {pool} شد. مانده جلسات: {sessions}',
      smsLowBalanceTemplate: map['smsLowBalanceTemplate'] ?? 'اولیاء گرامی، تنها {sessions} جلسه از اعتبار دوره فرزند شما {name} باقی مانده است. لطفاً نسبت به تمدید اقدام فرمایید.',
      smsRechargeTemplate: map['smsRechargeTemplate'] ?? 'دوره فرزند شما {name} با موفقیت تمدید شد. پکیج: {package} • مانده جلسات: {sessions}',
      graceSessionsLimit: map['graceSessionsLimit'] ?? 1,
      lowSessionsThreshold: map['lowSessionsThreshold'] ?? 2,
      cooldownMinutes: map['cooldownMinutes'] ?? 60,
      isDemoMode: (map['isDemoMode'] ?? 1) == 1,
      isOnboardingCompleted: (map['isOnboardingCompleted'] ?? map['isOnboardingDone'] ?? 0) == 1,
      appVersion: map['appVersion'] ?? '1.2.0',
      lastSeenVersion: map['lastSeenVersion'] ?? '',
    );
  }
}
