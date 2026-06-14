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

// SendVerificationEmail sends an email with a verification link to the user.
func SendVerificationEmail(to string, verificationLink string) error {
        if !IsConfigured() {
                return fmt.Errorf("SMTP not configured")
        }

        htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<body style="font-family:Arial,sans-serif;background:#0a0a0f;padding:40px;text-align:center;margin:0">
<div style="max-width:480px;margin:auto;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.1)">
        <h1 style="color:#10b981;font-size:24px;margin-bottom:8px">EgMoney</h1>
        <h2 style="color:#fff;font-size:18px;margin:16px 0">تأكيد البريد الإلكتروني</h2>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.8">شكراً لتسجيلك في EgMoney! يرجى الضغط على الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل حسابك.</p>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.8">هذا الرابط صالح لمدة 24 ساعة.</p>
        <a href="%s" style="display:inline-block;background:#10b981;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:600;margin:20px 0">تأكيد البريد الإلكتروني</a>
        <p style="color:#52525b;font-size:12px;margin-top:24px;line-height:1.6">إذا لم تُنشئ حساباً في EgMoney، يرجى تجاهل هذا البريد.</p>
        <p style="color:#52525b;font-size:11px;margin-top:12px">أو انسخ الرابط التالي في المتصفح:<br><span style="color:#71717a;word-break:break-all;direction:ltr;display:inline-block">%s</span></p>
</div>
</body>
</html>`, verificationLink, verificationLink)

        return Send(to, "تأكيد البريد الإلكتروني - EgMoney", htmlBody)
}
