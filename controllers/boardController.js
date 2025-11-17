const mongoose = require("mongoose");
const Board = require("../models/Board");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const Card = require("../models/Card");

const createBoard = async (req, res) => {
  try {
    const { title, description, background, visibility, workspace } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!title || !workspace) return res.status(400).json({ message: "Title và workspace là bắt buộc!" });
    if (!mongoose.Types.ObjectId.isValid(workspace)) return res.status(400).json({ message: "Workspace ID không hợp lệ!" });

    const workspaceDoc = await Workspace.findById(workspace);
    if (!workspaceDoc) return res.status(404).json({ message: "Workspace không tồn tại!" });
    if (!workspaceDoc.members.includes(userId)) return res.status(403).json({ message: "Bạn không có quyền tạo board trong workspace này!" });

    const board = await Board.create({
      title,
      description,
      background,
      visibility: visibility || "public",
      owner: userId,
      workspace,
      members: [{ user: userId, isActive: true }],
      isDeleted: false,
      version: 0,
    });

    const activity = new Activity({
      user: userId,
      action: { category: "board", type: "created" },
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

    const io = req.app.get("io");
    if (io) {
      workspaceDoc.members.forEach((member) =>
        io.to(member.toString()).emit("board-created", {
          board: populatedBoard,
          message: `Board "${title}" đã được tạo bởi ${req.user.fullName}`,
        })
      );
    }

    res.status(201).json(populatedBoard);
  } catch (error) {
    console.error("createBoard error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getUserBoards = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    // Lấy danh sách workspace mà user là member
    const workspaces = await Workspace.find({ members: userId }).select('_id');
    const workspaceIds = workspaces.map(ws => ws._id);

    const boards = await Board.find({
      isDeleted: false,
      $or: [
        { owner: userId },  // Boards user là owner
        { "members.user": userId, "members.isActive": true },  // Boards user là member active
        { workspace: { $in: workspaceIds } }  // Tất cả boards trong workspaces của user (public/private)
      ]
    })
      .populate("workspace", "name")
      .populate("owner", "email fullName isOnline")
      .populate("members.user", "email fullName avatar isOnline");

    res.status(200).json({ boards });
  } catch (error) {
    console.error("getUserBoards error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getBoardById = async (req, res) => {
  try {
    const boardId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(boardId)) return res.status(400).json({ message: "Board ID không hợp lệ!" });

    const board = await Board.findOne({ _id: boardId, isDeleted: false })
      .populate("members.user", "email avatar fullName isOnline")
      .populate("invitedUsers.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline")
      .populate("workspace", "name")
      .populate({
        path: "listOrderIds",
        match: { isDeleted: false },
        populate: {
          path: "cardOrderIds",
          model: "Card",
          match: { isDeleted: false },
          select: "title description position members completed checklists comments notes activities labels attachments createdAt updatedAt",
          populate: [
            { path: "members", select: "email fullName avatar isOnline" },
            { path: "comments.user", select: "email fullName avatar isOnline" },
            { path: "notes.createdBy", select: "email fullName avatar isOnline" },
            { path: "activities", match: { isDeleted: false } },
          ],
        },
      });

    if (!board) return res.status(404).json({ message: "Board không tồn tại" });

    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });

    const isMember = board.members.some((m) => m.user?._id.toString() === userId.toString() && m.isActive);
    const isPublicBoard = board.visibility === "public";
    const workspace = await Workspace.findById(board.workspace);
    const isWorkspaceMember = workspace.members.includes(userId) || workspace.isPublic;

    if (!isMember && !isPublicBoard && !isWorkspaceMember) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập board này!" });
    }

    // Thêm columnOrderIds (array _id của listOrderIds) và columns
    const formattedBoard = {
      ...board.toObject(),
      columns: board.listOrderIds, // array List populated
      columnOrderIds: board.listOrderIds.map((list) => list._id), // array ID của List
    };

    res.status(200).json(formattedBoard);
  } catch (error) {
    console.error("getBoardById error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const updateBoard = async (req, res) => {
  try {
    const { title, description, background, visibility, version } = req.body;
    const boardId = req.params.id;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (version === undefined) {
      return res.status(400).json({ message: "Version là bắt buộc!" });
    }

    // Tìm board với version chính xác
    const board = await Board.findOne({ _id: boardId, version });
    if (!board) {
      return res.status(409).json({ 
        message: "Bảng đã được chỉnh sửa bởi người khác. Vui lòng tải lại!",
        code: "VERSION_CONFLICT"
      });
    }

    const isMember = board.members.some(m => m.user.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền cập nhật board này!" });

    // Cập nhật các field
    if (title !== undefined) board.title = title;
    if (description !== undefined) board.description = description;
    if (background !== undefined) board.background = background;
    if (visibility !== undefined) board.visibility = visibility;

    // Tăng version
    board.version += 1;

    // Tạo activity
    const activity = new Activity({
      user: userId,
      action: { category: "board", type: "updated" },
      target: board._id,
      targetModel: "Board",
      details: `đã cập nhật bảng "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);

    await board.save();

    // Populate lại dữ liệu trả về
    const updatedBoard = await Board.findById(boardId)
      .populate("members.user", "email avatar fullName isOnline")
      .populate("owner", "email fullName _id isOnline")
      .populate("workspace", "name");

    // Emit socket
    const io = req.app.get("io");
    if (io) {
      io.to(boardId).emit("board-updated", {
        board: updatedBoard,
        message: `Bảng "${updatedBoard.title}" đã được cập nhật`,
      });
    }

    return res.status(200).json(updatedBoard);

  } catch (error) {
    console.error("updateBoard error:", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const deleteBoard = async (req, res) => {
  try {
    const boardId = req.params.id;
    const userId = req.user?._id;
    const { version } = req.body;

    if (!userId) return res.status(401).json({ message: "Không tìm thấy user!" });
    if (version === undefined) {
      return res.status(400).json({ message: "Version là bắt buộc!" });
    }

    const board = await Board.findOne({ _id: boardId, version }).populate("workspace");
    if (!board) {
      return res.status(409).json({ 
        message: "Bảng đã bị thay đổi. Vui lòng tải lại!",
        code: "VERSION_CONFLICT"
      });
    }

    if (board.owner.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Chỉ chủ board mới được xóa!" });
    }

    board.isDeleted = true;
    board.version += 1;

    const activity = new Activity({
      user: userId,
      action: { category: "board", type: "deleted" },
      target: board._id,
      targetModel: "Board",
      details: `đã xóa bảng "${board.title}"`,
    });
    await activity.save();

    board.activities.push(activity._id);
    board.workspace.activities.push(activity._id);
    await Promise.all([board.save(), board.workspace.save()]);

    // Gửi thông báo
    const notifications = board.workspace.members
      .filter(m => m.toString() !== userId.toString())
      .map(memberId => ({
        user: memberId,
        message: `Bảng "${board.title}" đã bị xóa bởi ${req.user.fullName}`,
        type: "activity",
        target: board._id,
        targetModel: "Board",
        isRead: false,
      }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    const io = req.app.get("io");
    if (io) {
      io.to(board.workspace.toString()).emit("board-deleted", { boardId });
    }

    return res.status(200).json({ message: "Xóa bảng thành công!" });

  } catch (error) {
    console.error("deleteBoard error:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

const updateColumnOrder = async (req, res) => {
  try {
    const { boardId } = req.params;
    const { columnOrder, version } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(boardId)) return res.status(400).json({ message: "Board ID không hợp lệ!" });
    if (!Array.isArray(columnOrder) || columnOrder.length === 0) return res.status(400).json({ message: "Danh sách thứ tự cột không hợp lệ!" });
    if (version === undefined) {
      return res.status(400).json({ message: "Version is required" });
    }

    const board = await Board.findOne({ _id: boardId, version });
    if (!board) {
      return res.status(409).json({ 
        message: "Conflict detected. Board was modified. Please refresh.",
        code: "VERSION_CONFLICT"
      });
    }

    const isMember = board.members.some((m) => m.user.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Không có quyền sắp xếp cột" });

    if (columnOrder.length > 0) {
      for (const listId of columnOrder) {
        if (!mongoose.Types.ObjectId.isValid(listId)) {
          return res.status(400).json({ message: `List ID ${listId} không hợp lệ!` });
        }
        const list = await List.findOne({ _id: listId, isDeleted: false });
        if (!list) {
          return res.status(404).json({ message: `List ${listId} không tồn tại hoặc đã bị ẩn!` });
        }
        if (list.board.toString() !== boardId) {
          return res.status(400).json({ message: `List ${listId} không thuộc board này!` });
        }
      }
    }

    board.listOrderIds = columnOrder.map(id => new mongoose.Types.ObjectId(id));
    board.version += 1;

    await board.save();

    const activity = new Activity({
      user: userId,
      action: { category: "board", type: "list_order_updated" },
      target: board._id,
      targetModel: "Board",
      details: `User ${req.user.fullName} updated column order in board "${board.title}"`,
    });
    await activity.save();
    board.activities.push(activity._id);
    await board.save();

    const io = req.app.get("io");
    if (io) {
      io.to(boardId).emit("list-order-updated", {
        boardId,
        columnOrder,
        message: `Thứ tự cột trong board "${board.title}" đã được cập nhật bởi ${req.user.fullName}`,
      });
    }

    return res.status(200).json({ 
      message: "Cập nhật thứ tự cột thành công",
      version: board.version });
  } catch (error) {
    console.error("updateColumnOrder error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getBoardActivities = async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(boardId)) return res.status(400).json({ message: "Board ID không hợp lệ!" });

    const board = await Board.findOne({ _id: boardId, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Không tìm thấy bảng!" });

    const isMember = board.members.some((m) => m.user.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền truy cập bảng này!" });

    const activities = await Activity.find({ target: boardId, targetModel: "Board" })
      .populate("user", "email fullName isOnline")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json(activities);
  } catch (error) {
    console.error("getBoardActivities error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getBoardsByWorkspace = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }
    
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    // Kiểm tra quyền truy cập workspace
    const workspace = await Workspace.findOne({ 
      _id: workspaceId, 
      isDeleted: false 
    });
    
    if (!workspace) {
      return res.status(404).json({ message: "Workspace không tồn tại!" });
    }

    const isMember = workspace.members.includes(userId);
    if (!isMember && !workspace.isPublic) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập workspace này!" });
    }

    // Lấy tất cả boards trong workspace
    const boards = await Board.find({
      workspace: workspaceId,
      isDeleted: false,
      $or: [
        { visibility: "public" },
        { "members.user": userId, "members.isActive": true },
        { owner: userId }
      ]
    })
    .populate("members.user", "email fullName avatar isOnline")
    .populate("owner", "email fullName avatar isOnline")
    .populate("workspace", "name")
    .lean();

    res.status(200).json(boards);
  } catch (error) {
    console.error("getBoardsByWorkspace error:", error.message);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// Endpoint lấy thống kê thành viên trong workspace
const getWorkspaceMembers = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }
    
    if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
      return res.status(400).json({ message: "Workspace ID không hợp lệ!" });
    }

    // Kiểm tra quyền truy cập workspace
    const workspace = await Workspace.findOne({ 
      _id: workspaceId, 
      isDeleted: false 
    }).populate("members", "email fullName avatar isOnline");
    
    if (!workspace) {
      return res.status(404).json({ message: "Workspace không tồn tại!" });
    }

    const isMember = workspace.members.some(member => 
      member._id.toString() === userId.toString()
    );
    if (!isMember && !workspace.isPublic) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập workspace này!" });
    }

    // Lấy tất cả boards trong workspace với thành viên
    const boards = await Board.find({
      workspace: workspaceId,
      isDeleted: false,
      $or: [
        { visibility: "public" },
        { "members.user": userId, "members.isActive": true },
        { owner: userId }
      ]
    })
    .populate("members.user", "email fullName avatar isOnline")
    .populate("owner", "email fullName avatar isOnline")
    .select("title members owner")
    .lean();

    // Tổng hợp thành viên từ tất cả boards
    const allMembers = new Map();
    const boardMembers = [];

    boards.forEach(board => {
      const boardMemberList = [];
      
      // Thêm owner vào danh sách
      if (board.owner && !allMembers.has(board.owner._id.toString())) {
        allMembers.set(board.owner._id.toString(), {
          ...board.owner,
          role: 'owner',
          boards: [board.title]
        });
        boardMemberList.push({
          ...board.owner,
          role: 'owner'
        });
      } else if (board.owner && allMembers.has(board.owner._id.toString())) {
        allMembers.get(board.owner._id.toString()).boards.push(board.title);
      }

      // Thêm members vào danh sách
      board.members.forEach(member => {
        if (member.user && member.isActive !== false) {
          const userId = member.user._id.toString();
          if (!allMembers.has(userId)) {
            allMembers.set(userId, {
              ...member.user,
              role: board.owner._id.toString() === userId ? 'owner' : 'member',
              boards: [board.title]
            });
          } else {
            const existingMember = allMembers.get(userId);
            if (!existingMember.boards.includes(board.title)) {
              existingMember.boards.push(board.title);
            }
          }
          
          boardMemberList.push({
            ...member.user,
            role: board.owner._id.toString() === userId ? 'owner' : 'member'
          });
        }
      });

      boardMembers.push({
        boardId: board._id,
        boardTitle: board.title,
        members: boardMemberList
      });
    });

    // Thêm thành viên workspace (không có trong board nào)
    workspace.members.forEach(member => {
      if (!allMembers.has(member._id.toString())) {
        allMembers.set(member._id.toString(), {
          ...member.toObject(),
          role: 'workspace_member',
          boards: []
        });
      }
    });

    res.status(200).json({
      workspaceMembers: workspace.members,
      allBoardMembers: Array.from(allMembers.values()),
      boardMembers: boardMembers,
      totalMembers: allMembers.size
    });
  } catch (error) {
    console.error("getWorkspaceMembers error:", error.message);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

module.exports = {
  createBoard,
  getUserBoards,
  getBoardById,
  updateBoard,
  deleteBoard,
  updateColumnOrder,
  getBoardActivities,
  getBoardsByWorkspace,
  getWorkspaceMembers,
  inviteMember: require("./board/inviteMember"),
  removeMember: require("./board/removeMember"),
  leaveBoard: require("./board/leaveBoard"),
  transferOwnership: require("./board/transferOwnership"),
};