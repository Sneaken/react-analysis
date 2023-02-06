let callbackNode;
let workInProgressHook;
let isMount = true;

// App 组件 的 fiber 对象
const fiber = {
  // 保存该 FC 对应 的 hook 列表
  memoizedState: null,
  // 指向 App 函数
  stateNode: App,
};

function schedule() {
  if (callbackNode) {
    // 存在其他调度，取消它
    clearTimeout(callbackNode);
  }

  // 开始调度
  callbackNode = setTimeout(() => {
    // 更新前将 wip hook 重置为 fiber 保存的第一个 hook
    workInProgressHook = fiber.memoizedState;
    // 触发组件 render
    globalThis.app = fiber.stateNode();
    // 组件首次 render 为 mount, 以后再触发的更新为 update
    isMount = false;
  });
}

function dispatchSetState(queue, action) {
  // 创建 update
  const update = {
    // 更新执行的函数
    action,
    // 与同一个 Hook 的 其他 update 形成环状链表
    next: null,
  };

  if (!queue.pending) {
    update.next = update;
  } else {
    update.next = queue.pending.next;
    queue.pending.next = update;
  }

  queue.pending = update;

  // 模拟调度更新
  schedule();
}

// 不足之处
// 1. 没有实现 update 的优先级机制
// 2. 没有完善的调度流程，Fiber架构
// 3. 没有处理边界情况，比如"render 阶段触更新"
function useState(initialState) {
  // 当前 useState 使用的 hook 会被 赋值给该变量
  let hook;

  if (isMount) {
    // mount 时，创建 hook
    hook = {
      // 保存 update 的 queue
      queue: {
        pending: null,
      },
      // 保存 hook 对应的 state
      memoizedState: initialState,
      // 与下一个 hook 链接形成单向无环链表
      next: null,
    };

    // 将 hook 插入 fiber.memoizedState 链表末尾
    if (!fiber.memoizedState) {
      // 第一个hook
      fiber.memoizedState = hook;
    } else {
      // 其余的hook追加到链表末尾
      workInProgressHook.next = hook;
    }

    // wip hook 指向该 hook
    workInProgressHook = hook;
  } else {
    // update 时，从 wip hook 中取出该 useState 对应的 hook
    // 因为已经在调度的时候重置了 wip hook，
    // 所有 这里的hook 其实就是按顺序取的
    hook = workInProgressHook;
    // wip hook 继续指向下一个 hook
    workInProgressHook = workInProgressHook.next;
  }

  if (!hook) {
    throw new Error("hook 不存在");
  }

  // update 执行前的初始化 state
  let baseState = hook.memoizedState;
  if (hook.queue.pending) {
    // 获取 update 环状单向链表中第一个 update
    let firstUpdate = hook.queue.pending.next;

    do {
      // 执行 update action
      const action = firstUpdate.action;
      baseState = action(baseState);
      firstUpdate = firstUpdate.next;
      // 最后一个 update 执行完后跳出循环
    } while (firstUpdate !== hook.queue.pending.next);

    // 清空 queue.pending
    hook.queue.pending = undefined;
  }

  // 将 update action 执行完后的state 作为 memoizedState
  hook.memoizedState = baseState;

  return [baseState, dispatchSetState.bind(null, hook.queue)];
}

function App() {
  const [value, setValue] = useState(1);
  console.log(`${isMount ? "mount" : "update"}: value => ${value}`);

  return {
    click() {
      setValue((value) => value + 1);
    },
  };
}

function sleep() {
  return new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

async function main() {
  globalThis.app = App();
  globalThis.app?.click();
  await sleep();
  globalThis.app?.click();
  await sleep();
  globalThis.app?.click();
  await sleep();
  globalThis.app?.click();
}
main();
