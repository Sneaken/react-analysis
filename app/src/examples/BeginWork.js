import {
  Component,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useState,
} from "react";
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

function init(initialCount) {
  return { count: initialCount };
}
function reducer(state, action) {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "reset":
      return init(action.payload);
    default:
      throw new Error();
  }
}
const initialCount = 0;
function Hooks({ name = "Hooks" }) {
  const [state, dispatch] = useReducer(reducer, { count: initialCount });
  const [obj, setObj] = useState({ name: "name" });
  useEffect(() => {
    obj.name = "name2";
    setObj(obj);
  }, []);

  useEffect(() => {
    console.count(obj);
  }, [obj]);
  // const [state, dispatch] = useReducer(reducer, initialCount, init);
  return (
    <div>
      <div>{name}</div>
      <div>{JSON.stringify(obj)}</div>
    </div>
  );
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
      <HooksInOtherHook count={count} />
      <Hooks />
    </Suspense>
  );
}

BeginWork.defaultProps = {
  name: BeginWork.name,
};

export default BeginWork;
