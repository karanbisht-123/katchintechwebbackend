const express = require("express");
const {
    createBlog,
    getBlogs,
    getBlog,
    updateBlog,
    deleteBlog,
    getBlogStats,
    getDetailedBlogStats,
    uploadFeaturedImageStream,
} = require("../controllers/blogController");
const { protect, admin } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");
const { validateBlog } = require("../middleware/validationMiddleware");

const router = express.Router();
router.get("/", getBlogs);
router.post("/", protect, validateBlog, createBlog);
router.get("/:id", getBlog);
router.put("/:id", protect, validateBlog, updateBlog);
router.get('/stats', getBlogStats);
router.get('/stats/detailed', getDetailedBlogStats);
router.delete("/:id", protect, deleteBlog);
router.post(
    "/upload-image",
    protect,
    upload.single("file"),
    uploadFeaturedImageStream
);

module.exports = router;


