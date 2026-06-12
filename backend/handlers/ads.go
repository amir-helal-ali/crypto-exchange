package handlers

import (
	"net/http"

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
		"title":      input.Title,
		"link":       input.Link,
		"image_url":  input.ImageURL,
		"position":   input.Position,
		"active":     input.Active,
		"sort_order": input.SortOrder,
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
