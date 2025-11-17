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
    const { email, userIds = [] } = req.body; 
    const actorId = req.user?._id;

    if (!actorId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(boardId)) return res.status(400).json({ message: "Board ID không hợp lệ!" });
    if (!email && userIds.length === 0) return res.status(400).json({ message: "Email hoặc userIds là bắt buộc!" });

    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Không tìm thấy bảng!" });
    if (board.owner.toString() !== actorId.toString()) return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền mời!" });

    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) return res.status(404).json({ message: "Không tìm thấy workspace!" });

    const invitedUsers = []; 
    const errors = [];      

    // === XỬ LÝ MỜI BẰNG EMAIL ===
    if (email) {
      const trimmedEmail = email.trim().toLowerCase();
      let user = await User.findOne({ email: trimmedEmail });

      if (!user) {
        const inviteLink = `http://localhost:5173/invite/accept?boardId=${boardId}&email=${encodeURIComponent(trimmedEmail)}`;
        await transporter.sendMail({
          from: `"APP TEAM" <${process.env.EMAIL_USER}>`,
          to: trimmedEmail,
          subject: `Lời mời tham gia bảng "${board.title}"`,
          html: `<p>Bạn được mời tham gia bảng "<strong>${board.title}</strong>" bởi <strong>${req.user.fullName}</strong>.</p>
                 <p>Nhấn <a href="${inviteLink}" style="color:blue;">vào đây</a> để chấp nhận lời mời.</p>`,
        });

        const existingInvite = board.invitedUsers.find(i => i.email === trimmedEmail && i.isActive);
        if (!existingInvite) {
          board.invitedUsers.push({ user: null, email: trimmedEmail, isActive: true, invitedAt: new Date() });
        }

        invitedUsers.push({ email: trimmedEmail, status: "invited" });
      } else {
        // Người dùng tồn tại → xử lý như userIds
        userIds.push(user._id.toString());
      }
    }

    // === XỬ LÝ MỜI BẰNG USERIDS (mảng) ===
    const validUserIds = userIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    const uniqueUserIds = [...new Set(validUserIds)]; // Loại trùng

    for (const userId of uniqueUserIds) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          errors.push({ userId, error: "Không tìm thấy người dùng" });
          continue;
        }

        // Kiểm tra đã là thành viên active?
        const existingMember = board.members.find(m => m.user.toString() === userId && m.isActive);
        if (existingMember) {
          errors.push({ userId, error: "Đã là thành viên" });
          continue;
        }

        // Kích hoạt lại nếu từng bị xóa
        const inactiveMember = board.members.find(m => m.user.toString() === userId && !m.isActive);
        if (inactiveMember) {
          inactiveMember.isActive = true;
        } else {
          board.members.push({ user: user._id, isActive: true });
        }

        // Xóa khỏi invitedUsers nếu có
        board.invitedUsers = board.invitedUsers.filter(i => i.user?.toString() !== userId);

        // Thêm vào workspace nếu chưa có
        if (!workspace.members.includes(user._id)) {
          workspace.members.push(user._id);
        }

        // Ghi activity
        const activity = new Activity({
          user: actorId,
          action: { category: "member", type: "invited" },
          target: board._id,
          targetModel: "Board",
          details: `${req.user.fullName} mời ${user.fullName} vào bảng "${board.title}"`,
        });
        await activity.save();
        board.activities.push(activity._id);
        workspace.activities.push(activity._id);

        // Gửi notification
        const notification = new Notification({
          user: user._id,
          message: `Bạn được mời vào bảng "${board.title}" bởi ${req.user.fullName}`,
          type: "activity",
          target: board._id,
          targetModel: "Board",
          isRead: false,
          isHidden: false,
        });
        await notification.save();

        invitedUsers.push({
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          status: "added"
        });

      } catch (err) {
        errors.push({ userId, error: err.message });
      }
    }

    // Lưu tất cả
    await Promise.all([board.save(), workspace.save()]);

    // Populate lại board
    const updatedBoard = await Board.findById(boardId)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("invitedUsers.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline");

    // Gửi socket
    const io = req.app.get("io");
    if (io) {
      io.to(boardId).emit("member-invited", { board: updatedBoard });
      invitedUsers.forEach(u => {
        if (u._id) {
          io.to(u._id.toString()).emit("new-notification", {
            message: `Bạn được mời vào bảng "${board.title}"`,
            target: board._id,
          });
        }
      });
    }

    // Trả về kết quả chi tiết
    res.status(200).json({
      message: "Mời thành viên hoàn tất!",
      board: updatedBoard,
      summary: {
        invited: invitedUsers.length,
        errors: errors.length
      },
      invitedUsers,
      errors
    });

  } catch (error) {
    console.error("inviteMember error:", error);
    res.status(500).json({ message: "Lỗi server!" });
  }
};

module.exports = inviteMember;