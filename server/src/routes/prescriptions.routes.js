// Prescriptions — emailing a medicine schedule to the patient. The prescription
// records themselves live in the per-user document store (healthos:prescriptions),
// synced from the client; this route only handles sending the schedule by email.
import { Router } from "express";
import { requireAuth } from "../auth.js";
import { validate, prescriptionEmailSchema } from "../validation.js";
import { sendPrescriptionEmail } from "../email.js";

export const prescriptionsRouter = Router();
prescriptionsRouter.use(requireAuth);

// POST /api/prescriptions/email — email a prescription schedule to the signed-in
// user (or an optional `to` address).
prescriptionsRouter.post("/email", validate(prescriptionEmailSchema), async (req, res, next) => {
  try {
    const to = req.valid.to || req.user.email;
    if (!to) return res.status(400).json({ error: "No recipient email on your account" });
    const result = await sendPrescriptionEmail(to, req.valid.prescription, { patientName: req.user.name });
    if (!result.sent) return res.status(502).json({ error: "Email could not be sent" });
    res.json({ sent: true, to });
  } catch (err) {
    next(err);
  }
});
