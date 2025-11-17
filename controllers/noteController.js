const mongoose = require("mongoose");
const Card = require("../models/Card");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Note = require("../models/Note"); 
const Notification = require("../models/Notification");
const User = require("../models/User");

const addNote = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { content } = req.body;
    const userId = req.user?._id;

    if (!userId || !req.user?.fullName || !req.user?.email) {
      return res.status(401).json({ message: "Thông tin người dùng không đầy đủ!" });
    }
    if (!content || typeof content !== "string") {
      return res.status(400).json({ message: "Nội dung ghi chú là bắt buộc và phải là chuỗi!" });
    }
    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền thêm ghi chú vào thẻ này!" });

    // Tạo Note document riêng
    const note = new Note({
      content,
      createdBy: userId,
      card: cardId,
      isDeleted: false,
    });
    await note.save();

    // Thêm note ID vào card
    card.notes.push(note._id);

    const activity = new Activity({
      user: userId,
      action: { category: "note", type: "added" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} added note "${content}" to card "${card.title}"`,
    });
    await activity.save();

    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    // Populate note để trả về
    await note.populate("createdBy", "fullName email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("note-added", {
        cardId,
        note: {
          _id: note._id,
          content: note.content,
          createdBy: note.createdBy,
          createdAt: note.createdAt,
          isDeleted: note.isDeleted,
        },
        boardId: card.board.toString(),
        message: `${req.user.fullName} đã thêm ghi chú "${content}" vào card "${card.title}"`,
      });
    }

    // Chỉ trả về note mới
    res.status(200).json(note);
  } catch (error) {
    console.error("addNote error:", error.message);
    res.status(500).json({ message: "Lỗi khi thêm ghi chú" });
  }
};
const hideNote = async (req, res) => {
  try {
    const { cardId, noteId } = req.params;
    const userId = req.user?._id;
    
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Card ID hoặc note ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền thu hồi ghi chú!" });

    // Tìm note trong Note collection
    const note = await Note.findOne({ _id: noteId, card: cardId, isDeleted: false });
    if (!note) return res.status(404).json({ message: "Không tìm thấy ghi chú!" });
    
    // Kiểm tra quyền sở hữu hoặc board owner
    const isBoardOwner = board.owner?.toString() === userId.toString();
    if (note.createdBy.toString() !== userId.toString() && !isBoardOwner) {
      return res.status(403).json({ message: "Bạn chỉ có thể thu hồi ghi chú của chính mình!" });
    }

    // Đánh dấu note là deleted
    note.isDeleted = true;
    await note.save();

    const activity = new Activity({
      user: userId,
      action: { category: "note", type: "hidden" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} hid note "${note.content}" in card "${card.title}"`,
    });
    await activity.save();
    
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("note-hidden", {
        cardId,
        noteId,
        boardId: card.board.toString(),
        message: `${req.user.fullName} đã thu hồi ghi chú trong card "${card.title}"`,
      });
    }

    res.status(200).json({ message: "Đã thu hồi ghi chú" });
  } catch (error) {
    console.error("hideNote error:", error.message);
    res.status(500).json({ message: "Lỗi khi thu hồi ghi chú" });
  }
};

module.exports = {
  addNote,
  hideNote,
};