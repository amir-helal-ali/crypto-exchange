package database

import (
	"log"
	"os"

	"crypto-exchange-backend/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=postgres user=crypto password=SecurePass123! dbname=crypto_exchange port=5432 sslmode=disable"
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	err = DB.AutoMigrate(&models.User{}, &models.Order{}, &models.Wallet{}, &models.AuditLog{}, &models.KYCRequest{}, &models.Transaction{}, &models.Ad{})
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	log.Println("Database connected and migrated successfully")
}
