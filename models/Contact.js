const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
            maxlength: [100, "Full name cannot exceed 100 characters"],
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            trim: true,
            lowercase: true,
            match: [
                /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
                "Please enter a valid email address",
            ],
        },
        phoneNo: {
            type: String,
            required: [true, "Phone number is required"],
            trim: true,
            match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"],
        },
        country: {
            type: String,
            required: [true, "Country is required"],
            trim: true,
            maxlength: [50, "Country name cannot exceed 50 characters"],
        },
        requirements: {
            type: String,
            required: [true, "Requirements are required"],
            trim: true,
            maxlength: [1000, "Requirements cannot exceed 1000 characters"],
        },
        ipAddress: {
            type: String,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ["new", "contacted", "in-progress", "completed", "cancelled"],
            default: "new",
        },
        emailSent: {
            type: Boolean,
            default: false,
        },
        emailSentAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

contactSchema.index({ email: 1 });
contactSchema.index({ createdAt: -1 });
contactSchema.index({ status: 1 });

contactSchema.pre("save", function (next) {
    next();
});

contactSchema.methods.getFormattedPhone = function () {
    return this.phoneNo.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
};

contactSchema.statics.getRecentContacts = function (days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.find({
        createdAt: { $gte: startDate },
    }).sort({ createdAt: -1 });
};

module.exports = mongoose.model("Contact", contactSchema);
