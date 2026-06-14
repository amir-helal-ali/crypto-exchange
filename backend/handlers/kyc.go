package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
)

// UploadKYCDocument handles POST /api/kyc/upload
// Allows users to upload KYC document images (passport, national ID, etc.)
func UploadKYCDocument(c *gin.Context) {
	file, err := c.FormFile("document")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "لم يتم تقديم ملف"})
		return
	}

	// Max file size: 10MB for KYC documents
	if file.Size > 10*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت"})
		return
	}

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".pdf": true}
	if !allowedExts[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "نوع ملف غير مدعوم. الأنواع المسموحة: jpg, jpeg, png, webp, pdf"})
		return
	}

	// Create KYC upload directory
	uploadDir := "./uploads/kyc"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "فشل إنشاء مجلد الرفع"})
		return
	}

	// Generate unique filename with user ID prefix
	userID := c.GetUint("user_id")
	filename := fmt.Sprintf("kyc_%d_%d%s", userID, time.Now().UnixNano(), ext)
	dst := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "فشل حفظ الملف"})
		return
	}

	documentURL := "/uploads/kyc/" + filename
	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"url":          documentURL,
		"filename":     filename,
		"message":      "تم رفع الملف بنجاح",
	})
}

func SubmitKYC(c *gin.Context) {
	userID := c.GetUint("user_id")

	// Check if user already has a pending or approved KYC request
	var existingKYC models.KYCRequest
	if err := database.DB.Where("user_id = ? AND status IN ?", userID, []string{"PENDING", "APPROVED"}).First(&existingKYC).Error; err == nil {
		if existingKYC.Status == "APPROVED" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "تم التحقق من هويتك بالفعل"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "لديك طلب تحقق قيد المراجعة بالفعل"})
		return
	}

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

	// Validate document URL is from our server (security: prevent external URLs)
	if !strings.HasPrefix(input.DocumentURL, "/uploads/kyc/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "رابط المستند غير صالح. يرجى رفع الملف أولاً."})
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
		c.JSON(http.StatusConflict, gin.H{"error": "فشل تقديم طلب التحقق. يرجى المحاولة مرة أخرى."})
		return
	}

	database.DB.Create(&models.AuditLog{
		UserID:    userID,
		Action:    "KYC_SUBMITTED",
		Details:   fmt.Sprintf("KYC request submitted: %s (%s)", input.DocumentType, input.DocumentNumber[:3]+"***"),
		IPAddress: c.ClientIP(),
		CreatedAt: time.Now(),
	})

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "تم تقديم طلب التحقق بنجاح. سيتم مراجعته خلال 24-48 ساعة.",
		"data":    kyc,
	})
}

func GetMyKYC(c *gin.Context) {
	userID := c.GetUint("user_id")
	var kyc models.KYCRequest
	if err := database.DB.Where("user_id = ?", userID).First(&kyc).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "لم يتم تقديم طلب تحقق بعد"})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "تم مراجعة هذا الطلب بالفعل"})
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

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "تم مراجعة طلب التحقق بنجاح"})
}
