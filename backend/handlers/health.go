package handlers

import (
	"fmt"
	"net/http"
	"time"

	"crypto-exchange-backend/database"

	"github.com/gin-gonic/gin"
)

// HealthCheck returns a detailed health status of the API and its dependencies.
// This is used by load balancers, Kubernetes probes, and monitoring systems.
func HealthCheck(c *gin.Context) {
	status := gin.H{
		"status":    "healthy",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"version":   "1.0.0",
		"uptime":    time.Since(startTime).String(),
	}

	// Check database connectivity
	dbStatus := checkDatabase()
	if dbStatus != "ok" {
		status["status"] = "degraded"
	}
	status["database"] = dbStatus

	// Overall HTTP status
	httpStatus := http.StatusOK
	if status["status"] != "healthy" {
		httpStatus = http.StatusServiceUnavailable
	}

	c.JSON(httpStatus, status)
}

// ReadinessCheck returns whether the application is ready to receive traffic.
// Used by Kubernetes readiness probes.
func ReadinessCheck(c *gin.Context) {
	dbStatus := checkDatabase()
	if dbStatus != "ok" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"ready": false,
			"reason": fmt.Sprintf("database: %s", dbStatus),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ready": true})
}

// LivenessCheck returns whether the application process is alive.
// Used by Kubernetes liveness probes.
func LivenessCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"alive": true})
}

func checkDatabase() string {
	sqlDB, err := database.DB.DB()
	if err != nil {
		return fmt.Sprintf("error: %s", err.Error())
	}

	// Set a short timeout for health check ping
	sqlDB.SetConnMaxLifetime(5 * time.Second)

	if err := sqlDB.Ping(); err != nil {
		return fmt.Sprintf("unreachable: %s", err.Error())
	}

	// Check connection stats
	stats := sqlDB.Stats()
	if stats.OpenConnections >= stats.MaxOpenConnections && stats.MaxOpenConnections > 0 {
		return "connection_pool_exhausted"
	}

	return "ok"
}

// Track server start time for uptime calculation
var startTime = time.Now()
