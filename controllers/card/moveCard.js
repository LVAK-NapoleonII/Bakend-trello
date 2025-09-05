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
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId)) return res.status(400).json({ message: "Card ID không hợp lệ!" });
    if (!mongoose.Types.ObjectId.isValid(newListId) || !mongoose.Types.ObjectId.isValid(newBoardId)) {
      return res.status(400).json({ message: "New List ID hoặc New Board ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const newList = await List.findOne({ _id: newListId, isDeleted: false });
    if (!newList) return res.status(404).json({ message: "List đích không tồn tại hoặc đã bị ẩn!" });

    const newBoard = await Board.findOne({ _id: newBoardId, isDeleted: false });
    if (!newBoard) return res.status(404).json({ message: "Board đích không tồn tại hoặc đã bị ẩn!" });

    if (newList.board.toString() !== newBoardId) {
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    const isMember = newBoard.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền di chuyển thẻ đến board này!" });

    const oldList = await List.findOne({ _id: card.list, isDeleted: false });
    const isSameList = oldList && oldList._id.toString() === newListId;

    let finalPosition = newPosition !== undefined ? newPosition : card.position;

    if (isSameList) {
      if (newPosition !== undefined) {
        oldList.cardOrderIds = oldList.cardOrderIds.filter((id) => id.toString() !== cardId);
        if (newPosition >= oldList.cardOrderIds.length) {
          oldList.cardOrderIds.push(card._id);
          finalPosition = oldList.cardOrderIds.length - 1;
        } else {
          oldList.cardOrderIds.splice(newPosition, 0, card._id);
          finalPosition = newPosition;
        }
        await oldList.save();
      }
    } else {
      if (oldList) {
        oldList.cardOrderIds = oldList.cardOrderIds.filter((id) => id.toString() !== cardId);
        await oldList.save();
      }

      newList.cardOrderIds = newList.cardOrderIds || [];
      if (newPosition !== undefined && newPosition < newList.cardOrderIds.length) {
        newList.cardOrderIds.splice(newPosition, 0, card._id);
        finalPosition = newPosition;
      } else {
        newList.cardOrderIds.push(card._id);
        finalPosition = newList.cardOrderIds.length - 1;
      }
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
      details: `User ${req.user.fullName} moved card "${card.title}" to list "${newList.title}"${isSameList ? " at position " + finalPosition : ""}`,
    });
    await activity.save();
    card.activities.push(activity._id);
    newBoard.activities.push(activity._id);

    const io = req.app.get("io");
    if (io) {
      for (const member of card.members) {
        if (member.toString() !== userId.toString()) {
          const notification = new Notification({
            user: member,
            message: `${req.user.fullName} đã di chuyển card "${card.title}" đến list "${newList.title}"`,
            type: "activity",
            target: card._id,
            targetModel: "Card",
            isRead: false,
            isHidden: false,
          });
          await notification.save();
          io.to(member.toString()).emit("new-notification", notification);
        }
      }
    }

    await Promise.all([card.save(), newBoard.save()]);

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    if (io) {
      io.to(newBoardId).emit("card-moved", {
        card: updatedCard,
        oldListId: oldList ? oldList._id : null,
        newListId,
        newPosition: finalPosition,
        message: `${req.user.fullName} đã di chuyển card "${card.title}" đến list "${newList.title}"`,
      });

      if (!isSameList && oldList) {
        io.to(card.board.toString()).emit("card-moved", {
          card: updatedCard,
          oldListId: oldList._id,
          newListId,
          newPosition: finalPosition,
          message: `${req.user.fullName} đã di chuyển card "${card.title}" từ list "${oldList.title}"`,
        });
      }
    }

    return res.status(200).json({ message: "Di chuyển thẻ thành công", card: updatedCard });
  } catch (error) {
    console.error("moveCard error:", error.message);
    return res.status(500).json({ message: "Lỗi khi di chuyển thẻ" });
  }
};

module.exports = moveCard;