import { lazy, useState } from "react";
import ClassCpn from "../components/ClassCpn";
import LazyMemoCpn from "../components/LazyMemoCpn";
import ForwardRefCpn from "../components/ForwardRefCpn";

const LazyCpn = lazy(() => import("../components/LazyCpn"));

function Fragments() {
  return (
    <>
      <div>1</div>
      <div>2</div>
    </>
  );
}
const SingleDiff = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <ClassCpn
        onClick={() => {
          setCount(count + 1);
        }}
        count={count}
      />
      {/*<>*/}
      {/*  <p key="key">1</p>*/}
      {/*  <p key={count}>2</p>*/}
      {/*  <p key="key">3</p>*/}
      {/*  <p key={count}>4</p>*/}
      {/*</>*/}
      {/*<div>*/}
      {/*  {count % 2 ? (*/}
      {/*    <div>*/}
      {/*      key 相同 但是没有找到能够复用的 fiberNode 就创建新的 fiberNode*/}
      {/*    </div>*/}
      {/*  ) : (*/}
      {/*    <p>key 相同 但是没有找到能够复用的 fiberNode 就创建新的 fiberNode</p>*/}
      {/*  )}*/}
      {/*</div>*/}
      {/*<div>*/}
      {/*  {count % 2 ? (*/}
      {/*    <Fragment key="Fragment">*/}
      {/*      <p>*/}
      {/*        key 相同, 但是 type 是 Fragment,*/}
      {/*        能够复用，但是会删除多余的兄弟节点,*/}
      {/*        比如下面的333（这是p节点是复用的）*/}
      {/*      </p>*/}
      {/*    </Fragment>*/}
      {/*  ) : (*/}
      {/*    <>*/}
      {/*      <Fragment key="Fragment">*/}
      {/*        <p>*/}
      {/*          key 相同, 但是 type 是 Fragment,*/}
      {/*          能够复用，但是会删除多余的兄弟节点,*/}
      {/*          比如下面的333（这是p节点是复用的）*/}
      {/*        </p>*/}
      {/*        <div>333</div>*/}
      {/*      </Fragment>*/}
      {/*      <div>333</div>*/}
      {/*    </>*/}
      {/*  )}*/}
      {/*</div>*/}
      {/*<div>*/}
      {/*  {count % 2 ? (*/}
      {/*    <div>1</div>*/}
      {/*  ) : (*/}
      {/*    <div>*/}
      {/*      2<div>3</div>*/}
      {/*    </div>*/}
      {/*  )}*/}
      {/*</div>*/}
      {/*<div>*/}
      {/*  /!* 修改 count 的具体数值来触发热更新 *!/*/}
      {/*  /!* 更新 count 的 值来触发 lazy 组件的 singleDiff*!/*/}
      {/*  <LazyCpn count={count} />*/}
      {/*</div>*/}
      {/*<Fragments />*/}
      <div>
        <LazyMemoCpn />
      </div>
      <div>
        <ForwardRefCpn />
      </div>
    </div>
  );
};

export default SingleDiff;
