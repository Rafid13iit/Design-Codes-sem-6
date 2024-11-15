const redis = require('redis');
const fs = require('fs');
const path = require('path');

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

// Load Lua script
const luaScript = fs.readFileSync(path.join(__dirname, 'rateLimiter.lua'), 'utf8');

const rateLimiter = async (req, res, next) => {
    const key = `ratelimit:${req.ip}`;
    const now = Date.now();
    let retries = 0;

    const attemptRateLimit = async () => {
        try {
            const result = await client.eval(
                luaScript,
                {
                    keys: [key],
                    arguments: [String(now), String(REFILL_RATE)]
                }
            );

            const [remaining, retryAfter] = result;

            // Set standard rate limit headers
            res.set({
                'X-RateLimit-Limit': BUCKET_SIZE,
                'X-RateLimit-Remaining': Math.max(0, remaining),
                'X-RateLimit-Reset': now + (retryAfter * 1000)
            });

            if (remaining >= 0) {
                return next();
            } else if (remaining === -2 && retries < MAX_RETRIES) {
                // Handle race condition
                retries++;
                return new Promise(resolve => setTimeout(resolve, 100))
                    .then(() => attemptRateLimit());
            } else {
                // Rate limit exceeded
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