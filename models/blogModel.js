const mongoose = require("mongoose");
const slugify = require("slugify");
const sanitizeHtml = require("sanitize-html");

const BlogSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            minlength: [3, "Title must be at least 3 characters"],
            maxlength: [200, "Title cannot exceed 200 characters"],
        },
        slug: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        content: {
            type: String,
            required: [true, "Content is required"],
            minlength: [50, "Content must be at least 50 characters"],
            set: (value) =>
                sanitizeHtml(value, {
                    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["iframe"]),
                    allowedAttributes: {
                        ...sanitizeHtml.defaults.allowedAttributes,
                        iframe: [
                            "src",
                            "width",
                            "height",
                            "frameborder",
                            "allowfullscreen",
                        ],
                    },
                }),
        },
        excerpt: {
            type: String,
            maxlength: [1000, "Excerpt cannot exceed 1000 characters"],
            set: (value) => (value ? sanitizeHtml(value) : null),
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Author is required"],
            index: true,
        },
        tags: [
            {
                type: String,
                trim: true,
                lowercase: true,
                set: (value) => (value ? sanitizeHtml(value) : null),
            },
        ],
        categories: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Category",
                index: true,
            },
        ],
        status: {
            type: String,
            enum: {
                values: ["draft", "published", "archived"],
                message: "Status must be draft, published, or archived",
            },
            default: "draft",
            index: true,
        },
        publishedAt: {
            type: Date,
            index: true,
        },
        featuredImage: {
            url: {
                type: String,
                default: null,
            },
            publicId: {
                type: String,
                default: null,
            },
        },
        readTime: {
            type: Number,
            min: [1, "Read time cannot be less than 1 minute"],
            default: 1,
        },
        isFeatured: {
            type: Boolean,
            default: false,
            index: true,
        },
        meta: {
            title: {
                type: String,
                maxlength: [70, "Meta title cannot exceed 70 characters"],
                set: (value) => (value ? sanitizeHtml(value) : null),
            },
            description: {
                type: String,
                maxlength: [160, "Meta description cannot exceed 160 characters"],
                set: (value) => (value ? sanitizeHtml(value) : null),
            },
            keywords: [
                {
                    type: String,
                    set: (value) => (value ? sanitizeHtml(value) : null),
                },
            ],
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

BlogSchema.index({ status: 1, publishedAt: -1 });
BlogSchema.index({ slug: 1, status: 1 });

BlogSchema.pre("save", async function (next) {
    try {
        if (this.isModified("title")) {
            this.slug = slugify(this.title, { lower: true, strict: true });
        }

        if (
            this.isModified("status") &&
            this.status === "published" &&
            !this.publishedAt
        ) {
            this.publishedAt = new Date();
        }

        if (this.isModified("content")) {
            const words = this.content.split(/\s+/).length;
            this.readTime = Math.max(1, Math.round(words / 200));
        }

        next();
    } catch (error) {
        next(error);
    }
});

BlogSchema.pre("validate", async function (next) {
    try {
        if (this.isModified("slug")) {
            let slug = this.slug;
            let counter = 1;
            while (await this.constructor.exists({ slug, _id: { $ne: this._id } })) {
                slug = `${this.slug}-${counter++}`;
            }
            this.slug = slug;
        }
        next();
    } catch (error) {
        next(error);
    }
});

BlogSchema.statics.search = async function (query, options = {}) {
    const searchQuery = {
        $or: [
            { title: { $regex: query, $options: "i" } },
            { content: { $regex: query, $options: "i" } },
            { tags: { $regex: query, $options: "i" } },
        ],
        status: "published",
    };

    return this.find(searchQuery)
        .select(
            options.select || "title slug excerpt featuredImage publishedAt readTime"
        )
        .sort({ publishedAt: -1 })
        .limit(options.limit || 10)
        .skip(options.skip || 0);
};

module.exports = mongoose.model("Blog", BlogSchema);
