const mongoose = require("mongoose");
const Card = require("../models/Card");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

// Thêm ghi chú
const addNote = async (req, res, io) => {
  const { cardId } = req.params;
  const { content } = req.body;

  try {
    console.log("Adding note:", { cardId, content, user: req.user });

    // Kiểm tra req.user đầy đủ
    if (!req.user || !req.user._id || !req.user.fullName || !req.user.email) {
      console.error("Invalid req.user:", req.user);
      return res.status(401).json({ message: "Thông tin người dùng không đầy đủ!" });
    }

    if (!content || typeof content !== "string") {
      return res.status(400).json({ message: "Nội dung ghi chú là bắt buộc và phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
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
      return res.status(403).json({ message: "Bạn không có quyền thêm ghi chú vào thẻ này!" });
    }

    const note = {
      _id: new mongoose.Types.ObjectId(),
      content,
      createdBy: req.user._id,
      createdAt: new Date(),
      isDeleted: false,
    };

    card.notes.push(note);
    await card.save();
    console.log("Saved card.notes:", card.notes);

    // Populate createdBy để đảm bảo dữ liệu đầy đủ
    await card.populate("notes.createdBy");
    console.log("Populated card.notes:", card.notes);

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "note_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added note "${content}" to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    // Tạo note để phát sự kiện với thông tin từ populated createdBy
    const populatedNote = card.notes.find(n => n._id.toString() === note._id.toString());
    io.to(card.board.toString()).emit("note-added", {
      cardId,
      note: {
        _id: note._id,
        content,
        createdBy: {
          _id: req.user._id,
          fullName: populatedNote.createdBy?.fullName || req.user.fullName || "Unknown User",
          email: populatedNote.createdBy?.email || req.user.email || "",
          avatar: populatedNote.createdBy?.avatar || "",
        },
        createdAt: note.createdAt,
        isDeleted: note.isDeleted,
      },
      boardId: card.board.toString(),
      message: `${userName} đã thêm ghi chú "${content}" vào card "${card.title}"`,
    });
    console.log("Emitted note-added with note:", {
      cardId,
      note: {
        _id: note._id,
        content,
        createdBy: {
          _id: req.user._id,
          fullName: populatedNote.createdBy?.fullName || req.user.fullName,
          email: populatedNote.createdBy?.email || req.user.email,
        },
      },
    });

    console.log("Returning card.notes:", card.notes);
    res.status(200).json(card.notes);
  } catch (err) {
    console.error("Error in addNote:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm ghi chú", error: err.message });
  }
};

// Thu hồi (ẩn) ghi chú
const hideNote = async (req, res, io) => {
  const { cardId, noteId } = req.params;

  try {
    console.log("Hiding note:", { cardId, noteId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Card ID hoặc note ID không hợp lệ!" });
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
      return res.status(403).json({ message: "Bạn không có quyền thu hồi ghi chú!" });
    }

    const note = card.notes.id(noteId);
    if (!note) {
      return res.status(404).json({ message: "Không tìm thấy ghi chú!" });
    }

    if (note.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn chỉ có thể thu hồi ghi chú của chính mình!" });
    }

    if (note.isDeleted) {
      return res.status(400).json({ message: "Ghi chú đã được thu hồi trước đó!" });
    }

    note.isDeleted = true;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "note_hidden",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} hid note "${note.content}" in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    for (const memberId of card.members) {
      if (memberId.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: memberId,
          message: `${userName} đã thu hồi một ghi chú trong card "${card.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        await notification.save();
        io.to(memberId.toString()).emit("new-notification", notification);
      }
    }

    io.to(card.board.toString()).emit("note-hidden", {
      cardId,
      noteId,
      boardId: card.board.toString(),
      message: `${userName} đã thu hồi ghi chú trong card "${card.title}"`,
    });

    console.log("Note hidden successfully:", { cardId, noteId });

    res.status(200).json({ message: "Đã thu hồi ghi chú" });
  } catch (err) {
    console.error("Error in hideNote:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thu hồi ghi chú", error: err.message });
  }
};

module.exports = {
  addNote,
  hideNote,
};