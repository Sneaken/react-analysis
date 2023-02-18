/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export type EventSystemFlags = number;

// 表示 React 事件处理逻辑中，某些节点不应该被 React 所管理。
// 具体来说，它用于以下场景：
// - 当事件处理程序挂载到了文档上的某个非 React 管理的节点上，比如说一个第三方库的 DOM 节点。
// - 当事件处理程序挂载到了某个 React 组件的 DOM 子树之外的节点上，也就是所谓的 portal。
// 对于这些节点，React 不会将它们纳入到事件委托机制的范围中，因此事件处理程序必须自行处理事件。
// 如果没有处理好，可能会导致事件处理冲突或者其他问题。
export const IS_EVENT_HANDLE_NON_MANAGED_NODE = 1;
// 事件是否非委托
export const IS_NON_DELEGATED = 1 << 1; // 2
// 事件是否处于捕获阶段
export const IS_CAPTURE_PHASE = 1 << 2; // 4
// 事件是否使用 passive 模式
export const IS_PASSIVE = 1 << 3; // 8
// 事件是否处于 FB 支持模式
export const IS_LEGACY_FB_SUPPORT_MODE = 1 << 4; // 16
// 判断在 FB 支持模式下，是否不应该延迟点击事件的处理
export const SHOULD_NOT_DEFER_CLICK_FOR_FB_SUPPORT_MODE =
  IS_LEGACY_FB_SUPPORT_MODE | IS_CAPTURE_PHASE; // 20

// We do not want to defer if the event system has already been
// set to LEGACY_FB_SUPPORT. LEGACY_FB_SUPPORT only gets set when
// we call willDeferLaterForLegacyFBSupport, thus not bailing out
// will result in endless cycles like an infinite loop.
// We also don't want to defer during event replaying.
// 不应该处理 polyfill 类型的事件插件
export const SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS =
  IS_EVENT_HANDLE_NON_MANAGED_NODE | IS_NON_DELEGATED | IS_CAPTURE_PHASE; // 7
