const Contact = require("../models/Contact");
const EmailService = require("../utils/emailService");

const emailService = new EmailService();

const submitContact = async (req, res) => {
    try {
        const { fullName, email, phoneNo, country, requirements } = req.body;

        const ipAddress =
            req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const userAgent = req.get("User-Agent");

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const existingSubmission = await Contact.findOne({
            email: email,
            createdAt: { $gte: fiveMinutesAgo },
        });

        if (existingSubmission) {
            return res.status(429).json({
                success: false,
                message:
                    "You have already submitted a form recently. Please wait before submitting again.",
            });
        }

        const newContact = new Contact({
            fullName,
            email,
            phoneNo,
            country,
            requirements,
            ipAddress,
            userAgent,
        });

        const savedContact = await newContact.save();

        emailService
            .sendNotificationEmail(savedContact.toObject())
            .then((result) => {
                if (result.success) {
                    Contact.findByIdAndUpdate(savedContact._id, {
                        emailSent: true,
                        emailSentAt: new Date(),
                    }).exec();
                }
            })
            .catch((error) => {
                console.error("Email notification failed:", error);
            });

        if (email) {
            emailService
                .sendConfirmationEmail(savedContact.toObject())
                .catch((error) => {
                    console.error("Confirmation email failed:", error);
                });
        }

        res.status(201).json({
            success: true,
            message: "Thank you for your inquiry! We will get back to you soon.",
            data: {
                id: savedContact._id,
                submittedAt: savedContact.createdAt,
            },
        });
    } catch (error) {
        console.error("Contact submission error:", error);

        if (error.name === "ValidationError") {
            const validationErrors = Object.values(error.errors).map((err) => ({
                field: err.path,
                message: err.message,
            }));

            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: validationErrors,
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "This email has already been submitted recently",
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to submit your inquiry. Please try again later.",
        });
    }
};

const getContacts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const contacts = await Contact.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("-__v");

        const total = await Contact.countDocuments();

        res.json({
            success: true,
            data: contacts,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        });
    } catch (error) {
        console.error("Get contacts error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve contacts",
        });
    }
};

const getContactById = async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id).select("-__v");

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found",
            });
        }

        res.json({
            success: true,
            data: contact,
        });
    } catch (error) {
        console.error("Get contact by ID error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve contact",
        });
    }
};

const updateContactStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = [
            "new",
            "contacted",
            "in-progress",
            "completed",
            "cancelled",
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status",
            });
        }

        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact not found",
            });
        }

        res.json({
            success: true,
            data: contact,
        });
    } catch (error) {
        console.error("Update contact status error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update contact status",
        });
    }
};

module.exports = {
    submitContact,
    getContacts,
    getContactById,
    updateContactStatus,
};