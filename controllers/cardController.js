const mongoose = require("mongoose");
const Card = require("../models/Card");
const List = require("../models/List");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const Notification = require("../models/Notification");

const createCard = async (req, res) => {
  try {
    const { title, description, list, board } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    if (!title || !list || !board) return res.status(400).json({ message: "Title, list và board là bắt buộc!" });
    if (typeof title !== "string" || (description && typeof description !== "string")) {
      return res.status(400).json({ message: "Title và description phải là chuỗi!" });
    }
    if (!mongoose.Types.ObjectId.isValid(list) || !mongoose.Types.ObjectId.isValid(board)) {
      return res.status(400).json({ message: "List ID hoặc Board ID không hợp lệ!" });
    }

    const listExists = await List.findOne({ _id: list, isDeleted: false });
    if (!listExists) return res.status(404).json({ message: "List không tồn tại hoặc đã bị ẩn!" });

    const boardExists = await Board.findOne({ _id: board, isDeleted: false });
    if (!boardExists) return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });

    if (listExists.board.toString() !== board) {
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    const isMember = boardExists.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền tạo thẻ trong board này!" });

    const cardsInList = await Card.find({ list, isDeleted: false }).sort({ position: -1 }).limit(1);
    const newPosition = cardsInList.length > 0 ? cardsInList[0].position + 1 : 0;

    const card = await Card.create({
      title,
      description,
      list,
      board,
      members: [userId],
      position: newPosition,
      version: 0,
      isDeleted: false,
      activities: [],
      checklists: [],
    });

    listExists.cardOrderIds = listExists.cardOrderIds || [];
    listExists.cardOrderIds.push(card._id);

    const activity = new Activity({
      user: userId,
      action: { category: "card", type: "created" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} created card "${title}" in list "${listExists.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    listExists.activities = listExists.activities || [];
    listExists.activities.push(activity._id);
    boardExists.activities = boardExists.activities || [];
    boardExists.activities.push(activity._id);
    await Promise.all([card.save(), listExists.save(), boardExists.save()]);

    const notifications = boardExists.members.map((m) => ({
      user: m.user,
      message: `Thẻ "${title}" đã được tạo bởi ${req.user.fullName} trong danh sách "${listExists.title}"`,
      type: "activity",
      target: card._id,
      targetModel: "Card",
    }));
    await Notification.insertMany(notifications);

    const populatedCard = await Card.findById(card._id)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName avatar")
      .populate("notes.createdBy", "email fullName avatar")
      .populate({ path: "activities", match: { isDeleted: false } });

    const io = req.app.get("io");
    if (io) {
      io.to(board.toString()).emit("card-created", {
        card: populatedCard,
        listId: list,
        message: `Card "${title}" đã được tạo bởi ${req.user.fullName} trong list "${listExists.title}"`,
      });
    }

    return res.status(201).json(populatedCard);
  } catch (error) {
    console.error("createCard error:", error.message);
    return res.status(500).json({ message: "Lỗi server khi tạo thẻ!" });
  }
};

const getCardsByList = async (req, res) => {
  try {
    const { listId } = req.params;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(listId)) return res.status(400).json({ message: "List ID không hợp lệ!" });

    const list = await List.findOne({ _id: listId, isDeleted: false });
    if (!list) return res.status(404).json({ message: "Không tìm thấy danh sách!" });

    const board = await Board.findOne({ _id: list.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Không tìm thấy bảng!" });

    const workspace = await Workspace.findById(board.workspace);
    if (!workspace) return res.status(404).json({ message: "Không tìm thấy workspace!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    const isPublicBoard = board.visibility === "public";
    const isWorkspaceMember = workspace.members.includes(userId) || workspace.isPublic;

    if (!isMember && !isPublicBoard && !isWorkspaceMember) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập danh sách này!" });
    }

    const cards = await Card.find({ list: listId, isDeleted: false })
      .populate("members", "email fullName avatar isOnline")
      .populate("labels")
      .sort({ position: 1 });  

    res.status(200).json(cards);
  } catch (error) {
    console.error("getCardsByList error:", error.message);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

const getCardById = async (req, res) => {
  try {
    const cardId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(cardId)) return res.status(400).json({ message: "Card ID không hợp lệ!" });

    const card = await Card.findOne({ _id: cardId, isDeleted: false })
      .populate("members", "email fullName avatar")
      .populate({
        path: "comments",
        match: { isDeleted: false },
        populate: {
          path: "user",
          select: "email fullName avatar"
        },
        options: { sort: { createdAt: -1 } }
      })
      .populate({
        path: "notes", 
        match: { isDeleted: false },
        populate: {
          path: "createdBy",
          select: "email fullName avatar"
        },
        options: { sort: { createdAt: -1 } }
      })
      .populate({ path: "activities", match: { isDeleted: false } });

    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ!" });

    const filteredCard = {
      ...card._doc,
      checklists: card.checklists
        .filter((checklist) => !checklist.isDeleted)
        .map((checklist) => ({
          ...checklist._doc,
          items: checklist.items.filter((item) => !item.isDeleted),
        })),
    };

    res.status(200).json(filteredCard);
  } catch (error) {
    console.error("getCardById error:", error.message);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const updateCard = async (req, res) => {
  try {
    const cardId = req.params.id;
    const { title, description, dueDate, cover, version } = req.body;
    const userId = req.user?._id;

    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId)) return res.status(400).json({ message: "Card ID không hợp lệ!" });
    if (version === undefined) {
      return res.status(400).json({ message: "Version is required for update" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ!" });

    const versionDiff = card.version - version;
    if (versionDiff > 2) {
      // Conflict nghiêm trọng - từ chối
      return res.status(409).json({ 
        message: "Xung đột dữ liệu!! thẻ đang được chỉnh sửa bởi nhiều người",
        code: "VERSION_CONFLICT",
        currentVersion: card.version
      });
    }
    
    // Nếu chỉ lệch 1-2 version → cảnh báo nhưng vẫn cho phép
    if (versionDiff > 0 && versionDiff <= 2) {
      console.warn(`Version mismatch detected: expected ${version}, got ${card.version}`);
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền cập nhật thẻ!" });

    const changes = [];
    const oldTitle = card.title;

    if (title !== undefined && title.trim() !== card.title) {
      card.title = title.trim();
      changes.push("tiêu đề");
    }

    if (description !== undefined) {
      const newDesc = description?.trim() || null;
      if (newDesc !== card.description) {
        card.description = newDesc;
        changes.push("mô tả");
      }
    }

    if (dueDate !== undefined) {
      const newDueDate = dueDate ? new Date(dueDate) : null;
      if ((newDueDate?.toISOString() || null) !== (card.dueDate?.toISOString() || null)) {
        card.dueDate = newDueDate;
        changes.push("hạn chót");
      }
    }

    if (cover !== undefined) {
      const newCover = cover?.trim() || null;
      const isHex = /^#[0-9A-Fa-f]{6}$/.test(newCover);
      const isImageUrl = /^https?:\/\/.+/i.test(newCover) || /^data:image\/.+;base64,/.test(newCover);

      if (newCover && !isHex && !isImageUrl) {
        return res.status(400).json({
          message: "Cover phải là mã HEX (#FF0000) hoặc URL ảnh hợp lệ",
        });
      }
      if (newCover !== card.cover) {
        card.cover = newCover;
        changes.push("bìa");
      }
    }

    if (changes.length === 0) {
      const populatedCard = await Card.findById(cardId)
        .populate("members", "email fullName avatar")
        .populate({
          path: "comments",
          match: { isDeleted: false },
          populate: { path: "user", select: "email fullName avatar" }
        })
        .populate({
          path: "notes",
          match: { isDeleted: false },
          populate: { path: "createdBy", select: "email fullName avatar" }
        })
        .populate({ path: "activities", match: { isDeleted: false } });
      
      return res.status(200).json({
        ...populatedCard.toObject(),
        version: card.version  
      });
    }

    card.version += 1; 
    
    const activity = new Activity({
      user: userId,
      action: { category: "card", type: "updated" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} đã cập nhật ${changes.join(", ")} của thẻ "${oldTitle}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    await card.save();

    const populatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate({
        path: "comments",
        match: { isDeleted: false },
        populate: { path: "user", select: "email fullName avatar" }
      })
      .populate({
        path: "notes",
        match: { isDeleted: false },
        populate: { path: "createdBy", select: "email fullName avatar" }
      })
      .populate({ path: "activities", match: { isDeleted: false } });

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("card-updated", {
        card: {
          ...populatedCard.toObject(),
          version: card.version  
        },
        message: `${req.user.fullName} đã cập nhật ${changes.join(", ")} của thẻ "${oldTitle}"`,
      });
    }

    return res.status(200).json({
      ...populatedCard.toObject(),
      version: card.version 
    });
  } catch (error) {
    console.error("updateCard error:", error.message);
    return res.status(500).json({ message: "Lỗi khi cập nhật thẻ" });
  }
};

const deleteCard = async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId)) return res.status(400).json({ message: "Card ID không hợp lệ!" });

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền xóa thẻ!" });

    card.isDeleted = true;

    const list = await List.findOne({ _id: card.list, isDeleted: false });
    if (list) {
      list.cardOrderIds = list.cardOrderIds.filter((id) => id.toString() !== cardId);
      await list.save();
    }

    const activity = new Activity({
      user: userId,
      action: { category: "card", type: "deleted" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} hid card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    await card.save();

    const notifications = board.members.map((m) => ({
      user: m.user,
      message: `${req.user.fullName} đã ẩn card "${card.title}"`,
      type: "activity",
      target: card._id,
      targetModel: "Card",
    }));
    await Notification.insertMany(notifications);

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("card-hidden", {
        cardId,
        listId: card.list,
        message: `${req.user.fullName} đã ẩn card "${card.title}"`,
      });
    }

    return res.status(200).json({ message: "Đã ẩn thẻ thành công" });
  } catch (error) {
    console.error("deleteCard error:", error.message);
    return res.status(500).json({ message: "Lỗi khi xóa thẻ" });
  }
};

const toggleCardCompletion = async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    if (!mongoose.Types.ObjectId.isValid(cardId)) return res.status(400).json({ message: "Card ID không hợp lệ!" });

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) return res.status(404).json({ message: "Không tìm thấy thẻ!" });

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) return res.status(404).json({ message: "Board không tồn tại!" });

    const isMember = board.members.some((m) => m.user?.toString() === userId.toString() && m.isActive);
    if (!isMember) return res.status(403).json({ message: "Bạn không có quyền cập nhật thẻ!" });

    card.completed = !card.completed;
    card.version += 1;
    const activity = new Activity({
      user: userId,
      action: { category: "card", type: card.completed ? "completed" : "uncompleted" },
      target: card._id,
      targetModel: "Card",
      details: `User ${req.user.fullName} ${card.completed ? "completed" : "uncompleted"} card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    await card.save();

    const notifications = board.members.map((m) => ({
      user: m.user,
      message: `${req.user.fullName} đã ${card.completed ? "hoàn thành" : "bỏ hoàn thành"} card "${card.title}"`,
      type: "activity",
      target: card._id,
      targetModel: "Card",
    }));
    await Notification.insertMany(notifications);

    const io = req.app.get("io");
    if (io) {
      io.to(card.board.toString()).emit("card-completion-toggled", {
        cardId,
        completed: card.completed,
        version: card.version,
        message: `${req.user.fullName} đã ${card.completed ? "hoàn thành" : "bỏ hoàn thành"} card "${card.title}"`,
      });
    }

    return res.status(200).json({
      message: "Cập nhật trạng thái thành công",
      card: { _id: card._id, title: card.title, completed: card.completed,version: card.version },
    });
  } catch (error) {
    console.error("toggleCardCompletion error:", error.message);
    return res.status(500).json({ message: "Lỗi khi cập nhật trạng thái" });
  }
};

module.exports = {
  createCard,
  getCardsByList,
  getCardById,
  updateCard,
  deleteCard,
  moveCard: require("./card/moveCard"),
  addMember: require("./card/addMember"),
  removeMemberFromCard: require("./card/removeMemberFromCard"),
  toggleCardCompletion,
};