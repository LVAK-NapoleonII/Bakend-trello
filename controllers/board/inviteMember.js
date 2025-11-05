const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const Board = require("../../models/Board");
const User = require("../../models/User");
const Workspace = require("../../models/Workspace");
const Activity = require("../../models/Activity");
const Notification = require("../../models/Notification");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const inviteMember = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { email, userId } = req.body;
    const actorId = req.user?._id;
    if (!actorId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(boardId)) return res.status(400).json({ message: "Board ID không hợp lệ!" });
    if (!email && !userId) return res.status(400).json({ message: "Email hoặc userId là bắt buộc!" });

    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Không tìm thấy bảng!" });
    if (board.owner.toString() !== actorId.toString()) return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền mời!" });

    let user;
    let isNewInvitation = false;

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ message: "User ID không hợp lệ!" });
      user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng!" });

      const existingMember = board.members.find((m) => m.user.toString() === user._id.toString());
      if (existingMember) {
        if (existingMember.isActive) return res.status(400).json({ message: "Người dùng đã là thành viên!" });
        existingMember.isActive = true;
      } else {
        board.members.push({ user: user._id, isActive: true });
        isNewInvitation = true;
      }

      const isAlreadyInvited = board.invitedUsers.some((i) => i.user?.toString() === user._id.toString() && i.isActive);
      if (isAlreadyInvited) return res.status(400).json({ message: "Người dùng đã được mời!" });
    } else {
      user = await User.findOne({ email });
      if (!user) {
        const inviteLink = `http://localhost:5173/invite/accept?boardId=${boardId}&email=${encodeURIComponent(email)}`;
        await transporter.sendMail({
          from: `"APP TEAM" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `Lời mời tham gia bảng "${board.title}"`,
          html: `<p>Bạn được mời tham gia bảng "${board.title}" bởi ${req.user.fullName}.</p><p>Nhấn <a href="${inviteLink}">đây</a> để chấp nhận lời mời.</p>`,
        });
        board.invitedUsers.push({ user: null, email, isActive: true, invitedAt: new Date() });
        await board.save();
        return res.status(200).json({ message: `Đã gửi lời mời tới ${email}!`, board });
      }

      const existingMember = board.members.find((m) => m.user.toString() === user._id.toString());
      if (existingMember) {
        if (existingMember.isActive) return res.status(400).json({ message: "Người dùng đã là thành viên!" });
        existingMember.isActive = true;
      } else {
        board.members.push({ user: user._id, isActive: true });
        isNewInvitation = true;
      }

      const isAlreadyInvited = board.invitedUsers.some((i) => i.user?.toString() === user._id.toString() && i.isActive);
      if (isAlreadyInvited) return res.status(400).json({ message: "Người dùng đã được mời!" });
    }

    if (isNewInvitation) {
      const workspace = await Workspace.findById(board.workspace);
      if (!workspace) return res.status(404).json({ message: "Không tìm thấy workspace!" });
      if (!workspace.members.includes(user._id)) workspace.members.push(user._id);

      const activity = new Activity({
        user: actorId,
        action: { category: "member", type: "invited" },
        target: board._id,
        targetModel: "Board",
        details: `User ${req.user.fullName} invited ${user.fullName} to board "${board.title}"`,
      });
      await activity.save();
      board.activities.push(activity._id);
      workspace.activities.push(activity._id);

      const notification = new Notification({
        user: user._id,
        message: `Bạn đã được mời vào bảng "${board.title}" bởi ${req.user.fullName}`,
        type: "activity",
        target: board._id,
        targetModel: "Board",
        isRead: false,
        isHidden: false,
      });
      await notification.save();

      await Promise.all([board.save(), workspace.save(), user.save()]);

      const updatedBoard = await Board.findById(boardId)
        .populate("members.user", "email avatar fullName isOnline")
        .populate("invitedUsers.user", "email avatar fullName isOnline")
        .populate("owner", "email fullName _id isOnline");

      const io = req.app.get("io");
      if (io) {
        io.to(boardId).emit("member-invited", {
          board: updatedBoard,
          invitedUser: { _id: user._id, fullName: user.fullName, email: user.email, isOnline: user.isOnline },
        });
        io.to(user._id.toString()).emit("new-notification", notification);
      }

      res.status(200).json({ message: "Đã mời thành viên thành công!", board: updatedBoard });
    } else {
      await board.save();
      const updatedBoard = await Board.findById(boardId)
        .populate("members.user", "email avatar fullName isOnline")
        .populate("invitedUsers.user", "email avatar fullName isOnline")
        .populate("owner", "email fullName _id isOnline");

      const io = req.app.get("io");
      if (io) {
        io.to(boardId).emit("member-invited", {
          board: updatedBoard,
          invitedUser: { _id: user._id, fullName: user.fullName, email: user.email, isOnline: user.isOnline },
        });
      }

      res.status(200).json({ message: "Đã kích hoạt lại thành viên thành công!", board: updatedBoard });
    }
  } catch (error) {
    console.error("inviteMember error:", error.message);
    res.status(500).json({ message: "Lỗi server khi mời thành viên!" });
  }
};

module.exports = inviteMember;