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

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(newListId)) {
      return res.status(400).json({ message: "ID không hợp lệ!" });
    }

    // === BỎ KIỂM TRA VERSION NGHIÊM NGẶT ===
    // Thay vì reject ngay, chỉ log warning
    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    // Kiểm tra version nhưng vẫn cho phép di chuyển
    if (version !== undefined && card.version !== version) {
      console.warn(`Version mismatch: expected ${version}, got ${card.version}. Proceeding anyway...`);
    }

    const newList = await List.findById(newListId);
    const newBoard = await Board.findById(newBoardId);
    if (!newList || !newBoard || newList.isDeleted || newBoard.isDeleted) {
      return res.status(404).json({ message: "List hoặc Board không tồn tại!" });
    }

    const isMember = newBoard.members.some(m => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Không có quyền!" });

    const oldList = card.list.toString() !== newListId ? await List.findById(card.list) : newList;
    const isSameList = card.list.toString() === newListId;
    const position = newPosition ?? card.position;

    // === XỬ LÝ DI CHUYỂN ===
    if (isSameList) {
      await List.findByIdAndUpdate(oldList._id, {
        $pull: { cardOrderIds: cardId },
      });
      await List.findByIdAndUpdate(oldList._id, {
        $push: { cardOrderIds: { $each: [cardId], $position: position } }
      });
    } else {
      if (oldList) {
        await List.findByIdAndUpdate(oldList._id, { $pull: { cardOrderIds: cardId } });
      }
      await List.findByIdAndUpdate(newListId, {
        $push: { cardOrderIds: { $each: [cardId], $position: position } }
      });

      // Cập nhật card (KHÔNG kiểm tra version)
      await Card.findByIdAndUpdate(cardId, {
        list: newListId,
        board: newBoardId,
        position,
        $inc: { version: 1 }
      });
    }

    // Re-index positions
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
    }

    return res.json({
      message: "Di chuyển thành công",
      card: updatedCard,
      version: updatedCard.version // Trả về version mới nhất
    });

  } catch (error) {
    console.error("moveCard error:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = moveCard;