import { useState } from "react";

function Child() {
  console.log("Child render");
  return <div>Child</div>;
}

function EagerState() {
  const [count, setCount] = useState(0);
  console.log("count:", count);
  return (
    <div onClick={() => setCount(1)}>
      <Child />
    </div>
  );
}

export default EagerState;
