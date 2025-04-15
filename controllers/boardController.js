const mongoose = require("mongoose"); 
const Board = require("../models/Board");
const User = require("../models/User");
const Workspace = require("../models/Workspace");

//  Tạo bảng
const createBoard = async (req, res) => {
  try {
    const { title, description, background, visibility, workspace } = req.body;

    // Kiểm tra req.user.id
    if (!req.user || !req.user.id) { 
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    // Kiểm tra title và workspace
    if (!title || !workspace) { 
      return res.status(400).json({ message: "Title và workspace là bắt buộc!" });
    }

    // Kiểm tra workspace có phải ObjectId hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(workspace)) { 
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    const board = await Board.create({
      title,
      description,
      background,
      visibility,
      owner: req.user.id, 
      workspace,
      members: [req.user.id] 
    });

    res.status(201).json(board);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

const getUserBoards = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }
    const boards = await Board.find({ members: req.user.id })
      .populate("workspace", "name")
      .populate("owner", "email fullName");
    res.status(200).json(boards);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

const getBoardById = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate("members", "email avatar")
      .populate("invitedUsers", "email avatar")
      .populate("owner", "email _id"); // Đảm bảo có _id
    if (!board) return res.status(404).json({ message: "Board không tồn tại" });
    res.status(200).json(board);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

const updateBoard = async (req, res) => {
  try {
    const updated = await Board.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Board không tồn tại" }); // ĐÃ SỬA: Thêm kiểm tra
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};


const deleteBoard = async (req, res) => {
  try {
    const board = await Board.findByIdAndDelete(req.params.id);
    if (!board) return res.status(404).json({ message: "Board không tồn tại" }); // ĐÃ SỬA: Thêm kiểm tra
    res.status(200).json({ message: "Xoá bảng thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
// Cập nhật thứ tự cột
const updateColumnOrder = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { columnOrder } = req.body; // Danh sách ID cột theo thứ tự mới

    // Kiểm tra boardId
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    // Kiểm tra columnOrder
    if (!Array.isArray(columnOrder) || columnOrder.length === 0) {
      return res.status(400).json({ message: "Danh sách thứ tự cột không hợp lệ!" });
    }

    // Kiểm tra board tồn tại
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    // Kiểm tra quyền truy cập
    if (!req.user || !board.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật board này!" });
    }

    // Cập nhật listOrderIds trong Board
    board.listOrderIds = columnOrder;
    await board.save();

    res.status(200).json({ message: "Cập nhật thứ tự cột thành công" });
  } catch (err) {
    console.error("Error updating column order:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Mời thành viên mới vào bảng
const inviteMember = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { email, userId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }
    if (!email && !userId) {
      return res.status(400).json({ message: "Email hoặc userId là bắt buộc!" });
    }
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Không tìm thấy bảng!" });
    }
    if (!req.user || board.owner.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Chỉ chủ phòng mới có quyền mời thành viên vào bảng này!",
      });
    }
    let user;
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "User ID không hợp lệ!" });
      }
      user = await User.findById(userId);
    } else {
      user = await User.findOne({ email });
    }
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng!" });
    }
    if (!board.invitedUsers.includes(user._id)) {
      board.invitedUsers.push(user._id);
    }
    if (board.members.includes(user._id)) {
      return res.status(400).json({ message: "Người dùng đã là thành viên của bảng!" });
    }
    board.members.push(user._id);

    // Add user to workspace members
    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Không tìm thấy workspace!" });
    }
    if (!workspace.members.includes(user._id)) {
      workspace.members.push(user._id);
      await workspace.save();
    }

    await board.save();
    const updatedBoard = await Board.findById(boardId)
      .populate("members", "email avatar")
      .populate("invitedUsers", "email avatar")
      .populate("owner", "email _id");
    res.status(200).json({
      message: "Đã mời thành viên thành công!",
      board: updatedBoard,
    });
  } catch (err) {
    console.error("Error inviting member:", err);
    res.status(500).json({ message: "Lỗi server khi mời thành viên!", error: err.message });
  }
};

const removeMember = async (req, res) => {
  try {
    const { boardId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(boardId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Board ID hoặc User ID không hợp lệ!" });
    }

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Không tìm thấy bảng!" });
    }

    if (!req.user || board.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền xóa thành viên!" });
    }

    if (board.owner.toString() === userId) {
      return res.status(400).json({ message: "Không thể xóa chủ phòng!" });
    }

    // Remove from board members
    board.members = board.members.filter((memberId) => memberId.toString() !== userId);

    // Remove from workspace members
    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Không tìm thấy workspace!" });
    }
    workspace.members = workspace.members.filter((memberId) => memberId.toString() !== userId);
    await workspace.save();

    await board.save();

    const updatedBoard = await Board.findById(boardId)
      .populate("members", "email avatar")
      .populate("invitedUsers", "email avatar");

    res.status(200).json({
      message: "Đã xóa thành viên khỏi bảng và workspace!",
      board: updatedBoard,
    });
  } catch (err) {
    console.error("Error removing member:", err);
    res.status(500).json({ message: "Lỗi server khi xóa thành viên!", error: err.message });
  }
};

module.exports = {
  createBoard,
  getUserBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
  updateColumnOrder,
  inviteMember,
  removeMember,
};