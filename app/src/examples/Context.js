import { createContext, useContext, useState } from "react";

const Ctx = createContext(0);

function ContextProvider({ children }) {
  const [num, setNum] = useState(0);
  return (
    <Ctx.Provider value={{ num, setNum }}>
      <button onClick={() => setNum(num + 1)}>add</button>
      {children}
      <Render2 />
    </Ctx.Provider>
  );
}
const Render = ({ children }) => {
  console.log("render");
  return <div>{children}</div>;
};

const Render2 = () => {
  console.log("render2");
  return <div></div>;
};

const Number = () => {
  const { num } = useContext(Ctx);

  console.log("Number render");
  return <div>{num}</div>;
};

const NoRender = () => {
  console.log("no-render");
  return <div>no-render</div>;
};
function Context() {
  return (
    <ContextProvider>
      <Render>
        <NoRender />
        <Render>
          <NoRender />
          <Render>
            <Render>
              <Number />
              <NoRender />
            </Render>
          </Render>
        </Render>
      </Render>
    </ContextProvider>
  );
}
export default Context;
