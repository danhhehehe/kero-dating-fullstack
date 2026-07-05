import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import validator from "validator";
import crypto from "crypto";
import nodemailer from "nodemailer";

const app = express();
const PORT = process.env.PORT || 5000;
const COOKIE_NAME = process.env.COOKIE_NAME || "kero_token";
const APP_ENV = process.env.NODE_ENV || "development";
const DEFAULT_DEV_MONGODB_URI = "mongodb://127.0.0.1:27017/kero_dating";
const PROFILE_THEMES = ["kero", "purple", "minimal", "dark"];
const DISABLED_ACCOUNT_MESSAGE = "Tài khoản này đã bị vô hiệu hóa.";
const DISABLED_DEMO_EMAILS = new Set((process.env.DISABLED_DEMO_EMAILS || "")
  .split(",")
  .map(item => item.trim().toLowerCase())
  .filter(Boolean));
const ALLOWED_PHOTO_DATA_PREFIXES = ["data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"];
const MAX_PHOTO_STRING_LENGTH = 2_500_000;

function getRequiredEnv(name, { fallbackInDevelopment } = {}) {
  const value = process.env[name]?.trim();
  if (value) return value;

  if (APP_ENV === "development" && fallbackInDevelopment) {
    console.warn(
      `Missing required environment variable: ${name}. Falling back to ${fallbackInDevelopment}. Please check backend/.env`
    );
    return fallbackInDevelopment;
  }

  console.error(`Missing required environment variable: ${name}. Please check backend/.env`);
  process.exit(1);
}

const MONGODB_URI = getRequiredEnv("MONGODB_URI", { fallbackInDevelopment: DEFAULT_DEV_MONGODB_URI });
const JWT_SECRET = getRequiredEnv("JWT_SECRET");
const CLIENT_URL = getRequiredEnv("CLIENT_URL");
const DEFAULT_CLIENT_ORIGIN = "https://danhhehehe.github.io";

if (APP_ENV === "production" && JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters in production.");
  process.exit(1);
}

function numericEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function envList(name) {
  return (process.env[name] || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

const allowedOrigins = new Set([
  DEFAULT_CLIENT_ORIGIN,
  ...envList("CLIENT_URL"),
  ...envList("RESET_PASSWORD_URL"),
  ...envList("FRONTEND_URL"),
  ...envList("ALLOWED_ORIGINS")
].map(normalizeOrigin));

const corsOptions = {
  credentials: true,
  origin(origin, cb) {
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  }
};

function sanitizeMongoPayload(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    value.forEach(sanitizeMongoPayload);
    return value;
  }

  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete value[key];
      continue;
    }
    sanitizeMongoPayload(value[key]);
  }
  return value;
}

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json({ limit: process.env.JSON_LIMIT || "18mb" }));
app.use(express.urlencoded({ extended: false, limit: process.env.FORM_LIMIT || "1mb" }));
app.use((req, res, next) => {
  sanitizeMongoPayload(req.body);
  next();
});
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: numericEnv("AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  max: numericEnv("AUTH_RATE_LIMIT_MAX", 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "TOO_MANY_REQUESTS", message: "Thao tác đăng nhập/đăng ký quá nhiều. Vui lòng thử lại sau." }
});

const actionLimiter = rateLimit({
  windowMs: numericEnv("ACTION_RATE_LIMIT_WINDOW_MS", 60 * 1000),
  max: numericEnv("ACTION_RATE_LIMIT_MAX", 80),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Bạn thao tác quá nhanh. Vui lòng chậm lại." }
});

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function calculateAge(birthday) {
  const birth = new Date(birthday);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function matchKeyFor(a, b) {
  return [a.toString(), b.toString()].sort().join(":");
}

function sanitizeInterestList(input, max = 12) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const raw of input) {
    const value = String(raw || "").trim().replace(/\s+/g, " ").slice(0, 30);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    cleaned.push(value);
    if (cleaned.length >= max) break;
  }
  return cleaned;
}

function sanitizeDatingGoal(input) {
  const value = String(input || "").trim().replace(/\s+/g, " ");
  return value || "not_sure";
}

function isSafePhotoValue(value) {
  if (!value || value.length > MAX_PHOTO_STRING_LENGTH) return false;
  if (value.startsWith("https://")) return validator.isURL(value, { protocols: ["https"], require_protocol: true });
  return ALLOWED_PHOTO_DATA_PREFIXES.some(prefix => value.startsWith(prefix));
}

function sanitizePhotos(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const raw of input) {
    const value = String(raw || "").trim();
    if (!isSafePhotoValue(value) || seen.has(value)) continue;
    seen.add(value);
    cleaned.push(value);
    if (cleaned.length >= 10) break;
  }
  return cleaned;
}

function sanitizeTheme(input) {
  const value = String(input || "kero").trim().toLowerCase();
  return PROFILE_THEMES.includes(value) ? value : "kero";
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    role: user.role,
    status: user.status,
    privacy: user.privacy,
    createdAt: user.createdAt
  };
}

function publicProfile(profile, viewerProfile = null) {
  const sharedInterests = viewerProfile
    ? profile.interests.filter(i => viewerProfile.interests.includes(i))
    : [];
  const score = Math.min(
    60 + Math.min(sharedInterests.length * 12, 36) + (profile.datingGoal === viewerProfile?.datingGoal ? 18 : 0) + (profile.isVerified ? 8 : 0),
    98
  );

  return {
    profileId: profile._id,
    userId: profile.user,
    nickname: profile.nickname,
    age: calculateAge(profile.birthday),
    gender: profile.gender,
    city: profile.city || "Ẩn vị trí",
    bio: profile.bio,
    datingGoal: profile.datingGoal,
    theme: sanitizeTheme(profile.theme),
    interests: profile.interests,
    sharedInterests,
    photos: profile.photos,
    photoCount: profile.photos?.length || 0,
    isVerified: profile.isVerified,
    compatibilityScore: score
  };
}

function cookieOptions() {
  const isProduction = APP_ENV === "production";
  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: process.env.COOKIE_SECURE === "true" || isProduction,
    path: "/"
  };
}

function setCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, status: user.status },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}


function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function resetPasswordUrl(token) {
  const configuredUrl = process.env.RESET_PASSWORD_URL || (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim();
  const baseUrl = configuredUrl.replace(/\/+$/, "");
  const resetBaseUrl = baseUrl.endsWith("/reset-password") ? baseUrl : `${baseUrl}/reset-password`;
  return `${resetBaseUrl}/${encodeURIComponent(token)}`;
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_APP_PASSWORD?.trim());
}

function smtpUser() {
  return process.env.SMTP_USER?.trim();
}

function smtpPassword() {
  return process.env.SMTP_APP_PASSWORD?.replace(/\s+/g, "");
}

function mailFrom() {
  const configuredFrom = process.env.MAIL_FROM?.trim();
  if (configuredFrom && !configuredFrom.includes("example.com")) return configuredFrom;
  return `Kero Security <${smtpUser()}>`;
}

function shouldExposeResetLink() {
  return APP_ENV === "development" && process.env.DEBUG_RESET_LINK === "true";
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!smtpConfigured()) {
    if (APP_ENV === "development") {
      console.warn("SMTP is not configured. Password reset email was not sent.");
    } else {
      console.error("SMTP is not configured. Password reset email was not sent.");
    }
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    connectionTimeout: numericEnv("SMTP_CONNECTION_TIMEOUT_MS", 10_000),
    greetingTimeout: numericEnv("SMTP_GREETING_TIMEOUT_MS", 10_000),
    socketTimeout: numericEnv("SMTP_SOCKET_TIMEOUT_MS", 15_000),
    auth: {
      user: smtpUser(),
      pass: smtpPassword()
    }
  });

  await transporter.sendMail({
    from: mailFrom(),
    to,
    subject: "Kero Dating - Đặt lại mật khẩu",
    text: `Bạn vừa yêu cầu đặt lại mật khẩu Kero Dating. Link có hiệu lực 15 phút: ${resetUrl}\n\nNếu không phải bạn, hãy bỏ qua email này.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#21172d">
        <h2>Kero Security</h2>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu Kero Dating.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#ff2f6d;color:#fff;text-decoration:none;font-weight:700">Đặt lại mật khẩu</a></p>
        <p>Link có hiệu lực trong 15 phút. Nếu không phải bạn, hãy bỏ qua email này.</p>
      </div>
    `
  });

  return { sent: true };
}

async function sendViolationWarningEmail({ to, name, reason, violationCount, banned }) {
  if (!smtpConfigured()) {
    console.warn("SMTP is not configured. Violation warning email was not sent.");
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    connectionTimeout: numericEnv("SMTP_CONNECTION_TIMEOUT_MS", 10_000),
    greetingTimeout: numericEnv("SMTP_GREETING_TIMEOUT_MS", 10_000),
    socketTimeout: numericEnv("SMTP_SOCKET_TIMEOUT_MS", 15_000),
    auth: {
      user: smtpUser(),
      pass: smtpPassword()
    }
  });

  const subject = banned ? "Kero Dating - Tai khoan da bi khoa" : "Kero Dating - Canh cao vi pham";
  const actionText = banned
    ? "Tai khoan cua ban da bi khoa vinh vien vi da co 3 lan vi pham duoc xac nhan."
    : `Day la canh cao vi pham lan ${violationCount}/3. Neu tai pham du 3 lan, tai khoan se bi khoa vinh vien.`;

  await transporter.sendMail({
    from: mailFrom(),
    to,
    subject,
    text: `Xin chao ${name || "ban"},\n\nKero Security da xac nhan mot bao cao vi pham lien quan den tai khoan cua ban.\nLy do: ${reason}\n${actionText}\n\nHay ton trong nguoi dung khac va tuan thu quy tac an toan cua Kero Dating.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#21172d">
        <h2>Kero Security</h2>
        <p>Xin chao ${name || "ban"},</p>
        <p>Kero Security da xac nhan mot bao cao vi pham lien quan den tai khoan cua ban.</p>
        <p><strong>Ly do:</strong> ${reason}</p>
        <p>${actionText}</p>
        <p>Hay ton trong nguoi dung khac va tuan thu quy tac an toan cua Kero Dating.</p>
      </div>
    `
  });

  return { sent: true };
}

/* ===================== MODELS ===================== */

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  status: { type: String, enum: ["active", "pending", "banned", "disabled"], default: "active" },
  privacy: {
    showExactDistance: { type: Boolean, default: false },
    showOnlineStatus: { type: Boolean, default: true },
    allowProfileDiscovery: { type: Boolean, default: true }
  },
  loginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, default: null, select: false },
  passwordResetToken: { type: String, default: null, select: false },
  passwordResetExpires: { type: Date, default: null, select: false },
  passwordChangedAt: { type: Date, default: null }
}, { timestamps: true });

userSchema.methods.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};
userSchema.methods.comparePassword = function(password) {
  return bcrypt.compare(password, this.passwordHash);
};
userSchema.virtual("isLocked").get(function() {
  return this.lockUntil && this.lockUntil > Date.now();
});

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, required: true, index: true },
  nickname: { type: String, required: true, trim: true, maxlength: 40 },
  birthday: { type: Date, required: true },
  gender: { type: String, enum: ["male", "female", "other"], required: true },
  lookingFor: { type: [String], enum: ["male", "female", "other"], default: ["male", "female", "other"] },
  city: { type: String, default: "Không công khai", maxlength: 80 },
  // Không lưu/trả tọa độ chính xác trong bản public.
  approximateLocation: { type: String, default: "private" },
  bio: { type: String, default: "", maxlength: 280 },
  datingGoal: { type: String, default: "not_sure", maxlength: 80 },
  theme: { type: String, enum: PROFILE_THEMES, default: "kero" },
  interests: { type: [String], default: [] },
  photos: {
    type: [String],
    default: [],
    validate: {
      validator(value) { return value.length <= 10; },
      message: "Tối đa 10 ảnh cho mỗi hồ sơ."
    }
  },
  isVerified: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  visibility: { type: String, enum: ["public", "paused", "private"], default: "private" }
}, { timestamps: true });

