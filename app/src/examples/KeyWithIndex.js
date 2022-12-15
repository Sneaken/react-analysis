import {useState} from "react"
import "./KeyWithIndex.css"

// 用 index 作为 key，可能会导致组件状态紊乱
const KeyWithIndex = () => {
  const [list, setList] = useState([
    { id: 1, val: "aa" },
    { id: 2, val: "bb" },
    { id: 3, val: "cc" },
  ]);

  const reverse = () => {
    console.log("reverse");
    setList([...list.reverse()]);
  };
  const shift = () => {
    console.log("shift");
    const items = [...list];
    items.shift();
    setList(items);
  };

  const unshift = () => {
    console.log("unshift");
    const id = Math.random();
    setList([{ id, val: id }, ...list]);
  };

  const push = () => {
    console.log("push");
    const id = Math.random();
    setList([...list, { id, val: id }]);
  };
  const pop = () => {
    console.log("pop");
    const items = [...list];
    items.pop();
    setList(items);
  };
  const splice = () => {
    console.log("splice");
    const items = [...list];
    const id = Math.random();
    items.splice(2, 0, { id, val: id });
    setList(items);
  };

  return (
    <div className="KeyWithIndex">
      <button onClick={reverse}>reverse</button>
      <button onClick={unshift}>unshift</button>
      <button onClick={shift}>shift</button>
      <button onClick={push}>push</button>
      <button onClick={pop}>pop</button>
      <button onClick={splice}>splice(2, 0)</button>
      <ul>
        {list.map((item, index) => {
          return <Li key={item.id} val={item.val}></Li>;
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
