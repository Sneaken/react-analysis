import { Component, lazy, memo, Suspense, useCallback, useState } from "react";
import { logJSONStringify } from "../utils/log";
import { sleep } from "../utils/mixed";
import { createPortal } from "react-dom";

class Button extends Component {
  constructor() {
    super();
  }

  render() {
    const { onClick, children } = this.props;
    return <button onClick={onClick}>{children}</button>;
  }
}

function ClassLike() {
  return {
    render() {
      return <div>ClassLike</div>;
    },
  };
}

// 加了这个就真的会被当成 ClassComponent
// ClassLike.prototype.isReactComponent = {};

function MemoComponent2({ name = "MemoComponent" }) {
  logJSONStringify({ props: { ...arguments[0], name } });
  return <div>MemoComponent</div>;
}
const MemoComponent = memo(MemoComponent2);

const LazyCpn = lazy(() =>
  sleep(10).then(() => import("../components/LazyCpn"))
);
const lazyCase = lazy(() =>
  sleep(10).then(() => import("../components/LazyCase"))
);
const LazyMemoCpn = lazy(() => import("../components/LazyMemoCpn"));
const LazyForwardRefCpn = lazy(() => import("../components/ForwardRefCpn"));

function NodeHeight() {
  const [height, setHeight] = useState(0);

  const nodeRef = useCallback((node) => {
    if (!node) return;
    const { height } = node.getBoundingClientRect();
    setHeight(height);
  }, []);
  return <div ref={nodeRef}>this node's height is {height}px</div>;
}

function HooksInOtherHook({ name = "HooksInOtherHook" }) {
  // useMemo(() => {
  //   const [value2] = useState(0);
  //   return value2;
  // });

  return <div>{name}</div>;
}

const fallback = <div>loading</div>;

const Portal = document.createElement("div");
Portal.id = "Portal";
document.body.appendChild(Portal);

function Modal({ children }) {
  return createPortal(children, Portal);
}

function BeginWork({ name = "BeginWork" }) {
  const [count, setCount] = useState(0);
  const [list, setList] = useState([]);
  return (
    <Suspense fallback={fallback}>
      <Button
        onClick={() => {
          const it = count + 1;
          list.push(it);
          // 不解构的缺点是 不了解源码的人，修改逻辑可能会发生问题
          setList(list);
          setCount(it);
        }}
      >
        {count}
      </Button>
      {list.map((it) => {
        return (
          <div key={it} onClick={() => setList(list.filter((i) => i !== it))}>
            {it}
          </div>
        );
      })}
    </Suspense>
  );
}
export default BeginWork;
