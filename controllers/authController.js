const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const sendOTP = require("../utils/sendOTP");
const nodemailer = require("nodemailer");
const Board = require("../models/Board"); // Import Board model

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "30d" });
};

const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const missingFields = [];
    if (!fullName) missingFields.push("fullName");
    if (!email) missingFields.push("email");
    if (!password) missingFields.push("password");

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Vui lòng nhập đầy đủ các trường: ${missingFields.join(", ")}!`,
      });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email đã tồn tại" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user = new User({
      fullName,
      email,
      password,
      otp,
      otpExpires,
      avatar: avatarUrl,
      isOnline: false,
    });
    await user.save();

    try {
      await sendOTP(email, otp);
      console.log("Register: OTP sent to:", email);
    } catch (emailError) {
      await User.deleteOne({ email });
      console.error("Register: Failed to send OTP:", emailError.message);
      return res.status(500).json({ message: "Không thể gửi OTP, vui lòng thử lại sau" });
    }

    res.status(201).json({ message: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận OTP." });
  } catch (error) {
    console.error("Register: Error:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Xác thực OTP thành công! Bạn có thể đăng nhập ngay bây giờ." });
  } catch (error) {
    console.error("VerifyOTP: Error:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const login = async (req, res, io) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", { email });

    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found for email:", email);
      return res.status(400).json({ message: "Email chưa được xác thực hoặc không tồn tại" });
    }

    if (!user.isVerified) {
      console.log("User not verified:", email);
      return res.status(400).json({ message: "Email chưa được xác thực hoặc không tồn tại" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password match:", isMatch);
    if (!isMatch) return res.status(400).json({ message: "Sai email hoặc mật khẩu" });

    user.isOnline = true;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    const refreshToken = generateRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    io.emit("user-status-changed", {
      userId: user._id,
      isOnline: true,
    });

    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
    };
    console.log("Login response user data:", userData);

    res.status(200).json({
      token,
      user: userData,
    });
  } catch (error) {
    console.error("Login: Error:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("_id fullName email avatar isOnline");
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    const userData = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      isOnline: user.isOnline,
    };
    console.log("Profile response user data:", userData);

    res.status(200).json({ user: userData });
  } catch (error) {
    console.error("GetProfile: Error:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "Không có refresh token" });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Người dùng không tồn tại" });
    }

    const newToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.status(200).json({ token: newToken });
  } catch (error) {
    console.error("RefreshToken: Error:", error.message, error.stack);
    res.status(401).json({ message: "Refresh token không hợp lệ" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("ForgotPassword: Request:", { email });

    if (!email) return res.status(400).json({ message: "Vui lòng nhập email" });

    const user = await User.findOne({ email });
    if (!user) {
      console.log("ForgotPassword: Email not found:", email);
      return res.status(400).json({ message: "Email không tồn tại" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    console.log("ForgotPassword: Generated OTP:", otp, "for:", email, "Expires:", user.otpExpires);

    try {
      await sendOTP(email, otp);
      console.log("ForgotPassword: OTP sent to:", email);
    } catch (emailError) {
      console.error("ForgotPassword: Failed to send OTP:", emailError.message);
      user.otp = null;
      user.otpExpires = null;
      await user.save();
      return res.status(500).json({ message: "Không thể gửi OTP, vui lòng thử lại sau" });
    }

    res.status(200).json({ message: "OTP đã gửi qua email" });
  } catch (error) {
    console.error("ForgotPassword: Error:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    console.log("ResetPassword: Request:", { email, otp });

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, và mật khẩu mới là bắt buộc" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("ResetPassword: Email not found:", email);
      return res.status(400).json({ message: "Email không tồn tại" });
    }

    const currentTime = new Date();
    console.log("ResetPassword: Stored OTP:", user.otp, "Received OTP:", otp, "Expires:", user.otpExpires, "Current Time:", currentTime);
    if (!user.otp || String(user.otp) !== String(otp) || user.otpExpires < currentTime) {
      return res.status(401).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { email },
      {
        $set: {
          password: hashedPassword,
          otp: null,
          otpExpires: null,
        },
      }
    );

    console.log("ResetPassword: Password updated for:", email);
    res.status(200).json({ message: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    console.error("ResetPassword: Error:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const updateAvatar = async (req, res) => {
  try {
    const userId = req.user._id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Vui lòng upload file avatar" });
    }

    const avatarUrl = `/Uploads/${file.filename}`;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    user.avatar = avatarUrl;
    await user.save();

    res.status(200).json({
      message: "Cập nhật avatar thành công",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        isOnline: user.isOnline,
      },
    });
  } catch (error) {
    console.error("UpdateAvatar: Error:", error.message, error.stack);
    if (error.code === "ENOENT") {
      return res.status(500).json({ message: "Thư mục uploads không tồn tại hoặc không có quyền ghi" });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
};

const logout = async (req, res, io) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (user) {
      user.isOnline = false;
      await user.save();
    }

    io.emit("user-status-changed", {
      userId: userId,
      isOnline: false,
    });

    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("Logout: Error:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { query, boardId } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Query là bắt buộc!" });
    }

    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: "i" } },
        { fullName: { $regex: query, $options: "i" } },
      ],
    }).select("_id email fullName avatar isOnline");

    let pastMembers = [];
    if (boardId) {
      if (!mongoose.Types.ObjectId.isValid(boardId)) {
        console.warn("SearchUsers: Invalid boardId:", boardId);
        return res.status(400).json({ message: "boardId không hợp lệ!" });
      }

      const board = await Board.findById(boardId);
      if (!board) {
        console.warn("SearchUsers: Board not found for boardId:", boardId);
        return res.status(404).json({ message: "Bảng không tồn tại!" });
      }

      // Kiểm tra quyền truy cập
      const userId = req.user._id.toString();
      const isMember = board.members.some(
        (m) => m.user && m.user.toString() === userId && m.isActive
      );
      if (!isMember) {
        console.warn("SearchUsers: User not authorized for board:", { userId, boardId });
        return res.status(403).json({ message: "Bạn không có quyền truy cập bảng này!" });
      }

      pastMembers = board.members
        .filter((m) => m.user && !m.isActive)
        .map((m) => m.user.toString());
    }

    const enrichedUsers = users.map((user) => ({
      ...user.toObject(),
      isPastMember: pastMembers.includes(user._id.toString()),
    }));

    console.log("SearchUsers: Success", { query, boardId, userCount: enrichedUsers.length });
    res.status(200).json({ users: enrichedUsers });
  } catch (err) {
    console.error("SearchUsers: Error:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

module.exports = {
  register,
  verifyOTP,
  login,
  getProfile,
  forgotPassword,
  resetPassword,
  updateAvatar,
  refreshToken,
  logout,
  searchUsers,
};