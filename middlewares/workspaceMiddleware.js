const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");

const workspaceMiddleware = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: "Workspace không tồn tại!" });
    }

    const isMember = workspace.members.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );

    if (!isMember && !workspace.isPublic && req.method !== "POST") {
      return res.status(403).json({ message: "Bạn không có quyền truy cập workspace này!" });
    }

    req.workspace = workspace;
    next();
  } catch (error) {
    console.error("Workspace middleware error:", error);
    return res.status(500).json({ message: "Lỗi xác thực workspace", error: error.message });
  }
};

module.exports = workspaceMiddleware;