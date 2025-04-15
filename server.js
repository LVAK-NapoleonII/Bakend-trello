const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const cors = require("cors");
const swaggerDocs = require("./config/swagger");
const authRoutes = require("./routes/authRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const boardRoutes = require("./routes/boardRoutes");
const listRoutes = require("./routes/listRoutes");
const cardRoutes = require("./routes/cardRoutes");
const cookieParser = require("cookie-parser");
const path = require("path");

// Thêm các module cần thiết cho Socket.IO
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();
const app = express();
connectDB();

// Tạo HTTP server từ Express app
const server = http.createServer(app);

// Khởi tạo Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Địa chỉ của frontend
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(cors());
app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes(io));
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/lists", listRoutes);
app.use("/api/cards", cardRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Kích hoạt Swagger API Docs
swaggerDocs(app);

// Quản lý các kết nối Socket.IO
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Xử lý sự kiện khi người dùng đăng nhập
  socket.on("user-login", (userId) => {
    console.log(`User ${userId} logged in`);
    // Gửi thông báo đến tất cả client khác (trừ người gửi)
    socket.broadcast.emit("user-status-update", { userId, status: "online" });
  });

  // Xử lý sự kiện khi người dùng ngắt kết nối
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    // Có thể gửi thông báo trạng thái offline nếu cần
  });
});

const PORT = process.env.PORT || 5000;
// Sử dụng server HTTP thay vì app.listen
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));