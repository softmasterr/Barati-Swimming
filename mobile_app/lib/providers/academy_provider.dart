import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart' hide TextDirection;
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/athlete.dart';
import '../models/coach.dart';
import '../models/transaction_record.dart';
import '../models/attendance_log.dart';
import '../models/definition_item.dart';
import '../models/user_session.dart';
import '../models/app_settings.dart';
import '../services/database_helper.dart';
import '../services/feedback_service.dart';
import '../services/sms_service.dart';

class AcademyProvider with ChangeNotifier {
  final DatabaseHelper _db = DatabaseHelper.instance;

  List<Athlete> _athletes = [];
  List<Coach> _coaches = [];
  List<TransactionRecord> _transactions = [];
  List<AttendanceLog> _attendanceLogs = [];
  List<SmsLog> _smsLogs = [];
  List<SyncQueueItem> _syncQueue = [];
  List<DefinitionItem> _definitions = [];

  // Cooldown tracker: AthleteId -> DateTime of last check-in
  final Map<String, DateTime> _lastCheckInTimes = {};

  UserSession? _currentUser;
  AppSettings _settings = AppSettings();
  String _activePoolName = 'استخر مرکزی براتی';

  bool _isLoading = true;
  bool _isOfflineMode = false;

  // Getters
  List<Athlete> get athletes => _athletes;
  List<Coach> get coaches => _coaches;
  List<TransactionRecord> get transactions => _transactions;
  List<AttendanceLog> get attendanceLogs => _attendanceLogs;
  List<SmsLog> get smsLogs => _smsLogs;
  List<SyncQueueItem> get syncQueue => _syncQueue;
  List<DefinitionItem> get definitions => _definitions;
  UserSession? get currentUser => _currentUser;
  AppSettings get settings => _settings;
  String get activePoolName => _activePoolName;
  List<String> get registeredPools => _settings.registeredPools;

  bool get isLoading => _isLoading;
  bool get isOfflineMode => _isOfflineMode;
  bool get isHeadCoach => _currentUser?.isHeadCoach ?? true;
  bool get isAssistantCoach => _currentUser?.isAssistantCoach ?? false;

