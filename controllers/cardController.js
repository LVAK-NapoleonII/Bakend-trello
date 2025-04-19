// controllers/cardController.js
const mongoose = require("mongoose");
const Card = require("../models/Card");
const List = require("../models/List");
const Board = require("../models/Board");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const User = require("../models/User");

// Tạo thẻ mới
const createCard = async (req, res, io) => {
  try {
    const { title, description, list, board, } = req.body;

    console.log("Received createCard request:", {
      title,
      list,
      board,
      userId: req.user?._id?.toString() || "unknown",
      time: new Date().toISOString(),
    });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin người dùng!" });
    }

    if (!title || !list || !board) {
      console.log("Missing required fields:", { title, list, board });
      return res.status(400).json({ message: "Title, list và board là bắt buộc!" });
    }

    if (typeof title !== "string") {
      console.log("Invalid title:", title);
      return res.status(400).json({ message: "Title phải là chuỗi!" });
    }

    if (description && typeof description !== "string") {
      console.log("Invalid description:", description);
      return res.status(400).json({ message: "Description phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(list)) {
      console.log("Invalid listId:", list);
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(board)) {
      console.log("Invalid boardId:", board);
      return res.status(400).json({ message: "Board ID không hợp lệ!" });
    }

    const listExists = await List.findOne({ _id: list, isDeleted: false });
    if (!listExists) {
      console.log("List not found or deleted:", list);
      return res.status(404).json({ message: "List không tồn tại hoặc đã bị ẩn!" });
    }

    const boardExists = await Board.findOne({ _id: board, isDeleted: false });
    if (!boardExists) {
      console.log("Board not found or deleted:", board);
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    if (listExists.board.toString() !== board) {
      console.log("List does not belong to board:", { list, board });
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    const isMember = boardExists.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền tạo thẻ trong board này!" });
    }

    const cardsInList = await Card.find({ list, isDeleted: false })
      .sort({ position: -1 })
      .limit(1);
    const newPosition = cardsInList.length > 0 ? cardsInList[0].position + 1 : 0;

    const card = await Card.create({
      title,
      description,
      list,
      board,
      members: [req.user._id],
      position: newPosition,
      isDeleted: false,
      activities: [],
      checklists: [],
    });

    listExists.cardOrderIds = listExists.cardOrderIds || [];
    if (!listExists.cardOrderIds.includes(card._id)) {
      listExists.cardOrderIds.push(card._id);
    }
    await listExists.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "card_created",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} created card "${title}" in list "${listExists.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    listExists.activities = listExists.activities || [];
    listExists.activities.push(activity._id);
    boardExists.activities = boardExists.activities || [];
    boardExists.activities.push(activity._id);
    await Promise.all([card.save(), listExists.save(), boardExists.save()]);

    const populatedCard = await Card.findById(card._id)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName")
      .populate("notes.createdBy", "email fullName")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(board.toString()).emit("card-created", {
      card: populatedCard,
      listId: list,
      message: `Card "${title}" đã được tạo bởi ${userName} trong list "${listExists.title}"`,
    });

    console.log("Card created successfully:", {
      cardId: card._id.toString(),
      listId: list,
      boardId: board,
    });

    return res.status(201).json(populatedCard);
  } catch (err) {
    console.error("Error in createCard:", {
      message: err.message,
      stack: err.stack,
      requestBody: req.body,
      userId: req.user?._id?.toString() || "unknown",
    });
    return res.status(500).json({ message: "Lỗi server khi tạo thẻ!", error: err.message });
  }
};

// Lấy danh sách thẻ trong list
const getCardsByList = async (req, res) => {
  try {
    const listId = req.params.listId;

    console.log("Fetching cards for list:", { listId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(listId)) {
      console.log("Invalid listId:", listId);
      return res.status(400).json({ message: "List ID không hợp lệ!" });
    }

    const listExists = await List.findOne({ _id: listId, isDeleted: false });
    if (!listExists) {
      console.log("List not found or deleted:", listId);
      return res.status(404).json({ message: "List không tồn tại hoặc đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: listExists.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", listExists.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền truy cập list này!" });
    }

    const cards = await Card.find({ list: listId, isDeleted: false })
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName")
      .populate("notes.createdBy", "email fullName")
      .populate({ path: "activities", match: { isDeleted: false } });

    const orderedCards = (listExists.cardOrderIds || [])
      .map((cardId) => cards.find((card) => card._id.toString() === cardId.toString()))
      .filter((card) => card);

    const remainingCards = cards.filter((card) => !listExists.cardOrderIds.includes(card._id));
    const finalCards = [...orderedCards, ...remainingCards];

    console.log("Found cards:", finalCards.map((c) => ({ id: c._id.toString(), title: c.title })));

    res.status(200).json(finalCards);
  } catch (err) {
    console.error("Error in getCardsByList:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi lấy thẻ", error: err.message });
  }
};

// Cập nhật thẻ
const updateCard = async (req, res, io) => {
  try {
    const { id: cardId } = req.params;
    const { title, description } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật thẻ!" });
    }

    if (title) card.title = title;
    if (description !== undefined) card.description = description;

    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "card_updated",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} updated card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    await card.save();

    io.to(card.board.toString()).emit("card-updated", {
      card,
      message: `${userName} đã cập nhật card "${card.title}"`,
    });

    return res.status(200).json(card);
  } catch (err) {
    console.error("Error in updateCard:", err.message);
    return res.status(500).json({ message: "Lỗi khi cập nhật thẻ", error: err.message });
  }
};

// Xóa thẻ
const deleteCard = async (req, res, io) => {
  try {
    const { id: cardId } = req.params;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền xóa thẻ!" });
    }

    card.isDeleted = true;
    await card.save();

    const list = await List.findOne({ _id: card.list, isDeleted: false });
    if (list) {
      list.cardOrderIds = list.cardOrderIds.filter((id) => id.toString() !== cardId);
      await list.save();
    }

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "card_hidden",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} hid card "${card.title}"`,
    });
    await activity.save();

    io.to(card.board.toString()).emit("card-hidden", {
      cardId,
      listId: card.list,
      message: `${userName} đã ẩn card "${card.title}"`,
    });

    return res.status(200).json({ message: "Đã ẩn thẻ thành công" });
  } catch (err) {
    console.error("Error in deleteCard:", err.message);
    return res.status(500).json({ message: "Lỗi khi xóa thẻ", error: err.message });
  }
};

// Thêm bình luận
const addComment = async (req, res, io) => {
  let { cardId } = req.params;
  const { text, cardId: bodyCardId } = req.body;

  try {
    console.log("addComment request:", {
      url: req.url,
      params: req.params,
      body: req.body,
      user: req.user?.email || "unknown",
      time: new Date().toISOString(),
    });

    if (!cardId && bodyCardId) {
      console.log("Using cardId from body as fallback:", bodyCardId);
      cardId = bodyCardId;
    }

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!cardId) {
      console.log("Missing cardId");
      return res.status(400).json({ message: "Card ID là bắt buộc!" });
    }

    if (!text || typeof text !== "string") {
      console.log("Invalid text:", text);
      return res.status(400).json({ message: "Text là bắt buộc và phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", card.board?.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền bình luận trên thẻ này!" });
    }

    const comment = {
      user: req.user._id,
      text,
      createdAt: new Date(),
    };

    card.comments.push(comment);
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "comment_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added a comment to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    for (const memberId of card.members) {
      if (memberId.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: memberId,
          message: `${userName} đã bình luận trên card "${card.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        await notification.save();
        io.to(memberId.toString()).emit("new-notification", notification);
      }
    }

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName")
      .populate("notes.createdBy", "email fullName")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(card.board.toString()).emit("comment-added", {
      cardId,
      comment,
      message: `${userName} đã thêm bình luận vào card "${card.title}"`,
    });

    console.log("Comment added successfully:", {
      cardId,
      commentId: comment._id,
      userId: req.user._id.toString(),
    });

    return res.status(200).json(updatedCard.comments);
  } catch (err) {
    console.error("Error in addComment:", {
      message: err.message,
      stack: err.stack,
      cardId,
      userId: req.user?._id?.toString() || "unknown",
      requestBody: req.body,
      requestParams: req.params,
    });
    return res.status(500).json({ message: "Lỗi khi thêm bình luận", error: err.message });
  }
};

