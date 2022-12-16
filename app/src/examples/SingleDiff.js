import { useState } from "react";

const SingleDiff = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button
        onClick={() => {
          setCount(count + 1);
        }}
      >
        {count}
      </button>
      <>
        <p>{count}</p>
      </>
    </div>
  );
};

export default SingleDiff;
