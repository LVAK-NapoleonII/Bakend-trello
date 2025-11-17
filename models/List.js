const mongoose = require("mongoose");

const listSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
    position: { type: Number, default: 0 },
    cardOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Card", default: [] }],
    dueDate: { type: Date },
    isDeleted: { type: Boolean, default: false },
    activities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Activity", default: [] }],
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

listSchema.index({ board: 1, isDeleted: 1, position: 1 });

module.exports = mongoose.model("List", listSchema);