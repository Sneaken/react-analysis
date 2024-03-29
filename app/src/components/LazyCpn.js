import { logJSONStringify } from "../utils/log";

function LazyCpn({ name = "LazyCpn" }) {
  const props = { ...arguments[0], name };
  logJSONStringify({ props });
  return <div>{name}</div>;
}

export default LazyCpn;
