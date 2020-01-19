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

import { BasePlugin } from '@opentelemetry/core';
import { Attributes } from '@opentelemetry/types';
import * as express from 'express';
import * as core from 'express-serve-static-core';
import * as shimmer from 'shimmer';
import {
  ExpressLayer,
  ExpressRouter,
  AttributeNames,
  PatchedRequest,
  Parameters,
  PathParams,
  _MIDDLEWARES_STORE_PROPERTY,
} from './types';
import { getLayerMetadata, storeLayerPath, patchEnd } from './utils';
import { VERSION } from './version';

/**
 * This symbol is used to mark express layer as being already instrumented
 * since its possible to use a given layer multiple times (ex: middlewares)
 */
export const kLayerPatched: unique symbol = Symbol('express-layer-patched');

/** Express instrumentation plugin for OpenTelemetry */
export class ExpressPlugin extends BasePlugin<typeof express> {
  readonly _COMPONENT = 'express';
  readonly supportedVersions = ['^4.0.0'];

  constructor(readonly moduleName: string) {
    super('@opentelemetry/plugin-express', VERSION);
  }

  /**
   * Patches Express operations.
   */
  protected patch() {
    this._logger.debug('Patching Express');

    if (this._moduleExports === undefined || this._moduleExports === null) {
      return this._moduleExports;
    }
    const routerProto = (this._moduleExports
      .Router as unknown) as express.Router;

    this._logger.debug('patching express.Router.prototype.route');
    shimmer.wrap(routerProto, 'route', this._getRoutePatch.bind(this));

    this._logger.debug('patching express.Router.prototype.use');
    shimmer.wrap(routerProto, 'use', this._getRouterUsePatch.bind(this));

    this._logger.debug('patching express.Application.use');
    shimmer.wrap(
      this._moduleExports.application,
      'use',
      this._getAppUsePatch.bind(this)
    );

    return this._moduleExports;
  }

  /**
   * Get the patch for Router.route function
   * @param original
   */
  private _getRoutePatch(original: (path: PathParams) => express.IRoute) {
    const plugin = this;
    return function route_trace(
      this: ExpressRouter,
      ...args: Parameters<typeof original>
    ) {
      const route = original.apply(this, args);
      const layer = this.stack[this.stack.length - 1] as ExpressLayer;
      plugin._applyPatch(
        layer,
        typeof args[0] === 'string' ? args[0] : undefined
      );
      return route;
    };
  }

  /**
   * Get the patch for Router.use function
   * @param original
   */
  private _getRouterUsePatch(
    original: express.IRouterHandler<express.Router> &
      express.IRouterMatcher<express.Router>
  ) {
    const plugin = this;
    return function use(
      this: express.Application,
      ...args: Parameters<typeof original>
    ) {
      const route = original.apply(this, args);
      const layer = this.stack[this.stack.length - 1] as ExpressLayer;
      plugin._applyPatch(
        layer,
        typeof args[0] === 'string' ? args[0] : undefined
      );
      return route;
      // tslint:disable-next-line:no-any
    } as any;
  }

  /**
   * Get the patch for Application.use function
   * @param original
   */
  private _getAppUsePatch(
    original: core.ApplicationRequestHandler<express.Application>
  ) {
    const plugin = this;
    return function use(
      this: { _router: ExpressRouter },
      ...args: Parameters<typeof original>
    ) {
      const route = original.apply(this, args);
      const layer = this._router.stack[this._router.stack.length - 1];
      plugin._applyPatch(
        layer,
        typeof args[0] === 'string' ? args[0] : undefined
      );
      return route;
      // tslint:disable-next-line:no-any
    } as any;
  }

  /** Unpatches all Express patched functions. */
  unpatch(): void {
    shimmer.unwrap(this._moduleExports.Router.prototype, 'use');
    shimmer.unwrap(this._moduleExports.Router.prototype, 'route');
    shimmer.unwrap(this._moduleExports.application, 'use');
  }

  /** Patch each express layer to create span and propagate scope */
  private _applyPatch(layer: ExpressLayer, layerPath?: string) {
    const plugin = this;
    if (layer[kLayerPatched] === true) return;
    layer[kLayerPatched] = true;
    this._logger.debug('patching express.Router.Layer.handle');
    shimmer.wrap(layer, 'handle', function(original: Function) {
      if (original.length === 4) return original;

      return function(
        this: ExpressLayer,
        req: PatchedRequest,
        res: express.Response,
        next: express.NextFunction
      ) {
        storeLayerPath(req, layerPath);
        const route = (req[_MIDDLEWARES_STORE_PROPERTY] as string[]).join('');
        const attributes: Attributes = {
          [AttributeNames.COMPONENT]: plugin._COMPONENT,
          [AttributeNames.HTTP_ROUTE]: route.length > 0 ? route : undefined,
        };
        const metadata = getLayerMetadata(layer, layerPath);

        const span = plugin._tracer.startSpan(metadata.name, {
          parent: plugin._tracer.getCurrentSpan(),
          attributes: Object.assign(attributes, metadata.attributes),
        });
        // verify we have a callback
        let callbackIdx = Array.from(arguments).findIndex(
          arg => typeof arg === 'function'
        );
        let callbackHasBeenCalled = false;
        if (callbackIdx >= 0) {
          arguments[callbackIdx] = function() {
            callbackHasBeenCalled = true;
            if (!(req.route && arguments[0] instanceof Error)) {
              (req[_MIDDLEWARES_STORE_PROPERTY] as string[]).pop();
            }
            return patchEnd(span, plugin._tracer.bind(next))();
          };
        }
        const result = original.apply(this, arguments);
        // if the layer return a response, the callback will never
        // be called, so we need to manually close the span
        if (callbackHasBeenCalled === false) {
          span.end();
        }
        return result;
      };
    });
  }
}

export const plugin = new ExpressPlugin('express');
