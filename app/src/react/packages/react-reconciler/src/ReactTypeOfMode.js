/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export type TypeOfMode = number;

export const NoMode = /*                         */ 0b000000;
/* 并发模式 */
// TODO: Remove ConcurrentMode by reading from the root tag instead
export const ConcurrentMode = /*                 */ 0b000001;
/* 性能分析模式 */
export const ProfileMode = /*                    */ 0b000010;
// 调试模式
export const DebugTracingMode = /*               */ 0b000100;
// StrictMode
export const StrictLegacyMode = /*               */ 0b001000;
// StrictMode && enableStrictEffects
export const StrictEffectsMode = /*              */ 0b010000;
// 并发模式下 lane 使用被赋予的 lane 模式
export const ConcurrentUpdatesByDefaultMode = /* */ 0b100000;
