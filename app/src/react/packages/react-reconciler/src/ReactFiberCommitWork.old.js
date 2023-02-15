/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  ChildSet,
  Container,
  Instance,
  SuspenseInstance,
  TextInstance,
  UpdatePayload,
} from './ReactFiberHostConfig';
import {
  appendChild,
  appendChildToContainer,
  beforeActiveInstanceBlur,
  clearContainer,
  clearSuspenseBoundary,
  clearSuspenseBoundaryFromContainer,
  commitHydratedContainer,
  commitHydratedSuspenseInstance,
  commitMount,
  commitTextUpdate,
  commitUpdate,
  createContainerChildSet,
  detachDeletedInstance,
  getPublicInstance,
  hideInstance,
  hideTextInstance,
  insertBefore,
  insertInContainerBefore,
  prepareForCommit,
  prepareScopeUpdate,
  removeChild,
  removeChildFromContainer,
  replaceContainerChildren,
  resetTextContent,
  supportsHydration,
  supportsMutation,
  supportsPersistence,
  unhideInstance,
  unhideTextInstance,
} from './ReactFiberHostConfig';
import type {Fiber, FiberRoot} from './ReactInternalTypes';
import type {Lanes} from './ReactFiberLane.old';
import {clearTransitionsForLanes} from './ReactFiberLane.old';
import type {SuspenseState} from './ReactFiberSuspenseComponent.old';
import type {UpdateQueue} from './ReactFiberClassUpdateQueue.old';
import {commitUpdateQueue} from './ReactFiberClassUpdateQueue.old';
import type {FunctionComponentUpdateQueue} from './ReactFiberHooks.old';
import type {Wakeable} from 'shared/ReactTypes';
import type {
  OffscreenInstance,
  OffscreenState,
} from './ReactFiberOffscreenComponent';
import type {HookFlags} from './ReactHookEffectTags';
import {
  HasEffect as HookHasEffect,
  Insertion as HookInsertion,
  Layout as HookLayout,
  NoFlags as NoHookEffect,
  Passive as HookPassive,
} from './ReactHookEffectTags';
import type {Cache} from './ReactFiberCacheComponent.old';
import {releaseCache, retainCache} from './ReactFiberCacheComponent.old';
import type {RootState} from './ReactFiberRoot.old';
import type {Transition} from './ReactFiberTracingMarkerComponent.old';

import {
  deletedTreeCleanUpLevel,
  enableCache,
  enableCreateEventHandleAPI,
  enableProfilerCommitHooks,
  enableProfilerNestedUpdatePhase,
  enableProfilerTimer,
  enableSchedulingProfiler,
  enableScopeAPI,
  enableStrictEffects,
  enableSuspenseCallback,
  enableSuspenseLayoutEffectSemantics,
  enableTransitionTracing,
  enableUpdaterTracking,
} from 'shared/ReactFeatureFlags';
import {
  CacheComponent,
  ClassComponent,
  DehydratedFragment,
  ForwardRef,
  FunctionComponent,
  HostComponent,
  HostPortal,
  HostRoot,
  HostText,
  IncompleteClassComponent,
  LegacyHiddenComponent,
  MemoComponent,
  OffscreenComponent,
  Profiler,
  ScopeComponent,
  SimpleMemoComponent,
  SuspenseComponent,
  SuspenseListComponent,
  TracingMarkerComponent,
} from './ReactWorkTags';
import {
  BeforeMutationMask,
  ChildDeletion,
  ContentReset,
  Hydrating,
  LayoutMask,
  MutationMask,
  NoFlags,
  Passive,
  PassiveMask,
  Placement,
  Ref,
  Snapshot,
  Update,
  Visibility,
} from './ReactFiberFlags';
import getComponentNameFromFiber from 'react-reconciler/src/getComponentNameFromFiber';
import {
  getCurrentFiber as getCurrentDebugFiberInDEV,
  resetCurrentFiber as resetCurrentDebugFiberInDEV,
  setCurrentFiber as setCurrentDebugFiberInDEV,
} from './ReactCurrentFiber';
import {resolveDefaultProps} from './ReactFiberLazyComponent.old';
import {
  getCommitTime,
  isCurrentUpdateNested,
  recordLayoutEffectDuration,
  recordPassiveEffectDuration,
  startLayoutEffectTimer,
  startPassiveEffectTimer,
} from './ReactProfilerTimer.old';
import {ConcurrentMode, NoMode, ProfileMode} from './ReactTypeOfMode';
import {
  addTransitionCompleteCallbackToPendingTransition,
  addTransitionStartCallbackToPendingTransition,
  captureCommitPhaseError,
  enqueuePendingPassiveProfilerEffect,
  markCommitTimeOfFallback,
  resolveRetryWakeable,
  restorePendingUpdaters,
  setIsRunningInsertionEffect,
} from './ReactFiberWorkLoop.old';
import {didWarnAboutReassigningProps} from './ReactFiberBeginWork.old';
import {doesFiberContain} from './ReactFiberTreeReflection';
import {clearCaughtError, invokeGuardedCallback} from 'shared/ReactErrorUtils';
import {
  isDevToolsPresent,
  markComponentLayoutEffectMountStarted,
  markComponentLayoutEffectMountStopped,
  markComponentLayoutEffectUnmountStarted,
  markComponentLayoutEffectUnmountStopped,
  markComponentPassiveEffectMountStarted,
  markComponentPassiveEffectMountStopped,
  markComponentPassiveEffectUnmountStarted,
  markComponentPassiveEffectUnmountStopped,
  onCommitUnmount,
} from './ReactFiberDevToolsHook.old';

let didWarnAboutUndefinedSnapshotBeforeUpdate: Set<mixed> | null = null;
if (__DEV__) {
  didWarnAboutUndefinedSnapshotBeforeUpdate = new Set();
}

// Used during the commit phase to track the state of the Offscreen component stack.
// Allows us to avoid traversing the return path to find the nearest Offscreen ancestor.
// Only used when enableSuspenseLayoutEffectSemantics is enabled.
// 记录了是否隐藏了在屏幕外的子树
let offscreenSubtreeIsHidden: boolean = false;
let offscreenSubtreeWasHidden: boolean = false;

const PossiblyWeakSet = typeof WeakSet === 'function' ? WeakSet : Set;

// 下一个要被处理的fiber, 用于管理 effect
let nextEffect: Fiber | null = null;

// Used for Profiling builds to track updaters.
// 当前正在渲染的 rootFiber 对应的 lanes
let inProgressLanes: Lanes | null = null;
// 当前正在渲染的 rootFiber
let inProgressRoot: FiberRoot | null = null;

export function reportUncaughtErrorInDEV(error: mixed) {
  // Wrapping each small part of the commit phase into a guarded
  // callback is a bit too slow (https://github.com/facebook/react/pull/21666).
  // But we rely on it to surface errors to DEV tools like overlays
  // (https://github.com/facebook/react/issues/21712).
  // As a compromise, rethrow only caught errors in a guard.
  if (__DEV__) {
    invokeGuardedCallback(null, () => {
      throw error;
    });
    clearCaughtError();
  }
}

const callComponentWillUnmountWithTimer = function (current, instance) {
  instance.props = current.memoizedProps;
  instance.state = current.memoizedState;
  if (
    enableProfilerTimer &&
    enableProfilerCommitHooks &&
    current.mode & ProfileMode
  ) {
    try {
      startLayoutEffectTimer();
      instance.componentWillUnmount();
    } finally {
      recordLayoutEffectDuration(current);
    }
  } else {
    instance.componentWillUnmount();
  }
};

// Capture errors so they don't interrupt mounting.
function safelyCallCommitHookLayoutEffectListMount(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
) {
  try {
    commitHookEffectListMount(HookLayout, current);
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

// Capture errors so they don't interrupt unmounting.
function safelyCallComponentWillUnmount(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  instance: any,
) {
  try {
    callComponentWillUnmountWithTimer(current, instance);
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

// Capture errors so they don't interrupt mounting.
function safelyCallComponentDidMount(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  instance: any,
) {
  try {
    instance.componentDidMount();
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

// Capture errors so they don't interrupt mounting.
function safelyAttachRef(current: Fiber, nearestMountedAncestor: Fiber | null) {
  try {
    commitAttachRef(current);
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

/**
 * 安全地卸载 ref
 * 如果是 createRef 或者是 useRef 的 ref 就直接将 ref.current 设置为 null
 * 如果是 useCallbackRef 就会执行 ref(null)
 * @param current
 * @param nearestMountedAncestor
 */
function safelyDetachRef(current: Fiber, nearestMountedAncestor: Fiber | null) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === 'function') {
      let retVal;
      try {
        if (
          enableProfilerTimer &&
          enableProfilerCommitHooks &&
          current.mode & ProfileMode
        ) {
          try {
            startLayoutEffectTimer();
            retVal = ref(null);
          } finally {
            recordLayoutEffectDuration(current);
          }
        } else {
          retVal = ref(null);
        }
      } catch (error) {
        captureCommitPhaseError(current, nearestMountedAncestor, error);
      }
      if (__DEV__) {
        if (typeof retVal === 'function') {
          console.error(
            'Unexpected return value from a callback ref in %s. ' +
              'A callback ref should not return a function.',
            getComponentNameFromFiber(current),
          );
        }
      }
    } else {
      ref.current = null;
    }
  }
}

/**
 * 安全地执行 destroy 函数
 * @param current
 * @param nearestMountedAncestor
 * @param destroy
 */
function safelyCallDestroy(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
  destroy: () => void,
) {
  try {
    destroy();
  } catch (error) {
    captureCommitPhaseError(current, nearestMountedAncestor, error);
  }
}

// 管理 焦点处理
let focusedInstanceHandle: null | Fiber = null;
// 失去焦点后是否要触发某个事件
let shouldFireAfterActiveInstanceBlur: boolean = false;

/**
 * 也是按照 dfs 顺序遍历
 * 整个过程主要处理如下两种类型的 fiberNode
 * 1. ClassComponent: 执行 getSnapshotBeforeUpdate 方法
 * 2. HostRoot：清空 HostRoot 挂载的内容，方便 Mutation 阶段渲染。
 * @param root
 * @param firstChild
 * @return {boolean}
 */
export function commitBeforeMutationEffects(
  root: FiberRoot,
  firstChild: Fiber,
) {
  focusedInstanceHandle = prepareForCommit(root.containerInfo);

  nextEffect = firstChild;
  commitBeforeMutationEffects_begin();

  // We no longer need to track the active instance fiber
  const shouldFire = shouldFireAfterActiveInstanceBlur;
  shouldFireAfterActiveInstanceBlur = false;
  focusedInstanceHandle = null;

  return shouldFire;
}

/**
 * 遍历 nextEffect 直到 deletions 全部执行完 commitBeforeMutationEffects_complete
 */
function commitBeforeMutationEffects_begin() {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    // This phase is only used for beforeActiveInstanceBlur.
    // Let's skip the whole loop if it's off.
    if (enableCreateEventHandleAPI) {
      // TODO: Should wrap this in flags check, too, as optimization
      const deletions = fiber.deletions;
      if (deletions !== null) {
        for (let i = 0; i < deletions.length; i++) {
          const deletion = deletions[i];
          commitBeforeMutationEffectsDeletion(deletion);
        }
      }
    }

    const child = fiber.child;
    // 如果这个 fiber 的子孙节点中存在 BeforeMutationMask(Update|Snapshot) 这些 flags 就一直向下遍历
    if (
      (fiber.subtreeFlags & BeforeMutationMask) !== NoFlags &&
      child !== null
    ) {
      child.return = fiber; // 为什么又要设置一遍父级节点?
      // 当 subTree 存在 BeforeMutationMask, 并且存在 child 的时候，交给 child 继续遍历
      nextEffect = child;
    } else {
      // 不存在 child 或者 这个 fiber 包含这些标记（上轮遍历子孙节点存在 BeforeMutationMask，但是现在孙节点不存在，那肯定就是子节点存在了）
      commitBeforeMutationEffects_complete();
      // 执行完 此时 nextEffect 是 兄弟节点 继续遍历
    }
  }
}

/**
 * 迭代执行 commitBeforeMutationEffectsOnFiber，直到存在兄弟节点
 */
function commitBeforeMutationEffects_complete() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    setCurrentDebugFiberInDEV(fiber);
    try {
      commitBeforeMutationEffectsOnFiber(fiber);
    } catch (error) {
      captureCommitPhaseError(fiber, fiber.return, error);
    }
    resetCurrentDebugFiberInDEV();

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      // 交给兄弟节点，继续走 commitBeforeMutationEffects_begin
      nextEffect = sibling;
      return;
    }

    // 不存在兄弟节点，就往上遍历父级
    nextEffect = fiber.return;
  }
}

/**
 * BeforeMutation 阶段的主要工作
 * 整个过程主要处理如下两种类型的 fiberNode
 * 1. ClassComponent: 执行 getSnapshotBeforeUpdate 方法
 * 2. HostRoot：清空 HostRoot 挂载的内容，方便 Mutation 阶段渲染。
 * @param {Fiber} finishedWork
 */
function commitBeforeMutationEffectsOnFiber(finishedWork: Fiber) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  if (enableCreateEventHandleAPI) {
    if (!shouldFireAfterActiveInstanceBlur && focusedInstanceHandle !== null) {
      // Check to see if the focused element was inside of a hidden (Suspense) subtree.
      // TODO: Move this out of the hot path using a dedicated effect tag.
      if (
        finishedWork.tag === SuspenseComponent &&
        isSuspenseBoundaryBeingHidden(current, finishedWork) &&
        doesFiberContain(finishedWork, focusedInstanceHandle)
      ) {
        shouldFireAfterActiveInstanceBlur = true;
        beforeActiveInstanceBlur(finishedWork);
      }
    }
  }

  if ((flags & Snapshot) !== NoFlags) {
    // 如果 ClassComponent | HostRoot 存在更新
    setCurrentDebugFiberInDEV(finishedWork);

    switch (finishedWork.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        break;
      }
      case ClassComponent: {
        if (current !== null) {
          const prevProps = current.memoizedProps;
          const prevState = current.memoizedState;
          const instance = finishedWork.stateNode;
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.
          if (__DEV__) {
            if (
              finishedWork.type === finishedWork.elementType &&
              !didWarnAboutReassigningProps
            ) {
              if (instance.props !== finishedWork.memoizedProps) {
                console.error(
                  'Expected %s props to match memoized props before ' +
                    'getSnapshotBeforeUpdate. ' +
                    'This might either be because of a bug in React, or because ' +
                    'a component reassigns its own `this.props`. ' +
                    'Please file an issue.',
                  getComponentNameFromFiber(finishedWork) || 'instance',
                );
              }
              if (instance.state !== finishedWork.memoizedState) {
                console.error(
                  'Expected %s state to match memoized state before ' +
                    'getSnapshotBeforeUpdate. ' +
                    'This might either be because of a bug in React, or because ' +
                    'a component reassigns its own `this.state`. ' +
                    'Please file an issue.',
                  getComponentNameFromFiber(finishedWork) || 'instance',
                );
              }
            }
          }
          const snapshot = instance.getSnapshotBeforeUpdate(
            // 判断是不是懒加载
            finishedWork.elementType === finishedWork.type
              ? prevProps
              : // merge 一下 defaultProps
                resolveDefaultProps(finishedWork.type, prevProps),
            prevState,
          );
          if (__DEV__) {
            const didWarnSet =
              ((didWarnAboutUndefinedSnapshotBeforeUpdate: any): Set<mixed>);
            if (snapshot === undefined && !didWarnSet.has(finishedWork.type)) {
              didWarnSet.add(finishedWork.type);
              console.error(
                '%s.getSnapshotBeforeUpdate(): A snapshot value (or null) ' +
                  'must be returned. You have returned undefined.',
                getComponentNameFromFiber(finishedWork),
              );
            }
          }
          // 更新前的快照也会被挂载在实例上
          instance.__reactInternalSnapshotBeforeUpdate = snapshot;
        }
        break;
      }
      case HostRoot: {
        if (supportsMutation) {
          const root = finishedWork.stateNode;
          clearContainer(root.containerInfo);
        }
        break;
      }
      case HostComponent:
      case HostText:
      case HostPortal:
      case IncompleteClassComponent:
        // Nothing to do for these component types
        break;
      default: {
        throw new Error(
          'This unit of work tag should not have side-effects. This error is ' +
            'likely caused by a bug in React. Please file an issue.',
        );
      }
    }

    resetCurrentDebugFiberInDEV();
  }
}

