/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export type HookFlags = number;

export const NoFlags = /*   */ 0b0000;

// Represents whether effect should fire.
export const HasEffect = /* */ 0b0001;

// Represents the phase in which the effect (not the clean-up) fires.
// useInsertionEffect(v18)
export const Insertion = /*  */ 0b0010;
// useLayoutEffect
export const Layout = /*    */ 0b0100;
// useEffect
export const Passive = /*   */ 0b1000;
