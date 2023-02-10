import { memo } from "react";
import { logJSONStringify } from "../utils/log";

function LazyMemoCpn({ name = "LazyMemoCpn" }) {
  const props = { ...arguments[0], name };
  logJSONStringify({ props });
  return <div>{name}</div>;
}

LazyMemoCpn.defaultProps = {};
export default memo(LazyMemoCpn);