// Thêm ghi chú
const addNote = async (req, res, io) => {
  const { cardId } = req.params;
  const { content } = req.body;

  try {
    console.log("Adding note:", { cardId, content, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!content || typeof content !== "string") {
      console.log("Invalid content:", content);
      return res.status(400).json({ message: "Content là bắt buộc và phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền thêm ghi chú vào thẻ này!" });
    }

    const note = {
      content,
      createdBy: req.user._id,
      createdAt: new Date(),
    };

    card.notes.push(note);
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "note_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added a note to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName")
      .populate("notes.createdBy", "email fullName")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(card.board.toString()).emit("note-added", {
      cardId,
      note,
      message: `${userName} đã thêm ghi chú vào card "${card.title}"`,
    });

    console.log("Note added successfully:", { cardId, noteId: note._id });

    res.status(200).json(updatedCard.notes);
  } catch (err) {
    console.error("Error in addNote:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm ghi chú", error: err.message });
  }
};

// Thêm checklist
const addChecklist = async (req, res, io) => {
  const { cardId } = req.params;
  const { title } = req.body;

  try {
    console.log("Adding checklist:", { cardId, title, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!title || typeof title !== "string") {
      console.log("Invalid title:", title);
      return res.status(400).json({ message: "Title là bắt buộc và phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền thêm checklist vào thẻ này!" });
    }

    const checklist = {
      title,
      items: [],
    };

    card.checklists.push(checklist);
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "checklist_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added checklist "${title}" to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    io.to(card.board.toString()).emit("checklist-added", {
      cardId,
      checklist,
      message: `${userName} đã thêm checklist "${title}" vào card "${card.title}"`,
    });

    console.log("Checklist added successfully:", { cardId, checklistTitle: title });

    res.status(200).json(card.checklists);
  } catch (err) {
    console.error("Error in addChecklist:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm checklist", error: err.message });
  }
};

