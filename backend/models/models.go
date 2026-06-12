package models

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	Username     string    `gorm:"uniqueIndex;not null" json:"username"`
	PasswordHash string    `gorm:"not null" json:"-"`
	Role         string    `gorm:"default:USER" json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Wallet struct {
	ID       uint    `gorm:"primaryKey" json:"id"`
	UserID   uint    `json:"user_id"`
	Currency string  `gorm:"not null" json:"currency"`
	Balance  float64 `gorm:"type:decimal(36,18);default:0" json:"balance"`
}

type Order struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	UserID         uint      `json:"user_id"`
	Symbol         string    `gorm:"not null" json:"symbol"`
	Side           string    `gorm:"not null" json:"side"`
	Type           string    `gorm:"not null" json:"type"`
	Price          float64   `json:"price"`
	StopPrice      float64   `json:"stop_price"`
	Quantity       float64   `gorm:"not null" json:"quantity"`
	FilledQuantity float64   `gorm:"default:0" json:"filled_quantity"`
	Status         string    `gorm:"default:PENDING" json:"status"`
	CreatedAt      time.Time `json:"created_at"`
}

type AuditLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`
	Action    string    `gorm:"not null" json:"action"`
	Details   string    `json:"details"`
	IPAddress string    `json:"ip_address"`
	CreatedAt time.Time `json:"created_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type KYCRequest struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	UserID          uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	FullName        string    `gorm:"not null" json:"full_name"`
	DocumentType    string    `gorm:"not null" json:"document_type"`
	DocumentNumber  string    `gorm:"not null" json:"document_number"`
	DocumentURL     string    `gorm:"not null" json:"document_url"`
	Status          string    `gorm:"default:PENDING" json:"status"`
	RejectionReason string    `json:"rejection_reason"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type Transaction struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id"`
	Type      string    `gorm:"not null" json:"type"`
	Currency  string    `gorm:"not null" json:"currency"`
	Amount    float64   `gorm:"type:decimal(36,18);not null" json:"amount"`
	Status    string    `gorm:"default:PENDING" json:"status"`
	Address   string    `json:"address"`
	TxID      string    `json:"tx_id"`
	CreatedAt time.Time `json:"created_at"`
}

type Ad struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Title     string    `gorm:"not null" json:"title"`
	Link      string    `json:"link"`
	ImageURL  string    `json:"image_url"`
	Position  string    `gorm:"default:'hero'" json:"position"`
	Active    bool      `gorm:"default:true" json:"active"`
	SortOrder int       `gorm:"default:0" json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
