/**
 * Strict Input Validation Schemas and Payload Sanitizer
 * Barati Swimming Academy Cloud Backend
 */

/**
 * Checks for prototype pollution attack vectors
 * @param {any} obj
 * @param {WeakSet} [seen]
 * @returns {boolean}
 */
export function hasPrototypePollution(obj, seen = new WeakSet()) {
  if (!obj || typeof obj !== 'object') return false;
  if (seen.has(obj)) return false;
  seen.add(obj);

  for (const key of Object.getOwnPropertyNames(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    const val = obj[key];
    if (val && typeof val === 'object' && hasPrototypePollution(val, seen)) {
      return true;
    }
  }
  return false;
}

/**
 * Malformed JSON Body Error Handler Middleware
 */
export const jsonSyntaxErrorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'MALFORMED_JSON',
      message: 'فرمت داده‌های JSON ارسالی نامعتبر است.',
      statusCode: 400
    });
  }
  next(err);
};

/**
 * Validates Full Mobile Two-Way Sync Payload (POST /api/sync)
 */
export const validateSyncPayload = (req, res, next) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'بدنه درخواست باید یک آبجکت JSON معتبر باشد.',
      statusCode: 400
    });
  }

  if (hasPrototypePollution(body)) {
    return res.status(400).json({
      error: 'SECURITY_VIOLATION',
      message: 'فیلدهای غیرمجاز شناسایی شدند.',
      statusCode: 400
    });
  }

  const errors = [];

  // 1. Validate array collections if present
  const arrayFields = ['athletes', 'attendanceLogs', 'attendance', 'transactions', 'definitions', 'app_settings'];
  for (const field of arrayFields) {
    if (body[field] !== undefined && !Array.isArray(body[field])) {
      errors.push({ field, issue: `${field} باید آرایه باشد.` });
    }
  }

  // 2. Validate deviceInfo if present
  if (body.deviceInfo !== undefined) {
    if (!body.deviceInfo || typeof body.deviceInfo !== 'object' || Array.isArray(body.deviceInfo)) {
      errors.push({ field: 'deviceInfo', issue: 'deviceInfo باید یک آبجکت باشد.' });
    } else if (!body.deviceInfo.deviceId || typeof body.deviceInfo.deviceId !== 'string' || body.deviceInfo.deviceId.trim() === '') {
      errors.push({ field: 'deviceInfo.deviceId', issue: 'شناسه دستگاه (deviceId) الزامی است.' });
    }
  }

  // 3. Validate settings if present (can be object)
  if (body.settings !== undefined && body.settings !== null) {
    if (typeof body.settings !== 'object' || Array.isArray(body.settings)) {
      errors.push({ field: 'settings', issue: 'settings باید یک آبجکت باشد.' });
    }
  }

  // 4. Validate athlete entries
  if (Array.isArray(body.athletes)) {
    body.athletes.forEach((athlete, idx) => {
      if (!athlete || typeof athlete !== 'object' || Array.isArray(athlete)) {
        errors.push({ field: `athletes[${idx}]`, issue: 'آیتم نامعتبر است.' });
      } else {
        if (typeof athlete.id !== 'string' || athlete.id.trim() === '') {
          errors.push({ field: `athletes[${idx}].id`, issue: 'شناسه الزامی و باید رشته متنی غیرخالی باشد.' });
        }
        if (typeof athlete.name !== 'string' || athlete.name.trim() === '') {
          errors.push({ field: `athletes[${idx}].name`, issue: 'نام ورزشکار الزامی و باید رشته متنی غیرخالی باشد.' });
        }
        if (typeof athlete.phone !== 'string' || athlete.phone.trim() === '') {
          errors.push({ field: `athletes[${idx}].phone`, issue: 'شماره تماس الزامی و باید رشته متنی غیرخالی باشد.' });
        }
      }
    });
  }

  // 5. Validate attendance entries (supports both attendanceLogs and attendance keys)
  const attendanceCollections = [];
  if (Array.isArray(body.attendanceLogs)) attendanceCollections.push({ key: 'attendanceLogs', list: body.attendanceLogs });
  if (Array.isArray(body.attendance)) attendanceCollections.push({ key: 'attendance', list: body.attendance });

  for (const { key, list } of attendanceCollections) {
    list.forEach((log, idx) => {
      if (!log || typeof log !== 'object' || Array.isArray(log)) {
        errors.push({ field: `${key}[${idx}]`, issue: 'آیتم نامعتبر است.' });
      } else {
        if (typeof log.id !== 'string' || log.id.trim() === '') {
          errors.push({ field: `${key}[${idx}].id`, issue: 'شناسه الزامی و باید رشته متنی غیرخالی باشد.' });
        }
        if (typeof log.time !== 'string' || log.time.trim() === '') {
          errors.push({ field: `${key}[${idx}].time`, issue: 'زمان ثبت تردد الزامی و باید رشته متنی باشد.' });
        }
        const athleteName = log.athleteName !== undefined ? log.athleteName : log.athlete_name;
        if (typeof athleteName !== 'string' || athleteName.trim() === '') {
          errors.push({ field: `${key}[${idx}].athleteName`, issue: 'نام ورزشکار الزامی و باید رشته متنی باشد.' });
        }
      }
    });
  }

  // 6. Validate transaction entries
  if (Array.isArray(body.transactions)) {
    body.transactions.forEach((tx, idx) => {
      if (!tx || typeof tx !== 'object' || Array.isArray(tx)) {
        errors.push({ field: `transactions[${idx}]`, issue: 'آیتم نامعتبر است.' });
      } else {
        if (typeof tx.id !== 'string' || tx.id.trim() === '') {
          errors.push({ field: `transactions[${idx}].id`, issue: 'شناسه الزامی و باید رشته متنی غیرخالی باشد.' });
        }
        if (typeof tx.title !== 'string' || tx.title.trim() === '') {
          errors.push({ field: `transactions[${idx}].title`, issue: 'عنوان تراکنش الزامی و باید رشته متنی غیرخالی باشد.' });
        }
        if (typeof tx.date !== 'string' || tx.date.trim() === '') {
          errors.push({ field: `transactions[${idx}].date`, issue: 'تاریخ تراکنش الزامی و باید رشته متنی باشد.' });
        }
        const isValidAmount =
          (typeof tx.amount === 'number' && !isNaN(tx.amount)) ||
          (typeof tx.amount === 'string' && tx.amount.trim() !== '' && !isNaN(Number(tx.amount)));
        if (!isValidAmount) {
          errors.push({ field: `transactions[${idx}].amount`, issue: 'مبلغ تراکنش الزامی و باید عدد معتبر باشد.' });
        }
        if (tx.type && !['income', 'expense', 'coach_payout'].includes(tx.type)) {
          errors.push({ field: `transactions[${idx}].type`, issue: 'نوع تراکنش نامعتبر است.' });
        }
      }
    });
  }

  // 7. Validate definition entries
  if (Array.isArray(body.definitions)) {
    body.definitions.forEach((def, idx) => {
      if (!def || typeof def !== 'object' || Array.isArray(def)) {
        errors.push({ field: `definitions[${idx}]`, issue: 'آیتم نامعتبر است.' });
      } else {
        if (typeof def.id !== 'string' || def.id.trim() === '') {
          errors.push({ field: `definitions[${idx}].id`, issue: 'شناسه الزامی و باید رشته متنی غیرخالی باشد.' });
        }
        if (typeof def.type !== 'string' || def.type.trim() === '') {
          errors.push({ field: `definitions[${idx}].type`, issue: 'نوع تعریف الزامی و باید رشته متنی باشد.' });
        }
        if (typeof def.title !== 'string' || def.title.trim() === '') {
          errors.push({ field: `definitions[${idx}].title`, issue: 'عنوان تعریف الزامی و باید رشته متنی غیرخالی باشد.' });
        }
      }
    });
  }

  // 8. Validate app_settings entries if passed as array
  if (Array.isArray(body.app_settings)) {
    body.app_settings.forEach((setting, idx) => {
      if (!setting || typeof setting !== 'object' || Array.isArray(setting)) {
        errors.push({ field: `app_settings[${idx}]`, issue: 'آیتم نامعتبر است.' });
      } else {
        if (typeof setting.id !== 'string' || setting.id.trim() === '') {
          errors.push({ field: `app_settings[${idx}].id`, issue: 'شناسه تنظیمات (id) الزامی و باید رشته متنی غیرخالی باشد.' });
        }
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'اعتبارسنجی اطلاعات ارسالی ناموفق بود.',
      details: errors,
      statusCode: 400
    });
  }

  next();
};

