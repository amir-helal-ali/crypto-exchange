package handlers

import (
	"fmt"
	"net/http"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
)

func SubmitKYC(c *gin.Context) {
	userID := c.GetUint("user_id")
	var input struct {
		FullName       string `json:"full_name" binding:"required"`
		DocumentType   string `json:"document_type" binding:"required,oneof=passport national_id driving_license"`
		DocumentNumber string `json:"document_number" binding:"required,min=5"`
		DocumentURL    string `json:"document_url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	kyc := models.KYCRequest{
		UserID:         userID,
		FullName:       input.FullName,
		DocumentType:   input.DocumentType,
		DocumentNumber: input.DocumentNumber,
		DocumentURL:    input.DocumentURL,
		Status:         "PENDING",
	}

	if err := database.DB.Create(&kyc).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "KYC request already submitted"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "message": "KYC request submitted successfully"})
}

func GetMyKYC(c *gin.Context) {
	userID := c.GetUint("user_id")
	var kyc models.KYCRequest
	if err := database.DB.Where("user_id = ?", userID).First(&kyc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No KYC request found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": kyc})
}

func GetAllKYCRequests(c *gin.Context) {
	page, limit := getPagination(c)
	offset := (page - 1) * limit

	var total int64
	database.DB.Model(&models.KYCRequest{}).Count(&total)

	var requests []models.KYCRequest
	database.DB.Preload("User").Order("created_at DESC").Limit(limit).Offset(offset).Find(&requests)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": requests, "total": total, "page": page, "limit": limit})
}

func ReviewKYC(c *gin.Context) {
	kycID := c.Param("id")
	adminID, _ := c.Get("user_id")

	var input struct {
		Status          string `json:"status" binding:"required,oneof=APPROVED REJECTED"`
		RejectionReason string `json:"rejection_reason"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var kyc models.KYCRequest
	if err := database.DB.First(&kyc, kycID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "KYC request not found"})
		return
	}

	if kyc.Status != "PENDING" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "KYC request already reviewed"})
		return
	}

	kyc.Status = input.Status
	kyc.RejectionReason = input.RejectionReason
	database.DB.Save(&kyc)

	if input.Status == "APPROVED" {
		database.DB.Model(&models.User{}).Where("id = ?", kyc.UserID).Update("role", "VERIFIED_USER")
	}

	database.DB.Create(&models.AuditLog{
		UserID:    adminID.(uint),
		Action:    "REVIEW_KYC",
		Details:   fmt.Sprintf("%s KYC request for user #%d", input.Status, kyc.UserID),
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "KYC request reviewed successfully"})
}