function commitBeforeMutationEffectsDeletion(deletion: Fiber) {
  if (enableCreateEventHandleAPI) {
    // TODO (effects) It would be nice to avoid calling doesFiberContain()
    // Maybe we can repurpose one of the subtreeFlags positions for this instead?
    // Use it to store which part of the tree the focused instance is in?
    // This assumes we can safely determine that instance during the "render" phase.
    if (doesFiberContain(deletion, ((focusedInstanceHandle: any): Fiber))) {
      shouldFireAfterActiveInstanceBlur = true;
      beforeActiveInstanceBlur(deletion);
    }
  }
}

/**
 * 执行指定 effect Hooks 的全部 destroy 回调函数
 * @param flags
 * @param finishedWork
 * @param nearestMountedAncestor
 */
function commitHookEffectListUnmount(
  flags: HookFlags,
  finishedWork: Fiber,
  nearestMountedAncestor: Fiber | null,
) {
  const updateQueue: FunctionComponentUpdateQueue | null =
    (finishedWork.updateQueue: any);
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        // 包含指定 flags 的 Unmount
        const destroy = effect.destroy;
        effect.destroy = undefined;
        if (destroy !== undefined) {
          // 如果存在回调函数
          if (enableSchedulingProfiler) {
            // devTools 函数
            if ((flags & HookPassive) !== NoHookEffect) {
              // 如果是 useEffect 回调
              markComponentPassiveEffectUnmountStarted(finishedWork);
            } else if ((flags & HookLayout) !== NoHookEffect) {
              // 如果是 useLayoutEffect 回调
              markComponentLayoutEffectUnmountStarted(finishedWork);
            }
          }

          if (__DEV__) {
            if ((flags & HookInsertion) !== NoHookEffect) {
              // 如果是 useInsertionEffect 回调
              setIsRunningInsertionEffect(true);
            }
          }
          // 执行回调函数
          safelyCallDestroy(finishedWork, nearestMountedAncestor, destroy);
          if (__DEV__) {
            if ((flags & HookInsertion) !== NoHookEffect) {
              // 如果是 useInsertionEffect 回调
              setIsRunningInsertionEffect(false);
            }
          }

          if (enableSchedulingProfiler) {
            // devTools 函数
            if ((flags & HookPassive) !== NoHookEffect) {
              // 如果是 useEffect 回调
              markComponentPassiveEffectUnmountStopped();
            } else if ((flags & HookLayout) !== NoHookEffect) {
              // 如果是 useLayoutEffect 回调
              markComponentLayoutEffectUnmountStopped();
            }
          }
        }
      }
      // 交给下一个 effect
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

/**
 * 执行指定 effect Hooks 的全部 create 回调函数, 并将返回值 赋给 destroy
 * @param flags
 * @param finishedWork
 */
function commitHookEffectListMount(flags: HookFlags, finishedWork: Fiber) {
  const updateQueue: FunctionComponentUpdateQueue | null =
    (finishedWork.updateQueue: any);
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        // 包含指定 flags 的 Mount

        if (enableSchedulingProfiler) {
          // devTools
          if ((flags & HookPassive) !== NoHookEffect) {
            markComponentPassiveEffectMountStarted(finishedWork);
          } else if ((flags & HookLayout) !== NoHookEffect) {
            markComponentLayoutEffectMountStarted(finishedWork);
          }
        }

        const create = effect.create;
        if (__DEV__) {
          if ((flags & HookInsertion) !== NoHookEffect) {
            setIsRunningInsertionEffect(true);
          }
        }
        // 执行 create 并且获取 destroy 函数
        effect.destroy = create();
        if (__DEV__) {
          if ((flags & HookInsertion) !== NoHookEffect) {
            setIsRunningInsertionEffect(false);
          }
        }

        if (enableSchedulingProfiler) {
          // devTools
          if ((flags & HookPassive) !== NoHookEffect) {
            markComponentPassiveEffectMountStopped();
          } else if ((flags & HookLayout) !== NoHookEffect) {
            markComponentLayoutEffectMountStopped();
          }
        }

        if (__DEV__) {
          const destroy = effect.destroy;
          if (destroy !== undefined && typeof destroy !== 'function') {
            let hookName;
            if ((effect.tag & HookLayout) !== NoFlags) {
              hookName = 'useLayoutEffect';
            } else if ((effect.tag & HookInsertion) !== NoFlags) {
              hookName = 'useInsertionEffect';
            } else {
              hookName = 'useEffect';
            }
            let addendum;
            if (destroy === null) {
              addendum =
                ' You returned null. If your effect does not require clean ' +
                'up, return undefined (or nothing).';
            } else if (typeof destroy.then === 'function') {
              addendum =
                '\n\nIt looks like you wrote ' +
                hookName +
                '(async () => ...) or returned a Promise. ' +
                'Instead, write the async function inside your effect ' +
                'and call it immediately:\n\n' +
                hookName +
                '(() => {\n' +
                '  async function fetchData() {\n' +
                '    // You can await here\n' +
                '    const response = await MyAPI.getData(someId);\n' +
                '    // ...\n' +
                '  }\n' +
                '  fetchData();\n' +
                `}, [someId]); // Or [] if effect doesn't need props or state\n\n` +
                'Learn more about data fetching with Hooks: https://reactjs.org/link/hooks-data-fetching';
            } else {
              addendum = ' You returned: ' + destroy;
            }
            console.error(
              '%s must not return anything besides a function, ' +
                'which is used for clean-up.%s',
              hookName,
              addendum,
            );
          }
        }
      }
      // 交给下一个 effect
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

export function commitPassiveEffectDurations(
  finishedRoot: FiberRoot,
  finishedWork: Fiber,
): void {
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    // Only Profilers with work in their subtree will have an Update effect scheduled.
    if ((finishedWork.flags & Update) !== NoFlags) {
      switch (finishedWork.tag) {
        case Profiler: {
          const {passiveEffectDuration} = finishedWork.stateNode;
          const {id, onPostCommit} = finishedWork.memoizedProps;

          // This value will still reflect the previous commit phase.
          // It does not get reset until the start of the next commit phase.
          const commitTime = getCommitTime();

          let phase = finishedWork.alternate === null ? 'mount' : 'update';
          if (enableProfilerNestedUpdatePhase) {
            if (isCurrentUpdateNested()) {
              phase = 'nested-update';
            }
          }

          if (typeof onPostCommit === 'function') {
            onPostCommit(id, phase, passiveEffectDuration, commitTime);
          }

          // Bubble times to the next nearest ancestor Profiler.
          // After we process that Profiler, we'll bubble further up.
          let parentFiber = finishedWork.return;
          outer: while (parentFiber !== null) {
            switch (parentFiber.tag) {
              case HostRoot:
                const root = parentFiber.stateNode;
                root.passiveEffectDuration += passiveEffectDuration;
                break outer;
              case Profiler:
                const parentStateNode = parentFiber.stateNode;
                parentStateNode.passiveEffectDuration += passiveEffectDuration;
                break outer;
            }
            parentFiber = parentFiber.return;
          }
          break;
        }
        default:
          break;
      }
    }
  }
}

/**
 * Layout 阶段的主要工作
 * 1. FC: 按顺序执行 useLayoutEffect 的 create 函数
 * 2. ClassComponent: mount/update 执行 componentDidMount/Update && commitUpdateQueue
 * 3. 挂载 ref
 * @param {FiberRoot} finishedRoot
 * @param {Fiber|null} current
 * @param {Fiber} finishedWork
 * @param {Lanes} committedLanes
 */
