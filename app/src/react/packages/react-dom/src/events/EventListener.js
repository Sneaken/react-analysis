/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */
/**
 * 监听冒泡事件
 * @param target
 * @param eventType
 * @param listener
 * @return {Function}
 */
export function addEventBubbleListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
): Function {
  target.addEventListener(eventType, listener, false);
  return listener;
}

/**
 * 监听捕获事件
 * @param target
 * @param eventType
 * @param listener
 * @return {Function}
 */
export function addEventCaptureListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
): Function {
  target.addEventListener(eventType, listener, true);
  return listener;
}

/**
 * 监听一个设置了 passive flag 的捕获事件
 * @param target
 * @param eventType
 * @param listener
 * @param passive
 * @return {Function}
 */
export function addEventCaptureListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean,
): Function {
  target.addEventListener(eventType, listener, {
    capture: true,
    passive,
  });
  return listener;
}

/**
 * 监听一个设置了 passive flag 的冒泡事件
 * @param target
 * @param eventType
 * @param listener
 * @param passive
 * @return {Function}
 */
export function addEventBubbleListenerWithPassiveFlag(
  target: EventTarget,
  eventType: string,
  listener: Function,
  passive: boolean,
): Function {
  target.addEventListener(eventType, listener, {
    passive,
  });
  return listener;
}

/**
 * 移除事件监听函数
 * @param target
 * @param eventType
 * @param listener
 * @param capture
 */
export function removeEventListener(
  target: EventTarget,
  eventType: string,
  listener: Function,
  capture: boolean,
): void {
  target.removeEventListener(eventType, listener, capture);
}
