const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendOTP = require("../utils/sendOTP");
const Board = require("../models/Board")

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
      password, // Không hash thủ công, dựa vào schema
      otp,
      otpExpires,
      avatar: avatarUrl,
    });
    await user.save();

    try {
      await sendOTP(email, otp);
    } catch (emailError) {
      await User.deleteOne({ email });
      console.error("Failed to send OTP:", emailError.message);
      return res.status(500).json({ message: "Không thể gửi OTP, vui lòng thử lại sau" });
    }

    res.status(201).json({ message: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận OTP." });
  } catch (error) {
    console.error("Error in register:", error.message);
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
    console.error("Error in verifyOTP:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const login = async (req, res, io) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", { email, password });

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
    console.log("Password match:", isMatch, "Stored hash:", user.password);
    if (!isMatch) return res.status(400).json({ message: "Sai email hoặc mật khẩu" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    const refreshToken = generateRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    io.emit("user-login", user._id);

    res.status(200).json({
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Error in login:", error.message);
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
    console.error("Error in refreshToken:", error.message);
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
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    try {
      await sendOTP(email, otp);
    } catch (emailError) {
      console.error("Failed to send OTP for forgot password:", emailError.message);
      return res.status(500).json({ message: "Không thể gửi OTP, vui lòng thử lại sau" });
    }

    res.status(200).json({ message: "OTP đã gửi qua email" });
  } catch (error) {
    console.error("Error in forgotPassword:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "Email không tồn tại" });
    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    user.password = newPassword; // Không hash thủ công
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({ message: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    console.error("Error in resetPassword:", error.message);
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

    const avatarUrl = `/uploads/${file.filename}`;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    user.avatar = avatarUrl;
    await user.save();

    res.status(200).json({
      message: "Cập nhật avatar thành công",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Error in updateAvatar:", error.message);
    if (error.code === "ENOENT") {
      return res.status(500).json({ message: "Thư mục uploads không tồn tại hoặc không có quyền ghi" });
    }
    res.status(500).json({ message: "Lỗi server" });
  }
};

const logout = async (req, res, io) => {
  try {
    const userId = req.user._id;

    io.emit("user-logout", userId);

    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.error("Error in logout:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};
const searchUsers = async (req, res) => {
  try {
    const { query, boardId } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Query là bắt buộc!" });
    }

    // Tìm kiếm người dùng theo email hoặc tên
    const users = await User.find({
      $or: [
        { email: { $regex: query, $options: "i" } },
        { fullName: { $regex: query, $options: "i" } },
      ],
    }).select("_id email fullName avatar");

    // Nếu có boardId, lấy danh sách người đã rời đi
    let pastMembers = [];
    if (boardId && mongoose.Types.ObjectId.isValid(boardId)) {
      const board = await Board.findById(boardId);
      if (board) {
        pastMembers = board.members
          .filter(m => !m.isActive)
          .map(m => m.user.toString());
      }
    }

    // Gắn cờ để đánh dấu người đã rời
    const enrichedUsers = users.map(user => ({
      ...user.toObject(),
      isPastMember: pastMembers.includes(user._id.toString()),
    }));

    res.status(200).json({ users: enrichedUsers });
  } catch (err) {
    console.error("Error in searchUsers:", err.message);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

module.exports = { register, verifyOTP, login, forgotPassword, resetPassword, updateAvatar, refreshToken, logout, searchUsers };