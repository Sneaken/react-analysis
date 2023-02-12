import {
  Component,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
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

function SortList({ lastValue }) {
  const [list, setList] = useState([]);

  useEffect(() => {
    setList([...list, lastValue]);
  }, [lastValue]);

  return (
    <>
      {list.map((it, idx) => {
        return (
          <div
            key={it}
            style={{
              display: "flex",
              justifyContent: "space-around",
              margin: 10,
            }}
          >
            <div>{it}</div>
            <button
              onClick={() => {
                if (idx - 1 < 0) return;
                [list[idx], list[idx - 1]] = [list[idx - 1], list[idx]];
                setList([...list]);
              }}
            >
              和上一个交换
            </button>
            <button
              onClick={() => {
                if (idx - 2 < 0) return;
                [list[idx], list[idx - 2]] = [list[idx - 2], list[idx]];
                setList([...list]);
              }}
            >
              和上两个交换
            </button>
            <button
              onClick={() => {
                if (idx === list.length - 1) return;
                [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
                setList([...list]);
              }}
            >
              和下一个交换
            </button>
            <button
              onClick={() => {
                if (idx >= list.length - 2) return;
                [list[idx], list[idx + 2]] = [list[idx + 2], list[idx]];
                setList([...list]);
              }}
            >
              和下两个交换
            </button>
            <button onClick={() => setList(list.filter((i) => i !== it))}>
              clear
            </button>
          </div>
        );
      })}
    </>
  );
}

function BeginWork({ name = "BeginWork" }) {
  const [count, setCount] = useState(0);
  return (
    <Suspense fallback={fallback}>
      <Button
        onClick={() => {
          setCount(count + 1);
        }}
      >
        {count}
      </Button>
      <SortList lastValue={count} />
    </Suspense>
  );
}
export default BeginWork;
