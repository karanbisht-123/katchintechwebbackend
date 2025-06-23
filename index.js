// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const dotenv = require('dotenv');
// const connectDB = require('./config/database');
// const contactRoutes = require('./routes/contactRoutes');



// const app = express();
// connectDB();

// app.use(helmet());

// console.log('Loaded environment variables:', {
//     host: process.env.EMAIL_HOST,
//     port: process.env.EMAIL_PORT,
//     user: process.env.EMAIL_USER,
//     from: process.env.EMAIL_FROM,
//     notification: process.env.NOTIFICATION_EMAIL
// });


// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     message: 'Too many requests from this IP, please try again later.'
// });
// app.use(limiter);

// const formLimiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 5,
//     message: 'Too many form submissions, please try again later.'
// });

// app.use(cors({
//     origin: process.env.NODE_ENV === 'production'
//         ? ['https://yourdomain.com']
//         : ['http://localhost:3000', 'http://localhost:3001'],
//     methods: ['GET', 'POST'],
//     credentials: true
// }));


// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// app.use('/api/contact', formLimiter, contactRoutes);


// app.get('/health', (req, res) => {
//     res.status(200).json({
//         status: 'OK',
//         timestamp: new Date().toISOString(),
//         uptime: process.uptime()
//     });
// });


// app.use('*', (req, res) => {
//     res.status(404).json({
//         success: false,
//         message: 'Route not found'
//     });
// });


// app.use((err, req, res, next) => {
//     console.error('Error:', err.stack);
//     res.status(500).json({
//         success: false,
//         message: 'Something went wrong!',
//         error: process.env.NODE_ENV === 'development' ? err.message : undefined
//     });
// });


// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//     console.log(`Environment: ${process.env.NODE_ENV}`);
// });

// module.exports = app;







// const seedBlogs = async () => {
//     try {
//         // Check if slugify is available
//         if (!slugify) {
//             throw new Error('Slugify package is not installed. Run `npm install slugify`');
//         }

//         await connectDB();

//         // Seed categories
//         const categoriesToSeed = [
//             'Cryptocurrency',
//             'Blockchain Security',
//             'Decentralized Finance (DeFi)',
//             'Web3',
//             'Stellar Network',
//             'User Experience (UX)'
//         ];
//         const categoryMap = {};

//         for (const name of categoriesToSeed) {
//             let category = await Category.findOne({ name });
//             if (!category) {
//                 category = await Category.create({ name });
//                 console.log(`Category "${name}" created with ID: ${category._id}`);
//             } else {
//                 console.log(`Category "${name}" already exists with ID: ${category._id}`);
//             }
//             categoryMap[name] = category._id;
//         }

//         // Assign categories to blogs
//         blogData[0].categories = [
//             categoryMap['Cryptocurrency'],
//             categoryMap['Blockchain Security'],
//             categoryMap['Decentralized Finance (DeFi)'],
//             categoryMap['Web3']
//         ];
//         blogData[1].categories = [
//             categoryMap['Stellar Network'],
//             categoryMap['Decentralized Finance (DeFi)'],
//             categoryMap['Cryptocurrency'],
//             categoryMap['User Experience (UX)']
//         ];
//         blogData[2].categories = [
//             categoryMap['Stellar Network'],
//             categoryMap['Decentralized Finance (DeFi)'],
//             categoryMap['Cryptocurrency'],
//             categoryMap['User Experience (UX)']
//         ];

//         // Optional: Clear existing blog data
//         await Blog.deleteMany({});
//         console.log('Existing blog data cleared');

//         // Insert or update blog data
//         for (const blog of blogData) {
//             // Generate slug
//             let slug = slugify(blog.title, { lower: true, strict: true });

//             // Ensure unique slug
//             let counter = 1;
//             while (await Blog.exists({ slug })) {
//                 slug = `${slugify(blog.title, { lower: true, strict: true })}-${counter++}`;
//             }
//             blog.slug = slug;

//             // Use upsert to insert or update based on slug
//             await Blog.findOneAndUpdate(
//                 { slug: blog.slug },
//                 { $set: blog },
//                 { upsert: true, new: true, runValidators: true }
//             );
//             console.log(`Blog post "${blog.title}" processed with slug: ${slug}`);
//         }

//         console.log('Blog data seeded successfully');
//         mongoose.connection.close();
//     } catch (error) {
//         console.error('Error seeding blog data:', error);
//         mongoose.connection.close();
//         process.exit(1);
//     }
// };

// // Run the seeding function
// seedBlogs();


const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const contactRoutes = require('./routes/contactRoutes');
const blogRoutes = require('./routes/blogRoutes');
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require("./routes/categoryRoutes");
const logger = require('./utils/logger');


// Load all models to ensure they are registered with Mongoose
require('./models/userModel');
require('./models/blogModel');
require('./models/categoryModel');

dotenv.config();

const app = express();

// Database connection
connectDB();

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com']
        }
    }
}));

// Logging environment variables (sensitive data masked)
logger.info('Server configuration', {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    emailHost: process.env.EMAIL_HOST ? '[REDACTED]' : undefined,
    emailPort: process.env.EMAIL_PORT,
    emailFrom: process.env.EMAIL_FROM ? '[REDACTED]' : undefined
});

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Form submission rate limiting
const formLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many form submissions, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Blog-specific rate limiting
const blogLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message: 'Too many blog-related requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use(generalLimiter);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://katchintech.com', 'https://katchinweb.vercel.app']
        : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/contact', formLimiter, contactRoutes);
app.use('/api/blogs', blogLimiter, blogRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Server error', {
        error: err.message,
        stack: err.stack,
        path: req.originalUrl,
        method: req.method
    });

    res.status(err.status || 500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = app;