const mongoose = require("mongoose");
const List = require("../models/List");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

// Helper function để kiểm tra quyền truy cập board (giống như trong boardController)
const checkBoardAccess = async (boardId, userId) => {
  const board = await Board.findOne({ _id: boardId, isDeleted: false })
    .populate("workspace", "members");
  
  if (!board) return { hasAccess: false, board: null, reason: "Board không tồn tại" };

  // Nếu là owner thì luôn có quyền
  if (board.owner.toString() === userId.toString()) {
    return { hasAccess: true, board, reason: "owner" };
  }

  // Nếu board là public, kiểm tra xem user có phải member của workspace không
  if (board.visibility === "public") {
    const isWorkspaceMember = board.workspace.members.some(
      memberId => memberId.toString() === userId.toString()
    );
    if (isWorkspaceMember) {
      return { hasAccess: true, board, reason: "workspace_member" };
    }
  }

  // Nếu board là private hoặc user không phải workspace member, kiểm tra board membership
  const isBoardMember = board.members.some(
    member => member.user.toString() === userId.toString() && member.isActive
  );
  
  if (isBoardMember) {
    return { hasAccess: true, board, reason: "board_member" };
  }

  return { hasAccess: false, board, reason: "no_permission" };
};

const createList = async (req, res) => {
  try {
    const { title, board, position } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    if (!title || !board) return res.status(400).json({ message: "Title và board là bắt buộc!" });
    if (!mongoose.Types.ObjectId.isValid(board)) return res.status(400).json({ message: "Board ID không hợp lệ!" });

    // Sử dụng helper function để kiểm tra quyền truy cập
    const { hasAccess, board: boardExists, reason } = await checkBoardAccess(board, userId);
    
    if (!hasAccess) {
      if (reason === "Board không tồn tại") {
        return res.status(404).json({ message: reason });
      }
      return res.status(403).json({ message: "Bạn không có quyền tạo cột trong board này!" });
    }

    const newList = await List.create({
      title,
      board,
      position: position !== undefined ? position : 0,
      isDeleted: false,
      cardOrderIds: [],
      activities: [],
    });

    boardExists.listOrderIds = boardExists.listOrderIds || [];
    if (!boardExists.listOrderIds.includes(newList._id)) {
      boardExists.listOrderIds.push(newList._id);
    }

    const activity = new Activity({
      user: userId,
      action: { category: "list", type: "created" },
      target: newList._id,
      targetModel: "List",
      details: `User ${req.user.fullName} created list "${title}" in board "${boardExists.title}"`,
    });
    await activity.save();
    newList.activities.push(activity._id);
    boardExists.activities = boardExists.activities || [];
    boardExists.activities.push(activity._id);
    await Promise.all([newList.save(), boardExists.save()]);

    const io = req.app.get("io");
    if (io) {
      // Tạo notifications cho các board members
      const notificationPromises = boardExists.members
        .filter((member) => member.user.toString() !== userId.toString() && member.isActive)
        .map((member) => {
          const notification = new Notification({
            user: member.user,
            message: `${req.user.fullName} đã tạo list "${title}" trong board "${boardExists.title}"`,
            type: "activity",
            target: newList._id,
            targetModel: "List",
            isRead: false,
            isHidden: false,
          });
          return notification.save().then(() => io.to(member.user.toString()).emit("new-notification", notification));
        });
      await Promise.all(notificationPromises);

      io.to(board.toString()).emit("list-created", {
        list: newList,
        message: `List "${title}" đã được tạo bởi ${req.user.fullName} trong board "${boardExists.title}"`,
      });
    }

    return res.status(201).json(newList);
  } catch (error) {
    console.error("createList error:", error.message);
    return res.status(500).json({ message: "Lỗi server khi tạo cột!" });
  }
};

const getListsByBoard = async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(boardId)) return res.status(400).json({ message: "Board ID không hợp lệ!" });

    // Sử dụng helper function để kiểm tra quyền truy cập
    const { hasAccess, board, reason } = await checkBoardAccess(boardId, userId);
    
    if (!hasAccess) {
      if (reason === "Board không tồn tại") {
        return res.status(404).json({ message: reason });
      }
      return res.status(403).json({ message: "Bạn không có quyền truy cập board này!" });
    }

    const lists = await List.find({ board: boardId, isDeleted: false }).populate({
      path: "activities",
      match: { isHidden: false },
    });

    const orderedLists = (board.listOrderIds || [])
      .map((listId) => lists.find((list) => list._id.toString() === listId.toString()))
      .filter((list) => list);
    const remainingLists = lists.filter((list) => !board.listOrderIds.includes(list._id));
    const finalLists = [...orderedLists, ...remainingLists];

    res.status(200).json(finalLists);
  } catch (error) {
    console.error("getListsByBoard error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const updateList = async (req, res) => {
  try {
    const { id: listId } = req.params;
    const { title, position } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(listId)) return res.status(400).json({ message: "List ID không hợp lệ!" });
    if (title && typeof title !== "string") return res.status(400).json({ message: "Title phải là chuỗi!" });
    if (position !== undefined && (typeof position !== "number" || position < 0)) {
      return res.status(400).json({ message: "Position phải là số không âm!" });
    }

    const list = await List.findOne({ _id: listId, isDeleted: false });
    if (!list) return res.status(404).json({ message: "Không tìm thấy cột hoặc cột đã bị ẩn!" });

    // Sử dụng helper function để kiểm tra quyền truy cập board
    const { hasAccess, board } = await checkBoardAccess(list.board, userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật cột này!" });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (position !== undefined) updateData.position = position;

    const updatedList = await List.findByIdAndUpdate(listId, updateData, { new: true }).populate({
      path: "activities",
      match: { isHidden: false },
    });
    if (!updatedList) return res.status(404).json({ message: "Không tìm thấy cột!" });

    const activity = new Activity({
      user: userId,
      action: { category: "list", type: "updated" },
      target: updatedList._id,
      targetModel: "List",
      details: `User ${req.user.fullName} updated list "${updatedList.title}" in board "${board.title}"`,
    });
    await activity.save();
    updatedList.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([updatedList.save(), board.save()]);

    const io = req.app.get("io");
    if (io) {
      // Tạo notifications cho các board members
      const notificationPromises = board.members
        .filter((member) => member.user.toString() !== userId.toString() && member.isActive)
        .map((member) => {
          const notification = new Notification({
            user: member.user,
            message: `${req.user.fullName} đã cập nhật list "${updatedList.title}" trong board "${board.title}"`,
            type: "activity",
            target: updatedList._id,
            targetModel: "List",
            isRead: false,
            isHidden: false,
          });
          return notification.save().then(() => io.to(member.user.toString()).emit("new-notification", notification));
        });
      await Promise.all(notificationPromises);

      io.to(list.board.toString()).emit("list-updated", {
        list: updatedList,
        message: `List "${updatedList.title}" đã được cập nhật bởi ${req.user.fullName}`,
      });
    }

    res.status(200).json(updatedList);
  } catch (error) {
    console.error("updateList error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

module.exports = {
  createList,
  getListsByBoard,
  updateList,
  deleteList: require("./list/deleteList"),
  updateCardOrder: require("./list/updateCardOrder"),
  updateListOrder: require("./list/updateListOrder"),
  getListById: require("./list/getListById"),
};