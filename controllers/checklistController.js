const mongoose = require("mongoose");
const Card = require("../models/Card");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

// Thêm checklist
const addChecklist = async (req, res, io) => {
  const { cardId } = req.params;
  const { title } = req.body;

  try {
    console.log("Adding checklist:", { cardId, title, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!title || typeof title !== "string") {
      console.log("Invalid title:", title);
      return res.status(400).json({ message: "Title là bắt buộc và phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền thêm checklist vào thẻ này!" });
    }

    const checklist = {
      _id: new mongoose.Types.ObjectId(),
      title,
      items: [],
    };

    card.checklists.push(checklist);
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "checklist_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added checklist "${title}" to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    io.to(card.board.toString()).emit("checklist-added", {
      cardId,
      checklist,
      boardId: card.board.toString(),
      message: `${userName} đã thêm checklist "${title}" vào card "${card.title}"`,
    });

    console.log("Checklist added successfully:", { cardId, checklistId: checklist._id });

    res.status(200).json(card.checklists);
  } catch (err) {
    console.error("Error in addChecklist:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm checklist", error: err.message });
  }
};

// Thêm item vào checklist
const addChecklistItem = async (req, res, io) => {
  const { cardId, checklistId } = req.params;
  const { text, version } = req.body;

  try {
    console.log("Adding checklist item:", { cardId, checklistId, text, user: req.user?.email });

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!text || typeof text !== "string") {
      return res.status(400).json({ message: "Text là bắt buộc và phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId)) {
      return res.status(400).json({ message: "Card ID hoặc checklist ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    if (version !== undefined && card.version !== version) {
      return res.status(409).json({ message: "Xung đột dữ liệu, vui lòng làm mới!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền thêm item vào checklist này!" });
    }

    const checklist = card.checklists.id(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: "Không tìm thấy checklist!" });
    }

    const newItem = {
      _id: new mongoose.Types.ObjectId(),
      text,
      completed: false,
      createdAt: new Date(),
    };

    checklist.items.push(newItem);
    card.version += 1;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "checklist_item_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added item "${text}" to checklist in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    io.to(card.board.toString()).emit("checklist-item-added", {
      cardId,
      checklistId,
      item: newItem,
      checklist: {
        _id: checklist._id,
        title: checklist.title,
        items: checklist.items,
      },
      boardId: card.board.toString(),
      message: `${userName} đã thêm item "${text}" vào checklist trong card "${card.title}"`,
      actorId: req.user._id.toString(),
    });

    console.log("Checklist item added successfully:", { cardId, checklistId, text });

    res.status(200).json({ checklists: card.checklists, version: card.version });
  } catch (err) {
    console.error("Error in addChecklistItem:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm item vào checklist", error: err.message });
  }
};

// Đánh dấu hoàn thành/không hoàn thành checklist item
const toggleChecklistItem = async (req, res, io) => {
  const { cardId, checklistId, itemId } = req.params;
  const { version } = req.body;

  try {
    console.log("Toggling checklist item:", {
      cardId,
      checklistId,
      itemId,
      user: req.user?.email,
    });

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Card ID, checklist ID hoặc item ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    if (version !== undefined && card.version !== version) {
      return res.status(409).json({ message: "Xung đột dữ liệu, vui lòng làm mới!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật checklist này!" });
    }

    const checklist = card.checklists.id(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: "Không tìm thấy checklist!" });
    }

    const item = checklist.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy item!" });
    }

    item.completed = !item.completed;
    card.version += 1;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const action = item.completed ? "checklist_item_completed" : "checklist_item_uncompleted";
    const activity = new Activity({
      user: req.user._id,
      action,
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} ${item.completed ? "completed" : "uncompleted"} item "${item.text}" in checklist of card "${card.title}"`,
    });
    await activity.save();

    card.activities = card.activities || [];
    card.activities.push(activity._id);
    board.activities = board.activities || [];
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    for (const memberId of card.members) {
      if (memberId.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: memberId,
          message: `${userName} đã ${item.completed ? "hoàn thành" : "bỏ hoàn thành"} item "${item.text}" trong card "${card.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        await notification.save();
        io.to(memberId.toString()).emit("new-notification", notification);
      }
    }

    io.to(card.board.toString()).emit("checklist-item-toggled", {
      cardId,
      checklistId,
      itemId,
      completed: item.completed,
      checklist: {
        _id: checklist._id,
        title: checklist.title,
        items: checklist.items,
      },
      boardId: card.board.toString(),
      message: `${userName} đã ${item.completed ? "hoàn thành" : "bỏ hoàn thành"} item "${item.text}" trong card "${card.title}"`,
      actorId: req.user._id.toString(),
    });

    console.log("Checklist item toggled successfully:", {
      cardId,
      checklistId,
      itemId,
      completed: item.completed,
    });

    res.status(200).json({ checklists: card.checklists, version: card.version });
  } catch (err) {
    console.error("Error in toggleChecklistItem:", {
      message: err.message,
      stack: err.stack,
      cardId,
      checklistId,
      itemId,
      userId: req.user?._id?.toString(),
    });
    res.status(500).json({ message: "Lỗi khi cập nhật trạng thái checklist item", error: err.message });
  }
};

