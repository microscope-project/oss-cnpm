/**
 * Copyright(c) cnpm and other contributors.
 * MIT Licensed
 *
 * Authors:
 *   fengmk2 <m@fengmk2.com> (http://fengmk2.com)
 */

'use strict';

/**
 * Module dependencies.
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');
const urllib = require('urllib');
const oss = require('../');
const config = require('./config');
const masterSlaveClusterConfig = require('./cluster_config');

const roundRobinClusterConfig = {};
for (let key in masterSlaveClusterConfig) {
  roundRobinClusterConfig[key] = masterSlaveClusterConfig[key];
}
roundRobinClusterConfig.schedule = 'roundRobin';

describe('test/index.test.js', function () {
  [
    {
      name: 'one region oss client',
      nfs: oss.create(config),
      prefix: '/oss-cnpm-example',
    },
    {
      name: 'cluster:masterSlave oss client',
      nfs: oss.create(masterSlaveClusterConfig),
      prefix: '/oss-cnpm-masterSlave-example',
    },
    {
      name: 'cluster:roundRobin oss client',
      nfs: oss.create(roundRobinClusterConfig),
      prefix: '/oss-cnpm-roundRobin-example',
    },
  ].forEach(function (item) {
    describe(item.name, function () {
      const nfs = item.nfs;
      const key = item.prefix + '/-/example2.js-' + process.version;

      it('should upload file', function* () {
        const info = yield nfs.upload(__filename, {key: key});
        if (config.mode === 'public') {
          assert.equal(typeof info.url, 'string');
        } else {
          assert.equal(typeof info.key, 'string');
        }
      });

      it('should download file', function* () {
        const tmpfile = path.join(__dirname, '.tmp-file.js');
        yield nfs.download(key, tmpfile);
        assert.equal(fs.readFileSync(tmpfile, 'utf8'), fs.readFileSync(__filename, 'utf8'));
      });

      it('should get download stream', function* () {
        const tmpfile = path.join(__dirname, '.tmp-file.js');
        const stream = yield nfs.createDownloadStream(key);
        const ws = fs.createWriteStream(tmpfile);
        function end() {
          return function (callback) {
            ws.on('close', callback);
          };
        }
        stream.pipe(ws);
        yield end();
        assert.equal(fs.readFileSync(tmpfile, 'utf8'), fs.readFileSync(__filename, 'utf8'));
      });

      it('should create signature url', function () {
        const url = nfs.url(key);
        assert.equal(typeof url, 'string');
        assert.equal(url, 'http://' + process.env.OSS_CNPM_BUCKET + '.oss-cn-hangzhou.aliyuncs.com' + key);
      });

      it('should upload file with headers', function* () {
        const cacheKey = key + '-cache';
        const info = yield nfs.upload(__filename, {
          key: cacheKey,
        });
        if (config.mode === 'public') {
          assert.equal(typeof info.url, 'string');
          const r = yield urllib.request(info.url, {
            method: 'HEAD',
          });
          console.log(r.headers);
          assert.equal(r.status, 200);
          assert.equal(r.headers['cache-control'], 'max-age=0, s-maxage=60');
        } else {
          assert.equal(typeof info.key, 'string');
          const url = nfs.url(info.key);
          const r = yield urllib.request(url, {
            method: 'HEAD',
          });
          console.log(r.headers);
          assert.equal(r.status, 200);
          assert.equal(r.headers['cache-control'], 'max-age=0, s-maxage=60');
        }
      });

      it('should remove the file', function* () {
        const tmpfile = path.join(__dirname, '.tmp-file.js');
        yield nfs.download(key, tmpfile);
        yield nfs.remove(key);
        try {
          yield nfs.download(key, tmpfile);
          throw new Error('should not run this');
        } catch (err) {
          assert.equal(err.name, 'NoSuchKeyError');
        }
      });
    });
  });
});
