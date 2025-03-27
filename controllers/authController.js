const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendOTP = require("../utils/sendOTP");

// Đăng ký tài khoản & gửi OTP
const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    let user = await User.findOne({ email });

    if (user) return res.status(400).json({ message: "Email đã tồn tại" });

    // Hash password trước khi lưu
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000); // Tạo mã OTP 6 số
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // Hết hạn sau 5 phút

    // Lưu User với OTP
    user = new User({ email, password: hashedPassword, otp, otpExpires });
    await user.save();

    // Gửi OTP qua email
    await sendOTP(email, otp);

    res.status(201).json({ message: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận OTP." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// Xác thực OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp || user.otpExpires < new Date()) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    // Cập nhật tài khoản đã xác thực
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Xác thực OTP thành công! Bạn có thể đăng nhập ngay bây giờ." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// Đăng nhập (chỉ cho phép tài khoản đã xác thực)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.isVerified) {
      return res.status(400).json({ message: "Email chưa được xác thực hoặc không tồn tại" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Sai email hoặc mật khẩu" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ token, user });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

// Gửi OTP khi quên mật khẩu
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Vui lòng nhập email" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email không tồn tại" });

    // Tạo OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 phút hết hạn
    await user.save();

    // Gửi email OTP
     await sendOTP(email, otp);

    res.status(200).json({ message: "OTP đã gửi qua email" });
  } catch (error) {
    console.error("Lỗi server:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

//  Xác minh OTP và cập nhật mật khẩu mới
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "Email không tồn tại" });
    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }

    // Cập nhật mật khẩu mới
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({ message: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = { register, verifyOTP, login, forgotPassword, resetPassword };
