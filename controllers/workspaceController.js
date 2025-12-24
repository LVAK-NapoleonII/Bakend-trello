const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

const createWorkspace = async (req, res) => {
  try {
    const { name, description, background, isPublic } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!name) return res.status(400).json({ message: "Tên workspace là bắt buộc!" });

    const workspace = await Workspace.create({
      name,
      description: description || "",
      background: background || "#ffffff",
      isPublic: isPublic || false,
      owner: userId,
      members: [userId],
      isDeleted: false,
    });

    const activity = new Activity({
      user: userId,
      action: { category: "workspace", type: "created" },
      target: workspace._id,
      targetModel: "Workspace",
      details: `User ${req.user.fullName} tạo không gian làm việc "${name}"`,
    });
    await activity.save();
    workspace.activities.push(activity._id);
    await workspace.save();

    const io = req.app.get("io");
    if (io) {
      workspace.members.forEach((memberId) =>
        io.to(memberId.toString()).emit("workspace-created", {
          workspace,
          message: `Workspace "${name}" đã được tạo bởi ${req.user.fullName}`,
        })
      );
    }

    res.status(201).json(workspace);
  } catch (error) {
    console.error("createWorkspace error:", error.message);
    res.status(500).json({ message: "Lỗi tạo workspace", error: error.message });
  }
};

const getWorkspaces = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    const workspaces = await Workspace.find({
      members: userId,
      isDeleted: false,
    })
      .populate("owner", "email fullName avatar")
      .populate("activities")
      .lean(); // Use lean() for better performance

    res.status(200).json(workspaces);
  } catch (error) {
    console.error("getWorkspaces error:", error.message);
    res.status(500).json({ message: "Lỗi lấy danh sách workspace", error: error.message });
  }
};

const getWorkspaceById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Workspace ID không hợp lệ!" });

    const workspace = await Workspace.findOne({ _id: id, isDeleted: false })
      .populate("owner", "email fullName avatar")
      .populate("members", "email fullName avatar")
      .populate("activities")
      .lean();

    if (!workspace) return res.status(404).json({ message: "Không tìm thấy workspace!" });

    const isMember = workspace.members.some((member) => member._id.toString() === userId.toString());
    if (!isMember && !workspace.isPublic) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập workspace này!" });
    }

    res.status(200).json(workspace);
  } catch (error) {
    console.error("getWorkspaceById error:", error.message);
    res.status(500).json({ message: "Lỗi lấy chi tiết workspace", error: error.message });
  }
};

const updateWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, background, isPublic } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Workspace ID không hợp lệ!" });

    const workspace = await Workspace.findOne({ _id: id, isDeleted: false });
    if (!workspace) return res.status(404).json({ message: "Không tìm thấy workspace!" });
    if (workspace.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Chỉ owner mới có quyền cập nhật workspace!" });
    }

    if (name) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (background) workspace.background = background;
    if (isPublic !== undefined) workspace.isPublic = isPublic;

    const activity = new Activity({
      user: userId,
      action: { category: "workspace", type: "updated" },
      target: workspace._id,
      targetModel: "Workspace",
      details: `User ${req.user.fullName} cập nhật không gian làm việc "${workspace.name}"`,
    });
    await activity.save();
    workspace.activities.push(activity._id);
    await workspace.save();

    const io = req.app.get("io");
    if (io) {
      const notificationPromises = workspace.members
        .filter((memberId) => memberId.toString() !== userId.toString())
        .map((memberId) => {
          const notification = new Notification({
            user: memberId,
            message: `${req.user.fullName} đã cập nhật workspace "${workspace.name}"`,
            type: "activity",
            target: workspace._id,
            targetModel: "Workspace",
            isRead: false,
            isHidden: false,
          });
          return notification.save().then(() => io.to(memberId.toString()).emit("new-notification", notification));
        });
      await Promise.all(notificationPromises);

      io.to(workspace._id.toString()).emit("workspace-updated", {
        workspace,
        message: `Workspace "${workspace.name}" đã được cập nhật bởi ${req.user.fullName}`,
      });
    }

    res.status(200).json(workspace);
  } catch (error) {
    console.error("updateWorkspace error:", error.message);
    res.status(500).json({ message: "Lỗi cập nhật workspace", error: error.message });
  }
};

const deleteWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Workspace ID không hợp lệ!" });

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: "Không tìm thấy workspace!" });
    if (workspace.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Chỉ owner mới có quyền ẩn workspace!" });
    }

    workspace.isDeleted = true;
    const activity = new Activity({
      user: userId,
      action: { category: "workspace", type: "deleted" },
      target: workspace._id,
      targetModel: "Workspace",
      details: `User ${req.user.fullName} Xóa không gian làm việc "${workspace.name}"`,
    });
    await activity.save();
    workspace.activities.push(activity._id);
    await workspace.save();

    const io = req.app.get("io");
    if (io) {
      workspace.members.forEach((memberId) =>
        io.to(memberId.toString()).emit("workspace-hidden", {
          workspaceId: id,
          message: `Không gian làm việc "${workspace.name}" đã bị ẩn bởi ${req.user.fullName}`,
        })
      );
    }

    res.status(200).json({ message: "Đã ẩn workspace" });
  } catch (error) {
    console.error("deleteWorkspace error:", error.message);
    res.status(500).json({ message: "Lỗi ẩn workspace", error: error.message });
  }
};

const getDeletedWorkspaces = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    const workspaces = await Workspace.find({
      owner: userId,
      isDeleted: true,
    })
      .populate("owner", "email fullName avatar")
      .populate("activities")
      .lean();

    res.status(200).json(workspaces);
  } catch (error) {
    console.error("getDeletedWorkspaces error:", error.message);
    res.status(500).json({ message: "Lỗi lấy danh sách workspace bị xóa", error: error.message });
  }
};

const restoreWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    console.log("Restoring workspace:", { id, userId });

    if (!userId) {
      console.log("Missing user info");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log("Invalid workspace ID:", id);
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      console.log("Workspace not found:", id);
      return res.status(404).json({ message: "Không tìm thấy workspace!" });
    }
    if (workspace.owner.toString() !== userId.toString()) {
      console.log("User is not owner:", { userId, owner: workspace.owner });
      return res.status(403).json({ message: "Chỉ owner mới có quyền khôi phục không gian làm việc!" });
    }
    if (!workspace.isDeleted) {
      console.log("Workspace is not deleted:", id);
      return res.status(400).json({ message: "Không gian làm việc này chưa bị xóa!" });
    }

    console.log("Setting workspace isDeleted to false");
    workspace.isDeleted = false;
    const activity = new Activity({
      user: userId,
      action: { category: "workspace", type: "restored" },
      target: workspace._id,
      targetModel: "Workspace",
      details: `User ${req.user.fullName} khôi phục không gian làm việc "${workspace.name}"`,
    });
    await activity.save();
    workspace.activities.push(activity._id);
    await workspace.save();
    console.log("Workspace restored and activity saved:", id);

    const io = req.app.get("io");
    if (io) {
      console.log("Sending Socket.IO notifications");
      const notificationPromises = workspace.members
        .filter((memberId) => memberId.toString() !== userId.toString())
        .map((memberId) => {
          const notification = new Notification({
            user: memberId,
            message: `${req.user.fullName} đã khôi phục workspace "${workspace.name}"`,
            type: "activity",
            target: workspace._id,
            targetModel: "Workspace",
            isRead: false,
            isHidden: false,
          });
          return notification.save().then(() => {
            console.log(`Emitting notification to member: ${memberId}`);
            io.to(memberId.toString()).emit("new-notification", notification);
          });
        });
      await Promise.all(notificationPromises);

      workspace.members.forEach((memberId) => {
        console.log(`Emitting workspace-restored to member: ${memberId}`);
        io.to(memberId.toString()).emit("workspace-restored", {
          workspace,
          message: `Workspace "${workspace.name}" đã được khôi phục bởi ${req.user.fullName}`,
        });
      });
    } else {
      console.warn("Socket.IO not initialized");
    }

    res.status(200).json({ message: "Đã khôi phục Không gian làm việc", workspace });
  } catch (error) {
    console.error("restoreWorkspace error:", error.message, error.stack);
    res.status(500).json({ message: "Lỗi khôi phục không gian làm việc", error: error.message });
  }
};
const leaveWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Workspace ID không hợp lệ!" });

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: "Không tìm thấy không gian làm việc!" });
    if (workspace.owner.toString() === userId.toString()) {
      return res.status(403).json({ message: "Owner không thể rời không gian làm việc!" });
    }

    const isMember = workspace.members.includes(userId);
    if (!isMember) return res.status(403).json({ message: "Bạn không phải thành viên của không gian làm việc này!" });

    workspace.members = workspace.members.filter((member) => member.toString() !== userId.toString());

    const activity = new Activity({
      user: userId,
      action: { category: "workspace", type: "left" },
      target: workspace._id,
      targetModel: "Workspace",
      details: `User ${req.user.fullName} rời không gian làm việc "${workspace.name}"`,
    });
    await activity.save();
    workspace.activities.push(activity._id);

    await workspace.save();

    await Board.updateMany(
      { workspace: id, "members.user": userId },
      { $pull: { members: { user: userId } } }
    );

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("workspace-left", {
        workspaceId: id,
        message: `Bạn đã rời workspace "${workspace.name}"`,
      });

      workspace.members.forEach((memberId) => {
        if (memberId.toString() !== userId.toString()) {
          io.to(memberId.toString()).emit("member-left-workspace", {
            workspaceId: id,
            userId,
            message: `${req.user.fullName} đã rời workspace "${workspace.name}"`,
          });
        }
      });
    }

    res.status(200).json({ message: "Đã rời không gian làm việc thành công" });
  } catch (error) {
    console.error("leaveWorkspace error:", error.message);
    res.status(500).json({ message: "Lỗi rời workspace" });
  }
};