// Sửa tiêu đề checklist
const editChecklist = async (req, res, io) => {
  const { cardId, checklistId } = req.params;
  const { title } = req.body;

  try {
    console.log("Editing checklist:", { cardId, checklistId, title, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId)) {
      console.log("Invalid IDs:", { cardId, checklistId });
      return res.status(400).json({ message: "Card ID hoặc checklist ID không hợp lệ!" });
    }

    if (!title || typeof title !== "string") {
      console.log("Invalid title:", title);
      return res.status(400).json({ message: "Tiêu đề checklist là bắt buộc và phải là chuỗi!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền sửa checklist này!" });
    }

    const checklist = card.checklists.id(checklistId);
    if (!checklist) {
      console.log("Checklist not found:", checklistId);
      return res.status(404).json({ message: "Không tìm thấy checklist!" });
    }

    checklist.title = title;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "checklist_updated",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} updated checklist title to "${title}" in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    io.to(card.board.toString()).emit("checklist-updated", {
      cardId,
      checklistId,
      title,
      checklist: {
        _id: checklist._id,
        title: checklist.title,
        items: checklist.items,
      },
      boardId: card.board.toString(),
      message: `${userName} đã cập nhật tiêu đề checklist thành "${title}" trong card "${card.title}"`,
    });

    console.log("Checklist updated successfully:", { cardId, checklistId, title });

    res.status(200).json(card.checklists);
  } catch (err) {
    console.error("Error in editChecklist:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi sửa checklist", error: err.message });
  }
};

