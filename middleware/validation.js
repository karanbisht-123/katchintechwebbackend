const { body, validationResult } = require("express-validator");

const contactValidationRules = () => {
    return [
        body("fullName")
            .trim()
            .notEmpty()
            .withMessage("Full name is required")
            .isLength({ min: 2, max: 100 })
            .withMessage("Full name must be between 2 and 100 characters")
            .matches(/^[a-zA-Z\s]+$/)
            .withMessage("Full name can only contain letters and spaces"),

        body("email")
            .trim()
            .normalizeEmail()
            .isEmail()
            .withMessage("Please provide a valid email address")
            .isLength({ max: 255 })
            .withMessage("Email cannot exceed 255 characters"),

        body("phoneNo")
            .trim()
            .notEmpty()
            .withMessage("Phone number is required")
            .matches(/^[\+]?[1-9][\d]{0,15}$/)
            .withMessage("Please provide a valid phone number"),

        body("country")
            .trim()
            .notEmpty()
            .withMessage("Country is required")
            .isLength({ min: 2, max: 50 })
            .withMessage("Country must be between 2 and 50 characters"),

        body("requirements")
            .trim()
            .notEmpty()
            .withMessage("Requirements are required")
            .isLength({ min: 10, max: 1000 })
            .withMessage("Requirements must be between 10 and 1000 characters"),
    ];
};

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array().map((error) => ({
                field: error.path,
                message: error.msg,
                value: error.value,
            })),
        });
    }
    next();
};

module.exports = {
    contactValidationRules,
    validate,
};
