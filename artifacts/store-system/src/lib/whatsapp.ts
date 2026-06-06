export function formatPhone(phone: string): string {
  let clean = phone.replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) clean = "20" + clean.slice(1);
  return clean;
}

export function openWhatsApp(phone: string, message: string) {
  const clean = formatPhone(phone);
  if (!clean) return;
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة بنكية",
  transfer: "تحويل بنكي",
  credit: "آجل",
  instapay: "انستا باي",
  vodafone_cash: "فودافون كاش",
};

export function buildInvoiceMessage(invoice: {
  invoiceNumber: string;
  total: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  paymentMethod?: string | null;
  customerName?: string | null;
  items?: Array<{ productName: string; quantity: number; unitPrice: number }>;
}): string {
  let msg = `🧾 *فاتورة رقم: ${invoice.invoiceNumber}*\n`;
  if (invoice.customerName) msg += `👤 العميل: ${invoice.customerName}\n`;
  msg += `📅 التاريخ: ${new Date().toLocaleDateString("ar-EG")}\n`;
  msg += `━━━━━━━━━━━━━━━\n`;

  if (invoice.items?.length) {
    for (const item of invoice.items) {
      msg += `• ${item.productName} × ${item.quantity} = ${(item.quantity * item.unitPrice).toFixed(2)} ج.م\n`;
    }
    msg += `━━━━━━━━━━━━━━━\n`;
  }

  if (invoice.discount && invoice.discount > 0)
    msg += `🏷️ خصم: -${Number(invoice.discount).toFixed(2)} ج.م\n`;
  if (invoice.tax && invoice.tax > 0)
    msg += `📊 ضريبة: +${Number(invoice.tax).toFixed(2)} ج.م\n`;

  msg += `\n💰 *الإجمالي: ${Number(invoice.total).toFixed(2)} ج.م*\n`;
  if (invoice.paymentMethod)
    msg += `💵 طريقة الدفع: ${PAYMENT_LABELS[invoice.paymentMethod] ?? invoice.paymentMethod}\n`;

  msg += `\nشكراً لتعاملكم معنا 🙏`;
  return msg;
}

export function buildCustomMessage(customerName: string, message: string): string {
  return `السلام عليكم ${customerName} 👋\n\n${message}`;
}
