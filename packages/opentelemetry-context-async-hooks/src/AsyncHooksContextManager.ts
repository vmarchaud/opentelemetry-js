/*!
 * Copyright 2019, OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ContextManager, Context } from '@opentelemetry/context-base';
import { EventEmitter } from 'events';
import * as cls from 'cls-hooked';

export class AsyncHooksContextManager implements ContextManager {

  // @ts-ignore
  private _namespace: cls.Namespace

  active(): Context {
    const context = this._namespace.active 
    return context === null || context === undefined ? Context.ROOT_CONTEXT : context as Context
  }

  with<T extends (...args: unknown[]) => ReturnType<T>>(
    context: Context,
    fn: T
  ): ReturnType<T> {
    return this._namespace.runAndReturn(this._namespace.bind(fn, context))
  }

  async withAsync<T extends Promise<any>, U extends (...args: unknown[]) => T>(
    context: Context,
    fn: U
  ): Promise<T> {
    return this._namespace.runPromise(this._namespace.bind(fn, context))
  }

  bind<T>(target: T, context: Context): T {
    // if no specific context to propagate is given, we use the current one
    if (context === undefined) {
      context = this.active();
    }
    if (target instanceof EventEmitter) {
      return this._bindEventEmitter(target, context);
    } else if (typeof target === 'function') {
      return this._bindFunction(target, context);
    }
    return target;
  }

  enable(): this {
    this._namespace = cls.createNamespace('OTEL_NAMESPACE')
    return this;
  }

  disable(): this {
    // cls.destroyNamespace('OTEL_NAMESPACE')
    return this;
  }

  private _bindFunction<T extends Function>(target: T, context: Context): T {
    return this._namespace.bind(target, context);
  }

  /**
   * By default, EventEmitter call their callback with their context, which we do
   * not want, instead we will bind a specific context to all callbacks that
   * go through it.
   * @param target EventEmitter a instance of EventEmitter to patch
   * @param context the context we want to bind
   */
  private _bindEventEmitter<T extends EventEmitter>(
    target: T,
    context: Context
  ): T {
    this._namespace.bindEmitter(target)
    return target
  }
}
