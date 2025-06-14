const { body, validationResult } = require("express-validator");
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");

const validateBlog = [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Title is required")
        .isLength({ min: 3, max: 200 })
        .withMessage("Title must be between 3 and 200 characters"),

    body("content")
        .trim()
        .notEmpty()
        .withMessage("Content is required")
        .isLength({ min: 50 })
        .withMessage("Content must be at least 50 characters"),

    body("excerpt")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Excerpt cannot exceed 1000 characters"),

    body("tags")
        .optional()
        .isArray()
        .withMessage("Tags must be an array")
        .custom((tags) => {
            if (!tags.every((tag) => typeof tag === "string")) {
                throw new Error("All tags must be strings");
            }
            return true;
        }),

    body("categories")
        .optional()
        .isArray()
        .withMessage("Categories must be an array")
        .custom((categories) => {
            if (!categories.every((cat) => mongoose.isValidObjectId(cat))) {
                throw new Error("Invalid category ID");
            }
            return true;
        }),

    body("status")
        .optional()
        .isIn(["draft", "published", "archived"])
        .withMessage("Invalid status"),

    body("meta.title")
        .optional()
        .trim()
        .isLength({ max: 70 })
        .withMessage("Meta title cannot exceed 70 characters"),

    body("meta.description")
        .optional()
        .trim()
        .isLength({ max: 160 })
        .withMessage("Meta description cannot exceed 160 characters"),

    asyncHandler(async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400);
            throw new Error(
                errors
                    .array()
                    .map((err) => err.msg)
                    .join(", ")
            );
        }
        next();
    }),
];

module.exports = { validateBlog };
