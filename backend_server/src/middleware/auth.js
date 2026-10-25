/**
 * Authentication & License Verification Middleware
 * Barati Swimming Academy Cloud Backend
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { licenseRepo } from '../db/repositories/licenseRepo.js';

/**
 * Extract school credentials from Authorization header, custom headers, query, or body
 * @param {import('express').Request} req
 * @returns {{ schoolId: string | undefined, licenseKey: string | undefined }}
 */
export function extractSchoolCredentials(req) {
  let schoolId = req.headers['x-school-id'] || req.query?.schoolId || req.body?.schoolId;
  let licenseKey = req.headers['x-license-key'] || req.query?.licenseKey || req.body?.licenseKey || req.body?.apiKey;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.includes(':')) {
      const parts = token.split(':');
      schoolId = schoolId || parts[0];
      licenseKey = parts[1];
    } else {
      licenseKey = licenseKey || token;
    }
  }

  return { schoolId, licenseKey };
}

/**
 * School License Verification Middleware
 * Enforces:
 * 1. Valid schoolId and licenseKey (HTTP 401 on missing or invalid)
 * 2. Remote Deactivation & Expiration (AC-6: HTTP 403 Forbidden)
 * 3. Device tracking & Device limit enforcement (maxDevices: HTTP 403 Forbidden)
 */
export const verifySchoolLicense = (req, res, next) => {
  const { schoolId, licenseKey } = extractSchoolCredentials(req);

  // Missing credentials check (null or undefined)
  if ((schoolId === undefined || schoolId === null) && (licenseKey === undefined || licenseKey === null)) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'شناسه مدرسه و کلید لایسنس الزامی است.',
      statusCode: 401
    });
  }

  // Strict type validation: reject non-string inputs (number, boolean, object, array) with HTTP 400
  if (
    (schoolId !== undefined && schoolId !== null && typeof schoolId !== 'string') ||
    (licenseKey !== undefined && licenseKey !== null && typeof licenseKey !== 'string')
  ) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'شناسه مدرسه و کلید لایسنس باید رشته متنی معتبر باشند.',
      statusCode: 400
    });
  }

  // Missing or whitespace-only credentials check
  if (!schoolId || !licenseKey || typeof schoolId !== 'string' || typeof licenseKey !== 'string' || !schoolId.trim() || !licenseKey.trim()) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'شناسه مدرسه و کلید لایسنس الزامی است.',
      statusCode: 401
    });
  }

  const cleanSchoolId = schoolId.trim();
  const cleanLicenseKey = licenseKey.trim();

  const validation = licenseRepo.validateSchoolLicense(cleanSchoolId, cleanLicenseKey);

  if (!validation.valid) {
    // Remote deactivation or expiration enforcement (AC-6) ONLY for valid keys
    if (validation.code === 'LICENSE_DEACTIVATED' || validation.code === 'LICENSE_EXPIRED') {
      return res.status(403).json({
        error: 'LICENSE_FORBIDDEN',
        message: 'لایسنس غیرفعال یا منقضی شده است',
        statusCode: 403
      });
    }

    // Invalid credentials (unknown schoolId or incorrect key) -> uniform HTTP 401
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'شناسه مدرسه یا کلید فعال‌سازی نامعتبر است.',
      statusCode: 401
    });
  }

  const license = validation.license;

  // Double check license status field and expiration date
  const expDate = new Date(license.expiryDate);
  if (license.status === 'deactivated' || license.status === 'expired' || (!isNaN(expDate.getTime()) && expDate < new Date())) {
    return res.status(403).json({
      error: 'LICENSE_FORBIDDEN',
      message: 'لایسنس غیرفعال یا منقضی شده است',
      statusCode: 403
    });
  }

  // Defensively validate deviceInfo
  const rawDeviceInfo = req.body?.deviceInfo || (req.headers['x-device-id'] ? {
    deviceId: req.headers['x-device-id'],
    deviceModel: req.headers['x-device-model'] || 'Unknown',
    appVersion: req.headers['x-app-version'] || '1.0.0'
  } : null);

  const deviceInfo = (rawDeviceInfo && typeof rawDeviceInfo === 'object' && typeof rawDeviceInfo.deviceId === 'string' && rawDeviceInfo.deviceId.trim())
    ? rawDeviceInfo
    : null;

  if (deviceInfo && deviceInfo.deviceId) {
    const regResult = licenseRepo.registerDevice(cleanSchoolId, deviceInfo);
    if (!regResult.success && regResult.reason === 'MAX_DEVICES_EXCEEDED') {
      return res.status(403).json({
        error: 'LICENSE_FORBIDDEN',
        reason: 'MAX_DEVICES_EXCEEDED',
        message: 'تعداد دستگاه‌های مجاز برای این لایسنس به پایان رسیده است.',
        maxDevices: license.maxDevices,
        statusCode: 403
      });
    }
  }

  // Attach verified context to request object
  req.school = license;
  req.schoolId = cleanSchoolId;
  req.deviceInfo = deviceInfo;

  next();
};

export const requireSchoolAuth = verifySchoolLicense;

/**
 * Admin Session / JWT Authentication Middleware
 */
export const requireAdminAuth = (req, res, next) => {
  const sessionToken = req.cookies?.[config.sessionCookieName] ||
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7).trim() : null);

  if (!sessionToken) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'لطفاً وارد سیستم شوید.',
      statusCode: 401
    });
  }

  try {
    const decoded = jwt.verify(sessionToken, config.jwtSecret);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'نشست کاربری نامعتبر یا منقضی شده است.',
      statusCode: 401
    });
  }
};
