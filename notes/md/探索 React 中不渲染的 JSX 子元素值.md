# 探索 React 中不渲染的 JSX 子元素值

> 当涉及到 JSX 的 children 属性时，有一些特定的子元素值会导致 React 不执行渲染操作。本文将深入研究这些情况，并探讨在哪些情况下 React 不会对特定的 JSX 子元素值进行渲染。

在 React 中，JSX 的`children`属性扮演着非常重要的角色。它允许我们在组件中传递子元素，以构建更复杂的用户界面。然而，有一些特定的子元素值会导致 React 不执行渲染操作。在本文中，我们将探索这些情况，并详细讨论 React(本文代码基于 18.2) 在哪些情况下不会对特定的 JSX 子元素值进行渲染。

1. children 以为以下几种情况时

   - `null`或`undefined`
   - `""`
   - `[]`(空数组)
   - `Boolean`

   ```jsx
   <>
     <div>{null}</div>
     <div>{undefined}</div>
     <div>{""}</div>
     <div>{[]}</div>
     <div>{true}</div>
     <div>{false}</div>
   </>
   ```

   ```ts
   function reconcileChildFibers(
     returnFiber: Fiber,
     currentFirstChild: Fiber | null,
     newChild: any,
     lanes: Lanes
   ): Fiber | null {
     // 此时通过 newChild 来区分到底是 单节点diff 还是 多节点diff。

     const isUnkeyedTopLevelFragment =
       typeof newChild === "object" &&
       newChild !== null &&
       newChild.type === REACT_FRAGMENT_TYPE &&
       newChild.key === null;
     if (isUnkeyedTopLevelFragment) {
       newChild = newChild.props.children;
     }

     if (typeof newChild === "object" && newChild !== null) {
       // 忽略当 newChild 是正常组件的时候，本篇文章不关注
       switch (newChild.$$typeof) {
       }

       if (isArray(newChild)) {
         // 多节点 diff
         return reconcileChildrenArray(
           returnFiber,
           currentFirstChild,
           newChild,
           lanes
         );
       }

       // 单节点 diff 如果是对象，实际上是在这里抛出异常的
       throwOnInvalidObjectType(returnFiber, newChild);
     }

     if (
       (typeof newChild === "string" && newChild !== "") ||
       typeof newChild === "number"
     ) {
       return placeSingleChild(
         reconcileSingleTextNode(
           returnFiber,
           currentFirstChild,
           "" + newChild, // 在这里可以看到 数字0 实际上是当成 字符串0 来对待的，所以会显示
           lanes
         )
       );
     }

     if (__DEV__) {
       if (typeof newChild === "function") {
         // 单节点 diff 如果是函数的话，实际上是在这里给出警告
         warnOnFunctionType(returnFiber);
       }
     }

     // 其他情况下
     // mount 的时候，直接被忽略
     // update 的时候，删除父级剩余的child, 体现在页面上的现象就是元素没有了
     return deleteRemainingChildren(returnFiber, currentFirstChild);
   }
   // 多节点diff 中
   function createChild(
     returnFiber: Fiber,
     newChild: any,
     lanes: Lanes
   ): Fiber | null {
     // newChild 就是上述的 children
     // 当 children 为 字符串或者数字的时候
     if (
       (typeof newChild === "string" && newChild !== "") ||
       typeof newChild === "number"
     ) {
       // 在这里可以看到 数字0 实际上是当成 字符串0 来对待的，所以会显示
       const created = createFiberFromText(
         "" + newChild,
         returnFiber.mode,
         lanes
       );
       created.return = returnFiber;
       return created;
     }

     if (typeof newChild === "object" && newChild !== null) {
       // 忽略当 newChild 是正常组件的时候，本篇文章不关注
       switch (newChild.$$typeof) {
       }

       // 当 children 是数组或者是 迭代器函数时
       if (isArray(newChild) || getIteratorFn(newChild)) {
         // 可以看到只要元素符合上述条件就会创建一个 Fragment 元素
         // 所以 [] 可以看成
         // <>
         //   {undefined}
         // </>
         const created = createFiberFromFragment(
           newChild,
           returnFiber.mode,
           lanes,
           null
         );
         created.return = returnFiber;
         return created;
       }
       // 多节点 diff 如果其中一个 child 是对象的话，实际上是在这里抛出异常的
       throwOnInvalidObjectType(returnFiber, newChild);
     }
     // 所以 其实当 children 为 null, undefined, "", Boolean 的时候是没有创建 fiber 的，也就是无效元素被忽略了
     return null;
   }
   ```

2. 对象作为子元素值:

   当`children`属性的值是一个对象时，React 会抛出异常导致页面无法渲染。(俗称白屏, 如果没用 Error Boundaries)

   ```jsx
   <div>{{}}</div>
   ```

   ```js
   function throwOnInvalidObjectType(returnFiber: Fiber, newChild: Object) {
     const childString = Object.prototype.toString.call(newChild);
     throw new Error(
       `Objects are not valid as a React child (found: ${
         childString === "[object Object]"
           ? "object with keys {" + Object.keys(newChild).join(", ") + "}"
           : childString
       }). ` +
         "If you meant to render a collection of children, use an array " +
         "instead."
     );
   }
   ```

3. 函数作为子元素值：

   当`children`属性的值是一个函数时，React 将调用该函数，并传递相应的参数，但不会直接渲染函数返回的内容。这种情况常用于实现"函数作为子组件"的模式，允许父组件向子组件传递参数或回调函数。

   ```jsx
   <>
     /** 会在控制台打印错误 */
     <div>{() => <ChildComponent />}</div>
     /** 具体看 ParentComponent 如何使用 children */
     <ParentComponent>{() => <ChildComponent />}</ParentComponent>
   </>
   ```

   具体在`单节点diff`以及在`多节点diff`的时候会判断

   ```js
   function warnOnFunctionType(returnFiber: Fiber) {
     if (__DEV__) {
       const componentName =
         getComponentNameFromFiber(returnFiber) || "Component";

       if (ownerHasFunctionTypeWarning[componentName]) {
         return;
       }
       ownerHasFunctionTypeWarning[componentName] = true;

       console.error(
         "Functions are not valid as a React child. This may happen if " +
           "you return a Component instead of <Component /> from render. " +
           "Or maybe you meant to call this function rather than return it."
       );
     }
   }
   ```
