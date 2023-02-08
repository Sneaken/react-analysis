import { lazy, Suspense, useEffect } from "react";

const fallback = <h3>loading</h3>;

const LazyCpn = lazy(() => import("../components/LazyCpn"));
function Sibling() {
  useEffect(() => {
    console.log("Sibling mount.");
  }, []);
  return <div>Sibling</div>;
}
function SuspenseFC() {
  return (
    <Suspense fallback={fallback}>
      <LazyCpn />
      <Sibling />
    </Suspense>
  );
}

export default SuspenseFC;
