import { forwardRef, useImperativeHandle } from "react";
import { logJSONStringify } from "../utils/log";

const ForwardRefCpn = forwardRef(function ({ name = "ForwardRefCpn" }, ref) {
  const props = { ...arguments[0], name };
  logJSONStringify({ props });

  useImperativeHandle(
    ref,
    () => {
      return {
        name,
      };
    },
    []
  );

  return <div>{name}</div>;
});

ForwardRefCpn.defaultProps = {};

export default ForwardRefCpn;
