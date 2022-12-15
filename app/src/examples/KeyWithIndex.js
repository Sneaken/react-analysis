import { useState } from "react";
import "./KeyWithIndex.css";

// 用 index 作为 key，可能会导致组件状态紊乱
const KeyWithIndex = () => {
  const [list, setList] = useState([
    { id: 1, val: "aa" },
    { id: 2, val: "bb" },
    { id: 3, val: "cc" },
  ]);

  const click = () => {
    setList([...list.reverse()]);
  };
  const remove = () => {
    const items = [...list];
    items.splice(1, 1);
    setList(items);
  };

  return (
    <div className="KeyWithIndex">
      <div onClick={remove}>delete</div>
      <div onClick={click}>reverse</div>
      <div
        onClick={() => {
          const id = Math.random();
          setList([{ id, val: id }, ...list]);
        }}
      >
        unshift
      </div>
      <ul>
        {list.map((item, index) => {
          return <Li key={index} val={item.val}></Li>;
        })}
      </ul>
    </div>
  );
};

const Li = ({ val }) => {
  const [count, setCount] = useState(0);
  return (
    <li>
      {val}
      <button
        onClick={() => {
          setCount(count + 1);
        }}
      >
        {count}
      </button>
    </li>
  );
};

export default KeyWithIndex;
