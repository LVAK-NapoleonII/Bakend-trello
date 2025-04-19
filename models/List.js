const mongoose = require("mongoose");

const listSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
    position: { type: Number, default: 0 },
    cardOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Card", default: [] }],
    isDeleted: { type: Boolean, default: false },
    activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity", default: [] }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("List", listSchema);