import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import {
  Activity,
  AlertCircle,
  BarChart3,
  BookOpen,
  Camera,
  Eye,
  Flag,
  Heart,
  HeartHandshake,
  ImagePlus,
  LockKeyhole,
  LogIn,
  Menu,
  MessageCircle,
  Mic,
  PieChart,
  Plus,
  RotateCcw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sparkles,
  Square,
  Sticker,
  Tags,
  Trash2,
  UserPlus,
  Users,
  UserX,
  X
} from "lucide-react";
import { LanguageProvider, useLanguage } from "./i18n.jsx";
import IntroSplash from "./components/IntroSplash.jsx";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

const chatReportReasons = [
  ["fake_profile", "Tài khoản giả mạo"],
  ["inappropriate_content", "Nội dung không phù hợp"],
  ["harassment_abuse", "Quấy rối hoặc xúc phạm"],
  ["scam_spam", "Lừa đảo / spam"],
  ["sensitive_content", "Nội dung nhạy cảm"],
  ["threat_danger", "Đe dọa hoặc gây nguy hiểm"],
  ["underage", "Người dùng dưới tuổi quy định"],
  ["other", "Lý do khác"]
];

function formatChatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Vừa xong";
  if (diff < hour) return `${Math.floor(diff / minute)} phút`;
  if (diff < day) return `${Math.floor(diff / hour)} giờ`;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function messageTime(message) {
  return formatChatTime(message?.createdAt || message?.updatedAt);
}
api.interceptors.response.use(r => r, e => {
  const error = new Error(e.response?.data?.message || "Có lỗi xảy ra.");
  error.code = e.response?.data?.code;
  return Promise.reject(error);
});

const AuthContext = createContext(null);
function useAuth() { return useContext(AuthContext); }

