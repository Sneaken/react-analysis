import { useState } from "react";

function Li({ it }) {
  const [value, setValue] = useState("dd");
  return (
    <div
      onClick={() => {
        setValue(value + "d");
      }}
    >
      {it} | {value}
    </div>
  );
}

function KeyWithFixed() {
  const [list, setList] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  return (
    <div>
      <button
        onClick={() => {
          setList([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
        }}
      >
        change
      </button>
      {list.map((it) => {
        return <Li key={1} it={it} />;
      })}
    </div>
  );
}

export default KeyWithFixed;
