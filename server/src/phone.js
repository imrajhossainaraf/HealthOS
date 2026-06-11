// Normalize phone numbers to a canonical Bangladesh international form so
// lookups (by-phone search, alert links) match regardless of how the number
// was originally typed/stored — "01730-324865", "+880 1730 324865", and
// "8801730324865" all normalize to "+8801730324865".
export function normalizePhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  let local = digits;
  if (local.startsWith("880")) local = local.slice(3);
  else if (local.startsWith("0")) local = local.slice(1);
  return `+880${local}`;
}
