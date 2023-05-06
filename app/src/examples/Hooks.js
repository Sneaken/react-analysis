import { useEffect, useReducer, useState, useTransition } from "react";

function init(initialCount) {
  return { count: initialCount };
}
function reducer(state, action) {
  switch (action.type) {
    case "increment":
      return { count: state.count + 1 };
    case "decrement":
      return { count: state.count - 1 };
    case "reset":
      return init(action.payload);
    default:
      throw new Error();
  }
}
const initialCount = 0;
function Reducer({ name = "Reducer" }) {
  const [state, dispatch] = useReducer(reducer, { count: initialCount });
  // const [state, dispatch] = useReducer(reducer, initialCount, init);
  return <div>{name}</div>;
}

function State({ name = "State" }) {
  const [obj, setObj] = useState({ name: "name" });
  useEffect(() => {
    obj.name = "name2";
    setObj(obj);
  }, []);
  useEffect(() => {
    console.count(obj);
  }, [obj]);
  return (
    <div>
      <div>{name}</div>
      {JSON.stringify(obj)}
    </div>
  );
}

function BatchState({ name = "BatchState" }) {
  const [count, setCount] = useState(0);
  const [string, setString] = useState("0");
  useEffect(() => {
    // setTimeout
    setTimeout(() => {
      setCount(count + 1);
      setString(string + 1);
    }, 1000);
  }, []);

  // useEffect(() => {
  //   promise
  //   sleep().then(() => {
  //     setCount(count + 1);
  //     setString(string + 1);
  //   });
  // }, []);

  console.count(`${name} render`);
  return (
    <div>
      <div>{name}</div>
    </div>
  );
}

function Transition({ name = "Transition" }) {
  const [count, setCount] = useState(1);
  const [isPending, setTransition] = useTransition();

  return (
    <div
      onClick={() => {
        setTransition(() => {
          setCount(2);
        });
      }}
    >
      {name}
    </div>
  );
}

function Hooks({ name = "Hooks" }) {
  return (
    <div>
      <State />
      <BatchState />
      {/*<Reducer />*/}
      <BatchState />
      <Transition />
    </div>
  );
}

export default Hooks;