const likeSchema = new mongoose.Schema({
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  action: { type: String, enum: ["like", "pass"], required: true }
}, { timestamps: true });
likeSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

const matchSchema = new mongoose.Schema({
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  matchKey: { type: String, unique: true, required: true },
  status: { type: String, enum: ["active", "unmatched"], default: "active" },
  unmatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  lastMessageAt: Date
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["text", "audio"], default: "text" },
  text: { type: String, trim: true, maxlength: 1200, default: "" },
  content: { type: String, trim: true, maxlength: 1200, default: "" },
  audioData: { type: String, default: "", maxlength: 4_500_000 },
  audioMime: { type: String, default: "", maxlength: 80 },
  audioDuration: { type: Number, default: 0, min: 0, max: 60 },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

const REPORT_REASONS = [
  "fake_profile",
  "inappropriate_content",
  "harassment_abuse",
  "scam_spam",
  "sensitive_content",
  "threat_danger",
  "underage",
  "other",
  "harassment",
  "spam",
  "inappropriate_photo",
  "privacy_risk"
];

const reportSchema = new mongoose.Schema({
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  match: { type: mongoose.Schema.Types.ObjectId, ref: "Match", default: null },
  source: { type: String, enum: ["profile", "chat", "discover", "matches", "other"], default: "profile" },
  reason: { type: String, enum: REPORT_REASONS, required: true },
  description: { type: String, default: "", maxlength: 500 },
  status: { type: String, enum: ["pending", "reviewing", "resolved", "dismissed"], default: "pending" },
  adminNote: { type: String, default: "", maxlength: 1000 },
  violationActionApplied: { type: Boolean, default: false },
  violationCountAtAction: { type: Number, default: 0 },
  actionTaken: { type: String, enum: ["none", "warning", "banned"], default: "none" },
  actionTakenAt: { type: Date, default: null }
}, { timestamps: true });

const blockSchema = new mongoose.Schema({
  blocker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  blockedUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }
}, { timestamps: true });
blockSchema.index({ blocker: 1, blockedUser: 1 }, { unique: true });

const interestSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
  icon: { type: String, default: "sparkles" },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const DatingProfile = mongoose.model("DatingProfile", profileSchema);
const Like = mongoose.model("Like", likeSchema);
const Match = mongoose.model("Match", matchSchema);
const Message = mongoose.model("Message", messageSchema);
const Report = mongoose.model("Report", reportSchema);
const Block = mongoose.model("Block", blockSchema);
const Interest = mongoose.model("Interest", interestSchema);

/* ===================== MIDDLEWARE ===================== */

async function protect(req, res, next) {
  try {
    let token = req.cookies?.[COOKIE_NAME];
    if (!token && req.headers.authorization?.startsWith("Bearer ")) token = req.headers.authorization.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Bạn cần đăng nhập." });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Tài khoản không tồn tại." });
    if (user.status === "disabled") return res.status(403).json({ message: DISABLED_ACCOUNT_MESSAGE });
    if (user.status === "banned") return res.status(403).json({ message: "Tài khoản đã bị khóa." });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ message: "Bạn không có quyền admin." });
  next();
}

/* ===================== AUTH ===================== */

app.post("/api/auth/register", authLimiter, asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim().replace(/\s+/g, " ");
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const birthday = req.body.birthday;
  const gender = ["male", "female", "other"].includes(req.body.gender) ? req.body.gender : "other";

  if (!name || !email || !password || !birthday) return res.status(400).json({ message: "Vui lòng nhập đủ thông tin." });
  if (name.length > 60) return res.status(400).json({ message: "Tên tối đa 60 ký tự." });
  if (!validator.isEmail(email)) return res.status(400).json({ message: "Email không hợp lệ." });
  if (password.length < 8) return res.status(400).json({ message: "Mật khẩu phải có ít nhất 8 ký tự." });

  const age = calculateAge(birthday);
  if (age === null) return res.status(400).json({ message: "Ngày sinh không hợp lệ." });
  if (age < 18) return res.status(400).json({ message: "Ứng dụng chỉ dành cho người từ 18 tuổi trở lên." });

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: "Email đã tồn tại." });

  const user = new User({ name, email });
  await user.setPassword(password);
  await user.save();

  await DatingProfile.create({
    user: user._id,
    nickname: name,
    birthday,
    gender,
    lookingFor: ["male", "female", "other"],
    theme: "kero",
    completed: false,
    visibility: "private"
  });

  setCookie(res, signToken(user));
  res.status(201).json({ user: safeUser(user), profileCompleted: false });
}));

app.post("/api/auth/login", authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (DISABLED_DEMO_EMAILS.has(normalizedEmail)) return res.status(403).json({ message: DISABLED_ACCOUNT_MESSAGE });

  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash +loginAttempts +lockUntil");
  if (!user) return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Email hoặc mật khẩu không đúng." });
  if (user.status === "disabled") return res.status(403).json({ message: DISABLED_ACCOUNT_MESSAGE });
  if (user.isLocked) return res.status(423).json({ message: "Tài khoản bị khóa tạm 15 phút do nhập sai nhiều lần." });

  const ok = await user.comparePassword(password || "");
  if (!ok) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.loginAttempts = 0;
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await user.save();
    return res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Email hoặc mật khẩu không đúng." });
  }

  if (user.status === "disabled") return res.status(403).json({ message: DISABLED_ACCOUNT_MESSAGE });
  if (user.status === "banned") return res.status(403).json({ message: "Tài khoản đã bị khóa." });
  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  const profile = await DatingProfile.findOne({ user: user._id });
  setCookie(res, signToken(user));
  res.json({ user: safeUser(user), profileCompleted: Boolean(profile?.completed) });
}));

app.post("/api/auth/logout", protect, (req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Đã đăng xuất." });
});

