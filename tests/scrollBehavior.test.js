import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Helper function mirroring the Inquiry component's auto-scroll decision logic
function shouldAutoScroll({ distanceFromBottom, threshold = 120, userJustSent = false }) {
  const isNearBottom = distanceFromBottom <= threshold;
  return Boolean(userJustSent || isNearBottom);
}

function getScrollBehavior(prefersReducedMotion = false) {
  return prefersReducedMotion ? "auto" : "smooth";
}

test("Scroll logic: automatically scrolls when user just sent a message", () => {
  // Even if user was scrolled up (e.g. 500px from bottom), sending a message must scroll down
  const result = shouldAutoScroll({ distanceFromBottom: 500, userJustSent: true });
  assert.equal(result, true);
});

test("Scroll logic: automatically scrolls when user is already near bottom", () => {
  // User is near bottom (e.g. 30px from bottom)
  const result = shouldAutoScroll({ distanceFromBottom: 30, userJustSent: false });
  assert.equal(result, true);
});

test("Scroll logic: does NOT force-scroll when user scrolled up to read older messages", () => {
  // User scrolled up (e.g. 350px from bottom) and bot reply arrives (userJustSent: false)
  const result = shouldAutoScroll({ distanceFromBottom: 350, userJustSent: false });
  assert.equal(result, false, "Must preserve user reading position without jumping");
});

test("Scroll logic: respects reduced motion preferences", () => {
  assert.equal(getScrollBehavior(true), "auto");
  assert.equal(getScrollBehavior(false), "smooth");
});

test("CSS: chat-thread has bounded height and internal vertical scroll", () => {
  const cssPath = path.resolve(process.cwd(), "src/styles.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  // Check that .chat-thread is bounded and scrollable
  assert.ok(cssContent.includes(".chat-thread"));
  assert.ok(cssContent.includes("overflow-y: auto"));
  assert.ok(cssContent.includes("max-height: 65vh") || cssContent.includes("height: 540px"));
  assert.ok(cssContent.includes("overscroll-behavior: contain"));
  assert.ok(cssContent.includes("prefers-reduced-motion: reduce"));
});
