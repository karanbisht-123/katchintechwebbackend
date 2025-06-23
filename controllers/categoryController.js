const asyncHandler = require("express-async-handler");
const Category = require("../models/categoryModel");
const { validateObjectId } = require("../utils/validators");
const logger = require("../utils/logger");


const createCategory = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        res.status(400);
        throw new Error("Category name is required");
    }

    const category = new Category({
        name,
        description,
    });

    const createdCategory = await category.save();

    logger.info(`Category created: ${createdCategory._id} by user: ${req.user?._id || 'unknown'}`);

    res.status(201).json({
        success: true,
        data: createdCategory,
    });
});


const getCategories = asyncHandler(async (req, res) => {
    const { search } = req.query;

    const query = {};
    if (search) {
        query.name = { $regex: search, $options: "i" };
    }

    const categories = await Category.find(query)
        .sort({ createdAt: -1 })
        .lean();

    res.json({
        success: true,
        data: categories,
    });
});


const getCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
        res.status(400);
        throw new Error("Invalid category ID");
    }

    const category = await Category.findById(id).lean();

    if (!category) {
        res.status(404);
        throw new Error("Category not found");
    }

    res.json({
        success: true,
        data: category,
    });
});


const updateCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
        res.status(400);
        throw new Error("Invalid category ID");
    }

    const category = await Category.findById(id);

    if (!category) {
        res.status(404);
        throw new Error("Category not found");
    }

    if (req.user.role !== "admin") {
        res.status(403);
        throw new Error("Not authorized to update this category");
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
    }).lean();

    logger.info(`Category updated: ${id} by admin: ${req.user._id}`);

    res.json({
        success: true,
        data: updatedCategory,
    });
});


const deleteCategory = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!validateObjectId(id)) {
        res.status(400);
        throw new Error("Invalid category ID");
    }

    const category = await Category.findById(id);

    if (!category) {
        res.status(404);
        throw new Error("Category not found");
    }

    if (req.user.role !== "admin") {
        res.status(403);
        throw new Error("Not authorized to delete this category");
    }

    await category.deleteOne();

    logger.info(`Category deleted: ${id} by admin: ${req.user._id}`);

    res.json({
        success: true,
        message: "Category deleted successfully",
    });
});

module.exports = {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory,
};