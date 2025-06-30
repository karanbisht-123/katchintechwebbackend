const Blog = require("../models/blogModel");
const Category = require("../models/categoryModel");
const cloudinary = require("../config/cloudinary");
const { validateObjectId } = require("../utils/validators");

const createBlog = async (req, res) => {
    try {
        const { title, content, excerpt, tags, categories, status, meta, featuredImage } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: "Title and content are required" });
        }

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
        const populatedBlog = await Blog.findById(createdBlog._id)
            .populate('author', 'name email')
            .lean();

        console.log(`Blog created: ${populatedBlog._id} by user: ${req.user._id}`);

        res.status(201).json({
            success: true,
            data: populatedBlog,
        });
    } catch (error) {
        console.error(`Error creating blog: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to create blog: ${error.message}`,
        });
    }
};

const getBlogs = async (req, res) => {
    try {
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
            if (!categoryDoc) {
                return res.status(404).json({ success: false, message: "Category not found" });
            }
            query.categories = categoryDoc._id;
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
    } catch (error) {
        console.error(`Error fetching blogs: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to fetch blogs: ${error.message}`,
        });
    }
};

const getBlog = async (req, res) => {
    try {
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
            return res.status(404).json({ success: false, message: "Blog not found" });
        }

        res.json({
            success: true,
            data: blog,
        });
    } catch (error) {
        console.error(`Error fetching blog: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to fetch blog: ${error.message}`,
        });
    }
};

const updateBlog = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid blog ID" });
        }

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: "Blog not found" });
        }

        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Not authorized to update this blog" });
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

        console.log(`Blog updated: ${id} by admin: ${req.user._id}`);

        res.json({
            success: true,
            data: updatedBlog,
        });
    } catch (error) {
        console.error(`Error updating blog: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to update blog: ${error.message}`,
        });
    }
};

const deleteBlog = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid blog ID" });
        }

        const blog = await Blog.findById(id);
        if (!blog) {
            return res.status(404).json({ success: false, message: "Blog not found" });
        }

        if (req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Not authorized to delete this blog" });
        }

        if (blog.featuredImage?.publicId) {
            await cloudinary.uploader.destroy(blog.featuredImage.publicId);
        }

        await blog.deleteOne();

        console.log(`Blog deleted: ${id} by admin: ${req.user._id}`);

        res.json({
            success: true,
            message: "Blog deleted successfully",
        });
    } catch (error) {
        console.error(`Error deleting blog: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to delete blog: ${error.message}`,
        });
    }
};

const uploadFeaturedImageStream = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file provided or incorrect field name. Expected 'file'.18",
            });
        }

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

        console.log(`Image uploaded for blog by admin: ${req.user?._id || 'unknown'}`);

        res.json({
            success: true,
            data: {
                url: result.secure_url,
                publicId: result.public_id,
            },
        });
    } catch (error) {
        console.error(`Image upload failed: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to upload image to Cloudinary: ${error.message}`,
        });
    }
};

module.exports = {
    createBlog,
    getBlogs,
    getBlog,
    updateBlog,
    deleteBlog,
    uploadFeaturedImageStream,
};