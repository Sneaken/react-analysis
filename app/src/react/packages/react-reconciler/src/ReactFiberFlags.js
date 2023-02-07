/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {enableCreateEventHandleAPI} from 'shared/ReactFeatureFlags';

export type Flags = number;

// Don't change these two values. They're used by React Dev Tools.
export const NoFlags = /*                      */ 0b00000000000000000000000000;
export const PerformedWork = /*                */ 0b00000000000000000000000001;

// You can change the rest (and add more).
// 当前 fiberNode 或者子孙 fiberNode 存在"需要插入或移动的 HostComponent 或者 HostText"
export const Placement = /*                    */ 0b00000000000000000000000010;
// ClassComponent 存在更新，且定义了 componentDidMount 或者 componentDidUpdate 方法
// HostComponent(原生 Element 类型， 如 DIV, SPAN)发生属性变化
// HostText(文本元素类型) 发生内容变化
// FC 定义了 useLayoutEffect
export const Update = /*                       */ 0b00000000000000000000000100;
export const Deletion = /*                     */ 0b00000000000000000000001000;
// 有 "需要被删除的子 HostComponent 或者 子 HostText"
export const ChildDeletion = /*                */ 0b00000000000000000000010000;
// 清空 HostComponent 的文本内容
export const ContentReset = /*                 */ 0b00000000000000000000100000;
// 当 ClassComponent 中的 this.setState 执行时， 或者 ReactDOM.render 执行时传递了回调函数参数
export const Callback = /*                     */ 0b00000000000000000001000000;
export const DidCapture = /*                   */ 0b00000000000000000010000000;
export const ForceClientRender = /*            */ 0b00000000000000000100000000;
// HostComponent ref 属性的创建与更新
export const Ref = /*                          */ 0b00000000000000001000000000;
// ClassComponent 存在更新，且定义了 getSnapshotBeforeUpdate 方法
export const Snapshot = /*                     */ 0b00000000000000010000000000;
// FC 定义了 useEffect 且需要触发回调函数
export const Passive = /*                      */ 0b00000000000000100000000000;
// hydrate 相关
export const Hydrating = /*                    */ 0b00000000000001000000000000;
// 控制 SuspenseComponent 的子树与 fallback 切换时子树的显隐
export const Visibility = /*                   */ 0b00000000000010000000000000;
export const StoreConsistency = /*             */ 0b00000000000100000000000000;

export const LifecycleEffectMask =
  Passive | Update | Callback | Ref | Snapshot | StoreConsistency;

// Union of all commit flags (flags with the lifetime of a particular commit)
export const HostEffectMask = /*               */ 0b00000000000111111111111111;

// These are not really side effects, but we still reuse this field.
export const Incomplete = /*                   */ 0b00000000001000000000000000;
export const ShouldCapture = /*                */ 0b00000000010000000000000000;
export const ForceUpdateForLegacySuspense = /* */ 0b00000000100000000000000000;
export const DidPropagateContext = /*          */ 0b00000001000000000000000000;
export const NeedsPropagation = /*             */ 0b00000010000000000000000000;
export const Forked = /*                       */ 0b00000100000000000000000000;

// Static tags describe aspects of a fiber that are not specific to a render,
// e.g. a fiber uses a passive effect (even if there are no updates on this particular render).
// This enables us to defer more work in the unmount case,
// since we can defer traversing the tree during layout to look for Passive effects,
// and instead rely on the static flag as a signal that there may be cleanup work.
export const RefStatic = /*                    */ 0b00001000000000000000000000;
export const LayoutStatic = /*                 */ 0b00010000000000000000000000;
export const PassiveStatic = /*                */ 0b00100000000000000000000000;

// These flags allow us to traverse to fibers that have effects on mount
// without traversing the entire tree after every commit for
// double invoking
export const MountLayoutDev = /*               */ 0b01000000000000000000000000;
export const MountPassiveDev = /*              */ 0b10000000000000000000000000;

// Groups of flags that are used in the commit phase to skip over trees that
// don't contain effects, by checking subtreeFlags.

export const BeforeMutationMask =
  // TODO: Remove Update flag from before mutation phase by re-landing Visibility
  // flag logic (see #20043)
  Update |
  Snapshot |
  (enableCreateEventHandleAPI
    ? // createEventHandle needs to visit deleted and hidden trees to
      // fire beforeblur
      // TODO: Only need to visit Deletions during BeforeMutation phase if an
      // element is focused.
      ChildDeletion | Visibility
    : 0);

export const MutationMask =
  Placement |
  Update |
  ChildDeletion |
  ContentReset |
  Ref |
  Hydrating |
  Visibility;
export const LayoutMask = Update | Callback | Ref | Visibility;

// TODO: Split into PassiveMountMask and PassiveUnmountMask
export const PassiveMask = Passive | ChildDeletion;

// Union of tags that don't get reset on clones.
// This allows certain concepts to persist without recalculating them,
// e.g. whether a subtree contains passive effects or portals.
export const StaticMask = LayoutStatic | PassiveStatic | RefStatic;
