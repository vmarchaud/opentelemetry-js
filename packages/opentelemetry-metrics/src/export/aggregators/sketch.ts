/*!
 * Copyright 2020, OpenTelemetry Authors
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

import { Aggregator, Point } from '../types';
import { HrTime } from '@opentelemetry/api';
import { hrTime } from '@opentelemetry/core';
import { Distribution } from '../types';
import * as hdr from 'hdr-histogram-js'

export type SketchAggregatorOptions = hdr.BuildRequest

/** SketchAggregator implement a HDR-Histogram aggregation which allows to compute percentiles. */
export class SketchAggregator implements Aggregator {
  private _histogram: hdr.AbstractHistogram;
  private _lastUpdateTime: HrTime = hrTime();

  constructor(options?: SketchAggregatorOptions) {
    this._histogram = hdr.build(options)
  }

  update(value: number): void {
    this._histogram.recordValue(value)
    this._lastUpdateTime = hrTime();
  }

  toPoint(): Point {
    return {
      value: this._histogram.per,
      timestamp: this._lastUpdateTime,
    };
  }
}
