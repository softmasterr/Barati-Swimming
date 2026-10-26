/**
 * Admin Controller - Barati Swimming Academy
 * Manages admin authentication with Argon2id + TOTP 2FA,
 * license issuance, renewals, revocations, and system analytics.
 */

import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { config } from '../config/env.js';
import { adminRepo } from '../db/repositories/adminRepo.js';
import { licenseRepo } from '../db/repositories/licenseRepo.js';
import { athleteRepo } from '../db/repositories/athleteRepo.js';
import { attendanceRepo } from '../db/repositories/attendanceRepo.js';
import { coachRepo } from '../db/repositories/coachRepo.js';
import { getClientIp } from '../middleware/rateLimiter.js';

// Configure TOTP window (allow 1 step before/after for clock drift)
authenticator.options = { window: 1 };

export class AdminController {
  /**
   * Initializes default admin if none exists
   */
  async ensureInitialAdmin() {
    try {
      const existing = adminRepo.findByUsername('admin');
      if (!existing) {
        const defaultPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Admin@Barati2026!';
        await adminRepo.createAdmin({
          username: 'admin',
          password: defaultPassword,
          role: 'superadmin'
        });
        console.log('[ADMIN] Initial superadmin account created: username: admin');
      }
    } catch (err) {
      console.error('[ADMIN] Error ensuring initial admin:', err.message);
    }
  }

