const Blog = require("../models/blogModel");
const Category = require("../models/categoryModel");
const cloudinary = require("../config/cloudinary");
const { validateObjectId } = require("../utils/validators");

const logger = {
    info: (message, meta = {}) => {
        console.log(
            `[INFO] ${new Date().toISOString()} - ${message}`,
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
        );
    },
    error: (message, error = {}, meta = {}) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
        if (error.stack) {
            console.error("Stack trace:", error.stack);
        }
        if (Object.keys(meta).length) {
            console.error("Additional context:", JSON.stringify(meta, null, 2));
        }
    },
    warn: (message, meta = {}) => {
        console.warn(
            `[WARN] ${new Date().toISOString()} - ${message}`,
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
        );
    },
    debug: (message, data = {}) => {
        if (
            process.env.NODE_ENV === "development" ||
            process.env.DEBUG === "true"
        ) {
            console.log(
                `[DEBUG] ${new Date().toISOString()} - ${message}`,
                Object.keys(data).length ? JSON.stringify(data, null, 2) : ""
            );
        }
    },
};

class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = "ValidationError";
        this.field = field;
        this.statusCode = 400;
    }
}

class NotFoundError extends Error {
    constructor(message, resource = null) {
        super(message);
        this.name = "NotFoundError";
        this.resource = resource;
        this.statusCode = 404;
    }
}

class AuthorizationError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthorizationError";
        this.statusCode = 403;
    }
}

class ExternalServiceError extends Error {
    constructor(message, service = null) {
        super(message);
        this.name = "ExternalServiceError";
        this.service = service;
        this.statusCode = 502;
    }
}

