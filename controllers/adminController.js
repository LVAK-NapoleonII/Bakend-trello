const mongoose = require("mongoose");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const sendEmail = require("../utils/sendEmail");

// ============= USER MANAGEMENT =============

// Lấy thống kê tổng quan
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isHidden: false });
    const activeUsers = await User.countDocuments({ isOnline: true, isHidden: false });
    const totalWorkspaces = await Workspace.countDocuments({ isDeleted: false });
    const totalBoards = await Board.countDocuments({ isDeleted: false });
    
    // Users không hoạt động > 90 ngày
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - 90);
    const inactiveUsers = await User.countDocuments({
      lastActive: { $lt: inactiveDate },
      isHidden: false
    });

    res.status(200).json({
      totalUsers,
      activeUsers,
      totalWorkspaces,
      totalBoards,
      inactiveUsers
    });
  } catch (error) {
    console.error("getDashboardStats error:", error.message);
    res.status(500).json({ message: "Lỗi lấy thống kê" });
  }
};

// Lấy danh sách tất cả users
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    
    const query = { isHidden: false };
    
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } }
      ];
    }
    
    if (status === "online") {
      query.isOnline = true;
    } else if (status === "inactive") {
      const inactiveDate = new Date();
      inactiveDate.setDate(inactiveDate.getDate() - 90);
      query.lastActive = { $lt: inactiveDate };
    }

    const users = await User.find(query)
      .select("-password -otp -otpExpires")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("getAllUsers error:", error.message);
    res.status(500).json({ message: "Lỗi lấy danh sách users" });
  }
};

// Lấy chi tiết user
exports.getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "User ID không hợp lệ!" });
    }

    const user = await User.findById(userId)
      .select("-password -otp -otpExpires")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User không tồn tại!" });
    }

    // Lấy thống kê của user
    const workspaces = await Workspace.countDocuments({
      members: userId,
      isDeleted: false
    });

    const boards = await Board.countDocuments({
      $or: [
        { owner: userId },
        { "members.user": userId, "members.isActive": true }
      ],
      isDeleted: false
    });

    const activities = await Activity.countDocuments({
      user: userId
    });

    res.status(200).json({
      user,
      stats: {
        workspaces,
        boards,
        activities
      }
    });
  } catch (error) {
    console.error("getUserDetails error:", error.message);
    res.status(500).json({ message: "Lỗi lấy thông tin user" });
  }
};

// Cập nhật trạng thái admin
exports.updateAdminStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;
    const adminId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "User ID không hợp lệ!" });
    }

    if (userId === adminId.toString()) {
      return res.status(400).json({ message: "Không thể thay đổi quyền admin của chính mình!" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { isAdmin: isAdmin },
      { new: true }
    ).select("-password -otp -otpExpires");

    if (!user) {
      return res.status(404).json({ message: "User không tồn tại!" });
    }

    const activity = new Activity({
      user: adminId,
      action: { category: "user", type: isAdmin ? "admin_granted" : "admin_revoked" },
      target: user._id,
      targetModel: "User",
      details: `Admin ${req.user.fullName} ${isAdmin ? "granted" : "revoked"} admin rights for ${user.fullName}`
    });
    await activity.save();

    const notification = new Notification({
      user: userId,
      message: isAdmin 
        ? "Bạn đã được cấp quyền admin" 
        : "Quyền admin của bạn đã bị thu hồi",
      type: "general",
      target: user._id,
      targetModel: "User",
      isRead: false,
      isHidden: false
    });
    await notification.save();

    const io = req.app.get("io");
    if (io) {
      io.to(userId).emit("admin-status-changed", { isAdmin });
      io.to(userId).emit("new-notification", notification);
    }

    res.status(200).json({ 
      message: `Đã ${isAdmin ? "cấp" : "thu hồi"} quyền admin`,
      user 
    });
  } catch (error) {
    console.error("updateAdminStatus error:", error.message);
    res.status(500).json({ message: "Lỗi cập nhật quyền admin" });
  }
};

