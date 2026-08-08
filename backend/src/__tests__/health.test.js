// Simple pure-function tests that don't require DB/Redis connections,
// so they run cleanly inside a Jenkins agent without external services.

function isValidStatus(status) {
  return ['todo', 'in_progress', 'done'].includes(status);
}

describe('task status validation', () => {
  test('accepts valid statuses', () => {
    expect(isValidStatus('todo')).toBe(true);
    expect(isValidStatus('in_progress')).toBe(true);
    expect(isValidStatus('done')).toBe(true);
  });

  test('rejects invalid statuses', () => {
    expect(isValidStatus('archived')).toBe(false);
    expect(isValidStatus('')).toBe(false);
  });
});