const genderLabels = { male: "Nam", female: "Nữ", other: "Khác" };
const goalLabels = { chat: "Trò chuyện", friendship: "Kết bạn", serious: "Nghiêm túc", not_sure: "Chưa rõ" };
const presetGoalKeys = Object.keys(goalLabels);
const fallbackPhoto = "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80";
const emojiSuggestions = ["😀", "😍", "😂", "😊", "🥰", "😘", "❤️", "💕", "🔥", "👍", "👋", "😢", "😡", "🎉", "✨"];
const MAX_RECORDING_SECONDS = 60;
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function displayGoal(goal) {
  return goalLabels[goal] || goal || goalLabels.not_sure;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setProfileCompleted(data.profileCompleted);
    } catch {
      setUser(null);
      setProfileCompleted(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function login(payload) {
    const { data } = await api.post("/auth/login", payload);
    setUser(data.user);
    setProfileCompleted(data.profileCompleted);
    return data;
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);
    setUser(data.user);
    setProfileCompleted(data.profileCompleted);
    return data;
  }

  async function logout() {
    try { await api.post("/auth/logout"); } finally { setUser(null); setProfileCompleted(false); }
  }

  const value = useMemo(() => ({ user, loading, profileCompleted, setProfileCompleted, login, register, logout, refresh }), [user, loading, profileCompleted]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Protected({ completed = false }) {
  const { user, loading, profileCompleted } = useAuth();
  if (loading) return <div className="screen-loader">Đang kiểm tra đăng nhập...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (completed && !profileCompleted) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function AdminOnly() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader">Đang kiểm tra quyền admin...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/discover" replace />;
  return <Outlet />;
}

function Navbar() {
  const { user, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const nav = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  async function out() { await logout(); nav("/"); }
  function openGuide() {
    setMenuOpen(false);
    setGuideOpen(true);
  }
  function openHow() {
    setMenuOpen(false);
    setHowOpen(true);
  }
  function openSafety() {
    setMenuOpen(false);
    setSafetyOpen(true);
  }

  return (
    <header className="nav-shell">
      <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
        <span className="brand-mark"><img src="/logo/logo.png" alt="Kero Dating logo" className="brand-logo" /></span>
        <strong>Kero Dating</strong>
      </Link>
      <button className="nav-menu-btn" type="button" onClick={() => setMenuOpen(open => !open)} aria-label="Mở menu"><Menu size={20} /></button>
      <nav className={menuOpen ? "nav-links open" : "nav-links"}>
        {!user && <>
          <button type="button" onClick={openHow}>{t("nav.howItWorks")}</button>
          <button type="button" onClick={openGuide}>{t("landing.guide")}</button>
          <button type="button" onClick={openSafety}>{t("nav.safety")}</button>
        </>}
        {user && <>
          <NavLink to="/discover">{t("nav.discover")}</NavLink>
          <NavLink to="/swipes">{t("nav.swipes")}</NavLink>
          <NavLink to="/matches">{t("nav.matches")}</NavLink>
          <NavLink to="/profile">{t("nav.profile")}</NavLink>
          {user.role === "admin" && <NavLink to="/admin">Kero Security</NavLink>}
        </>}
      </nav>
      <div className={menuOpen ? "nav-actions open" : "nav-actions"}>
        <button className="lang-toggle" type="button" onClick={toggleLanguage}>{language === "vi" ? "EN" : "VI"}</button>
        {!user ? <>
          <Link className="ghost-btn" to="/login">{t("nav.login")}</Link>
          <Link className="primary-btn" to="/register"><Sparkles size={16} /> {t("nav.createAccount")}</Link>
        </> : <>
          <span className="user-pill">{user.name}</span>
          <button className="ghost-btn" onClick={out}>{t("nav.logout")}</button>
        </>}
      </div>
      <HowItWorksModal open={howOpen} onClose={() => setHowOpen(false)} />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} />
    </header>
  );
}

function Home() {
  const [howOpen, setHowOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <main className="landing landing-first">
      <section className="welcome-hero" id="top">
        <div className="welcome-bg-card one" />
        <div className="welcome-bg-card two" />
        <div className="welcome-copy">
          <span className="eyebrow"><Sparkles size={17} /> Kero Dating</span>
          <h1>{t("landing.title")}</h1>
          <p>{t("landing.subtitle")}</p>
          <div className="hero-actions welcome-actions">
            <Link to="/register" className="primary-btn big-cta">{t("nav.createAccount")}</Link>
            <Link to="/login" className="ghost-btn big-cta">{t("nav.login")}</Link>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={16}/> Ẩn email & ngày sinh gốc</span>
            <span><HeartHandshake size={16}/> Match hai chiều mới mở chat</span>
            <span><Flag size={16}/> Có report/block</span>
          </div>
        </div>
      </section>

      <section className="guide-entry" id="how-it-works">
        <button className="ghost-btn big-cta" onClick={() => setHowOpen(true)}><Sparkles size={18}/> {t("nav.howItWorks")}</button>
        <button className="primary-btn big-cta" onClick={() => setGuideOpen(true)}><ShieldCheck size={18}/> {t("landing.guide")}</button>
      </section>
      <section className="security-landing" id="security">
        <div>
          <span className="eyebrow"><ShieldCheck size={17}/> Kero Security</span>
          <h2>Nguyên tắc an toàn khi hẹn hò</h2>
          <p>Kero chỉ hiển thị thông tin công khai cần thiết và khuyến khích bạn làm quen chậm, giữ quyền riêng tư, báo cáo hoặc chặn khi thấy bất thường.</p>
        </div>
        <button className="primary-btn" type="button" onClick={() => setSafetyOpen(true)}><BookOpen size={17}/> Xem nguyên tắc an toàn Kero</button>
      </section>
      <HowItWorksModal open={howOpen} onClose={() => setHowOpen(false)} />
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <SafetyModal open={safetyOpen} onClose={() => setSafetyOpen(false)} />
    </main>
  );
}

function HowItWorksModal({ open, onClose }) {
  const steps = [
    ["01", <UserPlus />, "Tạo hồ sơ công khai", "Hoàn tất nickname, thành phố, bio, mục tiêu, sở thích và 3-10 ảnh. Email, ngày sinh gốc và vị trí chính xác không hiển thị công khai."],
    ["02", <Eye />, "Xem trước khi chọn", "Bấm vào card để xem chi tiết hồ sơ trước khi Like hoặc Bỏ qua. Nút Like/Pass xử lý ngay lượt quẹt."],
    ["03", <HeartHandshake />, "Match hai chiều", "Khi cả hai cùng thích nhau, Kero tạo kết nối và mở chat riêng cho hai người."],
    ["04", <ShieldCheck />, "Giữ quyền kiểm soát", "Bạn có thể Trở lại lượt quẹt gần nhất nếu chưa match, hoặc block, report, unmatch khi cần."]
  ];

  return <AnimatePresence>{open && <motion.div className="match-overlay fullscreen-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="info-fullscreen-panel" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
      <button className="close-modal" onClick={onClose}><X /></button>
      <span className="eyebrow"><Sparkles size={17}/> Cách hoạt động</span>
      <h2>Kero Dating kết nối như thế nào?</h2>
      <p className="modal-lead">Một luồng đơn giản: hoàn tất hồ sơ, xem người phù hợp, chỉ mở trò chuyện khi cả hai cùng muốn kết nối.</p>
      <div className="how-grid">
        {steps.map(([number, icon, title, body]) => <article key={title}>
          <span>{number}</span>
          {icon}
          <h3>{title}</h3>
          <p>{body}</p>
        </article>)}
      </div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function GuideModal({ open, onClose }) {
  const { t } = useLanguage();
  return <AnimatePresence>{open && <motion.div className="match-overlay fullscreen-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="guide-modal info-fullscreen-panel" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
      <button className="close-modal" onClick={onClose}><X /></button>
      <span className="eyebrow"><ShieldCheck size={17}/> {t("landing.guide")}</span>
      <h2>{t("landing.guideTitle")}</h2>
      <div className="guide-grid">
        <article><Eye/><h3>{t("landing.previewTitle")}</h3><p>{t("landing.previewBody")}</p></article>
        <article><ImagePlus/><h3>{t("landing.photosTitle")}</h3><p>{t("landing.photosBody")}</p></article>
        <article><ShieldCheck/><h3>Kero Security</h3><p>{t("landing.securityBody")}</p></article>
        <article><RotateCcw/><h3>Trở lại khi lỡ quẹt</h3><p>Dùng nút Trở lại để khôi phục lượt quẹt gần nhất nếu lượt đó chưa tạo kết nối.</p></article>
      </div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function SafetyModal({ open, onClose }) {
  const groups = [
    {
      icon: <ShieldAlert />,
      title: "An toàn trực tuyến",
      items: ["Không gửi tiền, mã OTP, mật khẩu hoặc giấy tờ cá nhân cho người mới quen.", "Giữ trò chuyện trong Kero khi mới bắt đầu và cảnh giác lời mời chuyển nền tảng quá nhanh.", "Báo cáo hoặc chặn tài khoản giả, link lạ, lời mời đầu tư, vay tiền hay quà tặng đáng ngờ."]
    },
    {
      icon: <LockKeyhole />,
      title: "Bảo vệ quyền riêng tư",
      items: ["Kero không public email, ngày sinh gốc hoặc vị trí chính xác.", "Hồ sơ công khai chỉ gồm nickname, tuổi, thành phố, bio, ảnh, sở thích và mục tiêu.", "Tránh đưa địa chỉ nhà, lịch trình riêng hoặc thông tin quá nhạy cảm vào bio và ảnh."]
    },
    {
      icon: <Users />,
      title: "Trước khi gặp trực tiếp",
      items: ["Đừng vội gặp; hãy trò chuyện đủ lâu hoặc gọi/video trước.", "Hẹn ở nơi công cộng, báo cho người thân thời gian và địa điểm.", "Tự chủ phương tiện di chuyển và rời đi nếu bạn thấy không thoải mái."]
    },
    {
      icon: <HeartHandshake />,
      title: "Tôn trọng và đồng thuận",
      items: ["Tôn trọng ranh giới cá nhân và không ép người khác gửi ảnh, thông tin riêng hay gặp mặt.", "Mọi tương tác thân mật cần có sự đồng thuận rõ ràng.", "Nếu bị quấy rối, hãy report, block hoặc unmatch ngay."]
    }
  ];

  return <AnimatePresence>{open && <motion.div className="match-overlay fullscreen-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="safety-modal info-fullscreen-panel" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
      <button className="close-modal" onClick={onClose}><X /></button>
      <span className="eyebrow"><ShieldCheck size={17}/> Kero Security</span>
      <h2>Nguyên tắc an toàn khi hẹn hò</h2>
      <p className="modal-lead">Kero giúp bạn kết nối vui hơn khi quyền riêng tư, sự tỉnh táo và sự đồng thuận luôn đi trước.</p>
      <div className="safety-grid">
        {groups.map(group => <article key={group.title}>
          <div className="safety-icon">{group.icon}</div>
          <h3>{group.title}</h3>
          <ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul>
        </article>)}
      </div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) return setError("Vui lòng nhập email và mật khẩu.");
    setLoading(true);
    try {
      const data = await login({ email, password: form.password });
      nav(data.user.role === "admin" ? "/admin" : data.profileCompleted ? "/discover" : "/onboarding");
    } catch (err) { setError(err.code ? t(`errors.${err.code}`) : err.message); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit} noValidate>
    <span className="eyebrow"><LogIn size={17}/> {t("auth.welcomeBack")}</span>
    <h1>{t("auth.login")}</h1>
  
    {error && <div className="alert error">{error}</div>}
    <label>{t("auth.email")}<input type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
    <label>{t("auth.password")}<input type="password" autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
    <button className="primary-btn full" disabled={loading}>{loading ? "Đang đăng nhập..." : t("auth.login")}</button>
    <p className="form-note split-note"><span>{t("auth.noAccount")} <Link to="/register">{t("auth.signup")}</Link></span><Link to="/forgot-password">{t("auth.forgot")}</Link></p>
  </form></main>;
}

function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", birthday: "2003-01-01", gender: "male" });

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setError("");
    const payload = {
      ...form,
      name: form.name.trim().replace(/\s+/g, " "),
      email: form.email.trim().toLowerCase()
    };
    if (!payload.name || !payload.email || !payload.password || !payload.birthday) return setError("Vui lòng nhập đủ thông tin.");
    if (payload.password.length < 8) return setError("Mật khẩu phải có ít nhất 8 ký tự.");
    setLoading(true);
    try { await register(payload); nav("/onboarding"); } catch (err) { setError(err.code ? t(`errors.${err.code}`) : err.message); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit} noValidate>
    <span className="eyebrow"><UserPlus size={17}/> {t("auth.create")}</span>
    <h1>{t("nav.createAccount")}</h1>
    <p>{t("auth.registerNote")}</p>
    {error && <div className="alert error">{error}</div>}
    <label>{t("auth.name")}<input autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>{t("auth.email")}<input type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
    <label>{t("auth.password")}<input type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
    <label>{t("auth.birthday")}<input type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} /></label>
    <label>{t("auth.gender")}<select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="male">Nam</option><option value="female">Nữ</option><option value="other">{t("profile.other")}</option></select></label>
    <button className="primary-btn full" disabled={loading}>{loading ? "Đang tạo tài khoản..." : t("auth.signup")}</button>
    <p className="form-note"><Link to="/login">{t("auth.backToLogin")}</Link></p>
  </form></main>;
}


function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (loading) return;
    setMessage(""); setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setError("Vui lòng nhập email.");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email: cleanEmail });
      setMessage(data.code ? t(`errors.${data.code}`) : data.message || t("forgot.generic"));
    } catch (err) { setError(err.code ? t(`errors.${err.code}`) : err.message); }
    finally { setLoading(false); }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit} noValidate>
    <span className="eyebrow"><LockKeyhole size={17}/> Kero Security</span>
    <h1>{t("forgot.title")}</h1>
    <p>{t("forgot.description")}</p>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    <label>{t("auth.email")}<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <button className="primary-btn full" disabled={loading}>{loading ? "Đang gửi..." : t("forgot.send")}</button>
    <p className="form-note"><Link to="/login">{t("auth.backToLogin")}</Link></p>
  </form></main>;
}

