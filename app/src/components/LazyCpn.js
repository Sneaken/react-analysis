import { logJSONStringify } from "../utils/log";

function LazyCpn(props) {
  const { name = "LazyCpn" } = props;
  logJSONStringify({ props });
  return <div>{name}</div>;
}

export default LazyCpn;
