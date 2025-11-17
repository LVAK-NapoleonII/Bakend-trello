const mongoose = require("mongoose");
const List = require("../../models/List");
const Board = require("../../models/Board");
const Card = require("../../models/Card");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");
const checkBoardAccess = require("../../helpers/checkBoardAccess");


const deleteList = async (req, res) => {
  try {
    const { id: listId } = req.params;
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    const list = await List.findOne({ _id: listId, isDeleted: false });
    if (!list) {
      return res.status(404).json({ message: "Không tìm thấy cột hoặc cột đã bị ẩn!" });
    }

    // Kiểm tra quyền truy cập board
    const { canView, canEdit, board, role } = await checkBoardAccess(list.board, userId);
    
    if (!canView) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập board này!" });
    }

    // Chỉ owner và board member mới được xóa list
    if (!canEdit) {
      return res.status(403).json({ 
        message: "Bạn không có quyền xóa cột này! Chỉ owner và member mới có quyền này." 
      });
    }

    // Kiểm tra thêm: Chỉ owner mới được xóa (theo logic ban đầu của bạn)
    // if (role !== "owner") {
    //   return res.status(403).json({ message: "Chỉ chủ board mới có quyền xóa cột!" });
    // }

    // Ẩn tất cả cards trong list
    await Card.updateMany(
      { list: list._id, isDeleted: false }, 
      { $set: { isDeleted: true } }
    );

    // Cập nhật listOrderIds
    board.listOrderIds = (await Promise.all(
      board.listOrderIds.map(async (id) => {
        const existingList = await List.findOne({ _id: id, isDeleted: false });
        return existingList ? id : null;
      })
    )).filter((id) => id);
    
    list.isDeleted = true;

    const activity = new Activity({
      user: userId,
      action: { category: "list", type: "hidden" },
      target: list._id,
      targetModel: "List",
      details: `User ${req.user.fullName} hid list "${list.title}" from board "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);

    const io = req.app.get("io");
    if (io) {
      const notificationPromises = board.members
        .filter((member) => member.user.toString() !== userId.toString() && member.isActive)
        .map((member) => {
          const notification = new Notification({
            user: member.user,
            message: `${req.user.fullName} đã ẩn list "${list.title}" khỏi board "${board.title}"`,
            type: "activity",
            target: list._id,
            targetModel: "List",
            isRead: false,
            isHidden: false,
          });
          return notification.save().then(() => 
            io.to(member.user.toString()).emit("new-notification", notification)
          );
        });
      await Promise.all([list.save(), board.save(), ...notificationPromises]);

      io.to(board._id.toString()).emit("list-hidden", {
        listId,
        message: `List "${list.title}" đã bị ẩn bởi ${req.user.fullName}`,
      });
    } else {
      await Promise.all([list.save(), board.save()]);
    }

    res.status(200).json({ message: "Đã ẩn cột thành công" });
  } catch (error) {
    console.error("deleteList error:", error.message);
    res.status(500).json({ message: "Lỗi server khi ẩn cột" });
  }
};

module.exports = deleteList;