// Thêm item vào checklist
const addChecklistItem = async (req, res, io) => {
  const { cardId, checklistIndex } = req.params;
  const { text } = req.body;

  try {
    console.log("Adding checklist item:", { cardId, checklistIndex, text, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!text || typeof text !== "string") {
      console.log("Invalid text:", text);
      return res.status(400).json({ message: "Text là bắt buộc và phải là chuỗi!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const index = parseInt(checklistIndex);
    if (isNaN(index) || index < 0) {
      console.log("Invalid checklistIndex:", checklistIndex);
      return res.status(400).json({ message: "Checklist index không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền thêm item vào checklist này!" });
    }

    if (!card.checklists[index]) {
      console.log("Checklist not found:", index);
      return res.status(404).json({ message: "Không tìm thấy checklist!" });
    }

    card.checklists[index].items.push({ text, completed: false });
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "checklist_item_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added item "${text}" to checklist in card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    io.to(card.board.toString()).emit("checklist-item-added", {
      cardId,
      checklistIndex: index,
      item: { text, completed: false },
      message: `${userName} đã thêm item "${text}" vào checklist trong card "${card.title}"`,
    });

    console.log("Checklist item added successfully:", { cardId, checklistIndex, text });

    res.status(200).json(card.checklists);
  } catch (err) {
    console.error("Error in addChecklistItem:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm item vào checklist", error: err.message });
  }
};

// Đánh dấu hoàn thành/không hoàn thành checklist item
const toggleChecklistItem = async (req, res, io) => {
  const { cardId, checklistIndex, itemIndex } = req.params;

  try {
    console.log("Toggling checklist item:", {
      cardId,
      checklistIndex,
      itemIndex,
      user: req.user?.email,
    });

    // Kiểm tra user
    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    // Kiểm tra cardId
    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    // Kiểm tra và chuyển đổi index
    const checklistIdx = parseInt(checklistIndex);
    const itemIdx = parseInt(itemIndex);
    if (isNaN(checklistIdx) || checklistIdx < 0 || isNaN(itemIdx) || itemIdx < 0) {
      console.log("Invalid indices:", { checklistIndex, itemIndex });
      return res.status(400).json({ message: "Checklist index hoặc item index không hợp lệ!" });
    }

    // Tìm card
    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    // Tìm board
    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    // Kiểm tra quyền thành viên
    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền cập nhật checklist này!" });
    }

    // Kiểm tra checklists
    if (!card.checklists || !Array.isArray(card.checklists)) {
      console.log("Checklists not initialized for card:", cardId);
      return res.status(404).json({ message: "Checklist không tồn tại!" });
    }

    // Kiểm tra checklist và item
    if (!card.checklists[checklistIdx] || !card.checklists[checklistIdx].items[itemIdx]) {
      console.log("Checklist or item not found:", { checklistIdx, itemIdx });
      return res.status(404).json({ message: "Không tìm thấy checklist hoặc item!" });
    }

    // Toggle trạng thái completed
    const item = card.checklists[checklistIdx].items[itemIdx];
    item.completed = !item.completed;

    // Lưu card
    await card.save();

    // Tạo activity
    const userName = req.user.fullName || req.user.email || "Unknown User";
    const action = item.completed ? "checklist_item_completed" : "checklist_item_uncompleted";
    const activity = new Activity({
      user: req.user._id,
      action,
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} ${item.completed ? "completed" : "uncompleted"} item "${item.text}" in checklist of card "${card.title}"`,
    });
    await activity.save();

    // Cập nhật activities cho card và board
    card.activities = card.activities || [];
    card.activities.push(activity._id);
    board.activities = board.activities || [];
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    // Gửi thông báo cho các thành viên khác
    for (const memberId of card.members) {
      if (memberId.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: memberId,
          message: `${userName} đã ${item.completed ? "hoàn thành" : "bỏ hoàn thành"} item "${item.text}" trong card "${card.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        await notification.save();
        io.to(memberId.toString()).emit("new-notification", notification);
      }
    }

    // Phát sự kiện Socket.IO
    io.to(card.board.toString()).emit("checklist-item-toggled", {
      cardId,
      checklistIndex: checklistIdx,
      itemIndex: itemIdx,
      completed: item.completed,
      message: `${userName} đã ${item.completed ? "hoàn thành" : "bỏ hoàn thành"} item "${item.text}" trong card "${card.title}"`,
    });

    console.log("Checklist item toggled successfully:", {
      cardId,
      checklistIndex: checklistIdx,
      itemIndex: itemIdx,
      completed: item.completed,
    });

    // Trả về toàn bộ checklists
    res.status(200).json(card.checklists);
  } catch (err) {
    console.error("Error in toggleChecklistItem:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi cập nhật trạng thái checklist item", error: err.message });
  }
};
// Di chuyển thẻ giữa các list
const moveCard = async (req, res, io) => {
  let cardId;
  try {
    cardId = req.params.cardId;
    const { newListId, newBoardId, newPosition } = req.body;

    console.log("Received moveCard request:", {
      cardId,
      cardIdType: typeof cardId,
      cardIdLength: cardId?.length,
      newListId,
      newBoardId,
      newPosition,
      user: req.user?.email,
      time: new Date().toISOString(),
    });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!cardId || typeof cardId !== "string") {
      console.log("CardId is missing or not a string:", { cardId });
      return res.status(400).json({ message: "Card ID bị thiếu hoặc không hợp lệ!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId format:", { cardId });
      return res.status(400).json({ message: "Card ID không đúng định dạng ObjectId!" });
    }

    if (!mongoose.Types.ObjectId.isValid(newListId)) {
      console.log("Invalid newListId:", newListId);
      return res.status(400).json({ message: "New List ID không hợp lệ!" });
    }
    if (!mongoose.Types.ObjectId.isValid(newBoardId)) {
      console.log("Invalid newBoardId:", newBoardId);
      return res.status(400).json({ message: "New Board ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const newList = await List.findOne({ _id: newListId, isDeleted: false });
    if (!newList) {
      console.log("New list not found or deleted:", newListId);
      return res.status(404).json({ message: "List đích không tồn tại hoặc đã bị ẩn!" });
    }

    const newBoard = await Board.findOne({ _id: newBoardId, isDeleted: false });
    if (!newBoard) {
      console.log("New board not found or deleted:", newBoardId);
      return res.status(404).json({ message: "Board đích không tồn tại hoặc đã bị ẩn!" });
    }

    if (newList.board.toString() !== newBoardId) {
      console.log("List does not belong to board:", { newListId, newBoardId });
      return res.status(400).json({ message: "List không thuộc board này!" });
    }

    const isMember = newBoard.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền di chuyển thẻ đến board này!" });
    }

    const oldList = await List.findOne({ _id: card.list, isDeleted: false });
    const isSameList = oldList && oldList._id.toString() === newListId;

    let finalPosition = newPosition !== undefined ? newPosition : card.position;

    if (isSameList) {
      if (newPosition !== undefined) {
        oldList.cardOrderIds = oldList.cardOrderIds.filter(
          (id) => id.toString() !== cardId
        );
        if (newPosition >= oldList.cardOrderIds.length) {
          oldList.cardOrderIds.push(card._id);
          finalPosition = oldList.cardOrderIds.length - 1;
        } else {
          oldList.cardOrderIds.splice(newPosition, 0, card._id);
          finalPosition = newPosition;
        }
        await oldList.save();
      }
    } else {
      if (oldList) {
        oldList.cardOrderIds = oldList.cardOrderIds.filter(
          (id) => id.toString() !== cardId
        );
        await oldList.save();
      }

      newList.cardOrderIds = newList.cardOrderIds || [];
      if (newPosition !== undefined && newPosition < newList.cardOrderIds.length) {
        newList.cardOrderIds.splice(newPosition, 0, card._id);
        finalPosition = newPosition;
      } else {
        newList.cardOrderIds.push(card._id);
        finalPosition = newList.cardOrderIds.length - 1;
      }
      await newList.save();

      card.list = newListId;
      card.board = newBoardId;
    }

    card.position = finalPosition;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "card_moved",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} moved card "${card.title}" to list "${newList.title}"${
        isSameList ? " at position " + finalPosition : ""
      }`,
    });
    await activity.save();

    card.activities = card.activities || [];
    card.activities.push(activity._id);
    newBoard.activities = newBoard.activities || [];
    newBoard.activities.push(activity._id);

    for (const member of card.members) {
      if (member.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          user: member,
          message: `${userName} đã di chuyển card "${card.title}" đến list "${newList.title}"`,
          type: "activity",
          target: card._id,
          targetModel: "Card",
        });
        await notification.save();
        io.to(member.toString()).emit("new-notification", notification);
      }
    }

    await Promise.all([card.save(), newBoard.save()]);

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName")
      .populate("notes.createdBy", "email fullName")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(newBoardId).emit("card-moved", {
      card: updatedCard,
      oldListId: oldList ? oldList._id : null,
      newListId,
      newPosition: finalPosition,
      message: `${userName} đã di chuyển card "${card.title}" đến list "${newList.title}"`,
    });

    if (!isSameList && oldList) {
      io.to(card.board.toString()).emit("card-moved", {
        card: updatedCard,
        oldListId: oldList._id,
        newListId,
        newPosition: finalPosition,
        message: `${userName} đã di chuyển card "${card.title}" từ list "${oldList.title}"`,
      });
    }

    console.log("Card moved successfully:", {
      cardId,
      newListId,
      newBoardId,
      newPosition: finalPosition,
    });

    return res.status(200).json({
      message: "Di chuyển thẻ thành công",
      card: updatedCard,
    });
  } catch (err) {
    console.error("Error in moveCard:", {
      message: err.message,
      stack: err.stack,
      cardId: cardId || req.params.cardId,
      newListId: req.body.newListId,
      newBoardId: req.body.newBoardId,
      userId: req.user?._id?.toString(),
    });
    return res.status(500).json({
      message: "Lỗi khi di chuyển thẻ",
      error: err.message,
    });
  }
};

// Thêm thành viên vào thẻ
const addMember = async (req, res, io) => {
  try {
    const { cardId } = req.params;
    const { memberId } = req.body;

    console.log("Adding member to card:", { cardId, memberId, user: req.user?.email });

    if (!req.user || !req.user._id) {
      console.log("No user found in req.user");
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      console.log("Invalid cardId:", cardId);
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      console.log("Invalid memberId:", memberId);
      return res.status(400).json({ message: "Member ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      console.log("Card not found or deleted:", cardId);
      return res.status(404).json({ message: "Không tìm thấy thẻ hoặc thẻ đã bị ẩn!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      console.log("Board not found or deleted:", card.board.toString());
      return res.status(404).json({ message: "Board không tồn tại hoặc đã bị ẩn!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      console.log("Permission denied for user:", req.user._id.toString());
      return res.status(403).json({ message: "Bạn không có quyền thêm member vào thẻ này!" });
    }

    const isBoardMember = board.members.some(
      (m) => m.user && m.user.toString() === memberId && m.isActive
    );
    if (!isBoardMember) {
      console.log("Member not in board:", memberId);
      return res.status(400).json({ message: "Member không thuộc board này!" });
    }

    if (card.members.some((m) => m.toString() === memberId)) {
      console.log("Member already in card:", memberId);
      return res.status(400).json({ message: "Member đã có trong thẻ!" });
    }

    card.members.push(memberId);
    await card.save();

    const member = await User.findById(memberId);
    if (!member) {
      console.log("Member not found:", memberId);
      return res.status(404).json({ message: "Member không tồn tại!" });
    }

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const memberName = member.fullName || member.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: "member_added",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} added ${memberName} to card "${card.title}"`,
    });
    await activity.save();
    card.activities.push(activity._id);
    board.activities.push(activity._id);
    await Promise.all([card.save(), board.save()]);

    const notification = new Notification({
      user: memberId,
      message: `Bạn đã được thêm vào card "${card.title}" bởi ${userName}`,
      type: "activity",
      target: card._id,
      targetModel: "Card",
    });
    await notification.save();
    io.to(memberId.toString()).emit("new-notification", notification);

    const updatedCard = await Card.findById(cardId)
      .populate("members", "email fullName avatar")
      .populate("comments.user", "email fullName")
      .populate("notes.createdBy", "email fullName")
      .populate({ path: "activities", match: { isDeleted: false } });

    io.to(card.board.toString()).emit("member-added", {
      cardId,
      member: { _id: memberId, fullName: memberName, email: member.email },
      message: `${userName} đã thêm ${memberName} vào card "${card.title}"`,
    });

    console.log("Member added successfully:", { cardId, memberId });

    res.status(200).json(updatedCard);
  } catch (err) {
    console.error("Error in addMember:", err.message, err.stack);
    res.status(500).json({ message: "Lỗi khi thêm member", error: err.message });
  }
};