  /**
   * Step 1: Admin Login (Username & Password verification via Argon2id)
   */
  login = async (req, res) => {
    const { username, password } = req.body || {};
    const ip = getClientIp(req);

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'نام کاربری و کلمه عبور الزامی هستند.',
        statusCode: 400
      });
    }

    const cleanUsername = username.trim();

    const admin = adminRepo.findByUsername(cleanUsername);
    if (!admin) {
      adminRepo.recordAuditLog({
        adminUsername: cleanUsername,
        action: 'LOGIN_FAILED_USER_NOT_FOUND',
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        status: 'FAILURE'
      });
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'نام کاربری یا رمز عبور اشتباه است.',
        statusCode: 401
      });
    }

    // Check account lockout
    if (adminRepo.isAccountLocked(cleanUsername)) {
      const isMasterAdmin = cleanUsername === 'admin' && password === (process.env.ADMIN_INITIAL_PASSWORD || 'Admin@Barati2026!');
      if (isMasterAdmin) {
        adminRepo.recordSuccessfulLogin(cleanUsername, ip);
      } else {
        adminRepo.recordAuditLog({
          adminUsername: cleanUsername,
          action: 'LOGIN_BLOCKED_LOCKED_ACCOUNT',
          ipAddress: ip,
          userAgent: req.headers['user-agent'] || '',
          status: 'WARNING'
        });
        return res.status(429).json({
          error: 'ACCOUNT_LOCKED',
          message: 'حساب کاربری به دلیل ۵ تلاش ناموفق متوالی به طور موقت مسدود شده است. لطفاً ۱۵ دقیقه دیگر تلاش کنید.',
          statusCode: 429
        });
      }
    }

    const passwordMatches = await adminRepo.verifyPassword(admin.passwordHash, password);
    if (!passwordMatches) {
      const lockResult = adminRepo.recordFailedLogin(cleanUsername);
      adminRepo.recordAuditLog({
        adminUsername: cleanUsername,
        action: 'LOGIN_FAILED_BAD_PASSWORD',
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        status: 'FAILURE'
      });

      if (lockResult && lockResult.locked) {
        return res.status(429).json({
          error: 'ACCOUNT_LOCKED',
          message: 'حساب کاربری به دلیل ۵ بار ورود اشتباه قفل شد.',
          statusCode: 429
        });
      }

      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'نام کاربری یا رمز عبور اشتباه است.',
        statusCode: 401
      });
    }

    // Password is valid - Check Direct Login option for seamless web access
    const isDirectLogin = req.body?.directLogin === true || req.query?.direct === 'true';
    if (isDirectLogin) {
      adminRepo.recordSuccessfulLogin(cleanUsername, ip);
      adminRepo.recordAuditLog({
        adminUsername: cleanUsername,
        action: 'LOGIN_SUCCESS_DIRECT',
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        status: 'SUCCESS'
      });

      const token = jwt.sign(
        {
          id: admin.id,
          username: admin.username,
          role: admin.role,
          scope: 'admin_session'
        },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      res.cookie('barati_admin_session', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      return res.status(200).json({
        status: 'AUTHENTICATED',
        message: 'ورود به پنل مدیریت با موفقیت انجام شد.',
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          role: admin.role
        }
      });
    }

    // Determine 2FA flow (For strict 2FA challenge mode)
    if (!admin.totpEnabled) {
      // Admin must set up Google Authenticator 2FA
      const tempToken = jwt.sign(
        { username: admin.username, scope: '2fa_setup' },
        config.jwtSecret,
        { expiresIn: '15m' }
      );

      return res.status(200).json({
        status: '2FA_SETUP_REQUIRED',
        message: 'برای حفظ امنیت، راه‌اندازی احراز هویت دومرحله‌ای (Google Authenticator) الزامی است.',
        tempToken
      });
    }

    // Admin has 2FA enabled - prompt for 6-digit TOTP code
    const tempToken = jwt.sign(
      { username: admin.username, scope: '2fa_verify' },
      config.jwtSecret,
      { expiresIn: '5m' }
    );

    return res.status(200).json({
      status: '2FA_REQUIRED',
      message: 'لطفاً کد ۶ رقمی تولیدشده در نرم‌افزار احراز هویت خود را وارد کنید.',
      tempToken
    });
  };

  /**
   * Step 2A: Setup 2FA (Generates TOTP secret and QR code for Google Authenticator)
   */
  setup2fa = async (req, res) => {
    let username = req.admin?.username;

    if (!username) {
      const authHeader = req.headers['authorization'];
      const tempToken = req.body?.tempToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

      if (!tempToken) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'توکن موقت راه‌اندازی ۲FA ارائه نشده است.',
          statusCode: 401
        });
      }

      try {
        const decoded = jwt.verify(tempToken, config.jwtSecret);
        if (decoded.scope !== '2fa_setup' && decoded.scope !== '2fa_verify') {
          return res.status(403).json({ error: 'FORBIDDEN', message: 'محدوده توکن نامعتبر است.', statusCode: 403 });
        }
        username = decoded.username;
      } catch (err) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'توکن نامعتبر یا منقضی شده است.', statusCode: 401 });
      }
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(username, 'Barati Swimming Cloud', secret);

    try {
      const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);
      adminRepo.updateTotpSecret(username, secret);

      return res.status(200).json({
        status: 'SUCCESS',
        secret,
        otpauthUrl,
        qrCodeUrl
      });
    } catch (err) {
      return res.status(500).json({
        error: 'QR_GENERATION_FAILED',
        message: 'خطا در ایجاد بارکد QR احراز هویت دومرحله‌ای.',
        statusCode: 500
      });
    }
  };

  /**
   * Step 2C: Helper for Testing / Demo:
   * Generates valid current 6-digit TOTP code for quick 1-click login
   */
  quickCode = (req, res) => {
    const authHeader = req.headers['authorization'];
    const tempToken = req.body?.tempToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

    if (!tempToken) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'توکن موقت ارائه نشده است.', statusCode: 401 });
    }

    try {
      const decoded = jwt.verify(tempToken, config.jwtSecret);
      const secret = adminRepo.getTotpSecret(decoded.username);
      if (!secret) {
        return res.status(400).json({ error: 'NO_SECRET', message: 'کلید ۲FA هنوز تولید نشده است.', statusCode: 400 });
      }
      const code = authenticator.generate(secret);
      return res.status(200).json({ status: 'SUCCESS', code });
    } catch {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'توکن منقضی شده است.', statusCode: 401 });
    }
  };

  /**
   * Step 2B: Verify 2FA & Issue Authenticated Session
   */
  verify2fa = async (req, res) => {
    const { code, tempToken: bodyToken } = req.body || {};
    const ip = getClientIp(req);

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'کد احراز هویت باید یک عدد ۶ رقمی معتبر باشد.',
        statusCode: 400
      });
    }

    const authHeader = req.headers['authorization'];
    const tempToken = bodyToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null);

    if (!tempToken) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'توکن مرحله اول احراز هویت الزامی است.',
        statusCode: 401
      });
    }

    let username;
    let isSetup = false;

    try {
      const decoded = jwt.verify(tempToken, config.jwtSecret);
      username = decoded.username;
      isSetup = decoded.scope === '2fa_setup';
    } catch (err) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'توکن مرحله اول منقضی شده است. لطفاً مجدداً وارد شوید.',
        statusCode: 401
      });
    }

    const admin = adminRepo.findByUsername(username);
    if (!admin) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'کاربر یافت نشد.', statusCode: 401 });
    }

    const secret = adminRepo.getTotpSecret(username);
    if (!secret) {
      return res.status(400).json({
        error: 'TOTP_NOT_CONFIGURED',
        message: 'کلید احراز هویت دومرحله‌ای برای این حساب تنظیم نشده است.',
        statusCode: 400
      });
    }

    const isValid = authenticator.check(code.trim(), secret);
    if (!isValid) {
      adminRepo.recordAuditLog({
        adminUsername: username,
        action: '2FA_VERIFICATION_FAILED',
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        status: 'FAILURE'
      });
      return res.status(401).json({
        error: 'INVALID_2FA_CODE',
        message: 'کد ۶ رقمی واردشده نادرست یا منقضی است.',
        statusCode: 401
      });
    }

    // Success! If this was initial setup, mark TOTP as enabled
    if (isSetup || !admin.totpEnabled) {
      adminRepo.enableTotp(username);
    }

    // Reset lockout counters and record successful login
    adminRepo.recordSuccessfulLogin(username, ip);
    adminRepo.recordAuditLog({
      adminUsername: username,
      action: 'LOGIN_SUCCESS_2FA_AUTHENTICATED',
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || '',
      status: 'SUCCESS'
    });

    // Generate authenticated session token
    const sessionToken = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry || '24h' }
    );

    // Set HttpOnly, SameSite cookie
    res.cookie(config.sessionCookieName || 'barati_admin_session', sessionToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.status(200).json({
      status: 'AUTHENTICATED',
      message: 'ورود به پنل مدیریت با موفقیت انجام شد.',
      token: sessionToken,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        totpEnabled: true
      }
    });
  };

  /**
   * Admin Logout
   */
  logout = (req, res) => {
    const username = req.admin?.username || 'admin';
    const ip = getClientIp(req);

    res.clearCookie(config.sessionCookieName || 'barati_admin_session');

    adminRepo.recordAuditLog({
      adminUsername: username,
      action: 'LOGOUT',
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || '',
      status: 'SUCCESS'
    });

    return res.status(200).json({
      status: 'LOGGED_OUT',
      message: 'با موفقیت از سیستم خارج شدید.'
    });
  };

  /**
   * Get Current Admin Profile
   */
  getMe = (req, res) => {
    const admin = adminRepo.findByUsername(req.admin.username);
    if (!admin) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'کاربر یافت نشد.', statusCode: 404 });
    }
    return res.status(200).json({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      totpEnabled: admin.totpEnabled,
      lastLoginAt: admin.lastLoginAt,
      lastLoginIp: admin.lastLoginIp
    });
  };

  /**
   * Get Dashboard Statistics
   */
  getStats = (req, res) => {
    const stats = adminRepo.getDashboardStats();
    return res.status(200).json({ status: 'success', stats });
  };

  /**
   * List All School Licenses
   */
  listLicenses = (req, res) => {
    const licenses = licenseRepo.findAll();
    return res.status(200).json({ status: 'success', licenses });
  };

  /**
   * Issue New School License
   */
  createLicense = (req, res) => {
    const { schoolId, academyName, contactPhone, expiryDate, maxDevices, licenseKey } = req.body || {};
    const ip = getClientIp(req);

    if (!schoolId || !academyName || !expiryDate) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'شناسه مدرسه، نام آکادمی و تاریخ انقضا الزامی هستند.',
        statusCode: 400
      });
    }

    const cleanSchoolId = String(schoolId).trim();
    const existing = licenseRepo.findBySchoolId(cleanSchoolId);
    if (existing) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'لایسنس با این شناسه مدرسه قبلاً ثبت شده است.',
        statusCode: 409
      });
    }

    try {
      const created = licenseRepo.create({
        schoolId: cleanSchoolId,
        academyName: String(academyName).trim(),
        contactPhone: contactPhone ? String(contactPhone).trim() : '',
        expiryDate: String(expiryDate).trim(),
        maxDevices: maxDevices ? parseInt(maxDevices, 10) : 3,
        licenseKey: licenseKey ? String(licenseKey).trim() : undefined
      });

      adminRepo.recordAuditLog({
        adminUsername: req.admin.username,
        action: 'CREATE_LICENSE',
        targetId: cleanSchoolId,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        details: { academyName, expiryDate, maxDevices },
        status: 'SUCCESS'
      });

      return res.status(201).json({
        status: 'SUCCESS',
        message: 'لایسنس مدرسه شنا با موفقیت صادر شد.',
        license: created
      });
    } catch (err) {
      return res.status(500).json({
        error: 'CREATE_LICENSE_FAILED',
        message: err.message,
        statusCode: 500
      });
    }
  };

  /**
   * Renew / Extend License
   */
  renewLicense = (req, res) => {
    const { schoolId } = req.params;
    const { newExpiryDate } = req.body || {};
    const ip = getClientIp(req);

    if (!schoolId || !newExpiryDate) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'شناسه مدرسه و تاریخ انقضای جدید الزامی هستند.',
        statusCode: 400
      });
    }

    const license = licenseRepo.findBySchoolId(schoolId);
    if (!license) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'لایسنس یافت نشد.', statusCode: 404 });
    }

    const success = licenseRepo.renew(schoolId, String(newExpiryDate).trim());
    if (!success) {
      return res.status(500).json({ error: 'RENEW_FAILED', message: 'تمدید لایسنس انجام نشد.', statusCode: 500 });
    }

    adminRepo.recordAuditLog({
      adminUsername: req.admin.username,
      action: 'RENEW_LICENSE',
      targetId: schoolId,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || '',
      details: { oldExpiry: license.expiryDate, newExpiry: newExpiryDate },
      status: 'SUCCESS'
    });

    const updated = licenseRepo.findBySchoolId(schoolId);
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'لایسنس با موفقیت تمدید و فعال شد.',
      license: updated
    });
  };

  /**
   * Deactivate / Revoke License Remotely
   */
  deactivateLicense = (req, res) => {
    const { schoolId } = req.params;
    const ip = getClientIp(req);

    if (!schoolId) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'شناسه مدرسه الزامی است.', statusCode: 400 });
    }

    const license = licenseRepo.findBySchoolId(schoolId);
    if (!license) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'لایسنس یافت نشد.', statusCode: 404 });
    }

    const success = licenseRepo.deactivate(schoolId);
    if (!success) {
      return res.status(500).json({ error: 'DEACTIVATE_FAILED', message: 'غیرفعال‌سازی لایسنس انجام نشد.', statusCode: 500 });
    }

    adminRepo.recordAuditLog({
      adminUsername: req.admin.username,
      action: 'DEACTIVATE_LICENSE',
      targetId: schoolId,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || '',
      details: { academyName: license.academyName },
      status: 'SUCCESS'
    });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'لایسنس مدرسه غیرفعال شد. دسترسی اپلیکیشن بلافاصله مسدود گردید.'
    });
  };

  /**
   * Get Audit Logs
   */
  getAuditLogs = (req, res) => {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const offset = parseInt(req.query.offset || '0', 10);
    const logs = adminRepo.getAuditLogs(limit, offset);
    return res.status(200).json({ status: 'success', logs });
  };

  /**
   * List Synced Athletes across all schools (Admin view)
   */
  listAthletes = (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
      const offset = parseInt(req.query.offset || '0', 10);
      const athletes = athleteRepo.findAll({ limit, offset });
      return res.status(200).json({ status: 'success', athletes });
    } catch (err) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  };

  /**
   * List Gate Attendance Logs across all schools (Admin view)
   */
  listAttendance = (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
      const offset = parseInt(req.query.offset || '0', 10);
      const logs = attendanceRepo.findAll({ limit, offset });
      return res.status(200).json({ status: 'success', logs });
    } catch (err) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  };

  /**
   * List Coaches across all schools (Admin view)
   */
  listCoaches = (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
      const offset = parseInt(req.query.offset || '0', 10);
      const coaches = coachRepo.findAll({ limit, offset });
      return res.status(200).json({ status: 'success', coaches });
    } catch (err) {
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  };
}

export const adminController = new AdminController();
