const mongoose = require("mongoose");
const Card = require("../../models/Card");
const List = require("../../models/List");
const Board = require("../../models/Board");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");

const moveCard = async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const { newListId, newBoardId, newPosition } = req.body;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json({ message: "Không tìm thấy user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(newListId) || !mongoose.Types.ObjectId.isValid(newBoardId)) {
      return res.status(400).json({ message: "ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Thẻ không tồn tại!" });

    const newList = await List.findOne({ _id: newListId, isDeleted: false });
    if (!newList) return res.status(404).json({ message: "List đích không tồn tại!" });

    const newBoard = await Board.findOne({ _id: newBoardId, isDeleted: false });
    if (!newBoard) return res.status(404).json({ message: "Board đích không tồn tại!" });

    if (newList.board.toString() !== newBoardId) {
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    const isMember = newBoard.members.some(m => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Không có quyền!" });

    const oldList = await List.findOne({ _id: card.list, isDeleted: false });
    const isSameList = oldList && oldList._id.toString() === newListId;

    let finalPosition = newPosition !== undefined ? newPosition : card.position;

    // === SAME LIST ===
    if (isSameList) {
      const currentIndex = oldList.cardOrderIds.findIndex(id => id.toString() === cardId);
      if (currentIndex === -1) return res.status(400).json({ message: "Card không trong list!" });

      oldList.cardOrderIds.splice(currentIndex, 1);
      const safePosition = Math.min(newPosition ?? oldList.cardOrderIds.length, oldList.cardOrderIds.length);
      oldList.cardOrderIds.splice(safePosition, 0, new mongoose.Types.ObjectId(cardId));
      finalPosition = safePosition;

      await Promise.all(
        oldList.cardOrderIds.map((id, index) =>
          Card.findByIdAndUpdate(id, { position: index })
        )
      );
      await oldList.save();
    }

    // === CROSS LIST ===
    else {
      if (oldList) {
        oldList.cardOrderIds = oldList.cardOrderIds.filter(id => id.toString() !== cardId);
        await Promise.all(
          oldList.cardOrderIds.map((id, index) =>
            Card.findByIdAndUpdate(id, { position: index })
          )
        );
        await oldList.save();
      }

      newList.cardOrderIds = newList.cardOrderIds || [];
      const safePosition = Math.min(newPosition ?? newList.cardOrderIds.length, newList.cardOrderIds.length);
      newList.cardOrderIds.splice(safePosition, 0, new mongoose.Types.ObjectId(cardId));
      finalPosition = safePosition;

      await Promise.all(
        newList.cardOrderIds.map((id, index) =>
          Card.findByIdAndUpdate(id, { position: index })
        )
      );
      await newList.save();

      card.list = newListId;
      card.board = newBoardId;
    }

    card.position = finalPosition;

    const activity = new Activity({
      user: userId,
      action: { category: "card", type: "moved" },
      target: card._id,
      targetModel: "Card",
      details: `Moved card "${card.title}" to "${newList.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    newBoard.activities.push(activity._id);

    await Promise.all([card.save(), newBoard.save()]);

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    // === SOCKET EMIT ===
    const io = req.app.get("io");
    if (io) {
      io.to(newBoardId).emit("card-moved", {
        card: updatedCard,
        oldListId: oldList?._id || null,
        newListId,
        newPosition: finalPosition,
      });

      const newListCards = await Card.find({ list: newListId, isDeleted: false }).sort({ position: 1 }).select("_id");
      io.to(newBoardId).emit("card-order-updated", {
        listId: newListId,
        cardOrder: newListCards.map(c => c._id),
      });

      if (!isSameList && oldList) {
        const oldListCards = await Card.find({ list: oldList._id, isDeleted: false }).sort({ position: 1 }).select("_id");
        io.to(newBoardId).emit("card-order-updated", {
          listId: oldList._id,
          cardOrder: oldListCards.map(c => c._id),
        });
      }
    }

    return res.status(200).json({
      message: "Di chuyển thẻ thành công",
      card: updatedCard,
    });
  } catch (error) {
    console.error("moveCard error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = moveCard;