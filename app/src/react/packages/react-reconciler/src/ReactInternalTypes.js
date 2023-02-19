/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Source} from 'shared/ReactElementType';
import type {
  MutableSource,
  MutableSourceGetSnapshotFn,
  MutableSourceSubscribeFn,
  MutableSourceVersion,
  ReactContext,
  RefObject,
  StartTransitionOptions,
  Wakeable,
} from 'shared/ReactTypes';
import type {
  NoTimeout,
  SuspenseInstance,
  TimeoutHandle,
} from './ReactFiberHostConfig';
import type {WorkTag} from './ReactWorkTags';
import type {TypeOfMode} from './ReactTypeOfMode';
import type {Flags} from './ReactFiberFlags';
import type {Lane, LaneMap, Lanes} from './ReactFiberLane.old';
import type {RootTag} from './ReactRootTags';
import type {Cache} from './ReactFiberCacheComponent.old';
import type {Transition} from './ReactFiberTracingMarkerComponent.new';
import type {ConcurrentUpdate} from './ReactFiberConcurrentUpdates.new';

// Unwind Circular: moved from ReactFiberHooks.old
export type HookType =
  | 'useState'
  | 'useReducer'
  | 'useContext'
  | 'useRef'
  | 'useEffect'
  | 'useInsertionEffect'
  | 'useLayoutEffect'
  | 'useCallback'
  | 'useMemo'
  | 'useImperativeHandle'
  | 'useDebugValue'
  | 'useDeferredValue'
  | 'useTransition'
  | 'useMutableSource'
  | 'useSyncExternalStore'
  | 'useId'
  | 'useCacheRefresh';

export type ContextDependency<T> = {
  context: ReactContext<T>,
  next: ContextDependency<mixed> | null,
  memoizedValue: T,
  ...
};

export type Dependencies = {
  lanes: Lanes,
  firstContext: ContextDependency<mixed> | null,
  ...
};

