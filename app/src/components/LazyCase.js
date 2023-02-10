function LazyCase({ name = "LazyCase" }) {
  return <div>{name}</div>;
}

const lazyCase = <LazyCase />;
// createElement 生成的时候 lazyCase._store.validated 为 false
// 使用的时候会发出提示需要校验 key
export default lazyCase;