app.get("/api/auth/me", protect, asyncHandler(async (req, res) => {
  const profile = await DatingProfile.findOne({ user: req.user._id });
  res.json({ user: safeUser(req.user), profileCompleted: Boolean(profile?.completed) });
}));


app.post("/api/auth/forgot-password", authLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const genericMessage = "Nếu email tồn tại trong hệ thống, Kero đã gửi hướng dẫn đặt lại mật khẩu.";
  if (!validator.isEmail(email)) return res.status(200).json({ message: genericMessage });

  const user = await User.findOne({ email }).select("+passwordResetToken +passwordResetExpires");
  if (!user || user.status === "banned" || user.status === "disabled") return res.status(200).json({ message: genericMessage });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const resetUrl = resetPasswordUrl(rawToken);
  user.passwordResetToken = hashResetToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  res.json({
    message: genericMessage,
    ...(shouldExposeResetLink() ? { resetUrl } : {})
  });

  sendPasswordResetEmail({ to: user.email, resetUrl }).catch(err => {
    console.error("Password reset email failed:", err.message);
  });
}));

app.post("/api/auth/reset-password/:token", authLimiter, asyncHandler(async (req, res) => {
  const tokenHash = hashResetToken(String(req.params.token || ""));
  const password = String(req.body.password || "");
  if (password.length < 8) return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 8 ký tự." });

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() }
  }).select("+passwordHash +passwordResetToken +passwordResetExpires +loginAttempts +lockUntil");

  if (!user) return res.status(400).json({ code: "RESET_LINK_INVALID", message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn." });
  await user.setPassword(password);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.loginAttempts = 0;
  user.lockUntil = null;
  user.passwordChangedAt = new Date();
  await user.save();

  res.json({ code: "PASSWORD_RESET_SUCCESS", message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại." });
}));

/* ===================== PROFILE ===================== */

app.get("/api/profiles/interests", protect, asyncHandler(async (req, res) => {
  const interests = await Interest.find({ isActive: true }).sort({ name: 1 });
  res.json({ interests });
}));

app.get("/api/profiles/me", protect, asyncHandler(async (req, res) => {
  const profile = await DatingProfile.findOne({ user: req.user._id });
  res.json({ profile });
}));

app.put("/api/profiles/me", protect, asyncHandler(async (req, res) => {
  const body = req.body;
  if (body.birthday && calculateAge(body.birthday) < 18) return res.status(400).json({ message: "Bạn phải từ 18 tuổi trở lên." });
  if (Array.isArray(body.photos) && body.photos.length > 10) return res.status(400).json({ message: "Tối đa 10 ảnh." });
  if (Array.isArray(body.interests) && body.interests.length > 12) return res.status(400).json({ message: "Tối đa 12 sở thích." });
  if (Array.isArray(body.interests) && body.interests.some(item => String(item || "").trim().replace(/\s+/g, " ").length > 30)) {
    return res.status(400).json({ message: "Mỗi sở thích tối đa 30 ký tự." });
  }

  const photos = sanitizePhotos(body.photos);
  if (Array.isArray(body.photos) && photos.length !== body.photos.filter(Boolean).length) {
    return res.status(400).json({ message: "Ảnh hồ sơ chỉ nhận URL https hoặc data:image jpeg/png/webp hợp lệ, mỗi ảnh tối đa khoảng 2.5MB." });
  }

  const interests = sanitizeInterestList(body.interests, 12);
  const datingGoal = sanitizeDatingGoal(body.datingGoal);
  const theme = sanitizeTheme(body.theme);
  const completed = Boolean(body.nickname && body.birthday && body.gender && photos.length >= 3 && photos.length <= 10 && body.bio && body.bio.trim().length >= 10);

  if (photos.length > 10) return res.status(400).json({ message: "Tối đa 10 ảnh." });
  if (body.visibility === "public" && photos.length < 3) return res.status(400).json({ message: "Hồ sơ công khai cần tối thiểu 3 ảnh." });
  if (String(body.bio || "").trim().length > 280) return res.status(400).json({ message: "Bio tối đa 280 ký tự." });

  if (datingGoal.length > 80) return res.status(400).json({ message: "Mục tiêu tối đa 80 ký tự." });

  const profile = await DatingProfile.findOneAndUpdate(
    { user: req.user._id },
    {
      nickname: body.nickname,
      birthday: body.birthday,
      gender: body.gender,
      lookingFor: body.lookingFor,
      city: body.city,
      bio: body.bio,
      datingGoal,
      theme,
      interests,
      photos,
      completed,
      visibility: completed ? (body.visibility || "public") : "private"
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  res.json({ message: "Đã lưu hồ sơ.", profile });
}));

/* ===================== DISCOVER / LIKE / MATCH ===================== */

async function excludedUserIds(userId) {
  const [likes, blocks] = await Promise.all([
    Like.find({ fromUser: userId }).select("toUser"),
    Block.find({ $or: [{ blocker: userId }, { blockedUser: userId }] }).select("blocker blockedUser")
  ]);

  const set = new Set([userId.toString()]);
  likes.forEach(item => set.add(item.toUser.toString()));
  blocks.forEach(item => {
    set.add(item.blocker.toString());
    set.add(item.blockedUser.toString());
  });
  return [...set].map(id => new mongoose.Types.ObjectId(id));
}

async function activeRegularUserIds(ids) {
  const uniqueIds = [...new Set(ids.map(id => id.toString()))];
  if (!uniqueIds.length) return [];
  const users = await User.find({
    _id: { $in: uniqueIds.map(id => new mongoose.Types.ObjectId(id)) },
    role: "user",
    status: "active"
  }).select("_id");
  return users.map(user => user._id);
}

async function findActiveRegularUser(userId) {
  if (!userId) return null;
  return User.findOne({ _id: userId, role: "user", status: "active" }).select("_id role status");
}

async function ensureVisibleMatch(match, viewerId) {
  if (!match) return null;
  const otherId = match.users.find(id => id.toString() !== viewerId.toString());
  const otherUser = await findActiveRegularUser(otherId);
  return otherUser ? { match, otherId } : null;
}

app.get("/api/discover", protect, asyncHandler(async (req, res) => {
  const me = await DatingProfile.findOne({ user: req.user._id });
  if (!me || !me.completed) return res.status(400).json({ message: "Bạn cần hoàn tất hồ sơ trước." });

  const exclude = await excludedUserIds(req.user._id);
  const activeUsers = await User.find({
    _id: { $nin: exclude },
    role: "user",
    status: "active"
  }).select("_id");
  const candidates = await DatingProfile.find({
    user: { $in: activeUsers.map(user => user._id) },
    completed: true,
    visibility: "public",
    gender: { $in: me.lookingFor },
    lookingFor: { $in: [me.gender] }
  }).limit(80);

  const profiles = candidates
    .map(p => publicProfile(p, me))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, 30);

  res.json({ profiles });
}));

app.post("/api/discover/action", protect, actionLimiter, asyncHandler(async (req, res) => {
  let { targetUserId, action } = req.body;
  if (!targetUserId) return res.status(400).json({ code: "MISSING_TARGET_USER_ID", message: "Thiếu targetUserId." });
  if (!["like", "pass"].includes(action)) return res.status(400).json({ message: "Action không hợp lệ." });
  if (!mongoose.isValidObjectId(targetUserId)) return res.status(400).json({ message: "targetUserId không hợp lệ." });

  let target = await DatingProfile.findOne({ user: targetUserId, completed: true, visibility: "public" });
  if (!target) {
    target = await DatingProfile.findOne({ _id: targetUserId, completed: true, visibility: "public" });
    if (target) targetUserId = target.user.toString();
  }
  if (!target) return res.status(404).json({ code: "PUBLIC_PROFILE_NOT_FOUND", message: "Không tìm thấy hồ sơ công khai của người này." });

  targetUserId = target.user.toString();
  if (targetUserId === req.user._id.toString()) return res.status(400).json({ message: "Không thể tự like." });
  const targetUser = await findActiveRegularUser(targetUserId);
  if (!targetUser) return res.status(404).json({ code: "PUBLIC_PROFILE_NOT_FOUND", message: "Không tìm thấy hồ sơ công khai của người này." });

  const blocked = await Block.findOne({
    $or: [
      { blocker: req.user._id, blockedUser: targetUserId },
      { blocker: targetUserId, blockedUser: req.user._id }
    ]
  });
  if (blocked) return res.status(403).json({ message: "Hồ sơ này đã bị ẩn vì lý do an toàn." });

  const existingSwipe = await Like.findOne({ fromUser: req.user._id, toUser: targetUserId });
  if (existingSwipe) {
    return res.status(409).json({ message: "Bạn đã xử lý hồ sơ này. Hãy dùng Trở lại nếu muốn đổi lượt vừa quẹt." });
  }

  let swipe;
  try {
    swipe = await Like.create({ fromUser: req.user._id, toUser: targetUserId, action });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Bạn đã xử lý hồ sơ này. Hãy dùng Trở lại nếu muốn đổi lượt vừa quẹt." });
    }
    throw err;
  }

  let matched = false;
  let match = null;
  if (action === "like") {
    const reverse = await Like.findOne({ fromUser: targetUserId, toUser: req.user._id, action: "like" });
    if (reverse) {
      matched = true;
      const key = matchKeyFor(req.user._id, targetUserId);
      match = await Match.findOneAndUpdate(
        { matchKey: key },
        { users: [req.user._id, targetUserId], matchKey: key, status: "active" },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  res.json({ action, swipeId: swipe._id, matched, matchId: match?._id || null });
}));

app.post("/api/swipes/undo", protect, actionLimiter, asyncHandler(async (req, res) => {
  const me = await DatingProfile.findOne({ user: req.user._id });
  if (!me || !me.completed) return res.status(400).json({ message: "Ban can hoan tat ho so truoc." });

  const lastSwipe = await Like.findOne({ fromUser: req.user._id }).sort({ updatedAt: -1 });
  if (!lastSwipe) return res.status(404).json({ message: "Khong co luot quet nao de tro lai." });

  const match = await Match.findOne({
    matchKey: matchKeyFor(req.user._id, lastSwipe.toUser),
    status: "active"
  });

  if (match) {
    return res.status(409).json({
      message: "Luot nay da tao ket noi, hay vao Match de huy ket noi neu muon."
    });
  }

  const targetUser = await findActiveRegularUser(lastSwipe.toUser);
  const targetProfile = targetUser ? await DatingProfile.findOne({ user: lastSwipe.toUser, completed: true, visibility: "public" }) : null;
  await Like.deleteOne({ _id: lastSwipe._id });

  res.json({
    undone: true,
    action: lastSwipe.action,
    restoredProfile: targetProfile ? publicProfile(targetProfile, me) : null
  });
}));


app.get("/api/swipes", protect, asyncHandler(async (req, res) => {
  const me = await DatingProfile.findOne({ user: req.user._id });
  if (!me || !me.completed) return res.status(400).json({ message: "Bạn cần hoàn tất hồ sơ trước." });

  const blocks = await Block.find({ $or: [{ blocker: req.user._id }, { blockedUser: req.user._id }] }).select("blocker blockedUser");
  const blockedIds = new Set();
  blocks.forEach(item => {
    blockedIds.add(item.blocker.toString());
    blockedIds.add(item.blockedUser.toString());
  });
  blockedIds.delete(req.user._id.toString());

  const outgoing = await Like.find({ fromUser: req.user._id }).sort({ updatedAt: -1 }).limit(200);
  const outgoingIds = outgoing.map(item => item.toUser).filter(id => !blockedIds.has(id.toString()));

  const incoming = await Like.find({
    toUser: req.user._id,
    action: "like",
    fromUser: { $nin: [...blockedIds].map(id => new mongoose.Types.ObjectId(id)) }
  }).sort({ updatedAt: -1 }).limit(100);

  const allOtherIds = [...new Set([...outgoingIds.map(id => id.toString()), ...incoming.map(i => i.fromUser.toString())])];
  const activeOtherIds = await activeRegularUserIds(allOtherIds);
  const profiles = await DatingProfile.find({
    user: { $in: activeOtherIds },
    completed: true,
    visibility: "public"
  });
  const profileMap = new Map(profiles.map(profile => [profile.user.toString(), publicProfile(profile, me)]));

  const matches = await Match.find({ users: req.user._id, status: "active" }).select("_id users matchKey status createdAt");
  const matchMap = new Map();
  matches.forEach(match => {
    const other = match.users.find(id => id.toString() !== req.user._id.toString());
    if (other) matchMap.set(other.toString(), match._id);
  });

  const reverseMap = new Map(incoming.map(item => [item.fromUser.toString(), item.action]));

  const history = outgoing.map(item => {
    const otherId = item.toUser.toString();
    return {
      swipeId: item._id,
      toUserId: otherId,
      actionTargetId: otherId,
      action: item.action,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      reciprocalAction: reverseMap.get(otherId) || null,
      matched: matchMap.has(otherId),
      matchId: matchMap.get(otherId) || null,
      profile: profileMap.get(otherId) || null
    };
  }).filter(item => item.profile);

  const outgoingSet = new Set(outgoing.map(item => item.toUser.toString()));
  const incomingLikes = incoming
    .filter(item => {
      const otherId = item.fromUser.toString();
      return !outgoingSet.has(otherId) && !matchMap.has(otherId);
    })
    .map(item => {
      const otherId = item.fromUser.toString();
      return {
        swipeId: item._id,
        fromUserId: otherId,
        actionTargetId: otherId,
        action: item.action,
        createdAt: item.createdAt,
        matched: matchMap.has(otherId),
        matchId: matchMap.get(otherId) || null,
        alreadyResponded: outgoingSet.has(otherId),
        profile: profileMap.get(otherId) || null
      };
    })
    .filter(item => item.profile);

  res.json({ history, incomingLikes });
}));

/* ===================== MATCH / CHAT ===================== */

app.get("/api/matches", protect, asyncHandler(async (req, res) => {
  const matches = await Match.find({ users: req.user._id, status: "active" }).sort({ updatedAt: -1 });
  const result = [];
  for (const match of matches) {
    const otherId = match.users.find(id => id.toString() !== req.user._id.toString());
    const otherUser = await findActiveRegularUser(otherId);
    if (!otherUser) continue;
    const [profile, lastMessage, unreadCount] = await Promise.all([
      DatingProfile.findOne({ user: otherId, completed: true, visibility: "public" }),
      Message.findOne({ match: match._id }).sort({ createdAt: -1 }),
      Message.countDocuments({
        match: match._id,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      })
    ]);
    if (profile) result.push({
      matchId: match._id,
      profile: publicProfile(profile),
      lastMessage: lastMessage ? {
        _id: lastMessage._id,
        sender: lastMessage.sender,
        type: lastMessage.type,
        text: lastMessage.text,
        content: lastMessage.content,
        createdAt: lastMessage.createdAt,
        updatedAt: lastMessage.updatedAt
      } : null,
      lastMessageAt: match.lastMessageAt || lastMessage?.createdAt,
      unreadCount
    });
  }
  res.json({ matches: result });
}));

app.get("/api/matches/:matchId", protect, asyncHandler(async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, users: req.user._id, status: "active" });
  if (!match) return res.status(404).json({ message: "Không tìm thấy match." });
  const visibleMatch = await ensureVisibleMatch(match, req.user._id);
  if (!visibleMatch) return res.status(404).json({ message: "Không tìm thấy match." });
  const otherId = match.users.find(id => id.toString() !== req.user._id.toString());
  const [profile, me] = await Promise.all([
    DatingProfile.findOne({ user: otherId, completed: true, visibility: "public" }),
    DatingProfile.findOne({ user: req.user._id })
  ]);
  res.json({
    match: { matchId: match._id, lastMessageAt: match.lastMessageAt, createdAt: match.createdAt },
    profile: profile ? publicProfile(profile, me) : null
  });
}));

app.get("/api/matches/:matchId/messages", protect, asyncHandler(async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, users: req.user._id, status: "active" });
  if (!match) return res.status(404).json({ message: "Không tìm thấy match." });
  const visibleMatch = await ensureVisibleMatch(match, req.user._id);
  if (!visibleMatch) return res.status(404).json({ message: "Không tìm thấy match." });
  const otherId = match.users.find(id => id.toString() !== req.user._id.toString());
  const [messages, profile, me] = await Promise.all([
    Message.find({ match: match._id }).sort({ createdAt: 1 }).limit(100),
    DatingProfile.findOne({ user: otherId, completed: true, visibility: "public" }),
    DatingProfile.findOne({ user: req.user._id })
  ]);
  res.json({ messages, profile: profile ? publicProfile(profile, me) : null });
}));

