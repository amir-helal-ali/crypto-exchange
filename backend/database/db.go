package database

import (
	"log"
	"os"
	"time"

	"crypto-exchange-backend/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=postgres user=egmoney password=EgMoney@2024Secure! dbname=crypto_exchange port=5432 sslmode=disable"
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Failed to get DB instance: %v", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	err = DB.AutoMigrate(&models.User{}, &models.Order{}, &models.Wallet{}, &models.AuditLog{}, &models.KYCRequest{}, &models.Transaction{}, &models.Ad{}, &models.PasswordResetToken{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database connected and migrated successfully")
}
