// 保存所有的任务队列
const workList = [];

// 调度
function schedule() {
  const curWork = workList.pop();

  if (curWork) {
    perform(curWork);
  }
}

// 执行
function perform(work) {
  while (work.count) {
    work.count--;
    insertItem(work.count);
  }
  schedule();
}

const elements = [];
function insertItem(content) {
  const ele = {
    elementType: "span",
    innerText: content,
  };
  elements.push(ele);
}

function work() {
  workList.unshift({
    count: 100,
  });
  schedule();
  console.log("elements =>", elements);
}

work();
