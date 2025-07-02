const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const contactRoutes = require("./routes/contactRoutes");
const blogRoutes = require("./routes/blogRoutes");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const logger = require("./utils/logger");

require("./models/userModel");
require("./models/blogModel");
require("./models/categoryModel");

dotenv.config();

const app = express();
connectDB();

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
            },
        },
    })
);

if (process.env.NODE_ENV !== "production") {
    logger.info("Server configuration", {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        emailHost: process.env.EMAIL_HOST ? "[REDACTED]" : undefined,
        emailPort: process.env.EMAIL_PORT,
        emailFrom: process.env.EMAIL_FROM ? "[REDACTED]" : undefined,
    });
}

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});

const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many form submissions, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});

const blogLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: "Too many blog-related requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);

app.use(
    cors({
        origin:
            process.env.NODE_ENV === "production"
                ? ["https://katchintech.com", "https://katchinweb.vercel.app"]
                : ["http://localhost:3000", "http://localhost:3001"],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
        optionsSuccessStatus: 200,
    })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/contact", formLimiter, contactRoutes);
app.use("/api/blogs", blogLimiter, blogRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
    });
});

app.use("*", (req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
    });
});

app.use((err, req, res, next) => {
    const statusCode =
        res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Something went wrong!",
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });

    if (process.env.NODE_ENV !== "production") {
        logger.error("Server error", {
            error: err.message,
            stack: err.stack,
            path: req.originalUrl,
            method: req.method,
        });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    if (process.env.NODE_ENV !== "production") {
        logger.info(
            `Server running on port ${PORT} in ${process.env.NODE_ENV} mode`
        );
    } else {
        console.log(
            `Server running on port ${PORT} in ${process.env.NODE_ENV} mode`
        );
    }
});

module.exports = app;
