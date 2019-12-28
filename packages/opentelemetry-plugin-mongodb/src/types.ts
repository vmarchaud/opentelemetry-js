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
import { EventEmitter } from 'events';

export type Func<T> = (...args: unknown[]) => T;

// All the specs for the following type definition are there:
// https://github.com/mongodb/specifications/blob/master/source/command-monitoring/command-monitoring.rst
declare module 'mongodb' {
  export function instrument (options?: MongodbInstrumentOptions, callback?: MongodbInstrumentCallback): MongodbInstrumentListener
}

type Document = {
  find?: string,
  filter?: { [key: string]: unknown }
  sort?: { [key: string]: unknown },
  projection?: { [key: string]: unknown },
  limit?: number,
  skip?: number,
  hint?: { [key: string]: unknown },
  batchSize?: number,
  comment?: string,
  maxTimeMS: number,
  noCursorTimeout: boolean
}

type ConnectionId = {
  id: number
  host: string
  port: number
}

export interface CommandStartedEvent {

  /**
   * Returns the command.
   */
  command: Document;

  /**
   * Returns the database name.
   */
  databaseName: string;

  /**
   * Returns the command name.
   */
  commandName: string;

  /**
   * Returns the driver generated request id.
   */
  requestId: number;

  /**
   * Returns the driver generated operation id. This is used to link events together such
   * as bulk write operations. OPTIONAL.
   */
  operationId: number;

  /**
   * Returns the connection id for the command. For languages that do not have this,
   * this MUST return the driver equivalent which MUST include the server address and port.
   * The name of this field is flexible to match the object that is returned from the driver.
   */
  connectionId: ConnectionId;
}

export interface CommandSucceededEvent {

  /**
   * Returns the execution time of the event in the highest possible resolution for the platform.
   * The calculated value MUST be the time to send the message and receive the reply from the server
   * and MAY include BSON serialization and/or deserialization. The name can imply the units in which the
   * value is returned, i.e. durationMS, durationNanos.
   */
  duration: number;

  /**
   * Returns the command reply.
   */
  reply: Document;

  /**
   * Returns the command name.
   */
  commandName: string;

  /**
   * Returns the driver generated request id.
   */
  requestId: number;

  /**
   * Returns the driver generated operation id. This is used to link events together such
   * as bulk write operations. OPTIONAL.
   */
  operationId: number;

  /**
   * Returns the connection id for the command. For languages that do not have this,
   * this MUST return the driver equivalent which MUST include the server address and port.
   * The name of this field is flexible to match the object that is returned from the driver.
   */
  connectionId: ConnectionId;
}

export interface CommandFailedEvent {

  /**
   * Returns the execution time of the event in the highest possible resolution for the platform.
   * The calculated value MUST be the time to send the message and receive the reply from the server
   * and MAY include BSON serialization and/or deserialization. The name can imply the units in which the
   * value is returned, i.e. durationMS, durationNanos.
   */
  duration: number;

  /**
   * Returns the command name.
   */
  commandName: string;

  /**
   * Returns the failure. Based on the language, this SHOULD be a message string, exception
   * object, or error document.
   */
  failure: string | Error | Document;

  /**
   * Returns the client generated request id.
   */
  requestId: number;

  /**
   * Returns the driver generated operation id. This is used to link events together such
   * as bulk write operations. OPTIONAL.
   */
  operationId: number;

  /**
   * Returns the connection id for the command. For languages that do not have this,
   * this MUST return the driver equivalent which MUST include the server address and port.
   * The name of this field is flexible to match the object that is returned from the driver.
   */
  connectionId: ConnectionId;
}

type MongodbInstrumentOptions = {
  operationIdGenerator?: {
    operationId: number,

    next: () => number
  },

  timestampGenerator?: {
    current: () => number,

    duration: (start: number, end: number) => number
  }  
}

type MongodbInstrumentCallback = (err: Error, instrumentations: unknown[]) => void;

export interface MongodbInstrumentListener extends EventEmitter {
  on(event: 'started', listener: (event: CommandStartedEvent) => void): this;
  on(event: 'succeeded', listener: (event: CommandSucceededEvent) => void): this;
  on(event: 'failed', listener: (event: CommandFailedEvent) => void): this;

  uninstrument(): void
}


export enum AttributeNames {
  // required by https://github.com/open-telemetry/opentelemetry-specification/blob/master/specification/data-semantic-conventions.md#databases-client-calls
  COMPONENT = 'component',
  DB_TYPE = 'db.type',
  DB_INSTANCE = 'db.instance',
  DB_STATEMENT = 'db.statement',
  PEER_ADDRESS = 'peer.address',
  PEER_HOSTNAME = 'peer.host',

  PEER_PORT = 'peer.port',
  PEER_IPV4 = 'peer.ipv4',
  PEER_IPV6 = 'peer.ipv6',
  PEER_SERVICE = 'peer.service',
}

export enum MongodbCommandType {
  CREATE_INDEXES = 'createIndexes',
  FIND_AND_MODIFY = 'findAndModify',
  IS_MASTER = 'isMaster',
  COUNT = 'count',
  UNKNOWN = 'unknown',
}
