const mongoose = require("mongoose");
const Board = require("../models/Board");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const Card = require("../models/Card");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Tạo bảng
const createBoard = async (req, res, io) => {
  try {
    const { title, description, background, visibility, workspace } = req.body;

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!title || !workspace) {
      return res.status(400).json({ message: "Title và workspace là bắt buộc!" });
    }

    if (!mongoose.Types.ObjectId.isValid(workspace)) {
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    const workspaceDoc = await Workspace.findById(workspace);
    if (!workspaceDoc) {
      return res.status(404).json({ message: "Workspace không tồn tại!" });
    }
    if (!workspaceDoc.members.includes(req.user._id)) {
      return res.status(403).json({ message: "Bạn không có quyền tạo board trong workspace này!" });
    }

    const board = await Board.create({
      title,
      description,
      background,
      visibility: visibility || "public",
      owner: req.user._id,
      workspace,
      members: [{ user: req.user._id, isActive: true }],
      isDeleted: false,
    });

    console.log("Created board:", {
      id: board._id.toString(),
      title: board.title,
      owner: board.owner.toString(),
      members: board.members.map((m) => ({ user: m.user.toString(), isActive: m.isActive })),
      workspace: board.workspace.toString(),
    });

    const activity = new Activity({
      user: req.user._id,
      action: "board_created",
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} created board "${title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    workspaceDoc.activities.push(activity._id);
    await Promise.all([board.save(), workspaceDoc.save()]);

    const populatedBoard = await Board.findById(board._id)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline")
      .populate("workspace", "name");

    // Phát sự kiện đến tất cả thành viên workspace
    workspaceDoc.members.forEach((member) => {
      io.to(member.toString()).emit("board-created", {
        board: populatedBoard,
        message: `Board "${title}" đã được tạo bởi ${req.user.fullName}`,
      });
    });

    res.status(201).json(populatedBoard);
  } catch (err) {
    console.error("Error in createBoard:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Lấy danh sách board của user
const getUserBoards = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    console.log("Fetching boards for user:", req.user._id.toString(), "Email:", req.user.email);

    const boards = await Board.find({
      $or: [
        { owner: req.user._id },
        { "members.user": req.user._id, "members.isActive": true },
      ],
      isDeleted: false,
    })
      .populate("workspace", "name")
      .populate("owner", "email fullName isOnline")
      .populate("members.user", "email fullName avatar isOnline");

    console.log("Found boards:", boards.map(b => ({
      id: b._id.toString(),
      title: b.title,
      owner: b.owner.toString(),
      members: b.members.map(m => ({
        user: m.user?._id?.toString() || "undefined",
        isActive: m.isActive,
      })),
      isDeleted: b.isDeleted,
    })));

    res.status(200).json({ boards });
  } catch (err) {
    console.error("Error in getUserBoards:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Lấy thông tin board theo ID
const getBoardById = async (req, res) => {
  try {
    console.log("Fetching board ID:", req.params.id, "User:", req.user?.email);

    const board = await Board.findOne({ _id: req.params.id, isDeleted: false })
      .populate({
        path: "members.user",
        select: "email avatar fullName isOnline",
      })
      .populate({
        path: "invitedUsers.user",
        select: "email avatar fullName isOnline",
      })
      .populate("owner", "email fullName _id isOnline")
      .populate("workspace", "name");

    if (!board) {
      console.log("Board not found:", req.params.id);
      return res.status(404).json({ message: "Board không tồn tại" });
    }

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const isMember = board.members.some(
      m => m.user && m.user._id && m.user._id.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Access denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền truy cập board này!" });
    }

    res.status(200).json(board);
  } catch (err) {
    console.error("Error in getBoardById:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Cập nhật board
const updateBoard = async (req, res, io) => {
  try {
    const { title, description, background, visibility } = req.body;

    const board = await Board.findById(req.params.id);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại" });
    }

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const isMember = board.members.some(
      m => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật board này!" });
    }

    const updated = await Board.findByIdAndUpdate(
      req.params.id,
      { title, description, background, visibility },
      { new: true }
    )
      .populate("members.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline")
      .populate("workspace", "name");

    const activity = new Activity({
      user: req.user._id,
      action: "board_updated",
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} updated board "${title || board.title}"`,
    });
    await activity.save();
    updated.activities.push(activity._id);
    await updated.save();

    io.to(board._id.toString()).emit("board-updated", {
      board: updated,
      message: `Board "${updated.title}" đã được cập nhật bởi ${req.user.fullName}`,
    });

    res.status(200).json(updated);
  } catch (err) {
    console.error("Error in updateBoard:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Xóa board
const deleteBoard = async (req, res, io) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const board = await Board.findById(req.params.id).populate("workspace");
    if (!board) {
      return res.status(404).json({ message: "Không tìm thấy bảng!" });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền xóa!" });
    }

    // Đánh dấu bảng là đã xóa
    board.isDeleted = true;

    // Tạo activity
    const activity = new Activity({
      user: req.user._id,
      action: "board_deleted",
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} deleted board "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    board.workspace.activities.push(activity._id);

    // Tạo thông báo cho các thành viên workspace (trừ người xóa)
    const workspace = board.workspace;
    const notifications = workspace.members
      .filter((memberId) => memberId.toString() !== req.user._id.toString())
      .map((memberId) => ({
        user: memberId,
        message: `Bảng "${board.title}" đã bị xóa trong workspace "${workspace.name}" bởi ${req.user.fullName}`,
        type: "activity",
        target: board._id,
        targetModel: "Board",
        isRead: false,
      }));

    if (notifications.length > 0) {
      const createdNotifications = await Notification.insertMany(notifications);
      createdNotifications.forEach((notification) => {
        io.to(notification.user.toString()).emit("new-notification", notification);
      });
    }

    // Lưu board và workspace
    await Promise.all([board.save(), workspace.save()]);

    // Phát sự kiện board-deleted
    io.to(board.workspace.toString()).emit("board-deleted", {
      boardId: board._id,
      message: `Board "${board.title}" đã bị xóa bởi ${req.user.fullName}`,
    });

    res.status(200).json({ message: "Đã ẩn bảng thành công" });
  } catch (err) {
    console.error("Error in deleteBoard:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Cập nhật thứ tự cột
const updateColumnOrder = async (req, res, io) => {
  try {
    const { boardId } = req.params;
    const { columnOrder } = req.body;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    if (!Array.isArray(columnOrder) || columnOrder.length === 0) {
      return res.status(400).json({ message: "Danh sách thứ tự cột không hợp lệ!" });
    }

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const isMember = board.members.some(
      m => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật board này!" });
    }

    board.listOrderIds = columnOrder;
    await board.save();

    const activity = new Activity({
      user: req.user._id,
      action: "column_order_updated",
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} updated column order in board "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    io.to(boardId).emit("column-order-updated", {
      boardId,
      columnOrder,
      message: `Thứ tự cột trong board "${board.title}" đã được cập nhật bởi ${req.user.fullName}`,
    });

    res.status(200).json({ message: "Cập nhật thứ tự cột thành công" });
  } catch (err) {
    console.error("Error in updateColumnOrder:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Mời thành viên mới vào bảng
const inviteMember = async (req, res, io) => {
  try {
    const { boardId } = req.params;
    const { email, userId } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }
    if (!email && !userId) {
      return res.status(400).json({ message: "Email hoặc userId là bắt buộc!" });
    }

    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) {
      return res.status(404).json({ message: "Không tìm thấy bảng!" });
    }
    if (board.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền mời!" });
    }

    let user;
    let isNewInvitation = false;

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "User ID không hợp lệ!" });
      }
      user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Không tìm thấy người dùng!" });
      }

      // Kiểm tra trùng lặp
      const matchingMembers = board.members.filter(
        (m) => m.user.toString() === user._id.toString()
      );
      if (matchingMembers.length > 1) {
        console.warn(`Duplicate members found for user ${userId} in board ${boardId}`);
        board.members = board.members.filter(
          (m) => m.user.toString() !== user._id.toString()
        );
      }

      const existingMember = board.members.find(
        (m) => m.user.toString() === user._id.toString()
      );
      if (existingMember) {
        if (existingMember.isActive) {
          return res.status(400).json({ message: "Người dùng đã là thành viên!" });
        } else {
          existingMember.isActive = true;
        }
      } else {
        board.members.push({ user: user._id, isActive: true });
        isNewInvitation = true;
      }

      const isAlreadyInvited = board.invitedUsers.some(
        (i) => i.user?.toString() === user._id.toString() && i.isActive
      );
      if (isAlreadyInvited) {
        return res.status(400).json({ message: "Người dùng đã được mời!" });
      }
    } else {
      user = await User.findOne({ email });
      if (!user) {
        const tempInvite = {
          user: null,
          email,
          isActive: true,
          invitedAt: new Date(),
        };
        board.invitedUsers.push(tempInvite);

        const inviteLink = `http://localhost:5173/invite/accept?boardId=${boardId}&email=${encodeURIComponent(email)}`;
        await transporter.sendMail({
          from: `"Trello Clone" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: `Lời mời tham gia bảng "${board.title}"`,
          html: `
            <p>Bạn được mời tham gia bảng "${board.title}" bởi ${req.user.fullName}.</p>
            <p>Nhấn <a href="${inviteLink}">đây</a> để chấp nhận lời mời.</p>
          `,
        });

        await board.save();
        return res.status(200).json({
          message: `Đã gửi lời mời tới ${email}!`,
          board,
        });
      }

      const existingMember = board.members.find(
        (m) => m.user.toString() === user._id.toString()
      );
      if (existingMember) {
        if (existingMember.isActive) {
          return res.status(400).json({ message: "Người dùng đã là thành viên!" });
        } else {
          existingMember.isActive = true;
        }
      } else {
        board.members.push({ user: user._id, isActive: true });
        isNewInvitation = true;
      }

      const isAlreadyInvited = board.invitedUsers.some(
        (i) => i.user?.toString() === user._id.toString() && i.isActive
      );
      if (isAlreadyInvited) {
        return res.status(400).json({ message: "Người dùng đã được mời!" });
      }
    }

    if (isNewInvitation) {
      const workspace = await Workspace.findById(board.workspace);
      if (!workspace) {
        return res.status(404).json({ message: "Không tìm thấy workspace!" });
      }
      if (!workspace.members.includes(user._id)) {
        workspace.members.push(user._id);
      }

      const activity = new Activity({
        user: req.user._id,
        action: "member_invited",
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
      });
      await notification.save();

      await Promise.all([board.save(), workspace.save(), user.save()]);

      const updatedBoard = await Board.findById(boardId)
        .populate("members.user", "email avatar fullName isOnline")
        .populate("invitedUsers.user", "email avatar fullName isOnline")
        .populate("owner", "email fullName _id isOnline");

      io.to(boardId).emit("member-invited", {
        board: updatedBoard,
        invitedUser: { _id: user._id, fullName: user.fullName, email: user.email, isOnline: user.isOnline },
      });
      io.to(user._id.toString()).emit("new-notification", notification);

      res.status(200).json({
        message: "Đã mời thành viên thành công!",
        board: updatedBoard,
      });
    } else {
      await board.save();
      const updatedBoard = await Board.findById(boardId)
        .populate("members.user", "email avatar fullName isOnline")
        .populate("invitedUsers.user", "email avatar fullName isOnline")
        .populate("owner", "email fullName _id isOnline");

      io.to(boardId).emit("member-invited", {
        board: updatedBoard,
        invitedUser: { _id: user._id, fullName: user.fullName, email: user.email, isOnline: user.isOnline },
      });

      res.status(200).json({
        message: "Đã kích hoạt lại thành viên thành công!",
        board: updatedBoard,
      });
    }
  } catch (err) {
    console.error("Error in inviteMember:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server khi mời thành viên!", error: err.message });
  }
};

// Xóa thành viên khỏi bảng
const removeMember = async (req, res, io) => {
  try {
    const { boardId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(boardId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Board ID hoặc User ID không hợp lệ!" });
    }

    const board = await Board.findById(boardId).populate("workspace");
    if (!board) {
      return res.status(404).json({ message: "Không tìm thấy bảng!" });
    }

    if (!req.user || board.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền xóa thành viên!" });
    }

    if (board.owner.toString() === userId) {
      return res.status(400).json({ message: "Không thể xóa chủ phòng!" });
    }

    // Kiểm tra trùng lặp
    const matchingMembers = board.members.filter(
      (m) => m.user.toString() === userId
    );
    if (matchingMembers.length > 1) {
      console.warn(`Duplicate members found for user ${userId} in board ${boardId}`);
      board.members = board.members.filter(
        (m) => m.user.toString() !== userId
      );
      board.members.push({ user: userId, isActive: false });
    } else {
      const memberIndex = board.members.findIndex(
        (m) => m.user.toString() === userId && m.isActive
      );
      if (memberIndex === -1) {
        return res.status(400).json({ message: "Người dùng không phải thành viên active!" });
      }
      board.members[memberIndex].isActive = false;
    }

    // Xóa thành viên khỏi card.members
    const updatedCards = await Card.updateMany(
      { board: boardId, "members._id": userId },
      { $pull: { members: { _id: userId } } },
      { multi: true }
    );

    const affectedCards = await Card.find(
      { board: boardId, "members._id": userId },
      "_id"
    );
    const cardIds = affectedCards.map((card) => card._id.toString());

    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Không tìm thấy workspace!" });
    }
    const otherBoards = await Board.find({
      workspace: board.workspace,
      "members.user": userId,
      "members.isActive": true,
    });
    if (otherBoards.length === 0) {
      workspace.members = workspace.members.filter((m) => m.toString() !== userId);
      await workspace.save();
    }

    await board.save();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng!" });
    }

    const activity = new Activity({
      user: req.user._id,
      action: "member_removed",
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} deactivated ${user.fullName} in board "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    const notification = new Notification({
      user: userId,
      message: `Bạn đã bị xóa khỏi bảng "${board.title}" bởi ${req.user.fullName}`,
      type: "activity",
      target: board._id,
      targetModel: "Board",
    });
    await notification.save();

    const updatedBoard = await Board.findById(boardId)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline");

    io.to(boardId).emit("member-deactivated", {
      board: updatedBoard,
      deactivatedUserId: userId,
      cardIds,
      message: `${user.fullName} đã bị xóa khỏi bảng "${board.title}" bởi ${req.user.fullName}`,
      workspaceRemoved: otherBoards.length === 0,
    });

    io.to(userId).emit("member-deactivated", {
      board: updatedBoard,
      deactivatedUserId: userId,
      cardIds,
      message: `Bạn đã bị xóa khỏi bảng "${board.title}"`,
      workspaceRemoved: otherBoards.length === 0,
    });

    res.status(200).json({
      message: "Đã xóa thành viên khỏi bảng!",
      board: updatedBoard,
      cardIds,
    });
  } catch (err) {
    console.error("Error in removeMember:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server khi xóa thành viên!", error: err.message });
  }
};

// Lấy danh sách hoạt động của bảng
const getBoardActivities = async (req, res) => {
  try {
    const { boardId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) {
      return res.status(404).json({ message: "Không tìm thấy bảng!" });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    const isMember = board.members.some(
      m => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập bảng này!" });
    }

    const activities = await Activity.find({ target: boardId, targetModel: "Board" })
      .populate("user", "email fullName isOnline")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json(activities);
  } catch (err) {
    console.error("Error in getBoardActivities:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Rời khỏi bảng
const leaveBoard = async (req, res, io) => {
  try {
    const { boardId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const board = await Board.findOne({ _id: boardId, isDeleted: false }).populate("workspace");
    if (!board) {
      return res.status(404).json({ message: "Không tìm thấy bảng!" });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (board.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Chủ phòng không thể rời bảng!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không phải thành viên của bảng này!" });
    }

    // Cập nhật trạng thái isActive
    board.members = board.members.map((member) =>
      member.user.toString() === req.user._id.toString()
        ? { ...member, isActive: false }
        : member
    );

    // Xóa thành viên khỏi card.members trong tất cả thẻ
    const updatedCards = await Card.updateMany(
      { board: boardId, "members._id": req.user._id },
      { $pull: { members: { _id: req.user._id } } },
      { multi: true }
    );

    // Lấy danh sách cardIds bị ảnh hưởng
    const affectedCards = await Card.find(
      { board: boardId, "members._id": req.user._id },
      "_id"
    );
    const cardIds = affectedCards.map((card) => card._id.toString());

    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) {
      return res.status(404).json({ message: "Không tìm thấy workspace!" });
    }
    const otherBoards = await Board.find({
      workspace: board.workspace,
      "members.user": req.user._id,
      "members.isActive": true,
    });
    if (otherBoards.length === 0) {
      workspace.members = workspace.members.filter(
        (m) => m.toString() !== req.user._id.toString()
      );
      await workspace.save();
    }

    await board.save();

    const activity = new Activity({
      user: req.user._id,
      action: "member_left",
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} left board "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    const notification = new Notification({
      user: req.user._id,
      message: `Bạn đã rời khỏi bảng "${board.title}"`,
      type: "activity",
      target: board._id,
      targetModel: "Board",
    });
    await notification.save();

    const updatedBoard = await Board.findById(boardId)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline");

    // Phát sự kiện member-deactivated với cardIds
    io.to(boardId).emit("member-deactivated", {
      board: updatedBoard,
      deactivatedUserId: req.user._id,
      cardIds,
      message: `${req.user.fullName} đã rời khỏi bảng "${board.title}"`,
      workspaceRemoved: otherBoards.length === 0,
    });

    io.to(req.user._id.toString()).emit("member-deactivated", {
      board: updatedBoard,
      deactivatedUserId: req.user._id,
      cardIds,
      message: `Bạn đã rời khỏi bảng "${board.title}"`,
      workspaceRemoved: otherBoards.length === 0,
    });

    res.status(200).json({
      message: "Đã rời khỏi bảng thành công!",
      board: updatedBoard,
      cardIds,
      redirect: "/boards",
    });
  } catch (err) {
    console.error("Error in leaveBoard:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server khi rời bảng!", error: err.message });
  }
};

// Chuyển quyền sở hữu bảng
const transferOwnership = async (req, res, io) => {
  try {
    const { boardId } = req.params;
    const { newOwnerId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(boardId) || !mongoose.Types.ObjectId.isValid(newOwnerId)) {
      return res.status(400).json({ message: "Board ID hoặc User ID không hợp lệ!" });
    }

    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) {
      return res.status(404).json({ message: "Không tìm thấy bảng!" });
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (board.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Chỉ chủ phòng mới có quyền chuyển quyền sở hữu!" });
    }

    const newOwner = await User.findById(newOwnerId);
    if (!newOwner) {
      return res.status(404).json({ message: "Không tìm thấy người dùng!" });
    }

    const isMember = board.members.some(
      m => m.user && m.user.toString() === newOwnerId && m.isActive
    );
    if (!isMember) {
      return res.status(400).json({ message: "Người dùng không phải thành viên của bảng!" });
    }

    board.owner = newOwnerId;
    await board.save();

    const activity = new Activity({
      user: req.user._id,
      action: "board_ownership_transferred",
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} transferred ownership of board "${board.title}" to ${newOwner.fullName}`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    const notification = new Notification({
      user: newOwnerId,
      message: `Bạn đã được chuyển quyền sở hữu board "${board.title}" bởi ${req.user.fullName}`,
      type: "activity",
      target: board._id,
      targetModel: "Board",
    });
    await notification.save();
    newOwner.notifications.push(notification._id);
    await newOwner.save();

    const updatedBoard = await Board.findById(boardId)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("invitedUsers.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline");

    io.to(boardId).emit("board-updated", {
      board: updatedBoard,
      message: `Quyền sở hữu board "${board.title}" đã được chuyển cho ${newOwner.fullName}`,
    });
    io.to(newOwnerId).emit("new-notification", notification);

    res.status(200).json({
      message: "Chuyển quyền sở hữu thành công!",
      board: updatedBoard,
    });
  } catch (err) {
    console.error("Error in transferOwnership:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi server khi chuyển quyền sở hữu!", error: err.message });
  }
};

module.exports = {
  createBoard,
  getUserBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
  updateColumnOrder,
  inviteMember,
  removeMember,
  getBoardActivities,
  leaveBoard,
  transferOwnership,
};