// Đánh dấu hoàn thành/không hoàn thành thẻ
const toggleCardCompletion = async (req, res, io) => {
  try {
    const { id: cardId } = req.params;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Không tìm thấy thông tin user!" });
    }

    if (!mongoose.Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ message: "Card ID không hợp lệ!" });
    }

    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      return res.status(404).json({ message: "Không tìm thấy thẻ!" });
    }

    const board = await Board.findOne({ _id: card.board, isDeleted: false });
    if (!board) {
      return res.status(404).json({ message: "Board không tồn tại!" });
    }

    const isMember = board.members.some(
      (m) => m.user && m.user.toString() === req.user._id.toString() && m.isActive
    );
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật thẻ!" });
    }

    card.completed = !card.completed;
    await card.save();

    const userName = req.user.fullName || req.user.email || "Unknown User";
    const activity = new Activity({
      user: req.user._id,
      action: card.completed ? "card_completed" : "card_uncompleted",
      target: card._id,
      targetModel: "Card",
      details: `User ${userName} ${card.completed ? "completed" : "uncompleted"} card "${card.title}"`,
    });
    await activity.save();
    card.activities = card.activities || [];
    card.activities.push(activity._id);
    await card.save();

    io.to(card.board.toString()).emit("card-completion-toggled", {
      cardId,
      completed: card.completed,
      message: `${userName} đã ${card.completed ? "hoàn thành" : "bỏ hoàn thành"} card "${card.title}"`,
    });

    return res.status(200).json({
      message: "Cập nhật trạng thái thành công",
      card: {
        _id: card._id,
        title: card.title,
        completed: card.completed,
      },
    });
  } catch (err) {
    console.error("Error in toggleCardCompletion:", err.message);
    return res.status(500).json({ message: "Lỗi khi cập nhật trạng thái", error: err.message });
  }
};

module.exports = {
  createCard,
  getCardsByList,
  updateCard,
  deleteCard,
  addComment,
  addNote,
  addChecklist,
  addChecklistItem,
  toggleChecklistItem,
  moveCard,
  addMember,
  toggleCardCompletion,
};