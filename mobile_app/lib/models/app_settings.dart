class AppSettings {
  // Server Sync
  String serverUrl;
  String apiKey;
  bool autoSync;

  // SMS Configuration
  String smsProvider; // 'directSim', 'kavenegar', 'farazsms'
  String smsApiKey;
  String smsSenderLine;

  // App States
  bool isDemoMode;
  bool isOnboardingCompleted;

  AppSettings({
    this.serverUrl = 'https://api.barati-swimming.ir',
    this.apiKey = '',
    this.autoSync = true,
    this.smsProvider = 'directSim',
    this.smsApiKey = '',
    this.smsSenderLine = '10008585',
    this.isDemoMode = true,
    this.isOnboardingCompleted = false,
  });

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
      'serverUrl': serverUrl,
      'apiKey': apiKey,
      'autoSync': autoSync ? 1 : 0,
      'smsProvider': smsProvider,
      'smsApiKey': smsApiKey,
      'smsSenderLine': smsSenderLine,
      'isDemoMode': isDemoMode ? 1 : 0,
      'isOnboardingCompleted': isOnboardingCompleted ? 1 : 0,
    };
  }

  factory AppSettings.fromMap(Map<String, dynamic> map) {
    return AppSettings(
      serverUrl: map['serverUrl'] ?? 'https://api.barati-swimming.ir',
      apiKey: map['apiKey'] ?? map['serverApiKey'] ?? '',
      autoSync: (map['autoSync'] ?? map['isAutoSyncEnabled'] ?? 1) == 1,
      smsProvider: map['smsProvider'] ?? 'directSim',
      smsApiKey: map['smsApiKey'] ?? '',
      smsSenderLine: map['smsSenderLine'] ?? map['smsLineNumber'] ?? '10008585',
      isDemoMode: (map['isDemoMode'] ?? 1) == 1,
      isOnboardingCompleted: (map['isOnboardingCompleted'] ?? map['isOnboardingDone'] ?? 0) == 1,
    );
  }
}