/**
 * Validates Athlete Payload (POST /api/v1/athletes)
 */
export const validateAthletePayload = (req, res, next) => {
  const item = req.body;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'بدنه درخواست باید یک آبجکت JSON معتبر باشد.',
      statusCode: 400
    });
  }

  if (hasPrototypePollution(item)) {
    return res.status(400).json({
      error: 'SECURITY_VIOLATION',
      message: 'فیلدهای غیرمجاز شناسایی شدند.',
      statusCode: 400
    });
  }

  if (
    typeof item.id !== 'string' || item.id.trim() === '' ||
    typeof item.name !== 'string' || item.name.trim() === '' ||
    typeof item.phone !== 'string'
  ) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'فیلدهای شناسه، نام و شماره تماس ورزشکار الزامی بوده و باید رشته معتبر باشند.',
      statusCode: 400
    });
  }

  next();
};

/**
 * Validates Transaction Payload (POST /api/v1/transactions)
 */
export const validateTransactionPayload = (req, res, next) => {
  const item = req.body;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'بدنه درخواست باید یک آبجکت JSON معتبر باشد.',
      statusCode: 400
    });
  }

  if (hasPrototypePollution(item)) {
    return res.status(400).json({
      error: 'SECURITY_VIOLATION',
      message: 'فیلدهای غیرمجاز شناسایی شدند.',
      statusCode: 400
    });
  }

  if (
    typeof item.id !== 'string' || item.id.trim() === '' ||
    typeof item.title !== 'string' || item.title.trim() === '' ||
    typeof item.date !== 'string' || item.date.trim() === ''
  ) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'فیلدهای شناسه، عنوان و تاریخ تراکنش الزامی بوده و باید رشته معتبر باشند.',
      statusCode: 400
    });
  }

  const isValidAmount =
    (typeof item.amount === 'number' && !isNaN(item.amount)) ||
    (typeof item.amount === 'string' && item.amount.trim() !== '' && !isNaN(Number(item.amount)));

  if (!isValidAmount) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'مبلغ تراکنش الزامی و باید یک عدد معتبر باشد.',
      statusCode: 400
    });
  }

  if (typeof item.type !== 'string' || !['income', 'expense', 'coach_payout'].includes(item.type)) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'نوع تراکنش نامعتبر است.',
      statusCode: 400
    });
  }

  next();
};

