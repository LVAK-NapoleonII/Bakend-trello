const mongoose = require("mongoose");
const List = require("../../models/List");
const Card = require("../../models/Card");
const Activity = require("../../models/Activity");
const checkBoardAccess = require("../../helpers/checkBoardAccess");

const updateCardOrder = async (req, res) => {
  try {
    const { listId } = req.params;
    const { cardOrder, version } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    }
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }
    if (!Array.isArray(cardOrder)) {
      return res.status(400).json({ message: "Danh sách thứ tự thẻ không hợp lệ!" });
    }
    if (version === undefined || version === null) {
      return res.status(400).json({ message: "Version là bắt buộc!" });
    }

    // Tìm List với version chính xác → chống conflict
    const list = await List.findOne({ _id: listId, version, isDeleted: false });
    if (!list) {
      return res.status(409).json({
        message: "Cột đã được thay đổi bởi người khác. Vui lòng tải lại!",
        code: "VERSION_CONFLICT"
      });
    }

    // Kiểm tra quyền truy cập board
    const { canView, canEdit, board } = await checkBoardAccess(list.board, userId);

    if (!canView) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập board này!" });
    }
    if (!canEdit) {
      return res.status(403).json({
        message: "Bạn không có quyền sắp xếp thẻ! Chỉ owner và member mới được phép."
      });
    }

    // Validate tất cả card IDs
    if (cardOrder.length > 0) {
      for (const cardId of cardOrder) {
        if (!mongoose.Types.ObjectId.isValid(cardId)) {
          return res.status(400).json({ message: `Card ID ${cardId} không hợp lệ!` });
        }
        const card = await Card.findOne({ _id: cardId, isDeleted: false });
        if (!card) {
          return res.status(404).json({ message: `Card ${cardId} không tồn tại hoặc đã bị ẩn!` });
        }
        if (card.list.toString() !== listId) {
          return res.status(400).json({ message: `Card ${cardId} không thuộc cột này!` });
        }
      }
    }

    // Cập nhật thứ tự + tăng version
    list.cardOrderIds = cardOrder.map(id => new mongoose.Types.ObjectId(id));
    list.version += 1;

    // Cập nhật position cho từng card
    await Promise.all(
      cardOrder.map((cardId, index) =>
        Card.findByIdAndUpdate(cardId, { position: index }, { new: true })
      )
    );

    // Tạo activity
    const activity = new Activity({
      user: userId,
      action: { category: "list", type: "card_order_updated" },
      target: list._id,
      targetModel: "List",
      details: `đã thay đổi thứ tự thẻ trong cột "${list.title}"`,
    });
    await activity.save();

    board.activities = board.activities || [];
    board.activities.push(activity._id);

    // Lưu cả list và board
    await Promise.all([list.save(), board.save()]);

    // Realtime
    const io = req.app.get("io");
    if (io) {
      io.to(list.board.toString()).emit("card-order-updated", {
        listId,
        cardOrder,
        version: list.version,
      });
    }

    return res.status(200).json({
      message: "Cập nhật thứ tự thẻ thành công!",
      version: list.version
    });

  } catch (error) {
    console.error("updateCardOrder error:", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật thứ tự thẻ" });
  }
};

module.exports = updateCardOrder;