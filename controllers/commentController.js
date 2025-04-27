const mongoose = require("mongoose");
const Card = require("../models/Card");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

// Thêm bình luận
const addComment = async (req, res, io) => {
  const { cardId } = req.params;
  const { text } = req.body;

  try {
    console.log("Adding comment:", { cardId, text, user: req.user });

    // Kiểm tra req.user đầy đủ
    if (!req.user || !req.user._id || !req.user.fullName || !req.user.email) {
      console.error("Invalid req.user:", req.user);
      return res.status(401).json({ message: "Thông tin người dùng không đầy đủ!" });
    }

    if (!text || typeof text !== "string") {
      return res.status(400).json({ message: "Nội dung bình luận là bắt buộc và phải là chuỗi!" });
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
      return res.status(403).json({ message: "Bạn không có quyền bình luận trên thẻ này!" });
    }

    const comment = {
      _id: new mongoose.Types.ObjectId(),
      user: req.user._id,
      text,
      createdAt: new Date(),
      isDeleted: false,
    };

    card.comments.push(comment);
    await card.save();
    console.log("Saved card.comments:", card.comments);

    // Populate user để đảm bảo dữ liệu đầy đủ
    await card.populate("comments.user");
    console.log("Populated card.comments:", card.comments);

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "comment_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added comment "${text}" to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    // Tạo comment để phát sự kiện với thông tin từ populated user
    const populatedComment = card.comments.find(c => c._id.toString() === comment._id.toString());
    io.to(card.board.toString()).emit("comment-added", {
      cardId,
      comment: {
        _id: comment._id,
        user: {
          _id: req.user._id,
          fullName: populatedComment.user?.fullName || req.user.fullName || "Unknown User",
          email: populatedComment.user?.email || req.user.email || "",
          avatar: populatedComment.user?.avatar || "",
        },
        text,
        createdAt: comment.createdAt,
        isDeleted: comment.isDeleted,
      },
      boardId: card.board.toString(),
      message: `${userName} đã thêm bình luận "${text}" vào card "${card.title}"`,
    });
    console.log("Emitted comment-added with comment:", {
      cardId,
      comment: {
        _id: comment._id,
        user: {
          _id: req.user._id,
          fullName: populatedComment.user?.fullName || req.user.fullName,
          email: populatedComment.user?.email || req.user.email,
        },
      },
    });

    console.log("Returning card.comments:", card.comments);
    res.status(200).json(card.comments);
  } catch (err) {
    console.error("Error in addComment:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm bình luận", error: err.message });
  }
};

// Thu hồi (ẩn) bình luận
const hideComment = async (req, res, io) => {
  const { cardId, commentId } = req.params;

  try {
    console.log("Hiding comment:", { cardId, commentId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: "Card ID hoặc comment ID không hợp lệ!" });
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
      return res.status(403).json({ message: "Bạn không có quyền thu hồi bình luận!" });
    }

    const comment = card.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Không tìm thấy bình luận!" });
    }

    if (comment.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Bạn chỉ có thể thu hồi bình luận của chính mình!" });
    }

    if (comment.isDeleted) {
      return res.status(400).json({ message: "Bình luận đã được thu hồi trước đó!" });
    }

    comment.isDeleted = true;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "comment_hidden",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} hid comment "${comment.text}" in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    for (const memberId of card.members) {
      if (memberId.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: memberId,
          message: `${userName} đã thu hồi một bình luận trong card "${card.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        await notification.save();
        io.to(memberId.toString()).emit("new-notification", notification);
      }
    }

    io.to(card.board.toString()).emit("comment-hidden", {
      cardId,
      commentId,
      boardId: card.board.toString(),
      message: `${userName} đã thu hồi bình luận trong card "${card.title}"`,
    });

    console.log("Comment hidden successfully:", { cardId, commentId });

    res.status(200).json({ message: "Đã thu hồi bình luận" });
  } catch (err) {
    console.error("Error in hideComment:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thu hồi bình luận", error: err.message });
  }
};

module.exports = {
  addComment,
  hideComment,
};