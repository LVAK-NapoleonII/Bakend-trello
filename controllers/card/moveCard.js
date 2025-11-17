const mongoose = require("mongoose");
const Card = require("../../models/Card");
const List = require("../../models/List");
const Board = require("../../models/Board");
const Activity = require("../../models/Activity");

const moveCard = async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const { newListId, newBoardId, newPosition, version } = req.body;
    const userId = req.user?._id;

    // Validate
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(newListId) || !mongoose.Types.ObjectId.isValid(newBoardId)) {
      return res.status(400).json({ message: "ID không hợp lệ!" });
    }
    if (version === undefined) {
      return res.status(400).json({ message: "Phiên bản (version) là bắt buộc!" });
    }

    // Bước 1: Kiểm tra version (Optimistic Locking)
    const card = await Card.findOne({ _id: cardId, isDeleted: false, version });
    if (!card) {
      return res.status(409).json({
        message: "Thẻ đã bị thay đổi bởi người khác. Đang tải lại dữ liệu...",
        code: "VERSION_CONFLICT"
      });
    }

    const newList = await List.findById(newListId);
    const newBoard = await Board.findById(newBoardId);
    if (!newList || !newBoard || newList.isDeleted || newBoard.isDeleted) {
      return res.status(404).json({ message: "List hoặc Board không tồn tại!" });
    }
    if (newList.board.toString() !== newBoardId) {
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    const isMember = newBoard.members.some(m => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Không có quyền!" });

    const oldList = card.list.toString() !== newListId ? await List.findById(card.list) : newList;
    const isSameList = card.list.toString() === newListId;

    const position = newPosition ?? card.position;

    // Bắt đầu xử lý di chuyển (không dùng transaction)
    if (isSameList) {
      // Chỉ thay đổi vị trí trong cùng list
      await List.findByIdAndUpdate(oldList._id, {
        $pull: { cardOrderIds: cardId },
        $push: { cardOrderIds: { $each: [cardId], $position: position } }
      });
    } else {
      // Di chuyển sang list khác
      if (oldList) {
        await List.findByIdAndUpdate(oldList._id, { $pull: { cardOrderIds: cardId } });
      }
      await List.findByIdAndUpdate(newListId, {
        $push: { cardOrderIds: { $each: [cardId], $position: position } }
      });

      // Cập nhật card (list, board, position, version++)
      await Card.findOneAndUpdate(
        { _id: cardId, version },
        {
          list: newListId,
          board: newBoardId,
          position,
          $inc: { version: 1 }
        }
      );
    }

    // Re-index lại position cho các list bị ảnh hưởng
    const listsToReindex = isSameList ? [oldList] : [oldList, newList].filter(Boolean);
    for (const list of listsToReindex) {
      const updatedList = await List.findById(list._id);
      await Promise.all(
        updatedList.cardOrderIds.map((id, idx) =>
          Card.findByIdAndUpdate(id, { position: idx })
        )
      );
    }

    // Tạo activity
    const activity = await Activity.create({
      user: userId,
      action: { category: "card", type: "moved" },
      target: card._id,
      targetModel: "Card",
      details: `Di chuyển thẻ "${card.title}" → ${newList.title}`,
    });

    await Promise.all([
      Card.findByIdAndUpdate(cardId, { $push: { activities: activity._id } }),
      Board.findByIdAndUpdate(newBoardId, { $push: { activities: activity._id } })
    ]);

    // Lấy card mới nhất
    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("activities");

    // Emit socket
    const io = req.app.get("io");
    if (io) {
      io.to(newBoardId).emit("card-moved", {
        card: updatedCard,
        oldListId: oldList?._id || null,
        newListId,
        newPosition: position,
      });

      // Cập nhật thứ tự cả 2 list
      for (const list of listsToReindex) {
        const freshList = await List.findById(list._id);
        const cards = await Card.find({ list: list._id, isDeleted: false }).sort("position");
        io.to(newBoardId).emit("card-order-updated", {
          listId: list._id,
          cardOrder: cards.map(c => c._id),
        });
      }
    }

    return res.json({
      message: "Di chuyển thành công",
      card: updatedCard,
      version: card.version + 1
    });

  } catch (error) {
    console.error("moveCard error:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = moveCard;