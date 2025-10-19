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

    // Validation
    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }
    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(newListId) || !mongoose.Types.ObjectId.isValid(newBoardId)) {
      return res.status(400).json({ message: "List ID hoặc Board ID không hợp lệ!" });
    }

    // Lấy card, list, board
    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const newList = await List.findOne({ _id: newListId, isDeleted: false });
    if (!newList) {
      return res.status(404).json({ message: "List đích không tồn tại!" });
    }

    const newBoard = await Board.findOne({ _id: newBoardId, isDeleted: false });
    if (!newBoard) {
      return res.status(404).json({ message: "Board đích không tồn tại!" });
    }

    if (newList.board.toString() !== newBoardId) {
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    // Kiểm tra quyền
    const isMember = newBoard.members.some(
      (m) => m.user?.toString() === userId.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền di chuyển thẻ!" });
    }

    const oldList = await List.findOne({ _id: card.list, isDeleted: false });
    const isSameList = oldList && oldList._id.toString() === newListId;

    let finalPosition = newPosition !== undefined ? newPosition : card.position;

    // ============================================
    // TRƯỜNG HỢP 1: KÉO TRONG CÙNG LIST
    // ============================================
    if (isSameList) {
      if (newPosition !== undefined) {
        console.log("moveCard: Same list reorder:", {
          cardId,
          oldPosition: card.position,
          newPosition,
          currentOrderIds: oldList.cardOrderIds.map(id => id.toString()),
        });

        const currentIndex = oldList.cardOrderIds.findIndex(
          (id) => id.toString() === cardId
        );

        if (currentIndex === -1) {
          return res.status(400).json({ message: "Card không tồn tại trong list!" });
        }

        oldList.cardOrderIds.splice(currentIndex, 1);

        // Đảm bảo newPosition hợp lệ
        const safePosition = Math.min(newPosition, oldList.cardOrderIds.length);
        oldList.cardOrderIds.splice(safePosition, 0, new mongoose.Types.ObjectId(cardId));
        
        finalPosition = safePosition;

        console.log("moveCard: New order:", {
          newOrderIds: oldList.cardOrderIds.map(id => id.toString()),
          finalPosition,
        });

        const updatePromises = oldList.cardOrderIds.map(async (id, index) => {
          return await Card.findByIdAndUpdate(
            id,
            { position: index },
            { new: true }
          );
        });

        await Promise.all(updatePromises);
        await oldList.save();

        // Emit socket event
        const io = req.app.get("io");
        if (io) {
          io.to(newBoardId).emit("card-order-updated", {
            listId: oldList._id,
            cardOrder: oldList.cardOrderIds.map(id => id.toString()),
            message: `Thứ tự thẻ trong list "${oldList.title}" đã được cập nhật`,
          });
        }
      }

    // ============================================
    // TRƯỜNG HỢP 2: KÉO SANG LIST KHÁC
    // ============================================
    } else {
      console.log("moveCard: Cross list move:", {
        cardId,
        fromList: oldList?._id,
        toList: newListId,
        newPosition,
      });

      // Xóa khỏi list cũ
      if (oldList) {
        oldList.cardOrderIds = oldList.cardOrderIds.filter(
          (id) => id.toString() !== cardId
        );
        
        // Cập nhật lại position cho các cards còn lại
        await Promise.all(
          oldList.cardOrderIds.map(async (id, index) => {
            await Card.findByIdAndUpdate(id, { position: index });
          })
        );
        
        await oldList.save();
      }

      // Thêm vào list mới
      newList.cardOrderIds = newList.cardOrderIds || [];
      
      const safePosition = Math.min(
        newPosition !== undefined ? newPosition : newList.cardOrderIds.length,
        newList.cardOrderIds.length
      );
      
      newList.cardOrderIds.splice(safePosition, 0, new mongoose.Types.ObjectId(cardId));
      finalPosition = safePosition;

      // Cập nhật position cho tất cả cards trong list mới
      await Promise.all(
        newList.cardOrderIds.map(async (id, index) => {
          await Card.findByIdAndUpdate(id, { position: index });
        })
      );

      await newList.save();

      // Cập nhật list và board cho card
      card.list = newListId;
      card.board = newBoardId;

      // Emit socket events
      const io = req.app.get("io");
      if (io && oldList) {
        io.to(newBoardId).emit("card-order-updated", {
          listId: oldList._id,
          cardOrder: oldList.cardOrderIds.map(id => id.toString()),
        });
      }
      if (io) {
        io.to(newBoardId).emit("card-order-updated", {
          listId: newList._id,
          cardOrder: newList.cardOrderIds.map(id => id.toString()),
        });
      }
    }

    // Cập nhật position cho card
    card.position = finalPosition;

    // Tạo activity
    const activity = new Activity({
      user: userId,
      action: { category: "card", type: "moved" },
      target: card._id,
      targetModel: "Card",
      details: `Moved card "${card.title}" to list "${newList.title}"${
        isSameList ? " at position " + finalPosition : ""
      }`,
    });
    await activity.save();
    
    card.activities.push(activity._id);
    newBoard.activities.push(activity._id);

    // Tạo notifications
    if (req.app.get("io")) {
      for (const member of card.members) {
        if (member.toString() !== userId.toString()) {
          const notification = new Notification({
            user: member,
            message: `${req.user.fullName} đã di chuyển card "${card.title}"`,
            type: "activity",
            target: card._id,
            targetModel: "Card",
            isRead: false,
          });
          await notification.save();
          req.app.get("io").to(member.toString()).emit("new-notification", notification);
        }
      }
    }

    await Promise.all([card.save(), newBoard.save()]);

    // Populate và trả về
    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    if (req.app.get("io")) {
      req.app.get("io").to(newBoardId).emit("card-moved", {
        card: updatedCard,
        oldListId: oldList ? oldList._id : null,
        newListId,
        newPosition: finalPosition,
      });

      if (!isSameList && oldList) {
        req.app.get("io").to(card.board.toString()).emit("card-moved", {
          card: updatedCard,
          oldListId: oldList._id,
          newListId,
          newPosition: finalPosition,
        });
      }
    }

    console.log("moveCard: Success:", {
      cardId,
      finalPosition,
      listId: newListId,
    });

    return res.status(200).json({
      message: "Di chuyển thẻ thành công",
      card: updatedCard,
    });
  } catch (error) {
    console.error("moveCard error:", error);
    return res.status(500).json({ message: "Lỗi khi di chuyển thẻ" });
  }
};

module.exports = moveCard;