const handleErrorResponse = (res, error, context = {}) => {
    const errorId = `ERR_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

    logger.error(`Error in ${context.operation || "unknown operation"}`, error, {
        errorId,
        userId: context.userId,
        requestData: context.requestData,
        ...context.additionalInfo,
    });

    const isProduction = process.env.NODE_ENV === "production";

    let statusCode = 500;
    let message = "Internal server error";
    let details = null;

    if (error instanceof ValidationError) {
        statusCode = error.statusCode || 400;
        message = error.message;
        if (error.field) {
            details = { field: error.field, message: error.message };
        }
    } else if (error instanceof NotFoundError) {
        statusCode = error.statusCode || 404;
        message = error.message;
        if (error.resource) {
            details = { resource: error.resource, message: error.message };
        }
    } else if (error instanceof AuthorizationError) {
        statusCode = error.statusCode || 403;
        message = error.message;
    } else if (error instanceof ExternalServiceError) {
        statusCode = error.statusCode || 502;
        message = isProduction
            ? "External service temporarily unavailable"
            : error.message;
        if (error.service) {
            details = { service: error.service };
        }
    } else if (error.statusCode) {
        statusCode = error.statusCode;
        message = error.message;
    } else if (error.name === "ValidationError" && error.errors) {
        statusCode = 400;
        message = "Validation failed";
        details = Object.keys(error.errors).map((key) => ({
            field: key,
            message: error.errors[key].message,
        }));
    } else if (error.name === "CastError") {
        statusCode = 400;
        message = "Invalid ID format";
        details = { field: error.path, message: `Invalid ${error.path} format` };
    } else if (error.code === 11000) {
        statusCode = 409;
        message = "Resource already exists";
        const field = Object.keys(error.keyPattern || {})[0];
        if (field) {
            details = { field, message: `${field} already exists` };
        }
    } else if (error.name === "MongoError" || error.name === "MongoServerError") {
        statusCode = 500;
        message = isProduction ? "Database error occurred" : error.message;
    }

    const response = {
        success: false,
        message,
        errorId,
        ...(details && { details }),
        ...((!isProduction || process.env.DEBUG === "true") && {
            stack: error.stack,
            originalError: error.message,
        }),
    };

    res.status(statusCode).json(response);
};

const createBlog = async (req, res) => {
    const context = {
        operation: "createBlog",
        userId: req.user?._id,
        requestData: {
            ...req.body,
            content: req.body.content ? "[CONTENT_TRUNCATED]" : null,
        },
    };

    try {
        logger.info("Creating new blog", { userId: req.user._id });

        const {
            title,
            content,
            excerpt,
            tags,
            categories,
            status,
            meta,
            featuredImage,
        } = req.body;

        logger.debug("Blog creation data received", {
            title: title ? title.substring(0, 50) + "..." : null,
            contentLength: content ? content.length : 0,
            tagsCount: Array.isArray(tags) ? tags.length : 0,
            categoriesCount: Array.isArray(categories) ? categories.length : 0,
            status,
            hasFeaturedImage: !!featuredImage,
        });


        if (!title?.trim()) {
            throw new ValidationError(
                "Title is required and cannot be empty",
                "title"
            );
        }

        if (!content?.trim()) {
            throw new ValidationError(
                "Content is required and cannot be empty",
                "content"
            );
        }

        if (title.length > 200) {
            throw new ValidationError("Title cannot exceed 200 characters", "title");
        }

        if (excerpt && excerpt.length > 500) {
            throw new ValidationError(
                "Excerpt cannot exceed 500 characters",
                "excerpt"
            );
        }


        if (categories && Array.isArray(categories) && categories.length > 0) {
            const invalidCategories = categories.filter(
                (cat) => !validateObjectId(cat)
            );
            if (invalidCategories.length > 0) {
                throw new ValidationError(
                    `Invalid category IDs: ${invalidCategories.join(", ")}`,
                    "categories"
                );
            }

            const existingCategories = await Category.find({
                _id: { $in: categories },
            }).lean();
            if (existingCategories.length !== categories.length) {
                const existingIds = existingCategories.map((cat) => cat._id.toString());
                const nonExistentIds = categories.filter(
                    (id) => !existingIds.includes(id)
                );
                throw new NotFoundError(
                    `Categories not found: ${nonExistentIds.join(", ")}`,
                    "categories"
                );
            }
        }

        const blog = new Blog({
            title: title.trim(),
            content: content.trim(),
            excerpt: excerpt?.trim(),
            author: req.user._id,
            tags: Array.isArray(tags) ? tags.filter((tag) => tag?.trim()) : [],
            categories: Array.isArray(categories) ? categories : [],
            status: status || "draft",
            meta,
            featuredImage,
        });

        const createdBlog = await blog.save();

        const populatedBlog = await Blog.findById(createdBlog._id)
            .populate("author", "name email")
            .populate("categories", "name slug")
            .lean();

        logger.info("Blog created successfully", {
            blogId: populatedBlog._id,
            userId: req.user._id,
            title: populatedBlog.title.substring(0, 50) + "...",
        });

        res.status(201).json({
            success: true,
            data: populatedBlog,
            message: "Blog created successfully",
        });
    } catch (error) {
        handleErrorResponse(res, error, context);
    }
};

const getBlogs = async (req, res) => {
    const context = {
        operation: "getBlogs",
        userId: req.user?._id,
        requestData: req.query,
    };

    try {
        logger.debug("Fetching blogs with filters", req.query);

        const {
            page = 1,
            limit = 10,
            search,
            status,
            category,
            sortBy = "publishedAt",
            sortOrder = "desc",
        } = req.query;


        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            throw new ValidationError("Page must be a positive number", "page");
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            throw new ValidationError("Limit must be between 1 and 100", "limit");
        }

        const query = {};

        if (search?.trim()) {
            const searchRegex = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.$or = [
                { title: { $regex: searchRegex, $options: "i" } },
                { content: { $regex: searchRegex, $options: "i" } },
                { tags: { $regex: searchRegex, $options: "i" } },
                { excerpt: { $regex: searchRegex, $options: "i" } },
            ];
        }

        if (status) {
            const validStatuses = ["draft", "published", "archived"];
            if (!validStatuses.includes(status)) {
                throw new ValidationError(
                    `Status must be one of: ${validStatuses.join(", ")}`,
                    "status"
                );
            }
            query.status = status;
        }


        if (category?.trim()) {
            const categoryQuery = validateObjectId(category)
                ? { _id: category }
                : { slug: category.trim() };

            const categoryDoc = await Category.findOne(categoryQuery).lean();
            if (!categoryDoc) {
                throw new NotFoundError(`Category not found: ${category}`, "category");
            }
            query.categories = categoryDoc._id;
        }


        const validSortFields = ["title", "publishedAt", "createdAt", "updatedAt"];
        const validSortOrders = ["asc", "desc"];

        if (!validSortFields.includes(sortBy)) {
            throw new ValidationError(
                `sortBy must be one of: ${validSortFields.join(", ")}`,
                "sortBy"
            );
        }

        if (!validSortOrders.includes(sortOrder)) {
            throw new ValidationError(
                `sortOrder must be one of: ${validSortOrders.join(", ")}`,
                "sortOrder"
            );
        }

        const sortObject = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

        logger.debug("Executing blog query", {
            query: JSON.stringify(query),
            page: pageNum,
            limit: limitNum,
            sort: sortObject,
        });

        const [blogs, total] = await Promise.all([
            Blog.find(query)
                .populate("author", "name email")
                .populate({
                    path: "categories",
                    select: "name slug",
                    options: { strictPopulate: false },
                })
                .sort(sortObject)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            Blog.countDocuments(query),
        ]);

        const totalPages = Math.ceil(total / limitNum);

        logger.info("Blogs fetched successfully", {
            count: blogs.length,
            total,
            page: pageNum,
            totalPages,
            hasSearch: !!search,
            hasFilters: !!(status || category),
        });

        res.json({
            success: true,
            data: blogs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: totalPages,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1,
            },
            filters: {
                search: search || null,
                status: status || null,
                category: category || null,
            },
        });
    } catch (error) {
        handleErrorResponse(res, error, context);
    }
};

const getBlog = async (req, res) => {
    const context = {
        operation: "getBlog",
        userId: req.user?._id,
        requestData: { id: req.params.id },
    };

    try {
        const { id } = req.params;

        if (!id?.trim()) {
            throw new ValidationError("Blog ID is required", "id");
        }

        logger.debug("Fetching single blog", { identifier: id });

        const query = validateObjectId(id) ? { _id: id } : { slug: id.trim() };

        const blog = await Blog.findOne(query)
            .populate("author", "name email")
            .populate({
                path: "categories",
                select: "name slug",
                options: { strictPopulate: false },
            })
            .lean();

        if (!blog) {
            throw new NotFoundError(`Blog not found with identifier: ${id}`, "blog");
        }

        logger.info("Blog fetched successfully", {
            blogId: blog._id,
            title: blog.title.substring(0, 50) + "...",
            status: blog.status,
        });

        res.json({
            success: true,
            data: blog,
        });
    } catch (error) {
        handleErrorResponse(res, error, context);
    }
};

const updateBlog = async (req, res) => {
    const context = {
        operation: "updateBlog",
        userId: req.user?._id,
        requestData: { id: req.params.id, updates: Object.keys(req.body) },
    };

    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            throw new ValidationError("Invalid blog ID format", "id");
        }

        logger.debug("Updating blog", {
            blogId: id,
            updateFields: Object.keys(req.body),
        });

        const existingBlog = await Blog.findById(id).lean();
        if (!existingBlog) {
            throw new NotFoundError(`Blog not found with ID: ${id}`, "blog");
        }

        // Enhanced authorization check
        if (
            req.user.role !== "admin" &&
            existingBlog.author.toString() !== req.user._id.toString()
        ) {
            throw new AuthorizationError("Not authorized to update this blog");
        }

        // Validate update data
        const updateData = { ...req.body };

        if (updateData.title !== undefined) {
            if (!updateData.title?.trim()) {
                throw new ValidationError("Title cannot be empty", "title");
            }
            if (updateData.title.length > 200) {
                throw new ValidationError(
                    "Title cannot exceed 200 characters",
                    "title"
                );
            }
            updateData.title = updateData.title.trim();
        }

        if (updateData.content !== undefined) {
            if (!updateData.content?.trim()) {
                throw new ValidationError("Content cannot be empty", "content");
            }
            updateData.content = updateData.content.trim();
        }

        if (
            updateData.excerpt !== undefined &&
            updateData.excerpt &&
            updateData.excerpt.length > 500
        ) {
            throw new ValidationError(
                "Excerpt cannot exceed 500 characters",
                "excerpt"
            );
        }

        if (
            updateData.status &&
            !["draft", "published", "archived"].includes(updateData.status)
        ) {
            throw new ValidationError("Invalid status value", "status");
        }

        if (
            updateData.categories &&
            Array.isArray(updateData.categories) &&
            updateData.categories.length > 0
        ) {
            const invalidCategories = updateData.categories.filter(
                (cat) => !validateObjectId(cat)
            );
            if (invalidCategories.length > 0) {
                throw new ValidationError(
                    `Invalid category IDs: ${invalidCategories.join(", ")}`,
                    "categories"
                );
            }

            const existingCategories = await Category.find({
                _id: { $in: updateData.categories },
            }).lean();
            if (existingCategories.length !== updateData.categories.length) {
                throw new NotFoundError(
                    "One or more categories not found",
                    "categories"
                );
            }
        }

        updateData.updatedAt = new Date();

        const updatedBlog = await Blog.findByIdAndUpdate(id, updateData, {
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

        logger.info("Blog updated successfully", {
            blogId: id,
            userId: req.user._id,
            updatedFields: Object.keys(updateData),
        });

        res.json({
            success: true,
            data: updatedBlog,
            message: "Blog updated successfully",
        });
    } catch (error) {
        handleErrorResponse(res, error, context);
    }
};

const deleteBlog = async (req, res) => {
    const context = {
        operation: "deleteBlog",
        userId: req.user?._id,
        requestData: { id: req.params.id },
    };

    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            throw new ValidationError("Invalid blog ID format", "id");
        }

        logger.debug("Deleting blog", { blogId: id });

        const blog = await Blog.findById(id).lean();
        if (!blog) {
            throw new NotFoundError(`Blog not found with ID: ${id}`, "blog");
        }

        if (
            req.user.role !== "admin" &&
            blog.author.toString() !== req.user._id.toString()
        ) {
            throw new AuthorizationError("Not authorized to delete this blog");
        }


        if (blog.featuredImage?.publicId) {
            try {
                logger.debug("Deleting featured image from Cloudinary", {
                    publicId: blog.featuredImage.publicId,
                });

                await cloudinary.uploader.destroy(blog.featuredImage.publicId);

                logger.info("Featured image deleted from Cloudinary", {
                    publicId: blog.featuredImage.publicId,
                });
            } catch (cloudinaryError) {
                logger.warn("Failed to delete image from Cloudinary", {
                    publicId: blog.featuredImage.publicId,
                    error: cloudinaryError.message,
                });

            }
        }

        await Blog.findByIdAndDelete(id);

        logger.info("Blog deleted successfully", {
            blogId: id,
            userId: req.user._id,
            title: blog.title.substring(0, 50) + "...",
        });

        res.json({
            success: true,
            message: "Blog deleted successfully",
        });
    } catch (error) {
        handleErrorResponse(res, error, context);
    }
};

const uploadFeaturedImageStream = async (req, res) => {
    const context = {
        operation: "uploadFeaturedImageStream",
        userId: req.user?._id,
        requestData: {
            fileSize: req.file?.size,
            mimetype: req.file?.mimetype,
        },
    };

    try {
        logger.debug("Starting image upload", {
            userId: req.user?._id,
            fileSize: req.file?.size,
            mimetype: req.file?.mimetype,
        });

        if (!req.file) {
            throw new ValidationError(
                "No file provided. Expected field name 'file'",
                "file"
            );
        }


        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!allowedTypes.includes(req.file.mimetype)) {
            throw new ValidationError(
                `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
                "file"
            );
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
            throw new ValidationError(
                "File size too large. Maximum size is 5MB",
                "file"
            );
        }

        const uploadPromise = new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: "blog-featured-images",
                    transformation: [
                        { width: 1200, height: 630, crop: "fill", quality: "auto" },
                        { fetch_format: "auto" },
                    ],
                    allowed_formats: ["jpg", "png", "webp"],
                },
                (error, result) => {
                    if (error) {
                        logger.error("Cloudinary upload failed", error, {
                            userId: req.user?._id,
                            fileSize: req.file?.size,
                        });
                        reject(
                            new ExternalServiceError(
                                `Image upload failed: ${error.message}`,
                                "cloudinary"
                            )
                        );
                    } else {
                        logger.debug("Cloudinary upload successful", {
                            publicId: result.public_id,
                            url: result.secure_url,
                        });
                        resolve(result);
                    }
                }
            );

            uploadStream.end(req.file.buffer);
        });

        const result = await uploadPromise;

        logger.info("Image uploaded successfully", {
            userId: req.user?._id,
            publicId: result.public_id,
            originalSize: req.file.size,
            finalSize: result.bytes,
        });

        res.json({
            success: true,
            data: {
                url: result.secure_url,
                publicId: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                size: result.bytes,
            },
            message: "Image uploaded successfully",
        });
    } catch (error) {
        handleErrorResponse(res, error, context);
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
