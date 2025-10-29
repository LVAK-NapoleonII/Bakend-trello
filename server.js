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
const setupSocket = require("./socket/setupSocket"); 
const adminRoutes = require("./routes/adminRoutes");
const { scheduleInactiveUserCleanup } = require("./jobs/inactiveUserCleanup");


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
    origin: [
    'http://localhost:5173',
    'https://wcs4sbm1-5173.asse.devtunnels.ms',
    'http://192.168.1.7:5173' 
  ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);


app.use(cookieParser());
app.use(express.json());
app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));

// Setup Socket.IO
setupSocket(io);

// Routes
app.use("/api/auth", authRoutes(io));
app.use("/api/workspaces", workspaceRoutes(io));
app.use("/api/boards", boardRoutes(io));
app.use("/api/lists", listRoutes(io));
app.use("/api/cards", cardRoutes(io));
app.use("/api/activities", activityRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

if (process.env.NODE_ENV !== "test") {
  scheduleInactiveUserCleanup();
}

// Kích hoạt Swagger API Docs
swaggerDocs(app);

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
  console.error("Server: Error:", err.stack);
  res.status(500).json({ message: "Lỗi server", error: err.message });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server: Running on port ${PORT}`));