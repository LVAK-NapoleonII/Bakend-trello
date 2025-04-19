const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const User = require("../models/User");

exports.createWorkspace = async (req, res, io) => {
  try {
    const { name, description, background, isPublic } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!name) {
      return res.status(400).json({ message: "Tên workspace là bắt buộc!" });
    }

    const workspace = await Workspace.create({
      name,
      description,
      background: background || "#ffffff",
      isPublic: isPublic || false,
      owner: req.user._id,
      members: [req.user._id],
      isDeleted: false,
    });

    // Phát sự kiện đến tất cả thành viên workspace
    workspace.members.forEach((memberId) => {
      io.to(memberId.toString()).emit("workspace-created", {
        workspace,
        message: `Workspace "${name}" đã được tạo bởi ${req.user.fullName}`,
      });
    });

    res.status(201).json(workspace);
  } catch (error) {
    console.error("Error in createWorkspace:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi tạo workspace", error: error.message });
  }
};

exports.getWorkspaces = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const workspaces = await Workspace.find({
      members: req.user._id,
      isDeleted: false,
    })
      .populate("owner", "email fullName avatar")
      .populate("activities");

    res.status(200).json(workspaces);
  } catch (error) {
    console.error("Error in getWorkspaces:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi lấy danh sách workspace", error: error.message });
  }
};

exports.getWorkspaceById = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    console.log("User ID:", req.user._id.toString(), "Email:", req.user.email);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("Invalid workspace ID:", req.params.id);
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    const workspace = await Workspace.findOne({ _id: req.params.id, isDeleted: false })
      .populate("owner", "email fullName avatar")
      .populate("members", "email fullName avatar")
      .populate("activities");

    if (!workspace) {
      console.log("Workspace not found for ID:", req.params.id);
      return res.status(404).json({ message: "Không tìm thấy workspace!" });
    }

    console.log("Workspace:", {
      id: workspace._id.toString(),
      owner: workspace.owner.toString(),
      members: workspace.members.map((m) => m._id.toString()),
      isPublic: workspace.isPublic,
    });

    // So sánh ObjectId bằng toString()
    const userIdStr = req.user._id.toString();
    const isMember = workspace.members.some((member) => member._id.toString() === userIdStr);
    if (!isMember && !workspace.isPublic) {
      console.log("Access denied for user:", userIdStr, "Members:", workspace.members.map((m) => m._id.toString()));
      return res.status(403).json({ message: "Bạn không có quyền truy cập workspace này!" });
    }

    res.status(200).json(workspace);
  } catch (error) {
    console.error("Error in getWorkspaceById:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi lấy chi tiết workspace", error: error.message });
  }
};

exports.updateWorkspace = async (req, res, io) => {
  try {
    const { name, description, background, isPublic } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    const workspace = await Workspace.findOne({ _id: req.params.id, isDeleted: false });
    if (!workspace) {
      return res.status(404).json({ message: "Không tìm thấy workspace!" });
    }

    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Chỉ owner mới có quyền cập nhật workspace!" });
    }

    if ("name" in req.body) workspace.name = name;
    if ("description" in req.body) workspace.description = description;
    if ("background" in req.body) workspace.background = background;
    if ("isPublic" in req.body) workspace.isPublic = isPublic;

    await workspace.save();

    if (req.activityData) {
      const { action, targetModel, details, userId } = req.activityData;
      if (action === "workspace_updated" && targetModel === "Workspace") {
        const activity = new Activity({
          user: userId,
          action,
          target: workspace._id,
          targetModel,
          details,
        });
        await activity.save();
        console.log("Activity saved:", activity);

        workspace.activities.push(activity._id);
        await workspace.save();
      }
    }

    for (const memberId of workspace.members) {
      if (memberId.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: memberId,
          message: `${req.user.fullName} đã cập nhật workspace "${workspace.name}"`,
          type: "activity",
          target: workspace._id,
          targetModel: "Workspace",
        });
        await notification.save();
        io.to(memberId.toString()).emit("new-notification", notification);
      }
    }

    io.to(workspace._id.toString()).emit("workspace-updated", {
      workspace,
      message: `Workspace "${workspace.name}" đã được cập nhật bởi ${req.user.fullName}`,
    });

    res.status(200).json(workspace);
  } catch (error) {
    console.error("Error in updateWorkspace:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi cập nhật workspace", error: error.message });
  }
};

exports.deleteWorkspace = async (req, res, io) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ message: "Không tìm thấy workspace!" });
    }

    if (workspace.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Chỉ owner mới có quyền ẩn workspace!" });
    }

    // Đánh dấu tất cả board trong workspace là đã xóa
    await Board.updateMany({ workspace: workspace._id }, { $set: { isDeleted: true } });

    workspace.isDeleted = true;
    await workspace.save();

    // Phát sự kiện workspace-hidden đến tất cả thành viên
    workspace.members.forEach((memberId) => {
      io.to(memberId.toString()).emit("workspace-hidden", {
        workspaceId: req.params.id,
        message: `Workspace "${workspace.name}" đã bị ẩn bởi ${req.user.fullName}`,
      });
    });

    res.status(200).json({ message: "Đã ẩn workspace" });
  } catch (error) {
    console.error("Error in deleteWorkspace:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi ẩn workspace", error: error.message });
  }
};