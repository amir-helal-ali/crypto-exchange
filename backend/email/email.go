package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"os"
)

type Config struct {
	SMTPHost   string
	SMTPPort   string
	SMTPUser   string
	SMTPPass   string
	FromName   string
	FromEmail  string
}

var cfg *Config

func LoadConfig() {
	cfg = &Config{
		SMTPHost:  os.Getenv("SMTP_HOST"),
		SMTPPort:  os.Getenv("SMTP_PORT"),
		SMTPUser:  os.Getenv("SMTP_USER"),
		SMTPPass:  os.Getenv("SMTP_PASS"),
		FromName:  os.Getenv("SMTP_FROM_NAME"),
		FromEmail: os.Getenv("SMTP_FROM_EMAIL"),
	}
	if cfg.SMTPHost == "" {
		cfg.SMTPHost = "sandbox.smtp.mailtrap.io"
	}
	if cfg.SMTPPort == "" {
		cfg.SMTPPort = "587"
	}
	if cfg.FromName == "" {
		cfg.FromName = "EgMoney"
	}
	if cfg.FromEmail == "" {
		cfg.FromEmail = "noreply@eg-money.com"
	}
}

func IsConfigured() bool {
	return cfg.SMTPUser != "" && cfg.SMTPPass != ""
}

func Send(to, subject, htmlBody string) error {
	if !IsConfigured() {
		return fmt.Errorf("SMTP not configured")
	}

	headers := ""
	headers += fmt.Sprintf("From: %s <%s>\r\n", cfg.FromName, cfg.FromEmail)
	headers += fmt.Sprintf("To: %s\r\n", to)
	headers += fmt.Sprintf("Subject: %s\r\n", subject)
	headers += "MIME-Version: 1.0\r\n"
	headers += "Content-Type: text/html; charset=\"UTF-8\"\r\n"
	headers += "\r\n"

	msg := []byte(headers + htmlBody)

	addr := fmt.Sprintf("%s:%s", cfg.SMTPHost, cfg.SMTPPort)

	if cfg.SMTPPort == "465" {
		tlsCfg := &tls.Config{ServerName: cfg.SMTPHost}
		conn, err := tls.Dial("tcp", addr, tlsCfg)
		if err != nil {
			return fmt.Errorf("tls dial: %w", err)
		}
		client, err := smtp.NewClient(conn, cfg.SMTPHost)
		if err != nil {
			return fmt.Errorf("smtp client: %w", err)
		}
		defer client.Close()
		if err = client.Auth(smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)); err != nil {
			return fmt.Errorf("auth: %w", err)
		}
		if err = client.Mail(cfg.FromEmail); err != nil {
			return fmt.Errorf("mail from: %w", err)
		}
		if err = client.Rcpt(to); err != nil {
			return fmt.Errorf("rcpt: %w", err)
		}
		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("data: %w", err)
		}
		_, err = w.Write(msg)
		if err != nil {
			return fmt.Errorf("write: %w", err)
		}
		return w.Close()
	}

	auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPass, cfg.SMTPHost)
	return smtp.SendMail(addr, auth, cfg.FromEmail, []string{to}, msg)
}
