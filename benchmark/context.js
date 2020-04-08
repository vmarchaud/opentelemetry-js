'use strict';

const benchmark = require('./benchmark');
const opentelemetry = require('../packages/opentelemetry-api');
const { NoopLogger } = require('../packages/opentelemetry-core');
const { NodeTracerProvider } = require('../packages/opentelemetry-node');
const assert = require('assert');

console.log(`Beginning with/withAsync Benchmark...`);
const logger = new NoopLogger();
const provider = new NodeTracerProvider({ logger });
provider.register();

const tracer = provider.getTracer("benchmark");
const suite = benchmark(20)
  .add('#with', function () {
    const span = tracer.startSpan('op');
    tracer.withSpan(span, () => {
      span.end();
    })
  })
  .add('#withAsync', async function () {
    const span = tracer.startSpan('op')
    const res = await tracer.withSpanAsync(span, async () => {
      span.end();
      return 1
    })
  })

// run async
suite.run({ async: false });

