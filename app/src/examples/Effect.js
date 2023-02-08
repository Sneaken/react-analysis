import { useEffect, useRef, useState } from "react";

function Effect() {
  const ref = useRef(0);
  const [obj, setObj] = useState({});
  const [_, update] = useState({});
  useEffect(() => {
    const timer = setInterval(() => {
      ref.current = (ref.current ?? 0) + 1;
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    console.log("ref.value =>", ref.current);
  }, [ref.current]);

  useEffect(() => {
    console.log("obj =>", obj);
  }, [obj]);

  return (
    <div>
      <h3 onClick={() => update({})}>Effect</h3>
      {ref.current}
    </div>
  );
}

export default Effect;
