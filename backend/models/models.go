package models

import "time"

type User struct {
        ID           uint      `gorm:"primaryKey" json:"id"`
        Email        string    `gorm:"uniqueIndex;not null;size:255" json:"email"`
        Username     string    `gorm:"uniqueIndex;not null;size:100" json:"username"`
        PasswordHash string    `gorm:"not null" json:"-"`
        FullName     string    `gorm:"default:''" json:"full_name"`
        Country      string    `gorm:"default:''" json:"country"`
        Phone        string    `gorm:"default:''" json:"phone"`
        Role         string    `gorm:"default:USER;size:20" json:"role"`
        CreatedAt    time.Time `json:"created_at"`
        UpdatedAt    time.Time `json:"updated_at"`
}

type Wallet struct {
        ID       uint    `gorm:"primaryKey" json:"id"`
        UserID   uint    `gorm:"not null;index" json:"user_id"`
        Currency string  `gorm:"not null;size:20;index:idx_wallet_user_currency,unique" json:"currency"`
        Balance  float64 `gorm:"type:decimal(36,18);default:0" json:"balance"`
}

type Order struct {
        ID             uint      `gorm:"primaryKey" json:"id"`
        UserID         uint      `gorm:"not null;index" json:"user_id"`
        Symbol         string    `gorm:"not null;size:20;index" json:"symbol"`
        Side           string    `gorm:"not null;size:10" json:"side"`
        Type           string    `gorm:"not null;size:20" json:"type"`
        Price          float64   `json:"price"`
        StopPrice      float64   `json:"stop_price"`
        Quantity       float64   `gorm:"not null" json:"quantity"`
        FilledQuantity float64   `gorm:"default:0" json:"filled_quantity"`
        AvgFillPrice   float64   `gorm:"default:0" json:"avg_fill_price"`
        ReservedAmount float64   `gorm:"default:0" json:"reserved_amount"`
        Status         string    `gorm:"default:PENDING;size:20;index" json:"status"`
        CreatedAt      time.Time `json:"created_at"`
        UpdatedAt      time.Time `json:"updated_at"`
}

type AuditLog struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"not null;index" json:"user_id"`
        Action    string    `gorm:"not null;size:50;index" json:"action"`
        Details   string    `gorm:"type:text" json:"details"`
        IPAddress string    `gorm:"size:45" json:"ip_address"`
        CreatedAt time.Time `json:"created_at"`

        User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type KYCRequest struct {
        ID              uint      `gorm:"primaryKey" json:"id"`
        UserID          uint      `gorm:"uniqueIndex;not null" json:"user_id"`
        FullName        string    `gorm:"not null;size:255" json:"full_name"`
        DocumentType    string    `gorm:"not null;size:50" json:"document_type"`
        DocumentNumber  string    `gorm:"not null;size:100" json:"document_number"`
        DocumentURL     string    `gorm:"not null;size:500" json:"document_url"`
        Status          string    `gorm:"default:PENDING;size:20;index" json:"status"`
        RejectionReason string    `gorm:"type:text" json:"rejection_reason"`
        CreatedAt       time.Time `json:"created_at"`
        UpdatedAt       time.Time `json:"updated_at"`

        User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type Transaction struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"not null;index" json:"user_id"`
        Type      string    `gorm:"not null;size:20;index" json:"type"`
        Currency  string    `gorm:"not null;size:20" json:"currency"`
        Amount    float64   `gorm:"type:decimal(36,18);not null" json:"amount"`
        Status    string    `gorm:"default:PENDING;size:20;index" json:"status"`
        Address   string    `gorm:"size:500" json:"address"`
        TxID      string    `gorm:"size:255" json:"tx_id"`
        CreatedAt time.Time `json:"created_at"`
}

type PasswordResetToken struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        UserID    uint      `gorm:"not null;index" json:"user_id"`
        Token     string    `gorm:"uniqueIndex;not null;size:64" json:"-"`
        ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
        Used      bool      `gorm:"default:false" json:"-"`
        CreatedAt time.Time `json:"created_at"`
}

type Ad struct {
        ID         uint      `gorm:"primaryKey" json:"id"`
        Title      string    `gorm:"not null;size:500" json:"title"`
        Link       string    `gorm:"size:500" json:"link"`
        ImageURL   string    `gorm:"size:500" json:"image_url"`
        ButtonText string    `gorm:"size:100" json:"button_text"`
        ButtonLink string    `gorm:"size:500" json:"button_link"`
        Position   string    `gorm:"default:'hero';size:20;index" json:"position"`
        Active     bool      `gorm:"default:true" json:"active"`
        SortOrder  int       `gorm:"default:0" json:"sort_order"`
        CreatedAt  time.Time `json:"created_at"`
        UpdatedAt  time.Time `json:"updated_at"`
}
