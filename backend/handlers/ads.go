package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"crypto-exchange-backend/database"
	"crypto-exchange-backend/models"

	"github.com/gin-gonic/gin"
)

func GetActiveAds(c *gin.Context) {
	var ads []models.Ad
	database.DB.Where("active = ?", true).Order("sort_order asc, created_at desc").Find(&ads)
	c.JSON(http.StatusOK, ads)
}

func GetAllAds(c *gin.Context) {
	var ads []models.Ad
	database.DB.Order("created_at desc").Find(&ads)
	c.JSON(http.StatusOK, ads)
}

func CreateAd(c *gin.Context) {
	var ad models.Ad
	if err := c.ShouldBindJSON(&ad); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if ad.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}
	if err := database.DB.Create(&ad).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ad"})
		return
	}
	c.JSON(http.StatusCreated, ad)
}

func UpdateAd(c *gin.Context) {
	id := c.Param("id")
	var ad models.Ad
	if err := database.DB.First(&ad, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ad not found"})
		return
	}
	var input models.Ad
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	database.DB.Model(&ad).Updates(map[string]interface{}{
		"title":       input.Title,
		"link":        input.Link,
		"image_url":   input.ImageURL,
		"button_text": input.ButtonText,
		"button_link": input.ButtonLink,
		"position":    input.Position,
		"active":      input.Active,
		"sort_order":  input.SortOrder,
	})
	c.JSON(http.StatusOK, ad)
}

func DeleteAd(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Ad{}, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ad not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Ad deleted"})
}

func UploadAdImage(c *gin.Context) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No image file provided"})
		return
	}

	ext := filepath.Ext(file.Filename)
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" && ext != ".webp" && ext != ".svg" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file type. Allowed: jpg, jpeg, png, gif, webp, svg"})
		return
	}

	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename)
	dst := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	url := "/uploads/" + filename
	c.JSON(http.StatusOK, gin.H{"url": url, "filename": filename})
}

var suggestionTemplates = []models.Ad{
	{Title: "🔥 عرض خاص: تداول بدون عمولات لمدة شهر", ButtonText: "استفد الآن", ButtonLink: "/register", Position: "floating"},
	{Title: "🚀 انضم إلى EgMoney اليوم واحصل على 10 USDT هدية", ButtonText: "سجل الآن", ButtonLink: "/register", Position: "hero"},
	{Title: "💎 أقوى منصة تداول في الشرق الأوسط", ButtonText: "ابدأ التداول", ButtonLink: "/register", Position: "floating"},
	{Title: "⚡ تداول بأسرع محرك في المنطقة", ButtonText: "جرب مجاناً", ButtonLink: "/register", Position: "section"},
	{Title: "💰 استثمر في مستقبل العملات الرقمية", ButtonText: "اكتشف المزيد", ButtonLink: "/register", Position: "bottom"},
	{Title: "🛡️ منصة آمنة ومرخصة 100%", ButtonText: "تداول بأمان", ButtonLink: "/register", Position: "floating"},
	{Title: "📊 تحليلات متقدمة ورسوم بيانية مباشرة من Binance", ButtonText: "شاهد التحليلات", ButtonLink: "/dashboard/exchange", Position: "section"},
	{Title: "🎯 حقق أرباحك مع EgMoney", ButtonText: "ابدأ الآن", ButtonLink: "/register", Position: "hero"},
}

func SuggestAd(c *gin.Context) {
	var req struct {
		Topic    string `json:"topic"`
		Position string `json:"position"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Topic = ""
		req.Position = ""
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	var suggestions []models.Ad

	if req.Topic != "" {
		s := models.Ad{
			Title:      fmt.Sprintf("✨ %s - عرض حصري من EgMoney", req.Topic),
			ButtonText: "عرض حصري",
			ButtonLink: "/register",
			Position:   "floating",
			Active:     true,
		}
		suggestions = append(suggestions, s)
	}

	indices := rng.Perm(len(suggestionTemplates))
	maxSuggest := 3
	if len(suggestionTemplates) < maxSuggest+len(suggestions) {
		maxSuggest = len(suggestionTemplates) - len(suggestions)
	}

	for i := 0; i < maxSuggest && i < len(indices); i++ {
		s := suggestionTemplates[indices[i]]
		if req.Position != "" && s.Position != req.Position {
			continue
		}
		suggestions = append(suggestions, s)
		if len(suggestions) >= 4 {
			break
		}
	}

	c.JSON(http.StatusOK, suggestions)
}