function commitLayoutEffectOnFiber(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes,
): void {
  if ((finishedWork.flags & LayoutMask) !== NoFlags) {
    switch (finishedWork.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        if (
          !enableSuspenseLayoutEffectSemantics ||
          !offscreenSubtreeWasHidden
        ) {
          // At this point layout effects have already been destroyed (during mutation phase).
          // This is done to prevent sibling component effects from interfering with each other,
          // e.g. a destroy function in one component should never override a ref set
          // by a create function in another component during the same commit.
          if (
            enableProfilerTimer &&
            enableProfilerCommitHooks &&
            finishedWork.mode & ProfileMode
          ) {
            try {
              startLayoutEffectTimer();
              // 执行 useLayoutEffect 的 create 函数
              commitHookEffectListMount(
                HookLayout | HookHasEffect,
                finishedWork,
              );
            } finally {
              recordLayoutEffectDuration(finishedWork);
            }
          } else {
            commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);
          }
        }
        break;
      }
      case ClassComponent: {
        const instance = finishedWork.stateNode;
        if (finishedWork.flags & Update) {
          // 存在更新
          if (!offscreenSubtreeWasHidden) {
            if (current === null) {
              // ClassComponent mount 逻辑
              // We could update instance props and state here,
              // but instead we rely on them being set during last render.
              // TODO: revisit this when we implement resuming.
              if (__DEV__) {
                if (
                  finishedWork.type === finishedWork.elementType &&
                  !didWarnAboutReassigningProps
                ) {
                  if (instance.props !== finishedWork.memoizedProps) {
                    console.error(
                      'Expected %s props to match memoized props before ' +
                        'componentDidMount. ' +
                        'This might either be because of a bug in React, or because ' +
                        'a component reassigns its own `this.props`. ' +
                        'Please file an issue.',
                      getComponentNameFromFiber(finishedWork) || 'instance',
                    );
                  }
                  if (instance.state !== finishedWork.memoizedState) {
                    console.error(
                      'Expected %s state to match memoized state before ' +
                        'componentDidMount. ' +
                        'This might either be because of a bug in React, or because ' +
                        'a component reassigns its own `this.state`. ' +
                        'Please file an issue.',
                      getComponentNameFromFiber(finishedWork) || 'instance',
                    );
                  }
                }
              }
              if (
                enableProfilerTimer &&
                enableProfilerCommitHooks &&
                finishedWork.mode & ProfileMode
              ) {
                try {
                  startLayoutEffectTimer();
                  // 执行 componentDidMount
                  instance.componentDidMount();
                } finally {
                  recordLayoutEffectDuration(finishedWork);
                }
              } else {
                instance.componentDidMount();
              }
            } else {
              // ClassComponent update 逻辑
              const prevProps =
                finishedWork.elementType === finishedWork.type
                  ? current.memoizedProps
                  : resolveDefaultProps(
                      finishedWork.type,
                      current.memoizedProps,
                    );
              const prevState = current.memoizedState;
              // We could update instance props and state here,
              // but instead we rely on them being set during last render.
              // TODO: revisit this when we implement resuming.
              if (__DEV__) {
                if (
                  finishedWork.type === finishedWork.elementType &&
                  !didWarnAboutReassigningProps
                ) {
                  if (instance.props !== finishedWork.memoizedProps) {
                    console.error(
                      'Expected %s props to match memoized props before ' +
                        'componentDidUpdate. ' +
                        'This might either be because of a bug in React, or because ' +
                        'a component reassigns its own `this.props`. ' +
                        'Please file an issue.',
                      getComponentNameFromFiber(finishedWork) || 'instance',
                    );
                  }
                  if (instance.state !== finishedWork.memoizedState) {
                    console.error(
                      'Expected %s state to match memoized state before ' +
                        'componentDidUpdate. ' +
                        'This might either be because of a bug in React, or because ' +
                        'a component reassigns its own `this.state`. ' +
                        'Please file an issue.',
                      getComponentNameFromFiber(finishedWork) || 'instance',
                    );
                  }
                }
              }
              if (
                enableProfilerTimer &&
                enableProfilerCommitHooks &&
                finishedWork.mode & ProfileMode
              ) {
                try {
                  startLayoutEffectTimer();
                  // 执行 componentDidUpdate
                  instance.componentDidUpdate(
                    prevProps,
                    prevState,
                    instance.__reactInternalSnapshotBeforeUpdate,
                  );
                } finally {
                  recordLayoutEffectDuration(finishedWork);
                }
              } else {
                instance.componentDidUpdate(
                  prevProps,
                  prevState,
                  instance.__reactInternalSnapshotBeforeUpdate,
                );
              }
            }
          }
        }

        // TODO: I think this is now always non-null by the time it reaches the
        // commit phase. Consider removing the type check.
        const updateQueue: UpdateQueue<*> | null =
          (finishedWork.updateQueue: any);
        if (updateQueue !== null) {
          if (__DEV__) {
            if (
              finishedWork.type === finishedWork.elementType &&
              !didWarnAboutReassigningProps
            ) {
              if (instance.props !== finishedWork.memoizedProps) {
                console.error(
                  'Expected %s props to match memoized props before ' +
                    'processing the update queue. ' +
                    'This might either be because of a bug in React, or because ' +
                    'a component reassigns its own `this.props`. ' +
                    'Please file an issue.',
                  getComponentNameFromFiber(finishedWork) || 'instance',
                );
              }
              if (instance.state !== finishedWork.memoizedState) {
                console.error(
                  'Expected %s state to match memoized state before ' +
                    'processing the update queue. ' +
                    'This might either be because of a bug in React, or because ' +
                    'a component reassigns its own `this.state`. ' +
                    'Please file an issue.',
                  getComponentNameFromFiber(finishedWork) || 'instance',
                );
              }
            }
          }
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.
          commitUpdateQueue(finishedWork, updateQueue, instance);
        }
        break;
      }
      case HostRoot: {
        // TODO: I think this is now always non-null by the time it reaches the
        // commit phase. Consider removing the type check.
        const updateQueue: UpdateQueue<*> | null =
          (finishedWork.updateQueue: any);
        if (updateQueue !== null) {
          let instance = null;
          if (finishedWork.child !== null) {
            switch (finishedWork.child.tag) {
              case HostComponent:
                instance = getPublicInstance(finishedWork.child.stateNode);
                break;
              case ClassComponent:
                instance = finishedWork.child.stateNode;
                break;
            }
          }
          commitUpdateQueue(finishedWork, updateQueue, instance);
        }
        break;
      }
      case HostComponent: {
        const instance: Instance = finishedWork.stateNode;

        // Renderers may schedule work to be done after host components are mounted
        // (eg DOM renderer may schedule auto-focus for inputs and form controls).
        // These effects should only be committed when components are first mounted,
        // aka when there is no current/alternate.
        if (current === null && finishedWork.flags & Update) {
          // mount 的 时候聚焦 或者 加载图片
          const type = finishedWork.type;
          const props = finishedWork.memoizedProps;
          commitMount(instance, type, props, finishedWork);
        }

        break;
      }
      case HostText: {
        // We have no life-cycles associated with text.
        break;
      }
      case HostPortal: {
        // We have no life-cycles associated with portals.
        break;
      }
      case Profiler: {
        if (enableProfilerTimer) {
          const {onCommit, onRender} = finishedWork.memoizedProps;
          const {effectDuration} = finishedWork.stateNode;

          const commitTime = getCommitTime();

          let phase = current === null ? 'mount' : 'update';
          if (enableProfilerNestedUpdatePhase) {
            if (isCurrentUpdateNested()) {
              phase = 'nested-update';
            }
          }

          if (typeof onRender === 'function') {
            onRender(
              finishedWork.memoizedProps.id,
              phase,
              finishedWork.actualDuration,
              finishedWork.treeBaseDuration,
              finishedWork.actualStartTime,
              commitTime,
            );
          }

          if (enableProfilerCommitHooks) {
            if (typeof onCommit === 'function') {
              onCommit(
                finishedWork.memoizedProps.id,
                phase,
                effectDuration,
                commitTime,
              );
            }

            // Schedule a passive effect for this Profiler to call onPostCommit hooks.
            // This effect should be scheduled even if there is no onPostCommit callback for this Profiler,
            // because the effect is also where times bubble to parent Profilers.
            enqueuePendingPassiveProfilerEffect(finishedWork);

            // Propagate layout effect durations to the next nearest Profiler ancestor.
            // Do not reset these values until the next render so DevTools has a chance to read them first.
            let parentFiber = finishedWork.return;
            outer: while (parentFiber !== null) {
              switch (parentFiber.tag) {
                case HostRoot:
                  const root = parentFiber.stateNode;
                  root.effectDuration += effectDuration;
                  break outer;
                case Profiler:
                  const parentStateNode = parentFiber.stateNode;
                  parentStateNode.effectDuration += effectDuration;
                  break outer;
              }
              parentFiber = parentFiber.return;
            }
          }
        }
        break;
      }
      case SuspenseComponent: {
        commitSuspenseHydrationCallbacks(finishedRoot, finishedWork);
        break;
      }
      case SuspenseListComponent:
      case IncompleteClassComponent:
      case ScopeComponent:
      case OffscreenComponent:
      case LegacyHiddenComponent:
      case TracingMarkerComponent: {
        break;
      }

      default:
        throw new Error(
          'This unit of work tag should not have side-effects. This error is ' +
            'likely caused by a bug in React. Please file an issue.',
        );
    }
  }

  if (!enableSuspenseLayoutEffectSemantics || !offscreenSubtreeWasHidden) {
    if (enableScopeAPI) {
      // TODO: This is a temporary solution that allowed us to transition away
      // from React Flare on www.
      if (finishedWork.flags & Ref && finishedWork.tag !== ScopeComponent) {
        commitAttachRef(finishedWork);
      }
    } else {
      if (finishedWork.flags & Ref) {
        commitAttachRef(finishedWork);
      }
    }
  }
}

function reappearLayoutEffectsOnFiber(node: Fiber) {
  // Turn on layout effects in a tree that previously disappeared.
  // TODO (Offscreen) Check: flags & LayoutStatic
  switch (node.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        node.mode & ProfileMode
      ) {
        try {
          startLayoutEffectTimer();
          safelyCallCommitHookLayoutEffectListMount(node, node.return);
        } finally {
          recordLayoutEffectDuration(node);
        }
      } else {
        safelyCallCommitHookLayoutEffectListMount(node, node.return);
      }
      break;
    }
    case ClassComponent: {
      const instance = node.stateNode;
      if (typeof instance.componentDidMount === 'function') {
        safelyCallComponentDidMount(node, node.return, instance);
      }
      safelyAttachRef(node, node.return);
      break;
    }
    case HostComponent: {
      safelyAttachRef(node, node.return);
      break;
    }
  }
}

function commitTransitionProgress(
  finishedRoot: FiberRoot,
  offscreenFiber: Fiber,
) {
  if (enableTransitionTracing) {
    // This function adds suspense boundaries to the root
    // or tracing marker's pendingSuspenseBoundaries map.
    // When a suspense boundary goes from a resolved to a fallback
    // state we add the boundary to the map, and when it goes from
    // a fallback to a resolved state, we remove the boundary from
    // the map.

    // We use stateNode on the Offscreen component as a stable object
    // that doesnt change from render to render. This way we can
    // distinguish between different Offscreen instances (vs. the same
    // Offscreen instance with different fibers)
    const offscreenInstance: OffscreenInstance = offscreenFiber.stateNode;

    let prevState: SuspenseState | null = null;
    const previousFiber = offscreenFiber.alternate;
    if (previousFiber !== null && previousFiber.memoizedState !== null) {
      prevState = previousFiber.memoizedState;
    }
    const nextState: SuspenseState | null = offscreenFiber.memoizedState;

    const wasHidden = prevState !== null;
    const isHidden = nextState !== null;

    const rootState: RootState = finishedRoot.current.memoizedState;
    // TODO(luna) move pendingSuspenseBoundaries and transitions from
    // HostRoot fiber to FiberRoot
    const rootPendingBoundaries = rootState.pendingSuspenseBoundaries;
    const rootTransitions = rootState.transitions;

    // If there is a name on the suspense boundary, store that in
    // the pending boundaries.
    let name = null;
    const parent = offscreenFiber.return;
    if (
      parent !== null &&
      parent.tag === SuspenseComponent &&
      parent.memoizedProps.unstable_name
    ) {
      name = parent.memoizedProps.unstable_name;
    }

    if (rootPendingBoundaries !== null) {
      if (previousFiber === null) {
        // Initial mount
        if (isHidden) {
          rootPendingBoundaries.set(offscreenInstance, {
            name,
          });
        }
      } else {
        if (wasHidden && !isHidden) {
          // The suspense boundary went from hidden to visible. Remove
          // the boundary from the pending suspense boundaries set
          // if it's there
          if (rootPendingBoundaries.has(offscreenInstance)) {
            rootPendingBoundaries.delete(offscreenInstance);

            if (rootPendingBoundaries.size === 0 && rootTransitions !== null) {
              rootTransitions.forEach((transition) => {
                addTransitionCompleteCallbackToPendingTransition({
                  transitionName: transition.name,
                  startTime: transition.startTime,
                });
              });
            }
          }
        } else if (!wasHidden && isHidden) {
          // The suspense boundaries was just hidden. Add the boundary
          // to the pending boundary set if it's there
          rootPendingBoundaries.set(offscreenInstance, {
            name,
          });
        }
      }
    }
  }
}

