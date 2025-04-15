const mongoose = require("mongoose");
const List = require("../models/List");
const Board = require("../models/Board");

// Tạo cột mới
const createList = async (req, res) => {
  try {
    const { title, board, position } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!title || !board) {
      return res.status(400).json({ message: "Title và board là bắt buộc!" });
    }

    if (!mongoose.Types.ObjectId.isValid(board)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const boardExists = await Board.findById(board);
    if (!boardExists) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    if (!boardExists.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền tạo cột trong board này!" });
    }

    const newList = await List.create({ title, board, position });

    // Cập nhật listOrderIds trong Board
    boardExists.listOrderIds = boardExists.listOrderIds || [];
    boardExists.listOrderIds.push(newList._id);
    await boardExists.save();

    res.status(201).json(newList);
  } catch (err) {
    console.error("Error in createList:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
// Lấy các cột theo board
const getListsByBoard = async (req, res) => {
  try {
    const boardId = req.params.boardId;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const lists = await List.find({ board: boardId });

    // Sắp xếp danh sách cột theo listOrderIds
    const orderedLists = (board.listOrderIds || [])
      .map((listId) => lists.find((list) => list._id.toString() === listId.toString()))
      .filter((list) => list);

    // Thêm các cột không có trong listOrderIds (nếu có)
    const remainingLists = lists.filter(
      (list) => !board.listOrderIds.includes(list._id)
    );
    const finalLists = [...orderedLists, ...remainingLists];

    res.status(200).json(finalLists);
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
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

const updateCardOrder = async (req, res) => {
  try {
    const { listId } = req.params;
    const { cardOrder } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    if (!Array.isArray(cardOrder)) {
      return res.status(400).json({ message: "Danh sách thứ tự thẻ không hợp lệ!" });
    }

    const list = await List.findById(listId);
    if (!list) {
      return res.status(404).json({ message: "List không tồn tại!" });
    }

    const board = await Board.findById(list.board);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    if (!board.members.includes(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật list này!" });
    }

    list.cardOrderIds = cardOrder;
    await list.save();

    res.status(200).json({ message: "Cập nhật thứ tự thẻ thành công" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
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
  updateCardOrder,
};