app.post("/api/matches/:matchId/read", protect, asyncHandler(async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, users: req.user._id, status: "active" });
  if (!match) return res.status(404).json({ message: "Không tìm thấy match." });
  const visibleMatch = await ensureVisibleMatch(match, req.user._id);
  if (!visibleMatch) return res.status(404).json({ message: "Không tìm thấy match." });
  const result = await Message.updateMany(
    {
      match: match._id,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id }
    },
    {
      $addToSet: { readBy: req.user._id },
      $set: { isRead: true }
    }
  );
  res.json({ message: "Đã đánh dấu đã đọc.", modifiedCount: result.modifiedCount || 0 });
}));

app.post("/api/messages/:matchId/read", protect, asyncHandler(async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, users: req.user._id, status: "active" });
  if (!match) return res.status(404).json({ message: "Không tìm thấy match." });
  const visibleMatch = await ensureVisibleMatch(match, req.user._id);
  if (!visibleMatch) return res.status(404).json({ message: "Không tìm thấy match." });
  const result = await Message.updateMany(
    {
      match: match._id,
      sender: { $ne: req.user._id },
      readBy: { $ne: req.user._id }
    },
    {
      $addToSet: { readBy: req.user._id },
      $set: { isRead: true }
    }
  );
  res.json({ message: "Đã đánh dấu đã đọc.", modifiedCount: result.modifiedCount || 0 });
}));

