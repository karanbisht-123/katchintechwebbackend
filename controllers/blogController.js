const Blog = require("../models/blogModel");
const asyncHandler = require("express-async-handler");
const cloudinary = require("../config/cloudinary");
const { validateObjectId } = require("../utils/validators");
const logger = require("../utils/logger");

const createBlog = asyncHandler(async (req, res) => {
    const { title, content, excerpt, tags, categories, status, meta, featuredImage } = req.body;

    const blog = new Blog({
        title,
        content,
        excerpt,
        author: req.user._id,
        tags,
        categories,
        status,
        meta,
        featuredImage,
    });

    const createdBlog = await blog.save();

    const populatedBlog = await Blog.findById(createdBlog._id).populate('author', 'name email');

    logger.info(`Blog created: ${populatedBlog._id} by user: ${req.user._id}`);

    res.status(201).json({
        success: true,
        data: populatedBlog,
    });
});

const getBlogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, search, status, category } = req.query;

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
    if (category) {
        const categoryQuery = validateObjectId(category)
            ? { _id: category }
            : { slug: category };
        const categoryDoc = await Category.findOne(categoryQuery).lean();
        if (categoryDoc) {
            query.categories = categoryDoc._id;
        } else {
            res.status(404);
            throw new Error("Category not found");
        }
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
});;

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

const uploadFeaturedImageStream = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error("No file provided or incorrect field name. Expected 'file'.");
    }

    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    folder: "blog-featured-images",
                    transformation: [
                        { width: 1200, height: 630, crop: "fill", quality: "auto" },
                        { fetch_format: "auto" },
                    ],
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            ).end(req.file.buffer);
        });

        logger.info(`Image uploaded for blog by admin: ${req.user?._id || 'unknown'}`);

        res.json({
            success: true,
            data: {
                url: result.secure_url,
                publicId: result.public_id,
            },
        });
    } catch (error) {
        logger.error(`Image upload failed: ${error.message}`);
        res.status(500);
        throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
    }
});

module.exports = {
    createBlog,
    getBlogs,
    getBlog,
    updateBlog,
    deleteBlog,
    uploadFeaturedImageStream,
};





