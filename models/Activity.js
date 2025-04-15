const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: [
        "join_workspace",
        "leave_workspace",
        "join_card",
        "leave_card",
        "join_list",
        "leave_list",
        "create_notification",
        "complete_card",
        "reopen_card",
        "create_card",
        "update_card",
        "delete_card",
        "create_list",
        "update_list",
        "delete_list",
        // Có thể mở rộng thêm các hành động khác
      ],
      required: true,
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "targetModel",
      required: false, 
    },
    targetModel: {
      type: String,
      enum: ["Card", "List", "Board", null],
      required: false,
    },
    details: {
      type: String, 
    },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);