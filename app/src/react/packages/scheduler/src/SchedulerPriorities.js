/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export type PriorityLevel = 0 | 1 | 2 | 3 | 4 | 5;

// TODO: Use symbols?
export const NoPriority = 0;
// 最高优先级 表示需要立即执行的任务，例如用户输入、响应手势等。
export const ImmediatePriority = 1;
// 表示需要立即执行，并且要阻止用户交互等待的任务，例如动画、切换、滚动等。
export const UserBlockingPriority = 2;
// 默认优先级，用于大部分任务。
export const NormalPriority = 3;
// 较低的优先级，用于不太紧急的任务
export const LowPriority = 4;
// 最低的优先级，用于不需要立即执行的任务，例如在空闲时间进行预加载等。
export const IdlePriority = 5;
