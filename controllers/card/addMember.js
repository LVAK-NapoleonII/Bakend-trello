const mongoose = require("mongoose");
const Card = require("../../models/Card");
const Board = require("../../models/Board");
const User = require("../../models/User");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");

const addMember = async (req, res) => {
  try {
    const { cardId } = req.params;
    const { memberId } = req.body;
    const userId = req.user?._id;

    console.log("addMember called with:", {
      cardId,
      memberId,
      userId: userId?.toString(),
    });

    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: "ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const isOwner = board.owner.toString() === userId.toString();
    const isMember = board.members.some(m => m.user?.toString() === userId.toString() && m.isActive);
    if (!isOwner && !isMember) {
      return res.status(403).json({ message: "Không có quyền!" });
    }

    const isBoardMember = board.members.some(m => m.user?.toString() === memberId && m.isActive);
    if (!isBoardMember) {
      return res.status(400).json({ message: "Member không thuộc board!" });
    }

    // KIỂM TRA TRÙNG TRONG CARD
    if (card.members.some(m => m.toString() === memberId)) {
      return res.status(400).json({ message: "Member đã có trong thẻ!" });
    }


    card.members.push(new mongoose.Types.ObjectId(memberId));
    
    // Tăng version để tránh conflict
    card.version = (card.version || 0) + 1;
    
    await card.save();

    const memberUser = await User.findById(memberId).select("_id fullName email avatar isOnline");
    
    if (!memberUser) {
      return res.status(404).json({ message: "Không tìm thấy user!" });
    }

    // GHI HOẠT ĐỘNG
    const activity = new Activity({
      user: userId,
      action: { category: "member", type: "added" },
      target: cardId,
      targetModel: "Card",
      details: `${req.user.fullName} đã thêm ${memberUser.fullName} vào thẻ "${card.title}"`,
    });
    await activity.save();

    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([board.save()]);


    const populatedCard = await Card.findById(cardId)
      .populate("members", "_id fullName email avatar isOnline")
      .populate({
        path: "comments",
        match: { isDeleted: false },
        populate: { path: "user", select: "_id fullName email avatar isOnline" }
      })
      .populate({
        path: "notes",
        match: { isDeleted: false },
        populate: { path: "createdBy", select: "_id fullName email avatar isOnline" }
      })
      .populate({ path: "activities", match: { isDeleted: false } })
      .lean();

    // GỬI SOCKET REALTIME
    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("member-added", {
        cardId,
        member: {
          _id: memberUser._id,
          fullName: memberUser.fullName,
          email: memberUser.email,
          avatar: memberUser.avatar,
          isOnline: memberUser.isOnline,
          isActive: true,
        },
        message: `${req.user.fullName} đã thêm ${memberUser.fullName} vào thẻ`,
      });

      // Gửi notification cho member được thêm
      const notification = new Notification({
        user: memberId,
        message: `Bạn đã được thêm vào thẻ "${card.title}" bởi ${req.user.fullName}`,
        type: "activity",
        target: cardId,
        targetModel: "Card",
        isRead: false,
        isHidden: false,
      });
      await notification.save();
      io.to(memberId.toString()).emit("new-notification", notification);
    }


    res.status(200).json({ 
      message: "Thêm thành viên thành công!", 
      card: populatedCard,
      version: card.version
    });
  } catch (error) {
    console.error("addMember error:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = addMember;