// Xóa checklist
const deleteChecklist = async (req, res, io) => {
  const { cardId, checklistId } = req.params;

  try {
    console.log("Deleting checklist:", { cardId, checklistId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId)) {
      return res.status(400).json({ message: "Card ID hoặc checklist ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền xóa checklist này!" });
    }

    const checklist = card.checklists.id(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: "Không tìm thấy checklist!" });
    }

    if (checklist.isDeleted) {
      return res.status(400).json({ message: "Checklist đã được xóa trước đó!" });
    }

    const checklistTitle = checklist.title;
    checklist.isDeleted = true;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "checklist_deleted",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} deleted checklist "${checklistTitle}" in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const notificationPromises = card.members
      .filter((memberId) => memberId.toString() !== req.user._id.toString())
      .map((memberId) => {
        const notification = new Notification({
          user: memberId,
          message: `${userName} đã xóa checklist "${checklistTitle}" trong card "${card.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        return notification.save().then(() => {
          io.to(memberId.toString()).emit("new-notification", notification);
        });
      });
    await Promise.all(notificationPromises);

    io.to(card.board.toString()).emit("checklist-deleted", {
      cardId,
      checklistId,
      boardId: card.board.toString(),
      message: `${userName} đã xóa checklist "${checklistTitle}" trong card "${card.title}"`,
    });

    console.log("Checklist deleted successfully:", { cardId, checklistId });

    res.status(200).json(card.checklists);
  } catch (err) {
    console.error("Error in deleteChecklist:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi xóa checklist", error: err.message });
  }
};

// Sửa checklist item
const editChecklistItem = async (req, res, io) => {
  const { cardId, checklistId, itemId } = req.params;
  const { text } = req.body;

  try {
    console.log("Editing checklist item:", {
      cardId,
      checklistId,
      itemId,
      text,
      user: req.user?.email,
    });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      console.log("Invalid IDs:", { cardId, checklistId, itemId });
      return res.status(400).json({ message: "Card ID, checklist ID hoặc item ID không hợp lệ!" });
    }

    if (!text || typeof text !== "string") {
      console.log("Invalid text:", text);
      return res.status(400).json({ message: "Nội dung item là bắt buộc và phải là chuỗi!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền sửa checklist item này!" });
    }

    const checklist = card.checklists.id(checklistId);
    if (!checklist) {
      console.log("Checklist not found:", checklistId);
      return res.status(404).json({ message: "Không tìm thấy checklist!" });
    }

    const item = checklist.items.id(itemId);
    if (!item) {
      console.log("Item not found:", itemId);
      return res.status(404).json({ message: "Không tìm thấy item!" });
    }

    item.text = text;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "checklist_item_updated",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} updated checklist item to "${text}" in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    io.to(card.board.toString()).emit("checklist-item-updated", {
      cardId,
      checklistId,
      itemId,
      item,
      checklist: {
        _id: checklist._id,
        title: checklist.title,
        items: checklist.items,
      },
      boardId: card.board.toString(),
      message: `${userName} đã cập nhật item "${text}" trong checklist của card "${card.title}"`,
    });

    console.log("Checklist item updated successfully:", {
      cardId,
      checklistId,
      itemId,
      text,
    });

    res.status(200).json(card.checklists);
  } catch (err) {
    console.error("Error in editChecklistItem:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi sửa checklist item", error: err.message });
  }
};

// Xóa checklist item
const deleteChecklistItem = async (req, res, io) => {
  const { cardId, checklistId, itemId } = req.params;

  try {
    console.log("Deleting checklist item:", { cardId, checklistId, itemId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(checklistId) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Card ID, checklist ID hoặc item ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false }).populate("members.user");
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền xóa checklist item này!" });
    }

    const checklist = card.checklists.id(checklistId);
    if (!checklist) {
      return res.status(404).json({ message: "Không tìm thấy checklist!" });
    }

    const item = checklist.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy item!" });
    }

    if (item.isDeleted) {
      return res.status(400).json({ message: "Item đã được xóa trước đó!" });
    }

    const itemText = item.text;
    item.isDeleted = true;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "checklist_item_deleted",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} deleted item "${itemText}" from checklist in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const notificationPromises = card.members
      .filter((memberId) => memberId.toString() !== req.user._id.toString())
      .map((memberId) => {
        const notification = new Notification({
          user: memberId,
          message: `${userName} đã xóa item "${itemText}" khỏi checklist trong card "${card.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        return notification.save().then(() => {
          io.to(memberId.toString()).emit("new-notification", notification);
        });
      });
    await Promise.all(notificationPromises);

    io.to(card.board.toString()).emit("checklist-item-deleted", {
      cardId,
      checklistId,
      itemId,
      checklist: {
        _id: checklist._id,
        title: checklist.title,
        items: checklist.items,
      },
      boardId: card.board.toString(),
      message: `${userName} đã xóa item "${itemText}" khỏi checklist trong card "${card.title}"`,
    });

    console.log("Checklist item deleted successfully:", { cardId, checklistId, itemId });

    res.status(200).json(card.checklists);
  } catch (err) {
    console.error("Error in deleteChecklistItem:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi xóa checklist item", error: err.message });
  }
};

module.exports = {
  addChecklist,
  addChecklistItem,
  toggleChecklistItem,
  editChecklist,
  deleteChecklist,
  editChecklistItem,
  deleteChecklistItem,
};