// A Fiber is work on a Component that needs to be done or was done. There can
// be more than one per component.
export type Fiber = {|
  // These first fields are conceptually members of an Instance. This used to
  // be split into a separate type and intersected with the other Fiber fields,
  // but until Flow fixes its intersection bugs, we've merged them into a
  // single type.

  // An Instance is shared between all versions of a component. We can easily
  // break this out into a separate object to avoid copying so much to the
  // alternate versions of the tree. We put this on a single object for now to
  // minimize the number of objects created during the initial render.

  // Tag identifying the type of fiber.
  // 标记不同的组件类型
  tag: WorkTag,

  // Unique identifier of this child.
  // ReactElement 里面的 key
  key: null | string,

  // The value of element.type which is used to preserve the identity during
  // reconciliation of this child.
  // ReactElement.type
  elementType: any,

  // The resolved function/class/ associated with this fiber.
  type: any,

  // The local state associated with this fiber.
  // 跟当前Fiber相关本地状态
  // FunctionComponent: DOM
  // ClassComponent: Class Instance
  // HostRoot: FiberRoot
  stateNode: any,

  // Conceptual aliases
  // parent : Instance -> return The parent happens to be the same as the
  // return fiber since we've merged the fiber and instance.

  // Remaining fields belong to Fiber

  // The Fiber to return to after finishing processing this one.
  // This is effectively the parent, but there can be multiple parents (two)
  // so this is only the parent of the thing we're currently processing.
  // It is conceptually the same as the return address of a stack frame.
  // 该 fiber 的 父节点
  return: Fiber | null,

  // Singly Linked List Tree Structure.
  // 该 fiber 的 第一个子节点
  child: Fiber | null,
  // 该 fiber 右边的兄弟节点
  sibling: Fiber | null,
  // 是 父节点的第几个子节点
  index: number,

  // The ref last used to attach this node.
  // I'll avoid adding an owner field for prod and model that as functions.
  // ref 属性
  ref:
    | null
    | (((handle: mixed) => void) & {_stringRef: ?string, ...})
    | RefObject,

  // Input is the data coming into process this fiber. Arguments. Props.
  // 新的变动带来的新的props(待更新的props)
  // HostText 就是 string
  // Fragment 就是 ReactFragment
  // HostPortal 就是 ReactNodeList | []
  // OffscreenComponent | LegacyHiddenComponent 就是 OffscreenProps
  // 其他情况就是 any 或者 null
  pendingProps: any, // This type will be more specific once we overload the tag.
  // 上一次渲染完成之后的 props
  memoizedProps: any, // The props used to create the output.

  // A queue of state updates and callbacks.
  // 该 Fiber 对应的组件产生的 Update 会存放在这个队列里面
  // HostComponent: 变更产生的键值对
  // FC: FunctionComponentUpdateQueue
  // ClassComponent: UpdateQueue
  updateQueue: mixed,

  // The state used to create the output
  // 上一次渲染完成之后的 state
  // FC 组件: fiberNode 保存的 hooks 链表中第一个 hook 的数据
  // SuspenseComponent: SuspenseState
  // HostRoot: RootState
  memoizedState: any,

  // Dependencies (contexts, events) for this fiber, if it has any
  // context 相关的内容
  dependencies: Dependencies | null,

  // Bitfield that describes properties about the fiber and its subtree. E.g.
  // the ConcurrentMode flag indicates whether the subtree should be async-by-
  // default. When a fiber is created, it inherits the mode of its
  // parent. Additional flags can be set at creation time, but after that the
  // value should remain unchanged throughout the fiber's lifetime, particularly
  // before its child fibers are created.
  mode: TypeOfMode,

  // Effect
  // 标记这个 fiber 节点存在哪些操作
  flags: Flags,
  // 标记这个 fiber 节点的子孙节点中存在哪些操作
  subtreeFlags: Flags,
  // 存储需要删除的 fiber 节点
  deletions: Array<Fiber> | null,

  // Singly linked list fast path to the next fiber with side-effects.
  nextEffect: Fiber | null,

  // The first and last fiber with side-effect within this subtree. This allows
  // us to reuse a slice of the linked list when we reuse the work done within
  // this fiber.
  // 子树中第一个 side effect
  firstEffect: Fiber | null,
  // 子树中最后一个 side effect
  lastEffect: Fiber | null,

  // 本次更新后该 fiberNode 中 "待执行的 lanes"
  lanes: Lanes,
  // 本次更新后该 fiberNode 子孙中 "待执行的lanes"
  childLanes: Lanes,

  // This is a pooled version of a Fiber. Every fiber that gets updated will
  // eventually have a pair. There are cases when we can clean up pairs to save
  // memory if we need to.
  // work in progress fiber
  alternate: Fiber | null,

  // 后面都是一些调试相关的属性

  // Time spent rendering this Fiber and its descendants for the current update.
  // This tells us how well the tree makes use of sCU for memoization.
  // It is reset to 0 each time we render and only updated when we don't bailout.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualDuration?: number,

  // If the Fiber is currently active in the "render" phase,
  // This marks the time at which the work began.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualStartTime?: number,

  // Duration of the most recent render time for this Fiber.
  // This value is not updated when we bailout for memoization purposes.
  // This field is only set when the enableProfilerTimer flag is enabled.
  selfBaseDuration?: number,

  // Sum of base times for all descendants of this Fiber.
  // This value bubbles up during the "complete" phase.
  // This field is only set when the enableProfilerTimer flag is enabled.
  treeBaseDuration?: number,

  // Conceptual aliases
  // workInProgress : Fiber ->  alternate The alternate used for reuse happens
  // to be the same as work in progress.
  // __DEV__ only

  _debugSource?: Source | null,
  _debugOwner?: Fiber | null,
  _debugIsCurrentlyTiming?: boolean,
  _debugNeedsRemount?: boolean,

  // Used to verify that the order of hooks does not change between renders.
  _debugHookTypes?: Array<HookType> | null,
|};