app.post("/api/matches/:matchId/messages", protect, actionLimiter, asyncHandler(async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, users: req.user._id, status: "active" });
  if (!match) return res.status(404).json({ message: "Không tìm thấy match." });
  const visibleMatch = await ensureVisibleMatch(match, req.user._id);
  if (!visibleMatch) return res.status(403).json({ message: DISABLED_ACCOUNT_MESSAGE });

  const type = req.body.type === "audio" ? "audio" : "text";
  const text = String(req.body.text || req.body.content || "").trim();
  const audioData = String(req.body.audioData || "").trim();
  const audioMime = String(req.body.audioMime || "").trim();
  const audioDuration = Number(req.body.audioDuration || 0);

  if (!text && type !== "audio") return res.status(400).json({ message: "Tin nhắn không được để trống." });
  if (type === "audio") {
    if (!audioData.startsWith("data:audio/")) return res.status(400).json({ message: "Voice không hợp lệ." });
    if (audioData.length > 4_500_000 || audioDuration > 60) return res.status(400).json({ message: "Voice quá dài, vui lòng ghi ngắn hơn." });
  }

  const message = await Message.create({
    match: match._id,
    sender: req.user._id,
    type,
    text,
    content: text,
    audioData: type === "audio" ? audioData : "",
    audioMime: type === "audio" ? audioMime.slice(0, 80) : "",
    audioDuration: type === "audio" ? Math.max(0, Math.min(60, Math.floor(audioDuration || 0))) : 0,
    readBy: [req.user._id]
  });
  match.lastMessageAt = new Date();
  await match.save();
  res.status(201).json({ message });
}));

