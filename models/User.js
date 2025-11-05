const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  isVerified: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false }, // Thêm trường admin
  otp: { type: String },
  otpExpires: { type: Date },
  avatar: { type: String },
  isOnline: { type: Boolean, default: false },
  isHidden: { type: Boolean, default: false },
  lastActive: { type: Date, default: Date.now }, // Theo dõi lần hoạt động cuối
  inactiveNoticeSent: { type: Boolean, default: false }, // Đã gửi thông báo chưa
  scheduledDeletion: { type: Date }, // Thời gian dự kiến xóa
  isBanned: { type: Boolean, default: false },
  banReason: { type: String },
  bannedAt: { type: Date },
  banExpiresAt: { type: Date },
  notifications: [{ type: mongoose.Schema.Types.ObjectId, ref: "Notification" }],
  notificationSettings: {
    dueDateReminders: {
      enabled: { type: Boolean, default: true },
      remindBefore: { type: Number, default: 24 },
    },
  },
  integrations: {
    googleDrive: {
      accessToken: { type: String },
      refreshToken: { type: String },
      expiryDate: { type: Date },
    },
  },
}, { timestamps: true });

// Index để tìm kiếm user không hoạt động
userSchema.index({ lastActive: 1, isHidden: false });
userSchema.index({ isAdmin: 1 });
userSchema.index({ isBanned: 1 });

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method để cập nhật lastActive
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

userSchema.methods.checkBanExpiry = function() {
  if (this.isBanned && this.banExpiresAt && this.banExpiresAt < new Date()) {
    this.isBanned = false;
    this.banReason = null;
    this.bannedAt = null;
    this.banExpiresAt = null;
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model("User", userSchema);