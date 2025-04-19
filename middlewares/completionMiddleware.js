const Activity = require("../models/Activity");

const completionMiddleware = async (req, res, next) => {
  try {
    const cardId = req.params.id || req.body.cardId;
    const userId = req.user.id || req.user._id;
    const { completed, checklistId, itemId } = req.body;

    const Card = require("../models/cardSchema");
    const card = await Card.findById(cardId);

    if (!card) {
      return res.status(404).json({ message: "Card không tồn tại" });
    }

    let activity;

    // Trường hợp cập nhật completed của card
    if (typeof completed === "boolean") {
      const action = completed ? "card_completed" : "card_uncompleted";
      activity = new Activity({
        user: userId,
        action,
        target: cardId,
        targetModel: "Card",
        details: `Card "${card.title}" was marked as ${completed ? "completed" : "uncompleted"}`,
      });
      card.completed = completed;
    }

    // Trường hợp cập nhật completed của checklist item
    if (checklistId && itemId && typeof completed === "boolean") {
      const checklist = card.checklists.id(checklistId);
      if (!checklist) {
        return res.status(404).json({ message: "Checklist không tồn tại" });
      }
      const item = checklist.items.id(itemId);
      if (!item) {
        return res.status(404).json({ message: "Checklist item không tồn tại" });
      }
      const action = completed ? "checklist_completed" : "checklist_uncompleted";
      activity = new Activity({
        user: userId,
        action,
        target: cardId,
        targetModel: "Card",
        details: `Checklist item "${item.text}" was marked as ${completed ? "completed" : "uncompleted"}`,
      });
      item.completed = completed;
    }

    if (activity) {
      await activity.save();
      card.activities.push(activity._id);
      await card.save();
    }

    req.card = card; // Gắn card vào req để controller sử dụng

    next();
  } catch (error) {
    console.error("Completion middleware error:", error);
    return res.status(500).json({ message: "Lỗi khi cập nhật trạng thái completed" });
  }
};

module.exports = completionMiddleware;