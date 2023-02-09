import { logJSONStringify } from "../utils/log";

function LazyCpn(props) {
  logJSONStringify({ props });
  return <div>LazyCpn</div>;
}

LazyCpn.defaultProps = {
  name: "LazyCpn",
};

export default LazyCpn;
