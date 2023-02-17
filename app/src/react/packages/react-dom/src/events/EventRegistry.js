/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {DOMEventName} from './DOMEventNames';

import {enableCreateEventHandleAPI} from 'shared/ReactFeatureFlags';

// 收集所有注册过的原生事件
export const allNativeEvents: Set<DOMEventName> = new Set();

if (enableCreateEventHandleAPI) {
  allNativeEvents.add('beforeblur');
  allNativeEvents.add('afterblur');
}

/**
 * Mapping from registration name to event name
 */
export const registrationNameDependencies = {};

/**
 * Mapping from lowercase registration names to the properly cased version,
 * used to warn in the case of missing event handlers. Available
 * only in __DEV__.
 * @type {Object}
 */
export const possibleRegistrationNames = __DEV__ ? {} : (null: any);
// Trust the developer to only use possibleRegistrationNames in __DEV__

/**
 * 注册冒泡事件和捕获事件
 * @param registrationName
 * @param dependencies
 */
export function registerTwoPhaseEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>,
): void {
  registerDirectEvent(registrationName, dependencies);
  registerDirectEvent(registrationName + 'Capture', dependencies);
}

/**
 *
 * @param registrationName
 * @param dependencies
 */
export function registerDirectEvent(
  registrationName: string,
  dependencies: Array<DOMEventName>,
) {
  if (__DEV__) {
    if (registrationNameDependencies[registrationName]) {
      console.error(
        'EventRegistry: More than one plugin attempted to publish the same ' +
          'registration name, `%s`.',
        registrationName,
      );
    }
  }

  registrationNameDependencies[registrationName] = dependencies;

  if (__DEV__) {
    const lowerCasedName = registrationName.toLowerCase();
    possibleRegistrationNames[lowerCasedName] = registrationName;

    if (registrationName === 'onDoubleClick') {
      possibleRegistrationNames.ondblclick = registrationName;
    }
  }

  // 收集原生事件
  for (let i = 0; i < dependencies.length; i++) {
    allNativeEvents.add(dependencies[i]);
  }
}