// Xóa user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { permanent = false } = req.body;
    const adminId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "User ID không hợp lệ!" });
    }

    if (userId === adminId.toString()) {
      return res.status(400).json({ message: "Không thể xóa tài khoản của chính mình!" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại!" });
    }

    if (permanent) {
      // Xóa vĩnh viễn - xóa user khỏi tất cả workspaces và boards
      await Workspace.updateMany(
        { members: userId },
        { $pull: { members: userId } }
      );

      await Board.updateMany(
        { "members.user": userId },
        { $pull: { members: { user: userId } } }
      );

      // Chuyển ownership các workspaces/boards sang admin hoặc xóa
      await Workspace.updateMany(
        { owner: userId },
        { $set: { isDeleted: true } }
      );

      await Board.updateMany(
        { owner: userId },
        { $set: { isDeleted: true } }
      );

      await user.deleteOne();

      const activity = new Activity({
        user: adminId,
        action: { category: "user", type: "permanently_deleted" },
        target: userId,
        targetModel: "User",
        details: `Admin ${req.user.fullName} permanently deleted user ${user.fullName}`
      });
      await activity.save();

      res.status(200).json({ message: "Đã xóa vĩnh viễn user" });
    } else {
      // Soft delete
      user.isHidden = true;
      user.isOnline = false;
      await user.save();

      const activity = new Activity({
        user: adminId,
        action: { category: "user", type: "deleted" },
        target: userId,
        targetModel: "User",
        details: `Admin ${req.user.fullName} deleted user ${user.fullName}`
      });
      await activity.save();

      const io = req.app.get("io");
      if (io) {
        io.to(userId).emit("account-deleted", { 
          message: "Tài khoản của bạn đã bị xóa bởi admin" 
        });
      }

      res.status(200).json({ message: "Đã xóa user" });
    }
  } catch (error) {
    console.error("deleteUser error:", error.message);
    res.status(500).json({ message: "Lỗi xóa user" });
  }
};

// Khôi phục user
exports.restoreUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "User ID không hợp lệ!" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại!" });
    }

    if (!user.isHidden) {
      return res.status(400).json({ message: "User chưa bị xóa!" });
    }

    user.isHidden = false;
    user.inactiveNoticeSent = false;
    user.scheduledDeletion = null;
    await user.save();

    const activity = new Activity({
      user: adminId,
      action: { category: "user", type: "restored" },
      target: userId,
      targetModel: "User",
      details: `Admin ${req.user.fullName} restored user ${user.fullName}`
    });
    await activity.save();

    const notification = new Notification({
      user: userId,
      message: "Tài khoản của bạn đã được khôi phục bởi admin",
      type: "general",
      target: user._id,
      targetModel: "User",
      isRead: false,
      isHidden: false
    });
    await notification.save();

    res.status(200).json({ 
      message: "Đã khôi phục user",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (error) {
    console.error("restoreUser error:", error.message);
    res.status(500).json({ message: "Lỗi khôi phục user" });
  }
};

// ============= WORKSPACE MANAGEMENT =============

// Lấy tất cả workspaces
exports.getAllWorkspaces = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const query = { isDeleted: false };
    
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const workspaces = await Workspace.find(query)
      .populate("owner", "email fullName avatar")
      .populate("members", "email fullName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Workspace.countDocuments(query);

    res.status(200).json({
      workspaces,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("getAllWorkspaces error:", error.message);
    res.status(500).json({ message: "Lỗi lấy danh sách workspaces" });
  }
};

// Xóa workspace
exports.deleteWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { permanent = false } = req.body;
    const adminId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: "Workspace không tồn tại!" });
    }

    if (permanent) {
      // Xóa tất cả boards trong workspace
      await Board.updateMany(
        { workspace: workspaceId },
        { $set: { isDeleted: true } }
      );

      await workspace.deleteOne();

      const activity = new Activity({
        user: adminId,
        action: { category: "workspace", type: "permanently_deleted_by_admin" },
        target: workspaceId,
        targetModel: "Workspace",
        details: `Admin ${req.user.fullName} permanently deleted workspace "${workspace.name}"`
      });
      await activity.save();

      res.status(200).json({ message: "Đã xóa vĩnh viễn workspace" });
    } else {
      workspace.isDeleted = true;
      await workspace.save();

      const activity = new Activity({
        user: adminId,
        action: { category: "workspace", type: "deleted_by_admin" },
        target: workspaceId,
        targetModel: "Workspace",
        details: `Admin ${req.user.fullName} deleted workspace "${workspace.name}"`
      });
      await activity.save();

      const io = req.app.get("io");
      if (io) {
        workspace.members.forEach(memberId => {
          io.to(memberId.toString()).emit("workspace-deleted-by-admin", {
            workspaceId,
            message: `Workspace "${workspace.name}" đã bị xóa bởi admin`
          });
        });
      }

      res.status(200).json({ message: "Đã xóa workspace" });
    }
  } catch (error) {
    console.error("deleteWorkspace error:", error.message);
    res.status(500).json({ message: "Lỗi xóa workspace" });
  }
};

// ============= BOARD MANAGEMENT =============

