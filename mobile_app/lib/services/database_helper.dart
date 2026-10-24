import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/athlete.dart';
import '../models/coach.dart';
import '../models/transaction_record.dart';
import '../models/attendance_log.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('barati_swimming.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    // 1. Athletes Table
    await db.execute('''
      CREATE TABLE athletes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        coachId TEXT NOT NULL,
        cardUid TEXT,
        packageName TEXT NOT NULL,
        totalSessions INTEGER NOT NULL,
        remainingSessions INTEGER NOT NULL,
        totalAttended INTEGER NOT NULL,
        tuitionFee INTEGER NOT NULL,
        paidAmount INTEGER NOT NULL,
        debt INTEGER NOT NULL,
        expireDate TEXT NOT NULL
      )
    ''');

    // 2. Coaches Table
    await db.execute('''
      CREATE TABLE coaches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        modelType TEXT NOT NULL,
        modelVal INTEGER NOT NULL,
        modelLabel TEXT NOT NULL,
        phone TEXT NOT NULL,
        settledAmount INTEGER NOT NULL
      )
    ''');

    // 3. Transactions Table
    await db.execute('''
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        amount INTEGER NOT NULL,
        method TEXT NOT NULL,
        author TEXT NOT NULL
      )
    ''');

    // 4. Attendance Logs Table
    await db.execute('''
      CREATE TABLE attendance_logs (
        id TEXT PRIMARY KEY,
        time TEXT NOT NULL,
        athleteName TEXT NOT NULL,
        coachName TEXT NOT NULL,
        status TEXT NOT NULL,
        sessionsLeft INTEGER NOT NULL,
        note TEXT NOT NULL
      )
    ''');

    // 5. SMS Logs Table
    await db.execute('''
      CREATE TABLE sms_logs (
        id TEXT PRIMARY KEY,
        time TEXT NOT NULL,
        receiver TEXT NOT NULL,
        event TEXT NOT NULL,
        text TEXT NOT NULL,
        status TEXT NOT NULL
      )
    ''');

    // 6. Offline Sync Queue Table
    await db.execute('''
      CREATE TABLE sync_queue (
        id TEXT PRIMARY KEY,
        time TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL
      )
    ''');

    // Seed Initial Mock Data
    await _seedDatabase(db);
  }

  Future<void> _seedDatabase(Database db) async {
    // Seed Coaches
    await db.insert('coaches', {
      'id': 'c1',
      'name': 'استاد مهدی سهرابی',
      'specialty': 'اصلاح تکنیک و قهرمانی',
      'modelType': 'percentage',
      'modelVal': 40,
      'modelLabel': '۴۰٪ از شهریه شاگردان',
      'phone': '09121112233',
      'settledAmount': 2240000,
    });
    await db.insert('coaches', {
      'id': 'c2',
      'name': 'مربی رضا کمالی',
      'specialty': 'آموزش مقدماتی و کرال',
      'modelType': 'per_session',
      'modelVal': 60000,
      'modelLabel': '۶۰,۰۰۰ تومان به ازای هر حضور',
      'phone': '09122223344',
      'settledAmount': 720000,
    });
    await db.insert('coaches', {
      'id': 'c3',
      'name': 'مربی حمید فرهمند',
      'specialty': 'تیم مسابقات نونهالان',
      'modelType': 'monthly_fixed',
      'modelVal': 8500000,
      'modelLabel': '۸,۵۰۰,۰۰۰ تومان حقوق ثابت ماهانه',
      'phone': '09123334455',
      'settledAmount': 8500000,
    });

    // Seed Athletes
    await db.insert('athletes', {
      'id': 'a1',
      'name': 'علی رضوانی',
      'phone': '09123456789',
      'coachId': 'c1',
      'cardUid': 'NFC-A101',
      'packageName': 'آموزش پیشرفته (۱۲ جلسه)',
      'totalSessions': 12,
      'remainingSessions': 11,
      'totalAttended': 1,
      'tuitionFee': 3500000,
      'paidAmount': 3500000,
      'debt': 0,
      'expireDate': '۱۴۰۵/۰۸/۳۰',
    });
    await db.insert('athletes', {
      'id': 'a2',
      'name': 'مهدی کاظمی',
      'phone': '09198765432',
      'coachId': 'c2',
      'cardUid': 'NFC-B202',
      'packageName': 'آموزش مقدماتی (۱۲ جلسه)',
      'totalSessions': 12,
      'remainingSessions': 7,
      'totalAttended': 5,
      'tuitionFee': 2800000,
      'paidAmount': 2350000,
      'debt': 450000,
      'expireDate': '۱۴۰۵/۰۸/۱۵',
    });
    await db.insert('athletes', {
      'id': 'a3',
      'name': 'سینا مرادی',
      'phone': '09351239876',
      'coachId': 'c1',
      'cardUid': 'NFC-C303',
      'packageName': 'آموزش پیشرفته (۱۲ جلسه)',
      'totalSessions': 12,
      'remainingSessions': 1,
      'totalAttended': 11,
      'tuitionFee': 3500000,
      'paidAmount': 3500000,
      'debt': 0,
      'expireDate': '۱۴۰۵/۰۸/۰۵',
    });
    await db.insert('athletes', {
      'id': 'a4',
      'name': 'پوریا عباسی',
      'phone': '09124445566',
      'coachId': 'c3',
      'cardUid': 'NFC-D404',
      'packageName': 'تیم مسابقات (۲۴ جلسه)',
      'totalSessions': 24,
      'remainingSessions': 0,
      'totalAttended': 24,
      'tuitionFee': 5800000,
      'paidAmount': 5800000,
      'debt': 0,
      'expireDate': '۱۴۰۵/۰۷/۲۸',
    });

    // Seed Initial Transactions
    await db.insert('transactions', {
      'id': 't1',
      'date': '۱۴۰۵/۰۸/۰۱',
      'type': 'income',
      'title': 'شهریه آموزش پیشرفته - علی رضوانی',
      'amount': 3500000,
      'method': 'پوز استخر',
      'author': 'سرمربی براتی',
    });
    await db.insert('transactions', {
      'id': 't2',
      'date': '۱۴۰۵/۰۸/۰۱',
      'type': 'income',
      'title': 'شهریه قسط اول - مهدی کاظمی',
      'amount': 2350000,
      'method': 'کارت‌به‌کارت',
      'author': 'مربی کمالی',
    });
    await db.insert('transactions', {
      'id': 't3',
      'date': '۱۴۰۵/۰۸/۰۲',
      'type': 'expense',
      'title': 'اجاره سانس‌های آبان‌ماه (لاین ۴ و ۵)',
      'amount': 5500000,
      'method': 'پایا',
      'author': 'سرمربی براتی',
    });

    // Seed Attendance Log
    await db.insert('attendance_logs', {
      'id': 'att-0',
      'time': '۱۷:۴۵',
      'athleteName': 'علی رضوانی',
      'coachName': 'استاد مهدی سهرابی',
      'status': 'approved',
      'sessionsLeft': 11,
      'note': 'ورود مجاز عادی',
    });

    // Seed SMS Log
    await db.insert('sms_logs', {
      'id': 'sms-0',
      'time': '۱۷:۴۵',
      'receiver': '۰۹۱۲۳۴۵۶۷۸۹ (علی رضوانی)',
      'event': 'ثبت تردد استخر',
      'text': 'فرزند شما ساعت ۱۷:۴۵ وارد استخر شد. مانده جلسات: ۱۱',
      'status': 'تحویل شده به گوشی',
    });
  }

  // --- CRUD Operations ---
  Future<List<Athlete>> getAllAthletes() async {
    final db = await database;
    final res = await db.query('athletes', orderBy: 'name ASC');
    return res.map((m) => Athlete.fromMap(m)).toList();
  }

  Future<int> insertAthlete(Athlete athlete) async {
    final db = await database;
    return await db.insert('athletes', athlete.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<int> updateAthlete(Athlete athlete) async {
    final db = await database;
    return await db.update('athletes', athlete.toMap(), where: 'id = ?', whereArgs: [athlete.id]);
  }

  Future<List<Coach>> getAllCoaches() async {
    final db = await database;
    final res = await db.query('coaches', orderBy: 'name ASC');
    return res.map((m) => Coach.fromMap(m)).toList();
  }

  Future<int> updateCoach(Coach coach) async {
    final db = await database;
    return await db.update('coaches', coach.toMap(), where: 'id = ?', whereArgs: [coach.id]);
  }

  Future<List<TransactionRecord>> getAllTransactions() async {
    final db = await database;
    final res = await db.query('transactions', orderBy: 'rowid DESC');
    return res.map((m) => TransactionRecord.fromMap(m)).toList();
  }

  Future<int> insertTransaction(TransactionRecord tx) async {
    final db = await database;
    return await db.insert('transactions', tx.toMap());
  }

  Future<List<AttendanceLog>> getAllAttendanceLogs() async {
    final db = await database;
    final res = await db.query('attendance_logs', orderBy: 'rowid DESC');
    return res.map((m) => AttendanceLog.fromMap(m)).toList();
  }

  Future<int> insertAttendanceLog(AttendanceLog log) async {
    final db = await database;
    return await db.insert('attendance_logs', log.toMap());
  }

  Future<List<SmsLog>> getAllSmsLogs() async {
    final db = await database;
    final res = await db.query('sms_logs', orderBy: 'rowid DESC');
    return res.map((m) => SmsLog.fromMap(m)).toList();
  }

  Future<int> insertSmsLog(SmsLog log) async {
    final db = await database;
    return await db.insert('sms_logs', log.toMap());
  }

  Future<List<SyncQueueItem>> getAllSyncQueue() async {
    final db = await database;
    final res = await db.query('sync_queue', orderBy: 'rowid ASC');
    return res.map((m) => SyncQueueItem.fromMap(m)).toList();
  }

  Future<int> insertSyncItem(SyncQueueItem item) async {
    final db = await database;
    return await db.insert('sync_queue', item.toMap());
  }

  Future<int> clearSyncQueue() async {
    final db = await database;
    return await db.delete('sync_queue');
  }
}
