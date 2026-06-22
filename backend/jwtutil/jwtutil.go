// Package jwtutil provides JWT generation and validation helpers.
//
// This package exists to break a would-be import cycle between
// `handlers` (which produces tokens) and `websocket` (which validates
// tokens for /ws/user). Both packages now depend on jwtutil, and
// neither imports the other.
package jwtutil

import (
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims is the JWT payload shape used across the backend.
type Claims struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// Secret returns the JWT signing secret, panicking at startup if it is
// unset. We panic because running without a secret would be a critical
// security regression — every token would be trivially forgeable.
func Secret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		panic("CRITICAL: JWT_SECRET environment variable is not set")
	}
	return []byte(s)
}

// Generate creates a signed access token for the given user/role.
// Access tokens are short-lived (15 minutes); use GenerateRefreshToken
// for long-lived (7-day) tokens stored in the database.
func Generate(userID uint, role string) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(Secret())
}

// Validate parses and validates a JWT, returning the claims if valid.
func Validate(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return Secret(), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, jwt.ErrSignatureInvalid
	}
	return claims, nil
}
