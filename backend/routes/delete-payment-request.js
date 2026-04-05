import { Router } from "express";
import {
  findRecurringPaymentRequestById,
  findFixedPaymentRequestById,
  findOneTimePaymentRequestById,
  deleteRecurringPaymentRequestById,
  deleteFixedPaymentRequestById,
  deleteOneTimePaymentRequestById,
} from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.delete(
  "/recurring-payment-requests/:paymentRequestId",
  requireAuth,
  requireRole("system_head"),
  async (req, res) => {
    const paymentRequestId = String(req.params?.paymentRequestId || "").trim();
    const systemHeadId = req.auth.sub;

    const paymentRequest = await findRecurringPaymentRequestById(paymentRequestId);
    if (!paymentRequest) {
      return res.status(404).json({ message: "Recurring payment request not found" });
    }

    if (paymentRequest.createdBySystemHeadId !== systemHeadId) {
      return res.status(403).json({ message: "Forbidden: Cannot delete payment request created by another system head" });
    }

    const deleted = await deleteRecurringPaymentRequestById(paymentRequestId);
    if (deleted) {
      console.log(`[Delete Payment] Deleted recurring payment request ${paymentRequestId} - no more recurring charges will be created`);
      return res.json({ message: "Recurring payment request deleted successfully. No further recurring charges will be created." });
    } else {
      return res.status(500).json({ message: "Failed to delete recurring payment request" });
    }
  }
);

router.delete(
  "/fixed-payment-requests/:paymentRequestId",
  requireAuth,
  requireRole("system_head"),
  async (req, res) => {
    const paymentRequestId = String(req.params?.paymentRequestId || "").trim();
    const systemHeadId = req.auth.sub;

    const paymentRequest = await findFixedPaymentRequestById(paymentRequestId);
    if (!paymentRequest) {
      return res.status(404).json({ message: "Fixed payment request not found" });
    }

    if (paymentRequest.createdBySystemHeadId !== systemHeadId) {
      return res.status(403).json({ message: "Forbidden: Cannot delete payment request created by another system head" });
    }

    const deleted = await deleteFixedPaymentRequestById(paymentRequestId);
    if (deleted) {
      console.log(`[Delete Payment] Deleted fixed payment request ${paymentRequestId}`);
      return res.json({ message: "Fixed payment request deleted successfully." });
    } else {
      return res.status(500).json({ message: "Failed to delete fixed payment request" });
    }
  }
);

router.delete(
  "/one-time-payment-requests/:paymentRequestId",
  requireAuth,
  requireRole("system_head"),
  async (req, res) => {
    const paymentRequestId = String(req.params?.paymentRequestId || "").trim();
    const systemHeadId = req.auth.sub;

    const paymentRequest = await findOneTimePaymentRequestById(paymentRequestId);
    if (!paymentRequest) {
      return res.status(404).json({ message: "One-time payment request not found" });
    }

    if (paymentRequest.createdBySystemHeadId !== systemHeadId) {
      return res.status(403).json({ message: "Forbidden: Cannot delete payment request created by another system head" });
    }

    const deleted = await deleteOneTimePaymentRequestById(paymentRequestId);
    if (deleted) {
      console.log(`[Delete Payment] Deleted one-time payment request ${paymentRequestId}`);
      return res.json({ message: "One-time payment request deleted successfully." });
    } else {
      return res.status(500).json({ message: "Failed to delete one-time payment request" });
    }
  }
);

export default router;