function hideOrUnhideAllChildren(finishedWork, isHidden) {
  // Only hide or unhide the top-most host nodes.
  let hostSubtreeRoot = null;

  if (supportsMutation) {
    // We only have the top Fiber that was inserted but we need to recurse down its
    // children to find all the terminal nodes.
    let node: Fiber = finishedWork;
    while (true) {
      if (node.tag === HostComponent) {
        if (hostSubtreeRoot === null) {
          hostSubtreeRoot = node;
          try {
            const instance = node.stateNode;
            if (isHidden) {
              hideInstance(instance);
            } else {
              unhideInstance(node.stateNode, node.memoizedProps);
            }
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      } else if (node.tag === HostText) {
        if (hostSubtreeRoot === null) {
          try {
            const instance = node.stateNode;
            if (isHidden) {
              hideTextInstance(instance);
            } else {
              unhideTextInstance(instance, node.memoizedProps);
            }
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      } else if (
        (node.tag === OffscreenComponent ||
          node.tag === LegacyHiddenComponent) &&
        (node.memoizedState: OffscreenState) !== null &&
        node !== finishedWork
      ) {
        // Found a nested Offscreen component that is hidden.
        // Don't search any deeper. This tree should remain hidden.
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }

      if (node === finishedWork) {
        return;
      }
      while (node.sibling === null) {
        if (node.return === null || node.return === finishedWork) {
          return;
        }

        if (hostSubtreeRoot === node) {
          hostSubtreeRoot = null;
        }

        node = node.return;
      }

      if (hostSubtreeRoot === node) {
        hostSubtreeRoot = null;
      }

      node.sibling.return = node.return;
      node = node.sibling;
    }
  }
}

/**
 * 挂载 ref
 * @param finishedWork
 */
function commitAttachRef(finishedWork: Fiber) {
  const ref = finishedWork.ref;
  if (ref !== null) {
    const instance = finishedWork.stateNode;
    let instanceToUse;
    switch (finishedWork.tag) {
      case HostComponent:
        instanceToUse = getPublicInstance(instance);
        break;
      default:
        instanceToUse = instance;
    }
    // Moved outside to ensure DCE works with this flag
    if (enableScopeAPI && finishedWork.tag === ScopeComponent) {
      instanceToUse = instance;
    }
    if (typeof ref === 'function') {
      let retVal;
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        finishedWork.mode & ProfileMode
      ) {
        try {
          startLayoutEffectTimer();
          retVal = ref(instanceToUse);
        } finally {
          recordLayoutEffectDuration(finishedWork);
        }
      } else {
        retVal = ref(instanceToUse);
      }
      if (__DEV__) {
        if (typeof retVal === 'function') {
          console.error(
            'Unexpected return value from a callback ref in %s. ' +
              'A callback ref should not return a function.',
            getComponentNameFromFiber(finishedWork),
          );
        }
      }
    } else {
      if (__DEV__) {
        if (!ref.hasOwnProperty('current')) {
          console.error(
            'Unexpected ref object provided for %s. ' +
              'Use either a ref-setter function or React.createRef().',
            getComponentNameFromFiber(finishedWork),
          );
        }
      }

      ref.current = instanceToUse;
    }
  }
}

function commitDetachRef(current: Fiber) {
  const currentRef = current.ref;
  if (currentRef !== null) {
    if (typeof currentRef === 'function') {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        current.mode & ProfileMode
      ) {
        try {
          startLayoutEffectTimer();
          currentRef(null);
        } finally {
          recordLayoutEffectDuration(current);
        }
      } else {
        currentRef(null);
      }
    } else {
      currentRef.current = null;
    }
  }
}

/**
 * Cut off the return pointer to disconnect it from the tree.
 * This enables us to detect and warn against state updates on an unmounted component.
 * It also prevents events from bubbling from within disconnected components.
 *
 * Ideally, we should also clear the child pointer of the parent alternate to let this
 * get GC:ed but we don't know which for sure which parent is the current
 * one so we'll settle for GC:ing the subtree of this child.
 * This child itself will be GC:ed when the parent updates the next time.
 *
 * Note that we can't clear child or sibling pointers yet.
 * They're needed for passive effects and for findDOMNode.
 * We defer those fields, and all other cleanup, to the passive phase (see detachFiberAfterEffects).
 *
 * Don't reset the alternate yet, either. We need that so we can detach the
 * alternate's fields in the passive phase. Clearing the return pointer is
 * sufficient for findDOMNode semantics.
 *
 * 为什么要重置父节点？
 * 使我们能够检测并警告未安装组件的状态更新。它还可以防止事件从断开连接的组件中冒泡。
 * 为了 GC 。
 * @param fiber
 */
function detachFiberMutation(fiber: Fiber) {
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.return = null;
  }
  fiber.return = null;
}

function detachFiberAfterEffects(fiber: Fiber) {
  const alternate = fiber.alternate;
  if (alternate !== null) {
    fiber.alternate = null;
    detachFiberAfterEffects(alternate);
  }

  // Note: Defensively using negation instead of < in case
  // `deletedTreeCleanUpLevel` is undefined.
  if (!(deletedTreeCleanUpLevel >= 2)) {
    // This is the default branch (level 0).
    fiber.child = null;
    fiber.deletions = null;
    fiber.dependencies = null;
    fiber.memoizedProps = null;
    fiber.memoizedState = null;
    fiber.pendingProps = null;
    fiber.sibling = null;
    fiber.stateNode = null;
    fiber.updateQueue = null;

    if (__DEV__) {
      fiber._debugOwner = null;
    }
  } else {
    // Clear cyclical Fiber fields. This level alone is designed to roughly
    // approximate the planned Fiber refactor. In that world, `setState` will be
    // bound to a special "instance" object instead of a Fiber. The Instance
    // object will not have any of these fields. It will only be connected to
    // the fiber tree via a single link at the root. So if this level alone is
    // sufficient to fix memory issues, that bodes well for our plans.
    fiber.child = null;
    fiber.deletions = null;
    fiber.sibling = null;

    // The `stateNode` is cyclical because on host nodes it points to the host
    // tree, which has its own pointers to children, parents, and siblings.
    // The other host nodes also point back to fibers, so we should detach that
    // one, too.
    if (fiber.tag === HostComponent) {
      const hostInstance: Instance = fiber.stateNode;
      if (hostInstance !== null) {
        detachDeletedInstance(hostInstance);
      }
    }
    fiber.stateNode = null;

    // I'm intentionally not clearing the `return` field in this level. We
    // already disconnect the `return` pointer at the root of the deleted
    // subtree (in `detachFiberMutation`). Besides, `return` by itself is not
    // cyclical — it's only cyclical when combined with `child`, `sibling`, and
    // `alternate`. But we'll clear it in the next level anyway, just in case.

    if (__DEV__) {
      fiber._debugOwner = null;
    }

    if (deletedTreeCleanUpLevel >= 3) {
      // Theoretically, nothing in here should be necessary, because we already
      // disconnected the fiber from the tree. So even if something leaks this
      // particular fiber, it won't leak anything else
      //
      // The purpose of this branch is to be super aggressive so we can measure
      // if there's any difference in memory impact. If there is, that could
      // indicate a React leak we don't know about.
      fiber.return = null;
      fiber.dependencies = null;
      fiber.memoizedProps = null;
      fiber.memoizedState = null;
      fiber.pendingProps = null;
      fiber.stateNode = null;
      // TODO: Move to `commitPassiveUnmountInsideDeletedTreeOnFiber` instead.
      fiber.updateQueue = null;
    }
  }
}

function emptyPortalContainer(current: Fiber) {
  if (!supportsPersistence) {
    return;
  }

  const portal: {
    containerInfo: Container,
    pendingChildren: ChildSet,
    ...
  } = current.stateNode;
  const {containerInfo} = portal;
  const emptyChildSet = createContainerChildSet(containerInfo);
  replaceContainerChildren(containerInfo, emptyChildSet);
}

/**
 * 从当前 fiberNode 向上遍历，获取第一个类型为 HostComponent | HostRoot | HostPortal 三者之一的祖先 fiberNode
 * 找到执行 DOM 操作的目标元素的父级 DOM 元素
 * @param fiber
 * @return {Fiber}
 */
function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }

  throw new Error(
    'Expected to find a host parent. This error is likely caused by a bug ' +
      'in React. Please file an issue.',
  );
}

function isHostParent(fiber: Fiber): boolean {
  return (
    fiber.tag === HostComponent ||
    fiber.tag === HostRoot ||
    fiber.tag === HostPortal
  );
}

/**
 * 找到用来执行 insertBefore 的 before DOM元素
 * 为什么遍历那么复杂？
 * 因为 DOM 元素的层级并不一定和 fiber 节点一一对应
 * @param fiber
 * @return {*|null}
 */
