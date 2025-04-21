const mongoose = require("mongoose");
const List = require("../models/List");
const Board = require("../models/Board");
const Card = require("../models/Card"); 
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

// Tạo cột mới
const createList = async (req, res, io) => {
  try {
    const { title, board, position } = req.body;

    console.log("Received createList request:", {
      title,
      board,
      position,
      userId: req.user?._id?.toString() || "unknown",
      userEmail: req.user?.email || "unknown",
      requestTime: new Date().toISOString(),
    });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    }

    if (!title || !board) {
      console.log("Missing required fields:", { title, board });
      return res.status(400).json({ message: "Title và board là bắt buộc!" });
    }

    if (!mongoose.Types.ObjectId.isValid(board)) {
      console.log("Invalid boardId:", board);
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const boardExists = await Board.findOne({ _id: board, isDeleted: false });
    if (!boardExists) {
      console.log("Board not found or deleted:", board);
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = boardExists.members.some(
      m => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
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
    await boardExists.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "list_created",
      target: newList._id,
      targetModel: "List",
      details: `User ${userName} created list "${title}" in board "${boardExists.title}"`,
    });
    await activity.save();
    newList.activities.push(activity._id);
    boardExists.activities = boardExists.activities || [];
    boardExists.activities.push(activity._id);
    await Promise.all([newList.save(), boardExists.save()]);

    for (const member of boardExists.members) {
      if (member.user.toString() !== req.user._id.toString() && member.isActive) {
        const notification = new Notification({
          user: member.user,
          message: `${userName} đã tạo list "${title}" trong board "${boardExists.title}"`,
          type: "activity",
          target: newList._id,
          targetModel: "List",
        });
        await notification.save();
        io.to(member.user.toString()).emit("new-notification", notification);
      }
    }

    console.log("List created successfully:", {
      listId: newList._id.toString(),
      boardId: board,
      title,
    });

    io.to(board.toString()).emit("list-created", {
      list: newList,
      message: `List "${title}" đã được tạo bởi ${userName} trong board "${boardExists.title}"`,
    });

    return res.status(201).json(newList);
  } catch (err) {
    console.error("Error in createList:", {
      message: err.message,
      stack: err.stack,
      title,
      board,
      userId: req.user?._id?.toString() || "unknown",
    });
    return res.status(500).json({ message: "Lỗi server khi tạo cột!", error: err.message });
  }
};

