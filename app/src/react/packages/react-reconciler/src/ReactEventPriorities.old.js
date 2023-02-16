/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Lane, Lanes} from './ReactFiberLane.old';
import {
  DefaultLane,
  getHighestPriorityLane,
  IdleLane,
  includesNonIdleWork,
  InputContinuousLane,
  NoLane,
  SyncLane,
} from './ReactFiberLane.old';

// 这些都是事件的优先级，不是调度的优先级
export opaque type EventPriority = Lane;

// 离散事件的优先级, 例如 click, input, focus, blur, touchstart
export const DiscreteEventPriority: EventPriority = SyncLane;
// 连续事件的优先级, 例如 drag, mousemove, scroll, touchmove, wheel
export const ContinuousEventPriority: EventPriority = InputContinuousLane;
// 默认事件的优先级, 例如通过计时器周期性触发更新，这种情况产生的 update 不属于 "交互产生的 update", 所以优先级是默认的优先级
export const DefaultEventPriority: EventPriority = DefaultLane;
// 空闲事件的优先级
export const IdleEventPriority: EventPriority = IdleLane;

let currentUpdatePriority: EventPriority = NoLane;

/**
 * 获取当前事件的优先级
 * @return {EventPriority}
 */
export function getCurrentUpdatePriority(): EventPriority {
  return currentUpdatePriority;
}

/**
 * 设置当前更新的优先级
 * @param {EventPriority} newPriority
 */
export function setCurrentUpdatePriority(newPriority: EventPriority) {
  currentUpdatePriority = newPriority;
}

export function runWithPriority<T>(priority: EventPriority, fn: () => T): T {
  const previousPriority = currentUpdatePriority;
  try {
    currentUpdatePriority = priority;
    return fn();
  } finally {
    currentUpdatePriority = previousPriority;
  }
}

export function higherEventPriority(
  a: EventPriority,
  b: EventPriority,
): EventPriority {
  return a !== 0 && a < b ? a : b;
}

export function lowerEventPriority(
  a: EventPriority,
  b: EventPriority,
): EventPriority {
  return a === 0 || a > b ? a : b;
}

export function isHigherEventPriority(
  a: EventPriority,
  b: EventPriority,
): boolean {
  return a !== 0 && a < b;
}

/**
 * 将 lanes 转换成 EventPriority
 * @param lanes
 * @return {EventPriority}
 */
export function lanesToEventPriority(lanes: Lanes): EventPriority {
  // 获取 lanes 中优先级最高的 lane
  const lane = getHighestPriorityLane(lanes);
  // 如果优先级高于 DiscreteEventPriority, 返回 DiscreteEventPriority
  if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
    return DiscreteEventPriority;
  }
  // 如果优先级高于 ContinuousEventPriority, 返回 ContinuousEventPriority
  if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
    return ContinuousEventPriority;
  }
  // 如果包含 "非idle的任务" 返回 DefaultEventPriority
  if (includesNonIdleWork(lane)) {
    return DefaultEventPriority;
  }
  // 最后返回 IdleEventPriority
  return IdleEventPriority;
}
