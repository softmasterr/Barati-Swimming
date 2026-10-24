import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/athlete.dart';
import '../models/coach.dart';
import '../models/transaction_record.dart';
import '../models/attendance_log.dart';
import '../services/database_helper.dart';
import '../services/feedback_service.dart';

class AcademyProvider with ChangeNotifier {
  final DatabaseHelper _db = DatabaseHelper.instance;

  List<Athlete> _athletes = [];
  List<Coach> _coaches = [];
  List<TransactionRecord> _transactions = [];
  List<AttendanceLog> _attendanceLogs = [];
  List<SmsLog> _smsLogs = [];
  List<SyncQueueItem> _syncQueue = [];

  bool _isLoading = true;
  bool _isOfflineMode = false;

  // Getters
  List<Athlete> get athletes => _athletes;
  List<Coach> get coaches => _coaches;
  List<TransactionRecord> get transactions => _transactions;
  List<AttendanceLog> get attendanceLogs => _attendanceLogs;
  List<SmsLog> get smsLogs => _smsLogs;
  List<SyncQueueItem> get syncQueue => _syncQueue;
  bool get isLoading => _isLoading;
  bool get isOfflineMode => _isOfflineMode;

  AcademyProvider() {
    loadAllData();
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

  // --- Card Check-in / NFC Processing ---
  Future<Map<String, dynamic>> processCardScan(String uid) async {
    final nowTime = _formatTime();
    Athlete? athlete;

    try {
      athlete = _athletes.firstWhere(
        (a) => a.cardUid.toUpperCase() == uid.toUpperCase(),
      );
    } catch (_) {
      athlete = null;
    }

    // 1. Unknown Card
    if (athlete == null) {
      FeedbackService.trigger(FeedbackType.error, 'کارت ناشناخته: $uid');
      return {
        'status': 'denied',
        'title': 'کارت ناشناخته یا ثبت نشده',
        'sub': 'شناسه $uid به هیچ ورزشکاری متصل نیست',
        'athlete': null,
      };
    }

    // 2. Expired (0 Sessions)
    if (athlete.remainingSessions <= 0) {
      FeedbackService.trigger(FeedbackType.error, 'اعتبار جلسات به پایان رسیده است');
      return {
        'status': 'denied',
        'title': 'اتمام اعتبار دوره',
        'sub': 'کلیه جلسات مصرف شده است؛ لطفاً تمدید نمایید',
        'athlete': athlete,
      };
    }

    // 3. Valid Check-in
    athlete.remainingSessions -= 1;
    athlete.totalAttended += 1;
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

    final bool hasWarning = athlete.debt > 0 || athlete.remainingSessions == 0;
    String warnText = 'ورود تایید شد • ۱ جلسه کسر گردید';
    if (athlete.debt > 0) {
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
      status: hasWarning ? 'warning' : 'approved',
      sessionsLeft: athlete.remainingSessions,
      note: warnText,
    );
    await _db.insertAttendanceLog(attLog);
    _attendanceLogs.insert(0, attLog);

    // Create SMS
    String smsContent = 'فرزند شما ${athlete.name} ساعت $nowTime وارد استخر شد. مانده جلسات: ${athlete.remainingSessions}';
    if (athlete.debt > 0) {
      smsContent += ' (بدهی: ${_formatCurrency(athlete.debt)} ت)';
    }

    final smsStatus = _isOfflineMode ? '⏳ در صف ارسال آفلاین' : 'تحویل شده به گوشی';
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
      'status': hasWarning ? 'warning' : 'approved',
      'title': warnText,
      'sub': 'ساعت $nowTime • مانده: ${athlete.remainingSessions} جلسه',
      'athlete': athlete,
      'coach': coach,
      'smsText': smsContent,
    };
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
        author: 'سرمربی براتی',
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
  Future<void> recordPayment(String athleteId, int amount, String method, String note) async {
    final athlete = _athletes.firstWhere((a) => a.id == athleteId);
    athlete.debt = athlete.debt > amount ? athlete.debt - amount : 0;
    athlete.paidAmount += amount;
    await _db.updateAthlete(athlete);

    final tx = TransactionRecord(
      id: 'tx-${DateTime.now().millisecondsSinceEpoch}',
      date: '۱۴۰۵/۰۸/۲۴',
      type: 'income',
      title: 'دریافت شهریه - ${athlete.name} ($note)',
      amount: amount,
      method: method,
      author: 'سرمربی براتی',
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
  Future<void> recordExpense(String category, int amount, String title) async {
    final tx = TransactionRecord(
      id: 'tx-${DateTime.now().millisecondsSinceEpoch}',
      date: '۱۴۰۵/۰۸/۲۴',
      type: 'expense',
      title: '$category: $title',
      amount: amount,
      method: 'حساب جاری استخر',
      author: 'سرمربی براتی',
    );
    await _db.insertTransaction(tx);
    _transactions.insert(0, tx);

    FeedbackService.trigger(FeedbackType.success, 'هزینه استخر در دفتر مالی ثبت شد');
    notifyListeners();
  }

  // --- Settle Coach ---
  Future<void> settleCoach(String coachId, int amount, String ref) async {
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
      author: 'سرمربی براتی',
    );
    await _db.insertTransaction(tx);
    _transactions.insert(0, tx);

    FeedbackService.trigger(FeedbackType.success, 'تسویه دستمزد برای ${coach.name} ثبت شد');
    notifyListeners();
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

    // Mark pending SMS as sent
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
