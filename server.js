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
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

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

// Socket.IO
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-user", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
  });

  socket.on("join-board", ({ boardId }) => {
    socket.join(boardId);
    console.log(`User joined board room ${boardId}`);
  });

  socket.on("join-workspace", (workspaceId) => {
    socket.join(workspaceId);
    console.log(`User joined workspace room ${workspaceId}`);
  });

  socket.on("user-login", (userId) => {
    console.log(`User ${userId} logged in`);
    socket.broadcast.emit("user-status-update", { userId, status: "online" });
  });

  socket.on("refresh-sidebar", ({ userId }) => {
    console.log(`Refresh sidebar for user: ${userId}`);
    io.to(userId).emit("refresh-sidebar");
  });

  // Xử lý sự kiện liên quan đến thẻ
  socket.on("member-added", ({ cardId, members }) => {
    console.log(`Member added to card ${cardId}:`, members);
    io.to(cardId).emit("member-added", { cardId, members });
  });

  socket.on("comment-added", ({ cardId, comment }) => {
    console.log(`Comment added to card ${cardId}:`, comment);
    io.to(cardId).emit("comment-added", { cardId, comment });
  });

  socket.on("note-added", ({ cardId, note }) => {
    console.log(`Note added to card ${cardId}:`, note);
    io.to(cardId).emit("note-added", { cardId, note });
  });

  socket.on("checklist-added", ({ cardId, checklist }) => {
    console.log(`Checklist added to card ${cardId}:`, checklist);
    io.to(cardId).emit("checklist-added", { cardId, checklist });
  });

  socket.on("checklist-item-added", ({ cardId, checklistIndex, checklist }) => {
    console.log(`Checklist item added to card ${cardId}:`, checklist);
    io.to(cardId).emit("checklist-item-added", { cardId, checklistIndex, checklist });
  });

  socket.on("checklist-item-toggled", ({ cardId, checklistIndex, checklist }) => {
    console.log(`Checklist item toggled in card ${cardId}:`, checklist);
    io.to(cardId).emit("checklist-item-toggled", { cardId, checklistIndex, checklist });
  });

  socket.on("card-updated", ({ cardId, card }) => {
    console.log(`Card updated: ${cardId}`, card);
    io.to(cardId).emit("card-updated", { cardId, card });
  });

  socket.on("card-deleted", ({ cardId }) => {
    console.log(`Card deleted: ${cardId}`);
    io.to(cardId).emit("card-deleted", { cardId });
  });

  socket.on("card-completion-toggled", ({ cardId, completed }) => {
    console.log(`Card completion toggled: ${cardId}`, completed);
    io.to(cardId).emit("card-completion-toggled", { cardId, completed });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Routes
app.use("/api/auth", authRoutes(io));
app.use("/api/workspaces", workspaceRoutes(io));
app.use("/api/boards", boardRoutes(io));
app.use("/api/lists", listRoutes(io));
app.use("/api/cards", cardRoutes(io));
app.use("/api/notifications", notificationRoutes);
app.use("/api/activities", activityRoutes);

// Kích hoạt Swagger API Docs
swaggerDocs(app);

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(500).json({ message: "Lỗi server", error: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));