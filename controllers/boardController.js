const mongoose = require("mongoose"); 
const Board = require("../models/Board");

// 📌 Tạo bảng
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

    const boards = await Board.find({ members: req.user.id }).populate("workspace", "name"); // ĐÃ SỬA: Dùng req.user.id
    res.status(200).json(boards);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};


const getBoardById = async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);
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

module.exports = {
  createBoard,
  getUserBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
};