const mongoose = require("mongoose");
const List = require("../../models/List");
const Activity = require("../../models/Activity");
const checkBoardAccess = require("../../helpers/checkBoardAccess");

const updateListOrder = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { columnOrder } = req.body;
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    }
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }
    if (!Array.isArray(columnOrder) || columnOrder.length === 0) {
      return res.status(400).json({ message: "Danh sách thứ tự cột không hợp lệ!" });
    }

    // Kiểm tra quyền truy cập board
    const { canView, canEdit, board } = await checkBoardAccess(boardId, userId);
    
    if (!canView) {
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    // Chỉ owner và board member mới được sắp xếp lists
    if (!canEdit) {
      return res.status(403).json({ 
        message: "Bạn không có quyền sắp xếp cột trong board này! Chỉ owner và member mới có quyền này." 
      });
    }

    // Validate tất cả các list IDs
    for (const listId of columnOrder) {
      if (!mongoose.Types.ObjectId.isValid(listId)) {
        return res.status(400).json({ message: `List ID ${listId} không hợp lệ!` });
      }
      const list = await List.findOne({ _id: listId, isDeleted: false });
      if (!list) {
        return res.status(404).json({ message: `List ${listId} không tồn tại hoặc đã bị ẩn!` });
      }
      if (list.board.toString() !== boardId) {
        return res.status(400).json({ message: `List ${listId} không thuộc board này!` });
      }
    }

    board.listOrderIds = columnOrder.map((id) => new mongoose.Types.ObjectId(id));

    const activity = new Activity({
      user: userId,
      action: { category: "board", type: "list_order_updated" },
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} updated list order in board "${board.title}"`,
    });
    await activity.save();
    board.activities = board.activities || [];
    board.activities.push(activity._id);
    await board.save();

    const io = req.app.get("io");
    if (io) {
      io.to(boardId).emit("list-order-updated", {
        boardId,
        columnOrder,
        message: `Thứ tự cột trong board "${board.title}" đã được cập nhật bởi ${req.user.fullName}`,
      });
    }

    return res.status(200).json({ message: "Cập nhật thứ tự cột thành công" });
  } catch (error) {
    console.error("updateListOrder error:", error.message);
    return res.status(500).json({ message: "Lỗi server khi cập nhật thứ tự cột" });
  }
};

module.exports = updateListOrder;