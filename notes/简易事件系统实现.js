class SyntheticEvent {
  _stopPropagation = false;

  constructor(e) {
    this.nativeEvent = e;
  }

  stopPropagation() {
    this._stopPropagation = true;
    // 调用原生事件的 stopPropagation 方法
    this.nativeEvent.stopPropagation?.();
  }
}

const addEvent = (container, type) => {
  container.addEventListener(type, (e) => {
    dispatchEvent(e, type.toUpperCase(), container);
  });
};

const root = document.querySelector("#root");
// ReactDOM.createRoot(root).render(jsx);
addEvent(root, "click");

const dispatchEvent = (e, type) => {
  // 包装合成事件
  const se = new SyntheticEvent(e);
  const ele = e.target;

  // 通过 DOM 元素找到对应的 fiberNode
  let fiber;
  for (const prop in ele) {
    if (prop.toLocaleLowerCase().includes("fiber")) {
      fiber = ele[prop];
    }
  }

  // 收集路径中"该事件的所有回调函数"
  const paths = collectPaths(type, fiber);

  // 捕获阶段的实现
  triggerEventFlow(paths, `${type}CAPTURE`, se);

  // 冒泡阶段的实现
  if (!se._stopPropagation) triggerEventFlow(paths.reverse(), type, se);
};

/**
 * 收集路径中的事件回调函数
 * @param type
 * @param begin
 * @return {[]}
 */
const collectPaths = (type, begin) => {
  // [触发事件的fiberNode的回调删除, 父fiberNode的回调函数, ...祖先...]
  const paths = [];

  // 如果不是 HostRootFiber 就一直向上遍历
  while (begin.tag !== 3) {
    const { memoizedProps, tag } = begin;

    // 5 代表 DOM 元素对应 fiberNode
    if (tag === 5) {
      const eventName = `on${type}`.toUpperCase();
      // 如果包含对应的事件回调， 则保存在 paths 中
      if (memoizedProps && memoizedProps.hasOwnProperty(eventName)) {
        const pathNode = {};
        pathNode[type.toUpperCase()] = memoizedProps[eventName];
        paths.push(pathNode);
      }
    }

    begin = begin.return;
  }
  return paths;
};

/**
 * 捕获、冒泡阶段的实现
 * @param paths
 * @param type
 * @param se
 */
const triggerEventFlow = (paths, type, se) => {
  // 模拟捕获阶段 需要从后向前遍历
  for (let i = 0; i < paths.length; i--) {
    const pathNode = paths[i];
    const callback = pathNode[type];

    // 存在回调函数， 传入合成事件并执行
    if (callback) callback.call(null, se);
    // 如果执行了 stopPropagation 取消接下来的遍历
    if (se._stopPropagation) break;
  }
};
