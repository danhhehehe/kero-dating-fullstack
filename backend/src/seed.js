import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";

const APP_ENV = process.env.NODE_ENV || "development";
const DEFAULT_DEV_MONGODB_URI = "mongodb://127.0.0.1:27017/kero_dating";
const datingDemoUsersPath = new URL("./generated/datingDemoUsers.json", import.meta.url);
const ALLOW_PRODUCTION_SEED = process.env.ALLOW_PRODUCTION_SEED === "true";

if (APP_ENV === "production" && !ALLOW_PRODUCTION_SEED) {
  console.error("Refusing to run seed in production. Set ALLOW_PRODUCTION_SEED=true only for an intentional reset.");
  process.exit(1);
}

function getMongoUri() {
  const value = process.env.MONGODB_URI?.trim();
  if (value) return value;

  if (APP_ENV === "development") {
    console.warn(
      `Missing required environment variable: MONGODB_URI. Falling back to ${DEFAULT_DEV_MONGODB_URI}. Please check backend/.env`
    );
    return DEFAULT_DEV_MONGODB_URI;
  }

  console.error("Missing required environment variable: MONGODB_URI. Please check backend/.env");
  process.exit(1);
}

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, select: false },
  role: { type: String, default: "user" },
  status: { type: String, enum: ["active", "pending", "banned", "disabled"], default: "active" },
  passwordResetToken: { type: String, default: null, select: false },
  passwordResetExpires: { type: Date, default: null, select: false },
  privacy: {
    showExactDistance: { type: Boolean, default: false },
    showOnlineStatus: { type: Boolean, default: true },
    allowProfileDiscovery: { type: Boolean, default: true }
  }
}, { timestamps: true });

const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  nickname: String,
  birthday: Date,
  gender: String,
  lookingFor: [String],
  city: String,
  approximateLocation: String,
  bio: String,
  datingGoal: String,
  theme: String,
  interests: [String],
  photos: [String],
  isVerified: Boolean,
  completed: Boolean,
  visibility: String
}, { timestamps: true });

const interestSchema = new mongoose.Schema({ name: { type: String, unique: true }, icon: String, isActive: { type: Boolean, default: true } });
const likeSchema = new mongoose.Schema({ fromUser: mongoose.Schema.Types.ObjectId, toUser: mongoose.Schema.Types.ObjectId, action: String }, { timestamps: true });
const matchSchema = new mongoose.Schema({ users: [mongoose.Schema.Types.ObjectId], matchKey: String, status: String, lastMessageAt: Date }, { timestamps: true });
const messageSchema = new mongoose.Schema({
  match: mongoose.Schema.Types.ObjectId,
  sender: mongoose.Schema.Types.ObjectId,
  type: { type: String, default: "text" },
  text: String,
  content: String,
  readBy: [mongoose.Schema.Types.ObjectId],
  isRead: { type: Boolean, default: false }
}, { timestamps: true });
const reportSchema = new mongoose.Schema({ reporter: mongoose.Schema.Types.ObjectId, reportedUser: mongoose.Schema.Types.ObjectId, reason: String, status: String }, { timestamps: true });
const blockSchema = new mongoose.Schema({ blocker: mongoose.Schema.Types.ObjectId, blockedUser: mongoose.Schema.Types.ObjectId }, { timestamps: true });

const User = mongoose.model("User", userSchema);
const DatingProfile = mongoose.model("DatingProfile", profileSchema);
const Interest = mongoose.model("Interest", interestSchema);
const Like = mongoose.model("Like", likeSchema);
const Match = mongoose.model("Match", matchSchema);
const Message = mongoose.model("Message", messageSchema);
const Report = mongoose.model("Report", reportSchema);
const Block = mongoose.model("Block", blockSchema);

function loadDatingDemoUsers() {
  try {
    return JSON.parse(readFileSync(datingDemoUsersPath, "utf8"));
  } catch {
    return [];
  }
}

function matchKeyFor(a, b) {
  return [a.toString(), b.toString()].sort().join(":");
}

async function makeUser(name, email, password, role = "user") {
  return User.create({
    name,
    email: String(email).toLowerCase(),
    passwordHash: await bcrypt.hash(password, 12),
    role,
    status: "active"
  });
}

function getRequiredSeedEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required seed environment variable: ${name}. Check backend/.env.`);
  }
  return value;
}

function demoEmailFor(index) {
  const prefix = process.env.DEMO_USERS_PREFIX?.trim() || "q";
  const domain = getRequiredSeedEnv("DEMO_USERS_DOMAIN");
  return `${prefix}${String(index + 1).padStart(2, "0")}@${domain}`.toLowerCase();
}

function birthdayForDemo(index) {
  const age = 20 + (index % 9);
  const year = new Date().getFullYear() - age;
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 27) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function createDatingDemoUsers() {
  if (process.env.DEMO_USERS_ENABLED === "false") return [];

  const demoUsers = loadDatingDemoUsers()
    .filter(item => Array.isArray(item.photos) && item.photos.length === 3);

  const genders = ["female", "male", "other"];
  const cities = ["TP.HCM", "Ha Noi", "Da Nang", "Can Tho"];
  const goals = ["Tim ban moi", "Hen ho nghiem tuc", "Tro chuyen"];
  const interestPool = ["Ca phe", "Am nhac", "Du lich", "Phim anh", "The thao", "Thiet ke"];
  const createdUsers = [];

  for (let index = 0; index < demoUsers.length; index += 1) {
    const item = demoUsers[index];
    const name = String(item.name || "").trim();
    const email = demoEmailFor(index);
    const password = getRequiredSeedEnv("DEMO_DEFAULT_PASSWORD");
    if (!name || !email || !password) continue;

    const user = await makeUser(name, email, password);
    createdUsers.push(user);

    await DatingProfile.create({
      user: user._id,
      nickname: name,
      birthday: birthdayForDemo(index),
      gender: genders[index % genders.length],
      lookingFor: ["male", "female", "other"],
      city: cities[index % cities.length],
      approximateLocation: "private",
      bio: "Minh thich tro chuyen, ca phe va nhung buoi di dao nhe nhang.",
      datingGoal: goals[index % goals.length],
      theme: "kero",
      interests: [
        interestPool[index % interestPool.length],
        interestPool[(index + 2) % interestPool.length],
        interestPool[(index + 4) % interestPool.length]
      ],
      photos: item.photos,
      isVerified: index % 2 === 0,
      completed: true,
      visibility: "public"
    });
  }

  return createdUsers;
}

async function createAdmin(adminPhotos) {
  const adminEmail = getRequiredSeedEnv("ADMIN_EMAIL").toLowerCase();
  const adminPassword = getRequiredSeedEnv("ADMIN_PASSWORD");
  const admin = await makeUser("Kero Admin", adminEmail, adminPassword, "admin");
  await DatingProfile.create({
    user: admin._id,
    nickname: "Kero Admin",
    birthday: "1999-01-01",
    gender: "other",
    lookingFor: ["male", "female", "other"],
    city: "TP.HCM",
    approximateLocation: "private",
    bio: "Tai khoan quan tri he thong Kero Dating.",
    datingGoal: "not_sure",
    theme: "kero",
    interests: ["Code", "Thiet ke UI"],
    photos: adminPhotos.slice(0, 3),
    isVerified: true,
    completed: true,
    visibility: "private"
  });
  return admin;
}

async function createQDemoInteractions(users) {
  if (users.length < 3) return;

  const [firstUser, secondUser, thirdUser] = users;
  await Like.insertMany([
    { fromUser: secondUser._id, toUser: firstUser._id, action: "like" },
    { fromUser: firstUser._id, toUser: secondUser._id, action: "like" },
    { fromUser: thirdUser._id, toUser: firstUser._id, action: "like" }
  ]);

  const firstMatch = await Match.create({
    users: [firstUser._id, secondUser._id],
    matchKey: matchKeyFor(firstUser._id, secondUser._id),
    status: "active"
  });

  const messages = await Message.insertMany([
    {
      match: firstMatch._id,
      sender: secondUser._id,
      type: "text",
      text: "Chao ban, minh dang test chat Kero.",
      content: "Chao ban, minh dang test chat Kero.",
      readBy: [secondUser._id]
    },
    {
      match: firstMatch._id,
      sender: firstUser._id,
      type: "text",
      text: "Ok, demo chat van hoat dong tot.",
      content: "Ok, demo chat van hoat dong tot.",
      readBy: [firstUser._id]
    }
  ]);

  firstMatch.lastMessageAt = messages.at(-1).createdAt;
  await firstMatch.save();
}

async function seed() {
  await mongoose.connect(getMongoUri());
  await Promise.all([
    User.deleteMany(), DatingProfile.deleteMany(), Interest.deleteMany(),
    Like.deleteMany(), Match.deleteMany(), Message.deleteMany(), Report.deleteMany(), Block.deleteMany()
  ]);

  await Interest.insertMany([
    ["Ca phe", "coffee"], ["Du lich", "plane"], ["Am nhac", "music"], ["Phim anh", "film"],
    ["Badminton", "racket"], ["Code", "laptop"], ["Thiet ke UI", "palette"], ["An uong", "bowl"],
    ["Gym", "dumbbell"], ["Sach", "book"], ["Nhiep anh", "camera"], ["The thao", "activity"]
  ].map(([name, icon]) => ({ name, icon, isActive: true })));

  const qUsers = await createDatingDemoUsers();
  const firstQProfile = qUsers.length ? await DatingProfile.findOne({ user: qUsers[0]._id }).select("photos") : null;
  const adminPhotos = firstQProfile?.photos?.length >= 3 ? firstQProfile.photos : [];

  await createAdmin(adminPhotos);
  await createQDemoInteractions(qUsers);

  const allowedEmails = [getRequiredSeedEnv("ADMIN_EMAIL").toLowerCase(), ...qUsers.map(user => user.email)];
  await User.updateMany(
    { email: { $nin: allowedEmails }, role: { $ne: "admin" } },
    { $set: { status: "disabled" } }
  );

  console.log("Seed completed");
  console.log("Admin account is configured from environment variables.");
  if (qUsers.length) console.log(`Dating demo users created: ${qUsers.length}`);
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
