const mongoose = require("mongoose");
const boardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  background: { type: String },
  visibility: { type: String, enum: ["public", "private"], default: "public" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      isActive: { type: Boolean, default: true }, // Thêm trạng thái
    },
  ],
  listOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "List" }],
  invitedUsers: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      isActive: { type: Boolean, default: true },
    },
  ],
  activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity" }], 
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model("Board", boardSchema);