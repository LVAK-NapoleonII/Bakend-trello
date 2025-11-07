const mongoose = require("mongoose");
const Board = require("../models/Board");

const checkBoardAccess = async (boardId, userId) => {
  if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
    return { 
      canView: false, 
      canEdit: false, 
      board: null, 
      reason: "Board ID không hợp lệ" 
    };
  }

  const board = await Board.findOne({ _id: boardId, isDeleted: false })
    .populate("workspace", "members");

  if (!board) {
    return { 
      canView: false, 
      canEdit: false, 
      board: null, 
      reason: "Board không tồn tại" 
    };
  }

  let canView = false;
  let canEdit = false;
  let role = null;

  // Owner → toàn quyền (view + edit)
  if (board.owner.toString() === userId.toString()) {
    canView = true;
    canEdit = true;
    role = "owner";
  }
  // Board member (active) → toàn quyền (view + edit)
  else if (board.members.some(m => m.user?.toString() === userId.toString() && m.isActive)) {
    canView = true;
    canEdit = true;
    role = "board_member";
  }
  // Board public + trong workspace → chỉ xem (view only)
  else if (board.visibility === "public") {
    const inWorkspace = board.workspace?.members?.some(
      m => m.toString() === userId.toString()
    );
    if (inWorkspace) {
      canView = true;
      canEdit = false;
      role = "viewer";
    }
  }

  return {
    canView,
    canEdit,
    board: canView ? board : null,
    role,
    reason: !canView ? "no_permission" : null
  };
};

module.exports = checkBoardAccess;