package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"net/url"
	"strings"
	"time"
)

const (
	// TOTPDigits is the number of digits in the OTP code
	TOTPDigits = 6
	// TOTPTimeStep is the time step in seconds (30 seconds per RFC 6238)
	TOTPTimeStep = 30
	// TOTPSkew allows for clock drift: validates against ±skew time steps
	TOTPSkew = 1
	// SecretSize is the size of the TOTP secret in bytes (160 bits per RFC 4226)
	SecretSize = 20
)

// GenerateTOTPSecret generates a cryptographically secure TOTP secret (base32 encoded)
func GenerateTOTPSecret() (string, error) {
	secret := make([]byte, SecretSize)
	if _, err := rand.Read(secret); err != nil {
		return "", fmt.Errorf("failed to generate secret: %w", err)
	}
	// Base32 encode without padding (standard for TOTP)
	encoder := base32.StdEncoding.WithPadding(base32.NoPadding)
	return encoder.EncodeToString(secret), nil
}

// ValidateTOTPCode validates a TOTP code against the given secret.
// It checks the current time step ± TOTPSkew to allow for clock drift.
func ValidateTOTPCode(secret string, code string) bool {
	// Normalize: remove spaces and ensure uppercase
	code = strings.TrimSpace(code)
	if len(code) != TOTPDigits {
		return false
	}

	// Decode the base32 secret
	encoder := base32.StdEncoding.WithPadding(base32.NoPadding)
	secretUpper := strings.ToUpper(secret)
	secretBytes, err := encoder.DecodeString(secretUpper)
	if err != nil {
		return false
	}

	// Get current time step
	now := time.Now().Unix()
	currentStep := now / TOTPTimeStep

	// Check ±skew time steps
	for i := -TOTPSkew; i <= TOTPSkew; i++ {
		expectedCode := generateOTP(secretBytes, currentStep+int64(i))
		if expectedCode == code {
			return true
		}
	}

	return false
}

// generateOTP generates a one-time password for the given secret and time step
// Implements RFC 4226 (HOTP) with time-based counter per RFC 6238 (TOTP)
func generateOTP(secret []byte, timeStep int64) string {
	// Convert time step to big-endian 8-byte array
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(timeStep))

	// HMAC-SHA1
	mac := hmac.New(sha1.New, secret)
	mac.Write(buf)
	hash := mac.Sum(nil)

	// Dynamic truncation (RFC 4226 Section 5.3)
	offset := hash[len(hash)-1] & 0x0F
	truncated := binary.BigEndian.Uint32(hash[offset:offset+4]) & 0x7FFFFFFF

	// Generate 6-digit code
	code := truncated % uint32(math.Pow10(TOTPDigits))
	return fmt.Sprintf("%0*d", TOTPDigits, code)
}

// GenerateOTPAuthURL creates an otpauth:// URL for QR code generation
// This URL can be scanned by authenticator apps like Google Authenticator, Authy, etc.
func GenerateOTPAuthURL(secret string, accountName string, issuer string) string {
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d",
		url.QueryEscape(issuer),
		url.QueryEscape(accountName),
		secret,
		url.QueryEscape(issuer),
		TOTPDigits,
		TOTPTimeStep,
	)
}

// GenerateBackupCodes generates a set of single-use backup codes
// Each code is 8 characters long, alphanumeric (uppercase + digits, excluding ambiguous chars)
func GenerateBackupCodes(count int) ([]string, error) {
	// Use characters that are not easily confused: no 0/O, 1/I/L
	const charset = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
	codes := make([]string, count)

	for i := 0; i < count; i++ {
		code := make([]byte, 8)
		if _, err := rand.Read(code); err != nil {
			return nil, fmt.Errorf("failed to generate backup code: %w", err)
		}
		var result strings.Builder
		for _, b := range code {
			result.WriteByte(charset[b%byte(len(charset))])
		}
		// Format as XXXX-XXXX for readability
		raw := result.String()
		codes[i] = raw[:4] + "-" + raw[4:]
	}

	return codes, nil
}
