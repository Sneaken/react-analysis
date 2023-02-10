import { Component, lazy, memo, Suspense, useCallback, useState } from "react";
import { logJSONStringify } from "../utils/log";

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

function MemoComponent2({ name = "MemoComponent" }) {
  logJSONStringify({ props: { ...arguments[0], name } });
  return <div>MemoComponent</div>;
}
const MemoComponent = memo(MemoComponent2);

const LazyCpn = lazy(
  () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(import("../components/LazyCpn"));
      }, 10);
    })
);

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
      <NodeHeight />
      <HooksInOtherHook count={count} />
    </Suspense>
  );
}
export default BeginWork;
