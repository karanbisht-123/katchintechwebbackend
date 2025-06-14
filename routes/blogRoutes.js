const express = require("express");
const {
    createBlog,
    getBlogs,
    getBlog,
    updateBlog,
    deleteBlog,
    uploadFeaturedImage,
} = require("../controllers/blogController");
const { protect, admin } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");
const { validateBlog } = require("../middleware/validationMiddleware");

const router = express.Router();
router.get("/", getBlogs);
router.post("/", protect, validateBlog, createBlog);
router.get("/:id", getBlog);
router.put("/:id", protect, validateBlog, updateBlog);
router.delete("/:id", protect, deleteBlog);
router.post(
    "/upload-image",
    protect,
    upload.single("image"),
    uploadFeaturedImage
);

module.exports = router;
