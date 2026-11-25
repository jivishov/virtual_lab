import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Run,
  answerFromReadings,
  concentrations,
  fitStandards,
  operation,
  reactionTime,
  steps,
} from '../src/model.js';

test('the sixty source operations produce a blank, three matching standards and an in-range unknown', () => {
  for (const random of [0.02, 0.5, 0.98]) {
    const run = new Run(() => random);
    let now = 1000;
    while (run.state.index < steps.length) {
      const s = run.state,
        before = structuredClone(s),
        action = operation(s);
      assert.equal(run.perform({ from: 'unrelated' }, now).ok, false);
      assert.deepEqual(s, before);
      if (s.index === 11) {
        assert.equal(run.perform(action, now).ok, false);
        now += reactionTime;
      }
      if (s.index === 58) {
        assert.equal(run.perform(action).ok, false);
        s.cleanup.fill(true);
      }
      if (s.index === 59) {
        for (const answer of ['', null, NaN, 'wrong', 50])
          assert.equal(run.perform({ ...action, answer }).ok, false);
        action.answer = answerFromReadings(s).toFixed(2);
      }
      assert.equal(run.perform(action, now).ok, true, JSON.stringify(before.index));
    }
    const s = run.state,
      fit = fitStandards(s.readings);
    assert.deepEqual(
      s.readings.map((r) => r.id),
      Object.keys(concentrations).concat('unknown')
    );
    assert.equal(s.readings[0].absorbance, 0);
    assert.ok(Math.abs(fit.slope - 2.426) < 0.01);
    const c = (s.readings.at(-1).absorbance - fit.intercept) / fit.slope;
    assert.ok(c > 0.1 && c < 0.2);
    assert.ok(Math.abs((100 * c * 0.1 * 63.55) / s.mass - s.answer) < 2);
    assert.ok(Math.abs(s.answer - 70) < 2);
    assert.equal(run.undo(), true);
    assert.equal(run.state.index, 59);
    assert.equal(run.state.answer, null);
  }
});
test('undo restores instrument, pipette identity and reaction boundaries', () => {
  const run = new Run(() => 0.5);
  let now = 5000;
  while (run.state.index < 57) {
    const i = run.state.index,
      before = structuredClone(run.state);
    if (i === 11) now += reactionTime;
    const action = operation(run.state);
    assert.ok(run.perform(action, now).ok);
    const after = structuredClone(run.state);
    assert.ok(run.undo());
    assert.deepEqual(run.state, before);
    assert.ok(run.perform(action, now).ok);
    assert.deepEqual(run.state, after);
    if (i === 35) assert.equal(after.readings.at(-1).id, 'std_0.1');
  }
  for (let i = 0; i < 10; i++) assert.ok(run.undo());
  assert.equal(run.undo(), false);
});
