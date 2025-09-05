const mongoose = require("mongoose");
const List = require("../../models/List");
const Board = require("../../models/Board");
const Card = require("../../models/Card");

const getListById = async (req, res) => {
  try {
    const { listId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(listId)) return res.status(400).json({ message: "List ID không hợp lệ!" });

    const list = await List.findOne({ _id: listId, isDeleted: false }).populate({
      path: "activities",
      match: { isHidden: false },
    });
    if (!list) return res.status(404).json({ message: "Danh sách không tồn tại hoặc đã bị ẩn!" });

    const board = await Board.findOne({ _id: list.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền truy cập danh sách này!" });

    const cards = await Card.find({ list: listId, isDeleted: false });

    res.status(200).json({ ...list.toObject(), cards });
  } catch (error) {
    console.error("getListById error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = getListById;