function ResetPassword() {
  const { language, t } = useLanguage();
  const { token } = useParams();
  const nav = useNavigate();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError(""); setMessage("");
    if (form.password.length < 8) return setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
    if (form.password !== form.confirm) return setError(language === "en" ? "Passwords do not match." : "Mật khẩu xác nhận không khớp.");
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setMessage(data.code ? t(`errors.${data.code}`) : data.message || t("forgot.success"));
      setTimeout(() => nav("/login"), 900);
    } catch (err) { setError(err.code ? t(`errors.${err.code}`) : err.message); }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}>
    <span className="eyebrow"><ShieldCheck size={17}/> Reset password</span>
    <h1>{t("forgot.resetTitle")}</h1>
    <p>{t("forgot.resetDescription")}</p>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    <label>{t("forgot.newPassword")}<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
    <label>{t("forgot.confirmPassword")}<input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} /></label>
    <button className="primary-btn full">{t("forgot.changePassword")}</button>
    <p className="form-note"><Link to="/login">{t("auth.backToLogin")}</Link></p>
  </form></main>;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function PublicProfilePreview({ profile, compact = false }) {
  const photos = profile.photos?.length ? profile.photos : [fallbackPhoto];
  return <article className={`${compact ? "profile-preview compact" : "profile-preview"} ${themeClass(profile.theme)}`}>
    <div className="profile-preview-photo"><img src={photos[0]} alt="preview" /></div>
    <div className="profile-preview-body">
      <h2>{profile.nickname || "Nickname"}{profile.age ? `, ${profile.age}` : ""}</h2>
      <p className="muted-line">{profile.city || "Ẩn vị trí"} · {genderLabels[profile.gender] || "Khác"} · {displayGoal(profile.datingGoal)}</p>
      <p>{profile.bio || "Bio của bạn sẽ hiển thị ở đây trước khi đăng công khai."}</p>
      <div className="preview-photo-strip">{photos.slice(0, 5).map((photo, index) => <img key={index} src={photo} alt={`photo-${index}`} />)}</div>
      <div className="chip-row">{(profile.interests || []).slice(0, 10).map(i => <span key={i}>{i}</span>)}</div>
    </div>
  </article>;
}

function themeClass(theme) {
  const map = {
    kero: "theme-kero",
    purple: "theme-purple",
    minimal: "theme-minimal",
    dark: "theme-dark"
  };
  return map[theme] || "theme-kero";
}

function Onboarding() {
  const nav = useNavigate();
  const { setProfileCompleted } = useAuth();
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [interests, setInterests] = useState([]);
  const [customInterest, setCustomInterest] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [form, setForm] = useState({
    nickname: "",
    birthday: "2002-04-16",
    gender: "male",
    lookingFor: ["female"],
    city: "TP.HCM",
    bio: "",
    datingGoal: "serious",
    interests: ["Cà phê", "Code"],
    photos: [],
    theme: "kero",
    visibility: "public"
  });

  useEffect(() => {
    api.get("/profiles/interests").then(r => setInterests(r.data.interests)).catch(() => {});
    api.get("/profiles/me").then(r => {
      if (r.data.profile) setForm(o => ({ ...o, ...r.data.profile, birthday: r.data.profile.birthday?.slice(0, 10) || o.birthday, photos: r.data.profile.photos || [] }));
    }).catch(() => {});
  }, []);

  function toggleLookingFor(value) {
    setForm(o => {
      const next = o.lookingFor.includes(value) ? o.lookingFor.filter(v => v !== value) : [...o.lookingFor, value];
      return { ...o, lookingFor: next.length ? next : [value] };
    });
  }

  function toggleInterest(name) {
    setForm(o => {
      if (o.interests.includes(name)) return { ...o, interests: o.interests.filter(i => i !== name) };
      if (o.interests.length >= 12) {
        setError("Bạn chỉ có thể chọn tối đa 12 sở thích.");
        return o;
      }
      setError("");
      return { ...o, interests: [...o.interests, name] };
    });
  }

  function addCustomInterest() {
    const value = customInterest.trim().replace(/\s+/g, " ");
    if (!value) return;
    if (value.length > 30) return setError("Mỗi sở thích tối đa 30 ký tự.");
    if (form.interests.length >= 12) return setError("Bạn chỉ có thể chọn tối đa 12 sở thích.");
    if (form.interests.some(i => i.toLowerCase() === value.toLowerCase())) return setError("Sở thích này đã có trong hồ sơ.");
    setError("");
    setForm(o => ({ ...o, interests: [...o.interests, value] }));
    setCustomInterest("");
  }

  async function addFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setError("");
    const slots = Math.max(0, 10 - form.photos.length);
    if (slots === 0) {
      e.target.value = "";
      return setError("Tối đa 10 ảnh.");
    }
    if (files.length > slots) setError(`Bạn chỉ có thể thêm ${slots} ảnh nữa, tối đa 10 ảnh.`);
    const selected = files.slice(0, slots);
    const dataUrls = await Promise.all(selected.map(readFileAsDataUrl));
    setForm(o => ({ ...o, photos: [...o.photos, ...dataUrls].slice(0, 10) }));
    e.target.value = "";
  }

  function addPhotoUrl() {
    const value = photoUrl.trim();
    if (!value) return;
    if (form.photos.length >= 10) return setError("Tối đa 10 ảnh.");
    setForm(o => ({ ...o, photos: [...o.photos, value].slice(0, 10) }));
    setPhotoUrl("");
  }

  function removePhoto(index) {
    setForm(o => ({ ...o, photos: o.photos.filter((_, i) => i !== index) }));
  }

  function movePhoto(fromIndex, toIndex) {
    if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    setForm(o => {
      const next = [...o.photos];
      if (fromIndex < 0 || fromIndex >= next.length || toIndex < 0 || toIndex >= next.length) return o;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...o, photos: next };
    });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.photos.length < 3) return setError("Bạn cần tối thiểu 3 ảnh trước khi đăng hồ sơ.");
    if (form.photos.length > 10) return setError("Tối đa 10 ảnh.");
    if (form.bio.trim().length < 10) return setError("Bio cần tối thiểu 10 ký tự.");
    try {
      const { data } = await api.put("/profiles/me", form);
      setProfileCompleted(data.profile.completed);
      if (data.profile.completed) nav("/discover");
      else setError("Cần đủ nickname, ngày sinh, giới tính, bio và 3–10 ảnh.");
    } catch (err) { setError(err.message); }
  }

  const completion = Math.min(100, Math.round(((form.nickname ? 1 : 0) + (form.bio?.length >= 10 ? 1 : 0) + (form.photos.length >= 3 ? 1 : 0) + (form.interests.length >= 2 ? 1 : 0)) / 4 * 100));

  return <main className="form-page"><form className="wide-form" onSubmit={submit}>
    <div className="form-title">
      <span className="eyebrow"><ShieldCheck size={17}/> Privacy-first</span>
      <h1>{t("profile.myProfile")}</h1>
      <button type="button" className="ghost-btn" onClick={() => setGuideOpen(true)}><ShieldCheck size={16}/> {t("landing.guide")}</button>
      <div className="completion"><span style={{ width: `${completion}%` }} /> <b>{completion}% {t("profile.completed")}</b></div>
    </div>
    {error && <div className="alert error">{error}</div>}

    <section className="profile-builder-grid">
      <div className="builder-form">
        <div className="form-grid">
          <label>Nickname<input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} /></label>
          <label>{t("auth.birthday")}<input type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} /></label>
          <label>{t("auth.gender")}<select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="male">Nam</option><option value="female">Nữ</option><option value="other">{t("profile.other")}</option></select></label>
          <label>{t("profile.city")}<input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></label>
          <label>{t("profile.goal")}<select value={presetGoalKeys.includes(form.datingGoal) ? form.datingGoal : "custom"} onChange={e => setForm({ ...form, datingGoal: e.target.value === "custom" ? "" : e.target.value })}><option value="chat">Trò chuyện</option><option value="friendship">Tìm bạn mới</option><option value="serious">Hẹn hò nghiêm túc</option><option value="not_sure">Chưa rõ</option><option value="custom">{t("profile.other")}</option></select></label>
          {!presetGoalKeys.includes(form.datingGoal) && <label>{t("profile.customGoal")}<input maxLength="80" value={form.datingGoal} onChange={e => setForm({ ...form, datingGoal: e.target.value.slice(0, 80) })} placeholder="Ví dụ: Đi cà phê cuối tuần" /></label>}
          <label>Trạng thái hiển thị<select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })}><option value="public">Đăng công khai</option><option value="paused">Tạm ẩn</option><option value="private">Riêng tư</option></select></label>
        </div>

        <div className="field-block profile-theme-card">
          <div className="field-head"><span>Giao diện hồ sơ</span><small>Áp dụng cho preview và khung xem hồ sơ</small></div>
          <div className="theme-picker">
            {[
              ["kero", "Kero Pink"],
              ["purple", "Purple Glass"],
              ["minimal", "Minimal White"],
              ["dark", "Dark Romance"]
            ].map(([value, label]) => <button type="button" key={value} className={`theme-swatch theme-${value} ${form.theme === value ? "active" : ""}`} onClick={() => setForm({ ...form, theme: value })}><span />{label}</button>)}
          </div>
        </div>

        <div className="field-block"><span>Tôi muốn tìm</span><div className="chip-row selectable">{["male", "female", "other"].map(g => <button type="button" key={g} className={form.lookingFor.includes(g) ? "active" : ""} onClick={() => toggleLookingFor(g)}>{genderLabels[g]}</button>)}</div></div>

        <label>{t("profile.bio")}<textarea rows="4" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Viết ngắn gọn về bạn..." /></label>

        <div className="field-block">
          <div className="field-head"><span>{t("profile.photos")} ({form.photos.length}/10)</span><small>{t("profile.photoRule")}</small></div>
          <label className="upload-box"><ImagePlus/><strong>{t("profile.choosePhotos")}</strong><small>Hỗ trợ nhiều ảnh, frontend sẽ xem trước ngay.</small><input type="file" accept="image/*" multiple onChange={addFiles} hidden /></label>
          {/* <div className="url-add"><input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="Hoặc dán link ảnh https://..." /><button type="button" onClick={addPhotoUrl}><Plus size={16}/> Thêm</button></div> */}
          <div className="photo-grid photo-grid-sortable">{form.photos.map((photo, index) => <div
            className={`photo-tile ${index === 0 ? "is-main" : ""} ${draggedPhotoIndex === index ? "is-dragging" : ""}`}
            key={`${photo}-${index}`}
            draggable
            onDragStart={event => {
              setDraggedPhotoIndex(index);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
            }}
            onDragOver={event => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={event => {
              event.preventDefault();
              const from = draggedPhotoIndex ?? Number(event.dataTransfer.getData("text/plain"));
              movePhoto(from, index);
              setDraggedPhotoIndex(null);
            }}
            onDragEnd={() => setDraggedPhotoIndex(null)}
            onDoubleClick={() => movePhoto(index, 0)}
          >
            <img src={photo} alt={`Ảnh ${index + 1}`} />
            <button className="remove-photo" type="button" onClick={() => removePhoto(index)}><Trash2 size={15}/></button>
            <span>{index === 0 ? "Ảnh chính" : `#${index + 1}`}</span>
            <div className="drag-hint">Nắm kéo để đổi vị trí</div>
          </div>)}</div>
        </div>

        <div className="field-block">
          
          <div className="custom-interest"><input value={customInterest} onChange={e => setCustomInterest(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomInterest(); } }} placeholder="Ví dụ: Porsche, Figma, Gaming..." /><button type="button" onClick={addCustomInterest}><Plus size={16}/> {t("profile.addInterest")}</button></div>
          <div className="chip-row selectable">{interests.map(i => <button type="button" key={i._id || i.name} className={form.interests.includes(i.name) ? "active" : ""} onClick={() => toggleInterest(i.name)}>{i.icon} {i.name}</button>)}</div>
          <div className="chip-row selected">{form.interests.map(i => <button type="button" key={i} onClick={() => toggleInterest(i)}>{i} <X size={13}/></button>)}</div>
        </div>
      </div>

      <aside className="builder-preview">
        <div className="preview-sticky">
          <div className="field-head"><span>{t("profile.preview")}</span><small>Đây là những gì người khác thấy</small></div>
          <PublicProfilePreview profile={form} compact />
          <button type="button" className="ghost-btn full" onClick={() => setPreviewOpen(true)}><Eye size={16}/> Xem preview lớn</button>
          <button className="primary-btn full"><ShieldCheck size={16}/> {t("profile.save")}</button>
        </div>
      </aside>
    </section>
  </form>
  <ProfilePreviewModal open={previewOpen} profile={form} onClose={() => setPreviewOpen(false)} />
  <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
  </main>;
}

