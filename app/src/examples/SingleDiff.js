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
        <p key="key">1</p>
        <p key={count}>2</p>
        <p key="key">3</p>
        <p key={count}>4</p>
      </>
    </div>
  );
};

export default SingleDiff;
