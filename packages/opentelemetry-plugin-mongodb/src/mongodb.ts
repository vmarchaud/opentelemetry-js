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

// mongodb.Server type is deprecated so every use trigger a lint error
/* tslint:disable:deprecation */

import { BasePlugin } from '@opentelemetry/core';
import { Span, SpanKind, CanonicalCode } from '@opentelemetry/types';
import {
  MongodbInstrumentListener,
  CommandStartedEvent,
  CommandFailedEvent,
  CommandSucceededEvent
} from './types';
import * as mongodb from 'mongodb';

/** MongoDB instrumentation plugin for OpenTelemetry */
export class MongoDBPlugin extends BasePlugin<typeof mongodb> {
  private readonly _COMPONENT = 'mongodb-nodejs-driver';
  private readonly _DB_TYPE = 'mongodb';

  readonly supportedVersions = ['>=2 <4'];
  private _listener?: MongodbInstrumentListener
  /**
   * Since the mongodb driver have internal queuing, the scope is lost
   * between the start and success/fail events.
   * However each operation have an id, so we can map each operation id to our
   * current span at 
   */
  private _currentOperations = new Map<number, Span>()

  constructor(readonly moduleName: string) {
    super();
  }

  /**
   * Patches MongoDB operations.
   */
  protected patch() {
    this._logger.debug('Patching MongoDB');

    // create operation listener and listen events
    this._listener = this._moduleExports.instrument()
    this._listener.on('started', this._onCommandStart.bind(this))
    this._listener.on('failed', this._onCommandFailure.bind(this))
    this._listener.on('succeeded', this._onCommandSuccess.bind(this))

    return this._moduleExports;
  }

  /** Unpatches all MongoDB patched functions. */
  unpatch(): void {
    if (this._listener !== undefined) {
      this._listener.uninstrument()
      this._listener.removeAllListeners()
    }
  }

  private _onCommandStart (event: CommandStartedEvent) {
    console.log('start', this._tracer.getCurrentSpan())
  }

  private _onCommandFailure (event: CommandFailedEvent) {
    console.log('failure', this._tracer.getCurrentSpan())
  }

  private _onCommandSuccess (event: CommandSucceededEvent) {
    console.log('success', this._tracer.getCurrentSpan())
  }
}

export const plugin = new MongoDBPlugin('mongodb');
