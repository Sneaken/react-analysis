import { Component, lazy, memo, Suspense, useCallback, useState } from "react";
import { logJSONStringify } from "../utils/log";
import { sleep } from "../utils/mixed";

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

function BeginWork({ name = "BeginWork" }) {
  const [count, setCount] = useState(0);
  logJSONStringify({ props: { ...arguments[0], name } });
  return (
    <Suspense fallback={fallback}>
      <Button
        onClick={() => {
          setCount(count + 1);
        }}
      >
        {count}
      </Button>
      <ClassLike />
      <MemoComponent count={count} />
      <LazyCpn count={count} />
      <LazyMemoCpn count={count} />
      <NodeHeight />
      <HooksInOtherHook count={count} />
      <LazyForwardRefCpn />
    </Suspense>
  );
}
export default BeginWork;
