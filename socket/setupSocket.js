const User = require("../models/User");
const jwt = require("jsonwebtoken");

module.exports = (io) => {
  // Socket.IO Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { _id: decoded.id || decoded.user?._id };
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  const connectedUsers = new Map();

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      connectedUsers.set(userId, socket.id);
      io.emit("user-status-changed", { userId, isOnline: true });
    } catch (err) {
      console.error("Socket.IO: Error updating user online status:", err.message);
    }

    // Join user room automatically
    socket.join(userId);
    console.log(`[Socket] User ${userId} joined their room`);

    socket.on("join", (requestedUserId) => {
      if (requestedUserId === userId) {
        socket.join(userId);
        console.log(`[Socket] User ${userId} explicitly joined their room`);
      }
    });

    socket.on("join-user", (requestedUserId) => {
      if (requestedUserId !== userId) {
        return socket.emit("error", { message: "Invalid user ID" });
      }
      socket.join(userId);
    });

    socket.on("join-board", ({ boardId }) => {
      socket.join(boardId);
    });

    socket.on("join-workspace", (workspaceId) => {
      socket.join(workspaceId);
      console.log(`[Socket] User ${userId} joined workspace ${workspaceId}`);
    });

    socket.on("user-login", (requestedUserId) => {
      if (requestedUserId !== userId) return;
      socket.broadcast.emit("user-status-update", { userId, status: "online" });
    });

    socket.on("refresh-sidebar", ({ userId: requestedUserId }) => {
      if (requestedUserId !== userId) return;
      io.to(userId).emit("refresh-sidebar", { userId });
    });

    // WORKSPACE EVENTS
    socket.on("workspace-created", (data) => {
      console.log(`[Socket] workspace-created received from user ${userId}:`, data);
      
      // Emit tới tất cả users trong workspace và user hiện tại
      io.emit("workspace-created", {
        workspace: data.workspace,
        message: data.message || `Workspace "${data.workspace.name}" đã được tạo.`,
        createdBy: userId
      });
      
      console.log(`[Socket] workspace-created broadcasted for workspace ${data.workspace._id}`);
    });

    socket.on("workspace-updated", (data) => {
      console.log(`[Socket] workspace-updated received from user ${userId}:`, data);
      
      // Emit tới workspace room và tất cả users
      io.to(data.workspace._id).emit("workspace-updated", {
        workspace: data.workspace,
        updatedBy: userId
      });
      
      // Emit tới tất cả users để update sidebar
      io.emit("workspace-updated", {
        workspace: data.workspace,
        updatedBy: userId
      });
      
      console.log(`[Socket] workspace-updated broadcasted for workspace ${data.workspace._id}`);
    });

    socket.on("workspace-hidden", (data) => {
      console.log(`[Socket] workspace-hidden received from user ${userId}:`, data);
      
      // Emit tới tất cả users để remove workspace khỏi sidebar
      io.emit("workspace-hidden", {
        workspaceId: data.workspaceId,
        message: data.message,
        hiddenBy: userId
      });
      
      console.log(`[Socket] workspace-hidden broadcasted for workspace ${data.workspaceId}`);
    });

    socket.on("workspace-restored", (data) => {
      console.log(`[Socket] workspace-restored received from user ${userId}:`, data);
      
      // Emit tới tất cả users để add workspace vào sidebar
      io.emit("workspace-restored", {
        workspace: data.workspace,
        workspaceId: data.workspaceId,
        restoredBy: userId
      });
      
      console.log(`[Socket] workspace-restored broadcasted for workspace ${data.workspaceId}`);
    });

    // BOARD EVENTS
    socket.on("board-created", (data) => {
      const { board } = data;
      if (board.workspace) {
        io.to(board.workspace.toString()).emit("board-created", { board });
        io.emit("board-created", { board }); // Emit global để HomePage cập nhật
      }
    });

    // LIST EVENTS
    socket.on("list-created", ({ boardId, list }) => {
      io.to(boardId).emit("list-created", { boardId, list });
    });

    socket.on("list-deleted", ({ boardId, listId }) => {
      io.to(boardId).emit("list-deleted", { boardId, listId });
    });

    socket.on("list-order-updated", ({ boardId, columnOrder }) => {
      io.to(boardId).emit("list-order-updated", { boardId, columnOrder });
    });

    // CARD EVENTS
    socket.on("card-created", ({ boardId, listId, card }) => {
      io.to(boardId).emit("card-created", { boardId, listId, card });
    });

    socket.on("card-deleted", ({ boardId, listId, cardId }) => {
      io.to(boardId).emit("card-deleted", { boardId, listId, cardId });
    });

    socket.on("card-moved", ({ card, oldListId, newListId, newPosition }) => {
      io.to(card.board.toString()).emit("card-moved", { card, oldListId, newListId, newPosition });
    });

    socket.on("card-order-updated", ({ listId, cardOrder }) => {
      io.to(listId).emit("card-order-updated", { listId, cardOrder });
    });

    socket.on("member-added", ({ cardId, members }) => {
      io.to(cardId).emit("member-added", { cardId, members });
    });

    socket.on("comment-added", ({ cardId, comment }) => {
      io.to(cardId).emit("comment-added", { cardId, comment });
    });

    socket.on("comment-hidden", ({ cardId, commentId, actorId }) => {
      if (actorId !== userId) return;
      io.to(cardId).emit("comment-hidden", { cardId, commentId, actorId });
    });

    socket.on("note-added", ({ cardId, note }) => {
      io.to(cardId).emit("note-added", { cardId, note });
    });

    socket.on("note-hidden", ({ cardId, noteId, actorId }) => {
      if (actorId !== userId) return;
      io.to(cardId).emit("note-hidden", { cardId, noteId, actorId });
    });

    socket.on("checklist-added", ({ cardId, checklist }) => {
      io.to(cardId).emit("checklist-added", { cardId, checklist });
    });

    socket.on("checklist-item-added", ({ cardId, checklistIndex, checklist }) => {
      io.to(cardId).emit("checklist-item-added", { cardId, checklistIndex, checklist });
    });

    socket.on("checklist-item-toggled", ({ cardId, checklistIndex, checklist }) => {
      io.to(cardId).emit("checklist-item-toggled", { cardId, checklistIndex, checklist });
    });

    socket.on("card-updated", ({ cardId, card }) => {
      io.to(card.board.toString()).emit("card-updated", { cardId, card });
    });

    socket.on("card-completion-toggled", ({ cardId, completed }) => {
      io.to(cardId).emit("card-completion-toggled", { cardId, completed });
    });

    // MEMBER EVENTS
    socket.on("member-deactivated", (data) => {
      console.log(`[Socket] member-deactivated received:`, data);
      
      // Emit tới user bị deactivate
      if (data.deactivatedUserId) {
        io.to(data.deactivatedUserId).emit("member-deactivated", data);
      }
      
      // Emit tới workspace nếu có
      if (data.board?.workspace?._id) {
        io.to(data.board.workspace._id).emit("member-deactivated", data);
      }
    });

    socket.on("disconnect", async () => {
      try {
        await User.findByIdAndUpdate(userId, { isOnline: false });
        connectedUsers.delete(userId);
        io.emit("user-status-changed", { userId, isOnline: false });
        console.log(`[Socket] User ${userId} disconnected`);
      } catch (err) {
        console.error("Socket.IO: Error updating user offline status:", err.message);
      }
    });
  });
};