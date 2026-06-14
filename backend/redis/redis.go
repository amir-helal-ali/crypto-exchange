package redis

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var Client *redis.Client

// Connect initializes the Redis client if REDIS_URL is configured.
// If REDIS_URL is not set, Client remains nil and the app falls back
// to in-memory implementations.
func Connect() {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		log.Println("[Redis] REDIS_URL not set, using in-memory fallback")
		return
	}

	opt, err := redis.ParseURL(url)
	if err != nil {
		log.Printf("[Redis] Failed to parse REDIS_URL: %v, using in-memory fallback", err)
		return
	}

	Client = redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := Client.Ping(ctx).Err(); err != nil {
		log.Printf("[Redis] Failed to connect: %v, using in-memory fallback", err)
		Client = nil
		return
	}

	log.Println("[Redis] Connected successfully")
}

// IsAvailable returns true if Redis client is configured and reachable.
func IsAvailable() bool {
	if Client == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return Client.Ping(ctx).Err() == nil
}

// IncrementRateLimit increments a rate limit counter for a given key.
// Returns the current count after increment.
// Sets TTL on first creation. Returns -1 on error.
func IncrementRateLimit(key string, window time.Duration) (int, error) {
	if Client == nil {
		return -1, fmt.Errorf("redis not available")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	pipe := Client.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		return -1, err
	}
	return int(incr.Val()), nil
}

// GetCachedPrice retrieves a cached market price from Redis.
func GetCachedPrice(symbol string) (string, error) {
	if Client == nil {
		return "", fmt.Errorf("redis not available")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return Client.Get(ctx, "price:"+symbol).Result()
}

// SetCachedPrice caches a market price in Redis with TTL.
func SetCachedPrice(symbol string, price string, ttl time.Duration) error {
	if Client == nil {
		return fmt.Errorf("redis not available")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return Client.Set(ctx, "price:"+symbol, price, ttl).Err()
}
