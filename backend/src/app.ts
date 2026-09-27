import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "./queues/emailQueue";
import { config } from "./config/index.js";
import { getHealth } from "./controllers/healthController.js";

const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath("/admin/queues");
createBullBoard({
	queues: [new BullMQAdapter(emailQueue)],
	serverAdapter: bullBoardAdapter,
});

const app = express();

// Security headers
app.use(helmet());

// CORS
const allowedOrigins = config.isDev
	? [...new Set([config.frontendUrl, "http://127.0.0.1:5173", "http://localhost:5173"])]
	: config.frontendUrl;
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Request logging
morgan.token("safe-url", (req) => req.url?.split("?")[0] ?? "/");
app.use(morgan(":method :safe-url :status :response-time ms - :res[content-length]"));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.get("/health", getHealth);
app.use("/api", routes);
app.use("/admin/queues", bullBoardAdapter.getRouter());

// 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;
