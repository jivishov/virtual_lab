import {initialGeometry, normalizeGeometry, evaluateGeometry, GEOMETRY_EVALUATOR_VERSION} from './geometry-chemistry.js';

export function newConstruction(task) {
  return {
    version: 1, kind: 'geometry', taskId: task.taskId, taskVersion: task.taskVersion,
    revision: 0, attempted: false, answer: initialGeometry()
  };
}

export function normalizeConstruction(raw, task) {
  if (!raw || raw.version !== 1 || raw.kind !== 'geometry' ||
      raw.taskId !== task.taskId || raw.taskVersion !== task.taskVersion ||
      !Number.isSafeInteger(raw.revision) || raw.revision < 0) return null;
  const answer = normalizeGeometry(raw.answer, task);
  if (!answer) return null;
  return {...newConstruction(task), revision: raw.revision, attempted: raw.attempted === true, answer};
}

export function changeConstruction(value, answer, attempted = true) {
  return {
    ...value, answer: structuredClone(answer), attempted,
    revision: value.revision === Number.MAX_SAFE_INTEGER ? 0 : value.revision + 1
  };
}

export function restoreConstruction(value, snapshot, undo) {
  return changeConstruction(value, {...snapshot.answer, rotation: value.answer.rotation},
    undo ? snapshot.attempted || value.attempted : snapshot.attempted);
}

export function checkedConstruction(value, task, checkedAt = Date.now()) {
  return {
    version: 1, taskId: task.taskId, taskVersion: task.taskVersion,
    evaluatorVersion: GEOMETRY_EVALUATOR_VERSION, answerRevision: value.revision, checkedAt,
    ...evaluateGeometry(value.answer, task)
  };
}

// Persist the identity of the checked revision. Always recompute its feedback.
export function restoreResult(value, saved, task) {
  if (!value.attempted || saved?.version !== 1 || saved.taskId !== task.taskId || saved.taskVersion !== task.taskVersion ||
      saved.evaluatorVersion !== GEOMETRY_EVALUATOR_VERSION || saved.answerRevision !== value.revision ||
      !Number.isFinite(saved.checkedAt)) return null;
  return checkedConstruction(value, task, saved.checkedAt);
}
