const Workspace = require("../models/Workspace");

exports.createWorkspace = async (req, res) => {
  try {
    const { name, description, background, isPublic } = req.body;
    const workspace = await Workspace.create({
      name,
      description,
      background,
      isPublic,
      owner: req.user.id,
      members: [req.user.id]
    });
    res.status(201).json(workspace);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tạo workspace", error });
  }
};

exports.getWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      members: req.user.id
    }).populate("owner", "email fullName");
    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy workspace" });
  }
};

exports.getWorkspaceById = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id).populate(
      "members",
      "email fullName"
    );

    if (!workspace) {
      return res.status(404).json({ message: "Không tìm thấy workspace" });
    }

    res.json(workspace);
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy chi tiết workspace" });
  }
};

exports.updateWorkspace = async (req, res) => {
  try {
    const { name, description, background, isPublic } = req.body;
    const workspace = await Workspace.findById(req.params.id);

    if (!workspace || workspace.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền cập nhật" });
    }

    if ('name' in req.body) workspace.name = name;
    if ('description' in req.body) workspace.description = description;
    if ('background' in req.body) workspace.background = background;
    if ('isPublic' in req.body) workspace.isPublic = isPublic;


    await workspace.save();
    res.json(workspace);
  } catch (error) {
    res.status(500).json({ message: "Lỗi cập nhật workspace" });
  }
};

exports.deleteWorkspace = async (req, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace || workspace.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền xóa" });
    }

    await workspace.deleteOne();
    res.json({ message: "Đã xóa workspace" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xóa workspace" });
  }
};
