const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/", authMiddleware, activityController.getActivities);
router.put("/:activityId/hide", authMiddleware, activityController.hideActivity);
router.put("/hide-all", authMiddleware, activityController.hideAllActivities);

module.exports = router;