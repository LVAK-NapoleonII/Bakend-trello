const mongoose = require("mongoose");
const List = require("../models/List");

// Tạo cột mới
const createList = async (req, res) => {
  try {
    const { title, board, position } = req.body;

    // Kiểm tra req.user.id
    if (!req.user || !req.user.id) { 
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    // Kiểm tra title và board
    if (!title || !board) { 
      return res.status(400).json({ message: "Title và board là bắt buộc!" });
    }

    // Kiểm tra board có phải ObjectId hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(board)) {  
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const newList = await List.create({ title, board, position });
    res.status(201).json(newList);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message }); // ĐÃ SỬA: Thêm chi tiết lỗi
  }
};

// Lấy các cột theo board
const getListsByBoard = async (req, res) => {
  try {
    const boardId = req.params.boardId;

    // Kiểm tra boardId
    if (!mongoose.Types.ObjectId.isValid(boardId)) { 
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const lists = await List.find({ board: boardId }).sort("position");
    res.status(200).json(lists);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message }); // ĐÃ SỬA: Thêm chi tiết lỗi
  }
};

// Cập nhật cột
const updateList = async (req, res) => {
  try {
    const updatedList = await List.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedList) { 
      return res.status(404).json({ message: "Không tìm thấy cột!" });
    }
    res.status(200).json(updatedList);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message }); // ĐÃ SỬA: Thêm chi tiết lỗi
  }
};

// xoá cột
const deleteList = async (req, res) => {
  try {
    const list = await List.findByIdAndDelete(req.params.id);
    if (!list) { 
      return res.status(404).json({ message: "Không tìm thấy cột!" });
    }
    res.status(200).json({ message: "Đã xoá cột" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message }); // ĐÃ SỬA: Thêm chi tiết lỗi
  }
};

module.exports = {
  createList,
  getListsByBoard,
  updateList,
  deleteList,
};