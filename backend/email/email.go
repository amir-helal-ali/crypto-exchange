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

// SendPasswordResetEmail sends an email with a password reset link.
func SendPasswordResetEmail(to string, resetLink string) error {
        if !IsConfigured() {
                return fmt.Errorf("SMTP not configured")
        }

        htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<body style="font-family:Arial,sans-serif;background:#0a0a0f;padding:40px;text-align:center;margin:0">
<div style="max-width:480px;margin:auto;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.1)">
        <h1 style="color:#10b981;font-size:24px;margin-bottom:8px">EgMoney</h1>
        <h2 style="color:#fff;font-size:18px;margin:16px 0">إعادة تعيين كلمة المرور</h2>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.8">تلقينا طلباً لإعادة تعيين كلمة مرورك. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.</p>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.8">هذا الرابط صالح لمدة ساعة واحدة.</p>
        <a href="%s" style="display:inline-block;background:#10b981;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:600;margin:20px 0">إعادة تعيين كلمة المرور</a>
        <p style="color:#52525b;font-size:12px;margin-top:24px;line-height:1.6">إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد. لن يتغير شيء في حسابك.</p>
        <p style="color:#52525b;font-size:11px;margin-top:12px">أو انسخ الرابط التالي في المتصفح:<br><span style="color:#71717a;word-break:break-all;direction:ltr;display:inline-block">%s</span></p>
</div>
</body>
</html>`, resetLink, resetLink)

        return Send(to, "إعادة تعيين كلمة المرور - EgMoney", htmlBody)
}

// Send2FAEnabledEmail sends a confirmation email when 2FA is enabled.
func Send2FAEnabledEmail(to string) error {
        if !IsConfigured() {
                return fmt.Errorf("SMTP not configured")
        }

        htmlBody := `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<body style="font-family:Arial,sans-serif;background:#0a0a0f;padding:40px;text-align:center;margin:0">
<div style="max-width:480px;margin:auto;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.1)">
        <h1 style="color:#10b981;font-size:24px;margin-bottom:8px">EgMoney</h1>
        <h2 style="color:#fff;font-size:18px;margin:16px 0">تم تفعيل المصادقة الثنائية</h2>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.8">تم تفعيل المصادقة الثنائية (2FA) بنجاح على حسابك. حسابك الآن أكثر أماناً.</p>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.8">من الآن فصاعداً، ستحتاج إلى رمز التحقق من تطبيق المصادقة عند تسجيل الدخول.</p>
        <p style="color:#52525b;font-size:12px;margin-top:24px;line-height:1.6">إذا لم تقم بتفعيل هذه الميزة، يرجى التواصل مع فريق الدعم فوراً.</p>
</div>
</body>
</html>`

        return Send(to, "تم تفعيل المصادقة الثنائية - EgMoney", htmlBody)
}

// SendWelcomeEmail sends a welcome email after successful registration and email verification.
func SendWelcomeEmail(to string, username string) error {
        if !IsConfigured() {
                return fmt.Errorf("SMTP not configured")
        }

        htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<body style="font-family:Arial,sans-serif;background:#0a0a0f;padding:40px;text-align:center;margin:0">
<div style="max-width:480px;margin:auto;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border-radius:24px;padding:40px;border:1px solid rgba(255,255,255,0.1)">
        <h1 style="color:#10b981;font-size:24px;margin-bottom:8px">EgMoney</h1>
        <h2 style="color:#fff;font-size:18px;margin:16px 0">مرحباً بك %s!</h2>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.8">شكراً لانضمامك إلى EgMoney! تم تفعيل حسابك بنجاح.</p>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.8">يمكنك الآن البدء في التداول وإدارة محفظتك الرقمية. ننصحك بتفعيل المصادقة الثنائية (2FA) لحماية حسابك بشكل أفضل.</p>
        <a href="#" style="display:inline-block;background:#10b981;color:#fff;padding:14px 36px;border-radius:12px;text-decoration:none;font-size:16px;font-weight:600;margin:20px 0">ابدأ التداول الآن</a>
        <p style="color:#52525b;font-size:12px;margin-top:24px;line-height:1.6">إذا كانت لديك أي أسئلة، فلا تتردد في التواصل مع فريق الدعم.</p>
</div>
</body>
</html>`, username)

        return Send(to, "مرحباً بك في EgMoney!", htmlBody)
}
