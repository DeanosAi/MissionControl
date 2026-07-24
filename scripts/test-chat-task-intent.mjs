import assert from 'node:assert/strict';

import {
  detectTaskIntent,
  parseTaskStatus,
} from '../src/lib/task-command-intent.ts';

const cases = [
  ['create task: Review the dashboard', { type: 'create', title: 'Review the dashboard' }],
  ['Create a task called "Prepare weekly report"', { type: 'create', title: 'Prepare weekly report' }],
  ['Please add a task to check provider health.', { type: 'create', title: 'check provider health' }],
  ['Could you new task: Test mobile approvals?', { type: 'create', title: 'Test mobile approvals' }],
  ['list tasks', { type: 'list' }],
  ['Please show all current tasks?', { type: 'list' }],
  ['run task: Review the dashboard', { type: 'run', taskRef: 'Review the dashboard' }],
  ['Execute the task Prepare weekly report', { type: 'run', taskRef: 'Prepare weekly report' }],
  ['move task "Review the dashboard" to in progress', { type: 'status', taskRef: 'Review the dashboard', newStatus: 'in-progress' }],
  ['change the task Prepare weekly report status to done', { type: 'status', taskRef: 'Prepare weekly report', newStatus: 'done' }],
  ['show task: Review the dashboard', { type: 'show', taskRef: 'Review the dashboard' }],
  ['What is the status of the task Prepare weekly report?', { type: 'show', taskRef: 'Prepare weekly report' }],
];

for (const [message, expected] of cases) {
  assert.deepEqual(detectTaskIntent(message), expected, `Unexpected task command parse for: ${message}`);
}

const nonCommands = [
  'Create a task management app for the content team',
  'Start planning a feature upgrade for Mission Control',
  'Execute a product strategy review',
  'Show memory',
  'Show the Mission Control project',
  'Change task management page design',
  'Add task management to Mission Control',
  'What can tasks do?',
];

for (const message of nonCommands) {
  assert.equal(detectTaskIntent(message), null, `Expected no explicit task command for: ${message}`);
}

assert.equal(parseTaskStatus('to-do'), 'backlog');
assert.equal(parseTaskStatus('In Progress'), 'in-progress');
assert.equal(parseTaskStatus('complete'), 'done');
assert.equal(parseTaskStatus('unknown'), null);

console.log(`Chat task intent regression checks passed (${cases.length + nonCommands.length + 4} cases).`);
