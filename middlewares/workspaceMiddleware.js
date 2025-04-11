const Workspace = require("../models/Workspace");

const workspaceMiddleware = async (req, res, next) => {
  try {
    const workspaceId = req.params.id;
    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({ message: "Workspace không tồn tại" });
    }

    const isMember = workspace.members.some(
      (memberId) => memberId.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập workspace này" });
    }

    // Gắn workspace vào req để dùng ở controller
    req.workspace = workspace;

    next();
  } catch (error) {
    return res.status(500).json({ message: "Lỗi xác thực workspace" });
  }
};

module.exports = workspaceMiddleware;
