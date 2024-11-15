const redis = require('redis');

const client = redis.createClient({
    url: 'redis://localhost:6379'
});

// Connecting to Redis
(async () => {
    await client.connect();
})();

const BUCKET_SIZE = 210;
const REFILL_RATE = 10;   // Tokens per second
const MAX_RETRIES = 3;    // Maximum retries for race conditions

const rateLimiter = async (req, res, next) => {
    const key = `ratelimit:${req.ip}`;
    const now = Date.now();
    let retries = 0;

    const attemptRateLimit = async () => {
        try {
            // Get the current state of tokens and last refill time
            const bucket = await client.hGetAll(key);
            let tokens = bucket.tokens ? parseInt(bucket.tokens) : BUCKET_SIZE;
            let lastRefill = bucket.lastRefill ? parseInt(bucket.lastRefill) : now;

            // Calculate elapsed time since the last refill
            const elapsedTime = (now - lastRefill) / 1000; // Convert ms to seconds
            const tokensToAdd = Math.floor(elapsedTime * REFILL_RATE);
            tokens = Math.min(BUCKET_SIZE, tokens + tokensToAdd); // Refill tokens but do not exceed bucket size
            lastRefill = now;

            // Check if there are tokens available
            if (tokens > 0) {
                // Deduct a token
                tokens -= 1;

                // Save the updated bucket state
                await client.hSet(key, {
                    tokens,
                    lastRefill
                });

                // Set rate limit headers
                res.set({
                    'X-RateLimit-Limit': BUCKET_SIZE,
                    'X-RateLimit-Remaining': Math.max(0, tokens),
                    'X-RateLimit-Reset': now + (1000 / REFILL_RATE)
                });

                return next();
            } else if (retries < MAX_RETRIES) {
                // If no tokens are available, retry after a short delay
                retries++;
                return new Promise(resolve => setTimeout(resolve, 100))
                    .then(() => attemptRateLimit());
            } else {
                // Rate limit exceeded
                const retryAfter = (1 / REFILL_RATE); // Time in seconds to the next token refill
                res.set('X-RateLimit-Retry-After', Math.ceil(retryAfter));
                return res.status(429).json({
                    error: 'Too Many Requests',
                    retryAfter: Math.ceil(retryAfter)
                });
            }
        } catch (error) {
            console.error('Rate limiter error:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };

    return attemptRateLimit();
};

module.exports = rateLimiter;
