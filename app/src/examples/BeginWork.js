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

function MemoComponent2(props) {
  logJSONStringify({ props });
  return <div>MemoComponent</div>;
}
MemoComponent2.defaultProps = {
  name: "MemoComponent",
};
const MemoComponent = memo(MemoComponent2);

const LazyCpn = lazy(
  () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(import("../components/LazyCpn"));
      }, 1000);
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

const fallback = <div>loading</div>;

function BeginWork(props) {
  const [count, setCount] = useState(0);
  logJSONStringify({ props });
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
      <MemoComponent />
      <LazyCpn count={count} />
      <NodeHeight />
    </Suspense>
  );
}
BeginWork.defaultProps = {
  name: BeginWork.name,
};

export default BeginWork;
