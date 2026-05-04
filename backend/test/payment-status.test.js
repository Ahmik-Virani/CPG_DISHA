import assert from "node:assert/strict";
import test from "node:test";

import { resolveStatusAfterHashVerification } from "../payment-status.js";

test("pending transactions remain pending until hash verification succeeds", () => {
  const decision = resolveStatusAfterHashVerification("pending", {
    hashVerified: false,
    status: "success",
  });

  assert.equal(decision.shouldPersistFinalStatus, false);
  assert.equal(decision.responseStatus, "pending");
  assert.equal(decision.persistedStatus, "pending");
  assert.equal(decision.pendingHashVerificationRetry, true);
});

test("pending transactions move to success once hash verification succeeds", () => {
  const decision = resolveStatusAfterHashVerification("pending", {
    hashVerified: true,
    status: "success",
  });

  assert.equal(decision.shouldPersistFinalStatus, true);
  assert.equal(decision.responseStatus, "success");
  assert.equal(decision.persistedStatus, "success");
  assert.equal(decision.pendingHashVerificationRetry, false);
});

test("failed transactions do not get promoted without a verified hash", () => {
  const decision = resolveStatusAfterHashVerification("failed", {
    hashVerified: false,
    status: "success",
  });

  assert.equal(decision.shouldPersistFinalStatus, false);
  assert.equal(decision.responseStatus, "failed");
  assert.equal(decision.persistedStatus, "failed");
  assert.equal(decision.pendingHashVerificationRetry, true);
});