const getPublicWorkspaces = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    const { search } = req.query;
    const query = {
      isPublic: true,
      isDeleted: false,
    };

    if (search) {
      query.name = { $regex: search, $options: "i" }; // Case-insensitive search
    }

    const workspaces = await Workspace.find(query)
      .populate("owner", "email fullName avatar")
      .lean();

    res.status(200).json(workspaces);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy danh sách workspace công khai", error: error.message });
  }
};

const joinWorkspace = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "không gian làm việc ID không hợp lệ!" });

    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ message: "Không tìm thấy không gian làm việc!" });
    if (!workspace.isPublic) return res.status(403).json({ message: "không gian làm việc này không phải công khai!" });
    if (workspace.isDeleted) return res.status(404).json({ message: "không gian làm việc đã bị xóa!" });

    const isMember = workspace.members.includes(userId);
    if (isMember) return res.status(400).json({ message: "Bạn đã là thành viên của không gian làm việc này!" });

    workspace.members.push(userId);
    const activity = new Activity({
      user: userId,
      action: { category: "workspace", type: "joined" },
      target: workspace._id,
      targetModel: "Workspace",
      details: `User ${req.user.fullName} joined workspace "${workspace.name}"`,
    });
    await activity.save();
    workspace.activities.push(activity._id);
    await workspace.save();

    const io = req.app.get("io");
    if (io) {
      io.to(userId.toString()).emit("workspace-joined", {
        workspace,
        message: `Bạn đã tham gia workspace "${workspace.name}"`,
      });

      workspace.members.forEach((memberId) => {
        if (memberId.toString() !== userId.toString()) {
          io.to(memberId.toString()).emit("member-joined-workspace", {
            workspaceId: id,
            userId,
            message: `${req.user.fullName} đã tham gia workspace "${workspace.name}"`,
          });
        }
      });
    }

    res.status(200).json({ message: "Đã tham gia không gian làm việc thành công", workspace });
  } catch (error) {
    res.status(500).json({ message: "Lỗi tham gia không gian làm việc", error: error.message });
  }
};

module.exports = {
  createWorkspace,
  getWorkspaces,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  getDeletedWorkspaces,
  restoreWorkspace,
  leaveWorkspace,
  getPublicWorkspaces,
  joinWorkspace,
};