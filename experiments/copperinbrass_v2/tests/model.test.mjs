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

test('the 3D protocol produces a blank, three matching standards and an in-range unknown', () => {
  for (const random of [0.02, 0.5, 0.98]) {
    const run = new Run(() => random);
    let now = 1000;
    while (run.state.index < steps.length) {
      const s = run.state,
        before = structuredClone(s),
        action = { ...operation(s) };
      assert.equal(run.perform({ from: 'unrelated' }, now).ok, false);
      assert.deepEqual(s, before);
      if (action.action === 'waitReaction') {
        assert.equal(run.perform(action, now).ok, false);
        now += reactionTime;
      }
      if (action.action === 'cleaningChecklist') {
        assert.equal(run.perform(action).ok, false);
        s.cleanup.fill(true);
      }
      if (action.action === 'submitCalculation') {
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
    assert.equal(operation(run.state).action, 'submitCalculation');
    assert.equal(run.state.answer, null);
  }
});
test('undo restores instrument, pipette identity and reaction boundaries', () => {
  const run = new Run(() => 0.5);
  let now = 5000;
  while (operation(run.state).action !== 'cleaningChecklist') {
    const before = structuredClone(run.state),
      action = operation(run.state);
    if (action.action === 'waitReaction') now += reactionTime;
    assert.ok(run.perform(action, now).ok);
    const after = structuredClone(run.state);
    assert.ok(run.undo());
    assert.deepEqual(run.state, before);
    assert.ok(run.perform(action, now).ok);
    assert.deepEqual(run.state, after);
    if (action.action === 'measure') assert.equal(after.readings.at(-1).id, action.sample);
  }
  for (let i = 0; i < 10; i++) assert.ok(run.undo());
  assert.equal(run.undo(), false);
});

test('weighing starts the run and every solution has a dedicated pipette ready to use', () => {
  const run = new Run(() => 0.5);
  assert.equal(steps.length, 44);
  assert.ok(steps.every(step => step.action !== 'placeEquipment'));
  assert.deepEqual([operation(run.state).from, operation(run.state).to], ['brass', 'balance']);
  assert.equal(run.perform({ from: 'balance' }).ok, false);
  assert.equal(run.perform({ from: 'brass', to: 'bench' }).ok, false);
  assert.equal(run.state.index, 0);

  let now = 0;
  const roles = [];
  while (operation(run.state).action !== 'cleaningChecklist') {
    const step = operation(run.state);
    if (step.action === 'fillPipette') {
      assert.deepEqual(run.state.pipette, { role: step.role, content: null });
      roles.push(step.role);
    }
    if (step.action === 'waitReaction') now += reactionTime;
    assert.ok(run.perform(step, now).ok);
  }
  assert.deepEqual(roles, ['acid', 'copper', 'water', 'water', 'std_0.1', 'std_0.2', 'std_0.4', 'unknown']);
  assert.equal(run.state.cleanupRecorded, false);
  run.state.cleanup.fill(true);
  assert.ok(run.perform(operation(run.state)).ok);
  assert.equal(run.state.cleanupRecorded, true);
  assert.ok(run.undo());
  assert.equal(run.state.cleanupRecorded, false);
});