function ProfilePreviewModal({ open, profile, onClose }) {
  return <AnimatePresence>{open && <motion.div className="match-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className={`profile-detail-modal ${themeClass(profile.theme)}`} initial={{ y: 24, scale: .96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
      <button className="close-modal" onClick={onClose}><X /></button>
      <span className="eyebrow"><Eye size={17}/> Preview trước khi đăng</span>
      <PublicProfilePreview profile={profile} />
      <div className="security-note"><LockKeyhole size={17}/> Không hiển thị email, ngày sinh gốc, tọa độ chính xác hoặc thông tin đăng nhập trong preview công khai.</div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function ProfileCard({ profile, onAction, onView, acting, onUndo, canUndo }) {
  const { t } = useLanguage();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-16, 16]);
  const likeOpacity = useTransform(x, [30, 140], [0, 1]);
  const passOpacity = useTransform(x, [-140, -30], [1, 0]);

  function dragEnd(_, info) {
    if (acting) return;
    if (info.offset.x > 130) onAction("like", profile);
    else if (info.offset.x < -130) onAction("pass", profile);
  }

  return <motion.article className="dating-card" style={{ x, rotate }} drag="x" dragConstraints={{ left: 0, right: 0 }} onDragEnd={dragEnd} onClick={() => onView(profile)}>
    <img src={profile.photos?.[0] || fallbackPhoto} alt={profile.nickname} />
    <button type="button" className="discover-undo-btn" disabled={!canUndo || acting} onClick={e => { e.stopPropagation(); onUndo?.(); }}><RotateCcw size={16}/> {t("discover.undo")}</button>
    <motion.div className="swipe-badge like" style={{ opacity: likeOpacity }}>LIKE</motion.div>
    <motion.div className="swipe-badge pass" style={{ opacity: passOpacity }}>PASS</motion.div>
    <div className="dating-card-info">
      <button className="view-profile-btn" type="button" onClick={e => { e.stopPropagation(); onView(profile); }}><Eye size={15}/> {t("discover.viewProfile")}</button>
      <h2>{profile.nickname}, {profile.age}</h2>
      <p>{profile.compatibilityScore}% {t("discover.compatible")} · {profile.city}</p>
      <p className="tap-hint">{t("discover.tapHint")}</p>
      <p>{profile.bio}</p>
      <div className="chip-row">{profile.sharedInterests?.length ? profile.sharedInterests.map(i => <span key={i}>Chung: {i}</span>) : profile.interests?.slice(0, 3).map(i => <span key={i}>{i}</span>)}</div>
      <div className="card-actions" onClick={e => e.stopPropagation()}>
        <button type="button" disabled={acting} onClick={() => onAction("pass", profile)} className="circle-btn pass-btn"><X /></button>
        <button type="button" disabled={acting} onClick={() => onAction("like", profile)} className="circle-btn like-btn"><Heart fill="currentColor" /></button>
      </div>
    </div>
  </motion.article>;
}

