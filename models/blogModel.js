const mongoose = require("mongoose");
const slugify = require("slugify");
const sanitizeHtml = require("sanitize-html");

const contentSanitizeOptions = {
    allowedTags: [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "ul",
        "ol",
        "li",
        "a",
        "img",
        "iframe",
        "blockquote",
        "pre",
        "code",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "div",
        "span",
    ],
    allowedAttributes: {
        a: ["href", "title", "target", "rel"],
        img: ["src", "alt", "class", "width", "height", "title", "style"],
        iframe: [
            "src",
            "width",
            "height",
            "frameborder",
            "allowfullscreen",
            "title",
        ],
        h1: ["class", "id"],
        h2: ["class", "id"],
        h3: ["class", "id"],
        h4: ["class", "id"],
        h5: ["class", "id"],
        h6: ["class", "id"],
        p: ["class", "style"],
        div: ["class", "style"],
        span: ["class", "style"],
        strong: ["class"],
        b: ["class"],
        em: ["class"],
        i: ["class"],
        blockquote: ["class"],
        pre: ["class"],
        code: ["class"],
        table: ["class", "style"],
        thead: ["class"],
        tbody: ["class"],
        tr: ["class"],
        th: ["class", "style"],
        td: ["class", "style"],
    },
    allowedStyles: {
        "*": {
            color: [
                /^#(0x)?[0-9a-f]+$/i,
                /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/,
            ],
            "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
            "font-size": [/^\d+px$/, /^\d+em$/, /^\d+%$/],
            "font-weight": [/^bold$/, /^normal$/, /^\d+$/],
            margin: [/^\d+px(\s+\d+px){0,3}$/, /^\d+em(\s+\d+em){0,3}$/],
            padding: [/^\d+px(\s+\d+px){0,3}$/, /^\d+em(\s+\d+em){0,3}$/],
            display: [/^block$/, /^inline$/, /^inline-block$/],
            width: [/^\d+px$/, /^\d+%$/],
            height: [/^\d+px$/, /^\d+%$/],
            "max-width": [/^\d+px$/, /^\d+%$/],
            "max-height": [/^\d+px$/, /^\d+%$/],
        },
    },
    allowedClasses: {
        img: ["editor-image"],
        h1: ["editor-heading"],
        h2: ["editor-heading"],
        h3: ["editor-heading"],
        h4: ["editor-heading"],
        h5: ["editor-heading"],
        h6: ["editor-heading"],
        p: ["editor-paragraph"],
        div: ["editor-content"],
        span: ["editor-text"],
    },
};

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
            set: function (value) {
                if (!value) return value;
                return sanitizeHtml(value, contentSanitizeOptions);
            },
        },
        excerpt: {
            type: String,
            maxlength: [1000, "Excerpt cannot exceed 1000 characters"],
            set: function (value) {
                if (!value) return null;
                return sanitizeHtml(value, {
                    allowedTags: ["p", "br", "strong", "em"],
                    allowedAttributes: {},
                });
            },
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
                set: function (value) {
                    if (!value) return null;
                    return sanitizeHtml(value, {
                        allowedTags: [],
                        allowedAttributes: {},
                    });
                },
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
            type: String,
            default: null,
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
                set: function (value) {
                    if (!value) return null;
                    return sanitizeHtml(value, {
                        allowedTags: [],
                        allowedAttributes: {},
                    });
                },
            },
            description: {
                type: String,
                maxlength: [160, "Meta description cannot exceed 160 characters"],
                set: function (value) {
                    if (!value) return null;
                    return sanitizeHtml(value, {
                        allowedTags: [],
                        allowedAttributes: {},
                    });
                },
            },
            keywords: [
                {
                    type: String,
                    set: function (value) {
                        if (!value) return null;
                        return sanitizeHtml(value, {
                            allowedTags: [],
                            allowedAttributes: {},
                        });
                    },
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
BlogSchema.index({ author: 1, status: 1 });
BlogSchema.index({ tags: 1, status: 1 });
BlogSchema.index({ categories: 1, status: 1 });

BlogSchema.pre("save", async function (next) {
    try {
        if (this.isModified("title")) {
            let baseSlug = slugify(this.title, { lower: true, strict: true });
            let slug = baseSlug;
            let counter = 1;
            while (await this.constructor.exists({ slug, _id: { $ne: this._id } })) {
                slug = `${baseSlug}-${counter++}`;
            }
            this.slug = slug;
        }
        if (
            this.isModified("status") &&
            this.status === "published" &&
            !this.publishedAt
        ) {
            this.publishedAt = new Date();
        }
        if (this.isModified("content")) {
            const textContent = this.content.replace(/<[^>]*>/g, " ");
            const words = textContent
                .split(/\s+/)
                .filter((word) => word.length > 0).length;
            this.readTime = Math.max(1, Math.round(words / 200));
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
            options.select ||
            "title slug excerpt featuredImage publishedAt readTime author"
        )
        .populate("author", "name email")
        .sort({ publishedAt: -1 })
        .limit(options.limit || 10)
        .skip(options.skip || 0);
};

BlogSchema.statics.findPublished = function (options = {}) {
    return this.find({ status: "published" })
        .populate("author", "name email")
        .populate("categories", "name slug")
        .sort({ publishedAt: -1 })
        .limit(options.limit || 10)
        .skip(options.skip || 0);
};

BlogSchema.statics.findFeatured = function (limit = 5) {
    return this.find({ status: "published", isFeatured: true })
        .populate("author", "name email")
        .sort({ publishedAt: -1 })
        .limit(limit);
};

module.exports = mongoose.model("Blog", BlogSchema);
