import assert from 'node:assert/strict';

import {
  deriveRequestIntent,
  isConversationalBuildRequest,
} from '../src/lib/conversational-bridge/intent.ts';

const productRequests = [
  'Plan for me a small feature upgrade for mission control',
  'Plan me a feature for Mission control that allows me to change the colour theme of the website',
  'Could you propose an update to the dashboard?',
  'Scope a new automation for weekly research',
  'Build me a grocery tracker',
  'Update Mission Control with a compact mobile navigation',
];

for (const request of productRequests) {
  assert.equal(
    isConversationalBuildRequest(request),
    true,
    `Expected a product-decision route for: ${request}`,
  );
}

const ordinaryConversation = [
  'Plan my week',
  'What is the plan for Mission Control?',
  'Can you explain how colour themes work?',
  'create task: review the dashboard',
  'Please add up 10 and 15',
];

for (const request of ordinaryConversation) {
  assert.equal(
    isConversationalBuildRequest(request),
    false,
    `Expected an ordinary conversation or command route for: ${request}`,
  );
}

const themeIntent = deriveRequestIntent(productRequests[1]);
assert.equal(themeIntent.category, 'improve');
assert.match(themeIntent.projectTitle, /^Feature for Mission Control/i);
assert.doesNotMatch(themeIntent.projectTitle, /^Plan\b/i);
assert.ok(themeIntent.projectTitle.length <= 80);

console.log(`Conversational intent regression checks passed (${productRequests.length + ordinaryConversation.length} cases).`);
