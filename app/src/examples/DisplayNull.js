import React from "react";

function Test({ children }) {
  return (
    <div>
      {/*22*/}
      {children}
    </div>
  );
}
function DisplayNull() {
  return (
    <div>
      {undefined}
      {undefined}
      {true}
      {false}
      {""}
      {0}
      {1}
      {[]}
      {/*{{}}*/}
      {DisplayNull}
      <Test>{DisplayNull}</Test>
    </div>
  );
}

export default DisplayNull;