function ProfileDetailModal({ profile, open, onClose, onAction, acting, actions }) {
  const { t } = useLanguage();
  const [photo, setPhoto] = useState(0);
  useEffect(() => { setPhoto(0); }, [profile?.userId]);
  if (!profile) return null;
  const photos = profile.photos?.length ? profile.photos : [fallbackPhoto];
  const canSwipe = typeof onAction === "function";
  return <AnimatePresence>{open && <motion.div className="match-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className={`profile-detail-modal ${themeClass(profile.theme)}`} initial={{ y: 28, scale: .96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
      <div className="detail-grid">
        <div className="detail-photo-layout">
          <div className="detail-thumbs">{photos.map((src, i) => <button type="button" key={src + i} className={i === photo ? "active" : ""} onClick={() => setPhoto(i)}><img src={src} alt="thumb" /></button>)}</div>
          <img className="detail-main-photo" src={photos[photo]} alt={profile.nickname} />
        </div>
        <div className="detail-copy">
          <button type="button" className="close-modal detail-close-modal" aria-label="Đóng hồ sơ" onClick={onClose}><X /></button>
          <span className="eyebrow"><Eye size={16}/> Hồ sơ công khai</span>
          <h1>{profile.nickname}, {profile.age}</h1>
          <p className="muted-line">{genderLabels[profile.gender] || t("profile.other")} · {profile.city} · {displayGoal(profile.datingGoal)}</p>
          <p>{profile.bio}</p>
          <div className="score-box"><strong>{profile.compatibilityScore}%</strong><span>{t("discover.compatibility")}</span></div>
          <div className="chip-row">{profile.interests?.map(i => <span key={i}>{i}</span>)}</div>
          {/* <div className="security-note"><LockKeyhole size={17}/> Kero chỉ hiển thị nickname, tuổi, thành phố, ảnh, bio và sở thích công khai.</div> */}
          {actions ? <div className="modal-actions">{actions}</div> : canSwipe ? <div className="modal-actions"><button className="ghost-btn" disabled={acting} onClick={() => { onAction("pass", profile); onClose(); }}><X size={16}/> {t("discover.pass")}</button><button className="primary-btn" disabled={acting} onClick={() => { onAction("like", profile); onClose(); }}><Heart size={16} fill="currentColor"/> {t("discover.like")}</button></div> : null}
        </div>
      </div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function MatchModal({ open, profile, matchId, onClose }) {
  const nav = useNavigate();
  const { t } = useLanguage();
  return <AnimatePresence>{open && profile && <motion.div className="match-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="match-card" initial={{ y: 30, scale: .84, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ opacity: 0 }} onClick={e => e.stopPropagation()}>
      <Sparkles size={44}/><div className="match-avatars"><div className="my-avatar">Kero</div><img src={profile.photos?.[0] || fallbackPhoto} alt="match" /></div>
      <h1>It's a Match!</h1><p>{t("matches.matches")}: {profile.nickname}</p>
      <div className="modal-actions"><button className="ghost-btn" onClick={onClose}>{t("matches.continue")}</button><button className="primary-btn" onClick={() => nav(matchId ? `/chat/${matchId}` : "/matches")}><MessageCircle size={17}/> {t("matches.message")}</button></div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function Discover() {
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState("");
  const [match, setMatch] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);
  const [lastSwipe, setLastSwipe] = useState(null);
  const [acting, setActing] = useState(false);
  const actingRef = useRef(false);

  async function load() {
    setError("");
    try {
      const { data } = await api.get("/discover");
      setProfiles(data.profiles);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, []);

  async function act(action, profile) {
    if (actingRef.current || !profile) return;
    actingRef.current = true;
    setActing(true);
    setError("");
    setViewProfile(current => current?.userId === profile.userId ? null : current);
    setProfiles(o => o.filter(p => p.userId !== profile.userId));
    try {
      const { data } = await api.post("/discover/action", { targetUserId: profile.userId, action });
      setLastSwipe({ action, profile, matched: Boolean(data.matched) });
      if (data.matched) setMatch({ profile, matchId: data.matchId });
    } catch (err) {
      setProfiles(o => o.some(p => p.userId === profile.userId) ? o : [profile, ...o]);
      setError(err.message);
    } finally {
      actingRef.current = false;
      setActing(false);
    }
  }

  async function undo() {
    if (!lastSwipe || actingRef.current) return;
    if (lastSwipe.matched) {
      setError("Lượt này đã tạo kết nối, hãy vào Match để hủy kết nối nếu muốn.");
      return;
    }
    actingRef.current = true;
    setActing(true);
    setError("");
    try {
      const { data } = await api.post("/swipes/undo");
      const restored = data.restoredProfile || lastSwipe.profile;
      setProfiles(o => o.some(p => p.userId === restored.userId) ? o : [restored, ...o]);
      setLastSwipe(null);
    } catch (err) { setError(err.message); }
    finally {
      actingRef.current = false;
      setActing(false);
    }
  }

  const current = profiles[0];
  return <main className="discover-page">
    <section className="discover-header"><div><p>Discover</p><h1>{t("discover.title")}</h1><small>{t("discover.subtitle")}</small></div></section>
    {error && <div className="alert error">{error}</div>}
    <section className="discover-stage">{current ? <ProfileCard profile={current} onAction={act} onView={setViewProfile} acting={acting} onUndo={undo} canUndo={Boolean(lastSwipe)} /> : <div className="empty-card"><ShieldAlert size={44}/><h2>{t("discover.emptyTitle")}</h2><p>{t("discover.emptyBody")}</p><button className="primary-btn" onClick={load}>{t("discover.reload")}</button></div>}</section>
    <MatchModal open={!!match} profile={match?.profile} matchId={match?.matchId} onClose={() => setMatch(null)} />
    <ProfileDetailModal open={!!viewProfile} profile={viewProfile} onClose={() => setViewProfile(null)} onAction={act} acting={acting} />
  </main>;
}


function Swipes() {
  const { t } = useLanguage();
  const [incoming, setIncoming] = useState([]);
  const [error, setError] = useState("");
  const [match, setMatch] = useState(null);
  const [busySwipeId, setBusySwipeId] = useState("");

  async function load() {
    try {
      setError("");
      const { data } = await api.get("/swipes");
      setIncoming(data.incomingLikes || []);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, []);

  async function likeBack(item) {
    const targetUserId = item.actionTargetId || item.fromUserId || item.profile?.userId;
    if (!targetUserId) return setError("Thiếu targetUserId để tạo kết nối.");
    setBusySwipeId(item.swipeId);
    setError("");
    try {
      const { data } = await api.post("/discover/action", { targetUserId, action: "like" });
      if (data.matched) {
        setIncoming(items => items.filter(current => current.swipeId !== item.swipeId));
        setMatch({ profile: item.profile, matchId: data.matchId });
      }
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusySwipeId(""); }
  }

  return <main className="content-page swipe-page">
    <div className="page-title with-action"><div><p>Kero Swipe List</p><h1>{t("matches.likedYou")}</h1><small>{t("matches.likeBack")}</small></div><button className="ghost-btn" onClick={load}><RotateCcw size={16}/> {t("discover.reload")}</button></div>
    {error && <div className="alert error">{error}</div>}

    <section className="swipe-section">
      <div className="section-heading"><h2>{t("matches.likedYou")}</h2><p>{t("matches.likeBack")}</p></div>
      {incoming.length === 0 ? <div className="empty-row">{t("matches.none")}</div> : <div className="swipe-grid">{incoming.map(item => <article className="swipe-card" key={item.swipeId}>
        <img src={item.profile.photos?.[0] || fallbackPhoto} alt={item.profile.nickname}/>
        <div><span className={item.matched ? "swipe-status matched" : "swipe-status incoming"}>{item.matched ? t("matches.matches") : t("matches.likedYou")}</span><h3>{item.profile.nickname}, {item.profile.age}</h3><p>{item.profile.compatibilityScore}% {t("discover.compatible")} · {item.profile.city}</p><div className="chip-row">{item.profile.sharedInterests?.slice(0,3).map(i => <span key={i}>Chung: {i}</span>)}</div>{item.matched ? <Link className="primary-btn" to={`/chat/${item.matchId}`}><MessageCircle size={16}/> {t("matches.openChat")}</Link> : <button className="primary-btn" disabled={busySwipeId === item.swipeId} onClick={() => likeBack(item)}><Heart size={16} fill="currentColor"/> {t("matches.likeBack")}</button>}</div>
      </article>)}</div>}
    </section>
    <MatchModal open={!!match} profile={match?.profile} matchId={match?.matchId} onClose={() => setMatch(null)} />
  </main>;
}

function Matches() {
  const { t } = useLanguage();
  const [matches, setMatches] = useState([]);
  const [viewProfile, setViewProfile] = useState(null);
  const [viewMatchId, setViewMatchId] = useState("");
  const [error, setError] = useState("");
  async function loadMatches({ silent = false } = {}) {
    try {
      if (!silent) setError("");
      const { data } = await api.get("/matches");
      setMatches(data.matches || []);
    } catch (e) {
      if (!silent) setError(e.message);
    }
  }

  useEffect(() => {
    loadMatches();
    const timer = window.setInterval(() => loadMatches({ silent: true }), 12000);
    return () => window.clearInterval(timer);
  }, []);

  function openProfile(match) {
    setViewProfile(match.profile);
    setViewMatchId(match.matchId);
  }

  return <main className="content-page">
    <div className="page-title"><p>Matches</p><h1>{t("matches.matches")}</h1></div>
    {error && <div className="alert error">{error}</div>}
    {matches.length === 0 ? <div className="empty-row">{t("matches.none")}</div> : <div className="match-grid">{matches.map(m => {
      const unreadCount = Number(m.unreadCount || 0);
      return <article className={unreadCount > 0 ? "match-card-small clickable has-unread" : "match-card-small clickable"} key={m.matchId} role="button" tabIndex={0} onClick={() => openProfile(m)} onKeyDown={e => { if (e.key === "Enter") openProfile(m); }}>
      <div className="match-photo-wrap">
        <img src={m.profile.photos?.[0] || fallbackPhoto} alt={m.profile.nickname || "match"} />
        {unreadCount > 0 && <div className="match-unread-badge" aria-label={`${unreadCount} tin nhắn chưa đọc`}>
          <span className="match-unread-number">{unreadCount > 99 ? "99+" : unreadCount}</span>
          <span className="match-unread-icon"><MessageCircle size={16}/></span>
        </div>}
      </div>
      <div className="match-info">
        <h3>{m.profile.nickname}, {m.profile.age}</h3>
        <p>{m.profile.compatibilityScore}% {t("discover.compatible")} · {m.profile.city}</p>
        <div className="match-actions-row">
          <button type="button" className="ghost-btn" onClick={e => { e.stopPropagation(); openProfile(m); }}><Eye size={16}/> Xem hồ sơ</button>
          <Link className="primary-btn" to={`/chat/${m.matchId}`} onClick={e => e.stopPropagation()}><MessageCircle size={16}/> {t("matches.chat")}</Link>
        </div>
      </div>
    </article>;
    })}</div>}
    <ProfileDetailModal
      open={!!viewProfile}
      profile={viewProfile}
      onClose={() => setViewProfile(null)}
      actions={<>
        <button className="ghost-btn" type="button" onClick={() => setViewProfile(null)}><X size={16}/> Đóng</button>
        <Link className="primary-btn" to={`/chat/${viewMatchId}`}><MessageCircle size={16}/> {t("matches.chat")}</Link>
      </>}
    />
  </main>;
}

function Chat() {
  const { t } = useLanguage();
  const { matchId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [matches, setMatches] = useState([]);
  const [profile, setProfile] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(chatReportReasons[0][0]);
  const [reportDescription, setReportDescription] = useState("");
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voicePreview, setVoicePreview] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const messagesEndRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingStartRef = useRef(null);
  const cancelRecordingRef = useRef(false);
  const sendAfterRecordingRef = useRef(false);

  function clearVoicePreview() {
    setVoicePreview(null);
    setRecordingTime(0);
  }

  function stopVoiceRecording({ cleanupOnly = false } = {}) {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    if (!cleanupOnly) {
      setIsRecording(false);
      setRecordingTime(0);
    }
  }

  function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  async function startVoiceRecording() {
    if (isRecording) return;
    if (!window.MediaRecorder) {
      setError("Trình duyệt chưa hỗ trợ ghi âm.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt chưa hỗ trợ ghi âm.");
      return;
    }
    try {
      if (voicePreview?.audioUrl) URL.revokeObjectURL(voicePreview.audioUrl);
      clearVoicePreview();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("Không thể ghi âm lúc này.");
        cancelRecordingRef.current = true;
        stopVoiceRecording({ cleanupOnly: true });
      };
      recorder.onstop = () => {
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          audioChunksRef.current = [];
          recordingStartRef.current = null;
          setIsRecording(false);
          setRecordingTime(0);
          return;
        }
        const durationSeconds = recordingStartRef.current ? Math.min(MAX_RECORDING_SECONDS, Math.floor((Date.now() - recordingStartRef.current) / 1000)) : 0;
        if (durationSeconds > MAX_RECORDING_SECONDS) {
          setError("Voice quá dài, vui lòng ghi ngắn hơn.");
          recordingStartRef.current = null;
          clearVoicePreview();
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        if (!audioBlob.size) {
          recordingStartRef.current = null;
          clearVoicePreview();
          return;
        }
        if (audioBlob.size > MAX_AUDIO_BYTES) {
          setError("Voice quá dài, vui lòng ghi ngắn hơn.");
          recordingStartRef.current = null;
          clearVoicePreview();
          return;
        }
        const audioUrl = URL.createObjectURL(audioBlob);
        const nextVoicePreview = {
          audioUrl,
          mime: mimeType || "audio/webm",
          duration: durationSeconds,
          blob: audioBlob
        };
        if (sendAfterRecordingRef.current) {
          sendAfterRecordingRef.current = false;
          sendPreparedVoice(nextVoicePreview);
        } else {
          setVoicePreview(nextVoicePreview);
        }
        recordingStartRef.current = null;
        setIsRecording(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = window.setInterval(() => {
        const seconds = recordingStartRef.current ? Math.floor((Date.now() - recordingStartRef.current) / 1000) : 0;
        setRecordingTime(seconds);
        if (seconds >= MAX_RECORDING_SECONDS) {
          stopVoiceRecording();
        }
      }, 1000);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Bạn cần cấp quyền micro để ghi âm.");
      } else {
        setError(err.message || "Không thể bắt đầu ghi âm.");
      }
    }
  }

  function handleEmojiSelect(emoji) {
    setText(value => `${value}${emoji}`);
    setShowEmojiPicker(false);
  }

  function handleImagePick(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImagePreview() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function removeVoicePreview() {
    if (voicePreview?.audioUrl) URL.revokeObjectURL(voicePreview.audioUrl);
    clearVoicePreview();
    stopVoiceRecording({ cleanupOnly: true });
  }

  function handleCancelRecording() {
    sendAfterRecordingRef.current = false;
    cancelRecordingRef.current = true;
    stopVoiceRecording({ cleanupOnly: true });
    clearVoicePreview();
  }

  function handleSendRecording() {
    sendAfterRecordingRef.current = true;
    stopVoiceRecording();
  }

  useEffect(() => {
    function handlePointerDown(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    return () => {
      cancelRecordingRef.current = true;
      stopVoiceRecording({ cleanupOnly: true });
      if (voicePreview?.audioUrl) URL.revokeObjectURL(voicePreview.audioUrl);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [matchId]);

  async function load({ silent = false } = {}) {
    try {
      if (!silent) setError("");
      const [chatRes, matchRes] = await Promise.all([
        api.get(`/matches/${matchId}/messages`),
        api.get("/matches")
      ]);
      setMessages(chatRes.data.messages || []);
      setProfile(chatRes.data.profile || matchRes.data.matches?.find(item => item.matchId === matchId)?.profile || null);
      setMatches((matchRes.data.matches || []).map(item => item.matchId === matchId ? { ...item, unreadCount: 0 } : item));
      await api.post(`/matches/${matchId}/read`);
    } catch (err) {
      if (!silent) setError(err.message);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(() => load({ silent: true }), 5000);
    return () => clearInterval(timer);
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendPreparedVoice(preparedVoice) {
    try {
      setError("");
      const payload = {
        type: "audio",
        text: "",
        content: "",
        audioData: preparedVoice?.blob ? await blobToDataUrl(preparedVoice.blob) : "",
        audioMime: preparedVoice?.mime || "",
        audioDuration: preparedVoice?.duration || 0
      };
      const { data } = await api.post(`/matches/${matchId}/messages`, payload);
      setMessages(o => [...o, data.message]);
      setText("");
      setShowEmojiPicker(false);
      clearImagePreview();
      if (preparedVoice?.audioUrl) URL.revokeObjectURL(preparedVoice.audioUrl);
      setVoicePreview(null);
      setRecordingTime(0);
    } catch (err) { setError(err.message); }
  }

  async function send(e) {
    e.preventDefault();
    const cleanText = text.trim();
    if (isRecording) {
      handleSendRecording();
      return;
    }
    if (!cleanText && !voicePreview) return;
    if (voicePreview) {
      await sendPreparedVoice(voicePreview);
      return;
    }
    try {
      setError("");
      const payload = {
        type: "text",
        text: cleanText,
        content: cleanText,
        audioData: "",
        audioMime: "",
        audioDuration: 0
      };
      const { data } = await api.post(`/matches/${matchId}/messages`, payload);
      setMessages(o => [...o, data.message]);
      setText("");
      setShowEmojiPicker(false);
      clearImagePreview();
    } catch (err) { setError(err.message); }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!activeProfile || reporting) return;
    setReporting(true);
    setError("");
    try {
      await api.post("/safety/report", {
        targetUserId: activeProfile.userId,
        matchId,
        reason: reportReason,
        description: reportDescription.slice(0, 500),
        source: "chat"
      });
      setReportOpen(false);
      setReportReason(chatReportReasons[0][0]);
      setReportDescription("");
      setNotice("Đã gửi báo cáo. Cảm ơn bạn đã phản hồi.");
    } catch (err) {
      setError(err.message);
    } finally {
      setReporting(false);
    }
  }

  async function unmatch() {
    if (!confirm("Bạn muốn hủy match?")) return;
    await api.patch(`/matches/${matchId}/unmatch`);
    location.href = "/matches";
  }

  const activeProfile = profile || matches.find(item => item.matchId === matchId)?.profile;
  const activePhoto = activeProfile?.photos?.[0] || fallbackPhoto;
  const lastActiveMessage = messages[messages.length - 1];
  const railItems = matches.length ? matches : activeProfile ? [{ matchId, profile: activeProfile }] : [];

  return <main className="chat-page">
    <div className="chat-shell">
      <aside className="chat-rail" aria-label="Danh sách kết nối">
        {railItems.map(item => {
          const isActive = item.matchId === matchId;
          const lastMessage = isActive ? lastActiveMessage : item.lastMessage;
          const isMine = lastMessage?.sender === user.id;
          const preview = lastMessage?.type === "audio" ? "🎤 Tin thoại" : lastMessage?.text ? `${isMine ? "Bạn: " : ""}${lastMessage.text}` : "Hãy bắt đầu cuộc trò chuyện";
          const time = messageTime(lastMessage) || formatChatTime(item.lastMessageAt);
          return <Link key={item.matchId} to={`/chat/${item.matchId}`} className={isActive ? "chat-rail-item active" : "chat-rail-item"} title={item.profile.nickname}>
            <img src={item.profile.photos?.[0] || fallbackPhoto} alt={item.profile.nickname} />
            <span className="chat-rail-meta">
              <span className="chat-rail-top">
                <strong className="chat-rail-name">{item.profile.nickname}</strong>
                {time && <span className="chat-rail-time">{time}</span>}
              </span>
              <span className="chat-rail-preview">{preview}</span>
            </span>
          </Link>;
        })}
      </aside>
      <section className="chat-panel">
        <div className="chat-toolbar">
          <div className="chat-active-user">
            <img className="chat-active-avatar" src={activePhoto} alt={activeProfile?.nickname || "Kero match"} />
            <div className="chat-title-block">
              <p>Private chat</p>
              <h1>{t("matches.chat")}</h1>
              <span>{activeProfile ? `với ${activeProfile.nickname} · trò chuyện riêng tư` : "trò chuyện riêng tư"}</span>
            </div>
          </div>
          <div className="chat-toolbar-actions">
            {activeProfile && <button className="chat-profile-link" type="button" onClick={() => setViewProfile(activeProfile)}><Eye size={15}/> Xem hồ sơ</button>}
            <button className="report-chat-btn" type="button" title="Báo cáo tài khoản hoặc cuộc trò chuyện" aria-label="Báo cáo tài khoản hoặc cuộc trò chuyện" onClick={() => setReportOpen(true)} disabled={!activeProfile}><AlertCircle size={16}/> Báo cáo</button>
            <button className="danger-btn" onClick={unmatch}><UserX size={16}/> {t("matches.unmatch")}</button>
          </div>
        </div>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
        <div className="messages">
          {messages.length === 0 && <div className="empty-chat-state">
            <strong>Hãy bắt đầu cuộc trò chuyện{activeProfile ? ` với ${activeProfile.nickname}` : ""}</strong>
            <span>Gửi một lời chào dễ thương nào ✨</span>
          </div>}
          {messages.map(m => {
            const isMine = m.sender === user.id;
            const time = messageTime(m);
            const isAudio = m.type === "audio" || m.audioData || m.audioUrl;
            const displayText = m.content || m.text || "";
            return <div key={m._id} className={isMine ? "message-row me" : "message-row other"}>
              {!isMine && <img className="message-avatar" src={activePhoto} alt={activeProfile?.nickname || "match"} />}
              <div className="message-content">
                {isAudio ? <div className={`bubble audio-bubble ${isMine ? "me" : "other"}`}>
                  {displayText ? <div className="audio-caption">{displayText}</div> : null}
                  <audio controls preload="metadata" src={m.audioData || m.audioUrl} />
                  {m.audioDuration ? <span className="audio-duration">{formatDuration(m.audioDuration)}</span> : null}
                </div> : <div className="bubble">{m.text}</div>}
                {time && <span className="message-time">{time}</span>}
              </div>
            </div>;
          })}
          <div ref={messagesEndRef} />
        </div>
        {isRecording ? <form className="chat-input-recording" onSubmit={send}>
          <button type="button" className="record-cancel-btn" aria-label="Hủy ghi âm" onClick={handleCancelRecording}><X size={20}/></button>
          <button type="button" className="record-stop-btn" aria-label="Dừng ghi âm" onClick={() => stopVoiceRecording()}><Square size={22}/></button>
          <div className="record-track"><span className="record-time">{formatDuration(recordingTime)}</span></div>
          <button type="button" className="record-send-btn" onClick={handleSendRecording}>Gửi</button>
        </form> : voicePreview ? <form className="chat-input-recorded" onSubmit={send}>
          <button type="button" className="chat-tool-btn" aria-label="Ghi âm lại" onClick={startVoiceRecording}><Mic size={26}/></button>
          <div className="emoji-picker-wrap" ref={emojiPickerRef}>
            <button type="button" className="chat-tool-btn" aria-label="Chèn emoji" onClick={() => setShowEmojiPicker(value => !value)}><Smile size={26}/></button>
            {showEmojiPicker && <div className="emoji-picker" role="dialog" aria-label="Emoji picker">
              {emojiSuggestions.map(emoji => <button key={emoji} type="button" onClick={() => handleEmojiSelect(emoji)}>{emoji}</button>)}
            </div>}
          </div>
          <div className="voice-track"><span className="voice-time">{formatDuration(voicePreview.duration)}</span></div>
          <button type="button" className="voice-delete-btn" aria-label="Xóa voice" onClick={removeVoicePreview}><Trash2 size={20}/></button>
          <button type="submit" className="voice-send-btn" aria-label="Gửi voice"><Send size={30}/></button>
        </form> : <form className="chat-input" onSubmit={send}>
          <button type="button" className="chat-tool-btn" aria-label="Ghi âm" onClick={startVoiceRecording}><Mic size={26}/></button>
          <div className="emoji-picker-wrap" ref={emojiPickerRef}>
            <button type="button" className="chat-tool-btn" aria-label="Chèn emoji" onClick={() => setShowEmojiPicker(value => !value)}><Smile size={26}/></button>
            {showEmojiPicker && <div className="emoji-picker" role="dialog" aria-label="Emoji picker">
              {emojiSuggestions.map(emoji => <button key={emoji} type="button" onClick={() => handleEmojiSelect(emoji)}>{emoji}</button>)}
            </div>}
          </div>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={t("matches.message")} />
          {text.trim() && <button type="submit" className="chat-send-text-btn" aria-label="Gửi tin nhắn"><Send size={22}/></button>}
        </form>}
      </section>
    </div>
    <ProfileDetailModal
      open={!!viewProfile}
      profile={viewProfile}
      onClose={() => setViewProfile(null)}
      actions={<button className="ghost-btn" type="button" onClick={() => setViewProfile(null)}><X size={16}/> Đóng</button>}
    />
    <AnimatePresence>{reportOpen && <motion.div className="match-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReportOpen(false)}>
      <motion.form className="report-modal" initial={{ y: 24, scale: .97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ opacity: 0 }} onSubmit={submitReport} onClick={e => e.stopPropagation()}>
        <button className="close-modal" type="button" onClick={() => setReportOpen(false)}><X /></button>
        <span className="eyebrow"><AlertCircle size={16}/> Kero Safety</span>
        <h2>Báo cáo cuộc trò chuyện</h2>
        <p>Hãy chọn lý do để chúng tôi xem xét tài khoản và nội dung trò chuyện này.</p>
        <div className="report-reasons">
          {chatReportReasons.map(([value, label]) => <label key={value} className={reportReason === value ? "active" : ""}>
            <input type="radio" name="chat-report-reason" value={value} checked={reportReason === value} onChange={() => setReportReason(value)} />
            <span>{label}</span>
          </label>)}
        </div>
        <textarea value={reportDescription} maxLength={500} placeholder="Mô tả thêm nếu cần..." onChange={e => setReportDescription(e.target.value)} />
        <div className="report-count">{reportDescription.length}/500</div>
        <div className="modal-actions">
          <button className="ghost-btn" type="button" onClick={() => setReportOpen(false)}>Hủy</button>
          <button className="primary-btn" type="submit" disabled={reporting}>{reporting ? "Đang gửi..." : "Gửi báo cáo"}</button>
        </div>
      </motion.form>
    </motion.div>}</AnimatePresence>
  </main>;
}

function AdminLayout() {
  const { t } = useLanguage();
  return <main className="admin-layout"><aside className="admin-sidebar"><div className="admin-logo"><span>K</span><div><strong>Kero Security</strong><small>{t("admin.dashboard")}</small></div></div><nav><NavLink to="/admin" end><BarChart3/> Dashboard</NavLink><NavLink to="/admin/users"><Users/> {t("admin.users")}</NavLink><NavLink to="/admin/reports"><Flag/> {t("admin.reports")}</NavLink><NavLink to="/admin/interests"><Tags/> {t("admin.interests")}</NavLink></nav><div className="admin-secure-note"><Shield size={18}/><span>Public API không trả email, ngày sinh gốc, tọa độ chính xác hay mật khẩu.</span></div></aside><section className="admin-content"><div className="admin-topbar"><div><p>Kero Security</p><h1>{t("admin.dashboard")}</h1></div><HeartHandshake/></div><Outlet/></section></main>;
}

function StatCard({ label, value, icon }) {
  return <article className="admin-stat-card"><div>{icon}</div><strong>{value}</strong><span>{label}</span></article>;
}

function GenderBars({ data = [] }) {
  const { t } = useLanguage();
  const max = Math.max(1, ...data.map(d => d.count));
  return <section className="chart-card"><div className="chart-title"><PieChart/><div><h2>{t("admin.genderChart")}</h2><p>{t("admin.publicProfiles")}</p></div></div><div className="gender-bars">{data.map(row => <div className="bar-row" key={row.gender}><span>{row.label}</span><div><i style={{ width: `${(row.count / max) * 100}%` }} /></div><b>{row.count}</b></div>)}</div></section>;
}

function ActivityLine({ data = [] }) {
  const { t } = useLanguage();
  const width = 640;
  const height = 220;
  const padding = 28;
  const values = data.flatMap(d => [d.profiles, d.matches, d.reports]);
  const max = Math.max(1, ...values);
  const xFor = index => padding + index * ((width - padding * 2) / Math.max(1, data.length - 1));
  const yFor = value => height - padding - (value / max) * (height - padding * 2);
  const pathFor = key => data.map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d[key])}`).join(" ");

  return <section className="chart-card wide"><div className="chart-title"><Activity/><div><h2>{t("admin.activity7d")}</h2><p>Kero Security</p></div></div><svg viewBox={`0 0 ${width} ${height}`} className="line-chart">
    {[0, .25, .5, .75, 1].map(t => <line key={t} x1={padding} x2={width - padding} y1={padding + t * (height - padding * 2)} y2={padding + t * (height - padding * 2)} />)}
    <path className="line profiles" d={pathFor("profiles")} />
    <path className="line matches" d={pathFor("matches")} />
    <path className="line reports" d={pathFor("reports")} />
    {data.map((d, i) => <g key={d.day}><text x={xFor(i)} y={height - 6} textAnchor="middle">{d.day}</text><circle cx={xFor(i)} cy={yFor(d.profiles)} r="4" /></g>)}
  </svg><div className="chart-legend"><span className="profiles">Hồ sơ</span><span className="matches">Match</span><span className="reports">Report</span></div></section>;
}

function AdminDashboard() {
  const { t } = useLanguage();
  const [payload, setPayload] = useState(null);
  useEffect(() => { api.get("/admin/dashboard").then(r => setPayload(r.data)).catch(console.error); }, []);
  const stats = payload?.stats || {};
  const cards = [
    [t("admin.totalUsers"), stats.users || 0, <Users/>],
    [t("admin.publicProfiles"), stats.profiles || 0, <Heart/>],
    [t("admin.matches"), stats.activeMatches || 0, <Heart/>],
    [t("admin.reports"), stats.pendingReports || 0, <Flag/>],
    ["Bị khóa", stats.bannedUsers || 0, <ShieldAlert/>],
    ["Điểm an toàn", `${stats.securityScore || 0}%`, <ShieldCheck/>]
  ];

  return <div className="admin-dashboard"><div className="admin-grid">{cards.map(([l, v, i]) => <StatCard key={l} label={l} value={v} icon={i} />)}</div><div className="chart-grid"><GenderBars data={payload?.genderDistribution || []} /><ActivityLine data={payload?.activityTrend || []} /></div><section className="security-panel"><h2>Kero Security checklist</h2><div className="security-list"><span><ShieldCheck/> Cookie httpOnly cho JWT</span><span><LockKeyhole/> Không lộ email/ngày sinh/vị trí chính xác ở discover</span><span><Flag/> Report/block/unmatch có sẵn</span><span><ImagePlus/> Hồ sơ public cần 3–10 ảnh</span><span><Heart/> Không giới hạn lượt quẹt theo ngày</span></div></section></div>;
}

function AdminUsers() {
  const [users, setUsers] = useState([]);
  async function load() { const { data } = await api.get("/admin/users"); setUsers(data.users); }
  useEffect(() => { load(); }, []);
  async function status(id, s) { await api.patch(`/admin/users/${id}/status`, { status: s }); load(); }
  return <section className="admin-table-card"><h2>Quản lý người dùng</h2><p>Admin được xem email để hỗ trợ, còn public API không trả email cho người dùng khác.</p><table><thead><tr><th>Tên</th><th>Email</th><th>Role</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td><span className={`status ${u.status}`}>{u.status}</span></td><td><button onClick={() => status(u.id, "active")}>Mở</button><button onClick={() => status(u.id, "disabled")}>Vô hiệu hóa</button><button onClick={() => status(u.id, "banned")}>Khóa</button></td></tr>)}</tbody></table></section>;
}

function AdminReports() {
  const [reports, setReports] = useState([]);
  async function load() { const { data } = await api.get("/admin/reports"); setReports(data.reports); }
  useEffect(() => { load(); }, []);
  async function upd(id, s) { await api.patch(`/admin/reports/${id}`, { status: s, adminNote: `Updated ${s}` }); load(); }
  return <section className="admin-table-card"><h2>Báo cáo vi phạm</h2><table><thead><tr><th>Reporter</th><th>Reported</th><th>Lý do</th><th>Status</th><th>Xử lý</th></tr></thead><tbody>{reports.map(r => <tr key={r._id}><td>{r.reporter?.name}</td><td>{r.reportedUser?.name}</td><td>{r.reason}</td><td><span className={`status ${r.status}`}>{r.status}</span></td><td><button onClick={() => upd(r._id, "reviewing")}>Đang xem</button><button onClick={() => upd(r._id, "resolved")}>Xong</button><button onClick={() => upd(r._id, "dismissed")}>Bỏ qua</button></td></tr>)}</tbody></table></section>;
}

function AdminInterests() {
  const [interests, setInterests] = useState([]);
  const [form, setForm] = useState({ name: "", icon: "✨" });
  async function load() { const { data } = await api.get("/admin/interests"); setInterests(data.interests); }
  useEffect(() => { load(); }, []);
  async function submit(e) { e.preventDefault(); await api.post("/admin/interests", form); setForm({ name: "", icon: "✨" }); load(); }
  async function toggle(i) { await api.patch(`/admin/interests/${i._id}`, { isActive: !i.isActive }); load(); }
  return <section className="admin-table-card"><h2>Quản lý sở thích mặc định</h2><p>User vẫn có thể tự thêm sở thích riêng trong hồ sơ. Admin chỉ quản lý danh sách gợi ý mặc định.</p><form className="inline-form" onSubmit={submit}><input placeholder="Tên sở thích" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} /><button className="primary-btn">Thêm</button></form><div className="interest-admin-list">{interests.map(i => <button key={i._id} type="button" onClick={() => toggle(i)} className={i.isActive ? "active" : ""}>{i.icon} {i.name}</button>)}</div></section>;
}

function AppInner() {
  return <>
    <IntroSplash />
    <Navbar/><Routes><Route path="/" element={<Home/>}/><Route path="/login" element={<Login/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password/:token" element={<ResetPassword/>}/><Route element={<Protected/>}><Route path="/onboarding" element={<Onboarding/>}/><Route path="/profile" element={<Onboarding/>}/></Route><Route element={<Protected completed/>}><Route path="/discover" element={<Discover/>}/><Route path="/swipes" element={<Swipes/>}/><Route path="/matches" element={<Matches/>}/><Route path="/chat/:matchId" element={<Chat/>}/></Route><Route element={<AdminOnly/>}><Route path="/admin" element={<AdminLayout/>}><Route index element={<AdminDashboard/>}/><Route path="users" element={<AdminUsers/>}/><Route path="reports" element={<AdminReports/>}/><Route path="interests" element={<AdminInterests/>}/></Route></Route></Routes>
  </>;
}

export default function App() { return <LanguageProvider><AuthProvider><AppInner/></AuthProvider></LanguageProvider>; }