function getHostSibling(fiber: Fiber): ?Instance {
  // We're going to search forward into the tree until we find a sibling host
  // node. Unfortunately, if multiple insertions are done in a row we have to
  // search past them. This leads to exponential search for the next sibling.
  // TODO: Find a more efficient way to do this.
  let node: Fiber = fiber;
  siblings: while (true) {
    // If we didn't find anything, let's try the next sibling.
    // 找到一个DOM元素
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        // If we pop out of the root or hit the parent the fiber we are the
        // last sibling.
        // 如果最终都没有找到 before，则只能选择插入到父 DOM 元素的末尾
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    while (
      node.tag !== HostComponent &&
      node.tag !== HostText &&
      node.tag !== DehydratedFragment
    ) {
      // If it is not host node and, we might have a host node inside it.
      // Try to search down until we find one.
      if (node.flags & Placement) {
        // If we don't have a child, try the siblings instead.
        continue siblings;
      }
      // If we don't have a child, try the siblings instead.
      // We also skip portals because they ar\e not part of this host tree.
      if (node.child === null || node.tag === HostPortal) {
        continue siblings;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    // Check if this host node is stable or about to be placed.
    if (!(node.flags & Placement)) {
      // Found it!
      return node.stateNode;
    }
  }
}

/**
 * 正式往容器执行 追加 或者 插入 操作
 * @param finishedWork
 */
function commitPlacement(finishedWork: Fiber): void {
  if (!supportsMutation) {
    return;
  }

  // Recursively insert all host nodes into the parent.
  // 找到执行 DOM 操作的目标元素的父级 DOM 元素
  const parentFiber = getHostParentFiber(finishedWork);

  // Note: these two variables *must* always be updated together.
  switch (parentFiber.tag) {
    case HostComponent: {
      const parent: Instance = parentFiber.stateNode;
      if (parentFiber.flags & ContentReset) {
        // Reset the text content of the parent before doing any insertions
        resetTextContent(parent);
        // Clear ContentReset from the effect tag
        parentFiber.flags &= ~ContentReset;
      }

      // 找到 DOM 元素的兄弟元素
      const before = getHostSibling(finishedWork);
      // We only have the top Fiber that was inserted but we need to recurse down its
      // children to find all the terminal nodes.
      insertOrAppendPlacementNode(finishedWork, before, parent);
      break;
    }
    case HostRoot:
    case HostPortal: {
      const parent: Container = parentFiber.stateNode.containerInfo;
      const before = getHostSibling(finishedWork);
      insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
      break;
    }
    // eslint-disable-next-line-no-fallthrough
    default:
      throw new Error(
        'Invalid host parent fiber. This error is likely caused by a bug ' +
          'in React. Please file an issue.',
      );
  }
}

/**
 * 往容器内插入或者追加 DOM 元素
 * @param node
 * @param before
 * @param parent
 */
function insertOrAppendPlacementNodeIntoContainer(
  node: Fiber,
  before: ?Instance,
  parent: Container,
): void {
  const {tag} = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertInContainerBefore(parent, stateNode, before);
    } else {
      appendChildToContainer(parent, stateNode);
    }
  } else if (tag === HostPortal) {
    // If the insertion itself is a portal, then we don't want to traverse
    // down its children. Instead, we'll get insertions from each child in
    // the portal directly.
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNodeIntoContainer(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

function insertOrAppendPlacementNode(
  node: Fiber,
  before: ?Instance,
  parent: Instance,
): void {
  const {tag} = node;
  const isHost = tag === HostComponent || tag === HostText;
  if (isHost) {
    const stateNode = node.stateNode;
    if (before) {
      insertBefore(parent, stateNode, before);
    } else {
      appendChild(parent, stateNode);
    }
  } else if (tag === HostPortal) {
    // If the insertion itself is a portal, then we don't want to traverse
    // down its children. Instead, we'll get insertions from each child in
    // the portal directly.
  } else {
    const child = node.child;
    if (child !== null) {
      insertOrAppendPlacementNode(child, before, parent);
      let sibling = child.sibling;
      while (sibling !== null) {
        insertOrAppendPlacementNode(sibling, before, parent);
        sibling = sibling.sibling;
      }
    }
  }
}

// These are tracked on the stack as we recursively traverse a
// deleted subtree.
// TODO: Update these during the whole mutation phase, not just during
// a deletion.
// 当前组件的父实例，可以是一个实例，也可以是一个容器
let hostParent: Instance | Container | null = null;
// 用来表示当前组件的父容器是否是一个容器
let hostParentIsContainer: boolean = false;

/**
 * 删除逻辑比较复杂，原因在于当删除一个 DOM 元素的时候，还需要考虑:
 * - 其子树中所有组件的 unmount 逻辑
 * - 其子树中所有 ref 属性的卸载操作
 * - 其子树中所有 Effect 相关 Hook 的 destroy 回调执行
 * @param root
 * @param returnFiber
 * @param deletedFiber
 */
function commitDeletionEffects(
  root: FiberRoot,
  returnFiber: Fiber,
  deletedFiber: Fiber,
) {
  if (supportsMutation) {
    // We only have the top Fiber that was deleted but we need to recurse down its
    // children to find all the terminal nodes.

    // Recursively delete all host nodes from the parent, detach refs, clean
    // up mounted layout effects, and call componentWillUnmount.

    // We only need to remove the topmost host child in each branch. But then we
    // still need to keep traversing to unmount effects, refs, and cWU. TODO: We
    // could split this into two separate traversals functions, where the second
    // one doesn't include any removeChild logic. This is maybe the same
    // function as "disappearLayoutEffects" (or whatever that turns into after
    // the layout phase is refactored to use recursion).

    // Before starting, find the nearest host parent on the stack so we know
    // which instance/container to remove the children from.
    // TODO: Instead of searching up the fiber return path on every deletion, we
    // can track the nearest host component on the JS stack as we traverse the
    // tree during the commit phase. This would make insertions faster, too.

    // 这个迭代主要是用来干嘛的?
    // 为了找到 DOM 容器，来移除 child
    let parent = returnFiber;
    findParent: while (parent !== null) {
      switch (parent.tag) {
        case HostComponent: {
          // 当前组件是一个DOM 实例
          hostParent = parent.stateNode;
          hostParentIsContainer = false;
          break findParent;
        }
        case HostRoot: {
          // 当前组件是一个容器
          hostParent = parent.stateNode.containerInfo;
          hostParentIsContainer = true;
          break findParent;
        }
        case HostPortal: {
          // 当前组件是一个容器
          hostParent = parent.stateNode.containerInfo;
          hostParentIsContainer = true;
          break findParent;
        }
      }
      // 交给父级 继续遍历
      parent = parent.return;
    }
    if (hostParent === null) {
      throw new Error(
        'Expected to find a host parent. This error is likely caused by ' +
          'a bug in React. Please file an issue.',
      );
    }
    commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
    // 重置状态
    hostParent = null;
    hostParentIsContainer = false;
  } else {
    // Detach refs and call componentWillUnmount() on the whole subtree.
    commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
  }

  // 重置父节点
  detachFiberMutation(deletedFiber);
}

/**
 * 按层递归遍历 deletion effects
 * @param finishedRoot
 * @param nearestMountedAncestor
 * @param parent
 */
function recursivelyTraverseDeletionEffects(
  finishedRoot,
  nearestMountedAncestor,
  parent,
) {
  // TODO: Use a static flag to skip trees that don't have unmount effects
  let child = parent.child;
  while (child !== null) {
    commitDeletionEffectsOnFiber(finishedRoot, nearestMountedAncestor, child);
    // 向兄弟节点遍历
    child = child.sibling;
  }
}

/**
 * commit 删除 fiber 的操作
 * 主要干三件事
 * 1. 执行 unmount 逻辑
 * 2. ref 属性卸载
 * 3. Effect 的相关 Hook 的 destroy 操作
 * @param finishedRoot
 * @param nearestMountedAncestor
 * @param deletedFiber
 */
function commitDeletionEffectsOnFiber(
  finishedRoot: FiberRoot,
  nearestMountedAncestor: Fiber,
  deletedFiber: Fiber,
) {
  onCommitUnmount(deletedFiber);

  // The cases in this outer switch modify the stack before they traverse
  // into their subtree. There are simpler cases in the inner switch
  // that don't modify the stack.
  switch (deletedFiber.tag) {
    case HostComponent: {
      if (!offscreenSubtreeWasHidden) {
        safelyDetachRef(deletedFiber, nearestMountedAncestor);
      }
      // Intentional fallthrough to next branch
    }
    // eslint-disable-next-line-no-fallthrough
    case HostText: {
      // We only need to remove the nearest host child. Set the host parent
      // to `null` on the stack to indicate that nested children don't
      // need to be removed.
      if (supportsMutation) {
        const prevHostParent = hostParent;
        const prevHostParentIsContainer = hostParentIsContainer;
        hostParent = null;
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber,
        );
        hostParent = prevHostParent;
        hostParentIsContainer = prevHostParentIsContainer;

        // 在这里删除 DOM 实例
        if (hostParent !== null) {
          // Now that all the child effects have unmounted, we can remove the
          // node from the tree.
          if (hostParentIsContainer) {
            removeChildFromContainer(
              ((hostParent: any): Container),
              (deletedFiber.stateNode: Instance | TextInstance),
            );
          } else {
            removeChild(
              ((hostParent: any): Instance),
              (deletedFiber.stateNode: Instance | TextInstance),
            );
          }
        }
      } else {
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber,
        );
      }
      return;
    }
    case DehydratedFragment: {
      if (enableSuspenseCallback) {
        const hydrationCallbacks = finishedRoot.hydrationCallbacks;
        if (hydrationCallbacks !== null) {
          const onDeleted = hydrationCallbacks.onDeleted;
          if (onDeleted) {
            onDeleted((deletedFiber.stateNode: SuspenseInstance));
          }
        }
      }

      // Dehydrated fragments don't have any children

      // Delete the dehydrated suspense boundary and all of its content.
      if (supportsMutation) {
        if (hostParent !== null) {
          if (hostParentIsContainer) {
            clearSuspenseBoundaryFromContainer(
              ((hostParent: any): Container),
              (deletedFiber.stateNode: SuspenseInstance),
            );
          } else {
            clearSuspenseBoundary(
              ((hostParent: any): Instance),
              (deletedFiber.stateNode: SuspenseInstance),
            );
          }
        }
      }
      return;
    }
    case HostPortal: {
      if (supportsMutation) {
        // When we go into a portal, it becomes the parent to remove from.
        const prevHostParent = hostParent;
        const prevHostParentIsContainer = hostParentIsContainer;
        hostParent = deletedFiber.stateNode.containerInfo;
        hostParentIsContainer = true;
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber,
        );
        hostParent = prevHostParent;
        hostParentIsContainer = prevHostParentIsContainer;
      } else {
        emptyPortalContainer(deletedFiber);

        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber,
        );
      }
      return;
    }
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent: {
      if (!offscreenSubtreeWasHidden) {
        const updateQueue: FunctionComponentUpdateQueue | null =
          (deletedFiber.updateQueue: any);
        if (updateQueue !== null) {
          const lastEffect = updateQueue.lastEffect;
          if (lastEffect !== null) {
            const firstEffect = lastEffect.next;

            let effect = firstEffect;
            do {
              const {destroy, tag} = effect;
              if (destroy !== undefined) {
                if ((tag & HookInsertion) !== NoHookEffect) {
                  // 先执行 useInsertionEffect 的销毁函数
                  safelyCallDestroy(
                    deletedFiber,
                    nearestMountedAncestor,
                    destroy,
                  );
                } else if ((tag & HookLayout) !== NoHookEffect) {
                  // 再执行 useLayoutEffect 的 销毁函数
                  if (enableSchedulingProfiler) {
                    markComponentLayoutEffectUnmountStarted(deletedFiber);
                  }

                  if (
                    enableProfilerTimer &&
                    enableProfilerCommitHooks &&
                    deletedFiber.mode & ProfileMode
                  ) {
                    startLayoutEffectTimer();
                    safelyCallDestroy(
                      deletedFiber,
                      nearestMountedAncestor,
                      destroy,
                    );
                    recordLayoutEffectDuration(deletedFiber);
                  } else {
                    safelyCallDestroy(
                      deletedFiber,
                      nearestMountedAncestor,
                      destroy,
                    );
                  }

                  if (enableSchedulingProfiler) {
                    markComponentLayoutEffectUnmountStopped();
                  }
                }
              }
              // 遍历下一个 effect
              effect = effect.next;
            } while (effect !== firstEffect);
          }
        }
      }

      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber,
      );
      return;
    }
    case ClassComponent: {
      if (!offscreenSubtreeWasHidden) {
        safelyDetachRef(deletedFiber, nearestMountedAncestor);
        const instance = deletedFiber.stateNode;
        if (typeof instance.componentWillUnmount === 'function') {
          safelyCallComponentWillUnmount(
            deletedFiber,
            nearestMountedAncestor,
            instance,
          );
        }
      }
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber,
      );
      return;
    }
    case ScopeComponent: {
      if (enableScopeAPI) {
        safelyDetachRef(deletedFiber, nearestMountedAncestor);
      }
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber,
      );
      return;
    }
    case OffscreenComponent: {
      if (
        // TODO: Remove this dead flag
        enableSuspenseLayoutEffectSemantics &&
        deletedFiber.mode & ConcurrentMode
      ) {
        // If this offscreen component is hidden, we already unmounted it. Before
        // deleting the children, track that it's already unmounted so that we
        // don't attempt to unmount the effects again.
        // TODO: If the tree is hidden, in most cases we should be able to skip
        // over the nested children entirely. An exception is we haven't yet found
        // the topmost host node to delete, which we already track on the stack.
        // But the other case is portals, which need to be detached no matter how
        // deeply they are nested. We should use a subtree flag to track whether a
        // subtree includes a nested portal.
        const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
        offscreenSubtreeWasHidden =
          prevOffscreenSubtreeWasHidden || deletedFiber.memoizedState !== null;
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber,
        );
        offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      } else {
        recursivelyTraverseDeletionEffects(
          finishedRoot,
          nearestMountedAncestor,
          deletedFiber,
        );
      }
      break;
    }
    default: {
      recursivelyTraverseDeletionEffects(
        finishedRoot,
        nearestMountedAncestor,
        deletedFiber,
      );
      return;
    }
  }
}

function commitSuspenseCallback(finishedWork: Fiber) {
  // TODO: Move this to passive phase
  const newState: SuspenseState | null = finishedWork.memoizedState;
  if (enableSuspenseCallback && newState !== null) {
    const suspenseCallback = finishedWork.memoizedProps.suspenseCallback;
    if (typeof suspenseCallback === 'function') {
      const wakeables: Set<Wakeable> | null = (finishedWork.updateQueue: any);
      if (wakeables !== null) {
        suspenseCallback(new Set(wakeables));
      }
    } else if (__DEV__) {
      if (suspenseCallback !== undefined) {
        console.error('Unexpected type for suspenseCallback.');
      }
    }
  }
}