app.patch("/api/matches/:matchId/unmatch", protect, asyncHandler(async (req, res) => {
  const match = await Match.findOne({ _id: req.params.matchId, users: req.user._id, status: "active" });
  if (!match) return res.status(404).json({ message: "Không tìm thấy match." });
  match.status = "unmatched";
  match.unmatchedBy = req.user._id;
  await match.save();
  res.json({ message: "Đã hủy match." });
}));

/* ===================== SAFETY ===================== */

app.post("/api/safety/block", protect, actionLimiter, asyncHandler(async (req, res) => {
  const { blockedUserId } = req.body;
  if (!blockedUserId || blockedUserId === req.user._id.toString()) return res.status(400).json({ message: "Người dùng block không hợp lệ." });

  await Block.findOneAndUpdate(
    { blocker: req.user._id, blockedUser: blockedUserId },
    {},
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Match.updateMany({ users: { $all: [req.user._id, blockedUserId] }, status: "active" }, { status: "unmatched", unmatchedBy: req.user._id });
  res.json({ message: "Đã block và ẩn hai bên khỏi nhau." });
}));

app.post("/api/safety/report", protect, actionLimiter, asyncHandler(async (req, res) => {
  const targetUserId = String(req.body.targetUserId || req.body.reportedUserId || "");
  const reason = String(req.body.reason || "");
  const description = String(req.body.description || "").trim();
  const source = String(req.body.source || "profile");
  const matchId = req.body.matchId ? String(req.body.matchId) : "";

  if (!mongoose.isValidObjectId(targetUserId) || targetUserId === req.user._id.toString()) return res.status(400).json({ message: "Người bị báo cáo không hợp lệ." });
  if (!REPORT_REASONS.includes(reason)) return res.status(400).json({ message: "Lý do báo cáo không hợp lệ." });
  if (description.length > 500) return res.status(400).json({ message: "Mô tả báo cáo tối đa 500 ký tự." });
  if (!["profile", "chat", "discover", "matches", "other"].includes(source)) return res.status(400).json({ message: "Nguồn báo cáo không hợp lệ." });

  const targetExists = await User.exists({ _id: targetUserId });
  if (!targetExists) return res.status(400).json({ message: "Người bị báo cáo không hợp lệ." });

  let reportMatchId = null;
  if (source === "chat" && matchId) {
    if (!mongoose.isValidObjectId(matchId)) return res.status(400).json({ message: "Match không hợp lệ." });
    const match = await Match.findOne({ _id: matchId, users: { $all: [req.user._id, targetUserId] }, status: "active" });
    if (!match) return res.status(400).json({ message: "Match không hợp lệ." });
    reportMatchId = match._id;
  }

  const report = await Report.create({ reporter: req.user._id, reportedUser: targetUserId, match: reportMatchId, source, reason, description });
  res.status(201).json({ message: "Đã gửi báo cáo.", report });
}));

/* ===================== ADMIN KERO ===================== */

async function dailyCounts(Model, startDate) {
  const rows = await Model.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  return Object.fromEntries(rows.map(r => [r._id, r.count]));
}

app.get("/api/admin/dashboard", protect, requireAdmin, asyncHandler(async (req, res) => {
  const start = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const [users, profiles, activeMatches, reports, pendingReports, bannedUsers, verifiedProfiles, privateProfiles, genderRows, profileDaily, matchDaily, reportDaily] = await Promise.all([
    User.countDocuments(),
    DatingProfile.countDocuments(),
    Match.countDocuments({ status: "active" }),
    Report.countDocuments(),
    Report.countDocuments({ status: "pending" }),
    User.countDocuments({ status: "banned" }),
    DatingProfile.countDocuments({ isVerified: true }),
    DatingProfile.countDocuments({ visibility: { $in: ["private", "paused"] } }),
    DatingProfile.aggregate([
      { $match: { completed: true } },
      { $group: { _id: "$gender", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    dailyCounts(DatingProfile, start),
    dailyCounts(Match, start),
    dailyCounts(Report, start)
  ]);

  const days = Array.from({ length: 7 }, (_, index) => {
    const d = startOfDay(new Date(start.getTime() + index * 24 * 60 * 60 * 1000));
    return d.toISOString().slice(0, 10);
  });

  const labelMap = { male: "Nam", female: "Nữ", other: "Khác" };
  const genderDistribution = ["male", "female", "other"].map(key => ({
    gender: key,
    label: labelMap[key],
    count: genderRows.find(r => r._id === key)?.count || 0
  }));

  const activityTrend = days.map(day => ({
    day: day.slice(5),
    profiles: profileDaily[day] || 0,
    matches: matchDaily[day] || 0,
    reports: reportDaily[day] || 0
  }));

  const securityScore = Math.max(0, Math.min(100, 100 - pendingReports * 4 - bannedUsers * 2 + Math.min(verifiedProfiles, 20)));

  res.json({
    stats: { users, profiles, activeMatches, reports, pendingReports, bannedUsers, verifiedProfiles, privateProfiles, securityScore },
    genderDistribution,
    activityTrend
  });
}));

app.get("/api/admin/users", protect, requireAdmin, asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(100);
  res.json({ users: users.map(u => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt })) });
}));

app.patch("/api/admin/users/:userId/status", protect, requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["active", "pending", "banned", "disabled"].includes(status)) return res.status(400).json({ message: "Trạng thái không hợp lệ." });
  const user = await User.findByIdAndUpdate(req.params.userId, { status }, { new: true });
  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, status: user.status } });
}));

