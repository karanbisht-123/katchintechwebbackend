const Category = require("../models/categoryModel");
const { validateObjectId } = require("../utils/validators");

const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res
                .status(400)
                .json({ success: false, message: "Category name is required" });
        }

        const category = new Category({
            name,
            description,
        });

        const createdCategory = await category.save();

        console.log(
            `Category created: ${createdCategory._id} by user: ${req.user?._id || "unknown"
            }`
        );

        res.status(201).json({
            success: true,
            data: createdCategory,
        });
    } catch (error) {
        console.error(`Error creating category: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to create category: ${error.message}`,
        });
    }
};

const getCategories = async (req, res) => {
    try {
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
    } catch (error) {
        console.error(`Error fetching categories: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to fetch categories: ${error.message}`,
        });
    }
};

const getCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid category ID" });
        }

        const category = await Category.findById(id).lean();

        if (!category) {
            return res
                .status(404)
                .json({ success: false, message: "Category not found" });
        }

        res.json({
            success: true,
            data: category,
        });
    } catch (error) {
        console.error(`Error fetching category: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to fetch category: ${error.message}`,
        });
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid category ID" });
        }

        const category = await Category.findById(id);

        if (!category) {
            return res
                .status(404)
                .json({ success: false, message: "Category not found" });
        }

        if (req.user.role !== "admin") {
            return res
                .status(403)
                .json({
                    success: false,
                    message: "Not authorized to update this category",
                });
        }

        const updatedCategory = await Category.findByIdAndUpdate(id, req.body, {
            new: true,
            runValidators: true,
        }).lean();

        console.log(`Category updated: ${id} by admin: ${req.user._id}`);

        res.json({
            success: true,
            data: updatedCategory,
        });
    } catch (error) {
        console.error(`Error updating category: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to update category: ${error.message}`,
        });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid category ID" });
        }

        const category = await Category.findById(id);

        if (!category) {
            return res
                .status(404)
                .json({ success: false, message: "Category not found" });
        }

        if (req.user.role !== "admin") {
            return res
                .status(403)
                .json({
                    success: false,
                    message: "Not authorized to delete this category",
                });
        }

        await category.deleteOne();

        console.log(`Category deleted: ${id} by admin: ${req.user._id}`);

        res.json({
            success: true,
            message: "Category deleted successfully",
        });
    } catch (error) {
        console.error(`Error deleting category: ${error.message}`);
        res.status(500).json({
            success: false,
            message: `Failed to delete category: ${error.message}`,
        });
    }
};

module.exports = {
    createCategory,
    getCategories,
    getCategory,
    updateCategory,
    deleteCategory,
};
