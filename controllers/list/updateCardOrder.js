const mongoose = require("mongoose");
const List = require("../../models/List");
const Board = require("../../models/Board");
const Card = require("../../models/Card");
const Activity = require("../../models/Activity");

const updateCardOrder = async (req, res) => {
  try {
    const { listId } = req.params;
    const { cardOrder } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    if (!mongoose.Types.ObjectId.isValid(listId)) return res.status(400).json({ message: "List ID không hợp lệ!" });
    if (!Array.isArray(cardOrder)) return res.status(400).json({ message: "Danh sách thứ tự thẻ không hợp lệ!" });

    const list = await List.findOne({ _id: listId, isDeleted: false });
    if (!list) return res.status(404).json({ message: "List không tồn tại hoặc đã bị ẩn!" });

    const board = await Board.findOne({
      _id: list.board,
      isDeleted: false,
      "members.user": userId,
      "members.isActive": true,
    });
    if (!board) return res.status(403).json({ message: "Bạn không có quyền cập nhật list này!" });

    if (cardOrder.length > 0) {
      for (const cardId of cardOrder) {
        if (!mongoose.Types.ObjectId.isValid(cardId)) {
          return res.status(400).json({ message: `Card ID ${cardId} không hợp lệ!` });
        }
        const card = await Card.findOne({ _id: cardId, isDeleted: false });
        if (!card) return res.status(404).json({ message: `Card ${cardId} không tồn tại hoặc đã bị ẩn!` });
        if (card.list.toString() !== listId) {
          return res.status(400).json({ message: `Card ${cardId} không thuộc list này!` });
        }
      }
    }

    // Cập nhật cardOrderIds trong List
    list.cardOrderIds = cardOrder.map((id) => new mongoose.Types.ObjectId(id));

    // Cập nhật position cho tất cả thẻ dựa trên cardOrder
    await Promise.all(
      cardOrder.map(async (cardId, index) => {
        await Card.findByIdAndUpdate(
          cardId,
          { position: index },
          { new: true }
        );
      })
    );

    // Lưu activity
    const activity = new Activity({
      user: userId,
      action: { category: "list", type: "card_order_updated" },
      target: list._id,
      targetModel: "List",
      details: `User ${req.user.fullName} updated card order in list "${list.title}"`,
    });
    await activity.save();
    board.activities = board.activities || [];
    board.activities.push(activity._id);

    // Lưu thay đổi vào DB
    await Promise.all([list.save(), board.save()]);

    // Debug log
    console.log("updateCardOrder: Updated cardOrderIds:", list.cardOrderIds.map(id => id.toString()));
    console.log("updateCardOrder: Updated positions:", await Card.find({ list: listId, isDeleted: false }).select('title position'));

    // Emit sự kiện card-order-updated
    const io = req.app.get("io");
    if (io) {
      io.to(list.board.toString()).emit("card-order-updated", {
        listId,
        cardOrder: cardOrder,
        message: `Thứ tự thẻ trong list "${list.title}" đã được cập nhật bởi ${req.user.fullName}`,
      });
    }

    return res.status(200).json({ message: "Cập nhật thứ tự thẻ thành công" });
  } catch (error) {
    console.error("updateCardOrder error:", error.message);
    return res.status(500).json({ message: "Lỗi server khi cập nhật thứ tự thẻ" });
  }
};

module.exports = updateCardOrder;