/**
 * Validates Attendance Payload (POST /api/v1/attendance)
 */
export const validateAttendancePayload = (req, res, next) => {
  const item = req.body;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'بدنه درخواست باید یک آبجکت JSON معتبر باشد.',
      statusCode: 400
    });
  }

  if (hasPrototypePollution(item)) {
    return res.status(400).json({
      error: 'SECURITY_VIOLATION',
      message: 'فیلدهای غیرمجاز شناسایی شدند.',
      statusCode: 400
    });
  }

  const athleteName = item.athleteName !== undefined ? item.athleteName : item.athlete_name;
  if (
    typeof item.id !== 'string' || item.id.trim() === '' ||
    typeof item.time !== 'string' || item.time.trim() === '' ||
    typeof athleteName !== 'string' || athleteName.trim() === ''
  ) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'فیلدهای شناسه، زمان و نام ورزشکار الزامی بوده و باید رشته معتبر باشند.',
      statusCode: 400
    });
  }

  if (item.status !== undefined && (typeof item.status !== 'string' || item.status.trim() === '')) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'وضعیت تردد (status) باید یک رشته متنی معتبر باشد.',
      statusCode: 400
    });
  }

  next();
};

/**
 * Validates Definition Payload (POST /api/v1/definitions)
 */
export const validateDefinitionPayload = (req, res, next) => {
  const item = req.body;
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'بدنه درخواست باید یک آبجکت JSON معتبر باشد.',
      statusCode: 400
    });
  }

  if (hasPrototypePollution(item)) {
    return res.status(400).json({
      error: 'SECURITY_VIOLATION',
      message: 'فیلدهای غیرمجاز شناسایی شدند.',
      statusCode: 400
    });
  }

  if (
    typeof item.id !== 'string' || item.id.trim() === '' ||
    typeof item.title !== 'string' || item.title.trim() === '' ||
    typeof item.type !== 'string' || item.type.trim() === ''
  ) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'فیلدهای شناسه، نوع و عنوان الزامی بوده و باید رشته معتبر باشند.',
      statusCode: 400
    });
  }

  if (!['cost_center', 'goods_item', 'course_type'].includes(item.type)) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'نوع تعریف نامعتبر است. انواع مجاز: cost_center, goods_item, course_type',
      statusCode: 400
    });
  }

  next();
};
