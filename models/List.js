const mongoose = require("mongoose");

const listSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
    position: { type: Number, default: 0 }, // dùng để sắp xếp
  },
  { timestamps: true }
);

module.exports = mongoose.model("List", listSchema);