function commitSuspenseHydrationCallbacks(
  finishedRoot: FiberRoot,
  finishedWork: Fiber,
) {
  if (!supportsHydration) {
    return;
  }
  const newState: SuspenseState | null = finishedWork.memoizedState;
  if (newState === null) {
    const current = finishedWork.alternate;
    if (current !== null) {
      const prevState: SuspenseState | null = current.memoizedState;
      if (prevState !== null) {
        const suspenseInstance = prevState.dehydrated;
        if (suspenseInstance !== null) {
          commitHydratedSuspenseInstance(suspenseInstance);
          if (enableSuspenseCallback) {
            const hydrationCallbacks = finishedRoot.hydrationCallbacks;
            if (hydrationCallbacks !== null) {
              const onHydrated = hydrationCallbacks.onHydrated;
              if (onHydrated) {
                onHydrated(suspenseInstance);
              }
            }
          }
        }
      }
    }
  }
}

function attachSuspenseRetryListeners(finishedWork: Fiber) {
  // If this boundary just timed out, then it will have a set of wakeables.
  // For each wakeable, attach a listener so that when it resolves, React
  // attempts to re-render the boundary in the primary (pre-timeout) state.
  const wakeables: Set<Wakeable> | null = (finishedWork.updateQueue: any);
  if (wakeables !== null) {
    finishedWork.updateQueue = null;
    let retryCache = finishedWork.stateNode;
    if (retryCache === null) {
      retryCache = finishedWork.stateNode = new PossiblyWeakSet();
    }
    wakeables.forEach((wakeable) => {
      // Memoize using the boundary fiber to prevent redundant listeners.
      const retry = resolveRetryWakeable.bind(null, finishedWork, wakeable);
      if (!retryCache.has(wakeable)) {
        retryCache.add(wakeable);

        if (enableUpdaterTracking) {
          if (isDevToolsPresent) {
            if (inProgressLanes !== null && inProgressRoot !== null) {
              // If we have pending work still, associate the original updaters with it.
              restorePendingUpdaters(inProgressRoot, inProgressLanes);
            } else {
              throw Error(
                'Expected finished root and lanes to be set. This is a bug in React.',
              );
            }
          }
        }

        wakeable.then(retry, retry);
      }
    });
  }
}

// This function detects when a Suspense boundary goes from visible to hidden.
// It returns false if the boundary is already hidden.
// TODO: Use an effect tag.
export function isSuspenseBoundaryBeingHidden(
  current: Fiber | null,
  finishedWork: Fiber,
): boolean {
  if (current !== null) {
    const oldState: SuspenseState | null = current.memoizedState;
    if (oldState === null || oldState.dehydrated !== null) {
      const newState: SuspenseState | null = finishedWork.memoizedState;
      return newState !== null && newState.dehydrated === null;
    }
  }
  return false;
}

/**
 * Mutation 阶段的主要工作
 * HostComponent:  进行 DOM 元素的增、删、改
 * FC | ForwardRef | MemoComponent | SimpleMemoComponent: 执行 Effect destroy 回调， 然后再执行 effect create 回调
 * @param root
 * @param finishedWork
 * @param committedLanes
 */
export function commitMutationEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
) {
  // 设置 inProgressRoot 以及其 lanes
  inProgressLanes = committedLanes;
  inProgressRoot = root;

  setCurrentDebugFiberInDEV(finishedWork);
  commitMutationEffectsOnFiber(finishedWork, root, committedLanes);
  setCurrentDebugFiberInDEV(finishedWork);

  // 清空 inProgressRoot
  inProgressLanes = null;
  inProgressRoot = null;
}

/**
 * 两件事
 * 1. 遍历父节点的 deletions
 * 2. mutation 阶段的 effect
 * @param root
 * @param parentFiber
 * @param lanes
 */
function recursivelyTraverseMutationEffects(
  root: FiberRoot,
  parentFiber: Fiber,
  lanes: Lanes,
) {
  // Deletions effects can be scheduled on any fiber type. They need to happen
  // before the children effects hae fired.
  const deletions = parentFiber.deletions;
  if (deletions !== null) {
    for (let i = 0; i < deletions.length; i++) {
      const childToDelete = deletions[i];
      try {
        commitDeletionEffects(root, parentFiber, childToDelete);
      } catch (error) {
        captureCommitPhaseError(childToDelete, parentFiber, error);
      }
    }
  }

  const prevDebugFiber = getCurrentDebugFiberInDEV();
  // 判断子孙节点是否存在 MutationMask (Placement | Update | ChildDeletion | ContentReset | Ref | Hydrating | Visibility) 这些标记
  if (parentFiber.subtreeFlags & MutationMask) {
    // 如果存在就 遍历子节点 执行 Mutation 阶段的主要内容
    // HostComponent:  进行 DOM 元素的增、删、改
    // FC | ForwardRef | MemoComponent | SimpleMemoComponent: 执行 Effect destroy 回调， 然后再执行 effect create 回调
    let child = parentFiber.child;
    while (child !== null) {
      setCurrentDebugFiberInDEV(child);
      // 从这里开始递归处理
      commitMutationEffectsOnFiber(child, root, lanes);
      // 继续遍历兄弟节点
      child = child.sibling;
    }
  }
  setCurrentDebugFiberInDEV(prevDebugFiber);
}

/**
 * Mutation 阶段的主要工作
 * 能卸载 ref 的 卸载 ref
 * 其他的主要分组件
 * HostComponent:  进行 DOM 元素的增、删、改
 * FC | ForwardRef | MemoComponent | SimpleMemoComponent: 执行 Effect destroy 回调， 然后再执行 effect create 回调
 * HostRoot
 *
 * @param {Fiber} finishedWork
 * @param {FiberRoot} root
 * @param {Lanes} lanes
 */
function commitMutationEffectsOnFiber(
  finishedWork: Fiber,
  root: FiberRoot,
  lanes: Lanes,
) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  // The effect flag should be checked *after* we refine the type of fiber,
  // because the fiber tag is more specific. An exception is any flag related
  // to reconcilation, because those can be set on all fiber types.
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Update) {
        // update
        try {
          commitHookEffectListUnmount(
            HookInsertion | HookHasEffect,
            finishedWork,
            finishedWork.return,
          );
          commitHookEffectListMount(
            HookInsertion | HookHasEffect,
            finishedWork,
          );
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
        // Layout effects are destroyed during the mutation phase so that all
        // destroy functions for all fibers are called before any create functions.
        // This prevents sibling component effects from interfering with each other,
        // e.g. a destroy function in one component should never override a ref set
        // by a create function in another component during the same commit.
        if (
          enableProfilerTimer &&
          enableProfilerCommitHooks &&
          finishedWork.mode & ProfileMode
        ) {
          try {
            startLayoutEffectTimer();
            commitHookEffectListUnmount(
              HookLayout | HookHasEffect,
              finishedWork,
              finishedWork.return,
            );
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
          recordLayoutEffectDuration(finishedWork);
        } else {
          try {
            commitHookEffectListUnmount(
              HookLayout | HookHasEffect,
              finishedWork,
              finishedWork.return,
            );
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      return;
    }
    case ClassComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Ref) {
        if (current !== null) {
          safelyDetachRef(current, current.return);
        }
      }
      return;
    }
    case HostComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Ref) {
        if (current !== null) {
          safelyDetachRef(current, current.return);
        }
      }
      if (supportsMutation) {
        // TODO: ContentReset gets cleared by the children during the commit
        // phase. This is a refactor hazard because it means we must read
        // flags the flags after `commitReconciliationEffects` has already run;
        // the order matters. We should refactor so that ContentReset does not
        // rely on mutating the flag during commit. Like by setting a flag
        // during the render phase instead.
        if (finishedWork.flags & ContentReset) {
          const instance: Instance = finishedWork.stateNode;
          try {
            resetTextContent(instance);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }

        if (flags & Update) {
          const instance: Instance = finishedWork.stateNode;
          if (instance != null) {
            // Commit the work prepared earlier.
            const newProps = finishedWork.memoizedProps;
            // For hydration we reuse the update path but we treat the oldProps
            // as the newProps. The updatePayload will contain the real change in
            // this case.
            const oldProps =
              current !== null ? current.memoizedProps : newProps;
            const type = finishedWork.type;
            // TODO: Type the updateQueue to be specific to host components.
            const updatePayload: null | UpdatePayload =
              (finishedWork.updateQueue: any);
            finishedWork.updateQueue = null;
            if (updatePayload !== null) {
              try {
                // 提交变更
                commitUpdate(
                  instance,
                  updatePayload,
                  type,
                  oldProps,
                  newProps,
                  finishedWork,
                );
              } catch (error) {
                captureCommitPhaseError(
                  finishedWork,
                  finishedWork.return,
                  error,
                );
              }
            }
          }
        }
      }
      return;
    }
    case HostText: {
      // 文本节点应该如何理解？
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Update) {
        if (supportsMutation) {
          if (finishedWork.stateNode === null) {
            throw new Error(
              'This should have a text node initialized. This error is likely ' +
                'caused by a bug in React. Please file an issue.',
            );
          }

          const textInstance: TextInstance = finishedWork.stateNode;
          const newText: string = finishedWork.memoizedProps;
          // For hydration we reuse the update path but we treat the oldProps
          // as the newProps. The updatePayload will contain the real change in
          // this case.
          const oldText: string =
            current !== null ? current.memoizedProps : newText;

          try {
            commitTextUpdate(textInstance, oldText, newText);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      return;
    }
    case HostRoot: {
      // 递归处理 Mutation 阶段的各种事情
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      // 执行 插入 和 追加 DOM 元素
      commitReconciliationEffects(finishedWork);

      if (flags & Update) {
        // 存在 Update 标记
        if (supportsMutation && supportsHydration) {
          if (current !== null) {
            // update
            const prevRootState: RootState = current.memoizedState;
            if (prevRootState.isDehydrated) {
              // SSR
              try {
                commitHydratedContainer(root.containerInfo);
              } catch (error) {
                captureCommitPhaseError(
                  finishedWork,
                  finishedWork.return,
                  error,
                );
              }
            }
          }
        }
        if (supportsPersistence) {
          const containerInfo = root.containerInfo;
          const pendingChildren = root.pendingChildren;
          try {
            replaceContainerChildren(containerInfo, pendingChildren);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      return;
    }
    case HostPortal: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Update) {
        if (supportsPersistence) {
          const portal = finishedWork.stateNode;
          const containerInfo = portal.containerInfo;
          const pendingChildren = portal.pendingChildren;
          try {
            replaceContainerChildren(containerInfo, pendingChildren);
          } catch (error) {
            captureCommitPhaseError(finishedWork, finishedWork.return, error);
          }
        }
      }
      return;
    }
    case SuspenseComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      const offscreenFiber: Fiber = (finishedWork.child: any);

      if (offscreenFiber.flags & Visibility) {
        const offscreenInstance: OffscreenInstance = offscreenFiber.stateNode;
        const newState: OffscreenState | null = offscreenFiber.memoizedState;
        const isHidden = newState !== null;

        // Track the current state on the Offscreen instance so we can
        // read it during an event
        offscreenInstance.isHidden = isHidden;

        if (isHidden) {
          const wasHidden =
            offscreenFiber.alternate !== null &&
            offscreenFiber.alternate.memoizedState !== null;
          if (!wasHidden) {
            // TODO: Move to passive phase
            markCommitTimeOfFallback();
          }
        }
      }

      if (flags & Update) {
        try {
          commitSuspenseCallback(finishedWork);
        } catch (error) {
          captureCommitPhaseError(finishedWork, finishedWork.return, error);
        }
        attachSuspenseRetryListeners(finishedWork);
      }
      return;
    }
    case OffscreenComponent: {
      const wasHidden = current !== null && current.memoizedState !== null;

      if (
        // TODO: Remove this dead flag
        enableSuspenseLayoutEffectSemantics &&
        finishedWork.mode & ConcurrentMode
      ) {
        // Before committing the children, track on the stack whether this
        // offscreen subtree was already hidden, so that we don't unmount the
        // effects again.
        const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;
        offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden || wasHidden;
        recursivelyTraverseMutationEffects(root, finishedWork, lanes);
        offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
      } else {
        recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      }

      commitReconciliationEffects(finishedWork);

      if (flags & Visibility) {
        const offscreenInstance: OffscreenInstance = finishedWork.stateNode;
        const newState: OffscreenState | null = finishedWork.memoizedState;
        const isHidden = newState !== null;
        const offscreenBoundary: Fiber = finishedWork;

        // Track the current state on the Offscreen instance so we can
        // read it during an event
        offscreenInstance.isHidden = isHidden;

        if (enableSuspenseLayoutEffectSemantics) {
          if (isHidden) {
            if (!wasHidden) {
              if ((offscreenBoundary.mode & ConcurrentMode) !== NoMode) {
                nextEffect = offscreenBoundary;
                let offscreenChild = offscreenBoundary.child;
                while (offscreenChild !== null) {
                  nextEffect = offscreenChild;
                  disappearLayoutEffects_begin(offscreenChild);
                  offscreenChild = offscreenChild.sibling;
                }
              }
            }
          } else {
            if (wasHidden) {
              // TODO: Move re-appear call here for symmetry?
            }
          }
        }

        if (supportsMutation) {
          // TODO: This needs to run whenever there's an insertion or update
          // inside a hidden Offscreen tree.
          hideOrUnhideAllChildren(offscreenBoundary, isHidden);
        }
      }
      return;
    }
    case SuspenseListComponent: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      if (flags & Update) {
        attachSuspenseRetryListeners(finishedWork);
      }
      return;
    }
    case ScopeComponent: {
      if (enableScopeAPI) {
        recursivelyTraverseMutationEffects(root, finishedWork, lanes);
        commitReconciliationEffects(finishedWork);

        // TODO: This is a temporary solution that allowed us to transition away
        // from React Flare on www.
        if (flags & Ref) {
          if (current !== null) {
            safelyDetachRef(finishedWork, finishedWork.return);
          }
          safelyAttachRef(finishedWork, finishedWork.return);
        }
        if (flags & Update) {
          const scopeInstance = finishedWork.stateNode;
          prepareScopeUpdate(scopeInstance, finishedWork);
        }
      }
      return;
    }
    default: {
      recursivelyTraverseMutationEffects(root, finishedWork, lanes);
      commitReconciliationEffects(finishedWork);

      return;
    }
  }
}