app.delete("/api/admin/users/:userId", protect, requireAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ message: "User id khong hop le." });
  if (userId === req.user._id.toString()) return res.status(400).json({ message: "Khong the xoa tai khoan admin dang dang nhap." });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: "Khong tim thay nguoi dung." });

  const matches = await Match.find({ users: user._id }).select("_id");
  const matchIds = matches.map(match => match._id);

  await Promise.all([
    Message.deleteMany({ match: { $in: matchIds } }),
    Match.deleteMany({ _id: { $in: matchIds } }),
    Like.deleteMany({ $or: [{ fromUser: user._id }, { toUser: user._id }] }),
    Block.deleteMany({ $or: [{ blocker: user._id }, { blockedUser: user._id }] }),
    Report.deleteMany({ $or: [{ reporter: user._id }, { reportedUser: user._id }] }),
    DatingProfile.deleteOne({ user: user._id }),
    User.deleteOne({ _id: user._id })
  ]);

  res.json({ message: "Da xoa nguoi dung va du lieu lien quan.", deletedUserId: user._id });
}));

app.get("/api/admin/reports", protect, requireAdmin, asyncHandler(async (req, res) => {
  const reports = await Report.find()
    .populate("reporter", "name email status")
    .populate("reportedUser", "name email status")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const reportedIds = [...new Set(reports.map(report => report.reportedUser?._id?.toString()).filter(Boolean))];
  const confirmedRows = reportedIds.length
    ? await Report.aggregate([
      {
        $match: {
          reportedUser: { $in: reportedIds.map(id => new mongoose.Types.ObjectId(id)) },
          status: "resolved"
        }
      },
      { $group: { _id: "$reportedUser", count: { $sum: 1 } } }
    ])
    : [];
  const confirmedMap = new Map(confirmedRows.map(row => [row._id.toString(), row.count]));

  res.json({
    reports: reports.map(report => ({
      ...report,
      confirmedViolationCount: confirmedMap.get(report.reportedUser?._id?.toString()) || 0
    }))
  });
}));

app.patch("/api/admin/reports/:reportId", protect, requireAdmin, asyncHandler(async (req, res) => {
  const status = String(req.body.status || "");
  if (!["pending", "reviewing", "resolved", "dismissed"].includes(status)) return res.status(400).json({ message: "Trang thai bao cao khong hop le." });

  const report = await Report.findById(req.params.reportId);
  if (!report) return res.status(404).json({ message: "Khong tim thay bao cao." });

  report.status = status;
  report.adminNote = String(req.body.adminNote || "").trim().slice(0, 1000);

  let reportedUser = null;
  if (status === "resolved" && !report.violationActionApplied) {
    const previousConfirmedCount = await Report.countDocuments({
      _id: { $ne: report._id },
      reportedUser: report.reportedUser,
      status: "resolved"
    });
    const violationCount = previousConfirmedCount + 1;
    const shouldBan = violationCount >= 3;

    reportedUser = await User.findById(report.reportedUser);
    if (reportedUser && shouldBan) {
      reportedUser.status = "banned";
      await reportedUser.save({ validateBeforeSave: false });
      await Match.updateMany({ users: reportedUser._id, status: "active" }, { status: "unmatched", unmatchedBy: req.user._id });
    }

    report.violationActionApplied = true;
    report.violationCountAtAction = violationCount;
    report.actionTaken = shouldBan ? "banned" : "warning";
    report.actionTakenAt = new Date();

    if (reportedUser?.email) {
      sendViolationWarningEmail({
        to: reportedUser.email,
        name: reportedUser.name,
        reason: report.reason,
        violationCount,
        banned: shouldBan
      }).catch(err => console.error("Violation warning email failed:", err.message));
    }
  }

  await report.save();
  const populatedReport = await Report.findById(report._id)
    .populate("reporter", "name email status")
    .populate("reportedUser", "name email status");
  res.json({ report: populatedReport });
}));

app.get("/api/admin/interests", protect, requireAdmin, asyncHandler(async (req, res) => {
  const interests = await Interest.find().sort({ name: 1 });
  res.json({ interests });
}));

app.post("/api/admin/interests", protect, requireAdmin, asyncHandler(async (req, res) => {
  const interest = await Interest.create({ name: req.body.name, icon: req.body.icon || "sparkles" });
  res.status(201).json({ interest });
}));

app.patch("/api/admin/interests/:id", protect, requireAdmin, asyncHandler(async (req, res) => {
  const interest = await Interest.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ interest });
}));

app.get("/health", (req, res) => res.json({ ok: true, app: "Kero Dating API" }));
app.get("/api/health", (req, res) => res.json({ ok: true, app: "Kero Dating API" }));

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.originalUrl}` }));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.statusCode || 500).json({ message: err.message || "Server error" });
});

mongoose.connect(MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`🚀 Kero Dating API: http://localhost:${PORT}`)))
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });
