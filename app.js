/**
 * Barati Swimming Academy - Main Application Logic
 * Modern Web Guidance compliant:
 * - <dialog closedby="any"> with light-dismiss fallback
 * - :user-invalid / :user-valid validation sync
 * - Web Audio API sound synthesizer for hardware NFC scanner simulation
 * - LocalStorage persistence & Real-time Financial Calculations
 */

// ==========================================
// 1. DATA STORE & INITIAL MOCK STATE
// ==========================================
const STORAGE_KEY = 'barati_swimming_v1_store';

const initialStore = {
  coaches: [
    {
      id: 'c1',
      name: 'استاد مهدی سهرابی',
      specialty: 'اصلاح تکنیک و قهرمانی',
      modelType: 'percentage', // percentage | per_session | monthly_fixed
      modelVal: 40, // 40%
      modelLabel: '۴۰٪ از شهریه شاگردان',
      phone: '09121112233',
      settledAmount: 2240000,
    },
    {
      id: 'c2',
      name: 'مربی رضا کمالی',
      specialty: 'آموزش مقدماتی و کرال سینه',
      modelType: 'per_session',
      modelVal: 60000, // 60,000 Tomans per attendance
      modelLabel: '۶۰,۰۰۰ تومان به ازای هر حضور شاگرد',
      phone: '09122223344',
      settledAmount: 720000,
    },
    {
      id: 'c3',
      name: 'مربی حمید فرهمند',
      specialty: 'تیم مسابقات نونهالان و پایگاه قهرمانی',
      modelType: 'monthly_fixed',
      modelVal: 8500000, // 8,500,000 Tomans monthly
      modelLabel: '۸,۵۰۰,۰۰۰ تومان حقوق ثابت ماهانه',
      phone: '09123334455',
      settledAmount: 8500000,
    }
  ],
  athletes: [
    {
      id: 'a1',
      name: 'علی رضوانی',
      phone: '09123456789',
      coachId: 'c1',
      cardUid: 'NFC-A101',
      packageName: 'آموزش پیشرفته (۱۲ جلسه)',
      totalSessions: 12,
      remainingSessions: 11,
      totalAttended: 1,
      tuitionFee: 3500000,
      paidAmount: 3500000,
      debt: 0,
      expireDate: '۱۴۰۵/۰۸/۳۰',
    },
    {
      id: 'a2',
      name: 'مهدی کاظمی',
      phone: '09198765432',
      coachId: 'c2',
      cardUid: 'NFC-B202',
      packageName: 'آموزش مقدماتی (۱۲ جلسه)',
      totalSessions: 12,
      remainingSessions: 7,
      totalAttended: 5,
      tuitionFee: 2800000,
      paidAmount: 2350000,
      debt: 450000,
      expireDate: '۱۴۰۵/۰۸/۱۵',
    },
    {
      id: 'a3',
      name: 'سینا مرادی',
      phone: '09351239876',
      coachId: 'c1',
      cardUid: 'NFC-C303',
      packageName: 'آموزش پیشرفته (۱۲ جلسه)',
      totalSessions: 12,
      remainingSessions: 1, // Last session!
      totalAttended: 11,
      tuitionFee: 3500000,
      paidAmount: 3500000,
      debt: 0,
      expireDate: '۱۴۰۵/۰۸/۰۵',
    },
    {
      id: 'a4',
      name: 'پوریا عباسی',
      phone: '09124445566',
      coachId: 'c3',
      cardUid: 'NFC-D404',
      packageName: 'تیم مسابقات (۲۴ جلسه)',
      totalSessions: 24,
      remainingSessions: 0, // Expired
      totalAttended: 24,
      tuitionFee: 5800000,
      paidAmount: 5800000,
      debt: 0,
      expireDate: '۱۴۰۵/۰۷/۲۸',
    },
    {
      id: 'a5',
      name: 'آرش سالاری',
      phone: '09365557788',
      coachId: 'c2',
      cardUid: 'NFC-E505',
      packageName: 'اصلاح تکنیک (۸ جلسه)',
      totalSessions: 8,
      remainingSessions: 5,
      totalAttended: 3,
      tuitionFee: 2200000,
      paidAmount: 2200000,
      debt: 0,
      expireDate: '۱۴۰۵/۰۸/۲۰',
    },
    {
      id: 'a6',
      name: 'محمدجواد یزدانی',
      phone: '09129990011',
      coachId: 'c1',
      cardUid: '', // No card assigned yet
      packageName: 'آموزش پیشرفته (۱۲ جلسه)',
      totalSessions: 12,
      remainingSessions: 8,
      totalAttended: 4,
      tuitionFee: 3500000,
      paidAmount: 1500000,
      debt: 2000000,
      expireDate: '۱۴۰۵/۰۹/۱۰',
    }
  ],
  transactions: [
    {
      id: 't1',
      date: '۱۴۰۵/۰۸/۰۱',
      type: 'income',
      title: 'شهریه آموزش پیشرفته - علی رضوانی',
      amount: 3500000,
      method: 'کارتخوان پوز استخر',
      author: 'سرمربی براتی'
    },
    {
      id: 't2',
      date: '۱۴۰۵/۰۸/۰۱',
      type: 'income',
      title: 'شهریه قسط اول مقدماتی - مهدی کاظمی',
      amount: 2350000,
      method: 'کارت‌به‌کارت',
      author: 'مربی کمالی'
    },
    {
      id: 't3',
      date: '۱۴۰۵/۰۸/۰۲',
      type: 'expense',
      title: 'اجاره سانس‌های آبان‌ماه (لاین ۴ و ۵)',
      amount: 5500000,
      method: 'انتقال پایا',
      author: 'سرمربی براتی'
    },
    {
      id: 't4',
      date: '۱۴۰۵/۰۸/۰۲',
      type: 'expense',
      title: 'خرید تجهیزات تمرینی (کفی شنا و مچ‌بندهای NFC)',
      amount: 3000000,
      method: 'کارتخوان فروشگاه',
      author: 'سرمربی براتی'
    },
    {
      id: 't5',
      date: '۱۴۰۵/۰۸/۰۳',
      type: 'coach_payout',
      title: 'تسویه دستمزد دوره - استاد مهدی سهرابی',
      amount: 2240000,
      method: 'انتقال ساتنا',
      author: 'سرمربی براتی'
    }
  ],
  attendanceLogs: [
    {
      id: 'att-0',
      time: '۱۷:۴۵',
      athleteName: 'آرش سالاری',
      coachName: 'مربی رضا کمالی',
      status: 'approved',
      sessionsLeft: 5,
      note: 'ورود مجاز - ۱ جلسه کسر شد'
    }
  ],
  smsLogs: [
    {
      id: 'sms-0',
      time: '۱۷:۴۵',
      receiver: '۰۹۳۶۵۵۵۷۷۸۸ (آرش سالاری)',
      event: 'ثبت تردد استخر',
      text: 'والدین گرامی، آرش سالاری ساعت ۱۷:۴۵ وارد استخر شد. مانده جلسات دوره: ۵ جلسه.',
      status: 'تحویل شده به گوشی'
    }
  ],
  offlineQueue: []
};

// Load or Seed Store
let store = loadStore();

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.offlineQueue) parsed.offlineQueue = [];
      return parsed;
    }
  } catch (e) {
    console.warn('LocalStorage error, using initial mock data', e);
  }
  return JSON.parse(JSON.stringify(initialStore));
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

// ==========================================
// 1.5. OFFLINE-FIRST SYNC ENGINE & SERVICE WORKER
// ==========================================
let isSimulatedOffline = false;

function isOnline() {
  return navigator.onLine && !isSimulatedOffline;
}

function addToOfflineQueue(type, title, payload) {
  const item = {
    id: `queue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    time: getCurrentTimeStr(),
    type,
    title,
    payload,
    status: 'pending'
  };
  store.offlineQueue.unshift(item);
  saveStore();
  updateNetworkUI();
}

function syncOfflineQueue() {
  if (store.offlineQueue.length === 0) {
    alert('صف آفلاین خالی است. تمام داده‌ها قبلاً با سرور همگام شده‌اند.');
    return;
  }

  const count = store.offlineQueue.length;
  // Mark all pending SMS as delivered
  store.smsLogs.forEach(s => {
    if (s.status.includes('صف')) {
      s.status = 'تحویل شده به گوشی';
    }
  });

  store.offlineQueue = [];
  saveStore();
  updateNetworkUI();
  renderSmsLogs();
  playSuccessChime();

  const syncDialog = document.getElementById('syncQueueDialog');
  if (syncDialog && syncDialog.open) {
    renderSyncQueueList();
  }

  alert(`✅ همگام‌سازی با موفقیت انجام شد: تعداد ${count} عملیات آفلاین به سرور مرکزی ابری ارسال گردید.`);
}

function updateNetworkUI() {
  const statusPill = document.getElementById('connectionStatusPill');
  const statusLabel = document.getElementById('statusLabel');
  const queueBadge = document.getElementById('queueCountBadge');
  const syncBtn = document.getElementById('openSyncQueueBtn');
  const banner = document.getElementById('offlineNoticeBanner');
  const netToggleBtn = document.getElementById('networkToggleBtn');
  const netToggleText = document.getElementById('networkToggleText');
  const onIcon = document.getElementById('networkOnlineIcon');
  const offIcon = document.getElementById('networkOfflineIcon');

  const online = isOnline();
  const queueCount = store.offlineQueue.length;

  if (queueBadge) queueBadge.textContent = queueCount;
  if (syncBtn) {
    if (queueCount > 0) syncBtn.classList.add('has-pending');
    else syncBtn.classList.remove('has-pending');
  }

  if (online) {
    if (statusPill) {
      statusPill.className = 'live-status online';
      statusLabel.textContent = queueCount > 0 ? `آنلاین (${queueCount} در انتظار همگام‌سازی)` : 'سیستم آنلاین (همگام)';
    }
    if (banner) banner.style.display = 'none';
    if (netToggleBtn) netToggleBtn.classList.remove('offline-active');
    if (netToggleText) netToggleText.textContent = 'قطع اینترنت (تست آفلاین)';
    if (onIcon) onIcon.style.display = 'block';
    if (offIcon) offIcon.style.display = 'none';
  } else {
    if (statusPill) {
      statusPill.className = 'live-status offline';
      statusLabel.textContent = 'سیستم آفلاین (ذخیره محلی)';
    }
    if (banner) banner.style.display = 'flex';
    if (netToggleBtn) netToggleBtn.classList.add('offline-active');
    if (netToggleText) netToggleText.textContent = 'برقراری مجدد اینترنت';
    if (onIcon) onIcon.style.display = 'none';
    if (offIcon) offIcon.style.display = 'block';
  }
}

function toggleNetworkSimulation() {
  isSimulatedOffline = !isSimulatedOffline;
  updateNetworkUI();
  if (!isSimulatedOffline && store.offlineQueue.length > 0) {
    // If coming back online, auto-sync
    setTimeout(() => {
      syncOfflineQueue();
    }, 600);
  }
}

function renderSyncQueueList() {
  const container = document.getElementById('syncQueueItemsList');
  const summary = document.getElementById('syncStatusSummary');
  if (!container) return;

  container.innerHTML = '';
  const queue = store.offlineQueue;

  if (summary) summary.textContent = `${queue.length} عملیات معلق`;

  if (queue.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:1.5rem;">صف آفلاین خالی است؛ هیچ داده همگام‌نشده‌ای وجود ندارد.</p>';
    return;
  }

  queue.forEach(item => {
    const el = document.createElement('div');
    el.className = 'sync-queue-item';

    let typeBadge = '';
    if (item.type === 'ATTENDANCE') typeBadge = '<span class="sync-item-type sync-type-attendance">تردد NFC</span>';
    else if (item.type === 'PAYMENT') typeBadge = '<span class="sync-item-type sync-type-payment">دریافت مالی</span>';
    else if (item.type === 'ATHLETE') typeBadge = '<span class="sync-item-type sync-type-athlete">ورزشکار جدید</span>';
    else typeBadge = '<span class="sync-item-type sync-type-attendance">هزینه استخر</span>';

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;">
        ${typeBadge}
        <div>
          <strong>${item.title}</strong>
          <div class="text-muted" style="font-size:0.75rem;">زمان ثبت در استخر: ${item.time}</div>
        </div>
      </div>
      <div>
        <span class="recent-badge-warn" style="font-size:0.75rem;">آماده ارسال</span>
      </div>
    `;
    container.appendChild(el);
  });
}

// ==========================================
// 2. WEB AUDIO SYNTHESIZER (NFC HARDWARE SOUNDS)
// ==========================================
let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

// Ensure audio context is unlocked on first user interaction
function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}
['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
  document.addEventListener(evt, unlockAudioContext, { passive: true });
});

function playTone(freq, duration, type = 'sine', delay = 0) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const executeTone = () => {
      try {
        const startTime = ctx.currentTime + (delay || 0) + 0.02;
        const stopTime = startTime + duration;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.28, startTime);
        gain.gain.linearRampToValueAtTime(0.001, stopTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(stopTime);
      } catch (err) {
        console.warn('Tone play error:', err);
      }
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(executeTone).catch(executeTone);
    } else {
      executeTone();
    }
  } catch (err) {
    console.error('Audio synthesizer error:', err);
  }
}

// Sound presets
function playSuccessChime() {
  // Dual-tone high pitch clean chime (880Hz -> 1320Hz)
  playTone(880, 0.12, 'sine', 0);
  playTone(1320, 0.18, 'sine', 0.12);
}

function playWarningBeep() {
  // Alert double beep (580Hz)
  playTone(580, 0.12, 'triangle', 0);
  playTone(580, 0.14, 'triangle', 0.15);
}

function playErrorBuzz() {
  // Low frequency buzz (220Hz saw)
  playTone(220, 0.35, 'sawtooth', 0);
}

// ==========================================
// 3. NAVIGATION & TABS
// ==========================================
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const pane = document.getElementById(`tab-${target}`);
      if (pane) pane.classList.add('active');

      // Refresh corresponding tab UI
      if (target === 'athletes') renderAthletesTable();
      if (target === 'coaches') renderCoaches();
      if (target === 'accounting') renderAccounting();
      if (target === 'sms') renderSmsLogs();
    });
  });

  // Sound toggle button
  const soundBtn = document.getElementById('soundToggleBtn');
  const onIcon = document.getElementById('soundOnIcon');
  const offIcon = document.getElementById('soundOffIcon');

  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    onIcon.style.display = soundEnabled ? 'block' : 'none';
    offIcon.style.display = soundEnabled ? 'none' : 'block';
    soundBtn.title = soundEnabled ? 'صداهای اسکنر فعال است' : 'صداها قطع است';
    if (soundEnabled) playSuccessChime();
  });
}

// ==========================================
// 4. SCANNER & NFC ATTENDANCE ENGINE
// ==========================================
function initScanner() {
  // Quick test wristband clicks
  const wristbandBtns = document.querySelectorAll('.wristband-btn');
  wristbandBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.uid;
      processCardScan(uid);
    });
  });

  // Manual UID input
  const manualInput = document.getElementById('manualUidInput');
  const manualBtn = document.getElementById('manualScanBtn');
  manualBtn.addEventListener('click', () => {
    const val = manualInput.value.trim();
    if (val) {
      processCardScan(val);
      manualInput.value = '';
    }
  });

  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = manualInput.value.trim();
      if (val) {
        processCardScan(val);
        manualInput.value = '';
      }
    }
  });

  renderRecentLogs();
}

function getCurrentTimeStr() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function processCardScan(uid) {
  const placeholder = document.getElementById('resultPlaceholder');
  const content = document.getElementById('resultActiveContent');
  const banner = document.getElementById('resultBanner');
  const statusIcon = document.getElementById('resultStatusIcon');
  const statusTitle = document.getElementById('resultStatusTitle');
  const statusSub = document.getElementById('resultStatusSub');
  const avatar = document.getElementById('resultAvatar');
  const nameEl = document.getElementById('resultName');
  const coachEl = document.getElementById('resultCoach');
  const phoneEl = document.getElementById('resultPhone');
  const sessionsEl = document.getElementById('resultSessions');
  const financeEl = document.getElementById('resultFinance');
  const timeEl = document.getElementById('resultTime');
  const expireEl = document.getElementById('resultExpire');
  const smsNotice = document.getElementById('resultSmsNotice');
  const smsText = document.getElementById('resultSmsText');

  placeholder.style.display = 'none';
  content.style.display = 'block';

  // Search athlete
  const athlete = store.athletes.find(a => a.cardUid && a.cardUid.toLowerCase() === uid.toLowerCase());
  const nowTime = getCurrentTimeStr();
  timeEl.textContent = nowTime;

  // Case 1: Unknown card
  if (!athlete) {
    playErrorBuzz();
    banner.className = 'result-status-banner denied';
    statusIcon.textContent = '⛔';
    statusTitle.textContent = 'کارت ناشناخته / ثبت‌نشده در سیستم';
    statusSub.textContent = `شناسه خوانده‌شده: ${uid} • این کارت به هیچ ورزشکاری متصل نیست`;

    avatar.textContent = '؟';
    nameEl.textContent = 'کارت نامعتبر';
    coachEl.textContent = 'شناسه در پایگاه‌داده وجود ندارد';
    phoneEl.textContent = '---';
    sessionsEl.textContent = '۰ جلسه';
    sessionsEl.className = 'metric-val text-danger';
    financeEl.textContent = 'نامشخص';
    financeEl.className = 'metric-val';
    expireEl.textContent = '---';

    smsNotice.style.display = 'none';
    return;
  }

  // Found athlete
  const coach = store.coaches.find(c => c.id === athlete.coachId) || { name: 'نامشخص' };
  avatar.textContent = athlete.name.split(' ').map(n => n[0]).join('‌');
  nameEl.textContent = athlete.name;
  coachEl.textContent = `مربی: ${coach.name}`;
  phoneEl.textContent = athlete.phone;
  expireEl.textContent = athlete.expireDate || '۱۴۰۵/۰۸/۳۰';

  // Case 2: Sessions exhausted (0 remaining)
  if (athlete.remainingSessions <= 0) {
    playErrorBuzz();
    banner.className = 'result-status-banner denied';
    statusIcon.textContent = '⛔';
    statusTitle.textContent = 'ورود غیرمجاز - اعتبار دوره به پایان رسیده است';
    statusSub.textContent = 'کلیه جلسات این دوره مصرف شده است؛ لطفاً جهت تمدید ثبت‌نام اقدام کنید';

    sessionsEl.textContent = '۰ جلسه (پایان اعتبار)';
    sessionsEl.className = 'metric-val text-danger';
    financeEl.textContent = athlete.debt > 0 ? `${formatCurrency(athlete.debt)} تومان بدهکار` : 'تسویه کامل';
    financeEl.className = athlete.debt > 0 ? 'metric-val text-danger' : 'metric-val';

    smsNotice.style.display = 'none';
    return;
  }

  // Case 3: Valid entry! Deduct 1 session
  athlete.remainingSessions -= 1;
  athlete.totalAttended += 1;

  let isWarning = false;
  let warnMsg = '';

  if (athlete.debt > 0) {
    isWarning = true;
    warnMsg = `ورود تایید شد (دارای ${formatCurrency(athlete.debt)} تومان بدهی شهریه)`;
  } else if (athlete.remainingSessions === 0) {
    isWarning = true;
    warnMsg = 'ورود تایید شد (جلسه آخر دوره مصرف شد!)';
  }

  if (isWarning) {
    playWarningBeep();
    banner.className = 'result-status-banner warning';
    statusIcon.textContent = '⚠️';
    statusTitle.textContent = warnMsg;
    statusSub.textContent = '۱ جلسه کسر گردید؛ پیام هشدار برای والدین ارسال شد';
  } else {
    playSuccessChime();
    banner.className = 'result-status-banner approved';
    statusIcon.textContent = '✅';
    statusTitle.textContent = 'ورود تایید شد • ۱ جلسه کسر گردید';
    statusSub.textContent = 'تردد با موفقیت در پایگاه‌داده محلی و صف ابری ثبت شد';
  }

  sessionsEl.textContent = `${athlete.remainingSessions} جلسه باقیمانده`;
  sessionsEl.className = athlete.remainingSessions <= 1 ? 'metric-val text-warning' : 'metric-val text-success';

  if (athlete.debt > 0) {
    financeEl.textContent = `${formatCurrency(athlete.debt)} تومان بدهکار`;
    financeEl.className = 'metric-val text-danger';
  } else {
    financeEl.textContent = 'تسویه کامل (۰ تومان)';
    financeEl.className = 'metric-val text-success';
  }

  // Create SMS message
  let msgContent = `والدین گرامی، فرزند شما ${athlete.name} در ساعت ${nowTime} وارد استخر شد. مانده جلسات دوره: ${athlete.remainingSessions} جلسه.`;
  if (athlete.debt > 0) {
    msgContent += ` (یادآوری بدهی شهریه: ${formatCurrency(athlete.debt)} تومان)`;
  }

  smsNotice.style.display = 'flex';
  smsText.textContent = `«${msgContent}»`;

  const online = isOnline();
  const smsStatus = online ? 'تحویل شده به گوشی' : '⏳ در صف ارسال آفلاین';

  // Log SMS
  store.smsLogs.unshift({
    id: `sms-${Date.now()}`,
    time: nowTime,
    receiver: `${athlete.phone} (${athlete.name})`,
    event: 'ثبت تردد استخر',
    text: msgContent,
    status: smsStatus
  });

  // Log Attendance
  store.attendanceLogs.unshift({
    id: `att-${Date.now()}`,
    time: nowTime,
    athleteName: athlete.name,
    coachName: coach.name,
    status: isWarning ? 'warning' : 'approved',
    sessionsLeft: athlete.remainingSessions,
    note: isWarning ? 'ورود با هشدار' : 'ورود عادی'
  });

  // If offline, queue for sync
  if (!online) {
    addToOfflineQueue('ATTENDANCE', `ثبت تردد ${athlete.name} (${coach.name})`, {
      athleteId: athlete.id,
      remainingSessions: athlete.remainingSessions,
      time: nowTime
    });
  }

  // Save to persistence
  saveStore();
  renderRecentLogs();
  updateSmsBadge();
}

function renderRecentLogs() {
  const container = document.getElementById('recentLogList');
  const countBadge = document.getElementById('todayCountBadge');
  if (!container) return;

  countBadge.textContent = `${store.attendanceLogs.length} تردد`;
  container.innerHTML = '';

  if (store.attendanceLogs.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;padding:1rem;">هنوز ترددی ثبت نشده است.</p>';
    return;
  }

  store.attendanceLogs.slice(0, 8).forEach(item => {
    const el = document.createElement('div');
    el.className = 'recent-item';
    el.innerHTML = `
      <div class="recent-athlete-info">
        <span class="${item.status === 'warning' ? 'recent-badge-warn' : 'recent-badge-ok'}">${item.status === 'warning' ? 'هشدار' : 'تایید'}</span>
        <div>
          <strong>${item.athleteName}</strong>
          <span class="text-muted" style="font-size:0.75rem;margin-right:4px;">(${item.coachName})</span>
        </div>
      </div>
      <div>
        <span class="text-muted" style="margin-left:8px;">${item.sessionsLeft} جلسه مانده</span>
        <strong>${item.time}</strong>
      </div>
    `;
    container.appendChild(el);
  });
}

// ==========================================
// 5. ATHLETES MANAGEMENT
// ==========================================
function renderAthletesTable() {
  const tbody = document.getElementById('athletesTableBody');
  const coachFilter = document.getElementById('athleteCoachFilter');
  const statusFilter = document.getElementById('athleteStatusFilter');
  const searchInput = document.getElementById('athleteSearchInput');

  if (!tbody) return;

  // Populate coach filter dropdown
  coachFilter.innerHTML = '<option value="all">همه مربیان</option>';
  store.coaches.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    coachFilter.appendChild(opt);
  });

  const query = searchInput.value.trim().toLowerCase();
  const selectedCoach = coachFilter.value;
  const selectedStatus = statusFilter.value;

  const filtered = store.athletes.filter(a => {
    const matchQuery = !query || 
      a.name.toLowerCase().includes(query) ||
      a.phone.includes(query) ||
      (a.cardUid && a.cardUid.toLowerCase().includes(query));

    const matchCoach = selectedCoach === 'all' || a.coachId === selectedCoach;

    let matchStatus = true;
    if (selectedStatus === 'debt') matchStatus = a.debt > 0;
    else if (selectedStatus === 'active') matchStatus = a.remainingSessions > 0;
    else if (selectedStatus === 'expired') matchStatus = a.remainingSessions === 0;

    return matchQuery && matchCoach && matchStatus;
  });

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;" class="text-muted">ورزشکاری با مشخصات انتخاب‌شده یافت نشد.</td></tr>';
    return;
  }

  filtered.forEach(athlete => {
    const coach = store.coaches.find(c => c.id === athlete.coachId) || { name: 'نامشخص' };
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <strong>${athlete.name}</strong>
        <div class="text-muted" style="font-size:0.8rem;">${athlete.phone}</div>
      </td>
      <td>${coach.name}</td>
      <td>
        <span>${athlete.packageName}</span>
        <div class="text-muted" style="font-size:0.75rem;">شهریه: ${formatCurrency(athlete.tuitionFee)} ت</div>
      </td>
      <td>
        <strong class="${athlete.remainingSessions === 0 ? 'text-danger' : athlete.remainingSessions <= 2 ? 'text-warning' : 'text-success'}">
          ${athlete.remainingSessions} از ${athlete.totalSessions} جلسه
        </strong>
        <div class="text-muted" style="font-size:0.75rem;">(${athlete.totalAttended} جلسه حضور)</div>
      </td>
      <td>
        ${athlete.debt > 0 
          ? `<span class="text-danger" style="font-weight:700;">${formatCurrency(athlete.debt)} ت بدهکار</span>` 
          : `<span class="text-success">تسویه کامل</span>`
        }
      </td>
      <td>
        ${athlete.cardUid 
          ? `<span class="badge-tag-uid">${athlete.cardUid}</span>` 
          : `<button class="btn-sm btn-secondary" onclick="openAssignCardModal('${athlete.id}')">+ اتصال مچ‌بند</button>`
        }
      </td>
      <td>
        <button class="btn-sm btn-secondary" onclick="openAssignCardModal('${athlete.id}')" title="تغییر مچ‌بند">مچ‌بند</button>
        <button class="btn-sm btn-primary" onclick="openPaymentForAthlete('${athlete.id}')" title="ثبت دریافت شهریه">دریافت</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function initAthleteFilters() {
  const searchInput = document.getElementById('athleteSearchInput');
  const coachFilter = document.getElementById('athleteCoachFilter');
  const statusFilter = document.getElementById('athleteStatusFilter');

  if (searchInput) searchInput.addEventListener('input', renderAthletesTable);
  if (coachFilter) coachFilter.addEventListener('change', renderAthletesTable);
  if (statusFilter) statusFilter.addEventListener('change', renderAthletesTable);
}

// ==========================================
// 6. COACHES MANAGEMENT & CALCULATIONS
// ==========================================
function renderCoaches() {
  const container = document.getElementById('coachesCardsContainer');
  if (!container) return;
  container.innerHTML = '';

  store.coaches.forEach(coach => {
    // Calculate coach metrics based on assigned athletes
    const assignedAthletes = store.athletes.filter(a => a.coachId === coach.id);
    const totalAssigned = assignedAthletes.length;
    const totalSessionsConducted = assignedAthletes.reduce((sum, a) => sum + (a.totalAttended || 0), 0);

    let totalEarned = 0;
    if (coach.modelType === 'percentage') {
      const tuitionSum = assignedAthletes.reduce((sum, a) => sum + (a.tuitionFee || 0), 0);
      totalEarned = (tuitionSum * coach.modelVal) / 100;
    } else if (coach.modelType === 'per_session') {
      totalEarned = totalSessionsConducted * coach.modelVal;
    } else if (coach.modelType === 'monthly_fixed') {
      totalEarned = coach.modelVal;
    }

    const payableBalance = Math.max(0, totalEarned - (coach.settledAmount || 0));

    const card = document.createElement('div');
    card.className = 'coach-card';
    card.innerHTML = `
      <div>
        <div class="coach-header">
          <div class="coach-avatar">${coach.name.split(' ').slice(-1)[0][0]}</div>
          <div>
            <h3>${coach.name}</h3>
            <span class="text-muted">${coach.specialty}</span>
            <div><span class="coach-model-badge">${coach.modelLabel}</span></div>
          </div>
        </div>

        <div class="coach-stats">
          <div class="coach-stat-item">
            <span>شاگردان فعال</span>
            <strong>${totalAssigned} ورزشکار</strong>
          </div>
          <div class="coach-stat-item">
            <span>جلسات برگزارشده</span>
            <strong>${totalSessionsConducted} سانس</strong>
          </div>
          <div class="coach-stat-item">
            <span>کل کارکرد مربی</span>
            <strong class="text-primary">${formatCurrency(totalEarned)} ت</strong>
          </div>
          <div class="coach-stat-item">
            <span>واریز شده تا کنون</span>
            <strong>${formatCurrency(coach.settledAmount || 0)} ت</strong>
          </div>
        </div>
      </div>

      <div style="border-top: 1px solid var(--border); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size:0.75rem; color:var(--text-muted); display:block;">مانده طلب مربی:</span>
          <strong class="${payableBalance > 0 ? 'text-warning' : 'text-success'}" style="font-size:1.1rem;">
            ${formatCurrency(payableBalance)} تومان
          </strong>
        </div>
        <div style="display: flex; gap: 0.4rem; align-items: center;">
          <button class="btn-secondary btn-sm" onclick="openEditCoachModal('${coach.id}')" title="ویرایش مشخصات مربی">
            ویرایش مشخصات
          </button>
          <button class="btn-primary btn-sm" onclick="openSettleCoachModal('${coach.id}', '${coach.name}', ${payableBalance})">
            تسویه‌حساب دستمزد
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================
// 7. ACCOUNTING & FINANCIAL KPIS
// ==========================================
function renderAccounting() {
  // 1. Calculate Total Incomes (Tuitions recorded)
  const totalIncome = store.transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  // 2. Calculate Total Expenses
  const totalExpenses = store.transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // 3. Calculate Coach Fees
  let totalCoachFees = 0;
  store.coaches.forEach(c => {
    const assigned = store.athletes.filter(a => a.coachId === c.id);
    if (c.modelType === 'percentage') {
      const tuitionSum = assigned.reduce((sum, a) => sum + (a.tuitionFee || 0), 0);
      totalCoachFees += (tuitionSum * c.modelVal) / 100;
    } else if (c.modelType === 'per_session') {
      const attends = assigned.reduce((sum, a) => sum + (a.totalAttended || 0), 0);
      totalCoachFees += attends * c.modelVal;
    } else if (c.modelType === 'monthly_fixed') {
      totalCoachFees += c.modelVal;
    }
  });

  // 4. Net Profit
  const netProfit = totalIncome - totalCoachFees - totalExpenses;

  // 5. Total Debts
  const totalDebt = store.athletes.reduce((sum, a) => sum + (a.debt || 0), 0);
  const debtors = store.athletes.filter(a => a.debt > 0);

  // Update KPI Cards
  document.getElementById('kpiTotalIncome').textContent = `${formatCurrency(totalIncome)} تومان`;
  document.getElementById('kpiCoachesPay').textContent = `${formatCurrency(totalCoachFees)} تومان`;
  document.getElementById('kpiTotalExpenses').textContent = `${formatCurrency(totalExpenses)} تومان`;
  document.getElementById('kpiNetProfit').textContent = `${formatCurrency(netProfit)} تومان`;
  document.getElementById('kpiTotalDebts').textContent = `${formatCurrency(totalDebt)} تومان`;
  document.getElementById('kpiDebtorsCount').textContent = `${debtors.length} ورزشکار بدهکار`;

  // Render Transactions Table
  const tbody = document.getElementById('transactionsTableBody');
  tbody.innerHTML = '';
  store.transactions.forEach(t => {
    const tr = document.createElement('tr');
    let typeBadge = '';
    let amountClass = '';

    if (t.type === 'income') {
      typeBadge = '<span class="recent-badge-ok">دریافت شهریه</span>';
      amountClass = 'text-success';
    } else if (t.type === 'expense') {
      typeBadge = '<span class="recent-badge-warn" style="background:#fee2e2;color:#b91c1c;">هزینه استخر</span>';
      amountClass = 'text-danger';
    } else {
      typeBadge = '<span class="recent-badge-warn">دستمزد مربی</span>';
      amountClass = 'text-warning';
    }

    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${typeBadge}</td>
      <td><strong>${t.title}</strong></td>
      <td><strong class="${amountClass}">${formatCurrency(t.amount)} ت</strong></td>
      <td>${t.method}</td>
      <td class="text-muted">${t.author}</td>
    `;
    tbody.appendChild(tr);
  });

  // Render Debtors List
  const debtorsList = document.getElementById('debtorsListContainer');
  debtorsList.innerHTML = '';
  if (debtors.length === 0) {
    debtorsList.innerHTML = '<p class="text-muted" style="text-align:center;padding:1.5rem;">تمامی ورزشکاران تسویه‌حساب کامل هستند.</p>';
  } else {
    debtors.forEach(athlete => {
      const item = document.createElement('div');
      item.className = 'debtor-item';
      item.innerHTML = `
        <div class="debtor-info">
          <h4>${athlete.name}</h4>
          <span>تلفن: ${athlete.phone} • مانده بدهی:</span>
          <strong class="text-danger" style="display:block;margin-top:2px;">${formatCurrency(athlete.debt)} تومان</strong>
        </div>
        <div class="debtor-action">
          <button class="btn-sm btn-secondary" onclick="sendSingleDebtReminder('${athlete.id}')">ارسال پیامک</button>
          <button class="btn-sm btn-success" style="margin-top:4px;" onclick="openPaymentForAthlete('${athlete.id}')">تسویه</button>
        </div>
      `;
      debtorsList.appendChild(item);
    });
  }
}

// Bulk SMS debt reminder
function initBulkDebtReminder() {
  const btn = document.getElementById('sendBulkSmsReminderBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const debtors = store.athletes.filter(a => a.debt > 0);
    if (debtors.length === 0) {
      alert('هیچ ورزشکار بدهکاری در سیستم وجود ندارد.');
      return;
    }

    const nowTime = getCurrentTimeStr();
    debtors.forEach(a => {
      store.smsLogs.unshift({
        id: `sms-${Date.now()}-${a.id}`,
        time: nowTime,
        receiver: `${a.phone} (${a.name})`,
        event: 'یادآوری بدهی شهریه',
        text: `ورزشکار گرامی ${a.name}، مانده بدهی شهریه شما مبلغ ${formatCurrency(a.debt)} تومان می‌باشد. لطفاً جهت تسویه‌حساب اقدام فرمایید. آکادمی شنای براتی.`,
        status: 'تحویل شده به گوشی'
      });
    });

    saveStore();
    updateSmsBadge();
    playSuccessChime();
    alert(`پیامک یادآوری بدهی با موفقیت برای ${debtors.length} ورزشکار به سامانه مخابرات ارسال شد.`);
  });
}

function sendSingleDebtReminder(athleteId) {
  const a = store.athletes.find(x => x.id === athleteId);
  if (!a) return;
  const nowTime = getCurrentTimeStr();
  store.smsLogs.unshift({
    id: `sms-${Date.now()}`,
    time: nowTime,
    receiver: `${a.phone} (${a.name})`,
    event: 'یادآوری بدهی شهریه',
    text: `ورزشکار گرامی ${a.name}، مانده بدهی شهریه شما مبلغ ${formatCurrency(a.debt)} تومان می‌باشد. لطفاً جهت تسویه‌حساب به دفتر آکادمی مراجعه فرمایید.`,
    status: 'تحویل شده به گوشی'
  });
  saveStore();
  updateSmsBadge();
  playSuccessChime();
  alert(`پیامک یادآوری برای ${a.name} ارسال شد.`);
}

// ==========================================
// 8. SMS LOGS TAB
// ==========================================
function renderSmsLogs() {
  const tbody = document.getElementById('smsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (store.smsLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;" class="text-muted">هنوز پیامکی ثبت نشده است.</td></tr>';
    return;
  }

  store.smsLogs.forEach(log => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${log.time}</strong></td>
      <td>${log.receiver}</td>
      <td><span class="badge-role" style="background:#e0f2fe;color:#0369a1;border:none;">${log.event}</span></td>
      <td style="max-width:380px;">${log.text}</td>
      <td><span class="recent-badge-ok">✓ ${log.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateSmsBadge() {
  const badge = document.getElementById('smsBadgeCount');
  if (badge) badge.textContent = store.smsLogs.length;
}

// ==========================================
// 9. DIALOGS & FORMS (MODERN WEB GUIDANCE)
// ==========================================
function initDialogs() {
  // Apply fallback for light-dismiss on all <dialog> elements
  setupDialogLightDismissFallback();

  // Sync :user-invalid with aria-invalid (per Modern Web Guidance)
  setupAriaInvalidSync();

  // 1. New Athlete Dialog
  const openNewAthleteBtn = document.getElementById('openNewAthleteDialogBtn');
  const newAthleteDialog = document.getElementById('newAthleteDialog');
  const athleteCoachSelect = document.getElementById('athleteCoachSelect');
  const genUidBtn = document.getElementById('generateRandomUidBtn');

  if (openNewAthleteBtn && newAthleteDialog) {
    openNewAthleteBtn.addEventListener('click', () => {
      // Populate coaches
      athleteCoachSelect.innerHTML = '';
      store.coaches.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.specialty})`;
        athleteCoachSelect.appendChild(opt);
      });
      newAthleteDialog.showModal();
    });
  }

  if (genUidBtn) {
    genUidBtn.addEventListener('click', () => {
      const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
      document.getElementById('athleteNfcUid').value = `NFC-${hex}`;
    });
  }

  const newAthleteForm = document.getElementById('newAthleteForm');
  if (newAthleteForm) {
    newAthleteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('athleteName').value.trim();
      const phone = document.getElementById('athletePhone').value.trim();
      const coachId = document.getElementById('athleteCoachSelect').value;
      const pkgSelect = document.getElementById('athletePackageSelect');
      const selectedOption = pkgSelect.options[pkgSelect.selectedIndex];
      const sessions = parseInt(selectedOption.dataset.sessions, 10);
      const price = parseInt(selectedOption.dataset.price, 10);
      const initialPaid = parseInt(document.getElementById('athleteInitialPayment').value, 10) || 0;
      const uid = document.getElementById('athleteNfcUid').value.trim();

      const debt = Math.max(0, price - initialPaid);

      const newAthlete = {
        id: `a-${Date.now()}`,
        name,
        phone,
        coachId,
        cardUid: uid,
        packageName: selectedOption.textContent.split('(')[0].trim() + ` (${sessions} جلسه)`,
        totalSessions: sessions,
        remainingSessions: sessions,
        totalAttended: 0,
        tuitionFee: price,
        paidAmount: initialPaid,
        debt,
        expireDate: '۱۴۰۵/۰۹/۳۰'
      };

      store.athletes.push(newAthlete);

      // Record transaction if initial payment made
      if (initialPaid > 0) {
        store.transactions.unshift({
          id: `t-${Date.now()}`,
          date: '۱۴۰۵/۰۸/۲۴',
          type: 'income',
          title: `شهریه ثبت‌نام - ${name}`,
          amount: initialPaid,
          method: 'وجه نقد / کارتخوان',
          author: 'سرمربی براتی'
        });
      }

      // If offline, add to sync queue
      if (!isOnline()) {
        addToOfflineQueue('ATHLETE', `ثبت‌نام ورزشکار جدید: ${name}`, { athleteId: newAthlete.id, name });
      }

      saveStore();
      newAthleteDialog.close();
      newAthleteForm.reset();
      renderAthletesTable();
      renderAccounting();
      playSuccessChime();
      alert(`ورزشکار ${name} با موفقیت ثبت‌نام شد${!isOnline() ? ' (در صف آفلاین ذخیره گردید)' : ''}.`);
    });
  }

  // 2. Manual Attendance Dialog (Card forgotten)
  const openManualBtn = document.getElementById('openManualEntryDialogBtn');
  const manualDialog = document.getElementById('manualEntryDialog');
  const manualSearchInput = document.getElementById('manualEntrySearch');
  const manualResultsContainer = document.getElementById('manualAthleteResults');

  if (openManualBtn && manualDialog) {
    openManualBtn.addEventListener('click', () => {
      manualSearchInput.value = '';
      renderManualSearchResults('');
      manualDialog.showModal();
    });
  }

  if (manualSearchInput) {
    manualSearchInput.addEventListener('input', (e) => {
      renderManualSearchResults(e.target.value.trim());
    });
  }

  function renderManualSearchResults(q) {
    manualResultsContainer.innerHTML = '';
    const filtered = store.athletes.filter(a => {
      if (!q) return true;
      return a.name.includes(q) || a.phone.includes(q);
    });

    if (filtered.length === 0) {
      manualResultsContainer.innerHTML = '<p class="text-muted">ورزشکاری با این نام پیدا نشد.</p>';
      return;
    }

    filtered.forEach(a => {
      const item = document.createElement('div');
      item.className = 'manual-athlete-item';
      item.innerHTML = `
        <div>
          <strong>${a.name}</strong>
          <span class="text-muted" style="margin-right:6px;font-size:0.8rem;">(مانده: ${a.remainingSessions} جلسه)</span>
        </div>
        <button class="btn-sm btn-primary" onclick="confirmManualCheckIn('${a.id}')">ثبت ورود</button>
      `;
      manualResultsContainer.appendChild(item);
    });
  }

  // 3. New Payment Dialog
  const openNewPaymentBtn = document.getElementById('openNewPaymentDialogBtn');
  const newPaymentDialog = document.getElementById('newPaymentDialog');
  const paymentAthleteSelect = document.getElementById('paymentAthleteSelect');
  const newPaymentForm = document.getElementById('newPaymentForm');

  if (openNewPaymentBtn && newPaymentDialog) {
    openNewPaymentBtn.addEventListener('click', () => {
      populatePaymentAthleteSelect();
      newPaymentDialog.showModal();
    });
  }

  if (newPaymentForm) {
    newPaymentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const athleteId = paymentAthleteSelect.value;
      const amount = parseInt(document.getElementById('paymentAmount').value, 10);
      const method = document.getElementById('paymentMethod').value;
      const desc = document.getElementById('paymentDescription').value.trim();

      const athlete = store.athletes.find(a => a.id === athleteId);
      if (!athlete) return;

      athlete.debt = Math.max(0, athlete.debt - amount);
      athlete.paidAmount = (athlete.paidAmount || 0) + amount;

      store.transactions.unshift({
        id: `t-${Date.now()}`,
        date: '۱۴۰۵/۰۸/۲۴',
        type: 'income',
        title: `دریافت شهریه - ${athlete.name}${desc ? ' (' + desc + ')' : ''}`,
        amount,
        method,
        author: 'سرمربی براتی'
      });

      // If offline, add to sync queue
      if (!isOnline()) {
        addToOfflineQueue('PAYMENT', `دریافت شهریه ${athlete.name}: ${formatCurrency(amount)} ت`, { athleteId, amount });
      }

      saveStore();
      newPaymentDialog.close();
      newPaymentForm.reset();
      renderAccounting();
      renderAthletesTable();
      playSuccessChime();
      alert(`دریافت مبلغ ${formatCurrency(amount)} تومان برای ${athlete.name} ثبت شد${!isOnline() ? ' (در صف آفلاین)' : ''}.`);
    });
  }

  // 4. New Pool Expense Dialog
  const openNewExpenseBtn = document.getElementById('openNewExpenseDialogBtn');
  const newExpenseDialog = document.getElementById('newExpenseDialog');
  const newExpenseForm = document.getElementById('newExpenseForm');

  if (openNewExpenseBtn && newExpenseDialog) {
    openNewExpenseBtn.addEventListener('click', () => {
      newExpenseDialog.showModal();
    });
  }

  if (newExpenseForm) {
    newExpenseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const cat = document.getElementById('expenseCategory').value;
      const amount = parseInt(document.getElementById('expenseAmount').value, 10);
      const title = document.getElementById('expenseTitle').value.trim();

      store.transactions.unshift({
        id: `t-${Date.now()}`,
        date: '۱۴۰۵/۰۸/۲۴',
        type: 'expense',
        title: `${cat}: ${title}`,
        amount,
        method: 'حساب جاری آکادمی',
        author: 'سرمربی براتی'
      });

      // If offline, add to sync queue
      if (!isOnline()) {
        addToOfflineQueue('EXPENSE', `هزینه: ${title} (${formatCurrency(amount)} ت)`, { cat, amount, title });
      }

      saveStore();
      newExpenseDialog.close();
      newExpenseForm.reset();
      renderAccounting();
      playSuccessChime();
      alert(`هزینه به مبلغ ${formatCurrency(amount)} تومان در دفتر مالی ثبت شد${!isOnline() ? ' (در صف آفلاین)' : ''}.`);
    });
  }

  // 5. Assign Card Dialog
  const assignCardForm = document.getElementById('assignCardForm');
  const genCardUidBtn = document.getElementById('generateCardUidBtn');
  if (genCardUidBtn) {
    genCardUidBtn.addEventListener('click', () => {
      const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
      document.getElementById('newCardUidInput').value = `NFC-${hex}`;
    });
  }

  if (assignCardForm) {
    assignCardForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const athleteId = document.getElementById('assignAthleteId').value;
      const newUid = document.getElementById('newCardUidInput').value.trim();

      const athlete = store.athletes.find(a => a.id === athleteId);
      if (athlete) {
        athlete.cardUid = newUid;
        saveStore();
        renderAthletesTable();
        document.getElementById('assignCardDialog').close();
        playSuccessChime();
        alert(`مچ‌بند با شناسه ${newUid} به ${athlete.name} پیوند داده شد.`);
      }
    });
  }

  // 6. Settle Coach Dialog
  const settleCoachForm = document.getElementById('settleCoachForm');
  if (settleCoachForm) {
    settleCoachForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const coachId = document.getElementById('settleCoachId').value;
      const amount = parseInt(document.getElementById('settleAmount').value, 10);
      const ref = document.getElementById('settleRef').value.trim();

      const coach = store.coaches.find(c => c.id === coachId);
      if (!coach) return;

      coach.settledAmount = (coach.settledAmount || 0) + amount;

      store.transactions.unshift({
        id: `t-${Date.now()}`,
        date: '۱۴۰۵/۰۸/۲۴',
        type: 'coach_payout',
        title: `تسویه دستمزد - ${coach.name}${ref ? ' (' + ref + ')' : ''}`,
        amount,
        method: 'واریز بانکی / پایا',
        author: 'سرمربی براتی'
      });

      saveStore();
      document.getElementById('settleCoachDialog').close();
      renderCoaches();
      renderAccounting();
      playSuccessChime();
      alert(`سند پرداخت دستمزد به مبلغ ${formatCurrency(amount)} تومان به نام ${coach.name} ثبت گردید.`);
    });
  }

  // 6B. Coach Add / Edit Listeners
  const openNewCoachDialogBtn = document.getElementById('openNewCoachDialogBtn');
  const coachModal = document.getElementById('coachModal');
  const coachForm = document.getElementById('coachForm');

  if (openNewCoachDialogBtn && coachModal) {
    openNewCoachDialogBtn.addEventListener('click', () => {
      document.getElementById('coachModalTitle').textContent = 'ثبت مربی جدید';
      document.getElementById('coachSubmitBtn').textContent = 'ثبت مربی';
      document.getElementById('coachEditId').value = '';
      document.getElementById('coachName').value = '';
      document.getElementById('coachSpecialty').value = '';
      document.getElementById('coachPhone').value = '';
      document.getElementById('coachModelType').value = 'percentage';
      document.getElementById('coachModelVal').value = '35';
      document.getElementById('coachModelValLabel').textContent = 'درصد مربی از شهریه (مثلاً ۳۵)';
      coachModal.showModal();
    });
  }

  const coachModelTypeSelect = document.getElementById('coachModelType');
  if (coachModelTypeSelect) {
    coachModelTypeSelect.addEventListener('change', () => {
      const type = coachModelTypeSelect.value;
      const label = document.getElementById('coachModelValLabel');
      const valInput = document.getElementById('coachModelVal');
      if (type === 'percentage') {
        label.textContent = 'درصد مربی از شهریه (%)';
        if (parseInt(valInput.value, 10) > 100) valInput.value = '35';
      } else if (type === 'per_session') {
        label.textContent = 'مبلغ هر سانس / جلسه (تومان)';
        if (parseInt(valInput.value, 10) < 1000) valInput.value = '150000';
      } else {
        label.textContent = 'حقوق ثابت ماهانه (تومان)';
        if (parseInt(valInput.value, 10) < 10000) valInput.value = '8000000';
      }
    });
  }

  if (coachForm) {
    coachForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = document.getElementById('coachEditId').value;
      const name = document.getElementById('coachName').value.trim();
      const specialty = document.getElementById('coachSpecialty').value.trim();
      const phone = document.getElementById('coachPhone').value.trim();
      const modelType = document.getElementById('coachModelType').value;
      const modelVal = parseInt(document.getElementById('coachModelVal').value, 10) || 0;

      let modelLabel = '';
      if (modelType === 'percentage') {
        modelLabel = `درصدی (${modelVal}%)`;
      } else if (modelType === 'per_session') {
        modelLabel = `جلسه‌ای (${formatCurrency(modelVal)} ت)`;
      } else {
        modelLabel = `حقوق ثابت (${formatCurrency(modelVal)} ت)`;
      }

      if (editId) {
        // Edit existing coach
        const coach = store.coaches.find(c => c.id === editId);
        if (coach) {
          coach.name = name;
          coach.specialty = specialty;
          coach.phone = phone;
          coach.modelType = modelType;
          coach.modelVal = modelVal;
          coach.modelLabel = modelLabel;
        }
      } else {
        // Add new coach
        const newCoach = {
          id: `c_${Date.now()}`,
          name,
          specialty,
          phone,
          modelType,
          modelVal,
          modelLabel,
          settledAmount: 0
        };
        store.coaches.push(newCoach);
      }

      saveStore();
      coachModal.close();
      renderCoaches();
      renderAthletesTable();
      renderAccounting();
      playSuccessChime();
      alert(`مشخصات مربی «${name}» با موفقیت ذخیره شد.`);
    });
  }

  // 7. Offline Sync Queue Dialog & Network Toggle
  const openSyncQueueBtn = document.getElementById('openSyncQueueBtn');
  const syncQueueDialog = document.getElementById('syncQueueDialog');
  const forceSyncBtn = document.getElementById('forceSyncBtn');
  const networkToggleBtn = document.getElementById('networkToggleBtn');
  const reconnectBannerBtn = document.getElementById('reconnectBannerBtn');

  if (openSyncQueueBtn && syncQueueDialog) {
    openSyncQueueBtn.addEventListener('click', () => {
      renderSyncQueueList();
      syncQueueDialog.showModal();
    });
  }

  if (forceSyncBtn) {
    forceSyncBtn.addEventListener('click', () => {
      syncOfflineQueue();
    });
  }

  if (networkToggleBtn) {
    networkToggleBtn.addEventListener('click', () => {
      toggleNetworkSimulation();
    });
  }

  if (reconnectBannerBtn) {
    reconnectBannerBtn.addEventListener('click', () => {
      toggleNetworkSimulation();
    });
  }

  window.addEventListener('online', () => updateNetworkUI());
  window.addEventListener('offline', () => updateNetworkUI());

  // Clear SMS Logs
  const clearSmsBtn = document.getElementById('clearSmsLogsBtn');
  if (clearSmsBtn) {
    clearSmsBtn.addEventListener('click', () => {
      if (confirm('آیا از پاک‌سازی تمامی گزارش‌های پیامک اطمینان دارید؟')) {
        store.smsLogs = [];
        saveStore();
        renderSmsLogs();
        updateSmsBadge();
      }
    });
  }
}

// Global modal triggers
window.confirmManualCheckIn = function(athleteId) {
  const athlete = store.athletes.find(a => a.id === athleteId);
  if (!athlete) return;
  document.getElementById('manualEntryDialog').close();

  // If athlete has a card UID, scan it; otherwise create temporary scan
  if (athlete.cardUid) {
    processCardScan(athlete.cardUid);
  } else {
    // Generate temporary ID to run logic
    athlete.cardUid = `TEMP-${Date.now()}`;
    processCardScan(athlete.cardUid);
    athlete.cardUid = ''; // reset
    saveStore();
  }
};

window.openAssignCardModal = function(athleteId) {
  const athlete = store.athletes.find(a => a.id === athleteId);
  if (!athlete) return;
  document.getElementById('assignAthleteId').value = athlete.id;
  document.getElementById('assignAthleteNameDisplay').textContent = athlete.name;
  document.getElementById('newCardUidInput').value = athlete.cardUid || '';
  document.getElementById('assignCardDialog').showModal();
};

window.openPaymentForAthlete = function(athleteId) {
  populatePaymentAthleteSelect();
  document.getElementById('paymentAthleteSelect').value = athleteId;
  const athlete = store.athletes.find(a => a.id === athleteId);
  if (athlete && athlete.debt > 0) {
    document.getElementById('paymentAmount').value = athlete.debt;
  }
  document.getElementById('newPaymentDialog').showModal();
};

window.openSettleCoachModal = function(coachId, coachName, payableBalance) {
  document.getElementById('settleCoachId').value = coachId;
  document.getElementById('settleCoachNameDisplay').textContent = coachName;
  document.getElementById('settleCoachPayableDisplay').textContent = `${formatCurrency(payableBalance)} تومان`;
  document.getElementById('settleAmount').value = payableBalance > 0 ? payableBalance : 500000;
  document.getElementById('settleCoachDialog').showModal();
};

window.openEditCoachModal = function(coachId) {
  const coach = store.coaches.find(c => c.id === coachId);
  if (!coach) return;

  const coachModal = document.getElementById('coachModal');
  document.getElementById('coachModalTitle').textContent = 'ویرایش مشخصات مربی';
  document.getElementById('coachSubmitBtn').textContent = 'ذخیره تغییرات';
  document.getElementById('coachEditId').value = coach.id;
  document.getElementById('coachName').value = coach.name;
  document.getElementById('coachSpecialty').value = coach.specialty;
  document.getElementById('coachPhone').value = coach.phone || '';
  document.getElementById('coachModelType').value = coach.modelType || 'percentage';
  document.getElementById('coachModelVal').value = coach.modelVal || 35;

  const label = document.getElementById('coachModelValLabel');
  if (coach.modelType === 'percentage') {
    label.textContent = 'درصد مربی از شهریه (%)';
  } else if (coach.modelType === 'per_session') {
    label.textContent = 'مبلغ هر سانس / جلسه (تومان)';
  } else {
    label.textContent = 'حقوق ثابت ماهانه (تومان)';
  }

  coachModal.showModal();
};

function populatePaymentAthleteSelect() {
  const sel = document.getElementById('paymentAthleteSelect');
  sel.innerHTML = '';
  store.athletes.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.name} (بدهی فعلی: ${formatCurrency(a.debt)} تومان)`;
    sel.appendChild(opt);
  });
}

// ==========================================
// 10. MODERN WEB GUIDANCE COMPLIANCE
// ==========================================

/**
 * Fallback for light-dismiss on <dialog>
 * Required by Modern Web Guidance: `light-dismiss-a-dialog`
 * Checks if browser natively supports closedBy. If not, listens for clicks on the backdrop.
 */
function setupDialogLightDismissFallback() {
  const dialogs = document.querySelectorAll('dialog');
  dialogs.forEach(dialog => {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        // When clicking backdrop, target is the dialog element itself
        if (event.target !== dialog) return;

        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );

        if (isDialogContent) return;
        dialog.close();
      });
    }
  });
}

/**
 * Synchronize aria-invalid with CSS :user-invalid state
 * Required by Modern Web Guidance: `validate-input-after-interaction`
 */
function setupAriaInvalidSync() {
  const syncAria = (el) => {
    if (!el || !el.matches) return;
    const isUserInvalid = el.matches(':user-invalid');
    el.setAttribute?.('aria-invalid', isUserInvalid ? 'true' : 'false');
  };

  document.addEventListener('blur', (e) => syncAria(e.target), true);
  document.addEventListener('input', (e) => {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('aria-invalid')) {
      syncAria(e.target);
    }
  });
}

// ==========================================
// 11. HELPERS & INITIALIZATION
// ==========================================
function formatCurrency(num) {
  if (isNaN(num)) return '۰';
  return Number(num).toLocaleString('fa-IR');
}

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initScanner();
  initAthleteFilters();
  renderAthletesTable();
  renderCoaches();
  renderAccounting();
  initBulkDebtReminder();
  initDialogs();
  updateSmsBadge();
  updateNetworkUI();

  // Register PWA Service Worker for Offline-First capability
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration failed:', error);
      });
  }
});
