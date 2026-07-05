import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "kero_language";

export const translations = {
  vi: {
    nav: {
      howItWorks: "Cách hoạt động",
      safety: "An toàn",
      discover: "Khám phá",
      swipes: "Đã thích bạn",
      matches: "Kết nối",
      profile: "Hồ sơ",
      login: "Đăng nhập",
      logout: "Đăng xuất",
      createAccount: "Tạo tài khoản"
    },
    landing: {
      title: "Hẹn hò, kết bạn & gặp gỡ người mới.",
      subtitle: "Bắt đầu hành trình kết nối an toàn với Kero Dating.",
      guide: "Hướng dẫn",
      guideTitle: "Kero Dating hoạt động thế nào?",
      previewTitle: "Xem trước khi chọn",
      previewBody: "Bấm vào hồ sơ để xem ảnh, bio, mục tiêu và sở thích trước khi Like hoặc Pass.",
      photosTitle: "Ảnh hồ sơ 3-10 tấm",
      photosBody: "Chọn ảnh từ máy, xem preview, xóa ảnh thừa và sắp xếp thứ tự trước khi đăng.",
      securityBody: "Kero chỉ hiển thị dữ liệu công khai: nickname, tuổi, thành phố, bio, ảnh, sở thích. Không lộ email, ngày sinh gốc hoặc vị trí chính xác."
    },
    auth: {
      welcomeBack: "Welcome back",
      create: "Create account",
      login: "Đăng nhập",
      signup: "Đăng ký",
      email: "Email",
      password: "Mật khẩu",
      name: "Tên",
      birthday: "Ngày sinh",
      gender: "Giới tính",
      forgot: "Quên mật khẩu?",
      noAccount: "Chưa có tài khoản?",
      backToLogin: "Quay lại đăng nhập",
      registerNote: "Chỉ dành cho người từ 18 tuổi trở lên. Email không hiển thị công khai."
    },
    forgot: {
      title: "Quên mật khẩu",
      description: "Nhập email để nhận hướng dẫn đặt lại mật khẩu.",
      send: "Gửi hướng dẫn",
      generic: "Nếu email tồn tại trong hệ thống, Kero đã gửi hướng dẫn đặt lại mật khẩu.",
      resetTitle: "Đặt lại mật khẩu",
      resetDescription: "Hãy tạo mật khẩu mới ít nhất 8 ký tự. Link chỉ dùng được một lần.",
      newPassword: "Mật khẩu mới",
      confirmPassword: "Nhập lại mật khẩu",
      changePassword: "Đổi mật khẩu",
      success: "Đổi mật khẩu thành công."
    },
    discover: {
      title: "Khám phá người phù hợp",
      subtitle: "Bấm vào hồ sơ để xem chi tiết. Like hoặc Pass sẽ xử lý ngay.",
      tapHint: "Bấm vào hồ sơ để xem chi tiết",
      pass: "Bỏ qua",
      like: "Thích",
      undo: "Trở lại",
      reload: "Tải lại",
      emptyTitle: "Không còn hồ sơ phù hợp",
      emptyBody: "Hiện chưa còn hồ sơ phù hợp. Hãy thử cập nhật sở thích hoặc quay lại sau.",
      viewProfile: "Xem hồ sơ",
      compatible: "phù hợp",
      compatibility: "độ phù hợp"
    },
    profile: {
      myProfile: "Hồ sơ của tôi",
      photos: "Ảnh hồ sơ",
      photoRule: "Tối thiểu 3 ảnh, tối đa 10 ảnh",
      choosePhotos: "Chọn ảnh",
      preview: "Xem trước trước khi đăng",
      interests: "Sở thích",
      addInterest: "Thêm sở thích",
      goal: "Mục tiêu",
      customGoal: "Thêm mục tiêu riêng",
      save: "Lưu hồ sơ",
      city: "Thành phố",
      age: "Tuổi",
      bio: "Tiểu sử",
      other: "Khác",
      completed: "hoàn tất"
    },
    matches: {
      likedYou: "Người đã thích bạn",
      likeBack: "Like lại & kết nối",
      matches: "Kết nối",
      chat: "Trò chuyện",
      message: "Nhắn tin",
      none: "Chưa có kết nối",
      openChat: "Mở chat",
      unmatch: "Hủy kết nối",
      continue: "Tiếp tục"
    },
    admin: {
      security: "Kero Security",
      dashboard: "Trang quản trị admin",
      totalUsers: "Tổng người dùng",
      publicProfiles: "Hồ sơ công khai",
      matches: "Lượt kết nối",
      reports: "Báo cáo",
      genderChart: "Biểu đồ giới tính",
      activity7d: "Hoạt động 7 ngày",
      users: "Quản lý người dùng",
      reportManagement: "Quản lý báo cáo",
      interests: "Quản lý sở thích",
      actions: "Thao tác"
    },
    errors: {
      INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
      PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ.",
      PUBLIC_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ công khai của người này.",
      TOO_MANY_REQUESTS: "Thao tác đăng nhập/đăng ký quá nhiều. Vui lòng thử lại sau.",
      MISSING_TARGET_USER_ID: "Thiếu targetUserId.",
      PASSWORD_RESET_SUCCESS: "Đổi mật khẩu thành công.",
      RESET_LINK_INVALID: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
      GENERIC: "Có lỗi xảy ra."
    }
  },
  en: {
    nav: {
      howItWorks: "How it works",
      safety: "Safety",
      discover: "Discover",
      swipes: "Liked you",
      matches: "Matches",
      profile: "Profile",
      login: "Log in",
      logout: "Log out",
      createAccount: "Create account"
    },
    landing: {
      title: "Date, make friends & meet new people.",
      subtitle: "Start safe and meaningful connections with Kero Dating.",
      guide: "Guide",
      guideTitle: "How does Kero Dating work?",
      previewTitle: "Preview before choosing",
      previewBody: "Tap a profile to view photos, bio, goals and interests before you Like or Pass.",
      photosTitle: "Profile photos 3-10 images",
      photosBody: "Choose photos from your device, preview them, remove extras and reorder before publishing.",
      securityBody: "Kero only shows public data: nickname, age, city, bio, photos and interests. Email, full birthday and exact location stay private."
    },
    auth: {
      welcomeBack: "Welcome back",
      create: "Create account",
      login: "Log in",
      signup: "Sign up",
      email: "Email",
      password: "Password",
      name: "Name",
      birthday: "Birthday",
      gender: "Gender",
      forgot: "Forgot password?",
      noAccount: "Don't have an account?",
      backToLogin: "Back to log in",
      registerNote: "For adults 18+ only. Your email is never shown publicly."
    },
    forgot: {
      title: "Forgot password",
      description: "Enter your email to receive password reset instructions.",
      send: "Send instructions",
      generic: "If the email exists, Kero has sent password reset instructions.",
      resetTitle: "Reset password",
      resetDescription: "Create a new password with at least 8 characters. The link can only be used once.",
      newPassword: "New password",
      confirmPassword: "Confirm password",
      changePassword: "Change password",
      success: "Password changed successfully."
    },
    discover: {
      title: "Discover compatible people",
      subtitle: "Tap a profile to view details. Like or Pass will be applied immediately.",
      tapHint: "Tap a profile to view details",
      pass: "Pass",
      like: "Like",
      undo: "Undo",
      reload: "Reload",
      emptyTitle: "No more compatible profiles",
      emptyBody: "There are no compatible profiles right now. Try updating your interests or come back later.",
      viewProfile: "View profile",
      compatible: "compatible",
      compatibility: "compatibility"
    },
    profile: {
      myProfile: "My profile",
      photos: "Profile photos",
      photoRule: "Minimum 3 photos, maximum 10 photos",
      choosePhotos: "Choose photos",
      preview: "Preview before publishing",
      interests: "Interests",
      addInterest: "Add interest",
      goal: "Goal",
      customGoal: "Add custom goal",
      save: "Save profile",
      city: "City",
      age: "Age",
      bio: "Bio",
      other: "Other",
      completed: "complete"
    },
    matches: {
      likedYou: "People who liked you",
      likeBack: "Like back & connect",
      matches: "Matches",
      chat: "Chat",
      message: "Message",
      none: "No matches yet",
      openChat: "Open chat",
      unmatch: "Unmatch",
      continue: "Continue"
    },
    admin: {
      security: "Kero Security",
      dashboard: "Admin dashboard",
      totalUsers: "Total users",
      publicProfiles: "Public profiles",
      matches: "Matches",
      reports: "Reports",
      genderChart: "Gender chart",
      activity7d: "7-day activity",
      users: "User management",
      reportManagement: "Report management",
      interests: "Interest management",
      actions: "Actions"
    },
    errors: {
      INVALID_CREDENTIALS: "Invalid email or password.",
      PROFILE_NOT_FOUND: "Profile not found.",
      PUBLIC_PROFILE_NOT_FOUND: "This public profile could not be found.",
      TOO_MANY_REQUESTS: "Too many login/sign-up attempts. Please try again later.",
      MISSING_TARGET_USER_ID: "Missing targetUserId.",
      PASSWORD_RESET_SUCCESS: "Password changed successfully.",
      RESET_LINK_INVALID: "The password reset link is invalid or has expired.",
      GENERIC: "Something went wrong."
    }
  }
};

const LanguageContext = createContext(null);

function lookup(dictionary, key) {
  return key.split(".").reduce((value, part) => value?.[part], dictionary);
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "vi";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage(languageCode) {
      setLanguageState(languageCode === "en" ? "en" : "vi");
    },
    toggleLanguage() {
      setLanguageState(current => current === "vi" ? "en" : "vi");
    },
    t(key) {
      return lookup(translations[language], key) || lookup(translations.vi, key) || key;
    }
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
