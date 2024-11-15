-- rateLimiter.lua
local key = KEYS[1]
local now = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local bucketSize = 210  -- As per assignment requirement

-- Get current bucket state
local bucket = redis.call('hmget', key, 'tokens', 'lastRefill', 'lockVersion')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])
local lockVersion = tonumber(bucket[3])

-- Initialize if not exists
if not tokens then
    tokens = bucketSize
    lastRefill = now
    lockVersion = 0
    redis.call('hmset', key, 'tokens', tokens, 'lastRefill', lastRefill, 'lockVersion', lockVersion)
end

-- Calculate token refill
local elapsedTime = (now - lastRefill) / 1000
local tokensToAdd = math.floor(elapsedTime * refillRate)
local newTokens = math.min(bucketSize, tokens + tokensToAdd)

-- Attempt atomic operation with optimistic locking
if newTokens > 0 then
    -- Increment lock version to handle race condition
    local newLockVersion = lockVersion + 1
    
    -- Check if the state hasn't changed (race condition check)
    local current = redis.call('hget', key, 'lockVersion')
    if tonumber(current) == lockVersion then
        -- Update bucket state atomically
        redis.call('hmset', key, 
            'tokens', newTokens - 1,
            'lastRefill', now,
            'lockVersion', newLockVersion
        )
        return {newTokens - 1, 0}  -- {remaining tokens, retry after}
    else
        return {-2, 0.1}  -- Race condition detected, retry after 100ms
    end
else
    -- Calculate retry after time
    local timeToNextToken = (1 - (newTokens % 1)) / refillRate
    return {-1, timeToNextToken}  -- Rate limit exceeded
end