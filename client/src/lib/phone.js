/** Normalize to Bangladesh international form, e.g. "01730-324865" -> "+8801730324865". */
export function normalizeBDPhone(input) {
  const digits = String(input || "").replace(/\D/g, "");
  if (!digits) return "";
  let local = digits;
  if (local.startsWith("880")) local = local.slice(3);
  else if (local.startsWith("0")) local = local.slice(1);
  return `+880${local}`;
}