/**
 * 正式提交 Placement 操作
 * @param finishedWork
 */
function commitReconciliationEffects(finishedWork: Fiber) {
  // Placement effects (insertions, reorders) can be scheduled on any fiber
  // type. They needs to happen after the children effects have fired, but
  // before the effects on this fiber have fired.
  const flags = finishedWork.flags;
  if (flags & Placement) {
    // 存在 Placement 标记
    try {
      commitPlacement(finishedWork);
    } catch (error) {
      captureCommitPhaseError(finishedWork, finishedWork.return, error);
    }
    // Clear the "placement" from effect tag so that we know that this is
    // inserted, before any life-cycles like componentDidMount gets called.
    // TODO: findDOMNode doesn't rely on this any more but isMounted does
    // and isMounted is deprecated anyway so we should be able to kill this.
    // 处理完移除 Placement 标记
    finishedWork.flags &= ~Placement;
  }
  if (flags & Hydrating) {
    // SSR
    finishedWork.flags &= ~Hydrating;
  }
}

export function commitLayoutEffects(
  finishedWork: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
): void {
  inProgressLanes = committedLanes;
  inProgressRoot = root;
  nextEffect = finishedWork;

  commitLayoutEffects_begin(finishedWork, root, committedLanes);

  inProgressLanes = null;
  inProgressRoot = null;
}

function commitLayoutEffects_begin(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
) {
  // Suspense layout effects semantics don't change for legacy roots.
  const isModernRoot = (subtreeRoot.mode & ConcurrentMode) !== NoMode;

  while (nextEffect !== null) {
    const fiber = nextEffect;
    const firstChild = fiber.child;

    // OffscreenComponent 的显隐逻辑
    if (
      enableSuspenseLayoutEffectSemantics &&
      fiber.tag === OffscreenComponent &&
      isModernRoot
    ) {
      // Keep track of the current Offscreen stack's state.
      const isHidden = fiber.memoizedState !== null;
      const newOffscreenSubtreeIsHidden = isHidden || offscreenSubtreeIsHidden;
      if (newOffscreenSubtreeIsHidden) {
        // The Offscreen tree is hidden. Skip over its layout effects.
        commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
        continue;
      } else {
        // TODO (Offscreen) Also check: subtreeFlags & LayoutMask
        const current = fiber.alternate;
        const wasHidden = current !== null && current.memoizedState !== null;
        const newOffscreenSubtreeWasHidden =
          wasHidden || offscreenSubtreeWasHidden;
        const prevOffscreenSubtreeIsHidden = offscreenSubtreeIsHidden;
        const prevOffscreenSubtreeWasHidden = offscreenSubtreeWasHidden;

        // Traverse the Offscreen subtree with the current Offscreen as the root.
        offscreenSubtreeIsHidden = newOffscreenSubtreeIsHidden;
        offscreenSubtreeWasHidden = newOffscreenSubtreeWasHidden;

        if (offscreenSubtreeWasHidden && !prevOffscreenSubtreeWasHidden) {
          // This is the root of a reappearing boundary. Turn its layout effects
          // back on.
          nextEffect = fiber;
          reappearLayoutEffects_begin(fiber);
        }

        let child = firstChild;
        while (child !== null) {
          // 纵向遍历
          nextEffect = child;
          commitLayoutEffects_begin(
            child, // New root; bubble back up to here and stop.
            root,
            committedLanes,
          );
          // 横向遍历
          child = child.sibling;
        }

        // Restore Offscreen state and resume in our-progress traversal.
        nextEffect = fiber;
        offscreenSubtreeIsHidden = prevOffscreenSubtreeIsHidden;
        offscreenSubtreeWasHidden = prevOffscreenSubtreeWasHidden;
        commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);

        continue;
      }
    }

    if ((fiber.subtreeFlags & LayoutMask) !== NoFlags && firstChild !== null) {
      // 如果 fiber 子孙节点 存在  LayoutMask 标记, 继续向下遍历
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      // 当前节点存在 LayoutMask 标记
      commitLayoutMountEffects_complete(subtreeRoot, root, committedLanes);
    }
  }
}

function commitLayoutMountEffects_complete(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    if ((fiber.flags & LayoutMask) !== NoFlags) {
      // 当前节点存在 LayoutMask 标记
      const current = fiber.alternate;
      setCurrentDebugFiberInDEV(fiber);
      try {
        commitLayoutEffectOnFiber(root, current, fiber, committedLanes);
      } catch (error) {
        captureCommitPhaseError(fiber, fiber.return, error);
      }
      resetCurrentDebugFiberInDEV();
    }

    // 这是什么意思？
    if (fiber === subtreeRoot) {
      nextEffect = null;
      return;
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      // 如果存在兄弟节点，就继续 commitLayoutMountEffects_begin 中的遍历
      nextEffect = sibling;
      return;
    }

    // 向上遍历
    nextEffect = fiber.return;
  }
}

function disappearLayoutEffects_begin(subtreeRoot: Fiber) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const firstChild = fiber.child;

    // TODO (Offscreen) Check: flags & (RefStatic | LayoutStatic)
    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case MemoComponent:
      case SimpleMemoComponent: {
        if (
          enableProfilerTimer &&
          enableProfilerCommitHooks &&
          fiber.mode & ProfileMode
        ) {
          try {
            startLayoutEffectTimer();
            commitHookEffectListUnmount(HookLayout, fiber, fiber.return);
          } finally {
            recordLayoutEffectDuration(fiber);
          }
        } else {
          commitHookEffectListUnmount(HookLayout, fiber, fiber.return);
        }
        break;
      }
      case ClassComponent: {
        // TODO (Offscreen) Check: flags & RefStatic
        safelyDetachRef(fiber, fiber.return);

        const instance = fiber.stateNode;
        if (typeof instance.componentWillUnmount === 'function') {
          safelyCallComponentWillUnmount(fiber, fiber.return, instance);
        }
        break;
      }
      case HostComponent: {
        safelyDetachRef(fiber, fiber.return);
        break;
      }
      case OffscreenComponent: {
        // Check if this is a
        const isHidden = fiber.memoizedState !== null;
        if (isHidden) {
          // Nested Offscreen tree is already hidden. Don't disappear
          // its effects.
          disappearLayoutEffects_complete(subtreeRoot);
          continue;
        }
        break;
      }
    }

    // TODO (Offscreen) Check: subtreeFlags & LayoutStatic
    if (firstChild !== null) {
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      disappearLayoutEffects_complete(subtreeRoot);
    }
  }
}

function disappearLayoutEffects_complete(subtreeRoot: Fiber) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    if (fiber === subtreeRoot) {
      nextEffect = null;
      return;
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

function reappearLayoutEffects_begin(subtreeRoot: Fiber) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const firstChild = fiber.child;

    if (fiber.tag === OffscreenComponent) {
      const isHidden = fiber.memoizedState !== null;
      if (isHidden) {
        // Nested Offscreen tree is still hidden. Don't re-appear its effects.
        reappearLayoutEffects_complete(subtreeRoot);
        continue;
      }
    }

    // TODO (Offscreen) Check: subtreeFlags & LayoutStatic
    if (firstChild !== null) {
      // This node may have been reused from a previous render, so we can't
      // assume its return pointer is correct.
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      reappearLayoutEffects_complete(subtreeRoot);
    }
  }
}

function reappearLayoutEffects_complete(subtreeRoot: Fiber) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    // TODO (Offscreen) Check: flags & LayoutStatic
    setCurrentDebugFiberInDEV(fiber);
    try {
      reappearLayoutEffectsOnFiber(fiber);
    } catch (error) {
      captureCommitPhaseError(fiber, fiber.return, error);
    }
    resetCurrentDebugFiberInDEV();

    if (fiber === subtreeRoot) {
      nextEffect = null;
      return;
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      // This node may have been reused from a previous render, so we can't
      // assume its return pointer is correct.
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

export function commitPassiveMountEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null,
): void {
  nextEffect = finishedWork;
  commitPassiveMountEffects_begin(
    finishedWork,
    root,
    committedLanes,
    committedTransitions,
  );
}

function commitPassiveMountEffects_begin(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null,
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const firstChild = fiber.child;
    if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && firstChild !== null) {
      firstChild.return = fiber;
      nextEffect = firstChild;
    } else {
      commitPassiveMountEffects_complete(
        subtreeRoot,
        root,
        committedLanes,
        committedTransitions,
      );
    }
  }
}

