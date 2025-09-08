const mongoose = require("mongoose");
const Card = require("../models/Card");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Comment = require("../models/Comment"); // Import Comment model
const Notification = require("../models/Notification");
const User = require("../models/User");

const addComment = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { text } = req.body;
    const userId = req.user?._id;

    if (!userId || !req.user?.fullName || !req.user?.email) {
      return res.status(401).json({ message: "Thông tin người dùng không đầy đủ!" });
    }
    if (!text || typeof text !== "string") {
      return res.status(400).json({ message: "Nội dung bình luận là bắt buộc và phải là chuỗi!" });
    }
    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    // Kiểm tra quyền: Chỉ thành viên card được phép bình luận
    const isMember = card.members.some((m) => m.toString() === userId.toString());
    if (!isMember) return res.status(403).json({ message: "Bạn không phải thành viên của thẻ này để bình luận!" });

    // Tạo Comment document riêng
    const comment = new Comment({
      user: userId,
      card: cardId,
      text,
      isDeleted: false,
    });
    await comment.save();

    // Thêm comment ID vào card
    card.comments.push(comment._id);

    const activity = new Activity({
      user: userId,
      action: { category: "comment", type: "added" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} added comment "${text}" to card "${card.title}"`,
    });
    await activity.save();

    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    // Populate comment để trả về
    await comment.populate("user", "fullName email avatar");

    const io = req.app.get("io");
    if (io) {
      // Chỉ gửi sự kiện đến các thành viên trong card
      const memberSockets = card.members.map((m) => m.toString());
      memberSockets.forEach((memberId) => {
        io.to(memberId).emit("comment-added", {
          cardId,
          comment: {
            _id: comment._id,
            user: comment.user,
            text: comment.text,
            createdAt: comment.createdAt,
            isDeleted: comment.isDeleted,
          },
          boardId: card.board.toString(),
          message: `${req.user.fullName} đã thêm bình luận "${text}" vào card "${card.title}"`,
        });
      });
    }

    // Chỉ trả về comment mới
    res.status(200).json(comment);
  } catch (error) {
    console.error("addComment error:", error.message);
    res.status(500).json({ message: "Lỗi khi thêm bình luận" });
  }
};

const hideComment = async (req, res) => {
  try {
    const { cardId, commentId } = req.params;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: "Card ID hoặc comment ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    // Kiểm tra quyền: Chỉ thành viên card được phép ẩn bình luận
    const isMember = card.members.some((m) => m.toString() === userId.toString());
    const isBoardOwner = board.owner?.toString() === userId.toString();
    if (!isMember && !isBoardOwner) {
      return res.status(403).json({ message: "Bạn không phải thành viên của thẻ này hoặc chủ sở hữu board để thu hồi bình luận!" });
    }

    // Tìm comment trong Comment collection
    const comment = await Comment.findOne({ _id: commentId, card: cardId, isDeleted: false });
    if (!comment) return res.status(404).json({ message: "Không tìm thấy bình luận!" });

    // Kiểm tra quyền sở hữu bình luận hoặc board owner
    if (comment.user.toString() !== userId.toString() && !isBoardOwner) {
      return res.status(403).json({ message: "Bạn chỉ có thể thu hồi bình luận của chính mình!" });
    }

    // Đánh dấu comment là deleted
    comment.isDeleted = true;
    await comment.save();

    const activity = new Activity({
      user: userId,
      action: { category: "comment", type: "hidden" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} hid comment "${comment.text}" in card "${card.title}"`,
    });
    await activity.save();

    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const io = req.app.get("io");
    if (io) {
      // Chỉ gửi sự kiện đến các thành viên trong card
      const memberSockets = card.members.map((m) => m.toString());
      memberSockets.forEach((memberId) => {
        io.to(memberId).emit("comment-hidden", {
          cardId,
          commentId,
          boardId: card.board.toString(),
          message: `${req.user.fullName} đã thu hồi bình luận trong card "${card.title}"`,
        });
      });
    }

    res.status(200).json({ message: "Đã thu hồi bình luận" });
  } catch (error) {
    console.error("hideComment error:", error.message);
    res.status(500).json({ message: "Lỗi khi thu hồi bình luận" });
  }
};

module.exports = {
  addComment,
  hideComment,
};