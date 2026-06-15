/**
 * Frontend validation utilities matching backend validation rules.
 * Provides real-time input validation for forms.
 */

export interface ValidationErrors {
  [field: string]: string;
}

// --- Email Validation ---

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email: string): ValidationErrors {
  const errors: ValidationErrors = {};
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    errors.email = "البريد الإلكتروني مطلوب";
    return errors;
  }

  if (trimmed.length < 3) {
    errors.email = "البريد الإلكتروني قصير جداً";
  }

  if (trimmed.length > 255) {
    errors.email = "البريد الإلكتروني طويل جداً";
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    errors.email = "صيغة البريد الإلكتروني غير صالحة";
  }

  return errors;
}

// --- Username Validation ---

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export function validateUsername(username: string): ValidationErrors {
  const errors: ValidationErrors = {};
  const trimmed = username.trim();

  if (!trimmed) {
    errors.username = "اسم المستخدم مطلوب";
    return errors;
  }

  if (trimmed.length < 3) {
    errors.username = "اسم المستخدم يجب أن يكون 3 أحرف على الأقل";
  }

  if (trimmed.length > 30) {
    errors.username = "اسم المستخدم يجب ألا يتجاوز 30 حرفاً";
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    errors.username = "اسم المستخدم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط";
  }

  return errors;
}

// --- Password Validation ---

export function validatePassword(password: string): string | null {
  if (!password) return "كلمة المرور مطلوبة";
  if (password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (password.length > 128) return "كلمة المرور طويلة جداً";

  if (!/[A-Z]/.test(password)) return "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل";
  if (!/[a-z]/.test(password)) return "كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل";
  if (!/[0-9]/.test(password)) return "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل";
  }

  return null;
}

// --- Order Validation ---

export const VALID_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT",
  "XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT",
];

export function validateOrder(input: {
  symbol: string;
  side: string;
  type: string;
  price?: number;
  stopPrice?: number;
  quantity: number;
}): ValidationErrors {
  const errors: ValidationErrors = {};
  const symbol = input.symbol.toUpperCase().trim();

  // Symbol validation
  if (!VALID_SYMBOLS.includes(symbol)) {
    errors.symbol = "زوج التداول غير مدعوم";
  }

  // Side validation
  if (input.side !== "BUY" && input.side !== "SELL") {
    errors.side = "الاتجاه يجب أن يكون شراء أو بيع";
  }

  // Type validation
  const validTypes = ["MARKET", "LIMIT", "STOP_LIMIT", "TAKE_PROFIT"];
  if (!validTypes.includes(input.type)) {
    errors.type = "نوع الأمر غير صالح";
  }

  // Quantity validation
  if (!input.quantity || input.quantity <= 0) {
    errors.quantity = "الكمية يجب أن تكون أكبر من صفر";
  } else if (input.quantity > 1000000) {
    errors.quantity = "الكمية كبيرة جداً";
  }

  // Price validation
  if ((input.type === "LIMIT" || input.type === "STOP_LIMIT") && (!input.price || input.price <= 0)) {
    errors.price = "السعر مطلوب للأوامر المحددة ووقف محدد";
  }

  // Stop price validation
  if ((input.type === "STOP_LIMIT" || input.type === "TAKE_PROFIT") && (!input.stopPrice || input.stopPrice <= 0)) {
    errors.stop_price = "سعر الإيقاف مطلوب لأوامر الوقف وجني الأرباح";
  }

  return errors;
}

// --- Withdrawal Validation ---

export const VALID_CURRENCIES = ["BTC", "ETH", "USDT", "BNB", "SOL", "XRP", "ADA", "DOGE", "DOT"];

export function validateWithdrawal(
  currency: string,
  amount: number,
  address: string,
  balance: number
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!VALID_CURRENCIES.includes(currency.toUpperCase())) {
    errors.currency = "العملة غير مدعومة";
  }

  if (amount <= 0) {
    errors.amount = "المبلغ يجب أن يكون أكبر من صفر";
  } else if (amount < 0.001) {
    errors.amount = "الحد الأدنى للسحب هو 0.001";
  } else if (amount > balance) {
    errors.amount = `رصيد غير كافٍ (المتاح: ${balance.toFixed(8)})`;
  }

  const trimmedAddress = address.trim();
  if (trimmedAddress.length < 10) {
    errors.address = "عنوان المحفظة غير صالح";
  } else if (trimmedAddress.length > 500) {
    errors.address = "عنوان المحفظة طويل جداً";
  }

  return errors;
}

// --- Deposit Validation ---

export function validateDeposit(
  currency: string,
  amount: number,
  txId: string
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!VALID_CURRENCIES.includes(currency.toUpperCase())) {
    errors.currency = "العملة غير مدعومة";
  }

  if (amount <= 0) {
    errors.amount = "المبلغ يجب أن يكون أكبر من صفر";
  }

  const trimmedTxId = txId.trim();
  if (!trimmedTxId) {
    errors.tx_id = "رقم المعاملة مطلوب";
  } else if (trimmedTxId.length > 255) {
    errors.tx_id = "رقم المعاملة طويل جداً";
  }

  return errors;
}

// --- KYC Validation ---

export function validateKYC(input: {
  fullName: string;
  documentType: string;
  documentNumber: string;
  documentUrl: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!input.fullName.trim()) {
    errors.full_name = "الاسم الكامل مطلوب";
  } else if (input.fullName.trim().length < 3) {
    errors.full_name = "الاسم الكامل قصير جداً";
  }

  const validDocTypes = ["passport", "national_id", "driving_license"];
  if (!validDocTypes.includes(input.documentType)) {
    errors.document_type = "نوع المستند غير صالح";
  }

  if (input.documentNumber.trim().length < 5) {
    errors.document_number = "رقم المستند قصير جداً";
  }

  if (!input.documentUrl) {
    errors.document_url = "يجب رفع المستند أولاً";
  }

  return errors;
}

// --- Registration Validation ---

export function validateRegistration(input: {
  email: string;
  username: string;
  password: string;
}): ValidationErrors {
  const errors: ValidationErrors = {
    ...validateEmail(input.email),
    ...validateUsername(input.username),
  };

  const passwordError = validatePassword(input.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  return errors;
}
