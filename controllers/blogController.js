const Blog = require("../models/blogModel");
const asyncHandler = require("express-async-handler");
const cloudinary = require("../config/cloudinary");
const { validateObjectId } = require("../utils/validators");
const logger = require("../utils/logger");

const createBlog = asyncHandler(async (req, res) => {
    const { title, content, excerpt, tags, categories, status, meta } = req.body;

    const blog = new Blog({
        title,
        content,
        excerpt,
        author: req.user._id,
        tags,
        categories,
        status,
        meta,
    });

    const createdBlog = await blog.save();

    logger.info(`Blog created: ${createdBlog._id} by user: ${req.user._id}`);

    res.status(201).json({
        success: true,
        data: createdBlog,
    });
});

const getBlogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;

    const query = {};
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: "i" } },
            { content: { $regex: search, $options: "i" } },
            { tags: { $regex: search, $options: "i" } },
        ];
    }
    if (status && ["draft", "published", "archived"].includes(status)) {
        query.status = status;
    }

    const [blogs, total] = await Promise.all([
        Blog.find(query)
            .populate("author", "name email")
            .populate({
                path: "categories",
                select: "name slug",
                options: { strictPopulate: false },
            })
            .sort({ publishedAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .lean(),
        Blog.countDocuments(query),
    ]);

    res.json({
        success: true,
        data: blogs,
        pagination: {
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
        },
    });
});

const getBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const query = validateObjectId(id) ? { _id: id } : { slug: id };

    const blog = await Blog.findOne(query)
        .populate("author", "name email")
        .populate({
            path: "categories",
            select: "name slug",
            options: { strictPopulate: false },
        })
        .lean();

    if (!blog) {
        res.status(404);
        throw new Error("Blog not found");
    }

    res.json({
        success: true,
        data: blog,
    });
});

const updateBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
        res.status(400);
        throw new Error("Invalid blog ID");
    }

    const blog = await Blog.findById(id);

    if (!blog) {
        res.status(404);
        throw new Error("Blog not found");
    }

    if (req.user.role !== "admin") {
        res.status(403);
        throw new Error("Not authorized to update this blog");
    }

    const updatedBlog = await Blog.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
    })
        .populate("author", "name email")
        .populate({
            path: "categories",
            select: "name slug",
            options: { strictPopulate: false },
        })
        .lean();

    logger.info(`Blog updated: ${id} by admin: ${req.user._id}`);

    res.json({
        success: true,
        data: updatedBlog,
    });
});

const deleteBlog = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
        res.status(400);
        throw new Error("Invalid blog ID");
    }

    const blog = await Blog.findById(id);

    if (!blog) {
        res.status(404);
        throw new Error("Blog not found");
    }

    if (req.user.role !== "admin") {
        res.status(403);
        throw new Error("Not authorized to delete this blog");
    }

    if (blog.featuredImage?.publicId) {
        await cloudinary.uploader.destroy(blog.featuredImage.publicId);
    }

    await blog.deleteOne();

    logger.info(`Blog deleted: ${id} by admin: ${req.user._id}`);

    res.json({
        success: true,
        message: "Blog deleted successfully",
    });
});

const uploadFeaturedImage = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        res.status(403);
        throw new Error("Not authorized to upload images");
    }

    if (!req.file) {
        res.status(400);
        throw new Error("No image file provided");
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "blog-featured-images",
        transformation: [
            { width: 1200, height: 630, crop: "fill", quality: "auto" },
            { fetch_format: "auto" },
        ],
    });

    logger.info(`Image uploaded for blog by admin: ${req.user._id}`);

    res.json({
        success: true,
        data: {
            url: result.secure_url,
            publicId: result.public_id,
        },
    });
});

module.exports = {
    createBlog,
    getBlogs,
    getBlog,
    updateBlog,
    deleteBlog,
    uploadFeaturedImage,
};