type BaseFiberRootProperties = {|
  // The type of root (legacy, batched, concurrent, etc.)
  // LegacyRoot ｜ ConcurrentRoot
  tag: RootTag,

  // Any additional information from the host associated with this root.
  // 由宿主环境提供的容器节点
  containerInfo: any,
  // Used only by persistent updates.
  // 用于持久更新的一个属性，表示这个 FiberRootNode 下挂载的待更新子节点
  pendingChildren: any,
  // The currently active root fiber. This is the mutable root of the tree.
  // 当前树的根节点 Fiber 对象，表示当前工作在这个树上
  current: Fiber,
  // 一个 Map 对象，存储等待的异步更新（即React中所谓的“ping”）
  pingCache: WeakMap<Wakeable, Set<mixed>> | Map<Wakeable, Set<mixed>> | null,

  // A finished work-in-progress HostRoot that's ready to be committed.
  // 表示已经完成工作的Fiber树的根节点
  finishedWork: Fiber | null,
  // Timeout handle returned by setTimeout. Used to cancel a pending timeout, if
  // it's superseded by a new one.
  timeoutHandle: TimeoutHandle | NoTimeout,
  // Top context object, used by renderSubtreeIntoContainer
  // 用于 renderSubtreeIntoContainer 方法的上下文对象
  context: Object | null,
  // 表示等待更新到下一次更新时要设置的上下文
  pendingContext: Object | null,

  // Used by useMutableSource hook to avoid tearing during hydration.
  // 一个数组，存储惰性的数据源
  mutableSourceEagerHydrationData?: Array<
    MutableSource<any> | MutableSourceVersion,
  > | null,

  // Node returned by Scheduler.scheduleCallback. Represents the next rendering
  // task that the root will work on.
  // 下一个要渲染的任务的节点，表示下一个任务是什么，也就是下一个要渲染的组件是什么
  callbackNode: *,
  // 表示回调函数的优先级，即任务的优先级
  callbackPriority: Lane,
  // 交互发生的时间
  eventTimes: LaneMap<number>,
  // 存储过期时间的时间戳
  expirationTimes: LaneMap<number>,
  // 一个 Map 对象，存储已经隐藏的更新。
  hiddenUpdates: LaneMap<Array<ConcurrentUpdate> | null>,
  // 当前 FiberRootNode 下 "待执行的 update 对应的 lanes" 的集合
  pendingLanes: Lanes,
  // 当前 FiberRootNode 下 "由于 Suspense 而挂起的 update 对应的 lane" 的集合
  suspendedLanes: Lanes,
  // 当前 FiberRootNode 下 "由于请求成功，Suspense 取消挂起的 update 对应 lane" 的集合
  pingedLanes: Lanes,
  // 当前 FiberRootNode 下 "由于过期，需要同步，不可中断执行 render 阶段的 update 对应 lane" 的集合
  expiredLanes: Lanes,
  // 存储当前正在使用 Mutable Sources 的 update 所对应的所有 lane 的集合
  mutableReadLanes: Lanes,
  // 已经完成的更新所对应的所有 lane 的集合

  finishedLanes: Lanes,
  // 当前 FiberRootNode 与其他 FiberRootNode 共享的 lane 集合
  entangledLanes: Lanes,
  // 保存所有当前 FiberRootNode 与其他 FiberRootNode 之间关联的 lane 的集合
  entanglements: LaneMap<Lanes>,

  // 可复用的内存池
  pooledCache: Cache | null,
  // 已经归还到内存池中的 lane 集合
  pooledCacheLanes: Lanes,

  // TODO: In Fizz, id generation is specific to each server config. Maybe we
  // should do this in Fiber, too? Deferring this decision for now because
  // there's no other place to store the prefix except for an internal field on
  // the public createRoot object, which the fiber tree does not currently have
  // a reference to.
  // 一个字符串，用于在生成唯一标识符时作为前缀
  identifierPrefix: string,

  // 处理可恢复错误的回调函数，当React在开发模式下遇到可恢复错误时，将调用此函数。
  onRecoverableError: (
    error: mixed,
    errorInfo: {digest?: ?string, componentStack?: ?string},
  ) => void,
|};

// The following attributes are only used by DevTools and are only present in DEV builds.
// They enable DevTools Profiler UI to show which Fiber(s) scheduled a given commit.
type UpdaterTrackingOnlyFiberRootProperties = {|
  // 一个集合，包含了所有已经执行过 unbatchedUpdates 的 Fiber 节点，这些节点的更新在未来可能会被批处理
  memoizedUpdaters: Set<Fiber>,
  // 一个包含 LaneMap 的集合，其中键是 Lanes，值是一个包含了所有 pending 更新的 Fiber 集合，这些更新在未来会被批处理。
  pendingUpdatersLaneMap: LaneMap<Set<Fiber>>,
|};

export type SuspenseHydrationCallbacks = {
  onHydrated?: (suspenseInstance: SuspenseInstance) => void,
  onDeleted?: (suspenseInstance: SuspenseInstance) => void,
  ...
};

// The follow fields are only used by enableSuspenseCallback for hydration.
type SuspenseCallbackOnlyFiberRootProperties = {|
  // 一个可选的对象，包含挂起时要执行的回调。
  // 如果这个对象不是 null，那么 Fiber Root 表示的根节点就是一个服务器渲染的根节点，而不是客户端根节点。
  // 当从服务器渲染的标记中解水合一个具有 suspense 标记的子树时，将使用这些回调来确定何时解水合该子树。
  // 如果这个对象是 null，则 Fiber Root 表示的根节点是客户端根节点，且不需要执行回调。
  //
  // 在 React 中，当一个 <Suspense> 组件的子组件在渲染过程中被挂起时，React 需要暂停渲染，直到该组件完成加载。
  // 如果这个 <Suspense> 组件是在服务器上渲染的，那么 React 会在服务端将其标记为挂起状态，然后在客户端解水合该组件时恢复渲染。
  // 在这个过程中，需要使用 hydrationCallbacks 属性来通知 React 何时可以解水合这个组件。
  hydrationCallbacks: null | SuspenseHydrationCallbacks,
|};