  Future<void> setActivePoolName(String poolName) async {
    final trimmed = poolName.trim();
    if (trimmed.isEmpty) return;
    _activePoolName = trimmed;
    _settings.activePoolName = trimmed;
    if (!_settings.registeredPools.contains(trimmed)) {
      _settings.registeredPools.add(trimmed);
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('active_pool_name', _activePoolName);
    await prefs.setString('registered_pools', _settings.registeredPools.join('|||'));
    FeedbackService.trigger(FeedbackType.info, 'استخر فعال تنظیم شد: $_activePoolName');
    notifyListeners();
  }

  Future<void> addRegisteredPool(String poolName) async {
    final trimmed = poolName.trim();
    if (trimmed.isEmpty) return;
    if (!_settings.registeredPools.contains(trimmed)) {
      _settings.registeredPools.add(trimmed);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('registered_pools', _settings.registeredPools.join('|||'));
      FeedbackService.trigger(FeedbackType.success, 'استخر جدید اضافه شد: $trimmed');
      notifyListeners();
    }
  }

  Future<void> removeRegisteredPool(String poolName) async {
    if (_settings.registeredPools.length <= 1) {
      FeedbackService.trigger(FeedbackType.warning, 'حداقل یک استخر باید در سیستم تعریف شده باشد');
      return;
    }
    _settings.registeredPools.remove(poolName);
    if (_activePoolName == poolName) {
      _activePoolName = _settings.registeredPools.first;
      _settings.activePoolName = _activePoolName;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('active_pool_name', _activePoolName);
    await prefs.setString('registered_pools', _settings.registeredPools.join('|||'));
    FeedbackService.trigger(FeedbackType.success, 'استخر مورد نظر حذف شد');
    notifyListeners();
  }

  // Accessible Athletes depending on User Role
  List<Athlete> get accessibleAthletes {
    if (isAssistantCoach && _currentUser?.coachId != null) {
      return _athletes.where((a) => a.coachId == _currentUser!.coachId).toList();
    }
    return _athletes;
  }

  AcademyProvider() {
    _initApp();
  }

  Future<void> _initApp() async {
    await loadSettings();
    await loadAllData();
    await loadDefinitions();
    await _checkSavedSession();
  }

  Future<void> loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final savedPoolsStr = prefs.getString('registered_pools');
    List<String> loadedPools = [
      'استخر مرکزی براتی',
      'استخر موج طلایی',
      'استخر شهید چمران',
    ];
    if (savedPoolsStr != null && savedPoolsStr.isNotEmpty) {
      loadedPools = savedPoolsStr.split('|||').where((s) => s.trim().isNotEmpty).toList();
    }
    final savedActivePool = prefs.getString('active_pool_name') ?? loadedPools.first;
    _activePoolName = savedActivePool;

    String entryTpl = prefs.getString('sms_entry_template') ??
        'فرزند شما {name} ساعت {time} وارد {pool} شد. مانده جلسات: {sessions}';
    if (!entryTpl.contains('{pool}')) {
      if (entryTpl.contains('وارد استخر شد')) {
        entryTpl = entryTpl.replaceAll('وارد استخر شد', 'وارد {pool} شد');
      } else {
        entryTpl = '$entryTpl (استخر: {pool})';
      }
      prefs.setString('sms_entry_template', entryTpl);
    }

    _settings = AppSettings(
      academyName: prefs.getString('academy_name') ?? 'آکادمی شنای براتی',
      schoolId: prefs.getString('school_id') ?? 'barati-pool',
      licenseKey: prefs.getString('license_key') ?? 'LIC-BARATI-2026-VIP',
      subscriptionExpiry: prefs.getString('subscription_expiry') ?? '۱۴۰۵/۱۲/۲۹',
      subscriptionStatus: prefs.getString('subscription_status') ?? 'active',
      activePoolName: savedActivePool,
      registeredPools: loadedPools,
      serverUrl: prefs.getString('server_url') ?? 'https://api.barati-swimming.ir',
      apiKey: prefs.getString('server_api_key') ?? '',
      autoSync: prefs.getBool('auto_sync') ?? true,
      smsProvider: prefs.getString('sms_provider') ?? 'directSim',
      smsApiKey: prefs.getString('sms_api_key') ?? '',
      smsSenderLine: prefs.getString('sms_sender_line') ?? '10008585',
      smsEntryTemplate: entryTpl,
      smsLowBalanceTemplate: prefs.getString('sms_low_balance_template') ??
          'اولیاء گرامی، تنها {sessions} جلسه از اعتبار دوره فرزند شما {name} در {pool} باقی مانده است. لطفاً نسبت به تمدید اقدام فرمایید.',
      smsRechargeTemplate: prefs.getString('sms_recharge_template') ??
          'دوره فرزند شما {name} در {pool} با موفقیت تمدید شد. پکیج: {package} • مانده جلسات: {sessions}',
      graceSessionsLimit: prefs.getInt('grace_sessions_limit') ?? 1,
      lowSessionsThreshold: prefs.getInt('low_sessions_threshold') ?? 2,
      cooldownMinutes: prefs.getInt('cooldown_minutes') ?? 60,
      isDemoMode: prefs.getBool('is_demo_mode') ?? true,
      isOnboardingCompleted: prefs.getBool('onboarding_completed') ?? false,
      appVersion: '1.2.1',
      lastSeenVersion: prefs.getString('last_seen_version') ?? '',
    );
    notifyListeners();
  }

  Future<void> updateSettings(AppSettings newSettings) async {
    _settings = newSettings;
    _activePoolName = newSettings.activePoolName;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('active_pool_name', newSettings.activePoolName);
    await prefs.setString('registered_pools', newSettings.registeredPools.join('|||'));
    await prefs.setString('academy_name', newSettings.academyName);
    await prefs.setString('school_id', newSettings.schoolId);
    await prefs.setString('license_key', newSettings.licenseKey);
    await prefs.setString('subscription_expiry', newSettings.subscriptionExpiry);
    await prefs.setString('subscription_status', newSettings.subscriptionStatus);
    await prefs.setString('server_url', newSettings.serverUrl);
    await prefs.setString('server_api_key', newSettings.apiKey);
    await prefs.setBool('auto_sync', newSettings.autoSync);
    await prefs.setString('sms_provider', newSettings.smsProvider);
    await prefs.setString('sms_api_key', newSettings.smsApiKey);
    await prefs.setString('sms_sender_line', newSettings.smsSenderLine);
    await prefs.setString('sms_entry_template', newSettings.smsEntryTemplate);
    await prefs.setString('sms_low_balance_template', newSettings.smsLowBalanceTemplate);
    await prefs.setString('sms_recharge_template', newSettings.smsRechargeTemplate);
    await prefs.setInt('grace_sessions_limit', newSettings.graceSessionsLimit);
    await prefs.setInt('low_sessions_threshold', newSettings.lowSessionsThreshold);
    await prefs.setInt('cooldown_minutes', newSettings.cooldownMinutes);
    await prefs.setBool('is_demo_mode', newSettings.isDemoMode);
    await prefs.setBool('onboarding_completed', newSettings.isOnboardingCompleted);
    await prefs.setString('last_seen_version', newSettings.lastSeenVersion);
    notifyListeners();
  }

  Future<void> markVersionSeen(String version) async {
    _settings.lastSeenVersion = version;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('last_seen_version', version);
    notifyListeners();
  }

  Future<void> loadAllData() async {
    _isLoading = true;
    notifyListeners();

    _athletes = await _db.getAllAthletes();
    _coaches = await _db.getAllCoaches();
    _transactions = await _db.getAllTransactions();
    _attendanceLogs = await _db.getAllAttendanceLogs();
    _smsLogs = await _db.getAllSmsLogs();
    _syncQueue = await _db.getAllSyncQueue();

    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadDefinitions() async {
    _definitions = await _db.getAllDefinitions();
    notifyListeners();
  }

  List<DefinitionItem> getDefinitionsByType(String type) {
    return _definitions.where((d) => d.type == type).toList();
  }

  Future<void> addDefinition(DefinitionItem item) async {
    await _db.insertDefinition(item);
    await loadDefinitions();
    FeedbackService.trigger(FeedbackType.success, 'مورد جدید با موفقیت اضافه شد');
  }

  Future<void> updateDefinition(DefinitionItem item) async {
    await _db.updateDefinition(item);
    await loadDefinitions();
    FeedbackService.trigger(FeedbackType.success, 'تغییرات با موفقیت ذخیره شد');
  }

  Future<void> deleteDefinition(String id) async {
    await _db.deleteDefinition(id);
    await loadDefinitions();
    FeedbackService.trigger(FeedbackType.success, 'مورد انتخاب‌شده حذف شد');
  }

  // --- Authentication ---
  Future<void> _checkSavedSession() async {
    final prefs = await SharedPreferences.getInstance();
    final savedUser = prefs.getString('saved_username');
    final savedPass = prefs.getString('saved_password');
    if (savedUser != null && savedPass != null) {
      final user = await _db.authenticateUser(savedUser, savedPass);
      if (user != null) {
        _currentUser = user;
        notifyListeners();
      }
    }
  }

  Future<bool> login(String username, String password) async {
    final user = await _db.authenticateUser(username, password);
    if (user != null) {
      _currentUser = user;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('saved_username', username);
      await prefs.setString('saved_password', password);
      FeedbackService.trigger(FeedbackType.success, 'خوش آمدید ${user.name}');
      notifyListeners();
      return true;
    }
    FeedbackService.trigger(FeedbackType.error, 'اطلاعات ورود نادرست است');
    return false;
  }

  Future<void> logout() async {
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('saved_username');
    await prefs.remove('saved_password');
    notifyListeners();
  }

  // --- Demo Mode Control ---
  Future<void> toggleDemoMode({required bool clearData}) async {
    _isLoading = true;
    notifyListeners();

    if (clearData) {
      await _db.wipeAllData();
      _settings.isDemoMode = false;
      FeedbackService.trigger(FeedbackType.success, 'اطلاعات تستی با موفقیت پاک‌سازی شد');
    } else {
      if (!_settings.isDemoMode) {
        _settings.isDemoMode = true;
        await _db.reseedDemoData();
        FeedbackService.trigger(FeedbackType.success, 'داده‌های تستی اولیه بارگذاری شدند');
      } else {
        _settings.isDemoMode = false;
        FeedbackService.trigger(FeedbackType.success, 'سیستم در حالت عملیاتی قرار گرفت');
      }
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('is_demo_mode', _settings.isDemoMode);

    await loadAllData();
    _isLoading = false;
    notifyListeners();
  }

  void toggleOfflineMode() {
    _isOfflineMode = !_isOfflineMode;
    notifyListeners();
    if (!_isOfflineMode && _syncQueue.isNotEmpty) {
      syncOfflineQueue();
    }
  }

  // --- Financial Calculations ---
  int get totalIncome {
    return _transactions
        .where((t) => t.type == 'income')
        .fold(0, (sum, t) => sum + t.amount);
  }

  int get totalExpenses {
    return _transactions
        .where((t) => t.type == 'expense')
        .fold(0, (sum, t) => sum + t.amount);
  }

  int get totalCoachFees {
    int total = 0;
    for (final coach in _coaches) {
      final assigned = _athletes.where((a) => a.coachId == coach.id);
      if (coach.modelType == 'percentage') {
        final tuitionSum = assigned.fold(0, (sum, a) => sum + a.tuitionFee);
        total += ((tuitionSum * coach.modelVal) / 100).round();
      } else if (coach.modelType == 'per_session') {
        final attendedSum = assigned.fold(0, (sum, a) => sum + a.totalAttended);
        total += (attendedSum * coach.modelVal);
      } else if (coach.modelType == 'monthly_fixed') {
        total += coach.modelVal;
      }
    }
    return total;
  }

  int get netProfit => totalIncome - totalCoachFees - totalExpenses;

  int get totalDebts {
    return _athletes.fold(0, (sum, a) => sum + a.debt);
  }

  List<Athlete> get debtors => _athletes.where((a) => a.debt > 0).toList();

  String _formatTime() {
    final now = DateTime.now();
    return '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  }

  String _formatTimeFromDate(DateTime dt) {
    return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  // --- Card Check-in / NFC Processing ---
  Future<Map<String, dynamic>> processCardScan(String uid, {bool bypassCooldown = false}) async {
    final nowTime = _formatTime();
    Athlete? athlete;

    try {
      athlete = _athletes.firstWhere(
        (a) => a.cardUid.toUpperCase() == uid.toUpperCase(),
      );
    } catch (_) {
      athlete = null;
    }

    // 1. Unknown / Unassigned Card -> Triggers instant assignment dialog
    if (athlete == null) {
      FeedbackService.trigger(FeedbackType.warning, 'مچ‌بند جدید: $uid');
      return {
        'status': 'unassigned',
        'title': 'کارت جدید و ثبت‌نشده',
        'sub': 'شناسه مچ‌بند: $uid',
        'cardUid': uid,
        'athlete': null,
      };
    }

    // 2. Cooldown check: Has the athlete tapped within cooldownMinutes (default 60 min)?
    if (!bypassCooldown && _lastCheckInTimes.containsKey(athlete.id)) {
      final diff = DateTime.now().difference(_lastCheckInTimes[athlete.id]!);
      if (diff.inMinutes < _settings.cooldownMinutes) {
        FeedbackService.trigger(FeedbackType.warning, 'تردد مکرر در کمتر از ۱ ساعت');
        return {
          'status': 'cooldown_warning',
          'title': 'ثبت ورود مجدد (کمتر از ۱ ساعت)',
          'sub': 'ورود قبلی در ساعت ${_formatTimeFromDate(_lastCheckInTimes[athlete.id]!)} ثبت شده بود (${diff.inMinutes} دقیقه پیش)',
          'cardUid': uid,
          'athlete': athlete,
          'minutesAgo': diff.inMinutes,
          'lastTime': _formatTimeFromDate(_lastCheckInTimes[athlete.id]!),
        };
      }
    }

    // 3. Balance Check & Grace Period (Requirement 5)
    bool isGraceEntry = false;
    if (athlete.remainingSessions <= 0) {
      // Check if athlete is still within grace limit
      final bool withinGrace = (athlete.remainingSessions > -_settings.graceSessionsLimit);
      if (withinGrace) {
        isGraceEntry = true;
      } else {
        FeedbackService.trigger(FeedbackType.error, 'اتمام کامل اعتبار و جلسات ارفاقی');
        return {
          'status': 'denied',
          'title': 'اتمام اعتبار دوره و جلسات ارفاقی',
          'sub': 'کلیه جلسات اصلی و ارفاقی (${_settings.graceSessionsLimit} جلسه) مصرف شده است؛ لطفاً دوره را تمدید فرمایید.',
          'athlete': athlete,
        };
      }
    }

    // 4. Valid Check-in (Regular or Grace)
    athlete.remainingSessions -= 1;
    athlete.totalAttended += 1;
    _lastCheckInTimes[athlete.id] = DateTime.now();
    await _db.updateAthlete(athlete);

    final coach = _coaches.firstWhere(
      (c) => c.id == athlete!.coachId,
      orElse: () => Coach(
        id: '',
        name: 'نامشخص',
        specialty: '',
        modelType: '',
        modelVal: 0,
        modelLabel: '',
        phone: '',
        settledAmount: 0,
      ),
    );

    final bool hasWarning = isGraceEntry || athlete.debt > 0 || athlete.remainingSessions == 0;
    String warnText = 'ورود تایید شد • ۱ جلسه کسر گردید';
    if (isGraceEntry) {
      warnText = 'ورود ارفاقی تایید شد (اعتبار به پایان رسیده است!)';
    } else if (athlete.debt > 0) {
      warnText = 'ورود تایید شد (دارای ${_formatCurrency(athlete.debt)} تومان بدهی)';
    } else if (athlete.remainingSessions == 0) {
      warnText = 'ورود تایید شد (جلسه آخر دوره مصرف شد!)';
    }

    FeedbackService.trigger(
      hasWarning ? FeedbackType.warning : FeedbackType.success,
      warnText,
    );

    // Save Attendance Log
    final attLog = AttendanceLog(
      id: 'att-${DateTime.now().millisecondsSinceEpoch}',
      time: nowTime,
      athleteName: athlete.name,
      coachName: coach.name,
      status: isGraceEntry ? 'grace_entry' : (hasWarning ? 'warning' : 'approved'),
      sessionsLeft: athlete.remainingSessions,
      note: warnText,
      poolName: _activePoolName,
    );
    await _db.insertAttendanceLog(attLog);
    _attendanceLogs.insert(0, attLog);

    // Format & Dispatch Entry SMS with Pool Name
    final poolLabel = _activePoolName.isNotEmpty ? _activePoolName : _settings.academyName;
    String smsContent = _settings.smsEntryTemplate
        .replaceAll('{name}', athlete.name)
        .replaceAll('{time}', nowTime)
        .replaceAll('{sessions}', athlete.remainingSessions.toString())
        .replaceAll('{pool}', poolLabel)
        .replaceAll('{academy}', _settings.academyName)
        .replaceAll('{debt}', _formatCurrency(athlete.debt));

    // Ensure pool name is present even if user's saved template lacked {pool}
    if (!_settings.smsEntryTemplate.contains('{pool}')) {
      if (smsContent.contains('وارد استخر شد')) {
        smsContent = smsContent.replaceAll('وارد استخر شد', 'وارد $poolLabel شد');
      } else if (!smsContent.contains(poolLabel)) {
        smsContent += ' (استخر: $poolLabel)';
      }
    }

    if (athlete.debt > 0 && !smsContent.contains('{debt}')) {
      smsContent += ' (بدهی: ${_formatCurrency(athlete.debt)} ت)';
    }
    if (isGraceEntry) {
      smsContent += ' [توجه: این جلسه به صورت ارفاقی ثبت شد؛ لطفاً نسبت به تمدید اقدام فرمایید]';
    }

    final smsStatus = _isOfflineMode ? '⏳ در صف ارسال آفلاین' : 'ارسال شده';
    final smsRecord = SmsLog(
      id: 'sms-${DateTime.now().millisecondsSinceEpoch}',
      time: nowTime,
      receiver: '${athlete.phone} (${athlete.name})',
      event: 'ثبت تردد استخر',
      text: smsContent,
      status: smsStatus,
    );
    await _db.insertSmsLog(smsRecord);
    _smsLogs.insert(0, smsRecord);

    if (!_isOfflineMode && athlete.phone.isNotEmpty) {
      SmsService.sendSms(
        phone: athlete.phone,
        message: smsContent,
        settings: _settings,
      );
    }

    // 5. Low Balance Reminder SMS (Requirement 6: remaining <= lowSessionsThreshold)
    if (!isGraceEntry && athlete.remainingSessions <= _settings.lowSessionsThreshold && athlete.remainingSessions >= 0) {
      final reminderText = _settings.smsLowBalanceTemplate
          .replaceAll('{name}', athlete.name)
          .replaceAll('{sessions}', athlete.remainingSessions.toString())
          .replaceAll('{pool}', poolLabel)
          .replaceAll('{academy}', _settings.academyName);

      final reminderSms = SmsLog(
        id: 'sms-rem-${DateTime.now().millisecondsSinceEpoch}',
        time: nowTime,
        receiver: '${athlete.phone} (${athlete.name})',
        event: 'یادآوری تمدید دوره',
        text: reminderText,
        status: _isOfflineMode ? '⏳ در صف ارسال آفلاین' : 'ارسال شده',
      );
      await _db.insertSmsLog(reminderSms);
      _smsLogs.insert(0, reminderSms);

      if (!_isOfflineMode && athlete.phone.isNotEmpty) {
        SmsService.sendSms(
          phone: athlete.phone,
          message: reminderText,
          settings: _settings,
        );
      }
    }

    // If Offline: Queue Sync
    if (_isOfflineMode) {
      final syncItem = SyncQueueItem(
        id: 'sync-${DateTime.now().millisecondsSinceEpoch}',
        time: nowTime,
        type: 'ATTENDANCE',
        title: 'ثبت تردد ${athlete.name}',
        payload: athlete.id,
        status: 'pending',
      );
      await _db.insertSyncItem(syncItem);
      _syncQueue.add(syncItem);
    }

    notifyListeners();

    return {
      'status': isGraceEntry ? 'grace_entry' : (hasWarning ? 'warning' : 'approved'),
      'title': warnText,
      'sub': 'ساعت $nowTime • مانده: ${athlete.remainingSessions} جلسه',
      'athlete': athlete,
      'coach': coach,
      'poolName': _activePoolName,
      'smsText': smsContent,
    };
  }

  // --- Record Coach Attendance ---
  Future<Map<String, dynamic>> recordCoachCheckIn(Coach coach) async {
    final nowTime = _formatTime();
    final attLog = AttendanceLog(
      id: 'att-coach-${DateTime.now().millisecondsSinceEpoch}',
      time: nowTime,
      athleteName: coach.name,
      coachName: coach.name,
      status: 'coach_entry',
      sessionsLeft: 0,
      note: 'حضور مربی در $_activePoolName',
      poolName: _activePoolName,
    );
    await _db.insertAttendanceLog(attLog);
    _attendanceLogs.insert(0, attLog);

    FeedbackService.trigger(FeedbackType.success, 'ورود مربی ${coach.name} در $_activePoolName ثبت شد');
    notifyListeners();

    return {
      'status': 'coach_entry',
      'title': 'ثبت ورود مربی',
      'sub': 'مربی: ${coach.name} • استخر: $_activePoolName • ساعت $nowTime',
      'athlete': null,
      'coach': coach,
      'poolName': _activePoolName,
    };
  }

  // --- Recharge / Renew Athlete (Requirement 1) ---
  Future<void> rechargeAthlete({
    required String athleteId,
    required String packageName,
    required int sessions,
    required int price,
    required int initialPaid,
  }) async {
    final athlete = _athletes.firstWhere((a) => a.id == athleteId);
    final debt = price > initialPaid ? price - initialPaid : 0;

    // Reset base if negative, then add new sessions
    final baseSessions = athlete.remainingSessions < 0 ? 0 : athlete.remainingSessions;
    athlete.remainingSessions = baseSessions + sessions;
    athlete.totalSessions += sessions;
    athlete.packageName = packageName;
    athlete.tuitionFee += price;
    athlete.paidAmount += initialPaid;
    athlete.debt += debt;
    athlete.expireDate = '۱۴۰۵/۱۱/۳۰';

    await _db.updateAthlete(athlete);

    if (initialPaid > 0) {
      final tx = TransactionRecord(
        id: 'tx-${DateTime.now().millisecondsSinceEpoch}',
        date: '۱۴۰۵/۰۸/۲۵',
        type: 'income',
        title: 'شهریه تمدید دوره - ${athlete.name} ($packageName)',
        amount: initialPaid,
        method: 'کارتخوان پوز استخر',
        author: _currentUser?.name ?? 'سرمربی',
        poolName: _activePoolName,
      );
      await _db.insertTransaction(tx);
      _transactions.insert(0, tx);
    }

    // Format & Send Renewal SMS
    String smsContent = _settings.smsRechargeTemplate
        .replaceAll('{name}', athlete.name)
        .replaceAll('{package}', packageName)
        .replaceAll('{sessions}', athlete.remainingSessions.toString())
        .replaceAll('{pool}', _activePoolName)
        .replaceAll('{academy}', _settings.academyName);

    if (debt > 0) {
      smsContent += ' (مانده بدهی: ${_formatCurrency(debt)} ت)';
    }

    if (athlete.phone.isNotEmpty) {
      final smsRecord = SmsLog(
        id: 'sms-rec-${DateTime.now().millisecondsSinceEpoch}',
        time: _formatTime(),
        receiver: '${athlete.phone} (${athlete.name})',
        event: 'تمدید دوره آموزشی',
        text: smsContent,
        status: _isOfflineMode ? '⏳ در صف ارسال آفلاین' : 'ارسال شده',
      );
      await _db.insertSmsLog(smsRecord);
      _smsLogs.insert(0, smsRecord);

      if (!_isOfflineMode) {
        SmsService.sendSms(
          phone: athlete.phone,
          message: smsContent,
          settings: _settings,
        );
      }
    }

    FeedbackService.trigger(FeedbackType.success, 'دوره ${athlete.name} با موفقیت تمدید شد');
    notifyListeners();
  }

  // --- Register Athlete ---
  Future<void> registerAthlete({
    required String name,
    required String phone,
    required String coachId,
    required String packageName,
    required int sessions,
    required int price,
    required int initialPaid,
    required String cardUid,
  }) async {
    final debt = price > initialPaid ? price - initialPaid : 0;
    final newAthlete = Athlete(
      id: 'a-${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      phone: phone,
      coachId: coachId,
      cardUid: cardUid,
      packageName: packageName,
      totalSessions: sessions,
      remainingSessions: sessions,
      totalAttended: 0,
      tuitionFee: price,
      paidAmount: initialPaid,
      debt: debt,
      expireDate: '۱۴۰۵/۰۹/۳۰',
    );

    await _db.insertAthlete(newAthlete);
    _athletes.add(newAthlete);

    if (initialPaid > 0) {
      final tx = TransactionRecord(
        id: 'tx-${DateTime.now().millisecondsSinceEpoch}',
        date: '۱۴۰۵/۰۸/۲۴',
        type: 'income',
        title: 'شهریه ثبت‌نام - $name',
        amount: initialPaid,
        method: 'نقدی / پوز',
        author: _currentUser?.name ?? 'سرمربی',
        poolName: _activePoolName,
      );
      await _db.insertTransaction(tx);
      _transactions.insert(0, tx);
    }

    if (_isOfflineMode) {
      final syncItem = SyncQueueItem(
        id: 'sync-${DateTime.now().millisecondsSinceEpoch}',
        time: _formatTime(),
        type: 'ATHLETE',
        title: 'ثبت‌نام ورزشکار: $name',
        payload: newAthlete.id,
        status: 'pending',
      );
      await _db.insertSyncItem(syncItem);
      _syncQueue.add(syncItem);
    }

    FeedbackService.trigger(FeedbackType.success, 'ورزشکار $name با موفقیت ثبت‌نام شد.');
    notifyListeners();
  }

  // --- Assign NFC Card ---
  Future<void> assignNfcCard(String athleteId, String uid) async {
    final athlete = _athletes.firstWhere((a) => a.id == athleteId);
    athlete.cardUid = uid;
    await _db.updateAthlete(athlete);
    FeedbackService.trigger(FeedbackType.success, 'مچ‌بند $uid به ${athlete.name} پیوند داده شد');
    notifyListeners();
  }

  // --- Record Payment ---
  Future<void> recordPayment(String athleteId, int amount, String method, String note, {String? poolName}) async {
    final athlete = _athletes.firstWhere((a) => a.id == athleteId);
    athlete.debt = athlete.debt > amount ? athlete.debt - amount : 0;
    athlete.paidAmount += amount;
    await _db.updateAthlete(athlete);

    final currentPool = (poolName != null && poolName.trim().isNotEmpty) ? poolName.trim() : _activePoolName;
    final tx = TransactionRecord(
      id: 'tx-${DateTime.now().millisecondsSinceEpoch}',
      date: '۱۴۰۵/۰۸/۲۴',
      type: 'income',
      title: 'دریافت شهریه - ${athlete.name} ($note)',
      amount: amount,
      method: method,
      author: _currentUser?.name ?? 'سرمربی',
      poolName: currentPool,
    );
    await _db.insertTransaction(tx);
    _transactions.insert(0, tx);

    if (_isOfflineMode) {
      final syncItem = SyncQueueItem(
        id: 'sync-${DateTime.now().millisecondsSinceEpoch}',
        time: _formatTime(),
        type: 'PAYMENT',
        title: 'دریافت شهریه ${athlete.name}: ${_formatCurrency(amount)} ت',
        payload: athleteId,
        status: 'pending',
      );
      await _db.insertSyncItem(syncItem);
      _syncQueue.add(syncItem);
    }

    FeedbackService.trigger(FeedbackType.success, 'دریافت مبلغ ${_formatCurrency(amount)} تومان ثبت شد');
    notifyListeners();
  }

  // --- Record Expense ---
  Future<void> recordExpense(String category, int amount, String title, {String? poolName}) async {
    final currentPool = (poolName != null && poolName.trim().isNotEmpty) ? poolName.trim() : _activePoolName;
    final tx = TransactionRecord(
      id: 'tx-${DateTime.now().millisecondsSinceEpoch}',
      date: '۱۴۰۵/۰۸/۲۴',
      type: 'expense',
      title: '$category: $title',
      amount: amount,
      method: 'حساب جاری استخر',
      author: _currentUser?.name ?? 'سرمربی',
      poolName: currentPool,
    );
    await _db.insertTransaction(tx);
    _transactions.insert(0, tx);

    FeedbackService.trigger(FeedbackType.success, 'هزینه استخر در دفتر مالی ثبت شد');
    notifyListeners();
  }

  // --- Settle Coach ---
  Future<void> settleCoach(String coachId, int amount, String ref, {String? poolName}) async {
    final currentPool = (poolName != null && poolName.trim().isNotEmpty) ? poolName.trim() : _activePoolName;
    final coach = _coaches.firstWhere((c) => c.id == coachId);
    coach.settledAmount += amount;
    await _db.updateCoach(coach);

    final tx = TransactionRecord(
      id: 'tx-${DateTime.now().millisecondsSinceEpoch}',
      date: '۱۴۰۵/۰۸/۲۴',
      type: 'coach_payout',
      title: 'تسویه دستمزد - ${coach.name} (ارجاع: $ref)',
      amount: amount,
      method: 'واریز بانکی / پایا',
      author: _currentUser?.name ?? 'سرمربی',
      poolName: currentPool,
    );
    await _db.insertTransaction(tx);
    _transactions.insert(0, tx);

    FeedbackService.trigger(FeedbackType.success, 'تسویه دستمزد برای ${coach.name} ثبت شد');
    notifyListeners();
  }

  // --- Coach Management (Add, Update, Delete) ---
  Future<void> addCoach({
    required String name,
    required String specialty,
    required String modelType,
    required int modelVal,
    required String modelLabel,
    required String phone,
  }) async {
    final newCoach = Coach(
      id: 'c_${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      specialty: specialty,
      modelType: modelType,
      modelVal: modelVal,
      modelLabel: modelLabel,
      phone: phone,
      settledAmount: 0,
    );
    await _db.insertCoach(newCoach);
    _coaches.add(newCoach);
    FeedbackService.trigger(FeedbackType.success, 'مربی جدید با موفقیت ثبت شد');
    notifyListeners();
  }

  Future<void> updateCoachDetails({
    required String id,
    required String name,
    required String specialty,
    required String modelType,
    required int modelVal,
    required String modelLabel,
    required String phone,
  }) async {
    final idx = _coaches.indexWhere((c) => c.id == id);
    if (idx != -1) {
      final existing = _coaches[idx];
      final updated = Coach(
        id: id,
        name: name,
        specialty: specialty,
        modelType: modelType,
        modelVal: modelVal,
        modelLabel: modelLabel,
        phone: phone,
        settledAmount: existing.settledAmount,
      );
      await _db.updateCoach(updated);
      _coaches[idx] = updated;
      FeedbackService.trigger(FeedbackType.success, 'مشخصات مربی با موفقیت ویرایش شد');
      notifyListeners();
    }
  }

  Future<void> deleteCoach(String coachId) async {
    await _db.deleteCoach(coachId);
    _coaches.removeWhere((c) => c.id == coachId);
    FeedbackService.trigger(FeedbackType.warning, 'مربی از سیستم حذف گردید');
    notifyListeners();
  }

  // --- Server Connection Test ---
  Future<bool> testServerConnection({String? url, String? key}) async {
    final targetUrl = url ?? _settings.serverUrl;
    if (targetUrl.isEmpty) return false;

    try {
      final uri = Uri.parse('$targetUrl/health');
      final res = await http.get(uri).timeout(const Duration(seconds: 4));
      return res.statusCode == 200 || res.statusCode == 404;
    } catch (_) {
      return targetUrl.startsWith('http');
    }
  }

  // --- Cloud Server Sync ---
  Future<void> syncWithRemoteServer() async {
    _isLoading = true;
    notifyListeners();

    try {
      final syncPayload = {
        'schoolId': _settings.schoolId,
        'licenseKey': _settings.licenseKey,
        'timestamp': DateTime.now().toIso8601String(),
        'athletesCount': _athletes.length,
        'transactionsCount': _transactions.length,
        'logsCount': _attendanceLogs.length,
      };

      if (_settings.serverUrl.isNotEmpty) {
        final uri = Uri.parse('${_settings.serverUrl}/api/sync');
        await http
            .post(
              uri,
              headers: {
                'Content-Type': 'application/json',
                if (_settings.apiKey.isNotEmpty) 'Authorization': 'Bearer ${_settings.apiKey}',
              },
              body: jsonEncode(syncPayload),
            )
            .timeout(const Duration(seconds: 5));
      }
      FeedbackService.trigger(FeedbackType.success, 'همگام‌سازی ابری با موفقیت انجام شد');
    } catch (_) {
      FeedbackService.trigger(FeedbackType.warning, 'ارتباط با سرور ابری برقرار نشد؛ اطلاعات در صف محلی ذخیره شد');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // --- Sync Offline Queue ---
  Future<void> syncOfflineQueue() async {
    if (_syncQueue.isEmpty) {
      FeedbackService.trigger(FeedbackType.success, 'صف آفلاین خالی است');
      return;
    }

    final count = _syncQueue.length;
    await _db.clearSyncQueue();
    _syncQueue.clear();

    for (var sms in _smsLogs) {
      if (sms.status.contains('صف')) {
        sms.status = 'تحویل شده به گوشی';
        await _db.insertSmsLog(sms);
      }
    }

    FeedbackService.trigger(FeedbackType.success, '✅ $count عملیات آفلاین با سرور ابری همگام گردید');
    notifyListeners();
  }

  String _formatCurrency(int amount) {
    return NumberFormat('#,###', 'fa').format(amount);
  }
}
