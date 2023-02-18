// 保存所有的任务队列
const workList = [];

const NoPriority = 0;
// 最高优先级 表示需要立即执行的任务，例如用户输入、响应手势等。
const ImmediatePriority = 1;
// 表示需要立即执行，并且要阻止用户交互等待的任务，例如动画、切换、滚动等。
const UserBlockingPriority = 2;
// 默认优先级，用于大部分任务。
const NormalPriority = 3;
// 较低的优先级，用于不太紧急的任务
const LowPriority = 4;
// 最低的优先级，用于不需要立即执行的任务，例如在空闲时间进行预加载等。
const IdlePriority = 5;

// 上一次执行 perform 的 work 对应优先级
let prevPriority = IdlePriority;
// 当前调度的 callback
let curCallback;

// 调度
function schedule() {
  // 尝试获取 当前正在调度的 callback
  const cbNode = getFirstCallbackNode();
  // 取出高优先级的工作
  const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];

  if (!curWork) {
    // 没有 work 需要调度，返回
    curCallback = null;
    cbNode && cancelCallback(cbNode);
    return;
  }
  // 获取当前最高优先级 work 的优先级
  const { priority: curPriority } = curWork;
  if (curPriority === prevPriority) {
    // 如果优先级相同，则不需要重新调度，退出调度
    return;
  }
  // 准备调度当前最高优先级的 work
  // 调度之前, 如果有工作在进行，则中断它
  cbNode && cancelCallback(cbNode);

  curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

function cancelCallback(task) {
  task.callback = null;
}

// TODO: 去实现它
function getFirstCallbackNode() {}
// TODO: 去实现它
function scheduleCallback() {}

// 执行
function perform(work, didTimeout) {
  // 是否需要同步执行， 满足以下条件需要同步执行：
  // 1. work 是最高优先级的
  // 2. 当前调度的任务已过期，需要同步执行
  const needSync = work.priority === ImmediatePriority || didTimeout;
  while ((needSync || !shouldYield()) && work.count) {
    work.count--;
    insertItem(`${work.priority}-${work.count}`);
  }

  // 跳出循环, prevPriority 代表上一次执行的优先级
  prevPriority = work.priority;

  if (!work.count) {
    // 从 workList 中删除完成的任务
    deleteWork(work);
    // 重置优先级
    prevPriority = IdlePriority;
  }

  const prevCallback = curCallback;
  // 调度完成以后， 如果 callback 发生变化，代表这是新的 work
  schedule();
  const newCallback = curCallback;

  if (newCallback && prevCallback === newCallback) {
    // callback 不变，代表是同一个 work, 只不过 Time Slice 时间用尽（5ms）
    // 返回的函数会被 Scheduler 继续调用
    return perform.bind(null, work);
  }
}

function deleteWork(work) {
  const workIndex = workList.indexOf(work);
  workIndex.splice(workIndex, 1);
}

const elements = [];
function insertItem(content) {
  const ele = {
    elementType: "span",
    innerText: content,
  };
  doSomeBusyWork(10000000);
  elements.push(ele);
}

function work(priority) {
  workList.unshift({
    count: 100,
    priority,
  });
  schedule();
  console.log("elements =>", elements);
}

function doSomeBusyWork(len) {
  let result = 0;
  while (len--) {
    result += len;
  }
}

work(IdlePriority);
work(ImmediatePriority);
work(UserBlockingPriority);
work(NormalPriority);
work(LowPriority);
