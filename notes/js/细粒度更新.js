const log = console.log;
let count = 0;
console.log = function (...params) {
  log.apply(console, params);
  log(++count);
};

// 保存 effect 调用栈
const effectStack = [];

function subscribe(effect, subs) {
  // 建立订阅关系
  subs.add(effect);
  // 依赖关系建立
  effect.deps.add(subs);
}

function cleanup(effect) {
  // 从该 effect 订阅的所有 state 对应的 subs 中删除该 effect
  for (const subs of effect.deps) {
    subs.delete(effect);
  }
  // 将该 effect 依赖的所有 state 对应的 subs 移除
  effect.deps.clear();
}

function useState(value) {
  // 保存订阅该 state 变化的 effect
  const subs = new Set();

  const getter = () => {
    // 获取当前上下文的 effect
    const effect = effectStack[effectStack.length - 1];
    if (effect) {
      // 建立订阅发布关系
      subscribe(effect, subs);
    }
    return value;
  };

  const setter = (newValue) => {
    value = newValue;
    for (const effect of [...subs]) {
      effect.execute();
    }
  };

  return [getter, setter];
}

function useEffect(callback) {
  const execute = () => {
    // 重置依赖
    cleanup(effect);
    // 将当前的 effect 推入栈顶
    effectStack.push(effect);

    try {
      callback();
    } finally {
      // effect 出栈
      effectStack.pop();
    }
  };
  const effect = {
    execute,
    deps: new Set(),
  };
  execute();
}

function useMemo(callback) {
  const [s, set] = useState();
  useEffect(() => set(callback()));
  return s;
}

const [a, setA] = useState("a");
const [b, setB] = useState("b");
const all = useMemo(() => `${a()} and ${b()}`);

useEffect(() => {
  console.log("a =>", a());
  // console.log("all =>", all());
});

useEffect(() => {
  console.log("b =>", b());
});

useEffect(() => {
  console.log("all =>", all());
});

console.log("set aa");
setA("aa");
console.log("set bb");
setB("bb");
