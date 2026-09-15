import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const profile = JSON.parse(
  readFileSync(new URL('../src/assets/group-flush.json', import.meta.url), 'utf8')
);

const nodes = profile.stages.flatMap((stage) =>
  stage.nodes.map((node) => ({ ...node, stage: stage.name }))
);
const nodeById = new Map(nodes.map((node) => [node.id, node]));

test('Group Flush is a connected node profile with reserved endpoints', () => {
  assert.equal(profile.profile_type, 'cleaning');
  assert.equal(profile.temperature, 65);
  assert.equal(profile.workflow, undefined);
  assert.equal(profile.final_weight, undefined);
  assert.deepEqual(
    profile.stages.map((stage) => stage.name),
    [
      'heating',
      'click to start',
      'home',
      'purge',
      'finished',
      'cleaning failed',
      'END_STAGE'
    ]
  );

  assert.equal(nodeById.size, nodes.length, 'node IDs must be unique');
  assert(nodeById.has(-1), 'start node is required');
  assert(nodeById.has(-2), 'end node is required');

  for (const node of nodes) {
    for (const trigger of node.triggers) {
      if ('next_node_id' in trigger) {
        assert(
          nodeById.has(trigger.next_node_id),
          `node ${node.id} points to missing node ${trigger.next_node_id}`
        );
      }
    }
  }
});

test('heating cannot be skipped and waits for both water and 65C', () => {
  const buttonTriggers = nodes.flatMap((node) =>
    node.triggers
      .filter((trigger) => trigger.kind === 'button_trigger')
      .map((trigger) => ({ node, trigger }))
  );

  assert.equal(buttonTriggers.length, 1);
  assert.equal(buttonTriggers[0].node.stage, 'click to start');
  assert.equal(buttonTriggers[0].trigger.source, 'Encoder Button');
  assert.equal(buttonTriggers[0].trigger.gesture, 'Single Tap');
  assert.equal(buttonTriggers[0].trigger.next_node_id, 30);

  const heatingNode = nodeById.get(10);
  assert.equal(heatingNode.stage, 'heating');
  assert.deepEqual(heatingNode.controllers[0], {
    kind: 'temperature_controller',
    algorithm: 'Water Temperature PID v1.0',
    curve: {
      id: 2,
      interpolation_kind: 'linear_interpolation',
      points: [[0, 65]],
      reference: { kind: 'time', id: 2 }
    }
  });
  assert(
    heatingNode.triggers.some(
      (trigger) =>
        trigger.kind === 'temperature_value_trigger' &&
        trigger.source === 'Water Temperature' &&
        trigger.operator === '>=' &&
        trigger.value === 65 &&
        trigger.next_node_id === 20
    )
  );
  assert(
    nodes.some((node) =>
      node.triggers.some(
        (trigger) =>
          trigger.kind === 'water_detection_trigger' &&
          trigger.value === true &&
          trigger.next_node_id === 10
      )
    )
  );
});

test('Raise and Purge retain the existing machine controller parameters', () => {
  assert.deepEqual(nodeById.get(31).controllers, [
    {
      kind: 'move_piston_controller',
      algorithm: 'Piston Ease-In',
      direction: 'UP',
      speed: 6
    }
  ]);

  assert.deepEqual(nodeById.get(40).controllers, [
    { kind: 'time_reference', id: 40 },
    {
      kind: 'move_piston_controller',
      algorithm: 'Piston Fast',
      direction: 'DOWN',
      speed: 6
    }
  ]);
  assert.deepEqual(nodeById.get(45).controllers, [
    {
      kind: 'move_piston_controller',
      algorithm: 'Piston Ease-In',
      direction: 'DOWN',
      speed: 6
    }
  ]);
  assert.equal(nodeById.get(42).controllers[0].curve.points[0][1], 6);
});

test('all long-running phases fail closed through the failure node', () => {
  assert.equal(nodeById.get(90).stage, 'cleaning failed');

  for (const nodeId of [2, 10, 20, 32, 42, 45, 46, 48]) {
    assert(
      nodeById
        .get(nodeId)
        .triggers.some(
          (trigger) =>
            trigger.kind === 'timer_trigger' && trigger.next_node_id === 90
        ),
      `node ${nodeId} requires a timeout to the failure node`
    );
  }
});