// Lấy tất cả boards
exports.getAllBoards = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    
    const query = { isDeleted: false };
    
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const boards = await Board.find(query)
      .populate("owner", "email fullName avatar")
      .populate("workspace", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Board.countDocuments(query);

    res.status(200).json({
      boards,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("getAllBoards error:", error.message);
    res.status(500).json({ message: "Lỗi lấy danh sách boards" });
  }
};

// ============= INACTIVE USER CLEANUP =============

// Lấy danh sách users không hoạt động
exports.getInactiveUsers = async (req, res) => {
  try {
    const { days = 90 } = req.query;
    
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - parseInt(days));

    const users = await User.find({
      lastActive: { $lt: inactiveDate },
      isHidden: false
    })
    .select("fullName email lastActive inactiveNoticeSent scheduledDeletion")
    .sort({ lastActive: 1 })
    .lean();

    res.status(200).json({ users });
  } catch (error) {
    console.error("getInactiveUsers error:", error.message);
    res.status(500).json({ message: "Lỗi lấy danh sách users không hoạt động" });
  }
};

// Gửi thông báo cho users không hoạt động
exports.sendInactivityNotices = async (req, res) => {
  try {
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - 90);

    const users = await User.find({
      lastActive: { $lt: inactiveDate },
      isHidden: false,
      inactiveNoticeSent: false
    });

    let sentCount = 0;
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 7); // Xóa sau 7 ngày

    for (const user of users) {
      try {
        await sendEmail({
          to: user.email,
          subject: "Thông báo tài khoản không hoạt động",
          html: `
            <h2>Tài khoản của bạn đang không hoạt động</h2>
            <p>Xin chào ${user.fullName},</p>
            <p>Chúng tôi nhận thấy tài khoản của bạn đã không hoạt động trong hơn 90 ngày.</p>
            <p>Nếu bạn không đăng nhập trong vòng 7 ngày tới, tài khoản của bạn sẽ bị xóa vào <strong>${deletionDate.toLocaleDateString('vi-VN')}</strong>.</p>
            <p>Để giữ tài khoản, vui lòng đăng nhập vào hệ thống.</p>
            <p>Trân trọng,<br>Trello Clone Team</p>
          `
        });

        user.inactiveNoticeSent = true;
        user.scheduledDeletion = deletionDate;
        await user.save();
        
        sentCount++;
      } catch (emailError) {
        console.error(`Failed to send email to ${user.email}:`, emailError.message);
      }
    }

    res.status(200).json({ 
      message: `Đã gửi thông báo cho ${sentCount}/${users.length} users` 
    });
  } catch (error) {
    console.error("sendInactivityNotices error:", error.message);
    res.status(500).json({ message: "Lỗi gửi thông báo" });
  }
};

// Xóa users không hoạt động đã được thông báo
exports.deleteInactiveUsers = async (req, res) => {
  try {
    const now = new Date();

    const users = await User.find({
      scheduledDeletion: { $lte: now },
      isHidden: false,
      inactiveNoticeSent: true
    });

    let deletedCount = 0;

    for (const user of users) {
      // Soft delete
      user.isHidden = true;
      user.isOnline = false;
      await user.save();

      // Log activity
      const activity = new Activity({
        user: req.user._id,
        action: { category: "user", type: "auto_deleted_inactive" },
        target: user._id,
        targetModel: "User",
        details: `User ${user.fullName} automatically deleted due to inactivity`
      });
      await activity.save();

      // Gửi email thông báo
      try {
        await sendEmail({
          to: user.email,
          subject: "Tài khoản đã bị xóa do không hoạt động",
          html: `
            <h2>Tài khoản của bạn đã bị xóa</h2>
            <p>Xin chào ${user.fullName},</p>
            <p>Tài khoản của bạn đã bị xóa do không hoạt động trong hơn 90 ngày.</p>
            <p>Nếu bạn muốn khôi phục tài khoản, vui lòng liên hệ với chúng tôi.</p>
            <p>Trân trọng,<br>Trello Clone Team</p>
          `
        });
      } catch (emailError) {
        console.error(`Failed to send deletion email to ${user.email}:`, emailError.message);
      }

      deletedCount++;
    }

    res.status(200).json({ 
      message: `Đã xóa ${deletedCount} users không hoạt động` 
    });
  } catch (error) {
    console.error("deleteInactiveUsers error:", error.message);
    res.status(500).json({ message: "Lỗi xóa users không hoạt động" });
  }
};

// ============= ACTIVITY LOGS =============

// Lấy logs hoạt động của admin
exports.getAdminActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, type } = req.query;
    
    const query = {
      "action.category": { $in: ["user", "workspace", "board"] }
    };

    if (type) {
      query["action.type"] = type;
    }

    const activities = await Activity.find(query)
      .populate("user", "email fullName")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Activity.countDocuments(query);

    res.status(200).json({
      activities,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("getAdminActivityLogs error:", error.message);
    res.status(500).json({ message: "Lỗi lấy activity logs" });
  }
};