export type TransitionTracingCallbacks = {
  onTransitionStart?: (transitionName: string, startTime: number) => void,
  onTransitionProgress?: (
    transitionName: string,
    startTime: number,
    currentTime: number,
    pending: Array<{name: null | string}>,
  ) => void,
  onTransitionIncomplete?: (
    transitionName: string,
    startTime: number,
    deletions: Array<{
      type: string,
      name?: string,
      newName?: string,
      endTime: number,
    }>,
  ) => void,
  onTransitionComplete?: (
    transitionName: string,
    startTime: number,
    endTime: number,
  ) => void,
  onMarkerProgress?: (
    transitionName: string,
    marker: string,
    startTime: number,
    currentTime: number,
    pending: Array<{name: null | string}>,
  ) => void,
  onMarkerIncomplete?: (
    transitionName: string,
    marker: string,
    startTime: number,
    deletions: Array<{
      type: string,
      name?: string,
      newName?: string,
      endTime: number,
    }>,
  ) => void,
  onMarkerComplete?: (
    transitionName: string,
    marker: string,
    startTime: number,
    endTime: number,
  ) => void,
};

// The following fields are only used in transition tracing in Profile builds
type TransitionTracingOnlyFiberRootProperties = {|
  // 如果开启了 transitionTracing，则包含一个 transitionTracing 的 callback 函数，
  // 这个函数会在每次执行状态更新时被调用，用于跟踪这次更新的状态过渡。
  transitionCallbacks: null | TransitionTracingCallbacks,
  // 保存了所有涉及到状态过渡的lanes，这个数组的每个元素都是一个数组，包含了在这个 transition 内被打上的所有 lanes
  transitionLanes: Array<Array<Transition> | null>,
|};

// Exported FiberRoot type includes all properties,
// To avoid requiring potentially error-prone :any casts throughout the project.
// The types are defined separately within this file to ensure they stay in sync.
// 整个应用的状态树。
// 它还包含了应用的一些全局信息，比如当前的状态、事件处理、组件的渲染等。
export type FiberRoot = {
  ...BaseFiberRootProperties,
  ...SuspenseCallbackOnlyFiberRootProperties,
  ...UpdaterTrackingOnlyFiberRootProperties,
  ...TransitionTracingOnlyFiberRootProperties,
  ...
};

type BasicStateAction<S> = ((S) => S) | S;
type Dispatch<A> = (A) => void;

export type Dispatcher = {|
  getCacheSignal?: () => AbortSignal,
  getCacheForType?: <T>(resourceType: () => T) => T,
  readContext<T>(context: ReactContext<T>): T,
  useState<S>(initialState: (() => S) | S): [S, Dispatch<BasicStateAction<S>>],
  useReducer<S, I, A>(
    reducer: (S, A) => S,
    initialArg: I,
    init?: (I) => S,
  ): [S, Dispatch<A>],
  useContext<T>(context: ReactContext<T>): T,
  useRef<T>(initialValue: T): {|current: T|},
  useEffect(
    create: () => (() => void) | void,
    deps: Array<mixed> | void | null,
  ): void,
  useInsertionEffect(
    create: () => (() => void) | void,
    deps: Array<mixed> | void | null,
  ): void,
  useLayoutEffect(
    create: () => (() => void) | void,
    deps: Array<mixed> | void | null,
  ): void,
  useCallback<T>(callback: T, deps: Array<mixed> | void | null): T,
  useMemo<T>(nextCreate: () => T, deps: Array<mixed> | void | null): T,
  useImperativeHandle<T>(
    ref: {|current: T | null|} | ((inst: T | null) => mixed) | null | void,
    create: () => T,
    deps: Array<mixed> | void | null,
  ): void,
  useDebugValue<T>(value: T, formatterFn: ?(value: T) => mixed): void,
  useDeferredValue<T>(value: T): T,
  useTransition(): [
    boolean,
    (callback: () => void, options?: StartTransitionOptions) => void,
  ],
  useMutableSource<Source, Snapshot>(
    source: MutableSource<Source>,
    getSnapshot: MutableSourceGetSnapshotFn<Source, Snapshot>,
    subscribe: MutableSourceSubscribeFn<Source, Snapshot>,
  ): Snapshot,
  useSyncExternalStore<T>(
    subscribe: (() => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ): T,
  useId(): string,
  useCacheRefresh?: () => <T>(?() => T, ?T) => void,

  unstable_isNewReconciler?: boolean,
|};
