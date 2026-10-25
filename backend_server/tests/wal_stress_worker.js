/**
 * Worker thread script for WAL concurrency stress testing
 */
import { workerData, parentPort } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { AthleteRepository } from '../src/db/repositories/athleteRepo.js';
import { TransactionRepository } from '../src/db/repositories/transactionRepo.js';
import { AttendanceRepository } from '../src/db/repositories/attendanceRepo.js';

const { workerId, dbPath, mode, count, runId = Date.now() } = workerData;

try {
  const db = new DatabaseSync(dbPath, { open: true, enableForeignKeyConstraints: true });
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA synchronous = NORMAL;');

  const schoolId = 'concurrent-school';
  const athleteRepo = new AthleteRepository(db);
  const transactionRepo = new TransactionRepository(db);
  const attendanceRepo = new AttendanceRepository(db);

  let executedOps = 0;

  if (mode === 'athletes_writer') {
    for (let i = 0; i < count; i++) {
      athleteRepo.create(schoolId, {
        id: `ath-${runId}-${workerId}-${i}`,
        name: `Athlete ${workerId}-${i}`,
        phone: '09121111111',
        coachId: 'c-1',
        cardUid: `UID-${runId}-${workerId}-${i}`,
        packageName: 'Gold Package',
        totalSessions: 12,
        remainingSessions: 10,
        totalAttended: 2,
        tuitionFee: 5000000,
        paidAmount: 5000000,
        debt: 0,
        expireDate: '2026-12-31'
      });
      executedOps++;
    }
  } else if (mode === 'transactions_writer') {
    for (let i = 0; i < count; i++) {
      transactionRepo.create(schoolId, {
        id: `tx-${runId}-${workerId}-${i}`,
        date: '2026-10-25',
        type: 'income',
        title: `Tuition Payment ${workerId}-${i}`,
        amount: 5000000,
        method: 'pos',
        author: `Staff ${workerId}`
      });
      executedOps++;
    }
  } else if (mode === 'attendance_writer') {
    for (let i = 0; i < count; i++) {
      attendanceRepo.create(schoolId, {
        id: `att-${runId}-${workerId}-${i}`,
        time: '2026-10-25T14:30:00Z',
        athleteName: `Athlete Entry ${workerId}-${i}`,
        coachName: 'Coach Barati',
        status: 'approved',
        sessionsLeft: 8,
        note: `Check-in log #${i}`
      });
      executedOps++;
    }
  } else if (mode === 'continuous_reader') {
    for (let i = 0; i < count; i++) {
      athleteRepo.count(schoolId);
      athleteRepo.findById(schoolId, `ath-${runId}-1-${i % 50}`);
      transactionRepo.findAllBySchoolId(schoolId, { limit: 5 });
      attendanceRepo.findAllBySchoolId(schoolId, { limit: 5 });
      executedOps++;
    }
  } else {
    throw new Error(`Unknown worker mode: ${mode}`);
  }

  db.close();
  parentPort.postMessage({ success: true, workerId, mode, executedOps });
} catch (error) {
  parentPort.postMessage({
    success: false,
    workerId,
    mode,
    error: error.message,
    stack: error.stack
  });
}
