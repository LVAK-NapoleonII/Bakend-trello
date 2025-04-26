require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const swaggerDocs = require("./config/swagger");
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const boardRoutes = require("./routes/boardRoutes");
const listRoutes = require("./routes/listRoutes");
const cardRoutes = require("./routes/cardRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const activityRoutes = require("./routes/activityRoutes");
const Notification = require("./models/Notification");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Server: Connected to MongoDB"))
  .catch((err) => console.error("Server: MongoDB connection error:", err));

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));

// Socket.IO
io.on("connection", (socket) => {
  console.log(`Server: User connected: ${socket.id}`);

  socket.on("join-user", (userId) => {
    socket.join(userId);
    console.log(`Server: User ${userId} joined their room`);
  });

  socket.on("join-board", ({ boardId }) => {
    socket.join(boardId);
    console.log(`Server: User joined board room ${boardId}`);
  });

  socket.on("join-workspace", (workspaceId) => {
    socket.join(workspaceId);
    console.log(`Server: User joined workspace room ${workspaceId}`);
  });

  socket.on("user-login", (userId) => {
    console.log(`Server: User ${userId} logged in`);
    socket.broadcast.emit("user-status-update", { userId, status: "online" });
  });

  socket.on("refresh-sidebar", ({ userId }) => {
    console.log(`Server: Refresh sidebar for user: ${userId}`);
    io.to(userId).emit("refresh-sidebar");
  });

  socket.on("list-created", ({ boardId, list }) => {
    console.log(`Server: List created in board ${boardId}:`, list);
    io.to(boardId).emit("list-created", { boardId, list });
  });

  socket.on("list-deleted", ({ boardId, listId }) => {
    console.log(`Server: List deleted in board ${boardId}:`, listId);
    io.to(boardId).emit("list-deleted", { boardId, listId });
  });

  socket.on("list-order-updated", ({ boardId, columnOrder }) => {
    console.log(`Server: List order updated in board ${boardId}:`, columnOrder);
    io.to(boardId).emit("list-order-updated", { boardId, columnOrder });
  });

  socket.on("card-created", ({ boardId, listId, card }) => {
    console.log(`Server: Card created in list ${listId}:`, card);
    io.to(boardId).emit("card-created", { boardId, listId, card });
  });

  socket.on("card-deleted", ({ boardId, listId, cardId }) => {
    console.log(`Server: Card deleted in list ${listId}:`, cardId);
    io.to(boardId).emit("card-deleted", { boardId, listId, cardId });
  });

  socket.on("card-moved", ({ card, oldListId, newListId, newPosition }) => {
    console.log(`Server: Card moved from ${oldListId} to ${newListId}:`, card);
    io.to(card.board).emit("card-moved", { card, oldListId, newListId, newPosition });
  });

  socket.on("card-order-updated", ({ listId, cardOrder }) => {
    console.log(`Server: Card order updated in list ${listId}:`, cardOrder);
    io.to(listId).emit("card-order-updated", { listId, cardOrder });
  });

  socket.on("member-added", ({ cardId, members }) => {
    console.log(`Server: Member added to card ${cardId}:`, members);
    io.to(cardId).emit("member-added", { cardId, members });
  });

  socket.on("comment-added", ({ cardId, comment }) => {
    console.log(`Server: Comment added to card ${cardId}:`, comment);
    io.to(cardId).emit("comment-added", { cardId, comment });
  });

  socket.on("note-added", ({ cardId, note }) => {
    console.log(`Server: Note added to card ${cardId}:`, note);
    io.to(cardId).emit("note-added", { cardId, note });
  });

  socket.on("checklist-added", ({ cardId, checklist }) => {
    console.log(`Server: Checklist added to card ${cardId}:`, checklist);
    io.to(cardId).emit("checklist-added", { cardId, checklist });
  });

  socket.on("checklist-item-added", ({ cardId, checklistIndex, checklist }) => {
    console.log(`Server: Checklist item added to card ${cardId}:`, checklist);
    io.to(cardId).emit("checklist-item-added", { cardId, checklistIndex, checklist });
  });

  socket.on("checklist-item-toggled", ({ cardId, checklistIndex, checklist }) => {
    console.log(`Server: Checklist item toggled in card ${cardId}:`, checklist);
    io.to(cardId).emit("checklist-item-toggled", { cardId, checklistIndex, checklist });
  });

  socket.on("card-updated", ({ cardId, card }) => {
    console.log(`Server: Card updated: ${cardId}`, card);
    io.to(card.board).emit("card-updated", { cardId, card });
  });

  socket.on("card-completion-toggled", ({ cardId, completed }) => {
    console.log(`Server: Card completion toggled: ${cardId}`, completed);
    io.to(cardId).emit("card-completion-toggled", { cardId, completed });
  });

  socket.on("disconnect", () => {
    console.log(`Server: User disconnected: ${socket.id}`);
  });
});

app.set("io", io);

// Routes
app.use("/api/auth", authRoutes(io));
app.use("/api/workspaces", workspaceRoutes(io));
app.use("/api/boards", boardRoutes(io));
app.use("/api/lists", listRoutes(io));
app.use("/api/cards", cardRoutes(io));
app.use("/api/activities", activityRoutes);
app.use("/api/notifications", notificationRoutes);

// Route kiểm tra tạo thông báo thủ công
app.get("/api/test-notification", async (req, res) => {
  try {
    const notification = new Notification({
      user: "67ffe1f6e1c206bd0a4b0891",
      message: "Test notification",
      type: "general",
      target: "68066e339e54388199e6f1c8",
      targetModel: "Card",
      isRead: false,
      isHidden: false,
    });
    await notification.save();
    console.log("test-notification: Created notification:", notification);

    if (app.get("io")) {
      app.get("io").to("67ffe1f6e1c206bd0a4b0891").emit("new-notification", {
        _id: notification._id,
        user: "67ffe1f6e1c206bd0a4b0891",
        message: notification.message,
        type: notification.type,
        target: notification.target,
        targetModel: notification.targetModel,
        isRead: false,
        isHidden: false,
        createdAt: notification.createdAt,
      });
      console.log("test-notification: Emitted new-notification to: 67ffe1f6e1c206bd0a4b0891");
    }

    res.json({ message: "Test notification created", notification });
  } catch (error) {
    console.error("test-notification: Error:", error);
    res.status(500).json({ message: "Lỗi khi tạo thông báo kiểm tra", error: error.message });
  }
});

// Kích hoạt Swagger API Docs
swaggerDocs(app);

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
  console.error("Server: Error:", err.stack);
  res.status(500).json({ message: "Lỗi server", error: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server: Running on port ${PORT}`));