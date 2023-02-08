import { useState } from "react";

function BusyChild({ num }) {
  const cur = performance.now();
  while (performance.now() - cur < 300) {}
  console.log("render", num);
  return <div>{num}</div>;
}

function Transition() {
  const [input, setInput] = useState("");
  const [num, setNum] = useState(0);
  const [_, startTransition] = useTransition();

  return (
    <div>
      <input
        type="text"
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          // setNum(num + 1);
          startTransition(() => {
            setNum(num + 1);
          });
        }}
      />
      <BusyChild num={num} />
      123
    </div>
  );
}

export default Transition;