function commitPassiveMountEffects_complete(
  subtreeRoot: Fiber,
  root: FiberRoot,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null,
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    if ((fiber.flags & Passive) !== NoFlags) {
      setCurrentDebugFiberInDEV(fiber);
      try {
        commitPassiveMountOnFiber(
          root,
          fiber,
          committedLanes,
          committedTransitions,
        );
      } catch (error) {
        captureCommitPhaseError(fiber, fiber.return, error);
      }
      resetCurrentDebugFiberInDEV();
    }

    if (fiber === subtreeRoot) {
      nextEffect = null;
      return;
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

function commitPassiveMountOnFiber(
  finishedRoot: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes,
  committedTransitions: Array<Transition> | null,
): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        finishedWork.mode & ProfileMode
      ) {
        startPassiveEffectTimer();
        try {
          commitHookEffectListMount(HookPassive | HookHasEffect, finishedWork);
        } finally {
          recordPassiveEffectDuration(finishedWork);
        }
      } else {
        commitHookEffectListMount(HookPassive | HookHasEffect, finishedWork);
      }
      break;
    }
    case HostRoot: {
      if (enableCache) {
        let previousCache: Cache | null = null;
        if (finishedWork.alternate !== null) {
          previousCache = finishedWork.alternate.memoizedState.cache;
        }
        const nextCache = finishedWork.memoizedState.cache;
        // Retain/release the root cache.
        // Note that on initial mount, previousCache and nextCache will be the same
        // and this retain won't occur. To counter this, we instead retain the HostRoot's
        // initial cache when creating the root itself (see createFiberRoot() in
        // ReactFiberRoot.js). Subsequent updates that change the cache are reflected
        // here, such that previous/next caches are retained correctly.
        if (nextCache !== previousCache) {
          retainCache(nextCache);
          if (previousCache != null) {
            releaseCache(previousCache);
          }
        }
      }

      if (enableTransitionTracing) {
        // Get the transitions that were initiatized during the render
        // and add a start transition callback for each of them
        const state = finishedWork.memoizedState;
        // TODO Since it's a mutable field, this should live on the FiberRoot
        if (state.transitions === null) {
          state.transitions = new Set([]);
        }
        const pendingTransitions = state.transitions;
        const pendingSuspenseBoundaries = state.pendingSuspenseBoundaries;

        // Initial render
        if (committedTransitions !== null) {
          committedTransitions.forEach((transition) => {
            addTransitionStartCallbackToPendingTransition({
              transitionName: transition.name,
              startTime: transition.startTime,
            });
            pendingTransitions.add(transition);
          });

          if (
            pendingSuspenseBoundaries === null ||
            pendingSuspenseBoundaries.size === 0
          ) {
            pendingTransitions.forEach((transition) => {
              addTransitionCompleteCallbackToPendingTransition({
                transitionName: transition.name,
                startTime: transition.startTime,
              });
            });
          }

          clearTransitionsForLanes(finishedRoot, committedLanes);
        }

        // If there are no more pending suspense boundaries we
        // clear the transitions because they are all complete.
        if (
          pendingSuspenseBoundaries === null ||
          pendingSuspenseBoundaries.size === 0
        ) {
          state.transitions = null;
        }
      }
      break;
    }
    case LegacyHiddenComponent:
    case OffscreenComponent: {
      if (enableCache) {
        let previousCache: Cache | null = null;
        if (
          finishedWork.alternate !== null &&
          finishedWork.alternate.memoizedState !== null &&
          finishedWork.alternate.memoizedState.cachePool !== null
        ) {
          previousCache = finishedWork.alternate.memoizedState.cachePool.pool;
        }
        let nextCache: Cache | null = null;
        if (
          finishedWork.memoizedState !== null &&
          finishedWork.memoizedState.cachePool !== null
        ) {
          nextCache = finishedWork.memoizedState.cachePool.pool;
        }
        // Retain/release the cache used for pending (suspended) nodes.
        // Note that this is only reached in the non-suspended/visible case:
        // when the content is suspended/hidden, the retain/release occurs
        // via the parent Suspense component (see case above).
        if (nextCache !== previousCache) {
          if (nextCache != null) {
            retainCache(nextCache);
          }
          if (previousCache != null) {
            releaseCache(previousCache);
          }
        }
      }

      if (enableTransitionTracing) {
        const isFallback = finishedWork.memoizedState;
        const queue = (finishedWork.updateQueue: any);
        const rootMemoizedState = finishedRoot.current.memoizedState;

        if (queue !== null) {
          // We have one instance of the pendingSuspenseBoundaries map.
          // We only need one because we update it during the commit phase.
          // We instantiate a new Map if we haven't already
          if (rootMemoizedState.pendingSuspenseBoundaries === null) {
            rootMemoizedState.pendingSuspenseBoundaries = new Map();
          }

          if (isFallback) {
            const transitions = queue.transitions;
            let prevTransitions = finishedWork.memoizedState.transitions;
            // Add all the transitions saved in the update queue during
            // the render phase (ie the transitions associated with this boundary)
            // into the transitions set.
            if (transitions !== null) {
              if (prevTransitions === null) {
                // We only have one instance of the transitions set
                // because we update it only during the commit phase. We
                // will create the set on a as needed basis in the commit phase
                finishedWork.memoizedState.transitions = prevTransitions =
                  new Set();
              }

              transitions.forEach((transition) => {
                prevTransitions.add(transition);
              });
            }
          }
        }

        commitTransitionProgress(finishedRoot, finishedWork);

        finishedWork.updateQueue = null;
      }

      break;
    }
    case CacheComponent: {
      if (enableCache) {
        let previousCache: Cache | null = null;
        if (finishedWork.alternate !== null) {
          previousCache = finishedWork.alternate.memoizedState.cache;
        }
        const nextCache = finishedWork.memoizedState.cache;
        // Retain/release the cache. In theory the cache component
        // could be "borrowing" a cache instance owned by some parent,
        // in which case we could avoid retaining/releasing. But it
        // is non-trivial to determine when that is the case, so we
        // always retain/release.
        if (nextCache !== previousCache) {
          retainCache(nextCache);
          if (previousCache != null) {
            releaseCache(previousCache);
          }
        }
      }
      break;
    }
  }
}

export function commitPassiveUnmountEffects(firstChild: Fiber): void {
  nextEffect = firstChild;
  commitPassiveUnmountEffects_begin();
}

function commitPassiveUnmountEffects_begin() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const child = fiber.child;

    if ((nextEffect.flags & ChildDeletion) !== NoFlags) {
      const deletions = fiber.deletions;
      if (deletions !== null) {
        for (let i = 0; i < deletions.length; i++) {
          const fiberToDelete = deletions[i];
          nextEffect = fiberToDelete;
          commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
            fiberToDelete,
            fiber,
          );
        }

        if (deletedTreeCleanUpLevel >= 1) {
          // A fiber was deleted from this parent fiber, but it's still part of
          // the previous (alternate) parent fiber's list of children. Because
          // children are a linked list, an earlier sibling that's still alive
          // will be connected to the deleted fiber via its `alternate`:
          //
          //   live fiber
          //   --alternate--> previous live fiber
          //   --sibling--> deleted fiber
          //
          // We can't disconnect `alternate` on nodes that haven't been deleted
          // yet, but we can disconnect the `sibling` and `child` pointers.
          const previousFiber = fiber.alternate;
          if (previousFiber !== null) {
            let detachedChild = previousFiber.child;
            if (detachedChild !== null) {
              previousFiber.child = null;
              do {
                const detachedSibling = detachedChild.sibling;
                detachedChild.sibling = null;
                detachedChild = detachedSibling;
              } while (detachedChild !== null);
            }
          }
        }

        nextEffect = fiber;
      }
    }

    if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffects_complete();
    }
  }
}

function commitPassiveUnmountEffects_complete() {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    if ((fiber.flags & Passive) !== NoFlags) {
      setCurrentDebugFiberInDEV(fiber);
      commitPassiveUnmountOnFiber(fiber);
      resetCurrentDebugFiberInDEV();
    }

    const sibling = fiber.sibling;
    if (sibling !== null) {
      sibling.return = fiber.return;
      nextEffect = sibling;
      return;
    }

    nextEffect = fiber.return;
  }
}

function commitPassiveUnmountOnFiber(finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        finishedWork.mode & ProfileMode
      ) {
        startPassiveEffectTimer();
        commitHookEffectListUnmount(
          HookPassive | HookHasEffect,
          finishedWork,
          finishedWork.return,
        );
        recordPassiveEffectDuration(finishedWork);
      } else {
        commitHookEffectListUnmount(
          HookPassive | HookHasEffect,
          finishedWork,
          finishedWork.return,
        );
      }
      break;
    }
  }
}

function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
  deletedSubtreeRoot: Fiber,
  nearestMountedAncestor: Fiber | null,
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;

    // Deletion effects fire in parent -> child order
    // TODO: Check if fiber has a PassiveStatic flag
    setCurrentDebugFiberInDEV(fiber);
    commitPassiveUnmountInsideDeletedTreeOnFiber(fiber, nearestMountedAncestor);
    resetCurrentDebugFiberInDEV();

    const child = fiber.child;
    // TODO: Only traverse subtree if it has a PassiveStatic flag. (But, if we
    // do this, still need to handle `deletedTreeCleanUpLevel` correctly.)
    if (child !== null) {
      child.return = fiber;
      nextEffect = child;
    } else {
      commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
        deletedSubtreeRoot,
      );
    }
  }
}

function commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
  deletedSubtreeRoot: Fiber,
) {
  while (nextEffect !== null) {
    const fiber = nextEffect;
    const sibling = fiber.sibling;
    const returnFiber = fiber.return;

    if (deletedTreeCleanUpLevel >= 2) {
      // Recursively traverse the entire deleted tree and clean up fiber fields.
      // This is more aggressive than ideal, and the long term goal is to only
      // have to detach the deleted tree at the root.
      detachFiberAfterEffects(fiber);
      if (fiber === deletedSubtreeRoot) {
        nextEffect = null;
        return;
      }
    } else {
      // This is the default branch (level 0). We do not recursively clear all
      // the fiber fields. Only the root of the deleted subtree.
      if (fiber === deletedSubtreeRoot) {
        detachFiberAfterEffects(fiber);
        nextEffect = null;
        return;
      }
    }

    if (sibling !== null) {
      sibling.return = returnFiber;
      nextEffect = sibling;
      return;
    }

    nextEffect = returnFiber;
  }
}

function commitPassiveUnmountInsideDeletedTreeOnFiber(
  current: Fiber,
  nearestMountedAncestor: Fiber | null,
): void {
  switch (current.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent: {
      if (
        enableProfilerTimer &&
        enableProfilerCommitHooks &&
        current.mode & ProfileMode
      ) {
        startPassiveEffectTimer();
        commitHookEffectListUnmount(
          HookPassive,
          current,
          nearestMountedAncestor,
        );
        recordPassiveEffectDuration(current);
      } else {
        commitHookEffectListUnmount(
          HookPassive,
          current,
          nearestMountedAncestor,
        );
      }
      break;
    }
    // TODO: run passive unmount effects when unmounting a root.
    // Because passive unmount effects are not currently run,
    // the cache instance owned by the root will never be freed.
    // When effects are run, the cache should be freed here:
    // case HostRoot: {
    //   if (enableCache) {
    //     const cache = current.memoizedState.cache;
    //     releaseCache(cache);
    //   }
    //   break;
    // }
    case LegacyHiddenComponent:
    case OffscreenComponent: {
      if (enableCache) {
        if (
          current.memoizedState !== null &&
          current.memoizedState.cachePool !== null
        ) {
          const cache: Cache = current.memoizedState.cachePool.pool;
          // Retain/release the cache used for pending (suspended) nodes.
          // Note that this is only reached in the non-suspended/visible case:
          // when the content is suspended/hidden, the retain/release occurs
          // via the parent Suspense component (see case above).
          if (cache != null) {
            retainCache(cache);
          }
        }
      }
      break;
    }
    case CacheComponent: {
      if (enableCache) {
        const cache = current.memoizedState.cache;
        releaseCache(cache);
      }
      break;
    }
  }
}

// TODO: Reuse reappearLayoutEffects traversal here?
function invokeLayoutEffectMountInDEV(fiber: Fiber): void {
  if (__DEV__ && enableStrictEffects) {
    // We don't need to re-check StrictEffectsMode here.
    // This function is only called if that check has already passed.
    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        try {
          commitHookEffectListMount(HookLayout | HookHasEffect, fiber);
        } catch (error) {
          captureCommitPhaseError(fiber, fiber.return, error);
        }
        break;
      }
      case ClassComponent: {
        const instance = fiber.stateNode;
        try {
          instance.componentDidMount();
        } catch (error) {
          captureCommitPhaseError(fiber, fiber.return, error);
        }
        break;
      }
    }
  }
}

function invokePassiveEffectMountInDEV(fiber: Fiber): void {
  if (__DEV__ && enableStrictEffects) {
    // We don't need to re-check StrictEffectsMode here.
    // This function is only called if that check has already passed.
    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        try {
          commitHookEffectListMount(HookPassive | HookHasEffect, fiber);
        } catch (error) {
          captureCommitPhaseError(fiber, fiber.return, error);
        }
        break;
      }
    }
  }
}

function invokeLayoutEffectUnmountInDEV(fiber: Fiber): void {
  if (__DEV__ && enableStrictEffects) {
    // We don't need to re-check StrictEffectsMode here.
    // This function is only called if that check has already passed.
    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        try {
          commitHookEffectListUnmount(
            HookLayout | HookHasEffect,
            fiber,
            fiber.return,
          );
        } catch (error) {
          captureCommitPhaseError(fiber, fiber.return, error);
        }
        break;
      }
      case ClassComponent: {
        const instance = fiber.stateNode;
        if (typeof instance.componentWillUnmount === 'function') {
          safelyCallComponentWillUnmount(fiber, fiber.return, instance);
        }
        break;
      }
    }
  }
}

function invokePassiveEffectUnmountInDEV(fiber: Fiber): void {
  if (__DEV__ && enableStrictEffects) {
    // We don't need to re-check StrictEffectsMode here.
    // This function is only called if that check has already passed.
    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        try {
          commitHookEffectListUnmount(
            HookPassive | HookHasEffect,
            fiber,
            fiber.return,
          );
        } catch (error) {
          captureCommitPhaseError(fiber, fiber.return, error);
        }
      }
    }
  }
}

export {
  commitPlacement,
  commitAttachRef,
  commitDetachRef,
  invokeLayoutEffectMountInDEV,
  invokeLayoutEffectUnmountInDEV,
  invokePassiveEffectMountInDEV,
  invokePassiveEffectUnmountInDEV,
};
