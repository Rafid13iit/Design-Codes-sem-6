const express = require("express");
const cors = require("cors");
const rateLimiter = require("./rateLimiter_withoutLua");

const app = express();

app.use(
  cors({
    origin: "*",
    exposedHeaders: [
      "X-Ratelimit-Remaining",
      "X-Ratelimit-Limit",
      "X-Ratelimit-Retry-After",
    ],
  })
);

// Use the rate limiter middleware
app.use(rateLimiter);

app.get("/api/data", (req, res) => {
  res.send({ message: "Request processed successfully" });
});

app.listen(3000, () => {
  console.log("Middleware server running on port 3000");
});
