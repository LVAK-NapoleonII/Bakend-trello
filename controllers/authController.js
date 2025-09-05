// controllers/authController.js
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Board = require("../models/Board");
const sendOTP = require("../utils/sendOTP");

const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin" });
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

    await sendOTP(email, otp);

    res.status(201).json({ message: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận OTP." });
  } catch (error) {
    console.error("Register error:", error.message);
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
    console.error("Verify OTP error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isVerified) {
      return res.status(400).json({ message: "Email chưa được xác thực hoặc không tồn tại" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ message: "Sai email hoặc mật khẩu" });

    user.isOnline = true;
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "30d" });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("user-status-changed", { userId: user._id, isOnline: true });
    }

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
        isOnline: user.isOnline,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("_id fullName email avatar isOnline");
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });

    res.status(200).json({ user });
  } catch (error) {
    console.error("Get profile error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ message: "Không có refresh token" });

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: "Người dùng không tồn tại" });

    const newToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.status(200).json({ token: newToken });
  } catch (error) {
    console.error("Refresh token error:", error.message);
    res.status(401).json({ message: "Refresh token không hợp lệ" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Vui lòng nhập email" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email không tồn tại" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await sendOTP(email, otp);

    res.status(200).json({ message: "OTP đã gửi qua email" });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, và mật khẩu mới là bắt buộc" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email không tồn tại" });

    if (user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(401).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const updateAvatar = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "Vui lòng upload file avatar" });

    const avatarUrl = `/Uploads/${file.filename}`;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });

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
    console.error("Update avatar error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const logout = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (user) {
      user.isOnline = false;
      await user.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("user-status-changed", { userId, isOnline: false });
    }

    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("Logout error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { query, boardId, onlyActiveMembers } = req.query;
    console.log("SearchUsers called with:", { query, boardId, onlyActiveMembers, userId: req.user._id });

    if (onlyActiveMembers === "true" && boardId) {
      if (!mongoose.Types.ObjectId.isValid(boardId)) {
        return res.status(400).json({ message: "boardId không hợp lệ!" });
      }

      const board = await Board.findById(boardId).populate(
        "members.user",
        "_id email fullName avatar isOnline"
      );
      console.log("Board:", board);
      if (!board) {
        return res.status(404).json({ message: "Bảng không tồn tại!" });
      }

      // Kiểm tra cả owner và members
      const isOwner = board.owner.toString() === req.user._id.toString();
      const isMember = board.members.some(
        (m) => m.user.toString() === req.user._id.toString() && m.isActive
      );
      if (!isOwner && !isMember) {
        console.log("Access denied - User is neither owner nor active member");
        return res.status(403).json({ message: "Bạn không có quyền truy cập bảng này!" });
      }

      const users = board.members
        .filter((m) => m.isActive)
        .map((m) => ({
          ...m.user.toObject(),
          isPastMember: false,
        }));

      return res.status(200).json({ users });
    }

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
        return res.status(400).json({ message: "boardId không hợp lệ!" });
      }

      const board = await Board.findById(boardId);
      if (!board) {
        return res.status(404).json({ message: "Bảng không tồn tại!" });
      }

      const isOwner = board.owner.toString() === req.user._id.toString();
      const isMember = board.members.some(
        (m) => m.user.toString() === req.user._id.toString() && m.isActive
      );
      if (!isOwner && !isMember) {
        console.log("Access denied - User is neither owner nor active member");
        return res.status(403).json({ message: "Bạn không có quyền truy cập bảng này!" });
      }

      pastMembers = board.members
        .filter((m) => !m.isActive)
        .map((m) => m.user.toString());
    }

    const enrichedUsers = users.map((user) => ({
      ...user.toObject(),
      isPastMember: pastMembers.includes(user._id.toString()),
    }));

    res.status(200).json({ users: enrichedUsers });
  } catch (error) {
    console.error("Search users error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = {
  register,
  verifyOTP,
  login,
  getProfile,
  refreshToken,
  forgotPassword,
  resetPassword,
  updateAvatar,
  logout,
  searchUsers,
};