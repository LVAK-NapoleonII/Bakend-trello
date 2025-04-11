const mongoose = require("mongoose");

const cardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    list: { type: mongoose.Schema.Types.ObjectId, ref: "List", required: true },
    board: { type: mongoose.Schema.Types.ObjectId, ref: "Board", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    cover: { type: String },
    dueDate: { type: Date },
    completed: { type: Boolean, default: false },
    position: { type: Number, default: 0 },

    //  Phân việc và cộng tác
    checklists: [
      {
        title: String,
        items: [
          {
            text: String,
            completed: { type: Boolean, default: false },
          },
        ],
      },
    ],
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    notes: [
      {
        content: String,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Card", cardSchema);