// Lấy các cột theo board
const getListsByBoard = async (req, res) => {
  try {
    const boardId = req.params.boardId;

    console.log("Fetching lists for board:", { boardId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      console.log("Invalid boardId:", boardId);
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", boardId);
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      m => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền truy cập board này!" });
    }

    const lists = await List.find({ board: boardId, isDeleted: false }).populate({
      path: "activities",
      match: { isDeleted: false },
    });

    const orderedLists = (board.listOrderIds || [])
      .map((listId) => lists.find((list) => list._id.toString() === listId.toString()))
      .filter((list) => list);

    const remainingLists = lists.filter((list) => !board.listOrderIds.includes(list._id));
    const finalLists = [...orderedLists, ...remainingLists];

    console.log("Found lists:", finalLists.map(l => ({ id: l._id.toString(), title: l.title })));

    res.status(200).json(finalLists);
  } catch (err) {
    console.error("Error in getListsByBoard:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Cập nhật cột
const updateList = async (req, res, io) => {
  try {
    const listId = req.params.id;
    const { title, position } = req.body;

    console.log("Updating list:", { listId, user: req.user?.email, body: req.body });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      console.log("Invalid listId:", listId);
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    if (title && typeof title !== "string") {
      console.log("Invalid title:", title);
      return res.status(400).json({ message: "Title phải là chuỗi!" });
    }

    if (position !== undefined && (typeof position !== "number" || position < 0)) {
      console.log("Invalid position:", position);
      return res.status(400).json({ message: "Position phải là số không âm!" });
    }

    const list = await List.findOne({ _id: listId, isDeleted: false });
    if (!list) {
      console.log("List not found or deleted:", listId);
      return res.status(404).json({ message: "Không tìm thấy cột hoặc cột đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: list.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", list.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      m => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền cập nhật cột này!" });
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (position !== undefined) updateData.position = position;

    const updatedList = await List.findByIdAndUpdate(listId, updateData, { new: true }).populate({
      path: "activities",
      match: { isDeleted: false },
    });
    if (!updatedList) {
      console.log("Failed to update list:", listId);
      return res.status(404).json({ message: "Không tìm thấy cột!" });
    }

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "list_updated",
      target: updatedList._id,
      targetModel: "List",
      details: `User ${userName} updated list "${updatedList.title}" in board "${board.title}"`,
    });
    await activity.save();
    updatedList.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([updatedList.save(), board.save()]);

    for (const member of board.members) {
      if (member.user.toString() !== req.user._id.toString() && member.isActive) {
        const notification = new Notification({
          user: member.user,
          message: `${userName} đã cập nhật list "${updatedList.title}" trong board "${board.title}"`,
          type: "activity",
          target: updatedList._id,
          targetModel: "List",
        });
        await notification.save();
        io.to(member.user.toString()).emit("new-notification", notification);
      }
    }

    console.log("List updated successfully:", { listId: updatedList._id.toString() });

    io.to(list.board.toString()).emit("list-updated", {
      list: updatedList,
      message: `List "${updatedList.title}" đã được cập nhật bởi ${userName}`,
    });

    res.status(200).json(updatedList);
  } catch (err) {
    console.error("Error in updateList:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Cập nhật thứ tự thẻ
const updateCardOrder = async (req, res, io) => {
  try {
    console.log("updateCardOrder called:", {
      listId: req.params.listId,
      cardOrder: req.body.cardOrder,
      userId: req.user?._id?.toString() || "unknown",
      userEmail: req.user?.email || "unknown",
      requestTime: new Date().toISOString(),
    });

    const { listId } = req.params;
    const { cardOrder } = req.body;

    // Kiểm tra user
    if (!req.user || !req.user._id) {
      console.log("No user found in req.user:", req.user);
      return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    }

    // Kiểm tra listId
    if (!mongoose.Types.ObjectId.isValid(listId)) {
      console.log("Invalid listId:", listId);
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    // Kiểm tra cardOrder
    if (!Array.isArray(cardOrder) || cardOrder.length === 0) {
      console.log("Invalid cardOrder:", cardOrder);
      return res.status(400).json({ message: "Danh sách thứ tự thẻ không hợp lệ!" });
    }

    // Tìm list
    console.log("Fetching list:", listId);
    const list = await List.findOne({ _id: listId, isDeleted: false });
    if (!list) {
      console.log("List not found or deleted:", listId);
      return res.status(404).json({ message: "List không tồn tại hoặc đã bị ẩn!" });
    }

    // Kiểm tra quyền
    console.log("Checking membership for user:", req.user._id.toString());
    const board = await Board.findOne({
      _id: list.board,
      isDeleted: false,
      "members.user": req.user._id,
      "members.isActive": true,
    });
    if (!board) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền cập nhật list này!" });
    }

    // Kiểm tra từng cardId trong cardOrder
    console.log("Validating cardOrder:", cardOrder);
    for (const cardId of cardOrder) {
      if (!mongoose.Types.ObjectId.isValid(cardId)) {
        console.log("Invalid cardId:", cardId);
        return res.status(400).json({ message: `Card ID ${cardId} không hợp lệ!` });
      }
      const card = await Card.findOne({ _id: cardId, isDeleted: false });
      if (!card) {
        console.log("Card not found or deleted:", cardId);
        return res.status(404).json({ message: `Card ${cardId} không tồn tại hoặc đã bị ẩn!` });
      }
      if (card.list.toString() !== listId) {
        console.log("Card does not belong to this list:", { cardId, listId });
        return res.status(400).json({ message: `Card ${cardId} không thuộc list này!` });
      }
    }

    // Cập nhật cardOrder
    console.log("Updating list.cardOrderIds:", cardOrder);
    list.cardOrderIds = cardOrder.map((id) => new mongoose.Types.ObjectId(id));
    await list.save();
    console.log("List saved successfully");

    // Tạo activity
    const userName = req.user.fullName || req.user.email || "Unknown User";
    console.log("Creating activity for user:", userName);
    const activity = new Activity({
      user: req.user._id,
      action: "card-order",
      target: list._id,
      targetModel: "List",
      details: `User ${userName} updated card order in list "${list.title}"`,
    });
    await activity.save();
    console.log("Activity saved successfully");

    // Cập nhật activities của board
    board.activities = board.activities || [];
    board.activities.push(activity._id);
    await board.save();

    // Phát sự kiện Socket.IO tới tất cả client
    console.log("Emitting card-order-updated event");
    io.to(list.board.toString()).emit("card-order-updated", {
      listId,
      cardOrder,
      message: `Thứ tự thẻ trong list "${list.title}" đã được cập nhật bởi ${userName}`,
    });

    console.log("updateCardOrder completed successfully");
    return res.status(200).json({ message: "Cập nhật thứ tự thẻ thành công" });
  } catch (err) {
    console.error("Error in updateCardOrder:", {
      message: err.message,
      stack: err.stack,
      listId: req.params.listId,
      cardOrder: req.body.cardOrder,
      userId: req.user?._id?.toString() || "unknown",
      requestTime: new Date().toISOString(),
    });
    return res.status(500).json({ message: "Lỗi server khi cập nhật thứ tự thẻ", error: err.message });
  }
};
// Xóa cột
const deleteList = async (req, res, io) => {
  try {
    const listId = req.params.id;

    console.log("Deleting list:", { listId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      console.log("Invalid listId:", listId);
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    const list = await List.findOne({ _id: listId, isDeleted: false });
    if (!list) {
      console.log("List not found or deleted:", listId);
      return res.status(404).json({ message: "Không tìm thấy cột hoặc cột đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: list.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", list.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      m => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền xóa cột này!" });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      console.log("Only board owner can delete list:", req.user._id.toString());
      return res.status(403).json({ message: "Chỉ chủ board mới có quyền xóa cột!" });
    }

    console.log("Card model:", Card);
    if (!Card) {
      console.error("Card model is not defined");
      return res.status(500).json({ message: "Model Card không được định nghĩa!" });
    }
    await Card.updateMany({ list: list._id, isDeleted: false }, { $set: { isDeleted: true } });

    board.listOrderIds = await Promise.all(
      board.listOrderIds.map(async (id) => {
        const existingList = await List.findOne({ _id: id, isDeleted: false });
        return existingList ? id : null;
      })
    );
    board.listOrderIds = board.listOrderIds.filter(id => id);
    await board.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "list_hidden",
      target: list._id,
      targetModel: "List",
      details: `User ${userName} hid list "${list.title}" from board "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    list.isDeleted = true;
    await list.save();

    for (const member of board.members) {
      if (member.user.toString() !== req.user._id.toString() && member.isActive) {
        const notification = new Notification({
          user: member.user,
          message: `${userName} đã ẩn list "${list.title}" khỏi board "${board.title}"`,
          type: "activity",
          target: list._id,
          targetModel: "List",
        });
        await notification.save();
        io.to(member.user.toString()).emit("new-notification", notification);
      }
    }

    console.log("List hidden successfully:", { listId });

    io.to(board._id.toString()).emit("list-hidden", {
      listId: req.params.id,
      message: `List "${list.title}" đã bị ẩn bởi ${userName}`,
    });

    res.status(200).json({ message: "Đã ẩn cột thành công" });
  } catch (err) {
    console.error("Error in deleteList:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server khi ẩn cột", error: err.message });
  }
};

// Cập nhật thứ tự cột
const updateListOrder = async (req, res, io) => {
  try {
    console.log("updateListOrder called:", {
      boardId: req.params.boardId,
      columnOrder: req.body.columnOrder,
      userId: req.user?._id?.toString() || "unknown",
      userEmail: req.user?.email || "unknown",
      requestTime: new Date().toISOString(),
    });

    const { boardId } = req.params;
    const { columnOrder } = req.body;

    // Kiểm tra user
    if (!req.user || !req.user._id) {
      console.log("No user found in req.user:", req.user);
      return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    }

    // Kiểm tra boardId
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      console.log("Invalid boardId:", boardId);
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    // Kiểm tra columnOrder
    if (!Array.isArray(columnOrder) || columnOrder.length === 0) {
      console.log("Invalid columnOrder:", columnOrder);
      return res.status(400).json({ message: "Danh sách thứ tự cột không hợp lệ!" });
    }

    // Tìm board
    console.log("Fetching board:", boardId);
    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", boardId);
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    // Kiểm tra quyền thành viên
    console.log("Checking membership for user:", req.user._id.toString());
    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền cập nhật board này!" });
    }

    // Kiểm tra từng listId trong columnOrder
    console.log("Validating columnOrder:", columnOrder);
    for (const listId of columnOrder) {
      if (!mongoose.Types.ObjectId.isValid(listId)) {
        console.log("Invalid listId:", listId);
        return res.status(400).json({ message: `List ID ${listId} không hợp lệ!` });
      }
      const list = await List.findOne({ _id: listId, isDeleted: false });
      if (!list) {
        console.log("List not found or deleted:", listId);
        return res.status(404).json({ message: `List ${listId} không tồn tại hoặc đã bị ẩn!` });
      }
      if (list.board.toString() !== boardId) {
        console.log("List does not belong to this board:", { listId, boardId });
        return res.status(400).json({ message: `List ${listId} không thuộc board này!` });
      }
    }

    // Cập nhật listOrderIds
    console.log("Updating board.listOrderIds:", columnOrder);
    board.listOrderIds = columnOrder.map((id) => new mongoose.Types.ObjectId(id));
    await board.save();
    console.log("Board saved successfully");

    // Tạo activity
    const userName = req.user.fullName || req.user.email || "Unknown User";
    console.log("Creating activity for user:", userName);
    const activity = new Activity({
      user: req.user._id,
      action: "list-order", // Sử dụng giá trị hợp lệ từ enum
      target: board._id,
      targetModel: "Board",
      details: `User ${userName} updated list order in board "${board.title}"`,
    });
    await activity.save();
    console.log("Activity saved successfully");

    // Cập nhật activities của board
    console.log("Updating board activities");
    board.activities = board.activities || [];
    board.activities.push(activity._id);
    await board.save();
    console.log("Board activities updated successfully");

    // Phát sự kiện Socket.IO
    console.log("Emitting list-order-updated event");
    io.to(boardId).emit("list-order-updated", {
      boardId,
      columnOrder,
      message: `Thứ tự cột trong board "${board.title}" đã được cập nhật bởi ${userName}`,
    });

    console.log("updateListOrder completed successfully");
    return res.status(200).json({ message: "Cập nhật thứ tự cột thành công" });
  } catch (err) {
    console.error("Error in updateListOrder:", {
      message: err.message,
      stack: err.stack,
      boardId: req.params.boardId,
      columnOrder: req.body.columnOrder,
      userId: req.user?._id?.toString() || "unknown",
      requestTime: new Date().toISOString(),
    });
    return res.status(500).json({ message: "Lỗi server khi cập nhật thứ tự cột", error: err.message });
  }
};
const getListById = async (req, res) => {
  try {
    const listId = req.params.listId;

    console.log("Fetching list:", { listId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      console.log("Invalid listId:", listId);
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    const list = await List.findOne({ _id: listId, isDeleted: false }).populate({
      path: "activities",
      match: { isHidden: false },
    });

    if (!list) {
      console.log("List not found or deleted:", listId);
      return res.status(404).json({ message: "Danh sách không tồn tại hoặc đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: list.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", list.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền truy cập danh sách này!" });
    }

    // Lấy danh sách thẻ trong danh sách
    const cards = await Card.find({ list: listId, isDeleted: false });

    console.log("Found list:", { id: list._id.toString(), title: list.title, cards: cards.length });

    res.status(200).json({ ...list.toObject(), cards });
  } catch (err) {
    console.error("Error in getListById:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};
module.exports = {
  createList,
  getListsByBoard,
  updateList,
  deleteList,
  updateCardOrder,
  updateListOrder,
  getListById,
};